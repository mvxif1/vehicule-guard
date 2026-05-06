# Fase 1 — Prototipo WiFi+GPS: Guía paso a paso

> Objetivo: ESP32 leyendo GPS y publicando ubicación vía MQTT a un backend NestJS local.
> Sin SIM card, sin auto — todo en la mesa de trabajo.

---

## ETAPA 1 — Preparar el ambiente (ya hecho)

- [x] VS Code instalado con extensiones PlatformIO + C/C++
- [x] Node.js instalado
- [x] NestJS CLI instalado
- [x] Proyecto firmware creado en `firmware/`
- [x] Proyecto backend creado en `backend/`
- [ ] Docker Desktop instalado → descargar en https://www.docker.com/products/docker-desktop/

---

## ETAPA 2 — Cuando llegue el hardware

### Paso 1: Verificar que el ESP32 es reconocido por el PC

1. Conecta el ESP32 al PC con cable micro-USB.
2. Abre el Administrador de Dispositivos de Windows (busca "administrador de dispositivos").
3. Busca en "Puertos (COM y LPT)" un dispositivo llamado **CP210x** o **CH340**.
   - Si aparece → el driver ya está instalado, anota el número de puerto (ej: COM5).
   - Si no aparece → instala el driver:
     - CP210x: busca "CP210x USB to UART Bridge VCP Drivers" en Silicon Labs
     - CH340: busca "CH340 driver Windows"
4. Abre VS Code → ícono de PlatformIO (hormiga en el sidebar izquierdo).
5. En PlatformIO Home, ve a **Devices** — deberías ver el ESP32 listado.

---

### Paso 2: Flashear el firmware de prueba (blink)

Antes de conectar cualquier componente, verifica que el ESP32 funciona:

1. Abre la carpeta `firmware/` en VS Code.
2. Reemplaza el contenido de `firmware/src/main.cpp` con:

```cpp
#include <Arduino.h>

void setup() {
    Serial.begin(115200);
    pinMode(2, OUTPUT); // LED interno del ESP32 DevKit
}

void loop() {
    digitalWrite(2, HIGH);
    Serial.println("VehicleGuard alive");
    delay(500);
    digitalWrite(2, LOW);
    delay(500);
}
```

3. Click en el ícono **→ Upload** (flecha derecha) en la barra inferior de VS Code.
4. Espera que compile y flashee (~30 segundos la primera vez).
5. Click en el ícono **Monitor** (enchufe) → deberías ver "VehicleGuard alive" cada 500ms.

**Si funciona: el ESP32 está bien. Continúa al Paso 3.**

---

### Paso 3: Conectar el GPS Neo-6M a la protoboard

El GPS se comunica con el ESP32 por UART (cable de datos serial). Conexión:

```
GPS Neo-6M    →    ESP32 DevKit V1
VCC           →    3.3V  (pin marcado "3V3")
GND           →    GND
TX            →    GPIO 16  (RX2 del ESP32)
RX            →    GPIO 17  (TX2 del ESP32)
```

> ⚠️ El GPS Neo-6M funciona con 3.3V o 5V, pero el ESP32 solo acepta 3.3V en sus pines.
> Conecta VCC del GPS al pin 3V3 del ESP32, no al 5V (VIN).

Usa cables dupont macho-hembra directo entre el módulo GPS y el ESP32 en la protoboard.

---

### Paso 4: Verificar que el GPS responde

Reemplaza `main.cpp` con este test:

```cpp
#include <Arduino.h>
#include <HardwareSerial.h>

HardwareSerial gpsSerial(2); // UART2

void setup() {
    Serial.begin(115200);
    gpsSerial.begin(9600, SERIAL_8N1, 16, 17); // RX=16, TX=17
    Serial.println("Esperando datos GPS...");
}

void loop() {
    while (gpsSerial.available()) {
        char c = gpsSerial.read();
        Serial.print(c);
    }
}
```

Flashea y abre el Monitor. Deberías ver líneas como:
```
$GNGGA,,,,,,0,00,99.99,,,,,,*56
$GNRMC,,V,,,,,,,,,,N*4D
```

Eso es NMEA — el GPS está respondiendo. Al principio no tiene fix (los campos están vacíos).

**Para obtener fix GPS:**
- Lleva el ESP32 + GPS cerca de una ventana que vea el cielo.
- Espera 1-3 minutos (cold start).
- Cuando el LED del Neo-6M pase de parpadeo rápido a lento (1 vez/segundo) → tiene fix.
- Verás coordenadas reales en el monitor.

---

### Paso 5: Conectar el módulo relé

El relé simula el corte de corriente. En el prototipo de mesa, solo encenderá/apagará un LED para demostrar la funcionalidad.

```
Módulo relé   →    ESP32 DevKit V1
VCC           →    5V (pin VIN del ESP32)
GND           →    GND
IN            →    GPIO 26
```

> El módulo relé necesita 5V para operar, no 3.3V. Usa el pin VIN (que es el 5V del USB).

---

### Paso 6: Levantar el broker MQTT local

Necesitas Docker Desktop instalado para este paso.

1. Abre una terminal en la carpeta `backend/`.
2. Ejecuta:
```bash
docker compose up -d
```
3. Verifica que Mosquitto está corriendo:
```bash
docker compose ps
```
Deberías ver `mosquitto` con estado `running`.

4. Prueba el broker con un cliente MQTT (instala MQTT Explorer: https://mqtt-explorer.com/):
   - Host: `localhost`
   - Puerto: `1883`
   - Sin usuario/contraseña
   - Conecta → deberías ver la interfaz sin errores.

---

### Paso 7: Firmware completo — GPS + WiFi + MQTT

Actualiza `firmware/platformio.ini` para agregar las librerías:

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200

lib_deps =
    knolleary/PubSubClient @ ^2.8
    bblanchon/ArduinoJson @ ^7.0.4
    mikalhart/TinyGPSPlus @ ^1.0.3
```

Crea el archivo `firmware/src/config.h`:

```cpp
#pragma once

// WiFi — cambia por tus datos
#define WIFI_SSID     "TU_RED_WIFI"
#define WIFI_PASSWORD "TU_PASSWORD"

// MQTT broker (IP de tu PC en la red local)
// Para saber tu IP: en Windows ejecuta "ipconfig" en la terminal
#define MQTT_HOST     "192.168.1.XXX"
#define MQTT_PORT     1883
#define DEVICE_ID     "vg-proto-001"

// Pines
#define GPS_RX_PIN    16
#define GPS_TX_PIN    17
#define RELAY_PIN     26
```

Reemplaza `firmware/src/main.cpp` con el firmware completo:

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include "config.h"

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL = 10000; // 10 segundos

void connectWifi() {
    Serial.printf("Conectando a WiFi: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\nWiFi OK — IP: %s\n", WiFi.localIP().toString().c_str());
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    String msg;
    for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
    Serial.printf("Comando recibido [%s]: %s\n", topic, msg.c_str());

    JsonDocument doc;
    if (deserializeJson(doc, msg) != DeserializationError::Ok) return;

    const char* type = doc["type"];
    if (strcmp(type, "KILL_ENGINE") == 0) {
        // REGLA DURA: solo cortar si velocidad < 5 km/h
        if (gps.speed.isValid() && gps.speed.kmph() < 5.0) {
            digitalWrite(RELAY_PIN, HIGH);
            Serial.println("RELAY: corte activado");
        } else {
            Serial.println("RELAY: corte RECHAZADO — vehículo en movimiento");
        }
    } else if (strcmp(type, "RELEASE_KILL") == 0) {
        digitalWrite(RELAY_PIN, LOW);
        Serial.println("RELAY: corte liberado");
    }
}

void connectMqtt() {
    while (!mqtt.connected()) {
        Serial.printf("Conectando a MQTT %s:%d...\n", MQTT_HOST, MQTT_PORT);
        if (mqtt.connect(DEVICE_ID)) {
            Serial.println("MQTT OK");
            String cmdTopic = String("devices/") + DEVICE_ID + "/commands";
            mqtt.subscribe(cmdTopic.c_str());
        } else {
            Serial.printf("MQTT fallo, rc=%d — reintentando en 5s\n", mqtt.state());
            delay(5000);
        }
    }
}

void publishTelemetry() {
    JsonDocument doc;
    doc["v"] = 1;
    doc["ts"] = millis() / 1000;
    doc["deviceId"] = DEVICE_ID;

    if (gps.location.isValid()) {
        doc["lat"] = gps.location.lat();
        doc["lon"] = gps.location.lng();
        doc["speedKmh"] = gps.speed.kmph();
        doc["satellites"] = gps.satellites.value();
    } else {
        doc["lat"] = nullptr;
        doc["lon"] = nullptr;
        doc["speedKmh"] = 0;
        doc["satellites"] = 0;
        doc["gpsfix"] = false;
    }

    char buf[512];
    serializeJson(doc, buf);

    String topic = String("devices/") + DEVICE_ID + "/telemetry";
    mqtt.publish(topic.c_str(), buf);
    Serial.printf("Telemetría publicada: %s\n", buf);
}

void setup() {
    Serial.begin(115200);
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW); // relé apagado al arrancar — SIEMPRE

    gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

    connectWifi();

    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setCallback(onMqttMessage);
    mqtt.setKeepAlive(60);
    mqtt.setBufferSize(512);

    connectMqtt();

    Serial.println("VehicleGuard prototipo listo");
}

void loop() {
    if (!mqtt.connected()) connectMqtt();
    mqtt.loop();

    while (gpsSerial.available()) {
        gps.encode(gpsSerial.read());
    }

    if (millis() - lastPublish > PUBLISH_INTERVAL) {
        publishTelemetry();
        lastPublish = millis();
    }
}
```

**Antes de flashear:** edita `config.h` con tu SSID, password y la IP de tu PC.
Para saber la IP de tu PC: abre una terminal y ejecuta `ipconfig`, busca "Dirección IPv4".

---

### Paso 8: Verificar el sistema completo

1. Flashea el firmware al ESP32.
2. Abre el Monitor serial (115200 baud).
3. Deberías ver:
   ```
   Conectando a WiFi: MiRed....
   WiFi OK — IP: 192.168.1.45
   Conectando a MQTT 192.168.1.100:1883...
   MQTT OK
   VehicleGuard prototipo listo
   Telemetría publicada: {"v":1,"ts":42,"deviceId":"vg-proto-001",...}
   ```
4. En MQTT Explorer, suscríbete a `devices/#` — verás los mensajes llegando cada 10 segundos.
5. Para probar el relé: publica manualmente en `devices/vg-proto-001/commands`:
   ```json
   {"type": "KILL_ENGINE"}
   ```
   Con velocidad 0 → el relé debe activarse. El LED del módulo relé se encenderá.

---

## ETAPA 3 — Backend NestJS (siguiente paso)

Con el firmware funcionando, el siguiente paso es construir el backend que:
- Recibe los mensajes MQTT
- Los guarda en PostgreSQL
- Expone un WebSocket para la app móvil

Eso está en `docs/roadmap/fase1-backend.md` (próxima guía).

---

## Resumen de conexiones

```
ESP32 DevKit V1
┌─────────────────────┐
│ 3V3 ──────────────── VCC (GPS Neo-6M)
│ GND ──────────────── GND (GPS) + GND (Relé)
│ GPIO16 (RX2) ─────── TX  (GPS Neo-6M)
│ GPIO17 (TX2) ─────── RX  (GPS Neo-6M)
│ GPIO26 ────────────── IN  (Módulo relé)
│ VIN (5V) ──────────── VCC (Módulo relé)
│ USB ───────────────── PC (alimentación + flash)
└─────────────────────┘
```

---

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| No aparece COM port | Driver no instalado | Instalar CP210x o CH340 driver |
| Error "upload failed" | Puerto COM incorrecto | Verificar en PlatformIO qué puerto está configurado |
| GPS solo muestra vacíos | Sin fix todavía | Acercar a ventana, esperar 2-3 min |
| MQTT no conecta | IP incorrecta o Docker no corre | Verificar `ipconfig` y `docker compose ps` |
| Relé no activa | Alimentado con 3.3V en vez de 5V | Mover VCC del relé al pin VIN |
