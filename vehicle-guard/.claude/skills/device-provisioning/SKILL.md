---
name: device-provisioning
description: Use this skill whenever Maximiliano needs to flash a brand-new ESP32 chip with the VehicleGuard firmware, generate unique device credentials (serial, certs, secrets), bind a chip to a user account via QR code, or scale from one chip to many (replicate to friends' cars or fleet). Triggers on "provisioning", "flashear nuevo chip", "vincular dispositivo", "QR de claim", "credenciales de dispositivo", "replicar el software en otro chip", "factory reset", "burn-in".
---

# Device Provisioning

Skill que cubre todo el ciclo de "tengo un chip ESP32 vacío en la mano" → "está vinculado a un usuario en producción y reportando datos".

## Ciclo completo

```
[Chip vacío] ─► [Flash inicial] ─► [Burn-in test] ─► [Generación de credenciales]
                                                              │
                                                              ▼
[Auto del usuario] ◄─── [Claim por QR/código] ◄─── [QR sticker pegado al device]
```

## Estación de provisioning

Maximiliano necesita un setup pequeño para flashear nuevos chips de forma repetible:

**Hardware mínimo:**
- PC con USB
- Cable USB-C/microUSB de buena calidad (los baratos cortan corriente)
- ESP32 DevKit V1 nuevo
- Antena GPS y antena 4G (compartibles entre dispositivos durante el burn-in)
- SIM card con datos (puede ser una de pruebas, recargable)

**Software:**
- PlatformIO CLI o ESP-IDF tools (`esptool.py`)
- Script de provisioning (`scripts/provision.py`)
- Acceso al backend admin (para registrar el nuevo device)

## Flow de provisioning paso a paso

### 1. Build del firmware con la versión de release actual

```bash
cd firmware
pio run -e esp32dev
# genera .pio/build/esp32dev/firmware.bin
```

### 2. Flash inicial (firmware genérico)

```bash
esptool.py --chip esp32 --port /dev/ttyUSB0 --baud 921600 \
  write_flash -z 0x1000 bootloader.bin \
              0x8000  partitions.bin \
              0x10000 firmware.bin
```

El firmware genérico arranca en **modo provisioning**: escucha por UART comandos especiales del script de provisioning.

### 3. Generación de credenciales únicas

El script `scripts/provision.py` hace esto automáticamente:

```python
def provision_device(serial_port: str):
    # 1. Generar identificadores únicos
    serial      = generate_serial()                # VG-2026-XXXXXX
    device_id   = uuid4()
    device_secret = secrets.token_bytes(32)        # HMAC key
    
    # 2. Generar par de claves para mTLS y firmar el cert con nuestra CA
    key_pem, csr_pem = generate_keypair_and_csr(device_id)
    cert_pem = ca_sign_csr(csr_pem)
    
    # 3. Generar token de claim de un solo uso
    claim_token = secrets.token_urlsafe(16)
    
    # 4. Registrar todo en el backend
    r = requests.post(f"{BACKEND}/admin/devices/register", json={
        "serial": serial,
        "deviceId": str(device_id),
        "certFingerprint": fingerprint_of(cert_pem),
        "claimToken": claim_token,
    }, headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
    r.raise_for_status()
    
    # 5. Cargar credenciales al ESP32 vía protocolo de provisioning UART
    sender = ProvisioningClient(serial_port)
    sender.write_nvs("device_id",     str(device_id))
    sender.write_nvs("serial",        serial)
    sender.write_nvs("device_secret", device_secret.hex())
    sender.write_nvs("cert_pem",      cert_pem)
    sender.write_nvs("key_pem",       key_pem)
    sender.write_nvs("ca_pem",        CA_PUBLIC_PEM)
    sender.write_nvs("mqtt_host",     MQTT_HOST)
    sender.commit()
    sender.exit_provisioning_mode()  # device reboot to normal mode
    
    # 6. Imprimir / generar QR para el sticker físico
    qr_payload = json.dumps({"s": serial, "t": claim_token})
    qr_image = qrcode.make(qr_payload)
    qr_image.save(f"qr/{serial}.png")
    
    print(f"✅ Provisioned device {serial}")
    print(f"   Print QR: qr/{serial}.png")
    print(f"   Stick on device case before installation.")
    return serial
```

### 4. Burn-in test (24-48h)

Antes de entregar el dispositivo a un usuario, debe pasar burn-in en una mesa con condiciones controladas. El test verifica:

- [ ] Conecta a 4G y mantiene conexión por > 8h sin desconexión inexplicable
- [ ] GPS obtiene fix en < 5 min en frío
- [ ] Reporta telemetría cada N segundos sin gaps > 30s
- [ ] El relé responde a comandos en < 3s
- [ ] Sobrevive un OTA test
- [ ] Sobrevive un reboot forzado (corte de fuente) y vuelve online en < 90s
- [ ] No tiene memory leaks visibles (uptime estable)

Si pasa, se imprime el QR y se sella la caja. Si falla, se descarta o se debugea.

### 5. Sticker QR físico

El device sale con un QR adhesivo en el exterior de la caja. El QR contiene:

```json
{"s":"VG-2026-A1B2C3","t":"abc123randomtoken"}
```

`s` es el serial, `t` es el `claimToken` que solo sirve UNA vez.

### 6. Claim del lado del usuario

En la app:
1. Usuario instala VehicleGuard.
2. Crea cuenta o hace login.
3. Tap "Agregar dispositivo".
4. Escanea el QR.
5. App llama `POST /devices/claim` con `{ serial, claimToken }`.
6. Backend valida que el claimToken es válido y no usado, asocia el device al usuario, invalida el token.
7. Usuario completa info del vehículo (placa, marca, modelo).
8. Listo — el device aparece en la lista del usuario.

## Replicar a más chips (caso de Maximiliano: dárselos a amigos)

Una vez que el primer dispositivo funciona y está validado:

```bash
# Maximiliano compra 3 chips más
# Conecta el chip 1 al USB
python scripts/provision.py --port /dev/ttyUSB0 --owner mferrer@example.cl
# repite para chips 2 y 3
```

El script automatiza todo lo de arriba. Cada chip queda con QR único.

Maximiliano puede:
- Quedarse uno para él.
- Darle uno a un amigo (cada uno con su QR).
- En la app, el amigo escanea su QR y queda asociado a SU cuenta.

**No se transfiere la propiedad de un device sin reset.** Si Maximiliano quiere "regalar" un device que ya estaba claimed por él, tiene que ir a la app, "Eliminar dispositivo" — el backend invalida la asociación y emite un nuevo `claimToken`. Recién ahí el amigo puede claim.

## Factory reset (si un device se vende usado o se transfiere)

```python
# Reset del lado backend
DELETE /admin/devices/{serial}
# Reset del lado del firmware (requires physical access)
python scripts/factory_reset.py --port /dev/ttyUSB0
# Borra NVS, regenera credenciales en el siguiente provisioning
```

## Inventario y trazabilidad

Mantén un CSV (eventualmente DB) con:

| serial | provisioned_at | provisioned_by | burn_in_passed | claim_token_used | current_owner | hw_revision | notes |

Esto te da:
- Trazabilidad si un device falla y necesitas saber qué batch.
- Inventario para producción.
- Insights cuando comercialices ("la rev 1.0 falla 8% en 6 meses, la rev 1.2 baja a 1%").

## Para profundizar

- `references/provision-protocol.md` — protocolo UART exacto entre script y ESP32 en modo provisioning
- `references/qr-format-spec.md` — formato del QR y compatibilidad con la app
- `references/burn-in-checklist.md` — checklist completo de burn-in
- Skill `esp32-firmware` para implementar el modo provisioning en el firmware
- Skill `nestjs-backend` para los endpoints `/admin/devices/register` y `/devices/claim`
