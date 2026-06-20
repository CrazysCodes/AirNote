const STORAGE_KEY = "airnote_state";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const PERIODS = ["上午", "下午", "晚上"];
const CATEGORIES = ["地址", "发票", "回复", "账号", "Prompt", "其他"];

const defaultState = {
  items: [
    {
      id: "demo-week-1",
      content: "周三上午跟进客户报价",
      target: "week",
      weekday: "周三",
      period: "上午",
      recurring: true,
      createdAt: "2026-06-18T09:30:00.000Z",
      updatedAt: "2026-06-18T09:30:00.000Z",
      sunk: false,
      done: false,
      doneWeekKey: "",
    },
    {
      id: "demo-week-2",
      content: "晚上整理今天没处理完的杂事",
      target: "week",
      weekday: "周五",
      period: "晚上",
      recurring: false,
      createdAt: "2026-06-18T12:30:00.000Z",
      updatedAt: "2026-06-18T12:30:00.000Z",
      sunk: false,
      done: false,
      doneWeekKey: "",
    },
    {
      id: "demo-today-1",
      content: "把报价链接发给客户",
      target: "today",
      weekday: "",
      period: "",
      recurring: false,
      createdAt: "2026-06-18T10:20:00.000Z",
      updatedAt: "2026-06-18T10:20:00.000Z",
      sunk: false,
      done: false,
      doneWeekKey: "",
    },
  ],
  commonItems: [
    {
      id: "demo-common-1",
      title: "发票抬头",
      content: "91310000************",
      category: "发票",
      pinned: true,
      sensitive: true,
      copyCount: 18,
      lastCopiedAt: "",
    },
    {
      id: "demo-common-2",
      title: "常用回复",
      content: "好的，收到，请稍等。",
      category: "回复",
      pinned: true,
      sensitive: false,
      copyCount: 32,
      lastCopiedAt: "",
    },
  ],
  settings: {
    activeTab: "pocket",
    target: "today",
    weekday: "周一",
    period: "上午",
    commonCategory: "回复",
    commonFilter: "全部",
  },
};

let state = loadState();
let editingItemId = null;
let toastTimer = null;

const $ = (selector) => document.querySelector(selector);

const elements = {
  captureInput: $("#captureInput"),
  targetTabs: $("#targetTabs"),
  weekFields: $("#weekFields"),
  commonFields: $("#commonFields"),
  weekdayChips: $("#weekdayChips"),
  periodChips: $("#periodChips"),
  recurringInput: $("#recurringInput"),
  commonTitleInput: $("#commonTitleInput"),
  categoryChips: $("#categoryChips"),
  sensitiveInput: $("#sensitiveInput"),
  saveButton: $("#saveButton"),
  recentList: $("#recentList"),
  weekList: $("#weekList"),
  weekSummary: $("#weekSummary"),
  commonSearch: $("#commonSearch"),
  commonFilterChips: $("#commonFilterChips"),
  commonList: $("#commonList"),
  editSheet: $("#editSheet"),
  sheetBackdrop: $("#sheetBackdrop"),
  editContentInput: $("#editContentInput"),
  editTargetTabs: $("#editTargetTabs"),
  editWeekFields: $("#editWeekFields"),
  editWeekdayChips: $("#editWeekdayChips"),
  editPeriodChips: $("#editPeriodChips"),
  editRecurringInput: $("#editRecurringInput"),
  toast: $("#toast"),
  manualCopyPanel: $("#manualCopyPanel"),
  manualCopyText: $("#manualCopyText"),
};

init();

function init() {
  renderChoiceChips();
  bindEvents();
  render();
  setTimeout(() => elements.captureInput.focus(), 150);
}

/**
 * 从 localStorage 读取应用状态。这里做轻量结构合并，避免旧数据缺字段导致页面空白。
 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultState();
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items.map(normalizeItem) : [],
      commonItems: Array.isArray(parsed.commonItems) ? parsed.commonItems : [],
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
    };
  } catch (error) {
    console.warn("读取本地 AirNote 数据失败，已回退到默认数据", error);
    return cloneDefaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("保存本地 AirNote 数据失败，请尝试导出备份后清理浏览器存储", error);
    showToast("本地存储失败，请先导出备份");
  }
}

function bindEvents() {
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.activeTab = button.dataset.tab;
      saveState();
      render();
    });
  });

  elements.targetTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-target]");
    if (!button) return;
    state.settings.target = button.dataset.target;
    saveState();
    renderCaptureMode();
  });

  elements.saveButton.addEventListener("click", saveCapture);
  $("#clearDemoButton").addEventListener("click", clearDemoData);
  $("#exportButton").addEventListener("click", exportData);
  $("#importInput").addEventListener("change", importData);
  elements.commonSearch.addEventListener("input", renderCommonList);

  $("#closeSheetButton").addEventListener("click", closeEditSheet);
  elements.sheetBackdrop.addEventListener("click", closeEditSheet);
  $("#saveEditButton").addEventListener("click", saveEdit);
  $("#copyEditButton").addEventListener("click", () => {
    const item = getEditingItem();
    if (item) copyText(item.content);
  });
  $("#deleteEditButton").addEventListener("click", deleteEditingItem);
  $("#closeCopyPanelButton").addEventListener("click", closeManualCopy);

  elements.editTargetTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-target]");
    if (!button) return;
    const item = getEditingItem();
    if (!item) return;
    item.target = button.dataset.target;
    if (item.target !== "week") {
      item.weekday = "";
      item.period = "";
      item.recurring = false;
    } else {
      item.weekday = item.weekday || state.settings.weekday;
      item.period = item.period || state.settings.period;
    }
    renderEditSheet(item);
  });
}

function renderChoiceChips() {
  renderChipGroup(elements.weekdayChips, WEEKDAYS, state.settings.weekday, (value) => {
    state.settings.weekday = value;
    saveState();
    renderChoiceChips();
  });
  renderChipGroup(elements.periodChips, PERIODS, state.settings.period, (value) => {
    state.settings.period = value;
    saveState();
    renderChoiceChips();
  });
  renderChipGroup(elements.categoryChips, CATEGORIES, state.settings.commonCategory, (value) => {
    state.settings.commonCategory = value;
    saveState();
    renderChoiceChips();
  });
  renderChipGroup(elements.commonFilterChips, ["全部", ...CATEGORIES], state.settings.commonFilter, (value) => {
    state.settings.commonFilter = value;
    saveState();
    renderCommonList();
  });
}

function renderEditChoiceChips(item) {
  renderChipGroup(elements.editWeekdayChips, WEEKDAYS, item.weekday || state.settings.weekday, (value) => {
    item.weekday = value;
    renderEditChoiceChips(item);
  });
  renderChipGroup(elements.editPeriodChips, PERIODS, item.period || state.settings.period, (value) => {
    item.period = value;
    renderEditChoiceChips(item);
  });
}

function renderChipGroup(container, values, selectedValue, onSelect) {
  container.innerHTML = "";
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${value === selectedValue ? " selected" : ""}`;
    button.textContent = value;
    button.addEventListener("click", () => onSelect(value));
    container.appendChild(button);
  });
}

function render() {
  renderTabs();
  renderCaptureMode();
  renderRecentList();
  renderWeekList();
  renderCommonList();
}

function renderTabs() {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
  $(`#page-${state.settings.activeTab}`).classList.add("active");
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.tab === state.settings.activeTab);
  });
}

function renderCaptureMode() {
  document.querySelectorAll("#targetTabs button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.target === state.settings.target);
  });
  elements.weekFields.classList.toggle("hidden", state.settings.target !== "week");
  elements.commonFields.classList.toggle("hidden", state.settings.target !== "common");
}

/**
 * 保存快速输入。根据归属进入普通记录、本周安排或常用复制，保持首页操作足够短。
 */
function saveCapture() {
  const content = elements.captureInput.value.trim();
  if (!content) {
    showToast("先写点内容");
    return;
  }

  const now = new Date().toISOString();
  if (state.settings.target === "common") {
    state.commonItems.unshift({
      id: createId(),
      title: elements.commonTitleInput.value.trim() || guessTitle(content),
      content,
      category: state.settings.commonCategory,
      pinned: false,
      sensitive: elements.sensitiveInput.checked,
      copyCount: 0,
      lastCopiedAt: "",
    });
    showToast("已放到常用复制");
  } else {
    state.items.unshift({
      id: createId(),
      content,
      target: state.settings.target,
      weekday: state.settings.target === "week" ? state.settings.weekday : "",
      period: state.settings.target === "week" ? state.settings.period : "",
      recurring: state.settings.target === "week" ? elements.recurringInput.checked : false,
      createdAt: now,
      updatedAt: now,
      sunk: false,
      done: false,
      doneWeekKey: "",
    });
    showToast(state.settings.target === "week" ? "已放进本周" : "已保存到 AirNote");
  }

  elements.captureInput.value = "";
  elements.commonTitleInput.value = "";
  elements.sensitiveInput.checked = false;
  elements.recurringInput.checked = false;
  saveState();
  render();
}

function renderRecentList() {
  const items = [...state.items]
    .sort(byTaskAttention)
    .slice(0, 8);
  elements.recentList.innerHTML = items.length
    ? items.map(renderNoteCard).join("")
    : `<p class="empty-block">还没有内容。先塞一条进来。</p>`;
  bindCardActions(elements.recentList);
}

function renderWeekList() {
  const weekItems = state.items.filter((item) => item.target === "week");
  elements.weekSummary.textContent = `${weekItems.filter((item) => !isItemDone(item)).length} 条待完成`;
  elements.weekList.innerHTML = WEEKDAYS.map((weekday) => {
    const blocks = PERIODS.map((period) => renderTimeBlock(weekday, period, weekItems)).join("");
    return `<div class="week-day"><div class="day-title">${weekday}</div>${blocks}</div>`;
  }).join("");
  bindCardActions(elements.weekList);
}

function renderTimeBlock(weekday, period, weekItems) {
  const items = weekItems
    .filter((item) => item.weekday === weekday && item.period === period)
    .sort(byTaskAttention);
  const body = items.length
    ? items.map(renderNoteCard).join("")
    : `<div class="empty-block">${period}还空着</div>`;
  return `
    <div class="time-block">
      <div class="time-head"><span>${period}</span><span>${items.filter((item) => !isItemDone(item)).length}</span></div>
      <div class="time-items">${body}</div>
    </div>
  `;
}

function renderCommonList() {
  const keyword = elements.commonSearch.value.trim().toLowerCase();
  const filter = state.settings.commonFilter;
  const items = [...state.commonItems]
    .filter((item) => filter === "全部" || item.category === filter)
    .filter((item) => {
      if (!keyword) return true;
      return `${item.title} ${item.content} ${item.category}`.toLowerCase().includes(keyword);
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.copyCount || 0) - (a.copyCount || 0));

  elements.commonList.innerHTML = items.length
    ? items.map(renderCommonCard).join("")
    : `<p class="empty-block">没有匹配的常用内容。</p>`;
  bindCommonActions();
}

function renderNoteCard(item) {
  const when = item.target === "week" ? `${item.weekday}${item.period}` : item.target === "today" ? "今天" : "常用";
  const done = isItemDone(item);
  const overdue = isItemOverdue(item);
  return `
    <article class="note-card${done ? " done" : ""}${overdue ? " overdue" : ""}" data-id="${item.id}">
      <div class="card-main">
        <div class="card-text">${escapeHtml(item.content)}</div>
        <div class="card-meta">
          <span class="tag">${when}</span>
          ${item.recurring ? `<span class="tag">每周循环</span>` : ""}
          ${done ? `<span class="tag done-tag">已完成</span>` : ""}
          ${overdue ? `<span class="tag danger-tag">已逾期</span>` : ""}
          <span>${formatTime(item.updatedAt || item.createdAt)}</span>
        </div>
        <div class="card-actions">
          <button class="action-link done-link" type="button" data-action="done">${done ? "↺ 取消" : "✓ 完成"}</button>
          <button class="action-link" type="button" data-action="copy">复制</button>
          <button class="action-link" type="button" data-action="edit">编辑</button>
          <button class="action-link danger-link" type="button" data-action="delete">删除</button>
        </div>
      </div>
    </article>
  `;
}

function renderCommonCard(item) {
  const shownContent = item.sensitive ? maskText(item.content) : item.content;
  return `
    <article class="common-card" data-id="${item.id}">
      <div class="card-main">
        <div class="section-title">
          <h2>${escapeHtml(item.title)}</h2>
          <button class="icon-button" type="button" data-action="copy-common" aria-label="复制">⧉</button>
        </div>
        <div class="card-text">${escapeHtml(shownContent)}</div>
        <div class="common-meta">
          <span class="tag">${escapeHtml(item.category)}</span>
          ${item.pinned ? `<span class="tag">置顶</span>` : ""}
          ${item.sensitive ? `<span class="tag">已隐藏</span>` : ""}
          <span>复制 ${item.copyCount || 0} 次</span>
          ${item.lastCopiedAt ? `<span>${formatTime(item.lastCopiedAt)}</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="action-link" type="button" data-action="pin-common">${item.pinned ? "取消置顶" : "置顶"}</button>
          <button class="action-link" type="button" data-action="sensitive-common">${item.sensitive ? "显示预览" : "隐藏敏感"}</button>
          <button class="action-link" type="button" data-action="delete-common">删除</button>
        </div>
      </div>
    </article>
  `;
}

function bindCardActions(container) {
  container.querySelectorAll(".note-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const item = state.items.find((entry) => entry.id === card.dataset.id);
      if (!item) return;
      if (button.dataset.action === "done") toggleDone(item.id);
      if (button.dataset.action === "copy") copyText(item.content);
      if (button.dataset.action === "edit") openEditSheet(item.id);
      if (button.dataset.action === "delete") deleteItem(item.id);
    });
  });
}

function bindCommonActions() {
  elements.commonList.querySelectorAll(".common-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const item = state.commonItems.find((entry) => entry.id === card.dataset.id);
      if (!item) return;
      if (button.dataset.action === "copy-common") copyCommonItem(item);
      if (button.dataset.action === "pin-common") {
        item.pinned = !item.pinned;
        saveState();
        renderCommonList();
      }
      if (button.dataset.action === "sensitive-common") {
        item.sensitive = !item.sensitive;
        saveState();
        renderCommonList();
      }
      if (button.dataset.action === "delete-common") {
        state.commonItems = state.commonItems.filter((entry) => entry.id !== item.id);
        saveState();
        renderCommonList();
        showToast("已删除常用内容");
      }
    });
  });
}

function openEditSheet(id) {
  editingItemId = id;
  const item = getEditingItem();
  if (!item) return;
  renderEditSheet(item);
  elements.sheetBackdrop.classList.remove("hidden");
  elements.editSheet.classList.remove("hidden");
}

function renderEditSheet(item) {
  elements.editContentInput.value = item.content;
  elements.editRecurringInput.checked = Boolean(item.recurring);
  document.querySelectorAll("#editTargetTabs button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.target === item.target);
  });
  elements.editWeekFields.classList.toggle("hidden", item.target !== "week");
  renderEditChoiceChips(item);
}

function closeEditSheet() {
  editingItemId = null;
  elements.sheetBackdrop.classList.add("hidden");
  elements.editSheet.classList.add("hidden");
}

function saveEdit() {
  const item = getEditingItem();
  if (!item) return;
  item.content = elements.editContentInput.value.trim();
  item.recurring = item.target === "week" ? elements.editRecurringInput.checked : false;
  if (!item.recurring) item.doneWeekKey = "";
  item.updatedAt = new Date().toISOString();
  if (!item.content) {
    showToast("内容不能为空");
    return;
  }
  if (item.target === "common") {
    state.commonItems.unshift({
      id: createId(),
      title: guessTitle(item.content),
      content: item.content,
      category: "其他",
      pinned: false,
      sensitive: false,
      copyCount: 0,
      lastCopiedAt: "",
    });
    state.items = state.items.filter((entry) => entry.id !== item.id);
    saveState();
    closeEditSheet();
    render();
    showToast("已转入常用复制");
    return;
  }
  saveState();
  closeEditSheet();
  render();
  showToast("已保存");
}

function deleteEditingItem() {
  const item = getEditingItem();
  if (!item) return;
  deleteItem(item.id, false);
  closeEditSheet();
}

function getEditingItem() {
  return state.items.find((item) => item.id === editingItemId);
}

/**
 * 切换待办完成状态。循环事项只记录当前周完成，避免下周继续灰掉。
 */
function toggleDone(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  if (item.recurring) {
    const currentWeekKey = getWeekKey(new Date());
    item.doneWeekKey = item.doneWeekKey === currentWeekKey ? "" : currentWeekKey;
    item.done = false;
  } else {
    item.done = !Boolean(item.done);
    item.doneWeekKey = "";
  }
  item.updatedAt = new Date().toISOString();
  saveState();
  render();
  showToast(isItemDone(item) ? "已完成" : "已取消完成");
}

function deleteItem(id, shouldConfirm = true) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  if (shouldConfirm && !window.confirm("确认删除这条记录？")) return;
  state.items = state.items.filter((entry) => entry.id !== id);
  saveState();
  render();
  showToast("已删除");
}

function copyCommonItem(item) {
  item.copyCount = (item.copyCount || 0) + 1;
  item.lastCopiedAt = new Date().toISOString();
  saveState();
  renderCommonList();
  copyText(item.content);
}

/**
 * 优先使用 Clipboard API；微信浏览器等失败时，展示手动复制面板保住核心流程。
 */
async function copyText(text) {
  try {
    if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
    showToast("已复制");
  } catch (error) {
    console.warn("自动复制失败，切换到手动复制", error);
    elements.manualCopyText.value = text;
    elements.manualCopyPanel.classList.remove("hidden");
    elements.manualCopyText.focus();
    elements.manualCopyText.select();
  }
}

function closeManualCopy() {
  elements.manualCopyPanel.classList.add("hidden");
}

/**
 * 导出 JSON 通过浏览器下载完成，不要求网页拥有本地文件写入权限。
 */
function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `AirNote备份-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("已导出 JSON");
}

/**
 * 导入时兼容直接导出的 payload 和纯 state 两种格式，方便用户手动编辑备份。
 */
function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const imported = parsed.state || parsed;
      if (!Array.isArray(imported.items) || !Array.isArray(imported.commonItems)) {
        throw new Error("Invalid pocket data");
      }
      state = {
        items: imported.items.map(normalizeItem),
        commonItems: imported.commonItems,
        settings: { ...defaultState.settings, ...(imported.settings || {}) },
      };
      saveState();
      render();
      showToast("已导入");
    } catch (error) {
      console.warn("导入 AirNote 数据失败", error);
      showToast("导入失败，文件格式不对");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function clearDemoData() {
  state.items = state.items.filter((item) => !item.id.startsWith("demo-"));
  state.commonItems = state.commonItems.filter((item) => !item.id.startsWith("demo-"));
  saveState();
  render();
  showToast("示例已清空");
}

function byTaskAttention(a, b) {
  return (
    Number(isItemDone(a)) - Number(isItemDone(b)) ||
    Number(isItemOverdue(b)) - Number(isItemOverdue(a)) ||
    new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
  );
}

/**
 * 兼容旧 localStorage 数据。旧的 sunk 只保留字段，不再参与 UI 逻辑。
 */
function normalizeItem(item) {
  const source = item && typeof item === "object" ? item : {};
  return {
    id: source.id || createId(),
    content: source.content || "",
    target: source.target || "today",
    weekday: source.weekday || "",
    period: source.period || "",
    recurring: Boolean(source.recurring),
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || source.createdAt || new Date().toISOString(),
    sunk: Boolean(source.sunk),
    done: Boolean(source.done),
    doneWeekKey: source.doneWeekKey || "",
  };
}

/**
 * 判断记录是否完成。每周循环只认当前周的 doneWeekKey，跨周自动恢复未完成。
 */
function isItemDone(item) {
  if (item.recurring) {
    return item.doneWeekKey === getWeekKey(new Date());
  }
  return Boolean(item.done);
}

/**
 * 判断记录是否逾期。V1 没有具体时间，所以只按日期和周几判断，不按上午/下午/晚上切分。
 */
function isItemOverdue(item) {
  if (isItemDone(item)) return false;
  if (item.target === "today") {
    return startOfLocalDay(item.createdAt) < startOfLocalDay(new Date());
  }
  if (item.target === "week") {
    const itemWeekdayIndex = getWeekdayIndex(item.weekday);
    const todayWeekdayIndex = getWeekdayIndex(toChineseWeekday(new Date()));
    return itemWeekdayIndex >= 0 && itemWeekdayIndex < todayWeekdayIndex;
  }
  return false;
}

function getWeekdayIndex(weekday) {
  return WEEKDAYS.indexOf(weekday);
}

function toChineseWeekday(date) {
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

function startOfLocalDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * 生成 ISO 周键，用于让循环事项的完成状态只在当前自然周生效。
 */
function getWeekKey(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const dayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayOffset + 3);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDayOffset = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayOffset + 3);
  const week = 1 + Math.round((date - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function createId() {
  return `airnote-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function guessTitle(content) {
  return content.split(/\s+/).join(" ").slice(0, 18) || "常用内容";
}

function maskText(text) {
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}${"*".repeat(Math.min(12, Math.max(4, text.length - 4)))}${text.slice(-2)}`;
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.add("hidden"), 1800);
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}
