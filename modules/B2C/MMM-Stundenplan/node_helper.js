const NodeHelper = require("node_helper");
const Log        = require("logger");

const DB_CONFIG = {
  host:                    process.env.PG_HOST || "10.93.135.91",
  port:                    5432,
  database:                "postgres",
  user:                    "gruppe3",
  password:                "gruppe3",
  connectionTimeoutMillis: 5000,
  max:                     3,
};

module.exports = NodeHelper.create({

  start() {
    this.pool    = null;
    this.useDb   = false;
    this._ready  = false;
    this._queue  = [];
    Log.info(`${this.name}: node_helper gestartet – verbinde mit DB ${DB_CONFIG.host}…`);
    this._initDb();
  },

  async _initDb() {
    try {
      const { Pool } = require("pg");
      this.pool  = new Pool(DB_CONFIG);
      const c    = await this.pool.connect();
      c.release();
      this.useDb = true;
      Log.info(`${this.name}: PostgreSQL verbunden`);
    } catch (err) {
      Log.warn(`${this.name}: PostgreSQL nicht erreichbar (${err.message})`);
    }
    this._ready = true;
    for (const klasse of this._queue) await this._load(klasse);
    this._queue = [];
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "LOAD_STUNDENPLAN") {
      const klasse = payload?.klasse ?? "11BE13";
      if (!this._ready) { this._queue.push(klasse); return; }
      this._load(klasse);
    }
  },

  async _load(klasse) {
    if (!this.useDb) {
      Log.warn(`${this.name}: Keine DB-Verbindung – Stundenplan nicht verfügbar`);
      this.sendSocketNotification("STUNDENPLAN_LOADED", { perioden: [], eintraege: [] });
      return;
    }
    try {
      const [resPerioden, resEintraege] = await Promise.all([
        this.pool.query(
          `SELECT nummer, to_char(start_time,'HH24:MI') AS start_time,
                          to_char(end_time,  'HH24:MI') AS end_time
             FROM stundenplan_perioden
            ORDER BY nummer`
        ),
        this.pool.query(
          `SELECT e.wochentag, e.periode_nr, e.fach, e.raum, e.lehrer
             FROM stundenplan_eintraege e
            WHERE e.klasse = $1
            ORDER BY e.wochentag, e.periode_nr`,
          [klasse]
        ),
      ]);
      Log.info(`${this.name}: ${resEintraege.rows.length} Einträge für Klasse ${klasse} geladen`);
      this.sendSocketNotification("STUNDENPLAN_LOADED", {
        perioden:  resPerioden.rows,
        eintraege: resEintraege.rows,
      });
    } catch (err) {
      Log.error(`${this.name}: Ladefehler – ${err.message}`);
      this.sendSocketNotification("STUNDENPLAN_LOADED", { perioden: [], eintraege: [] });
    }
  },
});
