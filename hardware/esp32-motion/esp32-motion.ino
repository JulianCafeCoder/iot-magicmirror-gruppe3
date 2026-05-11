/**
 * MagicMirror — ESP32 Bewegungsmelder
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Aufgabe:
 *   Einen HC-SR501 PIR-Sensor (Passiv-Infrarot) auslesen und Änderungen
 *   per MQTT melden. Der MagicMirror entscheidet dann, was zu tun ist
 *   (in unserem Fall: schwarzes Overlay über den Spiegel legen / weg).
 *
 * Datenfluss:
 *
 *   [PIR-Sensor] ──HIGH/LOW──► [GPIO 27] ──► WIR
 *                                              │ publish
 *                                              ▼
 *                                  home/motion/status
 *                                  "MOTION" oder "CLEAR"  (retain=true)
 *                                              │
 *                                              ▼
 *                                  Mosquitto-Broker auf dem Pi
 *                                              │
 *                                              ▼
 *                                  [MagicMirror node_helper]
 *                                              │
 *                                              ▼
 *                                  Browser-Modul (MMM-MotionSensor)
 *
 * Wieso retain=true?
 *   Damit ein neu gestarteter MagicMirror SOFORT erfährt, ob aktuell
 *   jemand davor steht, ohne auf die nächste Zustandsänderung warten zu müssen.
 *
 * Wieso publishen wir nur bei Änderungen (Edge-Detection)?
 *   Sonst würden wir mehrmals pro Sekunde dieselbe Nachricht schicken
 *   → Broker und Netzwerk unnötig belastet.
 *
 * Benötigte Libraries:
 *   - PubSubClient  (Nick O'Leary)
 *   - WiFi          (im ESP32-Core enthalten)
 *
 * Verdrahtung: siehe WIRING.md
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ── Konfiguration — hier anpassen ─────────────────────────────────────────────

const char* WIFI_SSID = "FES-SuS";
const char* WIFI_PASS = "SuS-WLAN!Key24";

// MQTT-Broker (Mosquitto auf dem Raspberry Pi)
const char* MQTT_HOST = "10.93.131.153";
const int   MQTT_PORT = 1883;
const char* MQTT_ID   = "esp32-motion";   // muss anders sein als esp32-lights!

// ── Verdrahtung (WIRING) ─────────────────────────────────────────────────────
//
//  HC-SR501  →  ESP32
//  VCC       →  5V (Vin)        ← PIR braucht 5V, nicht 3.3V!
//  OUT       →  GPIO 27
//  GND       →  GND
//
//  Jumper auf "H" (retriggerbar): solange Bewegung erkannt wird, bleibt
//  der OUT-Pin auf HIGH. Das ist genau, was wir wollen.
//
//  Time-Poti auf Minimum (~3 s): wir machen unseren eigenen Timeout
//  später in JavaScript, daher muss der Sensor schnell wieder loslassen.
//
//  Sensitivity-Poti: mittlere Stellung.
//
// ─────────────────────────────────────────────────────────────────────────────

const int PIR_PIN = 27;

// ── MQTT-Topic ────────────────────────────────────────────────────────────────

const char* TOPIC_STATUS = "home/motion/status";

// ── Globale Objekte ───────────────────────────────────────────────────────────

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

// Letzter PIR-Zustand. false = CLEAR, true = MOTION.
// Wir merken ihn uns, um nur bei ECHTEN Zustandswechseln zu publishen.
bool lastState = false;

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Bewegungsmelder ===");

  // PIR-Ausgang ist ein digitaler Pin → als Eingang konfigurieren
  pinMode(PIR_PIN, INPUT);

  connectWifi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(128);
}

// ── Loop ──────────────────────────────────────────────────────────────────────

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();   // MQTT-Keepalive und Reconnect-Handling

  // Aktuellen PIR-Zustand auslesen. HIGH = Bewegung, LOW = keine.
  bool state = (digitalRead(PIR_PIN) == HIGH);

  // Nur bei einer ECHTEN Änderung publishen (Edge-Detection)
  if (state != lastState) {
    lastState = state;
    const char* payload = state ? "MOTION" : "CLEAR";
    Serial.printf("PIR → %s\n", payload);
    if (mqtt.connected()) {
      // retain=true: Broker merkt sich den letzten Wert
      mqtt.publish(TOPIC_STATUS, payload, true);
    }
  }

  // Polling-Pause. 100 ms ist mehr als schnell genug (PIR braucht
  // sowieso eine kurze Ansprechzeit), spart aber CPU/Strom.
  delay(100);
}

// ── WiFi verbinden ────────────────────────────────────────────────────────────

void connectWifi() {
  Serial.printf("WiFi: verbinde mit %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi verbunden. IP: %s\n", WiFi.localIP().toString().c_str());
}

// ── MQTT verbinden ────────────────────────────────────────────────────────────

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.printf("MQTT: verbinde mit %s:%d ...", MQTT_HOST, MQTT_PORT);
    if (mqtt.connect(MQTT_ID)) {
      Serial.println(" OK");
      // Sofort beim Reconnect den aktuell bekannten Zustand publishen,
      // damit der Broker (und damit der MagicMirror) gleich Bescheid weiß.
      mqtt.publish(TOPIC_STATUS, lastState ? "MOTION" : "CLEAR", true);
    } else {
      Serial.printf(" Fehler (rc=%d), retry in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}
