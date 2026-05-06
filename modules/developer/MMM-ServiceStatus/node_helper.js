const NodeHelper = require("node_helper");
const Log        = require("logger");
const net        = require("net");
const https      = require("https");
const { exec }   = require("child_process");

// ── Welche Dienste geprüft werden ─────────────────────────────────────────────
const SERVICES = [
  { id: "backend",  label: "MM Backend",   type: "self"  },
  { id: "frontend", label: "MM Frontend",  type: "nc",    host: "localhost", port: 8081 },
  { id: "database", label: "Datenbank",    type: "nc",    host: "10.93.135.91", port: 5432 },
  { id: "mqtt",     label: "MQTT Broker",  type: "port",  host: "localhost", port: 1883 },
  { id: "internet", label: "Internet",     type: "https", host: "1.1.1.1"              },
];

module.exports = NodeHelper.create({

  start() {
    Log.info(`${this.name}: node_helper gestartet`);
    this._check();
    this._timer = setInterval(() => this._check(), 30 * 1000);
  },

  socketNotificationReceived(notification) {
    if (notification === "INIT") this._check();
  },

  // ── Alle Dienste prüfen ────────────────────────────────────────────────────

  async _check() {
    const results = await Promise.all(
      SERVICES.map(async (svc) => {
        let online = false;
        try {
          if (svc.type === "self")  online = true;
          if (svc.type === "port")  online = await this._checkPort(svc.host, svc.port);
          if (svc.type === "nc")    online = await this._checkNc(svc.host, svc.port);
          if (svc.type === "https") online = await this._checkHttps(svc.host);
        } catch (_) { online = false; }
        return { id: svc.id, label: svc.label, online };
      })
    );
    this.sendSocketNotification("SERVICE_STATUS", results);
  },

  // ── nc-basierter Port-Check (Fallback für macOS-Netzwerkprobleme) ─────────

  _checkNc(host, port, timeout = 2) {
    return new Promise((resolve) => {
      exec(`nc -z -w ${timeout} ${host} ${port}`, (err) => resolve(!err));
    });
  },

  // ── TCP-Port erreichbar? ───────────────────────────────────────────────────

  _checkPort(host, port, timeout = 2000) {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port, family: 4 });
      const t = setTimeout(() => { socket.destroy(); resolve(false); }, timeout);
      socket.on("connect", () => { clearTimeout(t); socket.destroy(); resolve(true); });
      socket.on("error",   (err) => { clearTimeout(t); Log.warn(`${this.name}: port check ${host}:${port} failed – ${err.message}`); resolve(false); });
    });
  },

  // ── HTTPS-Erreichbarkeit ───────────────────────────────────────────────────

  _checkHttps(host, timeout = 3000) {
    return new Promise((resolve) => {
      const req = https.request({ host, method: "HEAD", path: "/", timeout }, (res) => {
        resolve(res.statusCode < 600);
      });
      req.on("error",   () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.end();
    });
  },
});
