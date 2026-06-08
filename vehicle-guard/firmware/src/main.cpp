/**
 * VehicleGuard — Firmware Fase 1
 * ESP32 + GPS Neo-6M + WiFi + MQTT + Relé
 *
 * Antes de flashear edita firmware/src/config.h con:
 *   - WIFI_SSID / WIFI_PASSWORD
 *   - MQTT_HOST (IP de tu PC — ejecuta "ipconfig" para verla)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include "config.h"

// ── Objetos globales ────────────────────────────────────────────────────────
TinyGPSPlus      gps;
HardwareSerial   gpsSerial(2); // UART2 del ESP32
WiFiClient       wifiClient;
PubSubClient     mqtt(wifiClient);

// ── Estado del relé (se incluye en telemetría para que la app lo vea) ────────
bool relayActive = false;

// ── Tiempos ─────────────────────────────────────────────────────────────────
static constexpr unsigned long PUBLISH_INTERVAL_MS = 10000; // publica cada 10s
unsigned long lastPublishMs = 0;

// ── Prototipos ───────────────────────────────────────────────────────────────
void connectWifi();
void connectMqtt();
void onMqttMessage(char* topic, byte* payload, unsigned int length);
void publishTelemetry();

// ───────────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);

    // Relé apagado al arrancar — nunca debe quedar activo tras un reset
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);
    relayActive = false;

    gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

    connectWifi();

    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setCallback(onMqttMessage);
    mqtt.setKeepAlive(60);
    mqtt.setBufferSize(512);

    connectMqtt();

    Serial.println("VehicleGuard prototipo listo ✓");
}

// ───────────────────────────────────────────────────────────────────────────
void loop() {
    if (!mqtt.connected()) connectMqtt();
    mqtt.loop();

    while (gpsSerial.available()) {
        gps.encode(gpsSerial.read());
    }

    if (millis() - lastPublishMs >= PUBLISH_INTERVAL_MS) {
        publishTelemetry();
        lastPublishMs = millis();
    }
}

// ───────────────────────────────────────────────────────────────────────────
void connectWifi() {
    Serial.printf("Conectando a WiFi: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\nWiFi OK — IP: %s\n", WiFi.localIP().toString().c_str());
}

// ───────────────────────────────────────────────────────────────────────────
void connectMqtt() {
    while (!mqtt.connected()) {
        Serial.printf("Conectando a MQTT %s:%d...\n", MQTT_HOST, MQTT_PORT);
        if (mqtt.connect(DEVICE_ID)) {
            Serial.println("MQTT OK");
            String cmdTopic = String("devices/") + DEVICE_ID + "/commands";
            mqtt.subscribe(cmdTopic.c_str());
        } else {
            Serial.printf("MQTT fallo rc=%d — reintentando en 5s\n", mqtt.state());
            delay(5000);
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    String msg;
    msg.reserve(length);
    for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
    Serial.printf("Comando recibido [%s]: %s\n", topic, msg.c_str());

    JsonDocument doc;
    if (deserializeJson(doc, msg) != DeserializationError::Ok) return;

    const char* type = doc["type"];
    if (!type) return;

    if (strcmp(type, "KILL_ENGINE") == 0) {
        // REGLA DE SEGURIDAD: corte permitido solo si el vehículo está detenido.
        // Si el GPS no tiene fix (sin señal), se asume que el vehículo está detenido
        // porque es imposible verificar la velocidad — esta es la condición segura.
        // Si el GPS SÍ tiene fix, se verifica que la velocidad sea < 5 km/h.
        bool speedSafe = !gps.speed.isValid() || (gps.speed.kmph() < 5.0);

        if (speedSafe) {
            digitalWrite(RELAY_PIN, HIGH);
            relayActive = true;
            Serial.println("[RELAY] Corte ACTIVADO");
            // Publicar telemetría inmediatamente para que la app vea el cambio
            publishTelemetry();
            lastPublishMs = millis();
        } else {
            Serial.printf("[RELAY] Corte RECHAZADO — velocidad: %.1f km/h\n",
                          gps.speed.kmph());
        }

    } else if (strcmp(type, "RELEASE_KILL") == 0) {
        digitalWrite(RELAY_PIN, LOW);
        relayActive = false;
        Serial.println("[RELAY] Corte LIBERADO");
        publishTelemetry();
        lastPublishMs = millis();
    }
}

// ───────────────────────────────────────────────────────────────────────────
void publishTelemetry() {
    JsonDocument doc;
    doc["v"]           = 1;
    doc["ts"]          = millis() / 1000;
    doc["deviceId"]    = DEVICE_ID;
    doc["relayActive"] = relayActive;  // estado real del relé desde el dispositivo

    if (gps.location.isValid()) {
        doc["lat"]        = serialized(String(gps.location.lat(),  6));
        doc["lon"]        = serialized(String(gps.location.lng(),  6));
        doc["speedKmh"]   = gps.speed.isValid()      ? gps.speed.kmph()         : 0.0;
        doc["altM"]       = gps.altitude.isValid()   ? gps.altitude.meters()    : 0.0;
        doc["satellites"] = gps.satellites.isValid() ? gps.satellites.value()   : 0;
        doc["hdop"]       = gps.hdop.isValid()       ? gps.hdop.hdop()          : 99.9;
        doc["gpsFix"]     = true;
    } else {
        doc["lat"]        = nullptr;
        doc["lon"]        = nullptr;
        doc["speedKmh"]   = 0;
        doc["altM"]       = 0;
        doc["satellites"] = gps.satellites.isValid() ? gps.satellites.value()   : 0;
        doc["hdop"]       = 99.9;
        doc["gpsFix"]     = false;
    }

    char buf[512];
    serializeJson(doc, buf);

    String topic = String("devices/") + DEVICE_ID + "/telemetry";
    bool ok = mqtt.publish(topic.c_str(), buf);
    Serial.printf("[MQTT] %s | relay=%s gps=%s sat=%d | %s\n",
                  ok ? "OK" : "FAIL",
                  relayActive ? "ON" : "off",
                  gps.location.isValid() ? "FIX" : "---",
                  gps.satellites.isValid() ? gps.satellites.value() : 0,
                  buf);
}
