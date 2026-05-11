/**
 * MMM-LightSwitches — Server-Teil (node_helper.js)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Was tut dieser Helper?
 *   Er übersetzt zwischen zwei Welten:
 *     • Browser  ←→  Helper (über die MagicMirror-Socket-API)
 *     • Helper   ←→  ESP32  (über MQTT)
 *
 *   Wenn der Browser sagt "Toggle Licht 3", publishen wir per MQTT
 *   `home/lights/3/set ON`. Der ESP32 hört zu, schaltet seine GPIO,
 *   und meldet auf `home/lights/3/status ON` zurück. Diese Bestätigung
 *   abonnieren wir und reichen sie an den Browser durch — so bleibt das
 *   UI synchron mit der Realität.
 *
 * MQTT-Topics (Verträge mit dem ESP32):
 *   home/lights/N/set     — Befehl an die LED:    "ON" oder "OFF"
 *   home/lights/N/status  — Bestätigung vom ESP32: "ON" oder "OFF"
 *
 *   wildcard "home/lights/+/status" matcht alle 8 Status-Topics auf einmal.
 */
const NodeHelper = require("node_helper");
const Log        = require("logger");
const mqtt       = require("mqtt");

// Kleine Helfer-Funktionen, damit wir Topic-Strings nicht überall manuell bauen
const T = {
  set:      (n) => `home/lights/${n}/set`,        // Befehl
  status:   (n) => `home/lights/${n}/status`,     // Bestätigung
  wildcard: "home/lights/+/status",                 // alle Status-Topics
};

module.exports = NodeHelper.create({

  // ── Lifecycle: Helper-Start ───────────────────────────────────────────────
  start() {
    // Anfangszustand für 8 Lichter aufbauen: { 1:false, 2:false, ..., 8:false }
    // Object.fromEntries baut aus [[1,false],[2,false],...] ein Objekt.
    this.state  = Object.fromEntries([1,2,3,4,5,6,7,8].map((n) => [n, false]));
    this.client = null;

    // MQTT-Broker läuft auf dem Pi selbst (localhost:1883)
    this._connectMqtt("mqtt://localhost:1883");
    Log.info(`${this.name}: node_helper gestartet`);
  },

  // ── MQTT-Verbindung aufbauen ──────────────────────────────────────────────
  _connectMqtt(url) {
    // reconnectPeriod sorgt dafür, dass wir bei Verbindungsabbruch alle 3 s
    // automatisch wieder anklopfen — wichtig, falls der Broker später startet.
    this.client = mqtt.connect(url, { reconnectPeriod: 3000 });

    this.client.on("connect", () => {
      Log.info(`${this.name}: MQTT verbunden`);
      // Wildcard-Abo: holt für alle 8 Lichter den letzten Zustand
      // (möglich, weil der ESP32 mit retain=true publisht)
      this.client.subscribe(T.wildcard, { qos: 0 });
      this._sendState();
    });

    // Eingehende Nachricht: Topic dekodieren, State aktualisieren, Browser informieren.
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

  // ── Nachrichten vom Browser-Teil ──────────────────────────────────────────
  socketNotificationReceived(notification, payload) {

    // Nach dem Laden im Browser: aktuellen Stand schicken
    if (notification === "INIT") {
      this._sendState();
    }

    // Toggle-Befehl vom Browser (Tastatur oder Sprachbefehl)
    if (notification === "TOGGLE_LIGHT") {
      const n = payload.id;
      if (n < 1 || n > 8) return;

      // Lokalen Zustand umschalten (optimistisches Update)
      this.state[n] = !this.state[n];
      const value = this.state[n] ? "ON" : "OFF";

      Log.info(`${this.name}: Licht ${n} → ${value}`);

      if (this.client && this.client.connected) {
        // Echter Befehl an den ESP32
        this.client.publish(T.set(n), value, { retain: false, qos: 0 });
        // Zusätzlich auf Status-Topic publishen (retain=true) —
        // damit ein gerade neu verbundener Client sofort den korrekten
        // Zustand sieht, ohne auf die ESP32-Bestätigung warten zu müssen.
        this.client.publish(T.status(n), value, { retain: true, qos: 0 });
      } else {
        // Kein Broker erreichbar (z. B. auf dem Mac ohne mosquitto):
        // wenigstens das UI aktualisieren, damit der User Feedback bekommt.
        Log.warn(`${this.name}: MQTT nicht verbunden – kein Publish`);
        this._sendState();
      }
    }
  },

  // ── Aktuellen Zustand an Browser senden ──────────────────────────────────
  // {...this.state} = Kopie, damit das Frontend nicht versehentlich unser
  // internes Objekt mutiert (Mutation = Bug-Quelle).
  _sendState() {
    this.sendSocketNotification("LIGHT_STATE", { ...this.state });
  },
});
