---
name: esp32-firmware
description: Use this skill whenever writing, debugging, or reviewing firmware code for the ESP32 microcontroller in the VehicleGuard device. Triggers include any C/C++ code for ESP32, PlatformIO config, FreeRTOS tasks, GPIO control, UART communication with the SIM7600 module, NVS storage, deep-sleep power management, watchdog timers, or AT commands to the modem. Activate when Maximiliano mentions "ESP32", "firmware", "Arduino code", "PlatformIO", "AT commands", "modem", or describes embedded hardware behavior.
---

# ESP32 Firmware

Skill para todo lo relacionado con firmware del dispositivo VehicleGuard que corre sobre ESP32.

## Stack confirmado

- **Framework:** Arduino sobre PlatformIO (más fácil para empezar; migrable a ESP-IDF puro en Fase 4 si necesitamos optimización fina)
- **Lenguaje:** C++ (estilo Arduino, con clases para encapsular módulos)
- **RTOS:** FreeRTOS (viene incluido con ESP-IDF/Arduino-ESP32)
- **Módulo celular:** SIM7600 controlado por comandos AT vía UART2
- **GPS:** integrado en el SIM7600 (no requiere módulo aparte)
- **Almacenamiento:** NVS (Non-Volatile Storage) cifrada para credenciales y certificados

## Estructura del proyecto firmware

```
firmware/
├── platformio.ini           ← config de board, libs, partition table
├── partitions.csv           ← partición OTA dual + NVS cifrada + storage
├── src/
│   ├── main.cpp             ← setup() y loop() — solo orquesta
│   ├── config.h             ← #defines globales (sin secretos)
│   ├── modules/
│   │   ├── ModemManager.cpp/.h    ← AT commands, conexión 4G
│   │   ├── GpsManager.cpp/.h      ← parser NMEA, fix detection
│   │   ├── MqttClient.cpp/.h      ← pub/sub, reconexión
│   │   ├── PowerControl.cpp/.h    ← relé corte de corriente
│   │   ├── SafetyGuard.cpp/.h     ← chequeo velocidad < 5km/h, auth
│   │   ├── OtaUpdater.cpp/.h      ← descarga + verificación firma
│   │   ├── SecureStore.cpp/.h     ← wrapper NVS cifrada
│   │   └── Telemetry.cpp/.h       ← agregador de métricas
│   └── tasks/
│       ├── TelemetryTask.cpp      ← FreeRTOS task: publica cada Xs
│       ├── CommandTask.cpp        ← FreeRTOS task: escucha comandos
│       └── WatchdogTask.cpp       ← reinicia si algo se cuelga
├── lib/                     ← librerías custom (si las hay)
└── test/                    ← tests con Unity framework
```

## Convenciones de código

- **Naming:** `PascalCase` para clases, `camelCase` para funciones y variables, `SCREAMING_SNAKE` para macros y constantes.
- **Headers con include guards** o `#pragma once`.
- **Strings constantes:** `PROGMEM` o `F()` para ahorrar RAM en literales.
- **Logging:** macro `LOG_I(fmt, ...)`, `LOG_W`, `LOG_E` configurables por nivel; jamás `Serial.println` directo en código de producción.
- **Sin `delay()` en código de producción:** usa `vTaskDelay()` con `pdMS_TO_TICKS()`.
- **Manejo de errores:** retorna `esp_err_t` o un `enum class Result` propio. No tirar excepciones (deshabilitadas en ESP32 Arduino por defecto).

## platformio.ini de referencia

```ini
[env:esp32dev]
platform = espressif32@6.5.0
board = esp32dev
framework = arduino
monitor_speed = 115200
upload_speed = 921600

board_build.partitions = partitions.csv
board_build.filesystem = littlefs

build_flags =
    -DCORE_DEBUG_LEVEL=3
    -DCONFIG_ARDUINO_LOOP_STACK_SIZE=16384
    -DBOARD_HAS_PSRAM
    -mfix-esp32-psram-cache-issue

lib_deps =
    knolleary/PubSubClient @ ^2.8
    bblanchon/ArduinoJson @ ^7.0.4
    mikalhart/TinyGPSPlus @ ^1.0.3
    ; SIM7600 driver (vincentdoba/TinyGSM tiene fork con soporte SIM7600)
    vshymanskyy/TinyGSM @ ^0.12.0
```

## partitions.csv (con OTA dual y NVS cifrada)

```
# Name,   Type, SubType, Offset,   Size, Flags
nvs,      data, nvs,     0x9000,   0x5000,
otadata,  data, ota,     0xe000,   0x2000,
app0,     app,  ota_0,   0x10000,  0x1A0000,
app1,     app,  ota_1,   ,         0x1A0000,
storage,  data, spiffs,  ,         0xB0000,
```

Esto da:
- **app0 / app1:** dos slots de firmware para OTA seguro (rollback)
- **nvs:** credenciales, certificados, deviceId
- **storage:** logs locales para offline

## Patrón de inicialización (setup())

```cpp
void setup() {
    // 1. Logger primero
    Serial.begin(115200);
    LOG_I("VehicleGuard firmware v%s booting...", FW_VERSION);

    // 2. Watchdog para que un cuelgue reinicie en 30s
    esp_task_wdt_init(30, true);

    // 3. NVS (donde están los certificados)
    if (!SecureStore::init()) {
        LOG_E("NVS init failed — entering safe mode");
        SafeMode::enter();
        return;
    }

    // 4. Hardware: GPIO del relé en estado seguro (NO cortar corriente al arrancar)
    PowerControl::initSafe();

    // 5. Módem (esto puede tardar 10-30s)
    if (!ModemManager::init()) {
        LOG_E("Modem init failed");
        // reintentar en background, no bloquees
    }

    // 6. Lanzar tareas FreeRTOS
    xTaskCreatePinnedToCore(telemetryTask, "telemetry", 8192, NULL, 1, NULL, 1);
    xTaskCreatePinnedToCore(commandTask,   "commands",  8192, NULL, 2, NULL, 0);
    xTaskCreatePinnedToCore(watchdogTask,  "wdt",       4096, NULL, 3, NULL, 0);
}

void loop() {
    // loop() vacío en arquitectura RTOS
    vTaskDelay(pdMS_TO_TICKS(1000));
}
```

## Consumo de energía

El ESP32 conectado a 12V del auto vía step-down a 5V. Consumo típico:
- ESP32 activo: ~150 mA
- SIM7600 transmitiendo: peaks de 2A (necesita capacitor de bulk)
- En idle: ~50 mA combinado si SIM en sleep

**Para Fase 1 no nos preocupamos por sleep modes** — el auto cargará la batería. Para Fase 2+ implementamos light-sleep cuando el vehículo lleva > 30 min sin moverse.

## Errores comunes y debugging

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Brownout detector resets | Fuente sin capacidad de entregar peaks | Capacitor 1000µF cerca del SIM7600 |
| GPS no fija | Antena cubierta o cold start | Espera 60-120s con cielo despejado |
| AT commands no responden | UART pins mal cableados o baudrate | Verifica RX/TX cruzados, prueba 115200 / 57600 |
| Stack overflow en task | Stack size muy chico | Sube a 16384 bytes |
| MQTT desconecta cada minuto | keepalive < timeout del broker | keepalive a 60s, broker timeout a 120s |
| Random reboots tras horas | Watchdog mal configurado o memory leak | Logs `rst:0xC` = task watchdog; revisa qué task |

## Tabletop testing antes de instalar en auto

Setup de mesa para probar firmware sin estar dentro del vehículo:

1. **Fuente de poder de banco** ajustada a 12V con limitador de corriente a 2A.
2. **Antena GPS pegada en ventana** que vea cielo (NMEA solo fija con cielo).
3. **SIM card de datos** (en Chile: Entel/WOM/Movistar M2M, o una prepago temporal).
4. **LED + resistor** simulando el relé de corte (NO conectes a un auto real hasta que pase ~20h en mesa sin colgarse).
5. **Multímetro** para medir consumo y verificar que el GPIO del relé está en LOW al arranque.

## Para profundizar

- `references/at-commands-sim7600.md` — referencia rápida de comandos AT más usados
- `references/freertos-patterns.md` — patrones de tareas, queues, semáforos
- Skill `mqtt-protocol` para diseño de topics/payloads
- Skill `vehicle-security` para implementar el corte de corriente seguro
- Skill `ota-updates` para el módulo `OtaUpdater`
