/**
 * MagicMirror — ESP32 Lichtsteuerung
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Aufgabe:
 *   Acht LEDs schalten, je nachdem was über MQTT als Befehl reinkommt.
 *
 * Wie spricht der Spiegel mit uns?
 *
 *   [MagicMirror Modul]
 *         │ publish "ON" / "OFF"
 *         ▼
 *   home/lights/N/set     ──────►  Mosquitto-Broker  ◄──────  WIR (subscribe)
 *                                       ▲
 *                                       │ publish (Bestätigung mit retain=true)
 *   home/lights/N/status                │
 *
 *   Der MagicMirror schickt also einen Befehl an `home/lights/N/set`.
 *   Wir lesen ihn, schalten die LED, und melden auf `home/lights/N/status`
 *   den neuen Zustand zurück — mit retain=true, sodass der Broker sich den
 *   letzten Stand merkt. So weiß auch ein neu verbundener Client sofort,
 *   welche LEDs gerade an sind.
 *
 * Benötigte Arduino-Libraries (Library Manager):
 *   - PubSubClient  (Nick O'Leary)
 *   - WiFi          (im ESP32-Core enthalten)
 *
 * Verdrahtung (Details siehe WIRING.md):
 *   Jede LED hängt mit langem Bein an einem GPIO, mit kurzem über 220 Ω an GND.
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ── Konfiguration — hier anpassen ─────────────────────────────────────────────

const char* WIFI_SSID = "FES-SuS";          // WLAN-Name (SSID)
const char* WIFI_PASS = "SuS-WLAN!Key24";   // WLAN-Passwort

// IP-Adresse des Raspberry Pi (= MQTT-Broker)
// Auf dem Pi rausfinden mit:   hostname -I
const char* MQTT_HOST = "10.93.131.153";
const int   MQTT_PORT = 1883;
const char* MQTT_ID   = "esp32-lights";     // Client-ID am Broker (muss eindeutig sein)

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
//  Keller            8       GPIO  4   220 Ω
//
//  Schema pro LED:
//    ESP32-GPIO ──── 220Ω ──── LED(+) ──── LED(–) ──── GND
//
// ─────────────────────────────────────────────────────────────────────────────

// Array-Index = LED-Nummer minus 1.
// Beispiel: LED_PINS[0] ist die LED "Wohnzimmer" (Nr. 1) auf GPIO 16.
const int LED_PINS[8] = {16, 17, 18, 19, 21, 22, 23, 4};

// ── MQTT-Topics ───────────────────────────────────────────────────────────────

// Wildcard-Abo: "+" matcht GENAU einen Pfad-Abschnitt.
// → home/lights/1/set, home/lights/2/set, ... alle landen im selben Callback.
const char* TOPIC_SUB = "home/lights/+/set";

// ── Globale Objekte ───────────────────────────────────────────────────────────

WiFiClient   wifiClient;         // unterliegender TCP-Stream
PubSubClient mqtt(wifiClient);   // MQTT-Schicht obendrauf

// ── Setup (wird einmal beim Boot ausgeführt) ──────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Lichtsteuerung ===");

  // Alle 8 GPIO-Pins als Ausgang konfigurieren und zunächst LOW = aus.
  for (int i = 0; i < 8; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }

  connectWifi();

  // MQTT-Konfiguration: Server, Callback für eingehende Nachrichten,
  // Puffergröße (Default ist nur 128 Byte → reicht, aber sicherheitshalber 256).
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(256);
}

// ── Loop (wird endlos wiederholt) ─────────────────────────────────────────────

void loop() {
  // Falls Verbindung weg ist (z. B. Broker neu gestartet) → neu verbinden
  if (!mqtt.connected()) connectMqtt();
  // PubSubClient ist single-threaded — wir müssen regelmäßig loop() rufen,
  // damit es eingehende Nachrichten verarbeitet und Keepalives sendet.
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

// ── MQTT verbinden + Topic abonnieren ─────────────────────────────────────────

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.printf("MQTT: verbinde mit %s:%d ...", MQTT_HOST, MQTT_PORT);
    if (mqtt.connect(MQTT_ID)) {
      Serial.println(" OK");
      mqtt.subscribe(TOPIC_SUB);
      Serial.println("MQTT: abonniert auf " + String(TOPIC_SUB));
    } else {
      // mqtt.state() gibt einen numerischen Fehlercode zurück, siehe PubSubClient.h
      Serial.printf(" Fehler (rc=%d), retry in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}

// ── Callback: eine Nachricht ist eingetroffen ─────────────────────────────────
//
// topic    = z. B. "home/lights/3/set"
// payload  = Roh-Bytes, NICHT null-terminiert!
// length   = Länge der Payload
//
void onMqttMessage(char* topic, byte* payload, unsigned int length) {

  // Payload-Bytes in einen Arduino-String wandeln (manuell, weil nicht 0-terminiert)
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  // Aus dem Topic die LED-Nummer extrahieren.
  // "home/lights/" ist 12 Zeichen → ab Index 12 steht die Nummer.
  // lastIndexOf('/') findet den Schrägstrich vor "set" → bis dahin substring.
  String topicStr(topic);
  String numStr = topicStr.substring(12, topicStr.lastIndexOf('/'));
  int lightNum = numStr.toInt();

  if (lightNum < 1 || lightNum > 8) {
    Serial.printf("Unbekannte Lichtnummer: %d\n", lightNum);
    return;
  }

  // LED schalten: "ON" → HIGH, alles andere → LOW
  bool on = (msg == "ON");
  int pin = LED_PINS[lightNum - 1];
  digitalWrite(pin, on ? HIGH : LOW);

  Serial.printf("Licht %d (%s) → %s\n",
                lightNum, getRoomName(lightNum), on ? "AN" : "AUS");

  // Status zurück an den Broker — mit retain=true, damit der Stand nach
  // einem Reconnect sofort wieder bekannt ist.
  String statusTopic = "home/lights/" + String(lightNum) + "/status";
  mqtt.publish(statusTopic.c_str(), msg.c_str(), true);
}

// ── Hilfsfunktion: Zimmername zur Nummer (nur fürs Logging) ──────────────────

const char* getRoomName(int n) {
  const char* names[] = {
    "Wohnzimmer", "Küche", "Schlafzimmer", "Bad",
    "Kinderzimmer", "Arbeitszimmer", "Flur", "Keller"
  };
  return (n >= 1 && n <= 8) ? names[n - 1] : "?";
}
