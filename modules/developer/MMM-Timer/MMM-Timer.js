Module.register("MMM-Timer", {
  defaults: {},

  _active:    false,
  _state:     "stopped",   // stopped | running | editing
  _total:     300,         // seconds (default 5 min)
  _remaining: 300,
  _interval:  null,
  // editing state: which field is focused (0=H, 1=M, 2=S) and digit buffer
  _editField: 1,
  _editVals:  [0, 5, 0],  // H, M, S

  start() { Log.info(`${this.name}: gestartet`); },

  getDom() {
    const w = document.createElement("div");
    w.id = "mmm-timer-root";
    return w;
  },

  notificationReceived(notification, payload) {
    if (notification === "MODULE_ACTIVATED") {
      this._active = (payload.id === this.name);
      this._render();
    }
    if (!this._active) return;
    if (notification !== "KEYPRESS") return;

    const key = payload.keyName;

    if (this._state === "editing") {
      if (key >= "0" && key <= "9") {
        // shift digit into current field
        let v = this._editVals[this._editField] * 10 + parseInt(key);
        const max = this._editField === 0 ? 23 : 59;
        if (v > max) v = parseInt(key);
        this._editVals[this._editField] = v;
        this._render(); return;
      }
      if (key === "ArrowRight") { this._editField = Math.min(2, this._editField + 1); this._render(); return; }
      if (key === "ArrowLeft")  { this._editField = Math.max(0, this._editField - 1); this._render(); return; }
      if (key === "Backspace")  { this._editVals[this._editField] = Math.floor(this._editVals[this._editField] / 10); this._render(); return; }
      if (key === "Enter") {
        this._total = this._editVals[0]*3600 + this._editVals[1]*60 + this._editVals[2];
        this._remaining = this._total;
        this._state = "stopped";
        this._render(); return;
      }
      if (key === "Escape") { this._state = "stopped"; this._render(); return; }
      return;
    }

    if (key === " ") {
      if (this._state === "running") { this._pause(); }
      else { if (this._remaining > 0) this._startTimer(); }
      return;
    }
    if (key === "Enter") {
      this._pause();
      this._editVals = [
        Math.floor(this._total / 3600),
        Math.floor((this._total % 3600) / 60),
        this._total % 60
      ];
      this._editField = 1;
      this._state = "editing";
      this._render(); return;
    }
    if (key === "Escape") { this._pause(); this._remaining = this._total; this._deactivate(); }
  },

  _startTimer() {
    this._state = "running";
    this._interval = setInterval(() => {
      if (this._remaining <= 0) {
        clearInterval(this._interval); this._interval = null;
        this._state = "done";
        this._render(); return;
      }
      this._remaining--;
      this._render();
    }, 1000);
    this._render();
  },

  _pause() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
    if (this._state === "running") this._state = "stopped";
  },

  _deactivate() {
    this._active = false;
    this._render();
    this.sendNotification("MODULE_DEACTIVATED", { id: this.name });
  },

  _p(n) { return String(n).padStart(2, "0"); },

  _fmtTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${this._p(h)}:${this._p(m)}:${this._p(sec)}`
      : `${this._p(m)}:${this._p(sec)}`;
  },

  _render() {
    const root = document.getElementById("mmm-timer-root");
    if (!root) return;
    if (!this._active) { root.innerHTML = ""; return; }

    const isDone = this._state === "done";
    const isRunning = this._state === "running";
    const isEditing = this._state === "editing";
    const progress = this._total > 0 ? (this._remaining / this._total) * 100 : 0;

    let bodyHtml = "";

    if (isEditing) {
      const fields = ["H", "M", "S"];
      bodyHtml = `
        <div class="tm-edit-row">
          ${fields.map((f, i) => `
            <div class="tm-field">
              <div class="tm-field-label">${f}</div>
              <div class="tm-field-value${i === this._editField ? " tm-field-value--active" : ""}">${this._p(this._editVals[i])}</div>
            </div>`).join("")}
        </div>
        <div class="tm-hint">◀▶ Feld · 0-9 eingeben · Enter bestätigen · Esc abbrechen</div>
        <div class="tm-actions"><div class="tm-btn tm-btn--primary">Einstellen</div></div>`;
    } else {
      const dispCls = isDone ? "tm-display tm-display--done" : "tm-display";
      bodyHtml = `
        <div class="${dispCls}">${this._fmtTime(this._remaining)}</div>
        <div class="tm-hint">${isRunning ? "Leertaste pausieren" : isDone ? "Leertaste neu starten" : "Leertaste starten"} · Enter einstellen · Esc beenden</div>
        <div class="tm-actions">
          <div class="tm-btn tm-btn--primary">${isRunning ? "Pause" : isDone ? "Neu" : this._remaining < this._total ? "Weiter" : "Start"}</div>
          ${this._remaining < this._total ? `<div class="tm-btn">Reset</div>` : ""}
        </div>`;
    }

    root.innerHTML = `
      <div class="tm-card">
        <div class="tm-label">Timer</div>
        ${bodyHtml}
        <div class="tm-progress-track">
          <div class="tm-progress-bar${isDone ? " tm-progress-bar--done" : ""}" style="width:${progress}%"></div>
        </div>
      </div>`;
  },
});
