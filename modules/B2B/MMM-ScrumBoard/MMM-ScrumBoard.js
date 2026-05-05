Module.register("MMM-ScrumBoard", {
  defaults: {
    title: "Scrum Board",
  },

  start() {
    this._mode     = "IDLE";   // IDLE | BOARD | NEW_CARD
    this._cursor   = 0;
    this._sprint   = null;
    this._cards    = [];
    this._burndown = null;
    this._form     = { field: 0, title: "", points: 1, assignee: "", column: "todo" };
    this.sendSocketNotification("SCRUM_LOAD");
  },

  getStyles() { return ["MMM-ScrumBoard.css"]; },
  getHeader()  { return this.config.title; },

  // ── Socket ────────────────────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification !== "SCRUM_DATA") return;
    this._sprint   = payload.sprint;
    this._cards    = payload.cards;
    this._burndown = payload.burndown;
    const total = this._orderedCards().length;
    if (this._cursor >= total) this._cursor = Math.max(0, total - 1);
    this.updateDom();
  },

  // ── Notifications ─────────────────────────────────────────────────────────

  notificationReceived(notification, payload) {
    if (notification === "NEW_PAGE") {
      if (this._mode !== "IDLE") {
        this._mode = "IDLE";
        this.sendNotification("KEYPRESS_MODE_CHANGED", "DEFAULT");
        this.updateDom();
      }
      return;
    }
    if (notification !== "KEYPRESS") return;

    const key = payload.keyName;
    if      (this._mode === "IDLE")     this._handleIdle(key);
    else if (this._mode === "BOARD")    this._handleBoard(key);
    else if (this._mode === "NEW_CARD") this._handleForm(key);
  },

  // ── Key handlers ──────────────────────────────────────────────────────────

  _handleIdle(key) {
    if (key !== "Enter") return;
    if (!this._isVisible()) return;
    this._mode   = "BOARD";
    this._cursor = 0;
    this.sendNotification("KEYPRESS_MODE_CHANGED", "MODULE");
    this.updateDom();
  },

  _handleBoard(key) {
    const cards = this._orderedCards();
    if (key === "Escape") {
      this._mode = "IDLE";
      this.sendNotification("KEYPRESS_MODE_CHANGED", "DEFAULT");
      this.updateDom();
      return;
    }
    if (key === "ArrowUp"   && this._cursor > 0)               { this._cursor--; this.updateDom(); return; }
    if (key === "ArrowDown" && this._cursor < cards.length - 1) { this._cursor++; this.updateDom(); return; }
    if (key === "n") { this._openForm(); return; }
    if (key === "m" && cards.length > 0) { this._moveCard(cards[this._cursor]); return; }
    if (key === "d" && cards.length > 0) { this._deleteCard(cards[this._cursor]); return; }
  },

  _handleForm(key) {
    const f    = this._form;
    const COLS = ["todo", "busy", "done"];

    if (key === "Escape") { this._mode = "BOARD"; this.updateDom(); return; }

    if (key === "Enter") {
      if (f.field < 3) { f.field++; this.updateDom(); }
      else             { this._submitCard(); }
      return;
    }

    if (key === "ArrowUp"   && f.field > 0) { f.field--; this.updateDom(); return; }
    if (key === "ArrowDown" && f.field < 3) { f.field++; this.updateDom(); return; }

    if (f.field === 0 || f.field === 2) {
      const prop = f.field === 0 ? "title" : "assignee";
      if (key === "Backspace")   { f[prop] = f[prop].slice(0, -1); this.updateDom(); }
      else if (key.length === 1) { f[prop] += key;                 this.updateDom(); }
    } else if (f.field === 1) {
      if (key === "ArrowRight") { f.points = Math.min(99, f.points + 1); this.updateDom(); }
      if (key === "ArrowLeft")  { f.points = Math.max(1,  f.points - 1); this.updateDom(); }
      if (/^\d$/.test(key)) {
        const n = parseInt(key);
        f.points = n === 0 ? 10 : n;
        this.updateDom();
      }
    } else if (f.field === 3) {
      const idx = COLS.indexOf(f.column);
      if (key === "ArrowRight") { f.column = COLS[(idx + 1) % 3]; this.updateDom(); }
      if (key === "ArrowLeft")  { f.column = COLS[(idx + 2) % 3]; this.updateDom(); }
    }
  },

  // ── Actions ───────────────────────────────────────────────────────────────

  _openForm() {
    this._form = { field: 0, title: "", points: 1, assignee: "", column: "todo" };
    this._mode = "NEW_CARD";
    this.updateDom();
  },

  _moveCard(card) {
    const next = { todo: "busy", busy: "done", done: "todo" }[card.status];
    this.sendSocketNotification("SCRUM_MOVE_CARD", { id: card.id, status: next });
  },

  _deleteCard(card) {
    if (this._cursor > 0) this._cursor--;
    this.sendSocketNotification("SCRUM_DELETE_CARD", { id: card.id });
  },

  _submitCard() {
    const f = this._form;
    if (!f.title.trim()) return;
    this.sendSocketNotification("SCRUM_ADD_CARD", {
      title:        f.title.trim(),
      story_points: f.points,
      assignee:     f.assignee.trim() || "—",
      status:       f.column,
    });
    this._mode = "BOARD";
    this.updateDom();
  },

  // ── Visibility check ─────────────────────────────────────────────────────

  _isVisible() {
    const el = document.querySelector(".module.MMM-ScrumBoard");
    return el ? el.offsetParent !== null : false;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  _orderedCards() {
    return ["todo", "busy", "done"].flatMap(s => this._cards.filter(c => c.status === s));
  },

  // ── DOM ───────────────────────────────────────────────────────────────────

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "scrum-wrapper";

    if (!this._sprint) {
      const loading = document.createElement("div");
      loading.className = "scrum-loading";
      loading.textContent = "Lade Daten…";
      wrapper.appendChild(loading);
      return wrapper;
    }

    if (this._mode === "NEW_CARD") {
      wrapper.appendChild(this._buildForm());
    } else {
      wrapper.appendChild(this._buildBoard());
      if (this._burndown) wrapper.appendChild(this._buildBurndown());
    }

    wrapper.appendChild(this._buildHints());
    return wrapper;
  },

  _buildHints() {
    const el = document.createElement("div");
    el.className = "scrum-hints";
    el.textContent = {
      IDLE:     "[ Enter ] navigieren",
      BOARD:    "[ ↑↓ ] bewegen  ·  [ n ] neue Karte  ·  [ m ] Spalte wechseln  ·  [ d ] löschen  ·  [ Esc ] beenden",
      NEW_CARD: "[ ↑↓ ] Feld wechseln  ·  [ ←→ ] Wert ändern  ·  [ Enter ] weiter  ·  [ Esc ] abbrechen",
    }[this._mode];
    return el;
  },

  // ── Board ─────────────────────────────────────────────────────────────────

  _buildBoard() {
    const board = document.createElement("div");
    board.className = "scrum-board";

    const orderedCards = this._orderedCards();
    const columns = [
      { key: "todo", label: "To Do",       icon: "circle"       },
      { key: "busy", label: "In Progress",  icon: "spinner"      },
      { key: "done", label: "Done",         icon: "check-circle" },
    ];

    for (const col of columns) {
      const colCards = this._cards.filter(c => c.status === col.key);
      const colEl = document.createElement("div");
      colEl.className = `scrum-column scrum-column--${col.key}`;

      const header = document.createElement("div");
      header.className = "scrum-column-header";
      header.innerHTML = `<i class="fas fa-${col.icon}"></i> ${col.label}`;
      const badge = document.createElement("span");
      badge.className = "scrum-column-count";
      badge.textContent = colCards.length;
      header.appendChild(badge);
      colEl.appendChild(header);

      for (const card of colCards) {
        const flatIdx  = orderedCards.findIndex(c => c.id === card.id);
        const selected = this._mode === "BOARD" && flatIdx === this._cursor;
        colEl.appendChild(this._buildCard(card, selected));
      }

      board.appendChild(colEl);
    }

    return board;
  },

  _buildCard(card, selected) {
    const el = document.createElement("div");
    el.className = `scrum-card scrum-card--${card.status}`;
    if (selected) el.classList.add("scrum-card--cursor");

    const titleEl = document.createElement("div");
    titleEl.className = "scrum-card-title";
    titleEl.textContent = card.title;
    el.appendChild(titleEl);

    const meta = document.createElement("div");
    meta.className = "scrum-card-meta";

    const assignee = document.createElement("span");
    assignee.className = "scrum-card-assignee";
    assignee.innerHTML = `<i class="fas fa-user"></i> ${card.assignee}`;
    meta.appendChild(assignee);

    const points = document.createElement("span");
    points.className = "scrum-card-points";
    points.textContent = `${card.story_points} SP`;
    meta.appendChild(points);

    el.appendChild(meta);

    if (card.status === "done" && card.completed_at) {
      const time = document.createElement("div");
      time.className = "scrum-card-time";
      const d = new Date(card.completed_at);
      time.innerHTML = `<i class="fas fa-check"></i> ${d.toLocaleDateString("de-DE")}`;
      el.appendChild(time);
    }

    return el;
  },

  // ── New card form ─────────────────────────────────────────────────────────

  _buildForm() {
    const f         = this._form;
    const COLS      = ["todo", "busy", "done"];
    const COL_LABEL = { todo: "To Do", busy: "In Progress", done: "Done" };

    const form = document.createElement("div");
    form.className = "scrum-form";

    const header = document.createElement("div");
    header.className = "scrum-form-header";
    header.innerHTML = `<i class="fas fa-plus-circle"></i> Neue Karte erstellen`;
    form.appendChild(header);

    const fieldDefs = [
      {
        label:   "Titel",
        display: (f.title || "") + (f.field === 0 ? "▋" : ""),
        empty:   f.field === 0,
      },
      {
        label:   "Story Points",
        display: `← ${f.points} →`,
        empty:   false,
      },
      {
        label:   "Assignee",
        display: (f.assignee || "") + (f.field === 2 ? "▋" : ""),
        empty:   f.field === 2,
      },
      {
        label:   "Spalte",
        display: `← ${COL_LABEL[f.column]} →`,
        empty:   false,
      },
    ];

    fieldDefs.forEach(({ label, display, empty }, i) => {
      const row = document.createElement("div");
      row.className = `scrum-form-row${i === f.field ? " scrum-form-row--active" : ""}`;

      const lbl = document.createElement("div");
      lbl.className = "scrum-form-label";
      lbl.textContent = label;
      row.appendChild(lbl);

      const val = document.createElement("div");
      val.className = "scrum-form-value";
      if (!display || (empty && display === "▋")) val.innerHTML = `<span class="scrum-form-placeholder">…</span>▋`;
      else val.textContent = display;
      row.appendChild(val);

      form.appendChild(row);
    });

    const hint = document.createElement("div");
    hint.className = "scrum-form-submit-hint";
    hint.textContent = f.field < 3
      ? `[ Enter ] weiter → ${fieldDefs[f.field + 1].label}`
      : "[ Enter ] Karte erstellen";
    form.appendChild(hint);

    return form;
  },

  // ── Burndown chart ────────────────────────────────────────────────────────

  _buildBurndown() {
    const container = document.createElement("div");
    container.className = "scrum-burndown";

    const titleEl = document.createElement("div");
    titleEl.className = "scrum-burndown-title";
    titleEl.innerHTML = `<i class="fas fa-chart-line"></i> Burndown – ${this._sprint.name}`;
    container.appendChild(titleEl);

    const { totalPoints, days, actual } = this._burndown;

    if (totalPoints === 0) {
      const empty = document.createElement("div");
      empty.className = "scrum-burndown-empty";
      empty.textContent = "Noch keine Story Points vergeben.";
      container.appendChild(empty);
      return container;
    }

    const W    = 500;
    const H    = 200;
    const PAD  = { top: 14, right: 20, bottom: 62, left: 42 };
    const cW   = W - PAD.left - PAD.right;
    const cH   = H - PAD.top  - PAD.bottom;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "scrum-burndown-svg");

    const xScale = d  => PAD.left + (d / days) * cW;
    const yScale = pt => PAD.top  + cH - (pt / totalPoints) * cH;

    // Y grid + labels
    const step   = totalPoints <= 20 ? 5 : totalPoints <= 50 ? 10 : 20;
    const yTicks = [];
    for (let t = 0; t <= totalPoints; t += step) yTicks.push(t);
    if (yTicks[yTicks.length - 1] !== totalPoints) yTicks.push(totalPoints);

    for (const tick of yTicks) {
      const y    = yScale(tick);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", PAD.left); line.setAttribute("x2", PAD.left + cW);
      line.setAttribute("y1", y);        line.setAttribute("y2", y);
      line.setAttribute("class", "bd-gridline");
      svg.appendChild(line);

      const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lbl.setAttribute("x", PAD.left - 5);
      lbl.setAttribute("y", y + 4);
      lbl.setAttribute("class", "bd-label bd-label--y");
      lbl.textContent = tick;
      svg.appendChild(lbl);
    }

    // X labels
    const xStep = days <= 7 ? 1 : 2;
    for (let d = 0; d <= days; d += xStep) {
      const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lbl.setAttribute("x", xScale(d));
      lbl.setAttribute("y", PAD.top + cH + 16);
      lbl.setAttribute("class", "bd-label bd-label--x");
      lbl.textContent = d === 0 ? "Start" : `T${d}`;
      svg.appendChild(lbl);
    }

    // Ideal line
    const ideal = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ideal.setAttribute("x1", xScale(0));    ideal.setAttribute("y1", yScale(totalPoints));
    ideal.setAttribute("x2", xScale(days)); ideal.setAttribute("y2", yScale(0));
    ideal.setAttribute("class", "bd-ideal");
    svg.appendChild(ideal);

    // Actual polyline
    const pts = actual.map((v, i) => v !== null ? `${xScale(i)},${yScale(v)}` : null).filter(Boolean);
    if (pts.length > 1) {
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      poly.setAttribute("points", pts.join(" "));
      poly.setAttribute("class", "bd-actual");
      svg.appendChild(poly);
    }

    // Data point dots
    actual.forEach((v, i) => {
      if (v === null) return;
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", xScale(i)); dot.setAttribute("cy", yScale(v)); dot.setAttribute("r", 3);
      dot.setAttribute("class", "bd-dot");
      svg.appendChild(dot);
    });

    // Axes
    const axX = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axX.setAttribute("x1", PAD.left); axX.setAttribute("x2", PAD.left + cW);
    axX.setAttribute("y1", PAD.top + cH); axX.setAttribute("y2", PAD.top + cH);
    axX.setAttribute("class", "bd-axis");
    svg.appendChild(axX);

    const axY = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axY.setAttribute("x1", PAD.left); axY.setAttribute("x2", PAD.left);
    axY.setAttribute("y1", PAD.top); axY.setAttribute("y2", PAD.top + cH);
    axY.setAttribute("class", "bd-axis");
    svg.appendChild(axY);

    // Legend
    const legendY = PAD.top + cH + 42;
    [
      { label: "Ideal",   cls: "bd-legend-ideal"  },
      { label: "Aktuell", cls: "bd-legend-actual" },
    ].forEach(({ label, cls }, i) => {
      const lx   = PAD.left + i * 100;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", lx); line.setAttribute("x2", lx + 20);
      line.setAttribute("y1", legendY - 3); line.setAttribute("y2", legendY - 3);
      line.setAttribute("class", cls);
      svg.appendChild(line);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", lx + 24); text.setAttribute("y", legendY);
      text.setAttribute("class", "bd-label bd-label--legend");
      text.textContent = label;
      svg.appendChild(text);
    });

    container.appendChild(svg);
    return container;
  },
});
