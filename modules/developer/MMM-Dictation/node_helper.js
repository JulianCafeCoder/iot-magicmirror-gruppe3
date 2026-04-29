/**
 * MMM-Dictation node_helper
 *
 * Pipeline für VOICE_COMMAND:
 *   Audio → Whisper (Transkription) → LLaMA (Befehlsinterpretation) → JSON
 *
 * Pipeline für DIKTAT:
 *   Audio → Whisper → Transkript direkt zurück
 */
const NodeHelper   = require("node_helper");
const Log          = require("logger");
const fs           = require("fs");
const os           = require("os");
const path         = require("path");
const { execFile } = require("child_process");

// ── System-Prompt für den Befehlsinterpreter ─────────────────────────────────
// Kompakt gehalten: wenige Tokens, klare Struktur, keine Erklärung nötig.
const COMMAND_SYSTEM_PROMPT = `Du bist ein Smart-Mirror-Assistent.
Interpretiere den deutschen Sprachbefehl und antworte NUR mit einem JSON-Objekt, ohne Erklärung.

Seiten (0-basierter Index):
  0 — Git-Status & Service-Monitor
  1 — Lichtsteuerung & Energie-Dashboard
  2 — Launcher (Timer, Stoppuhr, Würfel, Notizen)

Lichter (id = Nummer):
  1=Wohnzimmer  2=Küche  3=Schlafzimmer  4=Bad
  5=Kinderzimmer  6=Arbeitszimmer  7=Flur  8=Keller

Aktionen:
  {"action":"PAGE_SELECT","page":N}
  {"action":"LIGHT_CONTROL","id":N,"state":"on"|"off"|"toggle"}
  {"action":"TIMER_SET","seconds":N,"page":2}
  {"action":"TIMER_START","page":2}
  {"action":"TIMER_STOP","page":2}
  {"action":"TIMER_RESET","page":2}
  {"action":"STOPWATCH_START","page":2}
  {"action":"STOPWATCH_STOP","page":2}
  {"action":"STOPWATCH_RESET","page":2}
  {"action":"STOPWATCH_LAP","page":2}
  {"action":"NOTES_OPEN","page":2}
  {"action":"UNKNOWN"}

Beispiele:
  "Zeig mir die Lichtsteuerung"       → {"action":"PAGE_SELECT","page":1}
  "Mache das Wohnzimmerlicht an"      → {"action":"LIGHT_CONTROL","id":1,"state":"on"}
  "Küchenlicht ausschalten"           → {"action":"LIGHT_CONTROL","id":2,"state":"off"}
  "Licht im Flur"                     → {"action":"LIGHT_CONTROL","id":7,"state":"toggle"}
  "Alle Lichter aus"                  → {"action":"LIGHT_CONTROL","id":0,"state":"off"}
  "Stelle einen Timer auf 3 Minuten"  → {"action":"TIMER_SET","seconds":180,"page":2}
  "Timer starten"                     → {"action":"TIMER_START","page":2}
  "Timer pausieren"                   → {"action":"TIMER_STOP","page":2}
  "Timer zurücksetzen"                → {"action":"TIMER_RESET","page":2}
  "Starte die Stoppuhr"               → {"action":"STOPWATCH_START","page":2}
  "Stoppuhr stoppen"                  → {"action":"STOPWATCH_STOP","page":2}
  "Stoppuhr auf Null"                 → {"action":"STOPWATCH_RESET","page":2}
  "Runde aufzeichnen"                 → {"action":"STOPWATCH_LAP","page":2}
  "Öffne die Notizen"                 → {"action":"NOTES_OPEN","page":2}
  "Ich möchte eine Notiz verfassen"   → {"action":"NOTES_OPEN","page":2}`;

module.exports = NodeHelper.create({

  config: {},

  start() {
    Log.info("[MMM-Dictation] node_helper bereit");
    this.sendSocketNotification("REQUEST_CONFIG");
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "SET_CONFIG") {
      this.config = payload || {};
      return;
    }
    if (notification === "DICTATION_LOG") {
      const line = `[MMM-Dictation] ${payload.msg}`;
      if (payload.level === "error")     Log.error(line);
      else if (payload.level === "warn") Log.warn(line);
      else                               Log.info(line);
      return;
    }
    if (notification === "TRANSCRIBE") {
      this._transcribe(payload);
    }
  },

  // ── Schritt 1: Whisper-Transkription ─────────────────────────────────────
  _transcribe({ audio, mimeType, lang, requester }) {
    const provider = this.config.provider || "groq";
    const apiKey   = this.config.apiKey   || "";

    const ENDPOINTS_STT = {
      groq:   "https://api.groq.com/openai/v1/audio/transcriptions",
      openai: "https://api.openai.com/v1/audio/transcriptions",
    };
    const MODELS_STT = {
      groq:   "whisper-large-v3",
      openai: "whisper-1",
    };

    if (!apiKey) {
      const hint = provider === "groq"
        ? "Groq-Key unter console.groq.com → GROQ_API_KEY in profile.js"
        : "OpenAI-Key unter platform.openai.com → OPENAI_API_KEY in profile.js";
      Log.error(`[MMM-Dictation] Kein API-Key (${provider}): ${hint}`);
      this.sendSocketNotification("TRANSCRIPTION_RESULT", {
        error: `Kein API-Key – ${hint}`, requester,
      });
      return;
    }

    const ext     = mimeType && mimeType.includes("ogg") ? "ogg" : "webm";
    const tmpFile = path.join(os.tmpdir(), `mmm-dictation-${Date.now()}.${ext}`);

    try {
      fs.writeFileSync(tmpFile, Buffer.from(audio, "base64"));
      const kb = Math.round(fs.statSync(tmpFile).size / 1024);
      Log.info(`[MMM-Dictation] Audio: ${kb} KB → Whisper (${provider})`);
    } catch (e) {
      Log.error(`[MMM-Dictation] Audiodatei-Fehler: ${e.message}`);
      this.sendSocketNotification("TRANSCRIPTION_RESULT", { error: e.message, requester });
      return;
    }

    // Curl parst Semikolons in -F als Feld-Trenner → nur den Basis-MIME-Typ übergeben
    const baseType = (mimeType || "audio/webm").split(";")[0];

    execFile("curl", [
      "-s",
      ENDPOINTS_STT[provider] || ENDPOINTS_STT.groq,
      "-H", `Authorization: Bearer ${apiKey}`,
      "-F", `file=@${tmpFile};type=${baseType}`,
      "-F", `model=${MODELS_STT[provider] || MODELS_STT.groq}`,
      "-F", `language=${lang || "de"}`,
    ], (err, stdout) => {
      try { fs.unlinkSync(tmpFile); } catch (_) {}

      if (err) {
        Log.error(`[MMM-Dictation] Whisper curl-Fehler: ${err.message}`);
        this.sendSocketNotification("TRANSCRIPTION_RESULT", { error: err.message, requester });
        return;
      }

      let parsed;
      try { parsed = JSON.parse(stdout); } catch (_) {
        Log.error(`[MMM-Dictation] Whisper JSON-Fehler: ${stdout}`);
        this.sendSocketNotification("TRANSCRIPTION_RESULT", { error: "Ungültige Whisper-Antwort", requester });
        return;
      }

      if (parsed.error) {
        Log.error(`[MMM-Dictation] Whisper API-Fehler: ${parsed.error.message}`);
        this.sendSocketNotification("TRANSCRIPTION_RESULT", { error: parsed.error.message, requester });
        return;
      }

      const transcript = (parsed.text || "").trim();
      Log.info(`[MMM-Dictation] Transkript: "${transcript}"`);

      if (requester === "VOICE_COMMAND") {
        // Schritt 2: LLM-Interpretation
        this._interpretCommand(transcript, apiKey, provider, (command) => {
          this.sendSocketNotification("TRANSCRIPTION_RESULT", { transcript, command, requester });
        });
      } else {
        // Diktat: Transkript direkt zurück
        this.sendSocketNotification("TRANSCRIPTION_RESULT", { transcript, requester });
      }
    });
  },

  // ── Schritt 2: LLM-Befehlsinterpretation ─────────────────────────────────
  _interpretCommand(transcript, apiKey, provider, callback) {
    const ENDPOINTS_LLM = {
      groq:   "https://api.groq.com/openai/v1/chat/completions",
      openai: "https://api.openai.com/v1/chat/completions",
    };
    const MODELS_LLM = {
      groq:   "llama-3.1-8b-instant",  // schnell, kostenlos auf Groq
      openai: "gpt-4o-mini",
    };

    const body = JSON.stringify({
      model:       MODELS_LLM[provider] || MODELS_LLM.groq,
      messages: [
        { role: "system", content: COMMAND_SYSTEM_PROMPT },
        { role: "user",   content: transcript },
      ],
      max_tokens:  80,
      temperature: 0,
    });

    Log.info(`[MMM-Dictation] LLM-Anfrage: "${transcript}"`);

    execFile("curl", [
      "-s",
      ENDPOINTS_LLM[provider] || ENDPOINTS_LLM.groq,
      "-H", `Authorization: Bearer ${apiKey}`,
      "-H", "Content-Type: application/json",
      "-d", body,
    ], (err, stdout) => {
      if (err) {
        Log.error(`[MMM-Dictation] LLM curl-Fehler: ${err.message}`);
        callback({ action: "UNKNOWN" });
        return;
      }

      try {
        const response = JSON.parse(stdout);
        const content  = response.choices[0].message.content.trim();
        Log.info(`[MMM-Dictation] LLM-Antwort: ${content}`);
        // Robustes Parsing: LLM könnte JSON in Markdown-Blöcke einbetten
        const jsonStr = content.match(/\{[\s\S]*\}/)?.[0] || content;
        callback(JSON.parse(jsonStr));
      } catch (e) {
        Log.error(`[MMM-Dictation] LLM-Parse-Fehler: ${stdout} (${e.message})`);
        callback({ action: "UNKNOWN" });
      }
    });
  },
});
