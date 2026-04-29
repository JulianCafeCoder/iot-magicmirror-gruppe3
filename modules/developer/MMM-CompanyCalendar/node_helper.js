const NodeHelper = require("node_helper");
const ical = require("node-ical");
const { expandRecurringEvent } = ical;

const DB_CONFIG = {
  host:                    process.env.PG_HOST || "10.93.131.37",
  port:                    5432,
  database:                "postgres",
  user:                    "gruppe3",
  password:                "gruppe3",
  connectionTimeoutMillis: 5000,
};

module.exports = NodeHelper.create({

  start() {
    this.pgClient      = null;
    this.useDb         = false;
    this.config        = null;
    this._timer        = null;
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      this.config = payload;
      this._initDb();
    }
  },

  // ── PostgreSQL verbinden ────────────────────────────────────────────────

  async _initDb() {
    try {
      const { Client } = require("pg");
      const client = new Client(DB_CONFIG);
      await client.connect();
      this.pgClient = client;
      this.useDb    = true;
      console.log(`[${this.name}] PostgreSQL verbunden`);
    } catch (err) {
      console.warn(`[${this.name}] PostgreSQL nicht erreichbar – nutze config.employees (${err.message})`);
    }
    this._scheduleRefresh();
    await this._fetchAll();
  },

  // ── Periodisch neu laden ────────────────────────────────────────────────

  _scheduleRefresh() {
    const interval = this.config.fetchInterval || 15 * 60 * 1000;
    this._timer = setInterval(() => this._fetchAll(), interval);
  },

  // ── Mitarbeiter-Liste laden ────────────────────────────────────────────

  async _loadEmployees() {
    if (this.useDb && this.config.mirrorConfigId) {
      try {
        const res = await this.pgClient.query(
          `SELECT id, name, color, ics_url AS url
             FROM calendar_employees
            WHERE mirror_config_id = $1 AND active = TRUE
            ORDER BY name`,
          [this.config.mirrorConfigId]
        );
        if (res.rows.length > 0) return res.rows;
      } catch (err) {
        console.error(`[${this.name}] DB-Fehler beim Laden der Mitarbeiter: ${err.message}`);
      }
    }
    // Fallback: direkt aus der Modul-Konfiguration
    return this.config.employees || [];
  },

  // ── ICS-Feeds laden und cachen ─────────────────────────────────────────

  async _fetchAll() {
    const employees = await this._loadEmployees();
    const allEvents = [];

    await Promise.allSettled(
      employees.map(async (emp) => {
        try {
          const data   = await ical.async.fromURL(emp.url);
          const events = this._parseEvents(data, emp);
          allEvents.push(...events);
          if (this.useDb && emp.id) {
            await this._cacheEvents(emp.id, events);
          }
        } catch (err) {
          console.error(`[${this.name}] Fehler beim Laden von ${emp.name}: ${err.message}`);
          // Bei Fehler: gecachte Events aus der DB als Fallback
          if (this.useDb && emp.id) {
            const cached = await this._loadCached(emp.id, emp);
            allEvents.push(...cached);
          }
        }
      })
    );

    allEvents.sort((a, b) => a.start - b.start);
    this.sendSocketNotification("CALENDAR_EVENTS", allEvents);
  },

  // ── Events in die DB schreiben ─────────────────────────────────────────

  async _cacheEvents(employeeId, events) {
    try {
      for (const ev of events) {
        await this.pgClient.query(
          `INSERT INTO calendar_events_cache
             (employee_id, uid, title, start_at, end_at, all_day, location, fetched_at)
           VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0), $6, $7, NOW())
           ON CONFLICT (employee_id, uid)
           DO UPDATE SET
             title      = EXCLUDED.title,
             start_at   = EXCLUDED.start_at,
             end_at     = EXCLUDED.end_at,
             all_day    = EXCLUDED.all_day,
             location   = EXCLUDED.location,
             fetched_at = NOW()`,
          [employeeId, ev.id, ev.title, ev.start, ev.end, ev.allDay, ev.location || null]
        );
      }
    } catch (err) {
      console.error(`[${this.name}] Fehler beim Cachen (emp ${employeeId}): ${err.message}`);
    }
  },

  // ── Fallback: Events aus dem Cache lesen ──────────────────────────────

  async _loadCached(employeeId, emp) {
    try {
      const rangeStart = Date.now() - 7  * 24 * 60 * 60 * 1000;
      const rangeEnd   = Date.now() + 60 * 24 * 60 * 60 * 1000;
      const res = await this.pgClient.query(
        `SELECT uid, title,
                EXTRACT(EPOCH FROM start_at) * 1000 AS start,
                EXTRACT(EPOCH FROM end_at)   * 1000 AS end,
                all_day, location
           FROM calendar_events_cache
          WHERE employee_id = $1
            AND start_at < to_timestamp($3 / 1000.0)
            AND end_at   > to_timestamp($2 / 1000.0)
          ORDER BY start_at`,
        [employeeId, rangeStart, rangeEnd]
      );
      return res.rows.map((row) => ({
        id:       row.uid,
        title:    row.title,
        start:    Number(row.start),
        end:      Number(row.end),
        allDay:   row.all_day,
        location: row.location || "",
        employee: emp.name,
        color:    emp.color || "#aaaaaa",
      }));
    } catch (err) {
      console.error(`[${this.name}] Fehler beim Lesen des Cache: ${err.message}`);
      return [];
    }
  },

  // ── ICS parsen ─────────────────────────────────────────────────────────

  _parseEvents(data, employee) {
    const now        = new Date();
    const rangeEnd   = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const rangeStart = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
    const events     = [];

    for (const key of Object.keys(data)) {
      const item = data[key];
      if (item.type !== "VEVENT") continue;

      if (item.rrule) {
        try {
          const expanded = expandRecurringEvent(item, { from: rangeStart, to: rangeEnd });
          for (const occ of expanded) {
            events.push(this._toEvent(`${key}_${occ.start.getTime()}`, occ, employee));
          }
        } catch (_) {}
      } else {
        const start = item.start instanceof Date ? item.start : new Date(item.start);
        const end   = item.end   instanceof Date ? item.end   : start;
        if (start > rangeEnd || end < rangeStart) continue;
        events.push(this._toEvent(key, item, employee));
      }
    }
    return events;
  },

  _toEvent(id, item, employee) {
    const start = item.start instanceof Date ? item.start : new Date(item.start);
    const end   = item.end   instanceof Date ? item.end   : start;
    return {
      id,
      title:    item.summary  || "(kein Titel)",
      start:    start.getTime(),
      end:      end.getTime(),
      allDay:   !!item.start?.dateOnly,
      employee: employee.name,
      color:    employee.color || "#aaaaaa",
      location: item.location || "",
    };
  },
});
