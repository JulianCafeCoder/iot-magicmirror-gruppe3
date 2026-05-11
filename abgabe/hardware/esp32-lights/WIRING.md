# ESP32 Verdrahtung – 8 LEDs

## Schema (pro LED)

```
ESP32 GPIO ──── [220 Ω] ──── LED (+) ──── LED (–) ──── GND
```

## Pin-Belegung

| Zimmer         | Taste | GPIO | Breadboard-Spalte |
|----------------|-------|------|-------------------|
| Wohnzimmer     | 1     | 16   | z.B. E1           |
| Küche          | 2     | 17   | E2                |
| Schlafzimmer   | 3     | 18   | E3                |
| Bad            | 4     | 19   | E4                |
| Kinderzimmer   | 5     | 21   | E5                |
| Arbeitszimmer  | 6     | 22   | E6                |
| Flur           | 7     | 23   | E7                |
| Keller         | 8     | 4    | D4 / E8           |

## Hinweise

- ESP32 arbeitet mit **3.3 V** → 220 Ω Vorwiderstand ist ausreichend
- Kurzes LED-Bein (Kathode / –) immer an **GND**
- Alle GND-Pins des ESP32 sind gleichwertig
