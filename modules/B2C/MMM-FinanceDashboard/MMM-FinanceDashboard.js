Module.register("MMM-FinanceDashboard", {
  defaults: {
    watchlist: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "V"],
    portfolio: [],
    updateInterval: 5 * 60 * 1000,
    sparklineDays: 14,
    currency: "USD",
  },

  stockData: null,

  start() {
    Log.info(`${this.name}: started`);
    this.sendSocketNotification("FINANCE_INIT", this._payload());
    setInterval(() => this.sendSocketNotification("FINANCE_FETCH", this._payload()), this.config.updateInterval);
  },

  _payload() {
    return {
      watchlist: this.config.watchlist,
      portfolioSymbols: (this.config.portfolio || []).map(h => h.symbol),
      sparklineDays: this.config.sparklineDays,
    };
  },

  getStyles() { return ["MMM-FinanceDashboard.css"]; },

  socketNotificationReceived(notification, payload) {
    if (notification === "FINANCE_DATA") {
      this.stockData = payload;
      this.updateDom();
    }
  },

  getDom() {
    const wrap = document.createElement("div");
    wrap.className = "fd-wrap";

    if (!this.stockData) {
      wrap.innerHTML = `<div class="fd-loading"><i class="fas fa-spinner fa-spin"></i> Lade Finanzdaten…</div>`;
      return wrap;
    }

    const left = document.createElement("div");
    left.className = "fd-panel fd-panel-left";
    left.appendChild(this._sectionTitle("fa-chart-line", "Märkte"));
    left.appendChild(this._buildWatchlist());
    wrap.appendChild(left);

    const divider = document.createElement("div");
    divider.className = "fd-divider";
    wrap.appendChild(divider);

    const right = document.createElement("div");
    right.className = "fd-panel fd-panel-right";
    right.appendChild(this._sectionTitle("fa-briefcase", "Mein Depot"));
    right.appendChild(this._buildPortfolio());
    wrap.appendChild(right);

    return wrap;
  },

  _sectionTitle(icon, label) {
    const h = document.createElement("div");
    h.className = "fd-section-title";
    h.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
    return h;
  },

  // ── Watchlist ──────────────────────────────────────────────────────────────

  _buildWatchlist() {
    const list = document.createElement("div");
    list.className = "fd-watchlist";

    const { quotes, histories } = this.stockData;
    this.config.watchlist.forEach(symbol => {
      const q = quotes[symbol];
      if (!q) return;
      const pos = q.changePct >= 0;
      const row = document.createElement("div");
      row.className = "fd-stock-row";
      row.innerHTML = `
        <div class="fd-stock-symbol">${symbol}</div>
        <div class="fd-stock-name">${q.name}</div>
        <div class="fd-stock-chart">${this._sparkline(histories[symbol] || [], pos)}</div>
        <div class="fd-stock-price">$${q.price.toFixed(2)}</div>
        <div class="fd-stock-change ${pos ? "fd-pos" : "fd-neg"}">
          ${pos ? "+" : ""}${q.changePct.toFixed(2)}%
        </div>
      `;
      list.appendChild(row);
    });

    return list;
  },

  // ── Portfolio ──────────────────────────────────────────────────────────────

  _buildPortfolio() {
    const wrap = document.createElement("div");
    wrap.className = "fd-portfolio";

    const portfolio = this.config.portfolio || [];
    if (!portfolio.length) {
      wrap.innerHTML = `<div class="fd-empty">Kein Depot konfiguriert.<br>Füge <code>portfolio: [...]</code> zur Modulkonfiguration hinzu.</div>`;
      return wrap;
    }

    const { quotes } = this.stockData;
    let totalValue = 0;
    let totalCost = 0;

    const rows = portfolio.map(h => {
      const q = quotes[h.symbol];
      if (!q) return null;
      const value = h.shares * q.price;
      const cost  = h.shares * h.avgPrice;
      totalValue += value;
      totalCost  += cost;
      return { h, q, value, cost };
    }).filter(Boolean);

    const totalGain    = totalValue - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    const totalPos     = totalGain >= 0;

    // Summary bar
    const summary = document.createElement("div");
    summary.className = "fd-summary";
    summary.innerHTML = `
      <div class="fd-summary-row">
        <span class="fd-summary-label">Gesamtwert</span>
        <span class="fd-summary-value">$${totalValue.toFixed(2)}</span>
      </div>
      <div class="fd-summary-gain ${totalPos ? "fd-pos" : "fd-neg"}">
        ${totalPos ? "+" : ""}$${totalGain.toFixed(2)}
        <span class="fd-summary-pct">(${totalPos ? "+" : ""}${totalGainPct.toFixed(2)}%)</span>
      </div>
    `;
    wrap.appendChild(summary);

    // Allocation bar
    const allocBar = document.createElement("div");
    allocBar.className = "fd-alloc-bar";
    const colors = ["#5aadff", "#4cdb7a", "#ffd633", "#e05555", "#a78bfa", "#ff9f43", "#54a0ff", "#ff6b9d"];
    rows.forEach(({ value }, i) => {
      const seg = document.createElement("div");
      seg.className = "fd-alloc-seg";
      seg.style.width = `${(value / totalValue) * 100}%`;
      seg.style.background = colors[i % colors.length];
      seg.title = rows[i].h.symbol;
      allocBar.appendChild(seg);
    });
    wrap.appendChild(allocBar);

    // Holdings list
    const list = document.createElement("div");
    list.className = "fd-holdings";

    rows.forEach(({ h, q, value, cost }, i) => {
      const gain    = value - cost;
      const gainPct = (gain / cost) * 100;
      const pos     = gain >= 0;
      const color   = colors[i % colors.length];
      const row = document.createElement("div");
      row.className = "fd-holding-row";
      row.innerHTML = `
        <div class="fd-holding-dot" style="background:${color}"></div>
        <div class="fd-holding-symbol">${h.symbol}</div>
        <div class="fd-holding-mid">
          <div class="fd-holding-shares">${h.shares} Stk. × $${q.price.toFixed(2)}</div>
          <div class="fd-holding-value">$${value.toFixed(2)}</div>
        </div>
        <div class="fd-holding-gain ${pos ? "fd-pos" : "fd-neg"}">
          ${pos ? "+" : ""}${gainPct.toFixed(2)}%
        </div>
      `;
      list.appendChild(row);
    });

    wrap.appendChild(list);
    return wrap;
  },

  // ── Sparkline SVG ─────────────────────────────────────────────────────────

  _sparkline(history, positive) {
    if (!history || history.length < 2) return '<svg class="fd-sparkline" viewBox="0 0 90 30"></svg>';

    const W = 90, H = 30, PAD = 2;
    const iW = W - PAD * 2;
    const iH = H - PAD * 2;
    const n  = history.length;

    const min   = Math.min(...history);
    const max   = Math.max(...history);
    const range = max - min || 1;

    const px = (i) => PAD + (i / (n - 1)) * iW;
    const py = (v) => PAD + iH - ((v - min) / range) * iH;

    const line = history.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
    const baseY = PAD + iH;
    const area = `M${px(0).toFixed(1)},${baseY} ` +
      history.map((v, i) => `L${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ") +
      ` L${px(n - 1).toFixed(1)},${baseY} Z`;

    const color = positive ? "#4cdb7a" : "#e05555";
    const gid   = `fdg${Math.random().toString(36).slice(2, 7)}`;

    return `<svg viewBox="0 0 ${W} ${H}" class="fd-sparkline">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${color}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${line}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  },
});
