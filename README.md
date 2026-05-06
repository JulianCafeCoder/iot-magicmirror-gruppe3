# MagicMirror² – Eigener Setup

Dieses Repository ist ein angepasstes [MagicMirror²](https://magicmirror.builders)-Projekt mit profilbasierter Konfiguration, Docker-Unterstützung für den Raspberry Pi und selbst entwickelten Modulen für Lichtsteuerung, Energie-Dashboard und mehr.

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#voraussetzungen)
2. [Schnellstart (lokale Entwicklung)](#schnellstart-lokale-entwicklung)
3. [Konfiguration: profile.js](#konfiguration-profilejs)
4. [Nutzungsmodi](#nutzungsmodi)
5. [Docker / Raspberry Pi](#docker--raspberry-pi)
6. [Kiosk-Modus](#kiosk-modus)
7. [Seiten-Navigation](#seiten-navigation)
8. [Eigene Module](#eigene-module)
9. [Hardware: ESP32-Lichtsteuerung](#hardware-esp32-lichtsteuerung)
10. [Neue Seiten hinzufügen](#neue-seiten-hinzufügen)

---

## Voraussetzungen

| Komponente | Version / Hinweis |
|---|---|
| Node.js | 22 (LTS) |
| npm | kommt mit Node.js |
| Docker + Docker Compose | nur für Pi-Betrieb nötig |
| MQTT-Broker (Mosquitto) | für `MMM-LightSwitches` |
| PostgreSQL | für `MMM-EnergyDashboard` |

---

## Schnellstart (lokale Entwicklung)

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Profil anlegen (einmalig)
cp config/profile.example.js config/profile.js
# Dann profile.js nach Bedarf anpassen (siehe unten)

# 3. MagicMirror starten
npm start
```

Der Browser öffnet sich automatisch unter `http://localhost:8081`.

---

## Konfiguration: profile.js

Die Datei `config/profile.js` ist **gerätespezifisch** und nicht im Git enthalten. Sie steuert den Nutzungsmodus, den Standort und das Seiten-Timing.

```bash
cp config/profile.example.js config/profile.js
```

Inhalt der Datei:

```js
module.exports = {
  // "business" | "private" | "developer"
  USAGE_TYPE: "business",

  // Koordinaten für das Wettermodul
  LOCATION: {
    lat:  48.1351,
    lon:  11.5820,
    name: "München",
  },

  // Wie lange jede Seite angezeigt wird (Millisekunden)
  PAGE_TIMING_MS: 15000,
};
```

Fehlt die Datei, startet MagicMirror mit den Standardwerten (`business`, München, 15 s).

---

## Nutzungsmodi

| Modus | Angezeigte Seiten |
|---|---|
| `business` | Haupt-Dashboard (Uhr, Wetter, Kalender, News) + Scrum Board |
| `private` | Haupt-Dashboard + persönlicher Kalender + To-Do-Liste |
| `developer` | **Nur** die Seiten aus `modules/developer/` (kein Haupt-Dashboard) |

Der Modus wird in `config/profile.js` über `USAGE_TYPE` gesetzt.

---

## Docker / Raspberry Pi

Das Projekt läuft auf dem Raspberry Pi als Docker-Container im Server-Only-Modus. Der Browser auf dem Pi lädt die Oberfläche von `localhost:8081`.

### Einmalige Einrichtung auf dem Pi

```bash
# 1. profile.js auf dem Pi anlegen
cp config/profile.example.js config/profile.js
nano config/profile.js

# 2. Image bauen und Container starten
docker compose up -d
```

### Nützliche Befehle

```bash
docker compose up -d          # Container starten (im Hintergrund)
docker compose down           # Container stoppen
docker compose logs -f        # Logs live verfolgen
docker compose build --no-cache  # Image neu bauen (nach Code-Änderungen)
```

**Hinweis:** `network_mode: host` im `docker-compose.yml` ist Linux-only (funktioniert auf dem Pi, nicht auf macOS).

---

## Kiosk-Modus

Das Skript `scripts/kiosk.sh` startet Chromium im Vollbild-Kiosk-Modus, sobald der MagicMirror-Server erreichbar ist. Es läuft direkt auf dem Pi-Host (nicht im Container).

### Einrichtung (einmalig auf dem Pi)

```bash
chmod +x scripts/kiosk.sh
```

**Autostart beim Booten** – Option 1: `crontab`

```bash
crontab -e
# Folgende Zeile hinzufügen:
@reboot /home/pi/MagicMirror/scripts/kiosk.sh &
```

**Autostart beim Booten** – Option 2: `.desktop`-Datei

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/kiosk.desktop <<EOF
[Desktop Entry]
Type=Application
Exec=/home/pi/MagicMirror/scripts/kiosk.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=MagicMirror Kiosk
EOF
```

---

## Seiten-Navigation

| Taste | Aktion |
|---|---|
| `→` Pfeil rechts | Nächste Seite |
| `←` Pfeil links | Vorherige Seite |

Die Seiten rotieren außerdem automatisch nach `PAGE_TIMING_MS` Millisekunden (Standard: 15 s). Im `developer`-Modus ist die automatische Rotation deaktiviert.

---

## Eigene Module

Alle selbst entwickelten Module liegen unter `modules/developer/`.

### MMM-LightSwitches

Zeigt 8 Lichtschalter und steuert echte Geräte über MQTT.

- **MQTT-Topics:** `home/lights/<n>/set` (Befehl) / `home/lights/<n>/status` (Zustand)
- **Broker:** wird unter `localhost:1883` erwartet
- **Abhängigkeit:** `mqtt` npm-Paket (in `package.json` des Moduls)

```bash
cd modules/developer/MMM-LightSwitches
npm install
```

### MMM-EnergyDashboard

Visualisiert Solar-, Haus-, Batterie- und Netzwerte aus einer PostgreSQL-Datenbank.

**Datenbank einrichten (einmalig):**

```bash
psql -U <user> -d <datenbank> -f modules/developer/MMM-EnergyDashboard/schema.sql
```

**Abhängigkeit installieren:**

```bash
cd modules/developer/MMM-EnergyDashboard
npm install
```

Die Datenbankverbindung wird im Modul konfiguriert. Standard-Host: `10.93.143.200:5432`.

### MMM-ServiceStatus

Prüft alle 30 Sekunden, ob folgende Dienste erreichbar sind:

| Service | Typ | Adresse |
|---|---|---|
| MM Backend | intern | – |
| MM Frontend | TCP | localhost:8081 |
| Datenbank | TCP | 10.93.143.200:5432 |
| MQTT Broker | TCP | localhost:1883 |
| Internet | HTTPS | 1.1.1.1 |

### MMM-GitInfo

Zeigt Informationen über das lokale Git-Repository (Branch, letzter Commit, Status).

### Weitere Module

| Modul | Beschreibung |
|---|---|
| `MMM-Launcher` | App-/Link-Starter für den Developer-Modus |
| `MMM-Dice` | Würfel-Modul |
| `MMM-Notes` | Notizen-Modul |
| `MMM-Stopwatch` | Stoppuhr |
| `MMM-Timer` | Timer |

---

## Hardware: ESP32-Lichtsteuerung

Der Quellcode für die ESP32-Firmware liegt unter `hardware/esp32-lights/`.

| Datei | Inhalt |
|---|---|
| `esp32-lights.ino` | Arduino-Sketch (MQTT-Client, Lichtsteuerung) |
| `platformio.ini` | PlatformIO-Projektkonfiguration |
| `WIRING.md` | Verdrahtungsplan |

**Wichtig:** Zugangsdaten (WLAN, MQTT) werden in einer `config.h` gepflegt, die **nicht** im Git liegt (in `.gitignore` eingetragen). Vorlage anlegen und anpassen:

```bash
cp hardware/esp32-lights/config.h.example hardware/esp32-lights/config.h
```

---

## Neue Seiten hinzufügen

1. Öffne `config/config.js`
2. Trage einen neuen Eintrag im gewünschten Abschnitt (`shared`, `business`, `private` oder `developer`) ein:

```js
{
  pageClass: "biz-meine-seite",   // eindeutige CSS-Klasse
  modules: [
    {
      module: "mein-modul",
      position: "top_left",
      header: "Mein Modul",
      config: { /* ... */ }
    }
  ]
}
```

3. MagicMirror neu starten – die neue Seite erscheint automatisch in der Rotation.

**Regeln:**
- `pageClass` muss einmalig und eindeutig sein (z. B. `biz-analytics`, `priv-fitness`)
- Module im `developer`-Abschnitt müssen unter `modules/developer/<MMM-Name>/` liegen
