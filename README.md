# MagicMirror² – Gruppe 3 (FES Wiesbaden)

> **Schulprojekt IoT – Fachschule für Elektrotechnik und Informatik Wiesbaden**
> Dieses Repository enthält das vollständige MagicMirror²-Projekt von Gruppe 3.

---

## Team

| Name   | GitHub          | Rolle                                      |
|--------|-----------------|-------------------------------------------|
| Julian | JulianCafeCoder | Architektur, Konfiguration, Module (B2C/Dev) |
| Peter  | –               | Framework-Basis, Infrastruktur             |
| Joel   | –               | MMM-RezeptListe                            |

---

## Was ist MagicMirror²?

[MagicMirror²](https://magicmirror.builders) ist ein Open-Source-Framework für smarte Spiegel und Info-Displays auf Basis von Node.js + Electron. Wir haben es auf einem **Raspberry Pi** betrieben und mit eigenen Modulen erweitert.

---

## Projektübersicht – Eigene Entwicklungen

Alle selbst entwickelten Module sind in `modules/` unterteilt nach Zielgruppe:

### B2B-Module (`modules/B2B/`)

| Modul                 | Beschreibung                                                                 |
|-----------------------|------------------------------------------------------------------------------|
| **MMM-ScrumBoard**    | Digitales Scrum-Board mit Spalten (To-Do / In Progress / Done), Aufgaben per Tastatur steuerbar |
| **MMM-FinanceDashboard** | Finanz-Übersicht (Kurse, Portfolio)                                      |

### B2C-Module (`modules/B2C/`)

| Modul                 | Beschreibung                                                                 |
|-----------------------|------------------------------------------------------------------------------|
| **MMM-TodoList**      | Interaktive To-Do-Liste mit PostgreSQL-Backend; Aufgaben browsen, hinzufügen, abhaken, löschen – alles per Tastatur, User-ID-basiert gefiltert |
| **MMM-Stundenplan**   | Schulstundenplan aus PostgreSQL-Datenbank, automatisch nach Woche gefiltert  |
| **MMM-RezeptListe**   | Rezeptsammlung – Anzeige von Rezepten mit Zutaten und Anleitung              |

### Developer-Module (`modules/developer/`)

| Modul                    | Beschreibung                                                              |
|--------------------------|---------------------------------------------------------------------------|
| **MMM-CompanyCalendar**  | 4-Wochen-Vollbild-Kalender mit Mitarbeiter-Legende, Datenbankanbindung    |
| **MMM-EnergyDashboard**  | Echtzeit-Visualisierung von Solar-, Haus-, Batterie- und Netzwerten aus PostgreSQL |
| **MMM-LightSwitches**    | 8 physische Lichtschalter über MQTT; steuert echte ESP32-Hardware         |
| **MMM-Dictation**        | Spracheingabe: MediaRecorder → Whisper (Groq API) → LLaMA → Aktionsbefehl |
| **MMM-ServiceStatus**    | Überwacht alle 30 s: MM-Backend, Datenbank, MQTT-Broker, Internet         |
| **MMM-GitInfo**          | Zeigt Branch, letzten Commit und Git-Status des laufenden Projekts        |
| **MMM-Launcher**         | App-/Link-Starter für den Developer-Modus                                 |
| **MMM-Notes**            | Notizen-Modul                                                             |
| **MMM-Stopwatch**        | Stoppuhr                                                                  |
| **MMM-Timer**            | Countdown-Timer                                                           |
| **MMM-Dice**             | Würfel-Animation                                                          |

---

## Technische Highlights

- **Profilbasierte Konfiguration** – eine `config/profile.js` steuert Modus (`business` / `private` / `developer`), Standort und Seiten-Timing; keine Änderung an der Hauptkonfiguration nötig
- **Mehrseitiges Layout** – Navigation per Pfeiltasten, automatische Rotation, Seiten-Indikator
- **PostgreSQL-Integration** – mehrere Module teilen eine gemeinsame Datenbankinstanz (`gruppe3@10.93.143.200:5432`); Schema-Migration-Skripte inklusive
- **MQTT + ESP32-Hardware** – `MMM-LightSwitches` kommuniziert über MQTT mit selbst entwickelter ESP32-Firmware (`hardware/esp32-lights/`)
- **KI-Sprachsteuerung** – `MMM-Dictation` nutzt Groq (Whisper + LLaMA) für Sprachbefehle in Echtzeit
- **Docker-Deployment** – `Dockerfile` + `docker-compose.yml` für den Pi-Betrieb; Chromium-Kiosk-Modus via `scripts/kiosk.sh`
- **Helles/Dunkles Theme** – umschaltbar über `DISPLAY_MODE` in `profile.js`

---

## Architektur

```
Browser (Electron / Chromium auf Pi)
        │
        │  HTTP / WebSocket
        ▼
  MagicMirror²-Server (Node.js :8081)
        │
   ┌────┴────────────────────────────────┐
   │  Modul-Node-Helpers (serverseitig)  │
   │  ┌──────────────┐  ┌─────────────┐ │
   │  │  PostgreSQL  │  │  MQTT-Broker│ │
   │  │  (Kalender,  │  │  (Lichter)  │ │
   │  │  Todo, etc.) │  └──────┬──────┘ │
   │  └──────────────┘         │        │
   └───────────────────────────┼────────┘
                               │ MQTT
                          ESP32-Hardware
                         (Lichtschalter)
```

---

## Seiten-Navigation

| Taste | Aktion |
|-------|--------|
| `→` Pfeil rechts | Nächste Seite |
| `←` Pfeil links | Vorherige Seite |

Automatische Rotation nach `PAGE_TIMING_MS` ms (konfigurierbar). Punkte-Indikator unten zeigt die aktuelle Seite.

---

## Nutzungsmodi

| Modus | Angezeigte Module |
|-------|-------------------|
| `business` | Uhr, Wetter, News, Firmenkalender, Scrum-Board |
| `private` | Uhr, Wetter, News, To-Do-Liste, Stundenplan, Rezepte |
| `developer` | Energie-Dashboard, Lichtschalter, Service-Status, Git-Info, Dictation, Launcher, Timer, etc. |

---

## Projekt lokal starten

### Voraussetzungen

| Komponente | Version |
|---|---|
| Node.js | 22 (LTS) |
| PostgreSQL | optional (Module fallen auf Demo-Daten zurück) |
| MQTT-Broker | optional (nur für MMM-LightSwitches) |

### Schnellstart

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Profil anlegen
cp config/profile.example.js config/profile.js
# USAGE_TYPE auf "business", "private" oder "developer" setzen

# 3. Starten
npm start
```

Öffnet sich automatisch unter `http://localhost:8081`.

### Datenbankschemas einrichten (optional)

```bash
psql -U gruppe3 -d postgres -f modules/developer/MMM-CompanyCalendar/schema.sql
psql -U gruppe3 -d postgres -f modules/B2C/MMM-TodoList/schema.sql
psql -U gruppe3 -d postgres -f modules/B2C/MMM-Stundenplan/schema.sql
psql -U gruppe3 -d postgres -f modules/developer/MMM-EnergyDashboard/schema.sql
```

---

## Raspberry Pi / Docker

```bash
# Einmalig auf dem Pi
cp config/profile.example.js config/profile.js
nano config/profile.js

# Container starten
docker compose up -d

# Kiosk-Modus (Chromium Vollbild)
chmod +x scripts/kiosk.sh
# In crontab: @reboot /home/pi/MagicMirror/scripts/kiosk.sh &
```

---

## Hardware: ESP32-Lichtsteuerung

Quellcode unter `hardware/esp32-lights/`:

| Datei | Inhalt |
|---|---|
| `esp32-lights.ino` | Arduino-Sketch (MQTT-Client, 8 Relais) |
| `platformio.ini` | PlatformIO-Konfiguration |
| `WIRING.md` | Verdrahtungsplan |
| `config.h.example` | Vorlage für WLAN/MQTT-Zugangsdaten |

MQTT-Topics: `home/lights/<n>/set` (Befehl) / `home/lights/<n>/status` (Zustand)

---

## Repository-Struktur

```
MagicMirror/
├── config/
│   ├── config.js            # Haupt-Konfiguration (Seiten, Module)
│   └── profile.example.js   # Vorlage für gerätespezifische Einstellungen
├── modules/
│   ├── B2B/                 # Business-Module (Scrum, Finance)
│   ├── B2C/                 # Consumer-Module (Todo, Stundenplan, Rezepte)
│   └── developer/           # Developer/IoT-Module (Energy, Lights, Dictation, …)
├── hardware/
│   └── esp32-lights/        # ESP32-Firmware für Lichtsteuerung
├── scripts/
│   └── kiosk.sh             # Chromium-Kiosk-Autostart
├── Dockerfile
└── docker-compose.yml
```
