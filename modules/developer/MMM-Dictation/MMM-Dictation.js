/**
 * MMM-Dictation — MediaRecorder + Whisper API
 *
 * Drei Modi:
 *   A) Diktat-Modus    — ausgelöst von anderen Modulen via DICTATION_START
 *   B) Befehlsmodus    — Taste "." (kein Textfeld fokussiert) → sprechen → "."
 *   C) Input-Modus     — Taste "." (Textfeld fokussiert) → sprechen → "."
 *                        → transkribierter Text wird direkt ins Feld eingefügt
 *
 * Notifications IN:
 *   DICTATION_START  { language?, requester? }
 *   DICTATION_STOP
 *   KEYPRESS         { keyName: "." }
 *
 * Notifications OUT:
 *   DICTATION_RESULT { transcript, requester }   (Diktat-Modus)
 *   DICTATION_ERROR  { error, requester }         (Diktat-Modus)
 *   DICTATION_STATUS { status, requester }        (Diktat-Modus)
 *   PAGE_SELECT      <number>                     (Befehlsmodus)
 *   TIMER_SET        { seconds }                  (Befehlsmodus)
 */
Module.register("MMM-Dictation", {
  defaults: {
    language: "de",
    apiKey:   "",
    provider: "groq",
  },

  _recorder:     null,
  _stream:       null,
  _chunks:       [],
  _recording:    false,
  _requester:    null,
  _lang:         "de",
  _focusedInput: null,   // DOM-Element das beim Start fokussiert war (Input-Modus)

  getStyles() { return ["MMM-Dictation.css"]; },

  start() {
    this._log("info", `Modul gestartet | Provider: ${this.config.provider}`);
    this.sendSocketNotification("SET_CONFIG", this.config);
  },

  getDom() {
    const w = document.createElement("div");
    w.id = "mmm-dictation-root";
    return w;
  },

  // ── Logging ───────────────────────────────────────────────────────────────
  _log(level, msg) {
    const full = `${this.name}: ${msg}`;
    if (level === "error") Log.error(full);
    else if (level === "warn") Log.warn(full);
    else Log.info(full);
    this.sendSocketNotification("DICTATION_LOG", { level, msg });
  },

  // ── Socket-Antworten vom node_helper ─────────────────────────────────────
  socketNotificationReceived(notification, payload) {
    if (notification === "REQUEST_CONFIG") {
      this.sendSocketNotification("SET_CONFIG", this.config);
      return;
    }
    if (notification !== "TRANSCRIPTION_RESULT") return;

    this._recording = false;
    this._updateIndicator(false);

    if (payload.error) {
      this._log("error", `Transkriptions-Fehler: ${payload.error}`);
      if (payload.requester !== "VOICE_COMMAND" && payload.requester !== "FOCUSED_INPUT") {
        this.sendNotification("DICTATION_ERROR", { error: payload.error, requester: payload.requester });
      }
      return;
    }

    if (payload.requester === "VOICE_COMMAND") {
      this._executeCommand(payload.command, payload.transcript);
    } else if (payload.requester === "FOCUSED_INPUT") {
      this._insertIntoFocusedInput(payload.transcript);
    } else {
      this._log("info", `Diktat-Ergebnis: "${payload.transcript}"`);
      this.sendNotification("DICTATION_RESULT", { transcript: payload.transcript, requester: payload.requester });
    }
  },

  // ── Modul-Notifications ───────────────────────────────────────────────────
  notificationReceived(notification, payload) {
    if (notification === "KEYPRESS" && payload.keyName === ".") {
      const active = document.activeElement;
      const inField = active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT");

      if (inField) {
        // Laufende Aufnahme in anderem Modus nicht unterbrechen
        if (this._recording && this._requester !== "FOCUSED_INPUT") return;
        if (!this._recording) this._focusedInput = active;
        this._toggleFocusedDictation();
      } else {
        if (this._recording && this._requester !== "VOICE_COMMAND") return;
        this._toggleVoiceCommand();
      }
      return;
    }

    if (notification === "DICTATION_START") {
      this._requester = (payload && payload.requester) || null;
      this._lang      = (payload && payload.language)  || this.config.language;
      this._start();
    } else if (notification === "DICTATION_STOP") {
      this._stop();
    }
  },

  // ── Befehlsmodus: "." (kein Textfeld) ────────────────────────────────────
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

  // ── Input-Modus: "." (Textfeld fokussiert) ────────────────────────────────
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

  // ── Transkript in fokussiertes Element einfügen ───────────────────────────
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
    const sep    = before.length > 0 && !/\s$/.test(before) ? " " : "";
    el.value     = before + sep + text + after;
    const pos    = start + sep.length + text.length;
    el.setSelectionRange(pos, pos);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    this._log("info", `Diktat in ${el.tagName}${el.id ? "#" + el.id : ""}: "${text}"`);
  },

  // ── Befehlsausführung (strukturiertes LLM-Kommando) ──────────────────────
  _executeCommand(command, transcript) {
    this._log("info", `Voice-Command: "${transcript}" → ${JSON.stringify(command)}`);

    if (!command || command.action === "UNKNOWN") {
      this._log("warn", `Unbekannter Befehl: "${transcript}"`);
      return;
    }

    // Navigiert zu einer Seite, sendet danach eine Notification
    const navThen = (page, notif, payload) => {
      this.sendNotification("PAGE_SELECT", page);
      setTimeout(() => this.sendNotification(notif, payload), 900);
    };

    const p = command.page ?? 2;

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

      // ── Notizen ─────────────────────────────────────────────────────────
      case "NOTES_OPEN":
        navThen(p, "NOTES_OPEN", null);
        break;

      // ── Lichtsteuerung ──────────────────────────────────────────────────
      case "LIGHT_CONTROL":
        this.sendNotification("LIGHT_CONTROL", { id: command.id, state: command.state });
        break;

      default:
        this._log("warn", `Unbekannte Aktion: "${command.action}"`);
    }
  },

  // ── Aufnahme starten ──────────────────────────────────────────────────────
  _start() {
    const isCmd   = this._requester === "VOICE_COMMAND";
    const isInput = this._requester === "FOCUSED_INPUT";
    const modeLabel = isCmd ? "BEFEHL" : isInput ? "INPUT" : "DIKTAT";
    this._log("info", `▶ Aufnahme | Modus: ${modeLabel} | Sprache: ${this._lang}`);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this._log("error", "getUserMedia nicht verfügbar");
      this.sendNotification("DICTATION_ERROR", { error: "not-supported", requester: this._requester });
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const label = stream.getAudioTracks()[0]?.label || "(kein Label)";
        this._log("info", `Mikrofon OK: "${label}"`);

        this._stream = stream;
        this._chunks = [];

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        this._recorder = new MediaRecorder(stream, { mimeType });

        this._recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) this._chunks.push(e.data);
        };

        this._recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(this._chunks, { type: mimeType });
          this._log("info", `Audio-Blob: ${blob.size} Bytes – sende an node_helper`);

          const reader = new FileReader();
          reader.onloadend = () => {
            this.sendSocketNotification("TRANSCRIBE", {
              audio:     reader.result.split(",")[1],
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

        this._recorder.start(1000);
        this._recording = true;
        this._updateIndicator(true, isCmd ? "command" : "dictation");

        if (!isCmd && !isInput) {
          this.sendNotification("DICTATION_STATUS", { status: "listening", requester: this._requester });
        }
      })
      .catch((err) => {
        this._log("error", `getUserMedia Fehler: ${err.name} – ${err.message}`);
        this.sendNotification("DICTATION_ERROR", { error: err.name, requester: this._requester });
      });
  },

  // ── Aufnahme stoppen ──────────────────────────────────────────────────────
  _stop() {
    const isCmd   = this._requester === "VOICE_COMMAND";
    const isInput = this._requester === "FOCUSED_INPUT";
    if (this._recorder && this._recorder.state === "recording") {
      this._recorder.stop();
      if (isCmd || isInput) this._updateIndicator(true, "processing");
    } else if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
    }
    this._recording = false;
    if (!isCmd && !isInput) this._updateIndicator(false);
  },

  // ── Indikator (bottom_right) ──────────────────────────────────────────────
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
