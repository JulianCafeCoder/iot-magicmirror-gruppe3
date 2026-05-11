# ESP32 Verdrahtung – HC-SR501 PIR-Bewegungsmelder

## Schema

```
HC-SR501          ESP32
─────────         ──────
VCC      ────►    5V (Vin)
OUT      ────►    GPIO 27
GND      ────►    GND
```

## Pin-Belegung

| HC-SR501 | ESP32     | Hinweis                          |
|----------|-----------|----------------------------------|
| VCC      | 5V / Vin  | PIR braucht 5 V                  |
| OUT      | GPIO 27   | digitaler Ausgang (HIGH = Motion) |
| GND      | GND       | beliebiger GND-Pin               |

## Einstellungen am HC-SR501

Auf der Rückseite des Sensors befinden sich zwei Potis und ein Jumper:

- **Time-Poti** (orange): minimum (gegen den Uhrzeigersinn) — Software übernimmt den Timeout
- **Sensitivity-Poti**: mittlere Stellung
- **Jumper**: auf **H** (retriggerbar) — solange Bewegung erkannt wird, bleibt OUT auf HIGH

## Montage am Spiegel

- Sensor mittig hinter dem Spiegel-Rahmen positionieren
- Erfassungswinkel: ca. 120°, Reichweite bis 7 m
- Aufwärmphase: ~30 s nach dem Einschalten (währenddessen kann er fehlauslösen)
