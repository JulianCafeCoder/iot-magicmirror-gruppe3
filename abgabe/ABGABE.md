# Hardware-Abgabe MagicMirror

**Autoren:** Julian, Joel, Peter
**Repository:** <https://github.com/JulianCafeCoder/iot-magicmirror-gruppe3>

Dieser Ordner enthält alle Bestandteile unseres MagicMirror-Projekts, die mit
**physischer Hardware** zu tun haben. Es handelt sich um einen Auszug aus dem
Gesamtprojekt; das vollständige Quellcode-Repository ist unter dem oben
verlinkten GitHub-Projekt einsehbar.

---

## 1. Projektkontext in einem Absatz

Der Spiegel hängt an einem Raspberry Pi mit angeschlossenem Monitor und zeigt
über eine Halbspiegel-Folie verschiedene Informations-Seiten an. **Vier
Hardware-Komponenten** sind angebunden:

1. **ESP32 + 8 LEDs** — simuliert eine Wohnungs-Lichtsteuerung (MQTT)
2. **ESP32 + PIR-Sensor (HC-SR501)** — schaltet den Spiegel automatisch
   ein/aus, je nachdem ob jemand davor steht (MQTT)
3. **USB-Webcam** — Gesichtserkennung im Browser, signalisiert Anwesenheit
4. **USB-Mikrofon** — Spracheingabe über Whisper-API für Diktate und Befehle

Zusätzlich wird der **Raspberry Pi** selbst als Display-Hardware konfiguriert
(Chromium-Kiosk-Modus).

---

## 2. Ordnerstruktur

```
abgabe/
├── ABGABE.md                       ← diese Datei
│
├── hardware/                       ← Mikrocontroller-Code (Arduino/C++)
│   ├── esp32-lights/               ← ESP32-Sketch für Lichtsteuerung
│   │   ├── esp32-lights.ino
│   │   ├── platformio.ini
│   │   └── WIRING.md               ← Schaltplan / Pinbelegung
│   └── esp32-motion/               ← ESP32-Sketch für Bewegungsmelder
│       ├── esp32-motion.ino
│       ├── platformio.ini
│       └── WIRING.md
│
├── modules/developer/              ← MagicMirror-Module (JavaScript)
│   ├── MMM-LightSwitches/          ← UI zur Lichtsteuerung
│   ├── MMM-MotionSensor/           ← Reagiert auf PIR via MQTT
│   ├── MMM-Camera/                 ← Webcam + Gesichtserkennung
│   └── MMM-Dictation/              ← Mikrofon + Whisper-Spracherkennung
│
├── scripts/
│   └── kiosk.sh                    ← Autostart Chromium auf dem Pi
│
├── Dockerfile                      ← Container-Image für den Pi
└── docker-compose.yml              ← Compose-Setup (host network)
```

---

## 3. Gesamt-Architektur

```
   ┌──────────────────┐                ┌─────────────────────────┐
   │   ESP32 #1       │                │      Raspberry Pi       │
   │   8 LEDs         │◄─── MQTT ─────►│                         │
   │   esp32-lights/  │   home/        │  ┌───────────────────┐  │
   └──────────────────┘   lights/+/*   │  │  Mosquitto-Broker │  │
                                       │  │  (Port 1883)      │  │
   ┌──────────────────┐                │  └───────────────────┘  │
   │   ESP32 #2       │                │  ┌───────────────────┐  │
   │   PIR-Sensor     │◄─── MQTT ─────►│  │  MagicMirror      │  │
   │   esp32-motion/  │   home/        │  │  (Electron oder   │  │
   └──────────────────┘   motion/      │  │   Chromium-Kiosk) │  │
                          status       │  │                   │  │
   ┌──────────────────┐                │  │  ┌─────────────┐  │  │
   │   USB-Webcam     │── getUserMedia ┼──┼─►│ Module mit  │  │  │
   └──────────────────┘                │  │  │ Hardware-   │  │  │
                                       │  │  │ Bezug:      │  │  │
   ┌──────────────────┐                │  │  │ - Lights    │  │  │
   │   USB-Mikrofon   │── getUserMedia ┼──┼─►│ - Motion    │  │  │
   └──────────────────┘                │  │  │ - Camera    │  │  │
                                       │  │  │ - Dictation │  │  │
                                       │  │  └─────────────┘  │  │
                                       │  └───────────────────┘  │
                                       └─────────────────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │ HDMI-Monitor │
                                          │ + Halbspiegel│
                                          └──────────────┘
```

**Kurz erklärt:**
- Die beiden ESP32 sprechen über einen **MQTT-Broker** (Mosquitto auf dem Pi)
  mit dem MagicMirror — kein direkter Kabelweg, alles über WLAN.
- Webcam und Mikrofon werden direkt vom Browser des Spiegels per
  `getUserMedia()` angezapft, kein extra Server-Prozess.
- Jedes MagicMirror-Modul besteht aus **zwei Teilen**: einem
  Browser-Teil (`MMM-*.js`, läuft im Electron-/Chromium-Fenster) und
  optional einem Node.js-Teil (`node_helper.js`, läuft im Server-Prozess).
  Die beiden kommunizieren über die MagicMirror-eigene Socket-API.

---

## 4. Komponenten im Detail

### 4.1 Lichtsteuerung — `MMM-LightSwitches` + `esp32-lights`

**Hardware:** ESP32 + 8 LEDs (jede mit 220 Ω Vorwiderstand). Jede LED steht
symbolisch für ein Zimmer (Wohnzimmer, Küche, …). Schaltplan in
[`hardware/esp32-lights/WIRING.md`](hardware/esp32-lights/WIRING.md).

**Funktionsweise:**
1. Der ESP32 verbindet sich mit dem WLAN und abonniert `home/lights/+/set`.
2. Im Spiegel zeigt das Modul ein 4×2-Raster mit Zimmer-Icons.
3. Tasten **1–8** auf der Fernbedienung lösen `TOGGLE_LIGHT` aus
   → der `node_helper.js` publisht `ON`/`OFF` auf `home/lights/N/set`.
4. Der ESP32 schaltet die LED und sendet eine Bestätigung auf
   `home/lights/N/status` zurück — der Spiegel aktualisiert das UI.
5. Sprachbefehl ("Mach das Licht im Wohnzimmer an") funktioniert ebenfalls,
   über das `MMM-Dictation`-Modul, das die Notification `LIGHT_CONTROL`
   sendet.

**Wichtige Dateien:**
- `hardware/esp32-lights/esp32-lights.ino` — ESP32-Sketch
  (PubSubClient, 8 GPIO-Ausgänge)
- `modules/developer/MMM-LightSwitches/MMM-LightSwitches.js` — UI-Logik
- `modules/developer/MMM-LightSwitches/node_helper.js` — MQTT-Client

---

### 4.2 Bewegungsmelder — `MMM-MotionSensor` + `esp32-motion`

**Hardware:** ESP32 + HC-SR501 PIR-Bewegungssensor (Passiv-Infrarot,
erkennt Wärmesignaturen). Schaltplan in
[`hardware/esp32-motion/WIRING.md`](hardware/esp32-motion/WIRING.md).

**Funktionsweise:**
1. Der ESP32 liest den digitalen PIR-Ausgang an GPIO 27. Auf einer
   Zustandsänderung publisht er `MOTION` oder `CLEAR` auf
   `home/motion/status` (retain=true, damit auch neu verbundene Clients
   den letzten Zustand kennen).
2. Der `node_helper.js` des Moduls abonniert dieses Topic.
3. Der Browser-Teil hält einen vollflächigen **schwarzen Overlay-DIV**
   über dem Spiegel. Bei `MOTION` wird das Overlay sofort ausgeblendet
   ("Spiegel wacht auf"). Bei `CLEAR` startet ein Timer (Standard 60 s);
   läuft er ab, wird das Overlay sanft eingeblendet.
4. Zusätzlich wird die MagicMirror-Standard-Notification
   `USER_PRESENCE` gesendet, damit andere Module reagieren können.

**Designentscheidung:** Der Timeout liegt bewusst nicht im PIR-Sensor
selbst (dessen Time-Poti ist auf Minimum), sondern im Browser-Modul —
so kann er per Config-Wert (`dimDelaySec`) ohne Re-Flash geändert werden.

**Wichtige Dateien:**
- `hardware/esp32-motion/esp32-motion.ino` — Sensor-Polling, MQTT-Publish
- `modules/developer/MMM-MotionSensor/MMM-MotionSensor.js` — Overlay + Timer
- `modules/developer/MMM-MotionSensor/node_helper.js` — MQTT-Subscriber

---

### 4.3 Webcam mit Gesichtserkennung — `MMM-Camera`

**Hardware:** Beliebige UVC-kompatible USB-Webcam (z. B. Logitech C270).
Plug & Play, keine Treiber.

**Funktionsweise:**
1. Der Browser-Teil ruft `navigator.mediaDevices.getUserMedia()` auf und
   bindet den Stream an ein `<video>`-Element.
2. Die Library **face-api.js** (basiert auf TensorFlow.js) wird per
   `<script>`-Tag aus dem CDN nachgeladen, das **TinyFaceDetector**-Modell
   ebenfalls.
3. Alle 500 ms wird der aktuelle Videoframe durch das Modell geschickt.
   Es liefert eine Liste von `{ x, y, width, height, confidence }`-Boxen.
4. Über die Boxen wird ein `<canvas>` gelegt, das blaue Rechtecke
   zeichnet (Live-Visualisierung der Erkennung).
5. Bei Änderung der Gesichts-**Anzahl** werden Notifications gesendet:
   `FACE_DETECTED` / `FACES_CLEAR` und `USER_PRESENCE` — kombinierbar mit
   dem PIR-Modul als "zwei-Stufen-Wakeup" (PIR registriert Bewegung,
   Cam bestätigt, dass es ein Mensch ist).

**Warum kein eigener Backend-Prozess?** face-api.js läuft komplett im
Browser auf der WebAssembly-Engine — kein Python, keine externe API,
keine Daten verlassen den Spiegel.

> **Hinweis (Stand der Abgabe):** Die Gesichtserkennung ist noch
> nicht vollständig stabil — vereinzelt werden Gesichter unter
> ungünstigen Lichtverhältnissen nicht erkannt oder die Erkennung
> reagiert verzögert. Die Funktion ist als Prototyp gedacht; ein
> Feintuning der Modell-Parameter (`inputSize`, `minConfidence`,
> `detectionIntervalMs`) und ggf. ein Wechsel auf ein größeres
> Detektionsmodell.

**Wichtige Dateien:**
- `modules/developer/MMM-Camera/MMM-Camera.js` — Setup + Detection-Loop
- `modules/developer/MMM-Camera/MMM-Camera.css` — Vorschau-Styling
  (das Bild wird per `transform: scaleX(-1)` gespiegelt — wie ein
  echter Spiegel)
- `modules/developer/MMM-Camera/README.md` — Setup-Details, Vendoring
  für Offline-Betrieb

---

### 4.4 Mikrofon / Sprachsteuerung — `MMM-Dictation`

**Hardware:** Beliebiges USB-Mikrofon (oder das eingebaute Pi-Mikro).

**Funktionsweise (Pipeline):**
```
USB-Mikro
   │
   ▼ getUserMedia + MediaRecorder
[ Audio-Chunks (webm/opus) ]
   │
   ▼ Base64 → Socket → node_helper
[ Whisper-API (Groq oder OpenAI) per curl ]
   │
   ▼ Transkript
[ LLaMA / GPT mit System-Prompt → JSON-Action ]
   │
   ▼ Socket → Browser
[ MagicMirror-Notification, z. B. LIGHT_CONTROL ]
```

1. Push-to-Talk-Taste startet `MediaRecorder` im Browser.
2. Audio wird als Base64 an den `node_helper.js` geschickt.
3. Der ruft per `curl` die **Whisper-API** (Groq, kostenlos) auf →
   Transkript.
4. Für Befehle (Modus `VOICE_COMMAND`) wird das Transkript an ein
   LLaMA-Modell geschickt mit einem hardgecodeten System-Prompt, der
   die Ausgabe auf ein JSON-Objekt mit Action + Parametern zwingt.
5. Dieses JSON wird als MagicMirror-Notification gebroadcastet
   (z. B. `LIGHT_CONTROL: { id: 1, state: "on" }`), worauf
   `MMM-LightSwitches` reagiert.

**Wichtige Dateien:**
- `modules/developer/MMM-Dictation/MMM-Dictation.js` — MediaRecorder + UI
- `modules/developer/MMM-Dictation/node_helper.js` — HTTP-Calls,
  Prompt-Engineering

---

### 4.5 Raspberry Pi als Display-Hardware

Der Pi ist kein passives Gehäuse, sondern Teil der Hardware-Kette:
- Bootet in den Desktop, `~/.config/autostart` startet
  [`scripts/kiosk.sh`](scripts/kiosk.sh).
- Das Skript wartet, bis der MagicMirror-Server auf Port 8081 antwortet,
  schaltet Bildschirmschoner aus (`xset s off`, `xset -dpms`) und startet
  **Chromium im Kiosk-Modus** (kein Browser-Chrome, Full-Screen).
- Der MagicMirror-Server läuft in einem Docker-Container, beschrieben in
  [`Dockerfile`](Dockerfile) und [`docker-compose.yml`](docker-compose.yml).
- `network_mode: host` ist notwendig, damit der MQTT-Broker auf
  `localhost:1883` vom Container und vom Host gleichermaßen erreichbar ist.

---

## 5. Wie wir die Module gebaut haben

Jedes MagicMirror-Modul folgt demselben Muster:

| Teil          | Datei                | Läuft wo?        | Aufgabe                                     |
|---------------|----------------------|------------------|---------------------------------------------|
| Browser-Teil  | `MMM-<Name>.js`      | Electron/Chromium | DOM, User-Eingaben, Hardware via Browser-API |
| Server-Teil   | `node_helper.js`     | Node.js          | Netzwerk (MQTT, HTTP), Datei-I/O            |
| Styling       | `MMM-<Name>.css`     | Browser          | Layout, Animation                            |
| Dependencies  | `package.json`       | npm install      | nur wenn Server-Teil externe Libs braucht   |

Kommuniziert wird zwischen den beiden Teilen über zwei Funktionen:
- Browser → Server: `this.sendSocketNotification(name, payload)`
- Server → Browser: `this.sendSocketNotification(name, payload)` (gleicher
  Name, andere Klasse) — auf der Browser-Seite empfangen in
  `socketNotificationReceived(name, payload)`.

---

## 6. Sicherheits- und Datenschutz-Überlegungen

- **Webcam:** Der Cam-Stream verlässt den Spiegel **nicht**.
  Die Gesichtserkennung läuft lokal im Browser, es werden keine Bilder
  gespeichert oder verschickt.
- **Mikrofon:** Audio wird zur Transkription an Groq (Hosting in den USA)
  geschickt. API-Key liegt in `config/profile.js` (git-ignored,
  daher nicht in dieser Abgabe enthalten).
- **WLAN-Credentials für die ESP32** stehen aktuell direkt im
  `.ino`-Sketch. Für eine Produktiv-Version würden wir auf
  WiFiManager + Captive-Portal umstellen — für ein Schul-Demo-Projekt
  haben wir darauf verzichtet.
- **MQTT-Broker** läuft ohne Authentifizierung auf `localhost` — das
  ist akzeptabel, weil die ESP32 im selben WLAN-Segment hängen.

---

## 7. Was bewusst NICHT in diesem Ordner ist

| Datei                                | Grund                                                                  |
|--------------------------------------|------------------------------------------------------------------------|
| `config/profile.js`                  | enthält API-Keys (Groq/OpenAI) und Standort-Daten                      |
| `hardware/esp32-lights/config.h`     | WLAN-/MQTT-Passwörter (existiert nur lokal, ist git-ignored)           |
| `node_modules/`                      | wird per `npm install` regeneriert, Megabyte-große Dependencies        |
| Module ohne Hardware-Bezug           | Kalender, Stundenplan, Newsfeed, To-Do, Finanzen — nicht relevant      |

Die Abgabe konzentriert sich strikt auf den Hardware-Teil. Das vollständige
Projekt mit allen Modulen und der gesamten Git-Historie ist auf GitHub
einsehbar: <https://github.com/JulianCafeCoder/iot-magicmirror-gruppe3>.
