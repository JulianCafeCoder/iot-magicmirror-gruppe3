Module.register("MMM-Dice", {
  defaults: {},

  _active:  false,
  _sides:   6,
  _value:   null,
  _rolling: false,

  // Dot positions for W6 faces (percentage x, y)
  FACES: {
    1: [[50,50]],
    2: [[25,25],[75,75]],
    3: [[25,25],[50,50],[75,75]],
    4: [[25,25],[75,25],[25,75],[75,75]],
    5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
    6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
  },
  TYPES: [4, 6, 8, 10, 12, 20],
  // index of selected type in TYPES array
  _typeIdx: 1,

  start() { Log.info(`${this.name}: gestartet`); },

  getDom() {
    const w = document.createElement("div");
    w.id = "mmm-dice-root";
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
    if (key === " " || key === "Enter") { this._roll(); return; }
    if (key === "ArrowRight") { this._typeIdx = Math.min(this.TYPES.length - 1, this._typeIdx + 1); this._sides = this.TYPES[this._typeIdx]; this._value = null; this._render(); return; }
    if (key === "ArrowLeft")  { this._typeIdx = Math.max(0, this._typeIdx - 1); this._sides = this.TYPES[this._typeIdx]; this._value = null; this._render(); return; }
    if (key === "Escape") { this._deactivate(); }
  },

  _roll() {
    if (this._rolling) return;
    this._rolling = true;
    this._value = null;
    this._render();
    setTimeout(() => {
      this._value = Math.floor(Math.random() * this._sides) + 1;
      this._rolling = false;
      this._render();
    }, 620);
  },

  _deactivate() {
    this._active = false;
    this._render();
    this.sendNotification("MODULE_DEACTIVATED", { id: this.name });
  },

  _dotsHtml(value) {
    const positions = this.FACES[value];
    if (!positions) return "";
    return positions.map(([x, y]) =>
      `<div class="dc-dot" style="left:${x}%;top:${y}%"></div>`
    ).join("");
  },

  _render() {
    const root = document.getElementById("mmm-dice-root");
    if (!root) return;
    if (!this._active) { root.innerHTML = ""; return; }

    const showDots = this._sides === 6 && this._value !== null;
    const rollingCls = this._rolling ? " dc-die--rolling" : "";

    let dieInner;
    if (this._rolling) {
      dieInner = `<div class="dc-die-text">···</div>`;
    } else if (showDots) {
      dieInner = this._dotsHtml(this._value);
    } else {
      const text = this._value ? String(this._value) : "?";
      const textCls = this._value ? "dc-die-text dc-die-text--value" : "dc-die-text";
      dieInner = `<div class="${textCls}">${text}</div>`;
    }

    // For non-d6, show big number next to die
    const resultHtml = (this._value && this._sides !== 6)
      ? `<div class="dc-result-big">${this._value}</div>`
      : "";

    const typeButtons = this.TYPES.map((s, i) => {
      const active = i === this._typeIdx;
      return `<div class="dc-type-btn${active ? " dc-type-btn--active" : ""}">W${s}</div>`;
    }).join("");

    root.innerHTML = `
      <div class="dc-card">
        <div class="dc-label">Würfel</div>
        <div class="dc-row">
          <div class="dc-die${rollingCls}">${dieInner}</div>
          ${resultHtml}
        </div>
        <div class="dc-types">${typeButtons}</div>
        <div class="dc-hint">◀▶ Würfeltyp · Leertaste/Enter würfeln · Esc beenden</div>
        <div class="dc-actions">
          <div class="dc-btn dc-btn--primary">Würfeln</div>
        </div>
      </div>`;
  },
});
