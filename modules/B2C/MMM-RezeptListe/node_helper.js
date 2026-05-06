const NodeHelper = require("node_helper");
const Log = require("logger");

const DB_CONFIG = {
  host: process.env.PG_HOST || "10.93.143.200",
  port: 5432,
  database: "postgres",
  user: "gruppe3",
  password: "gruppe3",
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
};

const FALLBACK_RECIPES = [
  { title: "Rezept-Probe 1", description: "Beispielrezept aus Fallback-Daten" },
  { title: "Rezept-Probe 2", description: "Ändere DB-Konfiguration für echte Daten" },
];

module.exports = NodeHelper.create({
  start() {
    Log.info(`${this.name}: node_helper gestartet`);
    this.pgClient = null;
    this.useDb = false;
    this._initDb();
    this._timer = setInterval(() => this._fetch(), 15 * 60 * 1000);
  },

  async _initDb() {
    try {
      Log.info(`${this.name}: Verbinde zu PostgreSQL auf ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}...`);
      const { Client } = require("pg");
      const client = new Client(DB_CONFIG);
      await client.connect();
      this.pgClient = client;
      this.useDb = true;
      Log.info(`${this.name}: ✓ PostgreSQL erfolgreich verbunden`);
    } catch (err) {
      Log.error(`${this.name}: ✗ PostgreSQL-Verbindung fehlgeschlagen`);
      Log.error(`${this.name}: Fehler: ${err.message}`);
      Log.error(`${this.name}: Code: ${err.code}`);
      Log.error(`${this.name}: Nutze Fallback-Daten...`);
      this.useDb = false;
    }
    this._fetch();
  },

  socketNotificationReceived(notification) {
    if (notification === "INIT") {
      this._fetch();
    }
  },

  async _fetch() {
    try {
      const data = this.useDb ? await this._queryDb() : { recipes: FALLBACK_RECIPES, recipeInfo: null };
      this.sendSocketNotification("REZEPT_DATA", data);
    } catch (err) {
      Log.error(`${this.name}: Fehler beim Laden der Rezepte – ${err.message}`);
      this.sendSocketNotification("REZEPT_DATA", { recipes: FALLBACK_RECIPES, recipeInfo: null });
    }
  },

  async _queryDb() {
    try {
      Log.info(`${this.name}: Führe get_rezept(1) aus...`);
      const recipeRows = await this.pgClient.query("SELECT * FROM get_rezept($1);", [1]);
      Log.info(`${this.name}: ✓ ${recipeRows.rows.length} Rezepte geladen`);

      Log.info(`${this.name}: Führe Rezepte-Stammdaten-Abfrage aus...`);
      const recipeInfoResult = await this.pgClient.query(
        "SELECT name, beschreibung, anweisung FROM Rezepte WHERE rezepte_id = $1;",
        [1]
      );
      const recipeInfo = recipeInfoResult.rows[0] || null;
      Log.info(`${this.name}: ✓ Rezept-Info geladen`);

      return {
        recipes: recipeRows.rows,
        recipeInfo,
      };
    } catch (err) {
      Log.error(`${this.name}: Query-Fehler: ${err.message}`);
      throw err;
    }
  },
});
