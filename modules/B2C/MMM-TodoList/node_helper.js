const NodeHelper = require("node_helper");
const Log        = require("logger");
const fs         = require("fs");
const path       = require("path");

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
    this.todosFile    = path.join(this.path, "todos.json");
    this.pool         = null;
    this.useDb        = false;
    this.userId       = null;
    this._dbReady     = false;
    this._pendingLoad = null;
    Log.info(`${this.name}: node_helper gestartet – verbinde mit DB ${DB_CONFIG.host}…`);
    this._initDb();
  },

  // ── PostgreSQL Pool ────────────────────────────────────────────────────────

  async _initDb() {
    try {
      const { Pool } = require("pg");
      this.pool = new Pool(DB_CONFIG);
      const client = await this.pool.connect();
      client.release();
      this.useDb   = true;
      this._dbReady = true;
      Log.info(`${this.name}: PostgreSQL verbunden`);
      // Falls LOAD_TODOS vor DB-Verbindung ankam, jetzt nachladen
      if (this._pendingLoad !== null) {
        await this._load(this._pendingLoad);
        this._pendingLoad = null;
      }
    } catch (err) {
      this._dbReady = true; // auch bei Fehler: bereit (nutzt JSON)
      Log.warn(`${this.name}: PostgreSQL nicht erreichbar – nutze todos.json (${err.message})`);
      if (this._pendingLoad !== null) {
        await this._load(this._pendingLoad);
        this._pendingLoad = null;
      }
    }
  },

  // ── Notifications ──────────────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "LOAD_TODOS") {
      if (!this._dbReady) {
        this._pendingLoad = payload?.userId ?? null; // warten bis DB bereit
      } else {
        this._load(payload?.userId);
      }
    }
    if (notification === "TOGGLE_TODO")  this._toggle(payload.id);
    if (notification === "ADD_TODO")     this._add(payload);
    if (notification === "DELETE_TODO")  this._delete(payload.id);
  },

  // ── LOAD ───────────────────────────────────────────────────────────────────

  async _load(userId) {
    if (this.useDb) {
      try {
        this.userId = userId || null;
        const res = await this.pool.query(
          `SELECT id, title, category, done, priority
             FROM todos
            WHERE user_id = $1 OR $1 IS NULL
            ORDER BY done ASC, priority ASC, created_at ASC`,
          [this.userId]
        );
        Log.info(`${this.name}: ${res.rows.length} Todos aus DB geladen (user_id=${this.userId})`);
        this.sendSocketNotification("TODOS_LOADED", res.rows);
        return;
      } catch (err) {
        Log.error(`${this.name}: DB-Ladefehler – ${err.message}`);
      }
    }
    const todos = this._readJson();
    Log.info(`${this.name}: ${todos.length} Todos aus todos.json geladen (Fallback)`);
    this.sendSocketNotification("TODOS_LOADED", todos);
  },

  // ── TOGGLE done ────────────────────────────────────────────────────────────

  async _toggle(id) {
    if (this.useDb) {
      try {
        await this.pool.query(
          `UPDATE todos SET done = NOT done WHERE id = $1`,
          [id]
        );
        await this._load(this.userId);
        return;
      } catch (err) {
        Log.error(`${this.name}: Toggle-Fehler – ${err.message}`);
      }
    }
    // JSON-Fallback
    const todos = this._readJson();
    const todo  = todos.find(t => t.id === id);
    if (todo) { todo.done = !todo.done; this._writeJson(todos); }
    this.sendSocketNotification("TODOS_LOADED", todos);
  },

  // ── ADD ────────────────────────────────────────────────────────────────────

  async _add(payload) {
    if (this.useDb) {
      try {
        await this.pool.query(
          `INSERT INTO todos (user_id, title, category, priority)
           VALUES ($1, $2, $3, $4)`,
          [this.userId, payload.title, payload.category || "Sonstiges", payload.priority || 2]
        );
        await this._load(this.userId);
        return;
      } catch (err) {
        Log.error(`${this.name}: Add-Fehler – ${err.message}`);
      }
    }
    // JSON-Fallback
    const todos   = this._readJson();
    const newTodo = { id: Date.now(), title: payload.title, category: payload.category || "Sonstiges", done: false };
    todos.push(newTodo);
    this._writeJson(todos);
    this.sendSocketNotification("TODOS_LOADED", todos);
  },

  // ── DELETE ─────────────────────────────────────────────────────────────────

  async _delete(id) {
    if (this.useDb) {
      try {
        await this.pool.query(`DELETE FROM todos WHERE id = $1`, [id]);
        await this._load(this.userId);
        return;
      } catch (err) {
        Log.error(`${this.name}: Delete-Fehler – ${err.message}`);
      }
    }
    const todos = this._readJson().filter(t => t.id !== id);
    this._writeJson(todos);
    this.sendSocketNotification("TODOS_LOADED", todos);
  },

  // ── JSON-Fallback ──────────────────────────────────────────────────────────

  _readJson() {
    try {
      return JSON.parse(fs.readFileSync(this.todosFile, "utf-8")).todos || [];
    } catch (e) {
      return [];
    }
  },

  _writeJson(todos) {
    try {
      fs.writeFileSync(this.todosFile, JSON.stringify({ todos }, null, 2), "utf-8");
    } catch (e) {
      Log.error(`${this.name}: JSON-Schreibfehler – ${e.message}`);
    }
  },
});
