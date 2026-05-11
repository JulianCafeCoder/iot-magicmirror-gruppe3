const NodeHelper = require("node_helper");
const Log        = require("logger");

// ── Dummy-Daten (sonniger Sommertag) ──────────────────────────────────────────
// Format: [hour, solar_kw, house_kw, battery_pct, battery_kw, grid_kw]
// grid_kw = solar - house - battery_kw  (>0 Einspeisung, <0 Bezug)
const DUMMY = [
  [ 0, 0.0, 1.8, 65,  0.0, -1.8],
  [ 1, 0.0, 1.7, 63,  0.0, -1.7],
  [ 2, 0.0, 1.6, 61,  0.0, -1.6],
  [ 3, 0.0, 1.5, 59,  0.0, -1.5],
  [ 4, 0.0, 1.5, 57,  0.0, -1.5],
  [ 5, 0.2, 1.6, 55,  0.0, -1.4],
  [ 6, 0.8, 1.9, 56,  0.6, -1.7],
  [ 7, 1.8, 2.1, 62,  1.2, -1.5],
  [ 8, 3.2, 2.3, 72,  1.5, -0.6],
  [ 9, 4.5, 2.4, 82,  1.8,  0.3],
  [10, 5.4, 2.5, 90,  1.6,  1.3],
  [11, 6.1, 2.6, 95,  1.2,  2.3],
  [12, 6.3, 2.7, 97,  0.8,  2.8],
  [13, 6.0, 2.6, 98,  0.3,  3.1],
  [14, 5.5, 2.5, 99,  0.0,  3.0],
  [15, 4.8, 2.4, 99,  0.0,  2.4],
  [16, 3.8, 2.3, 99,  0.0,  1.5],
  [17, 2.5, 2.4, 96, -0.5,  0.6],
  [18, 1.2, 2.6, 88, -1.4,  0.0],
  [19, 0.4, 2.8, 78, -1.8, -0.6],
  [20, 0.0, 2.5, 68, -1.8, -0.7],
  [21, 0.0, 2.2, 58, -1.6, -0.6],
  [22, 0.0, 2.0, 50, -1.5, -0.5],
  [23, 0.0, 1.9, 44, -1.3, -0.6],
];

// ── PostgreSQL-Konfiguration ──────────────────────────────────────────────────
// Passe host/database/user/password an eure Datenbank an.
// Solange die DB nicht verfügbar ist, werden automatisch die Dummy-Daten genutzt.
const DB_CONFIG = {
  host:     process.env.PG_HOST || "10.93.143.200",
  port:     5432,
  database: "postgres",
  user:     "gruppe3",
  password: "gruppe3",
  connectionTimeoutMillis: 3000,
};

module.exports = NodeHelper.create({

  start() {
    Log.info(`${this.name}: node_helper gestartet`);
    this.pgClient  = null;
    this.useDb     = false;
    this._initDb();
    this._timer = setInterval(() => this._fetch(), 60 * 1000);
  },

  // ── PostgreSQL verbinden (optional) ──────────────────────────────────────

  async _initDb() {
    try {
      const { Client } = require("pg");
      const client = new Client(DB_CONFIG);
      await client.connect();
      this.pgClient = client;
      this.useDb    = true;
      Log.info(`${this.name}: PostgreSQL verbunden`);
    } catch (err) {
      Log.warn(`${this.name}: PostgreSQL nicht erreichbar – nutze Dummy-Daten (${err.message})`);
    }
    this._fetch();
  },

  socketNotificationReceived(notification) {
    if (notification === "INIT") this._fetch();
  },

  // ── Daten laden ───────────────────────────────────────────────────────────

  async _fetch() {
    try {
      const hours = this.useDb ? await this._queryDb() : this._dummyRows();
      const curHour = new Date().getHours();
      // Aktuellen Stundenwert als "Jetzt"-Werte nehmen
      const now = hours[curHour] || hours[12];
      const todayKwh = hours.reduce((s, h) => s + Number(h.solar_kw), 0);

      this.sendSocketNotification("ENERGY_DATA", {
        now: {
          solar_kw:    Number(now.solar_kw),
          house_kw:    Number(now.house_kw),
          battery_pct: Number(now.battery_pct),
          battery_kw:  Number(now.battery_kw),
          grid_kw:     Number(now.grid_kw),
          today_kwh:   Math.round(todayKwh * 10) / 10,
        },
        hours: hours.map((h) => ({
          hour:        Number(h.hour),
          solar_kw:    Number(h.solar_kw),
          house_kw:    Number(h.house_kw),
          battery_pct: Number(h.battery_pct),
          battery_kw:  Number(h.battery_kw),
          grid_kw:     Number(h.grid_kw),
        })),
        source: this.useDb ? "db" : "dummy",
      });
    } catch (err) {
      Log.error(`${this.name}: Fehler beim Laden – ${err.message}`);
    }
  },

  // ── Datenbankabfrage ──────────────────────────────────────────────────────

  async _queryDb() {
    const res = await this.pgClient.query(
      "SELECT * FROM energy_demo_day ORDER BY hour ASC"
    );
    return res.rows;
  },

  // ── Dummy-Daten als Objekte ───────────────────────────────────────────────

  _dummyRows() {
    return DUMMY.map(([hour, solar_kw, house_kw, battery_pct, battery_kw, grid_kw]) => ({
      hour, solar_kw, house_kw, battery_pct, battery_kw, grid_kw,
    }));
  },
});
