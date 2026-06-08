#pragma once

// ── WiFi ────────────────────────────────────────────────────────────────────
// Cambia estos valores por los de tu red
#define WIFI_SSID     "Familia_OG"
#define WIFI_PASSWORD "Jose.2603"

// ── MQTT broker ─────────────────────────────────────────────────────────────
// IP de tu PC en la red local. Para saberla: ejecuta "ipconfig" en Windows
// y busca "Dirección IPv4" de la interfaz WiFi o Ethernet.
#define MQTT_HOST     "192.168.100.177"
#define MQTT_PORT     1883
#define DEVICE_ID     "vg-proto-001"

// ── Pines ───────────────────────────────────────────────────────────────────
#define GPS_RX_PIN    16   // ESP32 GPIO16 → GPS TX
#define GPS_TX_PIN    17   // ESP32 GPIO17 → GPS RX
#define RELAY_PIN     26   // ESP32 GPIO26 → IN del módulo relé
