/**
 * MMM-MotionSensor — Server-Teil (node_helper.js)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Diese Datei läuft im Node.js-Prozess von MagicMirror (NICHT im Browser).
 * Sie ist die einzige Stelle in diesem Modul, die mit dem MQTT-Broker
 * spricht — der Browser kann das aus Sicherheitsgründen nicht direkt.
 *
 * Ablauf:
 *   1. Beim Start verbinden wir uns mit dem MQTT-Broker auf dem Pi
 *      (Mosquitto auf localhost:1883).
 *   2. Wir abonnieren das Topic `home/motion/status`. Der ESP32
 *      veröffentlicht dort "MOTION" oder "CLEAR".
 *   3. Jede empfangene Nachricht wird in einen einfachen Boolean übersetzt
 *      und per Socket an den Browser-Teil weitergereicht.
 *
 * Warum kein direktes MQTT im Browser?
 *   Browser sprechen kein "rohes" MQTT, nur MQTT-über-WebSockets — und auch
 *   nur, wenn der Broker das anbietet. Außerdem wäre der Broker-Endpunkt
 *   dann im Klartext im Browser sichtbar. node_helper.js ist die saubere
 *   Lösung: ein dünner Proxy zwischen MQTT und der MagicMirror-Socket-API.
 */
const NodeHelper = require("node_helper");   // Basisklasse für Helfer
const Log        = require("logger");         // einheitliches Logging
const mqtt       = require("mqtt");           // MQTT-Client (npm: "mqtt")

// Das Topic, das wir abonnieren. Der ESP32-Sketch publisht hier mit retain=true,
// damit auch nach einem Reconnect der letzte Zustand bekannt ist.
const TOPIC_STATUS = "home/motion/status";

module.exports = NodeHelper.create({

  // ── Lifecycle: Helper-Start ───────────────────────────────────────────────
  // Wird einmalig vom MagicMirror-Server aufgerufen.
  start() {
    this.motion = false;   // letzter bekannter Bewegungszustand
    this.client = null;    // wird in _connectMqtt() befüllt
    this._connectMqtt("mqtt://localhost:1883");
    Log.info(`${this.name}: node_helper gestartet`);
  },

  // ── MQTT-Verbindung aufbauen ──────────────────────────────────────────────
  _connectMqtt(url) {
    // reconnectPeriod: 3000 = wenn die Verbindung abreißt, alle 3 s neu versuchen
    this.client = mqtt.connect(url, { reconnectPeriod: 3000 });

    // Event: erfolgreich verbunden
    this.client.on("connect", () => {
      Log.info(`${this.name}: MQTT verbunden`);
      this.client.subscribe(TOPIC_STATUS, { qos: 0 });
      // Aktuellen Zustand sofort ans Frontend schicken (zur Sicherheit)
      this._sendState();
    });

    // Event: Nachricht vom Broker empfangen
    this.client.on("message", (topic, msg) => {
      if (topic !== TOPIC_STATUS) return;
      // msg ist ein Buffer → in String wandeln und in Großbuchstaben normieren
      const payload = msg.toString().toUpperCase();
      this.motion = payload === "MOTION";
      Log.info(`${this.name}: PIR → ${payload}`);
      this._sendState();   // Browser informieren
    });

    // Event: Fehler (z. B. Broker nicht erreichbar)
    this.client.on("error", (err) => {
      Log.error(`${this.name}: MQTT Fehler – ${err.message}`);
    });

    // Event: automatischer Reconnect-Versuch
    this.client.on("reconnect", () => {
      Log.info(`${this.name}: MQTT reconnect…`);
    });
  },

  // ── Nachrichten vom Browser-Teil ──────────────────────────────────────────
  // Das Frontend schickt nach dem Laden "INIT", damit es den letzten Zustand
  // erfährt, ohne auf eine PIR-Änderung warten zu müssen.
  socketNotificationReceived(notification) {
    if (notification === "INIT") {
      this._sendState();
    }
  },

  // ── Zustand an Browser senden ─────────────────────────────────────────────
  // sendSocketNotification ist das Gegenstück zu socketNotificationReceived
  // im Browser-Teil. Erster Parameter = Nachrichtenname, zweiter = Payload.
  _sendState() {
    this.sendSocketNotification("MOTION_STATE", { motion: this.motion });
  },
});
