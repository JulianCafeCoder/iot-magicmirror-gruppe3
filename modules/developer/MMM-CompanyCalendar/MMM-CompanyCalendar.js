Module.register("MMM-CompanyCalendar", {
  defaults: {
    employees:       [],
    fetchInterval:   15 * 60 * 1000,
    firstDayOfWeek:  1,
    maxEventsPerDay: 4,
    showLocation:    true,
    mirrorConfigId:  null,
  },

  events: [],

  start() {
    Log.info(`${this.name}: started`);
    this.sendSocketNotification("INIT", this.config);
  },

  getStyles() { return ["MMM-CompanyCalendar.css"]; },

  socketNotificationReceived(notification, payload) {
    if (notification === "CALENDAR_EVENTS") {
      this.events = payload;
      this.updateDom(300);
    }
  },

  getDom() {
    const wrap = document.createElement("div");
    wrap.className = "cc-wrap";

    if (!this.events.length) {
      wrap.innerHTML = `<div class="cc-loading">Lade Kalender…</div>`;
      return wrap;
    }

    wrap.appendChild(this._buildHeader());
    wrap.appendChild(this._buildLegend());
    wrap.appendChild(this._buildDowHeader());
    wrap.appendChild(this._buildFourWeeks());
    return wrap;
  },

  // ── Section header ────────────────────────────────────────────────────────

  _buildHeader() {
    const kw = this._isoWeek(new Date());
    const header = document.createElement("div");
    header.className = "cc-header";
    header.innerHTML =
      `<span class="cc-header-dot"></span>`
      + `<span>Kalender &nbsp;·&nbsp; KW ${kw}</span>`;
    return header;
  },

  // ── Legend ────────────────────────────────────────────────────────────────

  _buildLegend() {
    const legend = document.createElement("div");
    legend.className = "cc-legend";

    // Mitarbeiter aus Events ableiten (DB-Quelle), Fallback auf config.employees
    const fromEvents = [];
    const seen = new Set();
    for (const ev of this.events) {
      if (!seen.has(ev.employee)) {
        seen.add(ev.employee);
        fromEvents.push({ name: ev.employee, color: ev.color });
      }
    }
    const employees = fromEvents.length > 0
      ? fromEvents
      : (this.config.employees || []);

    for (const emp of employees) {
      const item = document.createElement("span");
      item.className = "cc-legend-item";
      item.innerHTML =
        `<span class="cc-legend-dot" style="background:${emp.color}"></span>`
        + `<span class="cc-legend-name">${emp.name}</span>`;
      legend.appendChild(item);
    }
    return legend;
  },

  // ── Day-of-week header row ────────────────────────────────────────────────

  _buildDowHeader() {
    const row = document.createElement("div");
    row.className = "cc-dow-row";

    const blank = document.createElement("div");
    blank.className = "cc-kw-cell";
    row.appendChild(blank);

    const names = this.config.firstDayOfWeek === 1
      ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
      : ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

    for (const name of names) {
      const cell = document.createElement("div");
      cell.className = "cc-dow-cell";
      cell.textContent = name;
      row.appendChild(cell);
    }
    return row;
  },

  // ── Four-week grid ────────────────────────────────────────────────────────

  _buildFourWeeks() {
    const container = document.createElement("div");
    container.className = "cc-four-weeks";

    const weekStart = this._currentWeekStart();
    for (let w = 0; w < 4; w++) {
      const start = new Date(weekStart.getTime() + w * 7 * 86400000);
      container.appendChild(this._buildWeekRow(start));
    }
    return container;
  },

  _buildWeekRow(weekStart) {
    const row = document.createElement("div");
    row.className = "cc-week-row";

    const kw = document.createElement("div");
    kw.className = "cc-kw-cell";
    kw.textContent = `KW ${this._isoWeek(weekStart)}`;
    row.appendChild(kw);

    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart.getTime() + d * 86400000);
      row.appendChild(this._buildDayCell(day));
    }
    return row;
  },

  _buildDayCell(day) {
    const cell = document.createElement("div");
    cell.className = "cc-day-cell";
    const isToday = this._isSameDay(day, new Date());
    if (isToday) cell.classList.add("cc-today");
    const dow = day.getDay();
    if (dow === 0 || dow === 6) cell.classList.add("cc-weekend");

    const dateLabel = document.createElement("div");
    dateLabel.className = "cc-date-label";
    dateLabel.innerHTML = isToday
      ? `<span class="cc-today-badge">${day.getDate()}</span>`
      : `<span>${day.getDate()}</span>`;
    cell.appendChild(dateLabel);

    const events  = this._eventsForDay(day);
    const allDay  = events.filter(ev => ev.allDay);
    const timed   = events.filter(ev => !ev.allDay);

    for (const ev of allDay) {
      cell.appendChild(this._buildAllDayBanner(ev));
    }

    const visible  = timed.slice(0, this.config.maxEventsPerDay);
    const overflow = timed.length - visible.length;

    for (const ev of visible) {
      cell.appendChild(this._buildEventChip(ev));
    }
    if (overflow > 0) {
      const more = document.createElement("div");
      more.className = "cc-more";
      more.textContent = `+${overflow} weitere`;
      cell.appendChild(more);
    }
    return cell;
  },

  // ── Event renderers ───────────────────────────────────────────────────────

  _buildAllDayBanner(ev) {
    const banner = document.createElement("div");
    banner.className = "cc-allday-banner";
    banner.style.background  = ev.color + "33";
    banner.style.borderColor = ev.color;
    banner.innerHTML =
      `<span class="cc-allday-dot" style="background:${ev.color}"></span>`
      + `<span class="cc-allday-title">${this._truncate(ev.title, 20)}</span>`;
    return banner;
  },

  _buildEventChip(ev) {
    const chip = document.createElement("div");
    chip.className = "cc-event";
    chip.style.borderLeftColor  = ev.color;
    chip.style.backgroundColor  = ev.color + "1a";

    const time = new Date(ev.start).toLocaleTimeString("de-DE", {
      hour: "2-digit", minute: "2-digit",
    });

    chip.innerHTML =
      `<span class="cc-ev-time">${time}</span>`
      + `<span class="cc-ev-title">${this._truncate(ev.title, 20)}</span>`
      + (this.config.showLocation && ev.location
        ? `<span class="cc-ev-loc">${this._truncate(ev.location, 14)}</span>`
        : "");
    return chip;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  _currentWeekStart() {
    const now = new Date();
    const dow = now.getDay();
    const offset = this.config.firstDayOfWeek === 1
      ? (dow === 0 ? 6 : dow - 1)
      : dow;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  },

  _eventsForDay(day) {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayEnd   = dayStart + 86400000;
    return this.events.filter(ev => ev.start < dayEnd && ev.end > dayStart);
  },

  _isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth()      === b.getMonth()
      && a.getDate()       === b.getDate();
  },

  _isoWeek(date) {
    const d  = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  _truncate(str, max) {
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
  },
});
