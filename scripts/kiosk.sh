#!/usr/bin/env bash
# Startet Chromium im Kiosk-Modus sobald der MagicMirror-Server bereit ist.
# Wird auf dem Raspberry Pi Host ausgeführt (nicht im Container).
#
# Autostart: ~/.config/autostart/kiosk.desktop oder via crontab @reboot

set -e

echo "[kiosk] Warte auf MagicMirror (Port 8081)..."
until curl -sf http://localhost:8081 > /dev/null 2>&1; do
  sleep 2
done

echo "[kiosk] Server bereit – starte Chromium"

# Bildschirm nicht sperren/dimmen
xset s off
xset -dpms
xset s noblank

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
