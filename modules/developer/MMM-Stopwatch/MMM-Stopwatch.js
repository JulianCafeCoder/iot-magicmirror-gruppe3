Module.register("MMM-Stopwatch", {
  defaults: {},

  _active:   true,
  _running:  false,
  _elapsed:  0,      // ms
  _base:     0,      // ms at last pause
  _startTs:  0,      // Date.now() when last started
  _interval: null,
  _laps:     [],

  start() { Log.info(`${this.name}: gestartet`); },

  getDom() {
    const w = document.createElement("div");
    w.id = "mmm-stopwatch-root";
    return w;
  },

  notificationReceived(notification, payload) {
    if (notification === "MODULE_DOM_CREATED") { this._render(); return; }
    if (notification === "MODULE_ACTIVATED") {
      this._active = (payload.id === this.name);
      this._render();
    }
    if (!this._active) return;
    if (notification !== "KEYPRESS") return;

    const key = payload.keyName;
    if (key === " ") { this._toggle(); return; }
    if (key === "Enter") { if (this._running) this._lap(); return; }
    if (key === "r" || key === "R") { this._reset(); return; }
    if (key === "Escape") { this._stopAndDeactivate(); }
  },

  _toggle() {
    if (this._running) {
      this._base = this._elapsed;
      clearInterval(this._interval); this._interval = null;
      this._running = false;
    } else {
      this._startTs = Date.now();
      this._interval = setInterval(() => {
        this._elapsed = this._base + Date.now() - this._startTs;
        this._render();
      }, 30);
      this._running = true;
    }
    this._render();
  },

  _lap() {
    const last = this._laps.reduce((a, b) => a + b, 0);
    this._laps.push(this._elapsed - last);
    this._render();
  },

  _reset() {
    clearInterval(this._interval); this._interval = null;
    this._running = false;
    this._elapsed = 0; this._base = 0;
    this._laps = [];
    this._render();
  },

  _stopAndDeactivate() {
    clearInterval(this._interval); this._interval = null;
    this._running = false;
    this._active = false;
    this._render();
    this.sendNotification("MODULE_DEACTIVATED", { id: this.name });
  },

  _p(n) { return String(n).padStart(2, "0"); },

  _fmtMs(ms) {
    const m  = Math.floor(ms / 60000);
    const s  = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return { m, s, cs };
  },

  _render() {
    const root = document.getElementById("mmm-stopwatch-root");
    if (!root) return;
    if (!this._active) { root.innerHTML = ""; return; }

    const d = this._fmtMs(this._elapsed);
    const displayedLaps = [...this._laps].reverse().slice(0, 3);

    const lapsHtml = displayedLaps.length ? `
      <div class="sw-laps">
        ${displayedLaps.map((l, i) => {
          const li = this._laps.length - i;
          const ld = this._fmtMs(l);
          return `<div class="sw-lap">
            <span>Runde ${li}</span>
            <span>${this._p(ld.m)}:${this._p(ld.s)}.${this._p(ld.cs)}</span>
          </div>`;
        }).join("")}
      </div>` : "";

    const hint = this._running
      ? "Leertaste stopp · Enter Runde · R reset · Esc beenden"
      : this._elapsed > 0
        ? "Leertaste weiter · R reset · Esc beenden"
        : "Leertaste starten · Esc beenden";

    root.innerHTML = `
      <div class="sw-card">
        <div class="sw-label">Stoppuhr</div>
        <div class="sw-display">
          ${this._p(d.m)}:${this._p(d.s)}<span class="sw-cs">${this._p(d.cs)}</span>
        </div>
        ${lapsHtml}
        <div class="sw-hint">${hint}</div>
        <div class="sw-actions">
          <div class="sw-btn sw-btn--primary">${this._running ? "Stopp" : this._elapsed > 0 ? "Weiter" : "Start"}</div>
          ${this._running ? `<div class="sw-btn">Runde</div>` : ""}
          ${!this._running && this._elapsed > 0 ? `<div class="sw-btn">Reset</div>` : ""}
        </div>
      </div>`;
  },
});
