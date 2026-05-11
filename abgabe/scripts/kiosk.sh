#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  kiosk.sh — startet Chromium im Vollbild-Modus auf dem Raspberry Pi
# ─────────────────────────────────────────────────────────────────────────────
#
#  Was tut dieses Skript?
#    1. Warten, bis der MagicMirror-Server auf Port 8081 antwortet.
#    2. Bildschirmschoner / Energiesparen ausschalten — sonst geht der
#       Monitor nach ein paar Minuten in den Standby.
#    3. Chromium ohne Browserleiste starten und auf die Mirror-Seite zeigen.
#
#  Wo wird es aufgerufen?
#    Wir tragen es entweder in ~/.config/autostart/kiosk.desktop ein
#    oder in die Crontab als "@reboot /pfad/zu/kiosk.sh".
#    So läuft der Spiegel ohne menschliches Zutun, sobald der Pi bootet.
#
#  Wichtig: läuft auf dem PI selbst (nicht im Docker-Container)!
# ─────────────────────────────────────────────────────────────────────────────

set -e   # Bricht das Skript ab, falls ein Befehl mit Fehler endet

# ── 1) Auf den MagicMirror-Server warten ──────────────────────────────────────
echo "[kiosk] Warte auf MagicMirror (Port 8081)..."
# curl -s = silent, -f = bei HTTP-Fehler fail-exit
# Die Schleife wiederholt sich alle 2 s, bis localhost:8081 antwortet.
until curl -sf http://localhost:8081 > /dev/null 2>&1; do
  sleep 2
done

echo "[kiosk] Server bereit – starte Chromium"

# ── 2) Energiesparen / Bildschirmschoner deaktivieren ────────────────────────
# xset gehört zum X-Server (X11). Auf Wayland muss man das anders machen
# (z. B. mit dem Compositor-eigenen Tool).
xset s off            # Screensaver aus
xset -dpms            # DPMS aus (Monitor schaltet nicht in Standby)
xset s noblank        # Bildschirm nicht in Schwarz ausblenden

# ── 3) Chromium im Kiosk-Modus starten ───────────────────────────────────────
# Flags-Erklärung:
#   --kiosk                       Vollbild, keine Adressleiste, keine Tabs
#   --noerrdialogs                Crash-Dialoge unterdrücken
#   --disable-infobars            "Chromium möchte..."-Banner weg
#   --no-first-run                Begrüßungs-Wizard überspringen
#   --disable-session-crashed-bubble
#                                 nach Stromausfall nicht nachfragen
#   --disable-restore-session-state
#                                 immer frisch starten, keine Tabs wiederherstellen
#   --disable-translate
#   --disable-features=TranslateUI
#                                 "Diese Seite übersetzen?"-Banner weg
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --disable-translate \
  --disable-features=TranslateUI \
  http://localhost:8081
