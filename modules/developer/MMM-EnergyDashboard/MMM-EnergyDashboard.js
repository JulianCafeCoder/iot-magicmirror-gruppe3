Module.register("MMM-EnergyDashboard", {
  defaults: {},

  energyData: null,
  activeChart: null, // 'solar' | 'house' | 'battery' | 'grid'

  start() {
    Log.info(`${this.name}: started`);
    this.sendSocketNotification("INIT");
  },

  getStyles() { return ["MMM-EnergyDashboard.css"]; },

  socketNotificationReceived(notification, payload) {
    if (notification === "ENERGY_DATA") {
      this.energyData = payload;
      this._render();
    }
  },

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
    wrap.appendChild(this._buildHouseSection(now));
    wrap.appendChild(this._buildChips(now));

    const panel = document.createElement("div");
    panel.className = "ed-chart-panel";
    panel.id = `ed-cp-${this.identifier}`;
    if (this.activeChart) {
      panel.innerHTML = this._buildMetricChart(hours, this.activeChart, now);
    }
    wrap.appendChild(panel);

    return wrap;
  },

  // ── House Section ─────────────────────────────────────────────────────────

  _buildHouseSection(now) {
    const sec = document.createElement("div");
    sec.className = "ed-house-section";

    sec.innerHTML = `
      <div class="ed-house-badges">
        <div class="ed-badge ed-badge-solar ${now.solar_kw > 0.05 ? 'ed-badge-lit' : ''}">
          <div class="ed-badge-ring">
            <i class="fas fa-sun"></i>
            <span class="ed-badge-kw">${now.solar_kw.toFixed(1)} kW</span>
            <span class="ed-badge-name">Solar</span>
          </div>
        </div>
        <div class="ed-badge ed-badge-house">
          <div class="ed-badge-ring">
            <i class="fas fa-house"></i>
            <span class="ed-badge-kw">${now.house_kw.toFixed(1)} kW</span>
            <span class="ed-badge-name">Haushalt</span>
          </div>
        </div>
      </div>

      ${this._houseSVG(now)}
    `;
    return sec;
  },

  _houseSVG(now) {
    const solarOn = now.solar_kw > 0.05;
    const gridOn  = Math.abs(now.grid_kw) > 0.02;
    const batOn   = Math.abs(now.battery_kw) > 0.02;
    const gridExp = now.grid_kw > 0;
    const batChg  = now.battery_kw > 0;

    const gridColor  = gridExp ? '#4cdb7a' : '#e05555';
    const batColor   = '#4cdb7a';
    const solarClass = solarOn ? 'ed-flow-fwd' : '';
    const gridClass  = gridOn  ? (gridExp ? 'ed-flow-fwd' : 'ed-flow-bwd') : '';
    const batClass   = batOn   ? (batChg  ? 'ed-flow-fwd' : 'ed-flow-bwd') : '';

    const solarOp = solarOn ? '0.8'  : '0.12';
    const gridOp  = gridOn  ? '0.88' : '0.15';
    const batOp   = batOn   ? '0.78' : '0.18';
    const panelOp = solarOn ? '1'    : '0.35';

    // Battery fill bar: max 24 px wide
    const batFill = Math.max(1, Math.round(24 * now.battery_pct / 100));
    const batKwStr = batOn
      ? `${batChg ? '↑' : '↓'} ${Math.abs(now.battery_kw).toFixed(1)} kW`
      : '';

    return `
    <svg viewBox="0 0 460 195" class="ed-house-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ed-win-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="rgba(255,200,60,0.18)"/>
          <stop offset="100%" stop-color="rgba(255,200,60,0.06)"/>
        </linearGradient>
        <linearGradient id="ed-bat-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="${batColor}" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="${batColor}" stop-opacity="0.5"/>
        </linearGradient>
      </defs>

      ${solarOn ? '<ellipse cx="198" cy="57" rx="92" ry="18" fill="rgba(255,214,51,0.05)"/>' : ''}

      <!-- Roof -->
      <polygon points="220,18 92,100 348,100" fill="#1c2540" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>

      <!-- Solar panels (5 panels with cell grid lines) -->
      <g opacity="${panelOp}">
        ${this._solarPanels(solarOn)}
      </g>

      <!-- House body -->
      <rect x="100" y="100" width="248" height="90" fill="#131c30" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

      <!-- Garage left section -->
      <rect x="108" y="116" width="82" height="74" fill="#0f1726" stroke="rgba(255,255,255,0.05)" stroke-width="0.5" rx="1"/>
      <rect x="115" y="123" width="68" height="40" fill="#0a1020" rx="1"/>
      <line x1="115" y1="131" x2="183" y2="131" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
      <line x1="115" y1="139" x2="183" y2="139" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
      <line x1="115" y1="147" x2="183" y2="147" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>

      <!-- Main window (warm glow) -->
      <rect x="210" y="110" width="66" height="58" rx="2" fill="url(#ed-win-g)" stroke="rgba(255,200,60,0.28)" stroke-width="0.8"/>
      <line x1="243" y1="110" x2="243" y2="168" stroke="rgba(255,200,60,0.13)" stroke-width="0.5"/>
      <line x1="210" y1="138" x2="276" y2="138" stroke="rgba(255,200,60,0.13)" stroke-width="0.5"/>

      <!-- Small right window -->
      <rect x="290" y="116" width="28" height="22" rx="1.5" fill="rgba(255,200,60,0.07)" stroke="rgba(255,200,60,0.13)" stroke-width="0.5"/>

      <!-- Door -->
      <rect x="296" y="146" width="22" height="44" rx="2" fill="#0f1726" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>

      <!-- ── Solar flow: roof peak ↓ ── -->
      <line x1="220" y1="18" x2="220" y2="40"
            stroke="#ffd633" stroke-width="2" stroke-dasharray="5,3"
            opacity="${solarOp}" class="${solarClass}"/>

      <!-- ── Battery flow line: left wall ↔ battery ── -->
      <line x1="100" y1="148" x2="40" y2="148"
            stroke="${batColor}" stroke-width="2" stroke-dasharray="5,3"
            opacity="${batOp}" class="${batClass}"/>

      <!-- Battery icon -->
      <g opacity="${batOn ? '1' : '0.5'}">
        <!-- Body -->
        <rect x="4" y="137" width="28" height="16" rx="2.5"
              fill="rgba(76,219,122,0.08)" stroke="${batColor}" stroke-width="1.2"/>
        <!-- Terminal bump -->
        <rect x="32" y="141" width="4" height="8" rx="1" fill="${batColor}" opacity="0.65"/>
        <!-- Fill level -->
        <rect x="6" y="139" width="${batFill}" height="12" rx="1.5" fill="url(#ed-bat-fill)"/>
        <!-- % text centred inside battery -->
        <text x="18" y="149.5" text-anchor="middle" font-size="7" font-family="inherit"
              font-weight="700" fill="${now.battery_pct > 30 ? '#0a1020' : batColor}"
              >${now.battery_pct}%</text>
      </g>
      <!-- kW below battery -->
      ${batKwStr ? `<text x="19" y="162" text-anchor="middle" font-size="7.5" font-family="inherit"
            fill="${batColor}" opacity="${batOn ? '0.88' : '0.35'}">${batKwStr}</text>` : ''}

      <!-- ── Grid flow line: right wall ↔ node ── -->
      <line x1="348" y1="148" x2="406" y2="148"
            stroke="${gridColor}" stroke-width="2" stroke-dasharray="5,3"
            opacity="${gridOp}" class="${gridClass}"/>
      <circle cx="406" cy="148" r="5" fill="${gridColor}" opacity="${gridOp}"/>

      <!-- Grid label right of node -->
      <text x="415" y="145" font-size="9.5" font-family="inherit" font-weight="700"
            fill="${gridColor}" opacity="${gridOn ? '0.92' : '0.3'}"
            >${Math.abs(now.grid_kw).toFixed(2)} kW</text>
      <text x="415" y="157" font-size="7.5" font-family="inherit"
            fill="${gridColor}" opacity="${gridOn ? '0.68' : '0.25'}"
            >${gridExp ? 'Einspeisung' : 'Netzbezug'}</text>
    </svg>`;
  },

  _solarPanels(active) {
    const stroke  = active ? '#2d5faa' : 'rgba(255,255,255,0.07)';
    const div     = 'rgba(50,130,230,0.3)';
    // Five panels following the roof ridge: bottom-left → peak → bottom-right
    const pos = [[104,62],[138,51],[172,42],[206,51],[240,62]];
    return pos.map(([x, y]) => `
      <rect x="${x}" y="${y}" width="30" height="18" rx="2.5"
            fill="#162d5a" stroke="${stroke}" stroke-width="0.8"/>
      <line x1="${x+10}" y1="${y+1}" x2="${x+10}" y2="${y+17}" stroke="${div}" stroke-width="0.5"/>
      <line x1="${x+20}" y1="${y+1}" x2="${x+20}" y2="${y+17}" stroke="${div}" stroke-width="0.5"/>
      <line x1="${x+1}"  y1="${y+9}" x2="${x+29}" y2="${y+9}"  stroke="${div}" stroke-width="0.5"/>
      ${active ? `<rect x="${x+1}" y="${y+1}" width="28" height="8" rx="1.5" fill="rgba(100,160,255,0.07)"/>` : ''}
    `).join('');
  },

  // ── Chips ─────────────────────────────────────────────────────────────────

  _buildChips(now) {
    const gridExp = now.grid_kw > 0;
    const batChg  = now.battery_kw > 0;

    const metrics = [
      { key: 'solar',   icon: 'fa-sun',                                color: '#ffd633',                        label: 'Solar',    value: `${now.solar_kw.toFixed(1)} kW`,        sub: `${now.today_kwh} kWh heute` },
      { key: 'house',   icon: 'fa-house',                              color: '#5aadff',                        label: 'Haushalt', value: `${now.house_kw.toFixed(1)} kW`,        sub: 'Verbrauch' },
      { key: 'battery', icon: `fa-battery-${this._batIcon(now.battery_pct)}`, color: batChg ? '#4cdb7a' : '#ffaa33', label: 'Batterie', value: `${now.battery_pct} %`,           sub: batChg ? `↑ ${now.battery_kw.toFixed(1)} kW` : `↓ ${Math.abs(now.battery_kw).toFixed(1)} kW` },
      { key: 'grid',    icon: 'fa-plug',                               color: gridExp ? '#4cdb7a' : '#e05555',  label: 'Netz',     value: `${Math.abs(now.grid_kw).toFixed(2)} kW`, sub: gridExp ? 'Einspeisung' : 'Netzbezug' },
    ];

    const wrap = document.createElement("div");
    wrap.className = "ed-chips";

    metrics.forEach((m) => {
      const chip = document.createElement("div");
      chip.className = `ed-chip${this.activeChart === m.key ? ' ed-chip-on' : ''}`;
      chip.innerHTML = `
        <i class="fas ${m.icon}" style="color:${m.color}"></i>
        <div class="ed-chip-body">
          <div class="ed-chip-lbl">${m.label}</div>
          <div class="ed-chip-val">${m.value}</div>
          <div class="ed-chip-sub">${m.sub}</div>
        </div>
        <i class="fas fa-chart-area ed-chip-arrow${this.activeChart === m.key ? ' ed-chip-arrow-on' : ''}"></i>
      `;
      chip.addEventListener("click", () => {
        this.activeChart = this.activeChart === m.key ? null : m.key;
        this._refreshChips();
        this._refreshChart();
      });
      wrap.appendChild(chip);
    });

    return wrap;
  },

  _refreshChips() {
    const wrapper = document.getElementById(this.identifier);
    if (!wrapper) return;
    const keys  = ['solar', 'house', 'battery', 'grid'];
    wrapper.querySelectorAll('.ed-chip').forEach((chip, i) => {
      chip.classList.toggle('ed-chip-on', this.activeChart === keys[i]);
      const arr = chip.querySelector('.ed-chip-arrow');
      if (arr) arr.classList.toggle('ed-chip-arrow-on', this.activeChart === keys[i]);
    });
  },

  _refreshChart() {
    const panel = document.getElementById(`ed-cp-${this.identifier}`);
    if (!panel) return;
    panel.innerHTML = '';
    if (this.activeChart && this.energyData) {
      panel.innerHTML = this._buildMetricChart(this.energyData.hours, this.activeChart, this.energyData.now);
    }
  },

  // ── Metric Chart ──────────────────────────────────────────────────────────

  _buildMetricChart(hours, metric, now) {
    const W = 420, H = 120;
    const PAD = { top: 14, right: 12, bottom: 24, left: 36 };
    const iW = W - PAD.left - PAD.right;
    const iH = H - PAD.top - PAD.bottom;
    const n  = hours.length;
    const curHour = Math.min(new Date().getHours(), n - 1);

    let values, color, gradId, label, unit, maxY, isGrid;

    switch (metric) {
      case 'solar':
        values = hours.map(h => h.solar_kw);
        color = '#ffd633'; gradId = 'eg-solar'; label = 'Solar'; unit = 'kW';
        maxY  = Math.max(...values, 1);
        isGrid = false;
        break;
      case 'house':
        values = hours.map(h => h.house_kw);
        color = '#5aadff'; gradId = 'eg-house'; label = 'Haushalt'; unit = 'kW';
        maxY  = Math.max(...values, 1);
        isGrid = false;
        break;
      case 'battery':
        values = hours.map(h => h.battery_pct);
        color = '#4cdb7a'; gradId = 'eg-batt'; label = 'Batterie'; unit = '%';
        maxY  = 100;
        isGrid = false;
        break;
      case 'grid':
        values = hours.map(h => h.grid_kw);
        color = '#a78bfa'; gradId = 'eg-grid'; label = 'Netz'; unit = 'kW';
        maxY  = Math.max(Math.max(...values.map(Math.abs)), 0.5);
        isGrid = true;
        break;
    }

    const midY = PAD.top + iH / 2;
    const px = (i) => PAD.left + (i / (n - 1)) * iW;
    const py = (v) => isGrid
      ? midY - (v / maxY) * (iH / 2)
      : PAD.top + iH - (v / maxY) * iH;

    const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');

    let areaMarkup = '';
    if (!isGrid) {
      const baseY = PAD.top + iH;
      const areaPath = `M${px(0).toFixed(1)},${baseY} ` +
        values.map((v, i) => `L${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ') +
        ` L${px(n-1).toFixed(1)},${baseY} Z`;
      areaMarkup = `<path d="${areaPath}" fill="url(#${gradId})"/>`;
    } else {
      const areaPath = `M${px(0).toFixed(1)},${midY.toFixed(1)} ` +
        values.map((v, i) => `L${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ') +
        ` L${px(n-1).toFixed(1)},${midY.toFixed(1)} Z`;
      areaMarkup = `
        <clipPath id="eg-clip-pos"><rect x="${PAD.left}" y="${PAD.top}" width="${iW}" height="${iH/2}"/></clipPath>
        <clipPath id="eg-clip-neg"><rect x="${PAD.left}" y="${midY.toFixed(1)}" width="${iW}" height="${iH/2}"/></clipPath>
        <path d="${areaPath}" fill="url(#${gradId})"      clip-path="url(#eg-clip-pos)"/>
        <path d="${areaPath}" fill="url(#eg-grid-neg)"    clip-path="url(#eg-clip-neg)"/>`;
    }

    const timeLabels = [0, 6, 12, 18, 23].map(h =>
      `<text x="${px(h).toFixed(1)}" y="${H - 5}" class="ed-chart-lbl">${h}:00</text>`
    ).join('');

    let yLabels = '';
    if (isGrid) {
      yLabels = [
        `<text x="${PAD.left - 4}" y="${PAD.top + 4}" class="ed-chart-lbl" text-anchor="end">${maxY.toFixed(1)}</text>`,
        `<text x="${PAD.left - 4}" y="${midY.toFixed(1)}" class="ed-chart-lbl" text-anchor="end" dy="4">0</text>`,
        `<text x="${PAD.left - 4}" y="${(PAD.top + iH).toFixed(1)}" class="ed-chart-lbl" text-anchor="end" dy="4">-${maxY.toFixed(1)}</text>`,
      ].join('');
    } else {
      yLabels = [maxY, maxY / 2, 0].map(v =>
        `<text x="${PAD.left - 4}" y="${py(v).toFixed(1)}" class="ed-chart-lbl" text-anchor="end" dy="4">${metric === 'battery' ? Math.round(v) : v.toFixed(1)}</text>`
      ).join('');
    }

    const curVal = values[curHour] ?? values[values.length - 1];
    const dotX   = px(curHour).toFixed(1);
    const dotY   = py(curVal).toFixed(1);
    const nowX   = px(curHour).toFixed(1);
    const unit_display = metric === 'battery' ? `${Math.round(curVal)} ${unit}` : `${curVal.toFixed(2)} ${unit}`;

    return `
    <div class="ed-chart-wrap">
      <div class="ed-chart-hdr">
        <span class="ed-chart-name" style="color:${color}">
          <i class="fas ${this._metricIcon(metric)}"></i> ${label}
        </span>
        <span class="ed-chart-curval" style="color:${color}">${unit_display}</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="ed-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="${color}" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
          </linearGradient>
          ${isGrid ? `
          <linearGradient id="eg-grid-neg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#e05555" stop-opacity="0.02"/>
            <stop offset="100%" stop-color="#e05555" stop-opacity="0.4"/>
          </linearGradient>` : ''}
        </defs>

        <!-- Axes -->
        <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + iH}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        <line x1="${PAD.left}" y1="${PAD.top + iH}" x2="${PAD.left + iW}" y2="${PAD.top + iH}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        ${isGrid ? `<line x1="${PAD.left}" y1="${midY.toFixed(1)}" x2="${PAD.left + iW}" y2="${midY.toFixed(1)}" stroke="rgba(255,255,255,0.12)" stroke-width="0.8" stroke-dasharray="3,3"/>` : ''}

        <!-- Area -->
        ${areaMarkup}

        <!-- Line -->
        <path d="${linePath}" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>

        <!-- Now marker -->
        <line x1="${nowX}" y1="${PAD.top}" x2="${nowX}" y2="${PAD.top + iH}" stroke="rgba(255,255,255,0.22)" stroke-width="1" stroke-dasharray="3,3"/>
        <circle cx="${dotX}" cy="${dotY}" r="4" fill="${color}" stroke="#131c30" stroke-width="2"/>

        <!-- Labels -->
        ${timeLabels}
        ${yLabels}
      </svg>
    </div>`;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  _metricIcon(m) {
    return { solar: 'fa-sun', house: 'fa-house', battery: 'fa-battery-half', grid: 'fa-plug' }[m] || 'fa-chart-area';
  },

  _batIcon(pct) {
    if (pct >= 88) return "full";
    if (pct >= 62) return "three-quarters";
    if (pct >= 38) return "half";
    if (pct >= 13) return "quarter";
    return "empty";
  },
});
