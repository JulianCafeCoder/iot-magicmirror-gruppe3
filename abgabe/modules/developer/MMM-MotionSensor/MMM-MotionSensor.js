/**
 * MMM-MotionSensor — Browser-Teil
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Was macht dieses Modul?
 *   Es legt einen schwarzen Vollbild-Vorhang über den Spiegel, wenn niemand
 *   mehr vor dem Sensor steht — und blendet ihn sofort weg, sobald wieder
 *   Bewegung erkannt wird. Der Vorhang ist nur ein <div> mit CSS-Transition;
 *   die Hardware (PIR-Sensor) "lebt" am ESP32 und kommuniziert per MQTT.
 *
 * Wie hängt das zusammen?
 *
 *   [HC-SR501 PIR] ──► [ESP32] ──MQTT──► [Mosquitto-Broker auf dem Pi]
 *                                              │
 *                                              ▼
 *                                       [node_helper.js]   <── derselbe Pi
 *                                              │  (sendSocketNotification)
 *                                              ▼
 *                                  [diese Datei im Browser]
 *
 *   • node_helper.js abonniert das MQTT-Topic `home/motion/status`
 *   • bei Änderung schickt er eine "MOTION_STATE"-Nachricht an die Browser-Seite
 *   • _onMotionState() unten reagiert darauf
 *
 * Wichtige MagicMirror-Konzepte für Einsteiger:
 *   - Module.register(name, obj) registriert ein Modul.
 *   - start()                  : wird einmalig beim Hochfahren gerufen
 *   - getStyles()              : liefert eine Liste von CSS-Dateien
 *   - getDom()                 : muss das sichtbare HTML-Element liefern
 *   - socketNotificationReceived(): empfängt Nachrichten vom node_helper
 *   - sendNotification()       : verschickt eine Nachricht an ANDERE Module
 *     (z. B. "USER_PRESENCE", das Standard-Signal "Jemand ist da")
 */
Module.register("MMM-MotionSensor", {

  // ── Defaults ──────────────────────────────────────────────────────────────
  // Diese Werte gelten, wenn in der config.js nichts angegeben wird.
  // Sie können dort überschrieben werden, z. B. config: { dimDelaySec: 30 }
  defaults: {
    dimDelaySec: 60,   // Sekunden ohne Bewegung, bis der Spiegel verdunkelt
    fadeMs:      800,  // Dauer der Ein-/Ausblend-Animation (in CSS verwendet)
  },

  // ── Interne Variablen ─────────────────────────────────────────────────────
  // (kein "this." in der Definition – MagicMirror tut das für uns)
  motion:    false,  // letzter bekannter PIR-Zustand
  dimTimer:  null,   // Referenz auf laufenden setTimeout, damit wir ihn löschen können
  overlay:   null,   // DOM-Element für den schwarzen Vorhang

  // ── Lifecycle: Modulstart ─────────────────────────────────────────────────
  start() {
    // Log.* schreibt in die MagicMirror-Logdatei – hilfreich beim Debuggen.
    Log.info(`${this.name}: started (dimDelay=${this.config.dimDelaySec}s)`);

    // Wir bitten den Server-Teil (node_helper.js), uns den aktuellen
    // PIR-Zustand zu schicken. So sind wir nach einem Reload sofort synchron.
    this.sendSocketNotification("INIT");
  },

  // CSS-Datei mit dem Vorhang-Styling registrieren
  getStyles() { return ["MMM-MotionSensor.css"]; },

  // ── Nachrichten vom node_helper.js ────────────────────────────────────────
  // payload = { motion: true|false }
  socketNotificationReceived(notification, payload) {
    if (notification === "MOTION_STATE") {
      this._onMotionState(!!payload.motion);   // !! zwingt zu Boolean
    }
  },

  // ── DOM aufbauen ──────────────────────────────────────────────────────────
  // MagicMirror ruft getDom() bei jedem Render auf. Wir bauen genau ein <div>
  // (den Vorhang) und merken uns die Referenz, um später Klassen zu toggeln.
  getDom() {
    const overlay = document.createElement("div");
    overlay.className = "ms-overlay";
    // Animationsdauer per Inline-Style setzen, damit fadeMs konfigurierbar bleibt
    overlay.style.transitionDuration = `${this.config.fadeMs}ms`;
    this.overlay = overlay;
    return overlay;
  },

  // ── Geschäftslogik ────────────────────────────────────────────────────────
  // Wird aufgerufen, sobald sich der PIR-Zustand ändert.
  _onMotionState(motion) {
    this.motion = motion;

    if (motion) {
      // Jemand steht davor → Vorhang weg, Timer abbrechen
      this._wake();
      this._clearDimTimer();
    } else {
      // Keine Bewegung mehr → Timer starten, der nach dimDelaySec verdunkelt
      this._startDimTimer();
    }
  },

  // Vorhang ausblenden + globale Notification "User ist da" senden.
  _wake() {
    if (this.overlay) this.overlay.classList.remove("ms-dim");
    // USER_PRESENCE ist ein Standard-Signal in MagicMirror, auf das viele
    // Module reagieren (z. B. Monitor anschalten, Animationen starten).
    this.sendNotification("USER_PRESENCE", true);
  },

  // Vorhang einblenden + Anwesenheit auf "weg" setzen.
  _dim() {
    if (this.overlay) this.overlay.classList.add("ms-dim");
    this.sendNotification("USER_PRESENCE", false);
  },

  // Timer (neu) starten. Falls schon einer läuft, wird er erst gelöscht.
  _startDimTimer() {
    this._clearDimTimer();
    this.dimTimer = setTimeout(
      () => this._dim(),
      this.config.dimDelaySec * 1000   // setTimeout will Millisekunden
    );
  },

  // Laufenden Timer abbrechen (z. B. wenn wieder Bewegung kommt).
  _clearDimTimer() {
    if (this.dimTimer) {
      clearTimeout(this.dimTimer);
      this.dimTimer = null;
    }
  },
});
