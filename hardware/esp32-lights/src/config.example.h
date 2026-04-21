/**
 * ESP32 Lichtsteuerung – Konfigurationsvorlage
 *
 * 1. Diese Datei kopieren: config.example.h → config.h
 * 2. Werte in config.h anpassen
 * 3. config.h ist in .gitignore – Zugangsdaten bleiben lokal
 */

#pragma once

// ── WLAN ──────────────────────────────────────────────────────────────────────
#define WIFI_SSID  "DEIN_WLAN_NAME"
#define WIFI_PASS  "DEIN_WLAN_PASSWORT"

// ── MQTT-Broker ───────────────────────────────────────────────────────────────
// Lokal (Mac):       IP des Macs im Netzwerk, z.B. 10.93.131.153
// Auf dem Pi:        IP des Raspberry Pi,     z.B. 10.93.131.37
#define MQTT_HOST  "IP_DES_BROKERS"
#define MQTT_PORT  1883
