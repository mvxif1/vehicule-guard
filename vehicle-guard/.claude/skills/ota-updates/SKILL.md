---
name: ota-updates
description: Use this skill whenever working on Over-The-Air firmware updates for the ESP32 fleet. Triggers on "OTA", "actualización remota de firmware", "firmware update", "rollback", "partition table", "signed firmware", "esp_https_ota", "update channel", "release", or whenever Maximiliano needs to push new firmware to deployed devices without physical access. CRITICAL for scaling beyond the first device.
---

# OTA Updates

Skill para el sistema de actualización remota de firmware. Sin OTA, cada bug fix significa ir físicamente al auto. Con OTA bien hecho, podemos iterar rápido y mantener los dispositivos seguros.

## Diseño del sistema

```
┌──────────────┐         ┌──────────────┐          ┌──────────────┐
│   Build CI   │ ──────► │  Object      │  ────►   │  Backend     │
│ (firmware.bin)│        │  storage S3  │          │  signs URL   │
│ + signature  │         │   public     │          │  per device  │
└──────────────┘         └──────────────┘          └──────┬───────┘
                                                          │ MQTT
                                                          ▼
                                                  ┌──────────────┐
                                                  │  ESP32 OTA   │
                                                  │  Updater     │
                                                  └──────────────┘
                                                  1. recibe URL + signature
                                                  2. descarga a partición OTA inactiva
                                                  3. verifica firma (RSA-2048 / ECDSA)
                                                  4. esp_ota_set_boot_partition()
                                                  5. reboot
                                                  6. self-test 5 min → marca como válida
                                                  7. si self-test falla → rollback automático
```

## Particiones OTA-dual

El ESP32 tiene `app0` y `app1`. Una está activa, la otra es target del próximo update. Tras update exitoso, los roles se intercambian. Si la nueva versión falla self-test, el bootloader hace rollback automático a la anterior.

Ver `partitions.csv` en la skill `esp32-firmware` para el layout exacto.

## Firma digital

**No aceptamos firmware sin firmar.** Generación de claves (una sola vez):

```bash
# Generar keypair RSA-3072 (la pública va embedded en cada firmware)
openssl genrsa -out fw_signing_key.pem 3072
openssl rsa -in fw_signing_key.pem -pubout -out fw_signing_pub.pem
# Convertir public a array C para incluir en el firmware:
xxd -i fw_signing_pub.pem > include/fw_signing_pub.h
```

La privada (`fw_signing_key.pem`) **nunca** sube al repo. Vive en:
- Local: `~/.config/vehicleguard/keys/` con permisos 600.
- CI: GitHub Actions secret cifrado.

Firma de un firmware compilado:

```bash
openssl dgst -sha256 -sign fw_signing_key.pem -out firmware.sig firmware.bin
```

El binario se distribuye como `firmware.bin` + `firmware.sig` + manifest JSON con metadatos.

## Manifest

```json
{
  "version": "1.4.2",
  "channel": "stable",
  "minPreviousVersion": "1.0.0",
  "url": "https://updates.vehicleguard.cl/fw/1.4.2/firmware.bin",
  "signatureUrl": "https://updates.vehicleguard.cl/fw/1.4.2/firmware.sig",
  "size": 1289472,
  "sha256": "abc123...",
  "releaseNotes": "Fix bug en parser NMEA con sentencias largas",
  "rolloutPercent": 10
}
```

`rolloutPercent`: el backend solo dirige el update al X% de la flota (canary). Si los telemetría reporta éxitos, sube a 100%.

## Flujo en el firmware

```cpp
class OtaUpdater {
public:
    bool checkAndUpdate() {
        auto manifest = MqttClient::pollOtaTopic();
        if (!manifest.hasValue()) return false;
        if (manifest->version <= FW_VERSION) return false;
        if (manifest->minPreviousVersion > FW_VERSION) {
            LOG_W("Cannot upgrade: version too old, manual update needed");
            return false;
        }

        LOG_I("Starting OTA to v%s", manifest->version);

        esp_https_ota_config_t cfg = {
            .http_config = &httpConfig,
            .partial_http_download = true,
            .max_http_request_size = 8192,
        };

        esp_https_ota_handle_t handle;
        if (esp_https_ota_begin(&cfg, &handle) != ESP_OK) return false;

        // Descarga incremental
        while (true) {
            esp_err_t r = esp_https_ota_perform(handle);
            if (r != ESP_ERR_HTTPS_OTA_IN_PROGRESS) break;
        }

        if (!esp_https_ota_is_complete_data_received(handle)) {
            esp_https_ota_abort(handle);
            return false;
        }

        // Verifica firma ANTES de marcar la partición como bootable
        if (!verifySignature(handle, manifest->signatureUrl)) {
            esp_https_ota_abort(handle);
            LOG_E("Firmware signature INVALID — aborting");
            reportEvent(SIGNATURE_FAIL);
            return false;
        }

        esp_https_ota_finish(handle);
        LOG_I("OTA done. Rebooting in 5s...");
        SecureStore::setPendingValidation(true);
        vTaskDelay(pdMS_TO_TICKS(5000));
        esp_restart();
    }
};
```

## Self-test post-update

Después de bootear con la nueva versión, el firmware corre un self-test. Solo si pasa, marca la partición como confirmada (sino, al siguiente reboot, el bootloader vuelve a la anterior).

```cpp
void postBootSelfTest() {
    auto pending = SecureStore::isPendingValidation();
    if (!pending) return;

    LOG_I("Running post-OTA self-test...");
    bool ok =
        ModemManager::isConnected(60'000)   &&  // 4G ok en 60s
        GpsManager::hasValidFix(120'000)    &&  // GPS fix en 120s
        MqttClient::canPublish()            &&  // pub OK
        SecureStore::canRead();                 // NVS ok

    if (ok) {
        esp_ota_mark_app_valid_cancel_rollback();
        SecureStore::setPendingValidation(false);
        reportEvent(OTA_SUCCESS, FW_VERSION);
    } else {
        LOG_E("Self-test FAILED — rollback en próximo boot");
        // No hacemos nada — el bootloader hará rollback automático
        esp_ota_mark_app_invalid_rollback_and_reboot();
    }
}
```

## Backend — distribución de OTA

```typescript
@Injectable()
export class OtaService {
  async pushUpdate(deviceId: string, manifestVersion: string) {
    const manifest = await this.getManifest(manifestVersion);
    const device   = await this.devices.findById(deviceId);

    // canary rollout
    if (this.shouldDeferForCanary(deviceId, manifest)) return;

    // genera URL firmada por 1 hora (pre-signed S3)
    const signedUrl = await this.s3.getSignedUrl(manifest.url, 3600);

    await this.mqtt.publish(`devices/${deviceId}/ota`, {
      ...manifest,
      url: signedUrl,
      signatureUrl: await this.s3.getSignedUrl(manifest.signatureUrl, 3600),
    }, { qos: 1 });

    await this.audit.log({ deviceId, action: 'OTA_PUSHED', version: manifest.version });
  }

  private shouldDeferForCanary(deviceId: string, manifest: Manifest): boolean {
    if (manifest.rolloutPercent >= 100) return false;
    const hash = murmurhash(deviceId);
    return (hash % 100) >= manifest.rolloutPercent;
  }
}
```

## Versionado

- **Semver: MAJOR.MINOR.PATCH**.
- **MAJOR bumps**: cambian formato de mensajes MQTT o contrato de comandos. Requieren backend compatible con ambas versiones durante la transición.
- **MINOR**: features nuevos backwards-compatible.
- **PATCH**: bug fixes.

Tag git al hacer release:
```bash
git tag -a v1.4.2 -m "Fix NMEA parser overflow"
git push origin v1.4.2
# CI builds, signs, uploads a S3, registers manifest en backend
```

## Reglas de oro de OTA

1. **Nunca push masivo de día 1.** Siempre canary 5% → 25% → 50% → 100% con 24h entre cada paso.
2. **Nunca push durante horario de uso pico** (07:00–10:00 y 17:00–21:00 hora local). El reboot durante el manejo es mala UX.
3. **Cada release debe poder deshacerse.** Antes de mergear a `main`, validar que el rollback funciona (= la anterior puede leer las nuevas versiones de NVS si cambió el formato).
4. **Manifest tiene `minPreviousVersion`.** Si necesitamos saltar versiones (ej: cambio de formato NVS), forzamos al usuario a re-flashear manualmente.
5. **Logs de OTA** se reportan al backend con `eventos/ota` con resultado. Dashboard del admin ve % éxito por versión.

## Para profundizar

- `references/esp_https_ota_api.md` — API exacta de la librería ESP-IDF
- `references/canary-rollout-strategy.md` — protocolo de rollout
- Skill `esp32-firmware` para integración con el resto del firmware
- Skill `nestjs-backend` para el OtaService server-side
