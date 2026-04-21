Module.register("MMM-EnergyDashboard", {
  defaults: {},

  // ── State ─────────────────────────────────────────────────────────────────
  energyData: null,

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    Log.info(`${this.name}: started`);
    this.sendSocketNotification("INIT");
  },

  getStyles() { return ["MMM-EnergyDashboard.css"]; },

  // ── Socket ────────────────────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "ENERGY_DATA") {
      this.energyData = payload;
      this._render();
    }
  },

  // ── DOM ───────────────────────────────────────────────────────────────────

  getDom() { return this._buildDom(); },

  _render() {
    const wrapper = document.getElementById(this.identifier);
    if (!wrapper) return;
    const content = wrapper.querySelector(".module-content");
    if (!content) return;
    content.innerHTML = "";
    content.appendChild(this._buildDom());
  },

  _buildDom() {
    const wrap = document.createElement("div");
    wrap.className = "ed-wrap";

    if (!this.energyData) {
      wrap.innerHTML = `<div class="ed-loading"><i class="fas fa-spinner fa-spin"></i> Lade Energiedaten…</div>`;
      return wrap;
    }

    const { now, hours } = this.energyData;

    wrap.appendChild(this._buildFlowDiagram(now));
    wrap.appendChild(this._buildCards(now));

    const chartSection = document.createElement("div");
    chartSection.className = "ed-chart-section";
    chartSection.innerHTML = `<div class="ed-chart-title"><i class="fas fa-chart-area"></i> Tagesverlauf</div>`;
    const chartEl = document.createElement("div");
    chartEl.className = "ed-chart-container";
    chartEl.innerHTML = this._buildChart(hours);
    chartSection.appendChild(chartEl);
    wrap.appendChild(chartSection);

    return wrap;
  },

  // ── Flussdiagramm ─────────────────────────────────────────────────────────

  _buildFlowDiagram(now) {
    const el = document.createElement("div");
    el.className = "ed-flow";

    const solarPct = Math.min(100, Math.round((now.solar_kw / 8) * 100));
    const batCharging = now.battery_kw > 0;
    const gridExport  = now.grid_kw > 0;

    el.innerHTML = `
      <!-- Solar oben mittig -->
      <div class="ed-flow-node ed-node-solar" style="grid-area: solar">
        <i class="fas fa-sun"></i>
        <span class="ed-node-kw">${now.solar_kw.toFixed(1)} kW</span>
        <div class="ed-node-bar">
          <div class="ed-node-bar-fill" style="width:${solarPct}%"></div>
        </div>
      </div>

      <!-- Pfeile -->
      <div class="ed-flow-arrow ed-arrow-down" style="grid-area: arr-sb">
        <i class="fas fa-arrow-down"></i>
      </div>

      <!-- Haus Mitte -->
      <div class="ed-flow-node ed-node-house" style="grid-area: house">
        <i class="fas fa-house"></i>
        <span class="ed-node-kw">${now.house_kw.toFixed(1)} kW</span>
        <span class="ed-node-label">Verbrauch</span>
      </div>

      <!-- Batterie links -->
      <div class="ed-flow-node ed-node-battery ${batCharging ? "ed-charging" : "ed-discharging"}" style="grid-area: batt">
        <i class="fas fa-battery-${this._batIcon(now.battery_pct)}"></i>
        <span class="ed-node-kw">${now.battery_pct}%</span>
        <span class="ed-node-label">${batCharging ? "↑ " + now.battery_kw.toFixed(1) + " kW" : "↓ " + Math.abs(now.battery_kw).toFixed(1) + " kW"}</span>
      </div>

      <!-- Netz rechts -->
      <div class="ed-flow-node ed-node-grid ${gridExport ? "ed-exporting" : "ed-importing"}" style="grid-area: grid">
        <i class="fas fa-plug"></i>
        <span class="ed-node-kw">${Math.abs(now.grid_kw).toFixed(1)} kW</span>
        <span class="ed-node-label">${gridExport ? "Einspeis." : "Bezug"}</span>
      </div>`;

    return el;
  },

  // ── Karten ────────────────────────────────────────────────────────────────

  _buildCards(now) {
    const gridExport  = now.grid_kw > 0;
    const batCharging = now.battery_kw > 0;

    const cards = [
      {
        icon:  "fa-sun",
        color: "ed-c-solar",
        title: "Solar",
        main:  `${now.solar_kw.toFixed(1)} kW`,
        sub:   `${now.today_kwh} kWh heute`,
      },
      {
        icon:  "fa-house",
        color: "ed-c-house",
        title: "Verbrauch",
        main:  `${now.house_kw.toFixed(1)} kW`,
        sub:   "Hausverbrauch",
      },
      {
        icon:  `fa-battery-${this._batIcon(now.battery_pct)}`,
        color: batCharging ? "ed-c-bat-charge" : "ed-c-bat-discharge",
        title: "Batterie",
        main:  `${now.battery_pct} %`,
        sub:   batCharging
          ? `↑ ${now.battery_kw.toFixed(1)} kW laden`
          : `↓ ${Math.abs(now.battery_kw).toFixed(1)} kW entladen`,
      },
      {
        icon:  "fa-plug",
        color: gridExport ? "ed-c-export" : "ed-c-import",
        title: "Netz",
        main:  `${Math.abs(now.grid_kw).toFixed(1)} kW`,
        sub:   gridExport ? "Einspeisung" : "Netzbezug",
      },
    ];

    const grid = document.createElement("div");
    grid.className = "ed-cards";

    cards.forEach((c) => {
      const card = document.createElement("div");
      card.className = `ed-card ${c.color}`;
      card.innerHTML = `
        <div class="ed-card-icon"><i class="fas ${c.icon}"></i></div>
        <div class="ed-card-body">
          <div class="ed-card-title">${c.title}</div>
          <div class="ed-card-main">${c.main}</div>
          <div class="ed-card-sub">${c.sub}</div>
        </div>`;
      grid.appendChild(card);
    });

    return grid;
  },

  // ── SVG-Tagesverlauf ──────────────────────────────────────────────────────

  _buildChart(hours) {
    const W = 420, H = 110;
    const PAD = { top: 8, right: 10, bottom: 22, left: 32 };
    const iW = W - PAD.left - PAD.right;
    const iH = H - PAD.top - PAD.bottom;
    const maxSolar = Math.max(...hours.map((h) => h.solar_kw), 1);
    const maxHouse = Math.max(...hours.map((h) => h.house_kw), 1);
    const maxY = Math.max(maxSolar, maxHouse);
    const curHour = new Date().getHours();

    const px = (i) => PAD.left + (i / 23) * iW;
    const py = (v) => PAD.top + iH - (v / maxY) * iH;

    // Solar-Fläche
    const solarArea = `M${px(0)},${py(0)} ` +
      hours.map((h, i) => `L${px(i)},${py(h.solar_kw)}`).join(" ") +
      ` L${px(23)},${py(0)} Z`;

    // Haus-Linie
    const houseLine = hours.map((h, i) => `${i === 0 ? "M" : "L"}${px(i)},${py(h.house_kw)}`).join(" ");

    // Zeitachse labels
    const timeLabels = [0, 6, 12, 18, 23].map((h) =>
      `<text x="${px(h)}" y="${H - 5}" class="ed-chart-lbl">${h}h</text>`
    ).join("");

    // kW-Labels links
    const kwLabels = [0, maxY / 2, maxY].map((v) =>
      `<text x="${PAD.left - 4}" y="${py(v) + 4}" class="ed-chart-lbl" text-anchor="end">${v.toFixed(1)}</text>`
    ).join("");

    // Aktueller Zeitstempel
    const nowLine = `<line x1="${px(curHour)}" y1="${PAD.top}" x2="${px(curHour)}" y2="${PAD.top + iH}" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="3,3"/>`;
    const nowLabel = `<text x="${px(curHour)}" y="${PAD.top - 1}" class="ed-chart-lbl" text-anchor="middle">${curHour}h</text>`;

    // Batterie-Prozentkurve (rechte Achse, normiert auf 0-100)
    const batLine = hours.map((h, i) => `${i === 0 ? "M" : "L"}${px(i)},${PAD.top + iH - (h.battery_pct / 100) * iH}`).join(" ");

    return `<svg viewBox="0 0 ${W} ${H}" class="ed-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="ed-solar-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#ffd633" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#ffd633" stop-opacity="0.04"/>
        </linearGradient>
      </defs>
      <!-- Achsen -->
      <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + iH}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <line x1="${PAD.left}" y1="${PAD.top + iH}" x2="${PAD.left + iW}" y2="${PAD.top + iH}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <!-- Solar Fläche -->
      <path d="${solarArea}" fill="url(#ed-solar-grad)"/>
      <!-- Solar Linie -->
      <path d="${hours.map((h, i) => `${i === 0 ? "M" : "L"}${px(i)},${py(h.solar_kw)}`).join(" ")}"
            stroke="#ffd633" stroke-width="1.8" fill="none" stroke-linejoin="round"/>
      <!-- Haus-Verbrauch Linie -->
      <path d="${houseLine}" stroke="#5aadff" stroke-width="1.4" fill="none" stroke-dasharray="4,2" stroke-linejoin="round"/>
      <!-- Batterie -->
      <path d="${batLine}" stroke="#4cdb7a" stroke-width="1.2" fill="none" stroke-dasharray="2,3" stroke-linejoin="round"/>
      <!-- Jetzt-Linie -->
      ${nowLine}${nowLabel}
      <!-- Labels -->
      ${timeLabels}
      ${kwLabels}
      <!-- Legende -->
      <rect x="${PAD.left + 4}" y="${PAD.top + 2}" width="10" height="3" fill="#ffd633" rx="1"/>
      <text x="${PAD.left + 17}" y="${PAD.top + 6}" class="ed-chart-lbl">Solar</text>
      <line x1="${PAD.left + 55}" y1="${PAD.top + 4}" x2="${PAD.left + 65}" y2="${PAD.top + 4}" stroke="#5aadff" stroke-width="1.4" stroke-dasharray="4,2"/>
      <text x="${PAD.left + 68}" y="${PAD.top + 6}" class="ed-chart-lbl">Haus</text>
      <line x1="${PAD.left + 106}" y1="${PAD.top + 4}" x2="${PAD.left + 116}" y2="${PAD.top + 4}" stroke="#4cdb7a" stroke-width="1.2" stroke-dasharray="2,3"/>
      <text x="${PAD.left + 119}" y="${PAD.top + 6}" class="ed-chart-lbl">Batt%</text>
    </svg>`;
  },

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────

  _batIcon(pct) {
    if (pct >= 88) return "full";
    if (pct >= 62) return "three-quarters";
    if (pct >= 38) return "half";
    if (pct >= 13) return "quarter";
    return "empty";
  },
});
