/**
 * MMM-Dictation — Browser-Teil (Mikrofon-Steuerung)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Was tut dieses Modul?
 *   Es nimmt Audio über das Mikrofon auf und schickt es an den node_helper,
 *   der die Datei an die Whisper-API (Spracherkennung) weiterleitet.
 *
 * Drei Betriebsarten:
 *   A) Diktat-Modus    — wird von anderen Modulen per Notification
 *                        "DICTATION_START" angefordert (z. B. Notizen).
 *                        Ergebnis = ein Textstring, der zurückgeschickt wird.
 *
 *   B) Befehlsmodus    — Punkt-Taste "." drücken, sprechen, "." drücken.
 *                        Transkript geht NICHT zurück; stattdessen wird es
 *                        von einem LLM (Llama 3 auf Groq) in einen JSON-Befehl
 *                        übersetzt, der dann ausgeführt wird (z. B. Licht an).
 *
 *   C) Input-Modus     — wie Befehlsmodus, aber wenn gerade ein Textfeld
 *                        fokussiert ist: dann wird das Transkript dort
 *                        eingefügt (kein LLM dazwischen).
 *
 * Verkettung (vereinfacht):
 *
 *   Mikrofon
 *      │ MediaRecorder (Browser-API)
 *      ▼
 *   audio/webm-Blob ──Socket──► node_helper.js
 *                                       │
 *                                       ▼ curl
 *                              Whisper-API (Groq)
 *                                       │
 *                                       ▼ Transkript
 *                              [optional: LLM-Interpretation]
 *                                       │
 *                                       ▼ Socket
 *                              "TRANSCRIPTION_RESULT"
 *                                       │
 *                                       ▼
 *                              Browser-Notification z. B. LIGHT_CONTROL
 *
 * Notifications IN (an dieses Modul):
 *   DICTATION_START  { language?, requester? }   — von anderem Modul
 *   DICTATION_STOP                                — von anderem Modul
 *   KEYPRESS         { keyName: "." }            — von MMM-KeyBindings
 *
 * Notifications OUT (an andere Module):
 *   DICTATION_RESULT { transcript, requester }   — Diktat-Modus
 *   DICTATION_ERROR  { error, requester }
 *   DICTATION_STATUS { status, requester }
 *   PAGE_SELECT, TIMER_SET, LIGHT_CONTROL, …     — Befehlsmodus
 */
Module.register("MMM-Dictation", {
  defaults: {
    language: "de",     // Voreingestellte Sprache (Whisper)
    apiKey:   "",       // wird aus config/profile.js befüllt
    provider: "groq",   // "groq" (kostenlos) oder "openai"
  },

  // ── Interner Zustand ──────────────────────────────────────────────────────
  _recorder:     null,   // MediaRecorder-Instanz
  _stream:       null,   // MediaStream der Audio-Tracks
  _chunks:       [],     // gesammelte Audio-Datenstücke
  _recording:    false,  // läuft gerade eine Aufnahme?
  _requester:    null,   // wer hat die Aufnahme angefordert? (z. B. "VOICE_COMMAND")
  _lang:         "de",
  _focusedInput: null,   // gemerktes Eingabefeld für Input-Modus

  getStyles() { return ["MMM-Dictation.css"]; },

  // ── Lifecycle: Start ──────────────────────────────────────────────────────
  // Wir schicken die Config sofort an den Server-Teil — der braucht
  // API-Key und Provider, um die Whisper-API aufzurufen.
  start() {
    this._log("info", `Modul gestartet | Provider: ${this.config.provider}`);
    this.sendSocketNotification("SET_CONFIG", this.config);
  },

  // Wir brauchen nur einen winzigen Anker fürs DOM —
  // hier wird die Status-Anzeige ("● REC") dynamisch reingerendert.
  getDom() {
    const w = document.createElement("div");
    w.id = "mmm-dictation-root";
    return w;
  },

  // ── Logging-Helfer ────────────────────────────────────────────────────────
  // Schreibt sowohl in die Browser-Konsole als auch in die Server-Logdatei.
  _log(level, msg) {
    const full = `${this.name}: ${msg}`;
    if (level === "error")      Log.error(full);
    else if (level === "warn")  Log.warn(full);
    else                        Log.info(full);
    // Den gleichen Log-Eintrag zusätzlich an den Server schicken, damit alles
    // in einer Logdatei landet (Browser-Logs sind sonst nur in DevTools sichtbar).
    this.sendSocketNotification("DICTATION_LOG", { level, msg });
  },

  // ── Antworten vom node_helper ─────────────────────────────────────────────
  socketNotificationReceived(notification, payload) {
    // Server fragt nach der Config (z. B. nach einem Neustart des Helpers)
    if (notification === "REQUEST_CONFIG") {
      this.sendSocketNotification("SET_CONFIG", this.config);
      return;
    }
    if (notification !== "TRANSCRIPTION_RESULT") return;

    // Egal welcher Modus — Aufnahme ist beendet, Anzeige zurücksetzen.
    this._recording = false;
    this._updateIndicator(false);

    if (payload.error) {
      this._log("error", `Transkriptions-Fehler: ${payload.error}`);
      // Fehler nur bei "echten" Diktaten weitermelden, bei Befehlen schweigen
      if (payload.requester !== "VOICE_COMMAND" && payload.requester !== "FOCUSED_INPUT") {
        this.sendNotification("DICTATION_ERROR", { error: payload.error, requester: payload.requester });
      }
      return;
    }

    // Je nach Modus passiert was anderes mit dem Transkript:
    if (payload.requester === "VOICE_COMMAND") {
      // → das LLM-JSON aus payload.command interpretieren
      this._executeCommand(payload.command, payload.transcript);
    } else if (payload.requester === "FOCUSED_INPUT") {
      // → Text ins fokussierte Eingabefeld einfügen
      this._insertIntoFocusedInput(payload.transcript);
    } else {
      // → reines Diktat: an Anfrager zurückschicken
      this._log("info", `Diktat-Ergebnis: "${payload.transcript}"`);
      this.sendNotification("DICTATION_RESULT", { transcript: payload.transcript, requester: payload.requester });
    }
  },

  // ── Notifications von anderen Modulen ────────────────────────────────────
  notificationReceived(notification, payload) {

    // Punkt-Taste: Befehls- oder Input-Modus toggeln
    if (notification === "KEYPRESS" && payload.keyName === ".") {
      // Wenn ein Textfeld fokussiert ist → Input-Modus, sonst Befehlsmodus
      const active  = document.activeElement;
      const inField = active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT");

      if (inField) {
        // Verhindern, dass eine bereits laufende Aufnahme in anderem Modus unterbrochen wird
        if (this._recording && this._requester !== "FOCUSED_INPUT") return;
        if (!this._recording) this._focusedInput = active;
        this._toggleFocusedDictation();
      } else {
        if (this._recording && this._requester !== "VOICE_COMMAND") return;
        this._toggleVoiceCommand();
      }
      return;
    }

    // Externe Module können explizit ein Diktat starten/stoppen
    if (notification === "DICTATION_START") {
      this._requester = (payload && payload.requester) || null;
      this._lang      = (payload && payload.language)  || this.config.language;
      this._start();
    } else if (notification === "DICTATION_STOP") {
      this._stop();
    }
  },

  // ── Befehlsmodus toggeln ──────────────────────────────────────────────────
  _toggleVoiceCommand() {
    if (this._recording) {
      this._log("info", "Voice-Command: Stop → sende zur Transkription");
      this._stop();
    } else {
      this._log("info", "Voice-Command: Start");
      this._requester = "VOICE_COMMAND";
      this._lang      = this.config.language || "de";
      this._start();
    }
  },

  // ── Input-Modus toggeln ───────────────────────────────────────────────────
  _toggleFocusedDictation() {
    if (this._recording) {
      this._log("info", "Input-Diktat: Stop → sende zur Transkription");
      this._stop();
    } else {
      this._log("info", "Input-Diktat: Start");
      this._requester = "FOCUSED_INPUT";
      this._lang      = this.config.language || "de";
      this._start();
    }
  },

  // ── Transkript in das fokussierte Eingabefeld einfügen ────────────────────
  // Wir respektieren die Cursor-Position und fügen ggf. ein Leerzeichen ein,
  // damit "Hallo|" + "Welt" zu "Hallo Welt" wird, nicht zu "HalloWelt".
  _insertIntoFocusedInput(text) {
    const el = this._focusedInput;
    this._focusedInput = null;
    if (!el || !document.body.contains(el)) {
      this._log("warn", "Diktat: Zielelement nicht mehr im DOM");
      return;
    }
    const start  = el.selectionStart ?? el.value.length;
    const end    = el.selectionEnd   ?? el.value.length;
    const before = el.value.substring(0, start);
    const after  = el.value.substring(end);
    // Leerzeichen einfügen, falls vor dem Cursor noch keins steht
    const sep    = before.length > 0 && !/\s$/.test(before) ? " " : "";
    el.value     = before + sep + text + after;
    const pos    = start + sep.length + text.length;
    el.setSelectionRange(pos, pos);
    // "input"-Event feuern, damit React/Vue/etc. die Änderung mitbekommen
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    this._log("info", `Diktat in ${el.tagName}${el.id ? "#" + el.id : ""}: "${text}"`);
  },

  // ── Befehl ausführen (das LLM hat das JSON schon vorgekaut) ──────────────
  _executeCommand(command, transcript) {
    this._log("info", `Voice-Command: "${transcript}" → ${JSON.stringify(command)}`);

    if (!command || command.action === "UNKNOWN") {
      this._log("warn", `Unbekannter Befehl: "${transcript}"`);
      return;
    }

    // Helfer: Erst zur passenden Seite navigieren, dann nach kurzem Delay
    // die eigentliche Notification senden (damit das Ziel-Modul sichtbar ist).
    const navThen = (page, notif, payload) => {
      this.sendNotification("PAGE_SELECT", page);
      setTimeout(() => this.sendNotification(notif, payload), 900);
    };

    const p = command.page ?? 2;   // Default-Seite, falls LLM keine angibt

    switch (command.action) {

      // ── Navigation ─────────────────────────────────────────────────────
      case "PAGE_SELECT":
        this.sendNotification("PAGE_SELECT", command.page);
        break;

      // ── Timer ───────────────────────────────────────────────────────────
      case "TIMER_SET":
        navThen(p, "TIMER_SET", { seconds: command.seconds });
        break;
      case "TIMER_START":
      case "TIMER_STOP":
      case "TIMER_RESET":
        navThen(p, command.action, null);
        break;

      // ── Stoppuhr ────────────────────────────────────────────────────────
      case "STOPWATCH_START":
      case "STOPWATCH_STOP":
      case "STOPWATCH_RESET":
      case "STOPWATCH_LAP":
        navThen(p, command.action, null);
        break;

      // ── Notizen öffnen ─────────────────────────────────────────────────
      case "NOTES_OPEN":
        navThen(p, "NOTES_OPEN", null);
        break;

      // ── Lichtsteuerung ──────────────────────────────────────────────────
      // Wird von MMM-LightSwitches abgefangen
      case "LIGHT_CONTROL":
        this.sendNotification("LIGHT_CONTROL", { id: command.id, state: command.state });
        break;

      default:
        this._log("warn", `Unbekannte Aktion: "${command.action}"`);
    }
  },

  // ── Aufnahme starten (Mikrofon holen + MediaRecorder konfigurieren) ──────
  _start() {
    const isCmd   = this._requester === "VOICE_COMMAND";
    const isInput = this._requester === "FOCUSED_INPUT";
    const modeLabel = isCmd ? "BEFEHL" : isInput ? "INPUT" : "DIKTAT";
    this._log("info", `▶ Aufnahme | Modus: ${modeLabel} | Sprache: ${this._lang}`);

    // Sicherheits-Check: Browser ohne Mikrofon-API (sehr alt, oder ohne HTTPS)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this._log("error", "getUserMedia nicht verfügbar");
      this.sendNotification("DICTATION_ERROR", { error: "not-supported", requester: this._requester });
      return;
    }

    // Mikrofon-Berechtigung anfragen (popup beim ersten Mal)
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const label = stream.getAudioTracks()[0]?.label || "(kein Label)";
        this._log("info", `Mikrofon OK: "${label}"`);

        this._stream = stream;
        this._chunks = [];

        // Bevorzugen Opus in WebM — kleine Datei, gute Qualität, weit unterstützt.
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        this._recorder = new MediaRecorder(stream, { mimeType });

        // Bei jeder neuen Audio-Datenmenge: in Array sammeln
        this._recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) this._chunks.push(e.data);
        };

        // Wenn der User stoppt: Tracks freigeben, Blob bauen, an Server schicken
        this._recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());     // Mikrofon-LED aus
          const blob = new Blob(this._chunks, { type: mimeType });
          this._log("info", `Audio-Blob: ${blob.size} Bytes – sende an node_helper`);

          // Blob → Base64 (sendSocketNotification kann keine Buffer transportieren)
          const reader = new FileReader();
          reader.onloadend = () => {
            this.sendSocketNotification("TRANSCRIBE", {
              audio:     reader.result.split(",")[1],   // ohne "data:audio/webm;base64,"
              mimeType,
              lang:      this._lang,
              requester: this._requester,
            });
            if (!isCmd && !isInput) {
              this.sendNotification("DICTATION_STATUS", { status: "processing", requester: this._requester });
            }
          };
          reader.readAsDataURL(blob);
        };

        // Aufnahme starten — alle 1000 ms ein neues Chunk
        this._recorder.start(1000);
        this._recording = true;
        this._updateIndicator(true, isCmd ? "command" : "dictation");

        if (!isCmd && !isInput) {
          this.sendNotification("DICTATION_STATUS", { status: "listening", requester: this._requester });
        }
      })
      .catch((err) => {
        // User hat abgelehnt, Mikro nicht gefunden, oder Berechtigung fehlt
        this._log("error", `getUserMedia Fehler: ${err.name} – ${err.message}`);
        this.sendNotification("DICTATION_ERROR", { error: err.name, requester: this._requester });
      });
  },

  // ── Aufnahme stoppen ──────────────────────────────────────────────────────
  // .stop() triggert das oben definierte "onstop"-Event.
  _stop() {
    const isCmd   = this._requester === "VOICE_COMMAND";
    const isInput = this._requester === "FOCUSED_INPUT";
    if (this._recorder && this._recorder.state === "recording") {
      this._recorder.stop();
      if (isCmd || isInput) this._updateIndicator(true, "processing");
    } else if (this._stream) {
      // Edge-Case: Recorder hat noch nie gestartet, aber Stream ist offen
      this._stream.getTracks().forEach((t) => t.stop());
    }
    this._recording = false;
    if (!isCmd && !isInput) this._updateIndicator(false);
  },

  // ── Mini-Anzeige unten rechts (Aufnahme-LED) ─────────────────────────────
  // Schreibt direkt ins DOM, statt MagicMirror neu zu rendern (das wäre zu langsam).
  _updateIndicator(active, mode) {
    const root = document.getElementById("mmm-dictation-root");
    if (!root) return;
    if (!active) { root.innerHTML = ""; return; }
    const cfg = {
      command:    { cls: "mmm-dict-rec mmm-dict-cmd",  text: "● BEFEHL" },
      processing: { cls: "mmm-dict-rec mmm-dict-proc", text: "⌛ …" },
      dictation:  { cls: "mmm-dict-rec",               text: "● REC" },
    };
    const { cls, text } = cfg[mode] || cfg.dictation;
    root.innerHTML = `<div class="${cls}">${text}</div>`;
  },
});
