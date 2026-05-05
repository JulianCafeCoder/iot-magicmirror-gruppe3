Module.register("MMM-TodoList", {
  defaults: {
    title:          "To-Do Liste",
    switchInterval: 12000,
    maxItems:       8,
  },

  // ── State ────────────────────────────────────────────────────────────────

  todos:        [],
  showDone:     false,
  _switchTimer: null,
  _mode:        "idle",      // idle | browsing | adding
  _cursor:      0,
  _inputBuffer: "",

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start() {
    Log.info(`${this.name} started.`);
    this.sendSocketNotification("LOAD_TODOS", { userId: this.config.userId });
    this._startSwitchTimer();
  },

  suspend() { this._clearSwitchTimer(); },

  resume() {
    if (this._mode === "idle") this._startSwitchTimer();
  },

  getStyles() { return ["MMM-TodoList.css"]; },

  getHeader() { return this.config.title; },

  // ── Socket ───────────────────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "TODOS_LOADED") {
      this.todos = payload;
      this._clampCursor();
      this._render();
    }
  },

  // ── Notifications ────────────────────────────────────────────────────────

  notificationReceived(notification, payload) {
    if (notification !== "KEYPRESS") return;
    const key = payload.keyName;

    if (this._mode === "idle") {
      if (key === "Enter") this._enterBrowsing();
      return;
    }

    if (this._mode === "adding") {
      this._handleAddingKey(key);
      return;
    }

    // browsing
    this._handleBrowsingKey(key);
  },

  // ── Key handlers ─────────────────────────────────────────────────────────

  _handleBrowsingKey(key) {
    if (key === "Escape")    { this._enterIdle(); return; }
    if (key === "Tab")       { this._switchTab(); return; }
    if (key === "ArrowDown") { this._moveCursor(1); return; }
    if (key === "ArrowUp")   { this._moveCursor(-1); return; }
    if (key === "Enter" || key === " ") { this._toggleCurrent(); return; }
    if (key === "Delete")    { this._deleteCurrent(); return; }
    if (key === "n")         { this._enterAdding(); return; }
  },

  _handleAddingKey(key) {
    if (key === "Escape") {
      this._mode = "browsing";
      this._inputBuffer = "";
      this._render();
      return;
    }
    if (key === "Enter") {
      const title = this._inputBuffer.trim();
      if (title) this.sendSocketNotification("ADD_TODO", { title, userId: this.config.userId });
      this._mode = "browsing";
      this._inputBuffer = "";
      return;
    }
    if (key === "Backspace") {
      this._inputBuffer = this._inputBuffer.slice(0, -1);
      this._render();
      return;
    }
    if (key === " ") {
      this._inputBuffer += " ";
      this._render();
      return;
    }
    if (key.length === 1) {
      this._inputBuffer += key;
      this._render();
    }
  },

  // ── Mode transitions ─────────────────────────────────────────────────────

  _enterBrowsing() {
    this._mode   = "browsing";
    this._cursor = 0;
    this._clearSwitchTimer();
    this.sendNotification("KEYPRESS_MODE_CHANGED", "MODULE");
    this._render();
  },

  _enterAdding() {
    this._mode        = "adding";
    this._inputBuffer = "";
    this._render();
  },

  _enterIdle() {
    this._mode = "idle";
    this.sendNotification("KEYPRESS_MODE_CHANGED", "DEFAULT");
    this._startSwitchTimer();
    this._render();
  },

  // ── List operations ──────────────────────────────────────────────────────

  _visibleTodos() {
    return this.todos.filter(t => t.done === this.showDone).slice(0, this.config.maxItems);
  },

  _clampCursor() {
    const max = Math.max(0, this._visibleTodos().length - 1);
    if (this._cursor > max) this._cursor = max;
  },

  _moveCursor(dir) {
    const items = this._visibleTodos();
    if (!items.length) return;
    this._cursor = ((this._cursor + dir) + items.length) % items.length;
    this._render();
  },

  _switchTab() {
    this.showDone = !this.showDone;
    this._cursor  = 0;
    this._render();
    if (this._mode === "idle") this._startSwitchTimer();
  },

  _toggleCurrent() {
    const item = this._visibleTodos()[this._cursor];
    if (!item) return;
    this.sendSocketNotification("TOGGLE_TODO", { id: item.id });
  },

  _deleteCurrent() {
    const item = this._visibleTodos()[this._cursor];
    if (!item) return;
    this.sendSocketNotification("DELETE_TODO", { id: item.id });
  },

  // ── Timer ────────────────────────────────────────────────────────────────

  _startSwitchTimer() {
    this._clearSwitchTimer();
    this._switchTimer = setInterval(() => this._switchTab(), this.config.switchInterval);
  },

  _clearSwitchTimer() {
    if (this._switchTimer) { clearInterval(this._switchTimer); this._switchTimer = null; }
  },

  // ── DOM ──────────────────────────────────────────────────────────────────

  getDom() {
    const w = document.createElement("div");
    w.id = "mmm-todolist-root";
    w.className = "todo-wrapper";
    return w;
  },

  _render() {
    const root = document.getElementById("mmm-todolist-root");
    if (!root) return;

    const openCount = this.todos.filter(t => !t.done).length;
    const doneCount = this.todos.filter(t =>  t.done).length;
    const pct = this.todos.length > 0 ? Math.round((doneCount / this.todos.length) * 100) : 0;
    const items = this._visibleTodos();
    const browsing = this._mode === "browsing";
    const adding   = this._mode === "adding";

    // Tabs
    const tabOpenCls = !this.showDone ? "todo-tab todo-tab--active" : "todo-tab";
    const tabDoneCls =  this.showDone ? "todo-tab todo-tab--active" : "todo-tab";

    // Input row (shown when adding)
    const inputHtml = adding ? `
      <div class="todo-input-row">
        <i class="fas fa-plus todo-input-icon"></i>
        <span class="todo-input-text">${this._esc(this._inputBuffer)}<span class="todo-cursor">|</span></span>
      </div>` : "";

    // List items
    let listHtml = "";
    if (items.length === 0 && !adding) {
      listHtml = `<div class="todo-empty">
        <i class="fas fa-${this.showDone ? "star" : "check-circle"}"></i>
        ${this.showDone ? "Noch nichts erledigt" : "Alles erledigt!"}
      </div>`;
    } else {
      for (let i = 0; i < items.length; i++) {
        const t = items[i];
        const focused = browsing && i === this._cursor;
        const doneCls  = t.done   ? " todo-item--done"    : "";
        const focusCls = focused  ? " todo-item--focused" : "";
        const icon     = t.done   ? "fas fa-circle-check" : "far fa-circle";
        const catHtml  = t.category ? `<span class="todo-item-category">${this._esc(t.category)}</span>` : "";
        listHtml += `<div class="todo-item${doneCls}${focusCls}">
          <span class="todo-item-icon"><i class="${icon}"></i></span>
          <span class="todo-item-text">${this._esc(t.title)}</span>
          ${catHtml}
        </div>`;
      }
      const totalVisible = this.todos.filter(t => t.done === this.showDone).length;
      if (totalVisible > this.config.maxItems) {
        listHtml += `<div class="todo-more">+ ${totalVisible - this.config.maxItems} weitere</div>`;
      }
    }

    // Hint bar
    let hint = "";
    if (browsing) {
      hint = `<div class="todo-hint">▲▼ navigieren · Enter abhaken · n neu · Del löschen · Tab wechseln · Esc beenden</div>`;
    } else if (adding) {
      hint = `<div class="todo-hint">Titel eingeben · Enter speichern · Esc abbrechen</div>`;
    } else {
      hint = `<div class="todo-hint todo-hint--idle">Enter · interaktiver Modus</div>`;
    }

    root.innerHTML = `
      <div class="todo-tabs">
        <div class="${tabOpenCls}"><i class="fas fa-circle-dot"></i> Offen <span class="todo-tab-count">${openCount}</span></div>
        <div class="${tabDoneCls}"><i class="fas fa-circle-check"></i> Erledigt <span class="todo-tab-count">${doneCount}</span></div>
        <div class="todo-progress">
          <div class="todo-progress-bar"><div class="todo-progress-fill" style="width:${pct}%"></div></div>
          <span class="todo-progress-label">${pct}% erledigt</span>
        </div>
      </div>
      ${inputHtml}
      <div class="todo-list">${listHtml}</div>
      ${hint}`;
  },

  _esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },
});
