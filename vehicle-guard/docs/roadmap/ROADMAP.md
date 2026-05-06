# Roadmap paso a paso — VehicleGuard

> Esta es la **guía operativa**: qué hacer en qué orden, con qué hito medible, desde "no tengo nada" hasta "tengo un chip funcionando en mi auto y otro en el de un amigo".
>
> Marca los checkboxes a medida que avances. Cada sección tiene un **criterio de salida** verificable: si no lo cumples, no avances.

---

## Fase 0 — Preparación del entorno (1–2 semanas)

### 0.1 Instalación de herramientas en tu PC

- [ ] Instalar **Node.js LTS** (v20+) y **pnpm**
- [ ] Instalar **Python 3.11+** con `pip` y `venv`
- [ ] Instalar **Docker Desktop** (necesario para PostgreSQL, Mosquitto, EMQX)
- [ ] Instalar **VS Code** + extensiones:
  - [ ] PlatformIO IDE
  - [ ] ESP-IDF (de Espressif)
  - [ ] Prisma
  - [ ] ESLint + Prettier
- [ ] Instalar **Git** y configurar SSH key con GitHub
- [ ] Instalar **Postman** o **Insomnia** para probar APIs
- [ ] Instalar **MQTT Explorer** (cliente GUI de MQTT — invaluable para debug)

### 0.2 Compra de hardware

Consulta la skill `hardware-installation` para la lista detallada. Pide TODO de una vez (los envíos de Aliexpress demoran 3-5 semanas a Chile, planifica).

- [ ] Lista de compras enviada
- [ ] Hardware llegó (lleva ~3-5 semanas)
- [ ] Inventario hecho (todo está y funciona visualmente)

### 0.3 Cuenta SIM card de datos

- [ ] Comprar SIM Entel/Movistar/WOM con plan IoT (recomendado: ~50-100MB/mes basta para el MVP).
- [ ] Activar la SIM y anotar APN (cambia por operador, ej: Entel APN suele ser `bam.entelpcs.cl`).

### 0.4 Repositorio Git

- [ ] Crear repo `vehicleguard` en GitHub (privado por ahora).
- [ ] Clonar en local.
- [ ] Subir todos los archivos generados por Claude (CLAUDE.md, master-prompt.md, skills, etc.).
- [ ] Primer commit y push.

**Criterio de salida Fase 0:** Tienes el hardware en mesa, el ambiente instalado y un repo Git con la estructura inicial.

---

## Fase 1 — MVP (4–6 semanas)

Este es el corazón del proyecto. Al terminar la Fase 1 tendrás:
- Tu auto reportando GPS en tiempo real a un backend que vos hosteas.
- Una app en tu celular mostrando tu auto en un mapa.
- Capacidad de cortar la corriente desde la app (con todos los safety guards).

### Sprint 1 — Hello World del ESP32 (3-5 días)

- [ ] Crear proyecto PlatformIO en `firmware/`
- [ ] Conectar ESP32 al PC por USB
- [ ] Compilar y flashear un "Hello World" que parpadea LED y printa por Serial
- [ ] Configurar el partition table dual OTA (`partitions.csv` de la skill esp32-firmware)
- [ ] Verificar que el monitor serial funciona

**Criterio:** El ESP32 reinicia 3 veces y siempre printa "Hello VehicleGuard v0.0.1".

### Sprint 2 — Comunicación con SIM7600 (5-7 días)

- [ ] Cablear ESP32 ↔ SIM7600 por UART2 (TX/RX cruzados)
- [ ] Alimentar el SIM7600 con la fuente correcta (5V 2A mínimo)
- [ ] Implementar `ModemManager` que envía comandos AT y parsea respuestas
- [ ] Verificar respuesta de `AT` → `OK`
- [ ] Configurar APN, conectar a 4G, hacer un GET HTTPS a `https://example.com`

**Criterio:** El ESP32 imprime el HTML de example.com por serial usando datos del SIM. La conexión sobrevive 1 hora sin caerse.

### Sprint 3 — Lectura de GPS (2-3 días)

- [ ] Conectar antena GPS al SIM7600
- [ ] Habilitar GPS por AT (`AT+CGNSSPWR=1`, `AT+CGNSSCMD=...`)
- [ ] Parsear NMEA con TinyGPSPlus
- [ ] Lograr fix con cielo despejado en < 5 minutos

**Criterio:** Imprimes lat/lon válidas por serial y coinciden con tu ubicación real (verificar en Google Maps).

### Sprint 4 — Backend mínimo (5-7 días)

- [ ] Crear proyecto NestJS en `backend/`
- [ ] Setup de PostgreSQL + PostGIS por Docker Compose
- [ ] Schema Prisma con `User`, `Device`, `TelemetryPoint`, `License`
- [ ] Endpoints: `POST /auth/register`, `POST /auth/login`, `GET /devices`
- [ ] JWT auth con guard
- [ ] Test con Postman

**Criterio:** Te registras, haces login, y obtienes un JWT que te deja consumir `GET /devices` (vacío pero responde 200).

### Sprint 5 — Broker MQTT y bridge (3-5 días)

- [ ] Mosquitto local con docker-compose
- [ ] Configurar mTLS (generar CA propia, server cert, client cert de prueba)
- [ ] En el backend: `MqttBridgeService` que se suscribe a `devices/+/telemetry`
- [ ] Cuando llega un mensaje, lo guarda en `TelemetryPoint`

**Criterio:** Con MQTT Explorer publicas un payload de telemetry de prueba al topic correcto, y aparece en la base de datos.

### Sprint 6 — Firmware: publicar telemetría (5-7 días)

- [ ] En el firmware, integrar PubSubClient (TLS)
- [ ] Configurar el cliente con cert + clave (hardcodeados temporalmente, luego van a NVS)
- [ ] Publicar TelemetryMessage cada 10 segundos
- [ ] Manejar reconexión

**Criterio:** Con el ESP32 sobre tu mesa, ves en MQTT Explorer mensajes llegando cada 10s, y la tabla `TelemetryPoint` del Postgres se llena.

### Sprint 7 — App móvil mínima (7-10 días)

- [ ] `npx create-expo-app -t bare-minimum mobile`
- [ ] Login screen funcional contra el backend
- [ ] Lista de devices del usuario
- [ ] Pantalla "Live Map" con react-native-maps mostrando el último punto
- [ ] WebSocket subscrito a `/live` actualizando el marker en tiempo real

**Criterio:** Abres la app en tu celular, ves tu auto en el mapa moviéndose en tiempo real (mientras caminas con el ESP32 en la mano por la calle).

### Sprint 8 — Provisioning manual y NVS (3-5 días)

- [ ] Modo provisioning en el firmware (lee config por UART y guarda en NVS)
- [ ] Script `scripts/provision.py` que escribe `device_id`, `serial`, `mqtt_host`, certs en NVS
- [ ] Endpoint `POST /devices/claim` y QR scanner en la app

**Criterio:** Haces factory-reset del ESP32, lo provisionas con el script, escaneas el QR generado en la app, y el device queda asociado a tu cuenta. Telemetría sigue funcionando.

### Sprint 9 — Comando de corte (con safety guards) (5-7 días)

- [ ] Implementar `SafetyGuard` en firmware (regla del < 5km/h por > 10s)
- [ ] Cablear módulo relé + LED simulando motor (NO conectar a auto aún)
- [ ] Endpoint `POST /devices/:id/commands/kill` con doble validación server-side
- [ ] UI del kill switch con press-and-hold + biometría
- [ ] Mensaje firmado HMAC del backend al device

**Criterio:** Desde la app cortas la corriente del LED simulado. Si simulas movimiento (override de velocidad en firmware para test), el corte se rechaza correctamente.

### Sprint 10 — Tabletop testing (24-48h continuas)

- [ ] Dispositivo armado en una mesa con fuente de 12V
- [ ] Antena GPS visible al cielo
- [ ] Corre 24h sin reset, sin desconexión, sin gaps de telemetría > 1 min
- [ ] Prueba 10 ciclos kill/release
- [ ] Prueba reboot manual y verifica que el corte queda en estado seguro

**Criterio:** Completas las 24h sin issues. Si hay issues, se documentan y resuelven antes de avanzar.

### Sprint 11 — Instalación en TU vehículo (1-2 días)

Sigue el procedimiento de la skill `hardware-installation`:

- [ ] Identifica el cable de la bomba de combustible en tu Suzuki Gixxer 250 (consulta workshop manual)
- [ ] Instala con consentimiento + seguro
- [ ] Test estático: corte detenido, motor se apaga, vuelve a encender → ✓
- [ ] Test dinámico: andas 5 min a velocidad baja con tracking activo → ✓
- [ ] **NO testees el corte en marcha**
- [ ] Verifica antena GPS bien posicionada (fix < 5 min al arrancar)

**Criterio Fase 1:** Tu moto tiene un VehicleGuard funcional. Lo ves en el mapa cuando andas. Puedes cortar la corriente desde la app cuando está estacionada y vuelve a arrancar normal.

🎉 **Hito alcanzado:** Tienes un MVP funcional. Esto es lo que querías al inicio.

---

## Fase 2 — Replicar a más chips (4 semanas)

### Sprint 12 — OTA updates (1-2 semanas)

- [ ] Implementar `OtaUpdater` en firmware con verificación de firma
- [ ] Generar par de claves de firma; pública embedded en firmware
- [ ] CI que compila, firma y sube a S3 (o repositorio simple)
- [ ] `OtaService` en backend con canary rollout
- [ ] Test: subir versión 1.0.1 con cambio cosmético, verificar que tu device se actualiza solo

**Criterio:** Pushes una nueva versión y tu device se actualiza solo en < 10 min. Test de rollback funciona (si haces una build mala, vuelve sola a la anterior).

### Sprint 13 — Provisioning industrializado (3-5 días)

- [ ] Refinar el script `provision.py` para ser repetible
- [ ] Generar QRs imprimibles en lote
- [ ] Documentar checklist de burn-in de 24h por device

**Criterio:** Provisionar un nuevo chip toma < 30 minutos de tu tiempo activo (los burn-ins corren solos).

### Sprint 14 — Sensores de movimiento y vibración (1 semana)

- [ ] Agregar acelerómetro MPU6050 al ESP32 (~$2.000 CLP)
- [ ] Detectar `MOTION_DETECTED` cuando hay aceleración con auto apagado
- [ ] Detectar `VIBRATION_HIGH` (golpes) → push notification
- [ ] Modo alarma armable desde la app

**Criterio:** Pegas una patada al auto cuando está estacionado y armado, llega notificación al celular.

### Sprint 15 — Instalar en autos de amigos (1 semana, depende de coordinación)

- [ ] Provisionar 2-3 chips más
- [ ] Instalar en autos de amigos voluntarios (con consentimiento escrito)
- [ ] Cada amigo crea su cuenta y claim su device
- [ ] Monitorear durante 2 semanas: ¿hay bugs que solo aparecen con uso real?

**Criterio Fase 2:** 3-4 dispositivos en uso real, OTAs aplicándose correctamente, feedback recolectado.

---

## Fase 3 — Cámara interior (4-6 semanas)

Cuando estés listo. Esto es opcional para validar el modelo de negocio — el tracking + corte ya es vendible.

### Hitos clave

- [ ] Diseño 3D de la carcasa estilo "mascota redonda" (Blender o Fusion 360)
- [ ] Imprimir prototipo en una impresora 3D (servicio en Santiago: ~$15.000-30.000)
- [ ] Hardware: ESP32-CAM con OV2640 (~$8.000 CLP)
- [ ] Firmware streaming MJPEG / RTSP
- [ ] Storage de clips en S3 cuando hay eventos
- [ ] Vista en la app móvil

(Esta fase tendrá su propia skill `camera-streaming` cuando llegues.)

---

## Fase 4 — Cloud + multi-tenant + panel admin (6 semanas)

- Migrar backend a un VPS / cloud
- EMQX cluster
- Panel web admin (React + Vite) para tu uso
- Sistema de licenciamiento por feature funcional
- Onboarding self-service de nuevos usuarios

---

## Fase 5 — Comercialización (abierto)

- Constitución de empresa (SpA en Chile)
- Términos y condiciones, política de privacidad
- Pasarela de pago (Webpay, Mercado Pago)
- Marketing y primeros clientes
- AI insights (conducción agresiva, predicción de mantenimiento)

---

## Tiempo total estimado

| Fase | Tiempo | Resultado |
|------|--------|-----------|
| Fase 0 | 1-2 sem (gating en envío de hardware) | Ambiente listo |
| Fase 1 | 4-6 sem | MVP en tu moto |
| Fase 2 | 4 sem | 3-4 devices en amigos, OTA |
| Fase 3 | 4-6 sem | Cámara interior |
| Fase 4 | 6 sem | Backend cloud, panel admin |
| Fase 5 | abierto | Producto comercial |

**Las primeras 3 fases (~14-18 semanas, ~4 meses) son el "punto de no retorno" comercial.** Después decides si es viable o pivotas.

---

## Reglas para no descarrilar

1. **No comiences Fase N+1 hasta cumplir el criterio de salida de Fase N.**
2. **Documenta cada sprint en `docs/STATUS.md`.**
3. **Si un sprint dura > 2x el estimado, pausa y replantea — algo está mal.**
4. **Test en hardware real antes de dar por hecho cualquier cosa.** El simulador miente, el hardware dice la verdad.
5. **No agregues features fuera del roadmap actual.** Lleva una libreta `docs/IDEAS.md` con todo lo que se te ocurra y revísala al planificar la próxima fase.
