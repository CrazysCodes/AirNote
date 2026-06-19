const STORAGE_KEY = "pocket_v2_state";

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
      items: Array.isArray(parsed.items) ? parsed.items : [],
      commonItems: Array.isArray(parsed.commonItems) ? parsed.commonItems : [],
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
    };
  } catch (error) {
    console.warn("读取本地口袋数据失败，已回退到默认数据", error);
    return cloneDefaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("保存本地口袋数据失败，请尝试导出备份后清理浏览器存储", error);
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
  $("#sinkEditButton").addEventListener("click", sinkEditingItem);
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
    });
    showToast(state.settings.target === "week" ? "已放进本周" : "已塞进口袋");
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
    .sort(byFreshAndSunk)
    .slice(0, 8);
  elements.recentList.innerHTML = items.length
    ? items.map(renderNoteCard).join("")
    : `<p class="empty-block">还没有内容。先塞一条进来。</p>`;
  bindCardActions(elements.recentList);
}

function renderWeekList() {
  const weekItems = state.items.filter((item) => item.target === "week");
  elements.weekSummary.textContent = `${weekItems.filter((item) => !item.sunk).length} 条未沉底`;
  elements.weekList.innerHTML = WEEKDAYS.map((weekday) => {
    const blocks = PERIODS.map((period) => renderTimeBlock(weekday, period, weekItems)).join("");
    return `<div class="week-day"><div class="day-title">${weekday}</div>${blocks}</div>`;
  }).join("");
  bindCardActions(elements.weekList);
}

function renderTimeBlock(weekday, period, weekItems) {
  const items = weekItems
    .filter((item) => item.weekday === weekday && item.period === period)
    .sort(byFreshAndSunk);
  const body = items.length
    ? items.map(renderNoteCard).join("")
    : `<div class="empty-block">${period}还空着</div>`;
  return `
    <div class="time-block">
      <div class="time-head"><span>${period}</span><span>${items.filter((item) => !item.sunk).length}</span></div>
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
  return `
    <article class="note-card${item.sunk ? " sunk" : ""}" data-id="${item.id}">
      <div class="card-main">
        <div class="card-text">${escapeHtml(item.content)}</div>
        <div class="card-meta">
          <span class="tag">${when}</span>
          ${item.recurring ? `<span class="tag">每周循环</span>` : ""}
          ${item.sunk ? `<span class="tag">已沉底</span>` : ""}
          <span>${formatTime(item.updatedAt || item.createdAt)}</span>
        </div>
        <div class="card-actions">
          <button class="action-link" type="button" data-action="copy">复制</button>
          <button class="action-link" type="button" data-action="edit">编辑</button>
          <button class="action-link" type="button" data-action="sink">${item.sunk ? "取消沉底" : "沉底"}</button>
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
      if (button.dataset.action === "copy") copyText(item.content);
      if (button.dataset.action === "edit") openEditSheet(item.id);
      if (button.dataset.action === "sink") toggleSink(item.id);
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

function sinkEditingItem() {
  const item = getEditingItem();
  if (!item) return;
  item.sunk = !item.sunk;
  item.updatedAt = new Date().toISOString();
  saveState();
  closeEditSheet();
  render();
  showToast(item.sunk ? "已沉底" : "已取消沉底");
}

function deleteEditingItem() {
  const item = getEditingItem();
  if (!item) return;
  state.items = state.items.filter((entry) => entry.id !== item.id);
  saveState();
  closeEditSheet();
  render();
  showToast("已删除");
}

function getEditingItem() {
  return state.items.find((item) => item.id === editingItemId);
}

function toggleSink(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  item.sunk = !item.sunk;
  item.updatedAt = new Date().toISOString();
  saveState();
  render();
  showToast(item.sunk ? "已沉底" : "已取消沉底");
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
  link.download = `口袋备份-${new Date().toISOString().slice(0, 10)}.json`;
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
        items: imported.items,
        commonItems: imported.commonItems,
        settings: { ...defaultState.settings, ...(imported.settings || {}) },
      };
      saveState();
      render();
      showToast("已导入");
    } catch (error) {
      console.warn("导入口袋数据失败", error);
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

function byFreshAndSunk(a, b) {
  return Number(a.sunk) - Number(b.sunk) || new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
}

function createId() {
  return `pocket-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
