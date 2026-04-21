/**
 * MagicMirror – ESP32 Lichtsteuerung
 *
 * Verbindet sich mit WLAN und dem MQTT-Broker auf dem Raspberry Pi.
 * Lauscht auf home/lights/N/set (ON / OFF) und schaltet die entsprechende LED.
 * Bestätigt den neuen Zustand auf home/lights/N/status.
 *
 * Benötigte Libraries (Arduino Library Manager):
 *   - PubSubClient  (Nick O'Leary)
 *
 * Verdrahtung: siehe WIRING-Kommentar unten
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ── Konfiguration – hier anpassen ─────────────────────────────────────────────

const char* WIFI_SSID = "FES-SuS";
const char* WIFI_PASS = "SuS-WLAN!Key24";

// IP-Adresse des Raspberry Pi (MQTT-Broker)
// Herausfinden mit: hostname -I   auf dem Pi
const char* MQTT_HOST = "10.93.131.37";
const int   MQTT_PORT = 1883;
const char* MQTT_ID   = "esp32-lights";

// ── Verdrahtung (WIRING) ─────────────────────────────────────────────────────
//
//  Zimmer          LED Nr.   GPIO    Widerstand
//  Wohnzimmer        1       GPIO 16   220 Ω
//  Küche             2       GPIO 17   220 Ω
//  Schlafzimmer      3       GPIO 18   220 Ω
//  Bad               4       GPIO 19   220 Ω
//  Kinderzimmer      5       GPIO 21   220 Ω
//  Arbeitszimmer     6       GPIO 22   220 Ω
//  Flur              7       GPIO 23   220 Ω
//  Keller            8       GPIO 25   220 Ω
//
//  Schema pro LED:
//    ESP32-GPIO ──── 220Ω ──── LED(+) ──── LED(-) ──── GND
//
// ─────────────────────────────────────────────────────────────────────────────

const int LED_PINS[8] = {16, 17, 18, 19, 21, 22, 23, 25};

// ── MQTT-Topics ───────────────────────────────────────────────────────────────

const char* TOPIC_SUB = "home/lights/+/set";   // Befehle empfangen

// ── Interne Variablen ─────────────────────────────────────────────────────────

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Lichtsteuerung ===");

  // LED-Pins initialisieren
  for (int i = 0; i < 8; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }

  connectWifi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(256);
}

// ── Loop ──────────────────────────────────────────────────────────────────────

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();
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
      mqtt.subscribe(TOPIC_SUB);
      Serial.println("MQTT: abonniert auf " + String(TOPIC_SUB));
    } else {
      Serial.printf(" Fehler (rc=%d), retry in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}

// ── Nachricht empfangen ───────────────────────────────────────────────────────

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Payload in String umwandeln
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  // Lichtnummer aus Topic extrahieren: home/lights/N/set
  // "home/lights/" = 12 Zeichen, Nummer beginnt bei Index 12
  String topicStr(topic);
  String numStr = topicStr.substring(12, topicStr.lastIndexOf('/'));
  int lightNum = numStr.toInt();

  if (lightNum < 1 || lightNum > 8) {
    Serial.printf("Unbekannte Lichtnummer: %d\n", lightNum);
    return;
  }

  // LED schalten
  bool on = (msg == "ON");
  int pin = LED_PINS[lightNum - 1];
  digitalWrite(pin, on ? HIGH : LOW);

  Serial.printf("Licht %d (%s) → %s\n", lightNum, getRoomName(lightNum), on ? "AN" : "AUS");

  // Status zurückmelden
  String statusTopic = "home/lights/" + String(lightNum) + "/status";
  mqtt.publish(statusTopic.c_str(), msg.c_str(), true);  // retain = true
}

// ── Raumname (nur für Serial-Monitor) ────────────────────────────────────────

const char* getRoomName(int n) {
  const char* names[] = {
    "Wohnzimmer", "Küche", "Schlafzimmer", "Bad",
    "Kinderzimmer", "Arbeitszimmer", "Flur", "Keller"
  };
  return (n >= 1 && n <= 8) ? names[n - 1] : "?";
}
