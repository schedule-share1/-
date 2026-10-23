// ===== Firebase設定 =====
const firebaseConfig = {
  apiKey: "AIzaSyCn9ynoMkceF_4oucSsuyJk2MR63rXoL78",
  authDomain: "school-schedule-8806e.firebaseapp.com",
  databaseURL: "https://school-schedule-8806e-default-rtdb.firebaseio.com",
  projectId: "school-schedule-8806e",
  storageBucket: "school-schedule-8806e.firebasestorage.app",
  messagingSenderId: "520405731274",
  appId: "1:520405731274:web:1c7f98a459bdce3dbab133"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const tasksRef = db.ref("tasks");

// ===== 状態 =====
let tasks = [];
let selectedTeacher = 'ALL';
let selectedDate = 'ALL';
let selectedType = 'ALL';
let lastCheckedDate = null;
let lastEndedSignature = "";

const teacherList = ["小松先生", "中塚先生", "塩沢誉先生", "塩澤仁士先生", "福澤先生", "丸山先生", "清水先生"];
const typeList = ["会議", "行事", "部活", "資格指導", "その他"];

const ACTIVE_CLASS = "bg-cyan-600 text-white ring-2 ring-cyan-400/60";
const INACTIVE_CLASS = "bg-slate-800/60 text-white border border-slate-700 hover:bg-slate-700/60";

document.addEventListener("DOMContentLoaded", () => {
  renderTeacherTabs();
  renderDateTabs();
  renderTypeTabs();

  // 日付が変わったら（0時を過ぎたら）自動更新
  setInterval(checkDateChange, 30 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkDateChange();
  });

  // リアルタイムでデータベースを監視
  tasksRef.on("value", (snapshot) => {
    const data = snapshot.val();
    tasks = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];

    // 昨日以前の古いデータを自動クリーンアップ（削除）
    cleanOldTasks(tasks);

    renderSchedule();
  });
});

// ===== 日付ユーティリティ =====
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayFormatted() {
  return formatLocalDate(new Date());
}

// 翌日になったら自動削除する処理
function cleanOldTasks(list) {
  const todayStr = getTodayFormatted();
  list.forEach(task => {
    if (task.date < todayStr) {
      db.ref("tasks/" + task.id).remove();
    }
  });
}

// 予定が終了しているか判定
function isTaskEnded(task, now = new Date()) {
  const today = formatLocalDate(now);
  if (task.date < today) return true;
  if (task.date > today) return false;

  // 本日の予定：終了時間を過ぎていれば終了。「終日」「１日中」は日付が変わるまで終了しない
  const m = /^(\d{1,2}):(\d{2})$/.exec(task.endTime || "");
  if (!m) return false;
  return now.getHours() * 60 + now.getMinutes() >= Number(m[1]) * 60 + Number(m[2]);
}

function getEndedSignature() {
  const now = new Date();
  return tasks.filter(t => isTaskEnded(t, now)).map(t => t.id).join("|");
}

function checkDateChange() {
  if (lastCheckedDate && getTodayFormatted() !== lastCheckedDate) {
    renderDateTabs();
    renderSchedule();
  } else if (getEndedSignature() !== lastEndedSignature) {
    renderSchedule();
  }
}

// ===== 絞り込みパネル =====
function toggleFilterPanel() {
  const panel = document.getElementById("filterPanel");
  const chevron = document.getElementById("filterChevron");
  const isHidden = panel.classList.toggle("hidden");
  chevron.classList.toggle("rotate-180", !isHidden);
}

function updateFilterBadge() {
  const count = (selectedTeacher === 'ALL' ? 0 : 1)
              + (selectedDate === 'ALL' ? 0 : 1)
              + (selectedType === 'ALL' ? 0 : 1);
  const badge = document.getElementById("filterActiveBadge");
  badge.textContent = count;
  badge.classList.toggle("hidden", count === 0);
}

// 先生タブ
function renderTeacherTabs() {
  const baseClass = "px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all shadow-sm";
  const active = `${baseClass} font-bold ${ACTIVE_CLASS}`;
  const inactive = `${baseClass} font-semibold ${INACTIVE_CLASS}`;

  let html = `
    <button type="button" onclick="selectTeacherTab('ALL')" class="${selectedTeacher === 'ALL' ? active : inactive}">
      👥 全員
    </button>`;

  teacherList.forEach(name => {
    html += `
    <button type="button" onclick="selectTeacherTab('${name}')" class="${selectedTeacher === name ? active : inactive}">
      ${name}
    </button>`;
  });

  document.getElementById("teacherTabs").innerHTML = html;
  document.getElementById("currentTeacherLabel").textContent =
    selectedTeacher === 'ALL' ? "表示中: 全員" : `表示中: ${selectedTeacher}`;
}

// 同じ先生をもう一度押すと解除
function selectTeacherTab(value) {
  selectedTeacher = (value === 'ALL' || selectedTeacher === value) ? 'ALL' : value;
  renderTeacherTabs();
  renderSchedule();
}

// 日にちタブ（今日から7日後までの8日間）
function renderDateTabs() {
  const container = document.getElementById("dateTabs");
  const now = new Date();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const days = [];

  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push({
      value: formatLocalDate(d),
      md: `${d.getMonth() + 1}/${d.getDate()}`,
      sub: i === 0 ? '今日' : i === 1 ? '明日' : `(${weekdays[d.getDay()]})`,
      weekday: weekdays[d.getDay()]
    });
  }

  lastCheckedDate = days[0].value;

  if (selectedDate !== 'ALL' && !days.some(day => day.value === selectedDate)) {
    selectedDate = 'ALL';
  }

  const baseClass = "flex flex-col items-center justify-center px-4 py-2 rounded-xl whitespace-nowrap transition-all shadow-sm";

  let html = `
    <button type="button" onclick="selectDateTab('ALL')" class="${baseClass} text-sm font-bold ${selectedDate === 'ALL' ? ACTIVE_CLASS : INACTIVE_CLASS}">
      <span>📅 すべて</span>
    </button>`;

  days.forEach(day => {
    html += `
    <button type="button" onclick="selectDateTab('${day.value}')" class="${baseClass} ${selectedDate === day.value ? ACTIVE_CLASS : INACTIVE_CLASS}">
      <span class="text-sm font-bold">${day.md}</span>
      <span class="text-[11px] font-medium opacity-80">${day.sub}</span>
    </button>`;
  });

  container.innerHTML = html;

  const label = document.getElementById("currentDateLabel");
  if (selectedDate === 'ALL') {
    label.textContent = "表示中: すべての日";
  } else {
    const sel = days.find(day => day.value === selectedDate);
    label.textContent = `表示中: ${sel.md}（${sel.weekday}）`;
  }
}

function selectDateTab(value) {
  selectedDate = (value === 'ALL' || selectedDate === value) ? 'ALL' : value;
  renderDateTabs();
  renderSchedule();
}

// 種別タブ
function renderTypeTabs() {
  const baseClass = "px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all shadow-sm";
  const active = `${baseClass} font-bold ${ACTIVE_CLASS}`;
  const inactive = `${baseClass} font-semibold ${INACTIVE_CLASS}`;

  let html = `
    <button type="button" onclick="selectTypeTab('ALL')" class="${selectedType === 'ALL' ? active : inactive}">
      🏷️ すべて
    </button>`;

  typeList.forEach(type => {
    html += `
    <button type="button" onclick="selectTypeTab('${type}')" class="${selectedType === type ? active : inactive}">
      ${type}
    </button>`;
  });

  document.getElementById("typeTabs").innerHTML = html;
  document.getElementById("currentTypeLabel").textContent =
    selectedType === 'ALL' ? "表示中: すべての種別" : `表示中: ${selectedType}`;
}

function selectTypeTab(value) {
  selectedType = (value === 'ALL' || selectedType === value) ? 'ALL' : value;
  renderTypeTabs();
  renderSchedule();
}

// ===== 予定の描画 =====
function getStart(task) {
  return task.time || task.startTime || "";
}

// 「一日」（以前の「１日中」を含む）かどうか
function isAllDayValue(v) {
  return v === "一日" || v === "１日中";
}

function renderSchedule() {
  const upcomingList = document.getElementById("upcomingTaskList");
  const pastList = document.getElementById("pastTaskList");
  const todayStr = getTodayFormatted();

  updateFilterBadge();
  upcomingList.innerHTML = "";
  pastList.innerHTML = "";

  const filtered = tasks.filter(task => {
    const matchTeacher = selectedTeacher === 'ALL' || task.teacher === selectedTeacher;
    const matchType = selectedType === 'ALL' || task.type === selectedType;
    const matchDate = selectedDate === 'ALL' || task.date === selectedDate;
    return matchTeacher && matchType && matchDate;
  });

  filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const timeKey = t => isAllDayValue(getStart(t)) ? "00:00" : (getStart(t) === "未定" ? "99:99" : getStart(t));
    return timeKey(a).localeCompare(timeKey(b));
  });

  let upcomingCount = 0;
  let pastCount = 0;

  lastEndedSignature = getEndedSignature();
  const now = new Date();

  filtered.forEach(task => {
    const isPast = isTaskEnded(task, now);
    const isToday = task.date === todayStr;
    const card = createTaskCardElement(task, isPast, isToday);

    if (isPast) {
      pastCount++;
      pastList.appendChild(card);
    } else {
      upcomingCount++;
      upcomingList.appendChild(card);
    }
  });

  if (upcomingCount === 0) {
    upcomingList.innerHTML = `
      <li class="bg-slate-800/40 border border-slate-700/60 rounded-xl p-8 text-center text-slate-300">
        <i class="fa-solid fa-calendar-check text-3xl mb-2 text-slate-400"></i>
        <p class="text-base font-medium text-white">該当する今後の予定はありません</p>
      </li>`;
  }

  if (pastCount === 0) {
    pastList.innerHTML = `
      <li class="text-center py-4 text-sm text-slate-400">
        終了した予定はありません
      </li>`;
  }

  document.getElementById("statTotalCount").textContent = tasks.length;
  document.getElementById("statTodayCount").textContent = tasks.filter(t => t.date === todayStr && !isTaskEnded(t, now)).length;
  document.getElementById("statPastCount").textContent = tasks.filter(t => isTaskEnded(t, now)).length;
  document.getElementById("upcomingCountText").textContent = `${upcomingCount} 件`;
  document.getElementById("pastCountText").textContent = `${pastCount} 件`;
}

// 生徒対応の表示（〇・△・×）
const SUPPORT_MARKS = {
  "可":         { mark: "〇", color: "text-emerald-400", label: "可" },
  "時間による": { mark: "△", color: "text-amber-400",   label: "時間による" },
  "不可":       { mark: "×", color: "text-rose-400",    label: "不可" }
};

// 以前の形式（true/false、「可能」「不可能」）のデータにも対応
function normalizeStudentSupport(value) {
  if (value === true || value === "可" || value === "可能") return "可";
  if (value === "時間による") return "時間による";
  return "不可";
}

function createTaskCardElement(task, isPast, isToday) {
  const li = document.createElement("li");

  const baseClass = "bg-slate-800/80 hover:bg-slate-800 border-l-4 border-y border-r border-slate-700/80 rounded-xl p-4 transition-all duration-200 shadow-md relative group flex flex-col sm:flex-row sm:items-center justify-between gap-4";
  const typeClass = `type-card-${task.type || 'その他'}`;
  const statusClass = isPast ? "past-task" : "";
  const todayRingClass = isToday ? "ring-1 ring-amber-400/40 bg-amber-500/5" : "";
  li.className = `${baseClass} ${typeClass} ${statusClass} ${todayRingClass}`;

  const badgeColors = {
    "会議": "bg-red-500/20 text-red-300 border-red-500/30",
    "行事": "bg-amber-500/20 text-amber-300 border-amber-500/30",
    "部活": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    "資格指導": "bg-violet-500/20 text-violet-300 border-violet-500/30",
    "その他": "bg-slate-600/30 text-slate-300 border-slate-500/30"
  };
  const badgeStyle = badgeColors[task.type] || badgeColors["その他"];

  const start = getStart(task);
  let timeText = "";
  if (isAllDayValue(start)) {
    timeText = "一日";
  } else if (start === "未定" && task.endTime === "未定") {
    timeText = "未定";
  } else if (start && task.endTime) {
    timeText = `${start} 〜 ${task.endTime}`;
  } else if (start) {
    timeText = `${start} 〜`;
  } else if (task.endTime) {
    timeText = `〜 ${task.endTime}`;
  } else {
    timeText = "終日 / 時間未定";
  }

  const formattedText = task.text ? escapeHtml(task.text).replace(/\n/g, "<br>") : "";

  // 生徒対応：可＝〇、時間による＝△、不可＝×（データがある場合のみ表示）
  const supportView = (task.studentSupport === undefined) ? null : SUPPORT_MARKS[normalizeStudentSupport(task.studentSupport)];
  const supportHtml = !supportView ? '' : `
    <div class="flex flex-col items-center leading-tight px-2 sm:ml-2" title="生徒対応：${supportView.label}">
      <span class="text-[11px] text-slate-300 font-medium">生徒対応</span>
      <span class="text-2xl font-black ${supportView.color}">${supportView.mark}</span>
    </div>`;

  li.innerHTML = `
    <div class="space-y-2 flex-1 min-w-0">
      <div class="flex items-center flex-wrap gap-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
          <i class="fa-solid fa-user text-xs"></i> ${escapeHtml(task.teacher)}
        </span>
        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeStyle}">
          ${escapeHtml(task.type)}
        </span>
        ${isToday ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse"><i class="fa-solid fa-clock"></i> 本日</span>` : ''}
      </div>

      <div class="flex items-center flex-wrap gap-x-4 gap-y-1 text-white text-sm font-medium">
        <span class="flex items-center gap-1.5">
          <i class="fa-regular fa-calendar text-cyan-400"></i> ${escapeHtml(task.date)}
        </span>
        <span class="flex items-center gap-1.5 text-slate-300">
          <i class="fa-regular fa-clock text-slate-400"></i> ${escapeHtml(timeText)}
        </span>
      </div>

      ${formattedText ? `
        <div class="text-white text-base font-normal pt-1 break-words leading-relaxed">
          ${formattedText}
        </div>` : ''}
    </div>
    ${supportHtml}
  `;

  return li;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
