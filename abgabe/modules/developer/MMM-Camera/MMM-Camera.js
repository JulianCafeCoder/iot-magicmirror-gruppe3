/**
 * MMM-Camera — Webcam + Gesichtserkennung (Detection)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Was macht das Modul?
 *   - Greift per `getUserMedia()` auf eine USB-Webcam zu (im Browser).
 *   - Erkennt Gesichter mit der Library face-api.js (TinyFaceDetector).
 *   - Zeigt eine kleine Live-Vorschau mit blauen Boxen um erkannte Gesichter.
 *   - Sendet Notifications, sobald sich die Anzahl der Personen ändert.
 *
 * Wichtig: Wir machen NUR Detection ("ist da ein Gesicht?"),
 *          KEINE Recognition ("welches Gesicht?"). Es werden keine Bilder
 *          gespeichert oder verschickt — alles passiert lokal im Browser.
 *
 * Datenfluss:
 *
 *   USB-Webcam ──► getUserMedia ──► <video>
 *                                      │
 *                                      ▼ alle 500 ms
 *                              face-api.detectAllFaces()
 *                                      │
 *                                      ▼
 *                            [{x,y,width,height,...}, ...]
 *                                      │
 *                       ┌──────────────┼──────────────┐
 *                       ▼              ▼              ▼
 *                   Canvas zeichnen   Count anzeigen   Notifications
 *                                                  (FACE_DETECTED etc.)
 *
 * Notifications (an andere Module):
 *   FACE_DETECTED  { count: N }   — wenn mind. 1 Gesicht erkannt wird
 *   FACES_CLEAR    {}             — wenn keine Gesichter mehr da sind
 *   USER_PRESENCE  true|false     — Standard-MM-Signal
 */
Module.register("MMM-Camera", {

  // ── Defaults ──────────────────────────────────────────────────────────────
  defaults: {
    detectionIntervalMs: 500,  // Intervall zwischen zwei Erkennungen
    minConfidence:       0.5,  // Mindest-Score, damit ein Gesicht zählt
    inputSize:           224,  // Eingangsgröße des Modells (klein=schnell)
    showPreview:         true, // Live-Bild zeigen oder verstecken?
    previewWidth:        240,  // Breite der Vorschau in Pixel
    drawDetections:      true, // Blaue Kästchen zeichnen?

    // CDN-URLs für Library + Modelle. Im Schul-WLAN evtl. blockiert —
    // README erklärt, wie man beides offline vendoren kann.
    faceApiUrl: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.min.js",
    modelsUrl:  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/",
  },

  // ── Interner Zustand ──────────────────────────────────────────────────────
  videoEl:   null,   // <video>-Element mit Live-Bild
  canvasEl:  null,   // <canvas> für die blauen Boxen
  countEl:   null,   // Text am unteren Rand ("2 Gesichter")
  stream:    null,   // MediaStream-Objekt der Kamera
  ready:     false,  // erst nach Modell-Load + Cam-Start true
  lastCount: 0,     // zuletzt gemeldete Personenzahl — verhindert Notification-Spam
  loopTimer: null,   // setInterval-Handle für den Detection-Loop

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  start()      { Log.info(`${this.name}: started`); },
  getStyles()  { return ["MMM-Camera.css"]; },

  // MagicMirror lädt diese externen Skripte automatisch (vor getDom).
  getScripts() { return [this.config.faceApiUrl]; },

  // ── DOM aufbauen ──────────────────────────────────────────────────────────
  // Wir bauen drei verschachtelte Elemente: Wrapper > (video, canvas, count).
  // Canvas liegt mit absoluter Position über dem Video, damit die Boxen
  // exakt auf den Bildern liegen.
  getDom() {
    const wrap = document.createElement("div");
    wrap.className = "cam-wrap";
    wrap.style.width = `${this.config.previewWidth}px`;
    if (!this.config.showPreview) wrap.classList.add("cam-hidden");

    // <video> — der Live-Stream der Webcam.
    // - autoplay  : starten, sobald Stream zugewiesen ist
    // - muted     : ohne Mute blockiert Chrome autoplay
    // - playsInline: iOS-Workaround, damit das Video nicht im Fullscreen aufpoppt
    const video = document.createElement("video");
    video.autoplay    = true;
    video.muted       = true;
    video.playsInline = true;
    video.className   = "cam-video";
    this.videoEl = video;

    // <canvas> — wir zeichnen darauf nur die Erkennungs-Boxen.
    const canvas = document.createElement("canvas");
    canvas.className = "cam-canvas";
    this.canvasEl = canvas;

    // Kleiner Statustext am unteren Rand der Vorschau.
    const count = document.createElement("div");
    count.className = "cam-count";
    count.textContent = "–";
    this.countEl = count;

    wrap.appendChild(video);
    wrap.appendChild(canvas);
    wrap.appendChild(count);

    // Initialisierung erst NACH dem Anhängen ans DOM starten,
    // sonst hat <video> noch keine sichere Größe.
    setTimeout(() => this._init(), 0);

    return wrap;
  },

  // ── Initialisierung (Modell + Kamera) ─────────────────────────────────────
  async _init() {
    try {
      await this._loadModels();
      await this._startCamera();
      this.ready = true;
      this._loop();
    } catch (err) {
      Log.error(`${this.name}: Init fehlgeschlagen – ${err.message}`);
      if (this.countEl) this.countEl.textContent = "Kamera nicht verfügbar";
    }
  },

  // face-api.js-Modell laden. Wir benutzen nur den TinyFaceDetector — das
  // schnellste Modell (~190 KB), das genau das tut, was wir brauchen.
  async _loadModels() {
    if (typeof faceapi === "undefined") {
      throw new Error("face-api.js nicht geladen (CDN blockiert?)");
    }
    Log.info(`${this.name}: lade Modelle von ${this.config.modelsUrl}`);
    await faceapi.nets.tinyFaceDetector.loadFromUri(this.config.modelsUrl);
  },

  // Webcam anfordern und an das <video>-Element koppeln.
  async _startCamera() {
    // Browser fragt den User nach Erlaubnis. Beim ersten Mal poppt ein Dialog auf.
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    this.videoEl.srcObject = this.stream;

    // Auf "Video-Metadaten verfügbar" warten — vorher kennen wir die Größe nicht.
    await new Promise((resolve) => {
      this.videoEl.onloadedmetadata = () => resolve();
    });

    // Canvas-Auflösung an das Video angleichen (CSS skaliert es dann auf
    // die sichtbare Breite). Das hält die Erkennungs-Boxen pixelgenau.
    this.canvasEl.width  = this.videoEl.videoWidth;
    this.canvasEl.height = this.videoEl.videoHeight;
  },

  // ── Detection-Loop ────────────────────────────────────────────────────────
  // setInterval (statt setTimeout-Schleife) ist hier OK, weil eine einzelne
  // Erkennung in <300 ms fertig ist und das Intervall größer ist.
  _loop() {
    this.loopTimer = setInterval(
      () => this._detect(),
      this.config.detectionIntervalMs
    );
  },

  async _detect() {
    // Sicherheits-Check: noch nicht initialisiert oder Video hat keine Daten?
    if (!this.ready || this.videoEl.readyState < 2) return;

    // Optionen für das Modell: kleinere inputSize = schneller, weniger genau.
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize:      this.config.inputSize,
      scoreThreshold: this.config.minConfidence,
    });

    // detectAllFaces läuft das Modell — kann eine kurze Zeit blockieren.
    const detections = await faceapi.detectAllFaces(this.videoEl, options);
    const count = detections.length;

    if (this.config.drawDetections) this._draw(detections);

    // Statustext aktualisieren ("Niemand" / "2 Gesichter").
    this.countEl.textContent = count === 0
      ? "Niemand"
      : `${count} Gesicht${count === 1 ? "" : "er"}`;

    // Nur bei ÄNDERUNG der Anzahl andere Module benachrichtigen.
    // Sonst würden wir 2× pro Sekunde Notifications spammen.
    if (count !== this.lastCount) {
      this.lastCount = count;
      if (count > 0) {
        this.sendNotification("FACE_DETECTED", { count });
        this.sendNotification("USER_PRESENCE", true);
      } else {
        this.sendNotification("FACES_CLEAR", {});
      }
    }
  },

  // Zeichnet die blauen Erkennungs-Rechtecke ins Canvas.
  // Das Canvas wird per CSS gespiegelt, also passen die Koordinaten direkt.
  _draw(detections) {
    const ctx = this.canvasEl.getContext("2d");
    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    ctx.strokeStyle = "#3fa9ff";
    ctx.lineWidth   = 3;
    detections.forEach((d) => {
      const { x, y, width, height } = d.box;
      ctx.strokeRect(x, y, width, height);
    });
  },
});
