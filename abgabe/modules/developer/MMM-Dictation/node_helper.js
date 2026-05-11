/**
 * MMM-Dictation — Server-Teil (node_helper.js)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Was tut dieser Helper?
 *   Er nimmt vom Browser eine Audio-Datei (als Base64) entgegen und
 *   ruft externe Web-APIs auf:
 *
 *     1. Whisper (Speech-to-Text)
 *        Ergebnis: ein Transkript ("mach das Licht im Bad an")
 *
 *     2. Optional: LLM (Llama 3 oder GPT) als "Befehls-Interpreter"
 *        Eingabe: der Transkript-Text + ein System-Prompt mit JSON-Schema
 *        Ergebnis: ein JSON-Objekt wie
 *                  {"action":"LIGHT_CONTROL","id":4,"state":"on"}
 *
 *   Das fertige JSON geht zurück an den Browser, wo es eine MagicMirror-
 *   Notification auslöst (z. B. LIGHT_CONTROL).
 *
 * Warum die zwei Stufen?
 *   Whisper kann gut Sprache → Text, aber kein "Verstehen". Das LLM
 *   wiederum kann gut Text → strukturierte Aktion. So bauen wir uns mit
 *   zwei sehr unterschiedlichen Modellen einen Sprachassistenten.
 *
 * Warum curl?
 *   Wir könnten auch fetch / axios / undici verwenden. curl ist auf jedem
 *   System verfügbar, gut zu debuggen, und multipart/form-data ist mit
 *   `-F file=@...` ein Einzeiler. Performance-Unterschied ist hier egal.
 */
const NodeHelper   = require("node_helper");
const Log          = require("logger");
const fs           = require("fs");
const os           = require("os");
const path         = require("path");
const { execFile } = require("child_process");   // sichere "execve"-ähnliche API

// ── System-Prompt für den Befehlsinterpreter ──────────────────────────────
//
// Hier sagen wir dem LLM präzise, in welches JSON-Schema es Eingaben
// übersetzen soll. Wenige Tokens (Kosten), strenge Struktur (Parsbarkeit),
// keine Erklärung ("antworte NUR mit JSON"). Beispiele am Ende helfen dem
// Modell, ähnliche Sätze richtig zu mappen ("Few-Shot Prompting").
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

  // wird in SET_CONFIG befüllt — API-Key und Provider stammen aus profile.js
  config: {},

  start() {
    Log.info("[MMM-Dictation] node_helper bereit");
    // Direkt nach dem Start die Browser-Seite bitten, uns die Config zu schicken
    this.sendSocketNotification("REQUEST_CONFIG");
  },

  // ── Eingehende Nachrichten vom Browser-Teil ──────────────────────────────
  socketNotificationReceived(notification, payload) {
    if (notification === "SET_CONFIG") {
      this.config = payload || {};
      return;
    }
    if (notification === "DICTATION_LOG") {
      // Browser-Logs in die zentrale Datei spiegeln
      const line = `[MMM-Dictation] ${payload.msg}`;
      if (payload.level === "error")      Log.error(line);
      else if (payload.level === "warn")  Log.warn(line);
      else                                Log.info(line);
      return;
    }
    if (notification === "TRANSCRIBE") {
      this._transcribe(payload);
    }
  },

  // ── Schritt 1: Audio → Whisper-API → Transkript ──────────────────────────
  _transcribe({ audio, mimeType, lang, requester }) {
    const provider = this.config.provider || "groq";
    const apiKey   = this.config.apiKey   || "";

    // API-Endpunkte und Modell-Namen für die beiden Provider
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

    // Audio in temporäre Datei schreiben (curl braucht eine Datei für -F file=@...)
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

    // Wichtig: curl interpretiert Semikolons in -F speziell — daher nur den
    // Basis-MIME ("audio/webm" statt "audio/webm;codecs=opus") übergeben.
    const baseType = (mimeType || "audio/webm").split(";")[0];

    // curl-Aufruf mit multipart/form-data (Whisper-API erwartet das).
    execFile("curl", [
      "-s",
      ENDPOINTS_STT[provider] || ENDPOINTS_STT.groq,
      "-H", `Authorization: Bearer ${apiKey}`,
      "-F", `file=@${tmpFile};type=${baseType}`,
      "-F", `model=${MODELS_STT[provider] || MODELS_STT.groq}`,
      "-F", `language=${lang || "de"}`,
    ], (err, stdout) => {
      // Temporäre Datei aufräumen (egal ob Erfolg oder Fehler)
      try { fs.unlinkSync(tmpFile); } catch (_) {}

      if (err) {
        Log.error(`[MMM-Dictation] Whisper curl-Fehler: ${err.message}`);
        this.sendSocketNotification("TRANSCRIPTION_RESULT", { error: err.message, requester });
        return;
      }

      // Antwort als JSON parsen — wenn das fehlschlägt, hat die API HTML/Müll geliefert
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

      // ── Verzweigung ─
      if (requester === "VOICE_COMMAND") {
        // Befehlsmodus: Transkript ans LLM → strukturiertes JSON zurück
        this._interpretCommand(transcript, apiKey, provider, (command) => {
          this.sendSocketNotification("TRANSCRIPTION_RESULT", { transcript, command, requester });
        });
      } else {
        // Diktatmodus: nur das Transkript zurückschicken
        this.sendSocketNotification("TRANSCRIPTION_RESULT", { transcript, requester });
      }
    });
  },

  // ── Schritt 2: Transkript → LLM → JSON-Befehl ────────────────────────────
  _interpretCommand(transcript, apiKey, provider, callback) {
    const ENDPOINTS_LLM = {
      groq:   "https://api.groq.com/openai/v1/chat/completions",
      openai: "https://api.openai.com/v1/chat/completions",
    };
    const MODELS_LLM = {
      groq:   "llama-3.1-8b-instant",  // schnell und kostenlos auf Groq
      openai: "gpt-4o-mini",
    };

    // ChatCompletions-API: System-Prompt + User-Message + niedrige Temperatur
    // (temperature=0 → deterministische Ausgabe, gut für JSON-Generierung)
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
        // LLM könnte JSON in Markdown-Codeblöcke verpacken (```json ... ```).
        // Wir extrahieren mit einer Regex das erste { ... }-Vorkommen.
        const jsonStr = content.match(/\{[\s\S]*\}/)?.[0] || content;
        callback(JSON.parse(jsonStr));
      } catch (e) {
        Log.error(`[MMM-Dictation] LLM-Parse-Fehler: ${stdout} (${e.message})`);
        callback({ action: "UNKNOWN" });
      }
    });
  },
});
