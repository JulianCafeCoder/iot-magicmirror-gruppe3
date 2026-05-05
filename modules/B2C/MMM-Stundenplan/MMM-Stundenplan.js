Module.register("MMM-Stundenplan", {
  defaults: {
    klasse:          "11BE13",
    updateInterval:  60 * 1000,
    refreshInterval: 30 * 60 * 1000,
  },

  perioden:  [],
  eintraege: [],
  loaded:    false,
  _timer:    null,

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start() {
    Log.info(`${this.name} gestartet – Klasse ${this.config.klasse}`);
    this._fetch();
    this._timer = setInterval(() => this.updateDom(0), this.config.updateInterval);
    setInterval(() => this._fetch(), this.config.refreshInterval);
  },

  suspend() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  resume() {
    this.updateDom(0);
    if (!this._timer) {
      this._timer = setInterval(() => this.updateDom(0), this.config.updateInterval);
    }
  },

  _fetch() {
    this.sendSocketNotification("LOAD_STUNDENPLAN", { klasse: this.config.klasse });
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "STUNDENPLAN_LOADED") {
      this.perioden  = payload.perioden;
      this.eintraege = payload.eintraege;
      this.loaded    = true;
      this.updateDom(300);
    }
  },

  getStyles() { return ["MMM-Stundenplan.css"]; },
  getHeader() { return this.config.klasse + " · Stundenplan"; },

  // ── DOM ────────────────────────────────────────────────────────────────────

  getDom() {
    const wrap = document.createElement("div");
    wrap.className = "sp-wrap";

    if (!this.loaded) {
      wrap.innerHTML = "<div class='sp-loading'>Lade Stundenplan…</div>";
      return wrap;
    }
    if (!this.perioden.length) {
      wrap.innerHTML = "<div class='sp-loading'>Keine Daten verfügbar</div>";
      return wrap;
    }

    const now        = new Date();
    const todayDow   = now.getDay();   // 0=So 1=Mo..5=Fr 6=Sa
    const nowMin     = now.getHours() * 60 + now.getMinutes();
    const isSchoolDay = todayDow >= 1 && todayDow <= 5;
    const todayColIdx = isSchoolDay ? todayDow - 1 : -1;  // 0..4 → MO..FR
    const kw         = this._isoWeek(now);

    // Build lookup: schedule[periode_nr][wochentag] = [entries]
    const schedule = {};
    for (const e of this.eintraege) {
      if (!schedule[e.periode_nr]) schedule[e.periode_nr] = {};
      if (!schedule[e.periode_nr][e.wochentag]) schedule[e.periode_nr][e.wochentag] = [];
      schedule[e.periode_nr][e.wochentag].push(e);
    }

    // Find current period number
    let currentPeriodNr = -1;
    for (const p of this.perioden) {
      const [sh, sm] = p.start_time.split(":").map(Number);
      const [eh, em] = p.end_time.split(":").map(Number);
      if (nowMin >= sh * 60 + sm && nowMin < eh * 60 + em) {
        currentPeriodNr = p.nummer;
        break;
      }
    }

    // ── Grid ─────────────────────────────────────────────────────────────────
    const grid = document.createElement("div");
    grid.className = "sp-grid";

    // Dynamically calculate row height so all periods fit the viewport
    const N         = this.perioden.length;
    const mmHeader  = 52;   // MagicMirror module header
    const padV      = 44;   // sp-wrap padding top + bottom
    const dayRowH   = 30;   // day-name row height
    const dayGap    = 10;   // gap below day row
    const rowGap    = 8;    // gap between period rows
    const available = window.innerHeight - mmHeader - padV - dayRowH - dayGap - (N - 1) * rowGap;
    const rowH      = Math.max(42, Math.floor(available / N));

    wrap.style.height   = (window.innerHeight - mmHeader) + "px";
    grid.style.gridTemplateRows = `${dayRowH}px repeat(${N}, ${rowH}px)`;
    grid.style.rowGap   = rowGap + "px";

    const DAYS = ["MO", "DI", "MI", "DO", "FR"];

    // Top-left empty cell
    grid.appendChild(document.createElement("div"));

    // Day header cells
    DAYS.forEach((d, i) => {
      const el = document.createElement("div");
      el.className = "sp-day-head" + (i === todayColIdx ? " sp-day-today" : "");
      el.textContent = d;
      grid.appendChild(el);
    });

    // Period rows
    for (const p of this.perioden) {
      const isCurrentRow = p.nummer === currentPeriodNr;

      // Time cell
      const timeEl = document.createElement("div");
      timeEl.className = "sp-time-cell" + (isCurrentRow ? " sp-time-now" : "");
      const timeStart = document.createElement("span");
      timeStart.className = "sp-time-start";
      timeStart.textContent = p.start_time;
      const timeEnd = document.createElement("span");
      timeEnd.className = "sp-time-end";
      timeEnd.textContent = p.end_time;
      timeEl.appendChild(timeStart);
      timeEl.appendChild(timeEnd);
      grid.appendChild(timeEl);

      // Day cells
      for (let colIdx = 0; colIdx < 5; colIdx++) {
        const wochentag = colIdx + 1;
        const entries   = (schedule[p.nummer] || {})[wochentag] || [];
        const isToday   = colIdx === todayColIdx;
        const isNow     = isToday && isCurrentRow;
        const isDim     = todayColIdx >= 0 && !isToday;

        const cell = document.createElement("div");

        if (!entries.length) {
          cell.className = "sp-card sp-card--empty" + (isDim ? " sp-card--dim" : "");
          grid.appendChild(cell);
          continue;
        }

        const hue = this._hueForSubject(entries[0].fach);
        cell.style.setProperty("--hue", hue);
        cell.className = "sp-card"
          + (isNow   ? " sp-card--now"   : "")
          + (isDim   ? " sp-card--dim"   : "")
          + (isToday && !isNow ? " sp-card--today" : "");

        if (entries.length === 1) {
          const e = entries[0];
          const roomText = [e.raum, e.lehrer].filter(Boolean).join(" · ");
          const fachEl = document.createElement("span");
          fachEl.className = "sp-fach";
          fachEl.textContent = e.fach;
          cell.appendChild(fachEl);
          if (roomText) {
            const roomEl = document.createElement("span");
            roomEl.className = "sp-room";
            roomEl.textContent = roomText;
            cell.appendChild(roomEl);
          }
        } else {
          // Multiple entries (split groups)
          entries.forEach((e, i) => {
            if (i > 0) {
              const sep = document.createElement("div");
              sep.className = "sp-entry-divider";
              cell.appendChild(sep);
            }
            const group = document.createElement("div");
            group.className = "sp-entry-group";
            const fachEl = document.createElement("span");
            fachEl.className = "sp-fach sp-fach--small";
            fachEl.textContent = e.fach;
            const roomText = [e.raum, e.lehrer].filter(Boolean).join(" · ");
            // Room first (→ left), fach second (→ right)
            if (roomText) {
              const roomEl = document.createElement("span");
              roomEl.className = "sp-room";
              roomEl.textContent = roomText;
              group.appendChild(roomEl);
            }
            group.appendChild(fachEl);
            cell.appendChild(group);
          });
        }

        if (isNow) {
          const dot = document.createElement("span");
          dot.className = "sp-now-dot";
          cell.appendChild(dot);
        }

        grid.appendChild(cell);
      }
    }

    wrap.appendChild(grid);
    return wrap;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  _hueForSubject(s) {
    const map = {
      MAT: 8,   DEU: 38,  ENG: 145, INF: 195, SPO: 165, KUN: 280,
      PHY: 220, CHE: 110, BIO: 90,  GES: 25,  GEO: 50,  REL: 320,
      MUS: 260, LF:  195, WUK: 55,  POL: 30,  ETH: 310,
    };
    if (map[s] !== undefined) return map[s];
    // Hash unknown subjects to a consistent hue
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
    return h % 360;
  },

  _isoWeek(date) {
    const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },
});
