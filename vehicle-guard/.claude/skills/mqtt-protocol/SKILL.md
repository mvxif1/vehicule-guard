---
name: mqtt-protocol
description: Use this skill whenever designing or modifying the MQTT communication contract between the ESP32 devices and the NestJS backend. Triggers on "MQTT", "topic", "payload", "QoS", "retained", "broker", "Mosquitto", "EMQX", "MQTT auth", or whenever defining the message schema sent between firmware and server. Activate before writing any MQTT publish/subscribe code on either side to ensure consistency.
---

# MQTT Protocol

Contrato exacto de comunicación entre dispositivos VehicleGuard y el backend. Esta skill es la "fuente de verdad" — si firmware y backend discrepan, esta es la referencia.

## Broker

- **Desarrollo:** Mosquitto local (Docker), puerto 8883 con TLS.
- **Staging/Producción:** EMQX (Open Source) en VPS, mejor escalabilidad y dashboard.
- **Auth:** mTLS (cada device con certificado X.509 firmado por nuestra CA).
- **No usar usuario/password** salvo en testing local. mTLS solamente en producción.

## Topic naming

Formato: `<scope>/<deviceId>/<channel>`

Topics que **publica** el dispositivo (backend escucha):

| Topic | Payload | QoS | Retained | Frecuencia |
|-------|---------|-----|----------|------------|
| `devices/{id}/telemetry` | TelemetryMessage | 1 | no | cada 10s en marcha, 60s detenido |
| `devices/{id}/events` | EventMessage | 1 | no | cuando ocurre un evento |
| `devices/{id}/status` | StatusMessage | 1 | yes | cada cambio de estado |
| `devices/{id}/cmd-response` | CmdResponseMessage | 1 | no | en respuesta a comandos |
| `devices/{id}/ota-status` | OtaStatusMessage | 1 | no | durante updates |

Topics que **suscribe** el dispositivo (backend publica):

| Topic | Payload | QoS | Retained |
|-------|---------|-----|----------|
| `devices/{id}/commands` | CommandMessage | 1 | no |
| `devices/{id}/ota` | OtaManifestMessage | 1 | no |
| `devices/{id}/config` | ConfigMessage | 1 | yes |

## Payload format

Todos los payloads son **JSON** en Fase 1 (legible, fácil debug). Migrar a **Protobuf** en Fase 4 cuando el volumen lo justifique (~10x menor, ~3x más rápido de parsear).

Todos los mensajes incluyen:

```json
{
  "v": 1,                    // versión del schema
  "ts": 1714060800,          // unix timestamp segundos UTC
  "deviceId": "vg-abc123"
}
```

## Schemas

### TelemetryMessage

```json
{
  "v": 1,
  "ts": 1714060800,
  "deviceId": "vg-abc123",
  "lat": -33.41234,
  "lon": -70.56789,
  "speedKmh": 42.5,
  "heading": 270,
  "altitudeM": 567,
  "satellites": 8,
  "hdop": 1.2,
  "ignitionOn": true,
  "battery12vMv": 13800,
  "tempCelsius": 23,
  "rssi": -78,
  "fuelEstimateL": 12.4
}
```

### EventMessage

```json
{
  "v": 1,
  "ts": 1714060800,
  "deviceId": "vg-abc123",
  "event": "MOTION_DETECTED",
  "severity": "INFO",
  "data": {
    "accelG": 0.8
  }
}
```

Eventos definidos:

| Evento | Severidad | Significado |
|--------|-----------|-------------|
| `BOOT` | INFO | Dispositivo arrancó |
| `IGNITION_ON` | INFO | Encendido detectado |
| `IGNITION_OFF` | INFO | Apagado detectado |
| `MOTION_DETECTED` | INFO | Acelerómetro detectó movimiento con auto apagado |
| `VIBRATION_HIGH` | WARN | Posible golpe / intento de robo |
| `GEOFENCE_ENTER` | INFO | Entró a geocerca |
| `GEOFENCE_EXIT` | INFO | Salió de geocerca |
| `OVER_SPEED` | WARN | Sobrepasó velocidad configurada |
| `LOW_BATTERY_12V` | WARN | Voltaje del auto < 11.5V |
| `POSSIBLE_JAMMING` | CRITICAL | GPS y 4G perdidos simultáneamente |
| `TAMPER_DETECTED` | CRITICAL | Caja abierta o desconexión |
| `KILL_ENGAGED` | CRITICAL | Corte de corriente activado |
| `KILL_RELEASED` | INFO | Corte de corriente liberado |
| `KILL_REJECTED` | WARN | Comando de corte rechazado por safety guard |
| `OTA_SUCCESS` | INFO | Update completado con self-test ok |
| `OTA_FAILED` | ERROR | Update falló (revisa data.reason) |
| `SIGNATURE_FAIL` | CRITICAL | Comando con firma inválida — posible ataque |

### StatusMessage (retained)

```json
{
  "v": 1,
  "ts": 1714060800,
  "deviceId": "vg-abc123",
  "online": true,
  "fwVersion": "1.4.2",
  "uptimeSec": 86400,
  "freeHeapBytes": 124000,
  "killEngaged": false
}
```

Como es retained, un cliente que se conecta nuevo recibe inmediatamente el último estado.

### CommandMessage (backend → device)

```json
{
  "v": 1,
  "ts": 1714060800,
  "deviceId": "vg-abc123",
  "commandId": "cmd-9f8e7d6c",
  "type": "KILL_ENGINE",
  "data": {},
  "issuedBy": "user-uuid-123",
  "nonce": "random32bytes",
  "signature": "hmac-sha256-of-above-fields-with-deviceSecret"
}
```

Tipos de comando:

| Tipo | Data | Notas |
|------|------|-------|
| `KILL_ENGINE` | {} | Pasa por SafetyGuard antes de ejecutar |
| `RELEASE_KILL` | {} | Libera el corte |
| `LOCATE_NOW` | {} | Forza un report inmediato de telemetría |
| `REBOOT` | {} | Reinicia el firmware |
| `UPDATE_CONFIG` | { config } | Cambia parámetros (frecuencia de report, etc.) |
| `ARM_ALARM` | {} | Activa modo alarma (reporta cualquier movimiento) |
| `DISARM_ALARM` | {} | Desactiva |

### CmdResponseMessage (device → backend)

```json
{
  "v": 1,
  "ts": 1714060800,
  "deviceId": "vg-abc123",
  "commandId": "cmd-9f8e7d6c",
  "result": "OK",
  "details": {}
}
```

`result`: `OK`, `REJECTED_SAFETY`, `REJECTED_SIGNATURE`, `REJECTED_NONCE`, `FAILED_HARDWARE`, `FAILED_OTHER`.

## QoS — cuándo usar cada nivel

- **QoS 0 (at most once):** nunca en este sistema — no aceptamos pérdida de mensajes.
- **QoS 1 (at least once):** default para todo. Garantiza entrega, posible duplicado (manejamos idempotencia por `commandId` o `(deviceId, ts)`).
- **QoS 2 (exactly once):** no usar — overhead alto, casi nunca vale la pena.

## Last Will Testament (LWT)

El dispositivo configura un LWT al conectar. Si el dispositivo se desconecta abruptamente, el broker publica automáticamente:

```
topic: devices/{id}/status
payload: { "online": false, "ts": <broker_time>, "deviceId": "..." }
retained: true
```

Esto da al backend visibilidad inmediata de desconexiones sin esperar timeout.

## Reconexión y buffering offline

El dispositivo:
1. Si pierde conexión MQTT, hace backoff exponencial (1s, 2s, 4s, max 60s).
2. Mientras está desconectado, **acumula** TelemetryMessages en LittleFS local.
3. Al reconectar, hace flush del buffer en orden cronológico.
4. El backend rechaza duplicados por `(deviceId, ts)`.
5. El buffer tiene límite (último 24h) — si se llena, descarta los más viejos.

## TLS y certificados

Conexión obligatoria por **mqtts://** (puerto 8883) en producción.

```cpp
// firmware: configurar TLS
PubSubClient mqtt(secureClient);
secureClient.setCACert(SecureStore::readCa());
secureClient.setCertificate(SecureStore::readDeviceCert());
secureClient.setPrivateKey(SecureStore::readDeviceKey());
```

El broker valida que el `CN` del certificado coincide con el `clientId` MQTT.

## Anti-replay para comandos

Los comandos del backend incluyen `nonce` (random) y `ts`. El firmware rechaza si:
- `ts` es > 5 minutos viejo o > 1 minuto futuro.
- `nonce` ya está en una lista de últimos 100 nonces vistos.

Esto previene que un atacante capture y reenvíe un comando de "KILL_ENGINE" más tarde.

## Para profundizar

- `references/payload-examples.md` — ejemplos completos de cada mensaje
- `references/mosquitto-config.md` — config de Mosquitto local con mTLS
- Skill `esp32-firmware` para implementación cliente
- Skill `nestjs-backend` para implementación servidor
- Skill `vehicle-security` para detalles del HMAC y nonces
