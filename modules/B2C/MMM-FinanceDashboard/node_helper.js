const NodeHelper = require("node_helper");
const Log        = require("logger");
const https      = require("https");

// Fallback-Daten für den Fall, dass die Yahoo Finance API nicht erreichbar ist
const DUMMY = {
  AAPL:    { name: "Apple Inc.",        price: 189.30, changePct:  1.20 },
  MSFT:    { name: "Microsoft",         price: 420.50, changePct: -0.30 },
  GOOGL:   { name: "Alphabet",          price: 175.20, changePct:  0.80 },
  AMZN:    { name: "Amazon",            price: 195.40, changePct:  2.10 },
  NVDA:    { name: "NVIDIA",            price: 875.60, changePct:  3.50 },
  META:    { name: "Meta Platforms",    price: 485.20, changePct:  1.10 },
  TSLA:    { name: "Tesla",             price: 172.80, changePct: -1.20 },
  "BRK-B": { name: "Berkshire H. B",   price: 408.90, changePct:  0.40 },
  JPM:     { name: "JPMorgan Chase",    price: 212.60, changePct:  0.60 },
  V:       { name: "Visa Inc.",         price: 279.40, changePct:  0.20 },
};

module.exports = NodeHelper.create({

  start() {
    Log.info(`${this.name}: node_helper gestartet`);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "FINANCE_INIT" || notification === "FINANCE_FETCH") {
      const { watchlist, portfolioSymbols, sparklineDays } = payload;
      const allSymbols = [...new Set([...watchlist, ...(portfolioSymbols || [])])];
      this._fetchAll(allSymbols, watchlist, sparklineDays);
    }
  },

  // ── Alle Symbole laden ───────────────────────────────────────────────────

  async _fetchAll(allSymbols, watchlist, sparklineDays) {
    const quotes    = {};
    const histories = {};

    await Promise.all(allSymbols.map(async (symbol) => {
      try {
        const data = await this._fetchSymbol(symbol, sparklineDays);
        quotes[symbol] = {
          name:      data.name,
          price:     data.price,
          changePct: data.changePct,
          change:    data.change,
        };
        if (watchlist.includes(symbol)) {
          histories[symbol] = data.history;
        }
      } catch (err) {
        Log.warn(`${this.name}: Fehler für ${symbol} – ${err.message}`);
        const dummy = DUMMY[symbol] || { name: symbol, price: 100, changePct: 0 };
        quotes[symbol] = { ...dummy, change: 0 };
        if (watchlist.includes(symbol)) {
          histories[symbol] = this._dummyHistory(dummy.price, dummy.changePct > 0);
        }
      }
    }));

    this.sendSocketNotification("FINANCE_DATA", { quotes, histories });
  },

  // ── Yahoo Finance Chart API (gibt Kurs + Historie zurück) ────────────────

  async _fetchSymbol(symbol, days) {
    const range = days <= 7 ? "5d" : days <= 30 ? "1mo" : "3mo";
    const url   = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;

    const raw    = await this._httpsGet(url);
    const json   = JSON.parse(raw);
    const result = json.chart?.result?.[0];

    if (!result) throw new Error("Keine Daten erhalten");

    const meta    = result.meta;
    const closes  = (result.indicators?.quote?.[0]?.close || []).filter(v => v != null);

    return {
      name:      meta.shortName || meta.longName || symbol,
      price:     meta.regularMarketPrice   ?? (closes[closes.length - 1] || 0),
      changePct: meta.regularMarketChangePercent ?? 0,
      change:    meta.regularMarketChange  ?? 0,
      history:   closes,
    };
  },

  // ── Dummy-Kursverlauf für Fallback ───────────────────────────────────────

  _dummyHistory(base = 100, rising = true) {
    const n = 14;
    return Array.from({ length: n }, (_, i) => {
      const trend = rising ? i * (base * 0.005) : -i * (base * 0.005);
      return base + trend + (Math.random() - 0.5) * base * 0.02;
    });
  },

  // ── HTTPS-Helfer ─────────────────────────────────────────────────────────

  _httpsGet(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept":     "application/json",
        },
        timeout: 10000,
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          https.get(res.headers.location, resolve).on("error", reject);
          return;
        }
        let body = "";
        res.on("data", chunk => { body += chunk; });
        res.on("end",  () => resolve(body));
      });
      req.on("error",   reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    });
  },
});
