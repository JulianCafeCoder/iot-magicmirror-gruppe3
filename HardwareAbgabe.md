# Hardware-Abgabe

Übersicht aller Hardware-relevanten Teile im MagicMirror-Projekt für die Schul-Abgabe.

## 1. ESP32-Lichtschalter (echte Hardware)

**Ordner:** `hardware/esp32-lights/`

- `esp32-lights.ino` — Arduino/PlatformIO-Sketch für den ESP32 (WLAN + MQTT + Relais-Steuerung)
- `platformio.ini` — Build-Konfiguration
- `WIRING.md` — Schaltplan / Pinbelegung
- *(nicht hochladen: `config.h` — enthält WLAN-/MQTT-Passwörter, ist git-ignored)*

**Zugehöriges MagicMirror-Modul:** `modules/developer/MMM-LightSwitches/`

- `MMM-LightSwitches.js` — UI im Spiegel
- `MMM-LightSwitches.css` — Styling
- `node_helper.js` — MQTT-Client (verbindet sich mit dem ESP32 über `home/lights/<n>/set` und `/status`)
- `package.json` / `package-lock.json`
- *(nicht hochladen: `node_modules/`)*

## 2. ESP32-Bewegungsmelder (echte Hardware)

**Ordner:** `hardware/esp32-motion/`

- `esp32-motion.ino` — ESP32-Sketch, liest HC-SR501 PIR-Sensor und sendet per MQTT
- `platformio.ini` — Build-Konfiguration
- `WIRING.md` — Anschluss-Schema (VCC → 5V, OUT → GPIO 27, GND → GND)

**Zugehöriges MagicMirror-Modul:** `modules/developer/MMM-MotionSensor/`

- `MMM-MotionSensor.js` — Overlay-Logik (Spiegel "aus" = schwarzes Overlay)
- `MMM-MotionSensor.css` — Fullscreen-Overlay mit Fade-Animation
- `node_helper.js` — MQTT-Client, abonniert `home/motion/status`
- `package.json` / `package-lock.json`
- *(nicht hochladen: `node_modules/`)*

**Funktionsweise:** PIR erkennt Bewegung → ESP32 publisht `MOTION` auf MQTT → Modul blendet Inhalte ein. Nach konfigurierbarer Zeit ohne Bewegung (`dimDelaySec`, Standard 60 s) wird ein schwarzes Overlay eingeblendet, das den Spiegel deaktiviert wirken lässt. Zusätzlich wird die Standard-Notification `USER_PRESENCE` gebroadcastet.

## 3. USB-Webcam mit Gesichtserkennung

**Modul:** `modules/developer/MMM-Camera/`

- `MMM-Camera.js` — greift per `getUserMedia()` auf die USB-Webcam zu und nutzt **face-api.js** (TinyFaceDetector) zur Gesichtserkennung
- `MMM-Camera.css` — Live-Vorschau mit blauen Boxen um erkannte Gesichter
- `README.md` — enthält Pi-Setup, Electron-/Chromium-Berechtigungen, Offline-Vendoring
- *(kein node_helper nötig — alles läuft im Browser)*

**Hardware:** beliebige UVC-kompatible USB-Webcam (z. B. Logitech C270).
Per `lsusb` / `v4l2-ctl --list-devices` prüfbar.

**Funktionsweise:**
- Frontend liest Cam-Stream
- TinyFaceDetector-Modell erkennt Gesichter im Browser (kein Server, keine Cloud)
- Beim Ändern der Personenanzahl werden Notifications gesendet: `FACE_DETECTED` mit `{ count }`, `FACES_CLEAR`, sowie die Standard-Notification `USER_PRESENCE`
- Damit kombinierbar mit dem PIR-Modul (zwei-Stufen-Wakeup)

## 4. Mikrofon / Sprachsteuerung

**Ordner:** `modules/developer/MMM-Dictation/`

- `MMM-Dictation.js` — nutzt die `MediaRecorder`-API des Browsers, nimmt das Mikrofon auf
- `MMM-Dictation.css`
- `node_helper.js` — schickt Audio an Whisper (Groq/OpenAI) → LLaMA/GPT → Aktion

**Pipeline:** Mikrofon → Whisper (Speech-to-Text) → LLM → Notification

## 5. Raspberry Pi Kiosk-Setup (Display-Hardware)

- `scripts/kiosk.sh` — Autostart-Script für Chromium im Kiosk-Modus auf dem Pi
- `Dockerfile` — Server-Image für den Pi
- `docker-compose.yml` — `network_mode: host` für den Pi
- `README.md` — enthält Pi-Setup-Anweisungen

## Was NICHT hochladen

- `config/profile.js` — enthält API-Keys (Groq/OpenAI) und Standort
- `hardware/esp32-lights/config.h` — WLAN-/MQTT-Credentials
- alle `node_modules/`-Ordner

## Empfehlung für Moodle

Erstelle ein ZIP mit:

```
hardware/esp32-lights/                  (ohne config.h)
hardware/esp32-motion/
modules/developer/MMM-LightSwitches/    (ohne node_modules)
modules/developer/MMM-MotionSensor/     (ohne node_modules)
modules/developer/MMM-Camera/
modules/developer/MMM-Dictation/
scripts/kiosk.sh
Dockerfile
docker-compose.yml
README.md
CLAUDE.md                               (gute Übersicht zur Architektur)
```
