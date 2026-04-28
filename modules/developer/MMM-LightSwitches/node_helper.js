const NodeHelper = require("node_helper");
const Log        = require("logger");
const mqtt       = require("mqtt");

// ── Topic-Helfer ───────────────────────────────────────────────────────────────
const T = {
  set:      (n) => `home/lights/${n}/set`,
  status:   (n) => `home/lights/${n}/status`,
  wildcard: "home/lights/+/status",
};

module.exports = NodeHelper.create({

  start() {
    // Aktueller Zustand aller 8 Lichter (false = AUS)
    this.state  = Object.fromEntries([1,2,3,4,5,6,7,8].map((n) => [n, false]));
    this.client = null;
    this._connectMqtt("mqtt://localhost:1883");
    Log.info(`${this.name}: node_helper gestartet`);
  },

  // ── MQTT-Verbindung aufbauen ────────────────────────────────────────────────

  _connectMqtt(url) {
    this.client = mqtt.connect(url, { reconnectPeriod: 3000 });

    this.client.on("connect", () => {
      Log.info(`${this.name}: MQTT verbunden`);
      // Alle Status-Topics abonnieren (inkl. retained messages vom letzten Start)
      this.client.subscribe(T.wildcard, { qos: 0 });
      this._sendState();
    });

    this.client.on("message", (topic, msg) => {
      const match = topic.match(/^home\/lights\/(\d+)\/status$/);
      if (!match) return;
      const n = parseInt(match[1]);
      if (n < 1 || n > 8) return;
      this.state[n] = msg.toString().toUpperCase() === "ON";
      this._sendState();
    });

    this.client.on("error", (err) => {
      Log.error(`${this.name}: MQTT Fehler – ${err.message}`);
    });

    this.client.on("reconnect", () => {
      Log.info(`${this.name}: MQTT reconnect…`);
    });
  },

  // ── Nachrichten vom Frontend ────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      // Aktuellen Zustand ans (neu geladene) Frontend schicken
      this._sendState();
    }

    if (notification === "TOGGLE_LIGHT") {
      const n = payload.id;
      if (n < 1 || n > 8) return;

      // Zustand toggeln
      this.state[n] = !this.state[n];
      const value = this.state[n] ? "ON" : "OFF";

      Log.info(`${this.name}: Licht ${n} → ${value}`);

      if (this.client && this.client.connected) {
        // set-Topic: Befehl an echtes Gerät (z.B. Tasmota/Home Assistant)
        this.client.publish(T.set(n), value, { retain: false, qos: 0 });
        // status-Topic: Simulation – Gerät bestätigt Zustand zurück
        this.client.publish(T.status(n), value, { retain: true, qos: 0 });
      } else {
        // Kein Broker erreichbar – trotzdem UI aktualisieren
        Log.warn(`${this.name}: MQTT nicht verbunden – kein Publish`);
        this._sendState();
      }
    }
  },

  // ── Zustand ans Frontend senden ────────────────────────────────────────────

  _sendState() {
    this.sendSocketNotification("LIGHT_STATE", { ...this.state });
  },
});
