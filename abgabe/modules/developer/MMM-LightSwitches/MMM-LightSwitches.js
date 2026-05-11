/**
 * MMM-LightSwitches — Browser-Teil
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Was zeigt dieses Modul?
 *   Ein 4×2-Raster aus 8 "Karten" — jede Karte symbolisiert einen Raum
 *   (Wohnzimmer, Küche, …). Wenn das zugehörige Licht AN ist, leuchtet
 *   die Karte gelb. Sonst ist sie ausgegraut.
 *
 * Wie steuert man die Lichter?
 *   1) Tastatur: Tasten "1"–"8" toggeln das jeweilige Licht
 *      (das passiert nur, wenn KEYPRESS-Notification von MMM-KeyBindings kommt).
 *   2) Sprachbefehl: Andere Module (z. B. MMM-Dictation) können eine
 *      "LIGHT_CONTROL"-Notification senden, dann reagieren wir entsprechend.
 *
 * Wer schaltet die echten LEDs?
 *   Nicht dieses Modul direkt — die Befehle gehen über sendSocketNotification
 *   an den node_helper.js, der publisht sie via MQTT. Der ESP32 hört zu und
 *   schaltet seine GPIO-Pins (Schaltplan: hardware/esp32-lights/WIRING.md).
 *
 *   Browser   ── sendSocketNotification ──►  node_helper.js
 *                                                  │
 *                                                  ▼ MQTT publish
 *                                            [Mosquitto-Broker]
 *                                                  │
 *                                                  ▼ MQTT subscribe
 *                                                [ESP32]
 *                                                  │
 *                                                  ▼ digitalWrite
 *                                                [LED an / aus]
 */
Module.register("MMM-LightSwitches", {

  // ── Defaults: Liste der 8 Räume mit Icon und ID ───────────────────────────
  // Icons sind FontAwesome-Klassen (fa-couch, fa-utensils, …)
  defaults: {
    lights: [
      { id: 1, name: "Wohnzimmer",    icon: "fa-couch"       },
      { id: 2, name: "Küche",         icon: "fa-utensils"    },
      { id: 3, name: "Schlafzimmer",  icon: "fa-bed"         },
      { id: 4, name: "Bad",           icon: "fa-bath"        },
      { id: 5, name: "Kinderzimmer",  icon: "fa-child"       },
      { id: 6, name: "Arbeitszimmer", icon: "fa-laptop"      },
      { id: 7, name: "Flur",          icon: "fa-door-open"   },
      { id: 8, name: "Keller",        icon: "fa-stairs"      },
    ],
  },

  // ── Interner Zustand ──────────────────────────────────────────────────────
  // Form: { 1: false, 2: true, ... } — true = AN, false = AUS
  lightState: {},

  // ── Lifecycle: Modulstart ─────────────────────────────────────────────────
  start() {
    Log.info(`${this.name}: started`);

    // Alle Lichter zunächst auf AUS setzen
    this.config.lights.forEach((l) => { this.lightState[l.id] = false; });

    // node_helper bitten, uns den echten Zustand vom MQTT-Broker zu schicken.
    // (Der Broker behält dank retain=true den letzten Wert.)
    this.sendSocketNotification("INIT");
  },

  getStyles() { return ["MMM-LightSwitches.css"]; },

  // ── Notifications von ANDEREN Modulen ────────────────────────────────────
  // notificationReceived = "Modul-Broadcast"
  // (≠ socketNotificationReceived, das ist nur browser↔server desselben Moduls)
  notificationReceived(notification, payload) {

    // ─ Tastendrücke kommen von MMM-KeyBindings ─
    if (notification === "KEYPRESS") {
      const key = payload.keyName;
      // Nur "1" bis "8" interessieren uns
      if (key >= "1" && key <= "8") {
        const id = parseInt(key);
        this.sendSocketNotification("TOGGLE_LIGHT", { id });
      }
      return;
    }

    // ─ Sprachbefehl: {"id":N,"state":"on"|"off"|"toggle"} ─
    //   id=0 ist eine Sonderform: bedeutet ALLE Lichter
    if (notification === "LIGHT_CONTROL") {
      const { id, state } = payload || {};
      const ids = id === 0
        ? this.config.lights.map((l) => l.id)   // alle 8
        : [id];                                  // genau eines

      ids.forEach((n) => {
        if (n < 1 || n > 8) return;             // ungültige IDs ignorieren
        const on = !!this.lightState[n];
        // Nur toggeln, wenn der gewünschte Zustand vom aktuellen abweicht
        if (state === "toggle" || (state === "on" && !on) || (state === "off" && on)) {
          this.sendSocketNotification("TOGGLE_LIGHT", { id: n });
        }
      });
    }
  },

  // ── Antworten vom node_helper ─────────────────────────────────────────────
  // Der Server schickt uns nach jedem MQTT-Ereignis den aktuellen Gesamt-Zustand.
  socketNotificationReceived(notification, payload) {
    if (notification === "LIGHT_STATE") {
      this.lightState = payload;
      this._render();         // UI neu zeichnen
    }
  },

  // ── DOM (Rendering) ──────────────────────────────────────────────────────
  getDom() { return this._buildDom(); },

  // Bei Zustandsänderungen den Inhalt unseres Wrappers austauschen,
  // statt den ganzen Wrapper neu zu erzeugen — das verhindert "Flackern".
  _render() {
    const wrapper = document.getElementById(this.identifier);
    if (!wrapper) return;
    const content = wrapper.querySelector(".module-content");
    if (!content) return;
    content.innerHTML = "";
    content.appendChild(this._buildDom());
  },

  // Erstellt das eigentliche 4×2-Grid mit allen Karten.
  _buildDom() {
    const grid = document.createElement("div");
    grid.className = "ls-grid";

    this.config.lights.forEach((light) => {
      const on = !!this.lightState[light.id];

      const card = document.createElement("div");
      // CSS toggelt zwischen .ls-on (gelb) und .ls-off (grau)
      card.className = `ls-card ${on ? "ls-on" : "ls-off"}`;

      // Tastenkürzel oben links / Icon / Name / AN-AUS-Badge
      card.innerHTML = `
        <div class="ls-key">${light.id}</div>
        <div class="ls-icon"><i class="fas ${this._esc(light.icon)}"></i></div>
        <div class="ls-name">${this._esc(light.name)}</div>
        <div class="ls-badge">${on ? "AN" : "AUS"}</div>`;

      grid.appendChild(card);
    });

    return grid;
  },

  // ── HTML-Escaping ─────────────────────────────────────────────────────────
  // Verhindert, dass <script>-Tags o. ä. aus Konfigurationswerten Schaden
  // anrichten. Klassische XSS-Hygiene, auch wenn die Werte hier "sicher" sind.
  _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },
});
