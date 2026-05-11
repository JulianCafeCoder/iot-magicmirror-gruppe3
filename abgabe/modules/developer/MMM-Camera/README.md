# MMM-Camera

USB-Webcam + Gesichtserkennung (Face Detection) für MagicMirror.

Läuft komplett im Browser mit [face-api.js](https://github.com/vladmandic/face-api).
Es wird kein Python und keine Cloud-API benötigt.

## Was es macht

- Greift per `getUserMedia()` auf eine angeschlossene USB-Webcam zu.
- Erkennt Gesichter mit dem TinyFaceDetector-Modell (kein Identifizieren).
- Zeigt optional eine Live-Vorschau mit blauen Boxen um erkannte Gesichter.
- Sendet die Notifications `FACE_DETECTED` (mit `{ count }`), `FACES_CLEAR`
  und die Standard-Notification `USER_PRESENCE` an andere Module
  (z. B. um den Spiegel-Inhalt sichtbar zu schalten).

## Konfiguration

```js
{
  module: "developer/MMM-Camera",
  position: "bottom_right",
  config: {
    detectionIntervalMs: 500,   // Intervall zwischen Erkennungen
    minConfidence: 0.5,         // 0–1, höher = strenger
    inputSize: 224,             // 128/224/320/416/512 – kleiner = schneller
    showPreview: true,          // Live-Bild im Spiegel anzeigen
    previewWidth: 240,          // Breite der Vorschau in Pixel
    drawDetections: true,       // Kästchen um Gesichter
  }
}
```

## Setup auf dem Raspberry Pi

1. **Webcam anschließen** (UVC-kompatibel — Logitech C270 o. ä. funktionieren plug-and-play).
2. Prüfen, ob die Cam erkannt wurde: `lsusb` und `v4l2-ctl --list-devices`.
3. **Electron-Berechtigung**: Beim ersten Start fragt Electron nach Kamera­zugriff.
   Falls die Berechtigung nicht angefragt wird oder verweigert wurde, in der
   MagicMirror `config.js` setzen:
   ```js
   electronOptions: { webPreferences: { autoplayPolicy: "no-user-gesture-required" } }
   ```
4. Im **Server-only-Modus** (Docker / Pi mit Chromium-Kiosk) muss Chromium mit
   `--use-fake-ui-for-media-stream` gestartet werden, damit die Cam-Berechtigung
   automatisch erteilt wird. Siehe `scripts/kiosk.sh`.

## Offline-Betrieb (CDN vermeiden)

Standardmäßig werden `face-api.js` und die Modelle vom jsDelivr-CDN geladen.
Falls das Schul-WLAN das blockiert, kannst du beides vendoren:

```bash
mkdir -p modules/developer/MMM-Camera/vendor modules/developer/MMM-Camera/models
curl -L -o modules/developer/MMM-Camera/vendor/face-api.min.js \
  https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.min.js
curl -L -o modules/developer/MMM-Camera/models/tiny_face_detector_model-weights_manifest.json \
  https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/tiny_face_detector_model-weights_manifest.json
curl -L -o modules/developer/MMM-Camera/models/tiny_face_detector_model-shard1 \
  https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/tiny_face_detector_model-shard1
```

Dann in der `config.js`-Sektion des Moduls:

```js
faceApiUrl: "/modules/developer/MMM-Camera/vendor/face-api.min.js",
modelsUrl:  "/modules/developer/MMM-Camera/models/",
```

## Performance

| Pi-Modell | inputSize 128 | inputSize 224 |
|-----------|---------------|---------------|
| Pi 4 (4 GB) | ~8 fps        | ~3 fps        |
| Pi 5        | ~20 fps       | ~10 fps       |

Für reine Anwesenheits­erkennung (FACE_DETECTED-Notification) reicht
`detectionIntervalMs: 1000` problemlos aus.
