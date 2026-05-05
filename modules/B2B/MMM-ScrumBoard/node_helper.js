const NodeHelper = require("node_helper");
const Log        = require("logger");
const fs         = require("fs");
const path       = require("path");

const DB_CONFIG = {
  host:                    process.env.PG_HOST || "10.93.132.254",
  port:                    5432,
  database:                "postgres",
  user:                    "gruppe3",
  password:                "gruppe3",
  connectionTimeoutMillis: 5000,
  max:                     3,
};

module.exports = NodeHelper.create({

  start() {
    this.dataFile = path.join(this.path, "scrum-data.json");
    this.pool     = null;
    this.useDb    = false;
    this._ready   = false;
    this._pending = false;
    Log.info(`${this.name}: node_helper gestartet`);
    this._initDb();
  },

  // ── DB init ───────────────────────────────────────────────────────────────

  async _initDb() {
    try {
      const { Pool } = require("pg");
      this.pool = new Pool(DB_CONFIG);
      const client = await this.pool.connect();
      client.release();
      this.useDb  = true;
      this._ready = true;
      Log.info(`${this.name}: PostgreSQL verbunden`);
    } catch (err) {
      this._ready = true;
      Log.warn(`${this.name}: PostgreSQL nicht erreichbar – nutze JSON (${err.message})`);
    }
    if (this._pending) { this._pending = false; await this._load(); }
  },

  // ── Notifications ─────────────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "SCRUM_LOAD") {
      if (!this._ready) { this._pending = true; return; }
      this._load();
    }
    if (notification === "SCRUM_ADD_CARD")    this._addCard(payload);
    if (notification === "SCRUM_MOVE_CARD")   this._moveCard(payload);
    if (notification === "SCRUM_DELETE_CARD") this._deleteCard(payload);
  },

  // ── Load ──────────────────────────────────────────────────────────────────

  async _load() {
    if (this.useDb) {
      try {
        const sr = await this.pool.query(
          `SELECT * FROM scrum_sprints ORDER BY id DESC LIMIT 1`
        );
        if (sr.rows.length > 0) {
          const sprint = sr.rows[0];
          const cr = await this.pool.query(
            `SELECT * FROM scrum_cards WHERE sprint_id = $1 ORDER BY created_at ASC`,
            [sprint.id]
          );
          return this._send(sprint, cr.rows);
        }
      } catch (err) {
        Log.error(`${this.name}: DB-Ladefehler – ${err.message}`);
      }
    }
    const d = this._readJson();
    this._send(d.sprint, d.cards);
  },

  // ── Add card ──────────────────────────────────────────────────────────────

  async _addCard(payload) {
    if (this.useDb) {
      try {
        const sr = await this.pool.query(
          `SELECT id FROM scrum_sprints ORDER BY id DESC LIMIT 1`
        );
        const sprintId = sr.rows[0]?.id;
        await this.pool.query(
          `INSERT INTO scrum_cards (sprint_id, title, story_points, assignee, status, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            sprintId,
            payload.title,
            payload.story_points,
            payload.assignee,
            payload.status,
            payload.status === "done" ? new Date() : null,
          ]
        );
        return this._load();
      } catch (err) {
        Log.error(`${this.name}: Add-Fehler – ${err.message}`);
      }
    }
    const d = this._readJson();
    const newId = d.cards.length > 0 ? Math.max(...d.cards.map(c => c.id)) + 1 : 1;
    d.cards.push({
      id:           newId,
      title:        payload.title,
      story_points: payload.story_points,
      assignee:     payload.assignee,
      status:       payload.status,
      completed_at: payload.status === "done" ? new Date().toISOString() : null,
      created_at:   new Date().toISOString(),
    });
    this._writeJson(d);
    this._send(d.sprint, d.cards);
  },

  // ── Move card ─────────────────────────────────────────────────────────────

  async _moveCard({ id, status }) {
    if (this.useDb) {
      try {
        await this.pool.query(
          `UPDATE scrum_cards SET status = $1, completed_at = $2 WHERE id = $3`,
          [status, status === "done" ? new Date() : null, id]
        );
        return this._load();
      } catch (err) {
        Log.error(`${this.name}: Move-Fehler – ${err.message}`);
      }
    }
    const d    = this._readJson();
    const card = d.cards.find(c => c.id === id);
    if (card) {
      card.status       = status;
      card.completed_at = status === "done" ? new Date().toISOString() : null;
    }
    this._writeJson(d);
    this._send(d.sprint, d.cards);
  },

  // ── Delete card ───────────────────────────────────────────────────────────

  async _deleteCard({ id }) {
    if (this.useDb) {
      try {
        await this.pool.query(`DELETE FROM scrum_cards WHERE id = $1`, [id]);
        return this._load();
      } catch (err) {
        Log.error(`${this.name}: Delete-Fehler – ${err.message}`);
      }
    }
    const d = this._readJson();
    d.cards = d.cards.filter(c => c.id !== id);
    this._writeJson(d);
    this._send(d.sprint, d.cards);
  },

  // ── Burndown calculation ──────────────────────────────────────────────────

  _calcBurndown(sprint, cards) {
    const start = new Date(sprint.start_date);
    const end   = new Date(sprint.end_date);
    const days  = Math.round((end - start) / 86400000);
    const total = cards.reduce((s, c) => s + (c.story_points || 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const actual = [];
    for (let d = 0; d <= days; d++) {
      const dayStart = new Date(start);
      dayStart.setDate(dayStart.getDate() + d);
      dayStart.setHours(0, 0, 0, 0);

      if (dayStart > today) {
        actual.push(null);
        continue;
      }

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const remaining = cards
        .filter(c => {
          if (c.status !== "done") return true;
          if (!c.completed_at)    return false;
          return new Date(c.completed_at) > dayEnd;
        })
        .reduce((s, c) => s + (c.story_points || 0), 0);

      actual.push(remaining);
    }

    return { totalPoints: total, days, actual };
  },

  // ── Helper: send data to client ───────────────────────────────────────────

  _send(sprint, cards) {
    const burndown = this._calcBurndown(sprint, cards);
    this.sendSocketNotification("SCRUM_DATA", { sprint, cards, burndown });
  },

  // ── JSON fallback ─────────────────────────────────────────────────────────

  _readJson() {
    try {
      return JSON.parse(fs.readFileSync(this.dataFile, "utf-8"));
    } catch (e) {
      const today = new Date().toISOString().split("T")[0];
      const end   = new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0];
      return { sprint: { id: 1, name: "Sprint 1", start_date: today, end_date: end }, cards: [] };
    }
  },

  _writeJson(data) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      Log.error(`${this.name}: JSON-Schreibfehler – ${e.message}`);
    }
  },
});
