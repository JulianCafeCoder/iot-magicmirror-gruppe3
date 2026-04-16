Module.register("MMM-TodoList", {
  defaults: {
    title: "To-Do Liste",
    // Sekunden bis automatisch zwischen Offen/Erledigt gewechselt wird
    switchInterval: 12000,
    // Max. sichtbare Einträge pro Ansicht
    maxItems: 8
  },

  // ── State ────────────────────────────────────────────────────────────────

  todos: [],
  showDone: false,       // false = offene Todos, true = erledigte Todos
  _switchTimer: null,

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start() {
    Log.info(`${this.name} started.`);
    this.sendSocketNotification("LOAD_TODOS");
    this._startSwitchTimer();
  },

  suspend() {
    this._clearSwitchTimer();
  },

  resume() {
    this._startSwitchTimer();
  },

  getStyles() {
    return ["MMM-TodoList.css"];
  },

  getHeader() {
    return this.config.title;
  },

  // ── Socket ───────────────────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "TODOS_LOADED") {
      this.todos = payload;
      this.updateDom(300);
    }
  },

  // ── Notifications (für manuelles Switchen per z.B. Keyboard-Modul) ──────

  notificationReceived(notification) {
    if (notification === "TODO_SWITCH_VIEW") {
      this._toggle();
    }
  },

  // ── DOM ──────────────────────────────────────────────────────────────────

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "todo-wrapper";

    // Tab-Leiste
    wrapper.appendChild(this._buildTabs());

    // Listen-Bereich
    const list = this._buildList();
    wrapper.appendChild(list);

    return wrapper;
  },

  _buildTabs() {
    const tabs = document.createElement("div");
    tabs.className = "todo-tabs";

    const open = document.createElement("div");
    open.className = `todo-tab${!this.showDone ? " todo-tab--active" : ""}`;
    const openCount = this.todos.filter((t) => !t.done).length;
    open.innerHTML = `<i class="fas fa-circle-dot"></i> Offen <span class="todo-tab-count">${openCount}</span>`;
    tabs.appendChild(open);

    const done = document.createElement("div");
    done.className = `todo-tab${this.showDone ? " todo-tab--active" : ""}`;
    const doneCount = this.todos.filter((t) => t.done).length;
    done.innerHTML = `<i class="fas fa-circle-check"></i> Erledigt <span class="todo-tab-count">${doneCount}</span>`;
    tabs.appendChild(done);

    // Fortschrittsbalken
    const total = this.todos.length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const bar = document.createElement("div");
    bar.className = "todo-progress";
    bar.innerHTML = `
      <div class="todo-progress-bar">
        <div class="todo-progress-fill" style="width:${pct}%"></div>
      </div>
      <span class="todo-progress-label">${pct}% erledigt</span>`;
    tabs.appendChild(bar);

    return tabs;
  },

  _buildList() {
    const container = document.createElement("div");
    container.className = "todo-list";

    const filtered = this.todos
      .filter((t) => t.done === this.showDone)
      .slice(0, this.config.maxItems);

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "todo-empty";
      empty.innerHTML = this.showDone
        ? `<i class="fas fa-star"></i> Noch nichts erledigt`
        : `<i class="fas fa-check-circle"></i> Alles erledigt!`;
      container.appendChild(empty);
      return container;
    }

    for (const todo of filtered) {
      container.appendChild(this._buildItem(todo));
    }

    // Hinweis wenn mehr Todos vorhanden als angezeigt
    const total = this.todos.filter((t) => t.done === this.showDone).length;
    if (total > this.config.maxItems) {
      const more = document.createElement("div");
      more.className = "todo-more";
      more.textContent = `+ ${total - this.config.maxItems} weitere`;
      container.appendChild(more);
    }

    return container;
  },

  _buildItem(todo) {
    const item = document.createElement("div");
    item.className = `todo-item${todo.done ? " todo-item--done" : ""}`;

    const icon = document.createElement("span");
    icon.className = "todo-item-icon";
    icon.innerHTML = todo.done
      ? `<i class="fas fa-circle-check"></i>`
      : `<i class="far fa-circle"></i>`;
    item.appendChild(icon);

    const text = document.createElement("span");
    text.className = "todo-item-text";
    text.textContent = todo.title;
    item.appendChild(text);

    if (todo.category) {
      const cat = document.createElement("span");
      cat.className = "todo-item-category";
      cat.textContent = todo.category;
      item.appendChild(cat);
    }

    return item;
  },

  // ── Timer-Logik ──────────────────────────────────────────────────────────

  _startSwitchTimer() {
    this._clearSwitchTimer();
    this._switchTimer = setInterval(() => {
      this._toggle();
    }, this.config.switchInterval);
  },

  _clearSwitchTimer() {
    if (this._switchTimer) {
      clearInterval(this._switchTimer);
      this._switchTimer = null;
    }
  },

  _toggle() {
    this.showDone = !this.showDone;
    this.updateDom(400);
    // Timer neu starten damit nach manuellem Wechsel wieder voll gezählt wird
    this._startSwitchTimer();
  }
});
