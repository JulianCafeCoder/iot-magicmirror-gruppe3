Module.register("MMM-CompanyCalendar", {
  defaults: {
    employees: [],
    fetchInterval: 15 * 60 * 1000,
    viewMode: "week",        // "week" | "month"
    firstDayOfWeek: 1,       // 0 = Sonntag, 1 = Montag
    showWeekNumbers: true,
    maxEventsPerDay: 4,
    showLocation: false,
  },

  events: [],
  viewOffset: 0,            // week/month offset from today

  start() {
    Log.info(`${this.name}: started`);
    this.sendSocketNotification("INIT", this.config);
  },

  getStyles() {
    return ["MMM-CompanyCalendar.css"];
  },

  getTranslations() {
    return false;
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "CALENDAR_EVENTS") {
      this.events = payload;
      this.updateDom(300);
    }
  },

  notificationReceived(notification, payload) {
    if (notification === "KEYPRESS") {
      if (payload.keyName === "ArrowRight") {
        this.viewOffset += 1;
        this.updateDom(200);
      } else if (payload.keyName === "ArrowLeft") {
        this.viewOffset -= 1;
        this.updateDom(200);
      } else if (payload.keyName === "t" || payload.keyName === "T") {
        this.viewOffset = 0;
        this.updateDom(200);
      } else if (payload.keyName === "m" || payload.keyName === "M") {
        this.config.viewMode = this.config.viewMode === "week" ? "month" : "week";
        this.viewOffset = 0;
        this.updateDom(200);
      }
    }
  },

  getDom() {
    const wrap = document.createElement("div");
    wrap.className = "cc-wrap";

    if (!this.events.length) {
      wrap.innerHTML = `<div class="cc-loading"><span>Lade Kalender…</span></div>`;
      return wrap;
    }

    wrap.appendChild(this._buildLegend());
    wrap.appendChild(this._buildNav());

    if (this.config.viewMode === "month") {
      wrap.appendChild(this._buildMonthView());
    } else {
      wrap.appendChild(this._buildWeekView());
    }

    return wrap;
  },

  _buildLegend() {
    const legend = document.createElement("div");
    legend.className = "cc-legend";
    const employees = this.config.employees || [];
    for (const emp of employees) {
      const item = document.createElement("span");
      item.className = "cc-legend-item";
      item.innerHTML = `<span class="cc-legend-dot" style="background:${emp.color}"></span>${emp.name}`;
      legend.appendChild(item);
    }
    return legend;
  },

  _buildNav() {
    const nav = document.createElement("div");
    nav.className = "cc-nav";
    const label = this.config.viewMode === "week"
      ? this._weekLabel()
      : this._monthLabel();
    nav.innerHTML = `<span class="cc-nav-label">${label}</span>`;
    return nav;
  },

  _weekLabel() {
    const { start } = this._currentWeekRange();
    const end = new Date(start.getTime() + 6 * 86400000);
    const fmt = (d) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
    return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
  },

  _monthLabel() {
    const ref = this._currentMonthRef();
    return ref.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  },

  // ── Week view ─────────────────────────────────────────────────────────────

  _buildWeekView() {
    const { start } = this._currentWeekRange();
    const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000));

    const grid = document.createElement("div");
    grid.className = "cc-week-grid";

    for (const day of days) {
      grid.appendChild(this._buildDayCol(day));
    }
    return grid;
  },

  _buildDayCol(day) {
    const col = document.createElement("div");
    col.className = "cc-day-col";
    const isToday = this._isSameDay(day, new Date());
    if (isToday) col.classList.add("cc-today");

    const header = document.createElement("div");
    header.className = "cc-day-header";
    header.innerHTML = `<span class="cc-day-name">${day.toLocaleDateString("de-DE", { weekday: "short" })}</span>`
      + `<span class="cc-day-num ${isToday ? "cc-today-num" : ""}">${day.getDate()}</span>`;
    col.appendChild(header);

    const events = this._eventsForDay(day);

    // Ganztags-Events (Urlaub, Feiertag) immer zuerst, oben anpinnen
    const allDay = events.filter(ev => ev.allDay);
    const timed  = events.filter(ev => !ev.allDay);

    for (const ev of allDay) {
      col.appendChild(this._buildAllDayBanner(ev));
    }

    const visible  = timed.slice(0, this.config.maxEventsPerDay);
    const overflow = timed.length - visible.length;

    for (const ev of visible) {
      col.appendChild(this._buildEventChip(ev));
    }
    if (overflow > 0) {
      const more = document.createElement("div");
      more.className = "cc-more";
      more.textContent = `+${overflow} weitere`;
      col.appendChild(more);
    }
    return col;
  },

  // ── Month view ────────────────────────────────────────────────────────────

  _buildMonthView() {
    const ref = this._currentMonthRef();
    const year = ref.getFullYear();
    const month = ref.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);

    // pad to start on correct weekday
    let startDay = firstOfMonth.getDay();
    if (this.config.firstDayOfWeek === 1) startDay = (startDay + 6) % 7;

    const grid = document.createElement("div");
    grid.className = "cc-month-grid";

    // Day-of-week headers
    const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    if (this.config.firstDayOfWeek === 0) dayNames.unshift(dayNames.pop());
    for (const name of dayNames) {
      const h = document.createElement("div");
      h.className = "cc-month-dow";
      h.textContent = name;
      grid.appendChild(h);
    }

    // Empty leading cells
    for (let i = 0; i < startDay; i++) {
      const blank = document.createElement("div");
      blank.className = "cc-month-cell cc-blank";
      grid.appendChild(blank);
    }

    for (let d = 1; d <= lastOfMonth.getDate(); d++) {
      const day = new Date(year, month, d);
      const cell = document.createElement("div");
      cell.className = "cc-month-cell";
      if (this._isSameDay(day, new Date())) cell.classList.add("cc-today");

      const num = document.createElement("span");
      num.className = "cc-month-day-num";
      num.textContent = d;
      cell.appendChild(num);

      const events = this._eventsForDay(day);
      const visible = events.slice(0, 3);
      for (const ev of visible) {
        cell.appendChild(this._buildEventChip(ev, true));
      }
      if (events.length > 3) {
        const more = document.createElement("div");
        more.className = "cc-more";
        more.textContent = `+${events.length - 3}`;
        cell.appendChild(more);
      }
      grid.appendChild(cell);
    }
    return grid;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  _buildAllDayBanner(ev) {
    const banner = document.createElement("div");
    banner.className = "cc-allday-banner";
    banner.style.background     = ev.color + "33";
    banner.style.borderColor    = ev.color;
    banner.innerHTML = `<span class="cc-allday-dot" style="background:${ev.color}"></span>`
      + `<span class="cc-allday-title">${this._truncate(ev.title, 20)}</span>`;
    return banner;
  },

  _buildEventChip(ev, compact = false) {
    const chip = document.createElement("div");
    chip.className = "cc-event" + (compact ? " cc-event-compact" : "");
    chip.style.borderLeftColor = ev.color;
    chip.style.backgroundColor = ev.color + "22";

    const time = ev.allDay
      ? "Ganztags"
      : new Date(ev.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

    chip.innerHTML = compact
      ? `<span class="cc-ev-dot" style="background:${ev.color}"></span><span class="cc-ev-title">${this._truncate(ev.title, 18)}</span>`
      : `<span class="cc-ev-time">${time}</span><span class="cc-ev-title">${this._truncate(ev.title, 22)}</span>`
        + (this.config.showLocation && ev.location ? `<span class="cc-ev-loc">${ev.location}</span>` : "");

    return chip;
  },

  _eventsForDay(day) {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    return this.events.filter(ev => ev.start < dayEnd && ev.end > dayStart);
  },

  _currentWeekRange() {
    const now = new Date();
    const dow = now.getDay();
    const offset = this.config.firstDayOfWeek === 1 ? (dow === 0 ? 6 : dow - 1) : dow;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset + this.viewOffset * 7);
    return { start: monday };
  },

  _currentMonthRef() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + this.viewOffset, 1);
  },

  _isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  },

  _truncate(str, max) {
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
  },
});
