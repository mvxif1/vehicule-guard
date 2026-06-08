111# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Este archivo es el **contexto maestro** del proyecto. Claude Code lo lee automáticamente al inicio de cada sesión. Manténlo actualizado: cuando cambie una decisión arquitectónica, este archivo es la primera fuente de verdad.

---

## Comandos esenciales

### Firmware (ESP32 — PlatformIO)
```bash
# Compilar
pio run -d firmware

# Compilar y flashear al ESP32 (debe estar conectado por USB)
pio run -d firmware --target upload

# Monitor serial (ver logs del ESP32 en tiempo real)
pio device monitor -d firmware --baud 115200

# Compilar + flashear + monitor en un solo comando
pio run -d firmware --target upload && pio device monitor -d firmware --baud 115200

# Limpiar build
pio run -d firmware --target clean
```

### Backend (NestJS)
```bash
cd backend

# Instalar dependencias
npm install

# Desarrollo con hot-reload
npm run start:dev

# Build producción
npm run build

# Tests unitarios
npm test

# Un solo test
npm test -- --testPathPattern=nombre.spec.ts

# Tests con cobertura
npm run test:cov

# Lint
npm run lint
```

### Infraestructura local (Docker)
```bash
cd backend

# Levantar PostgreSQL + Mosquitto
docker compose up -d

# Ver logs del broker MQTT
docker compose logs -f mosquitto

# Detener todo
docker compose down
```

### Estado del proyecto
Siempre leer `docs/STATUS.md` al inicio de sesión para contexto de la última sesión.

---

## 1. Identidad del proyecto

**Nombre:** VehicleGuard
**Tipo:** Sistema IoT de telemática y seguridad vehicular (B2B + B2C)
**Owner:** Maximiliano Ferrer Romero
**Estado actual:** Fase 1 — Prototipo WiFi+GPS funcionando en mesa
**Stack confirmado:**
- Hardware: ESP32 DevKit V1 (USB-C) + GPS Neo-6M — prototipo. Fase 1 real: + módulo SIM7600 4G/GPS
- Firmware: PlatformIO con framework Arduino (C++)
- Backend: NestJS (Node.js) + PostgreSQL/PostGIS + MQTT broker (Mosquitto / EMQX)
- Móvil: React Native (Expo bare workflow) — iOS y Android
- Cloud (futuro): AWS o GCP (decidir en Fase 4)
- Cámara: dispositivo separado (ESP32-CAM o IP cam con RTSP) — Fase 3+

---

## Objetivo final del proyecto

VehicleGuard es un **dispositivo físico instalable en cualquier vehículo** (auto, moto, camioneta) que se controla desde una **app móvil iOS y Android**.

### Lo que el usuario final podrá hacer desde la app

- **Ver en el mapa** dónde está su vehículo en tiempo real (GPS live tracking)
- **Historial de rutas** — todos los trayectos con fecha, hora, km recorridos y velocidad máxima
- **Encender y apagar el motor remotamente** desde el celular (kill switch vía relé)
- **Geocercas** — definir zonas en el mapa y recibir notificación si el vehículo entra o sale
- **Alertas de movimiento** — notificación si el vehículo se mueve sin encendido (posible robo)
- **Métricas de uso** — km acumulados, consumo estimado de combustible, trayectos por día/semana
- **Cámara interior** (Fase 3) — ver video en vivo desde el interior del vehículo

### Flujo completo de uso

```
Usuario compra el dispositivo
        ↓
Instala el dispositivo en su vehículo (OBD-II o cableado directo a 12V)
        ↓
Descarga la app → crea cuenta → escanea QR del dispositivo
        ↓
El dispositivo aparece en la app con su ubicación en tiempo real
        ↓
Desde la app puede: ver mapa, ver historial, activar kill switch, configurar alertas
```

### Por qué una app móvil y no web

El tracking vehicular es una necesidad móvil por naturaleza — el usuario está en la calle, recibe una alerta de que su auto se movió a las 3am, y necesita actuar desde el celular en segundos. Una app nativa con push notifications y mapas offline es el canal correcto. El panel web admin (para flotas y empresas) es Fase 4.

---

## 2. Visión y propuesta de valor

VehicleGuard es un dispositivo OBD/12V instalable en cualquier vehículo (auto, moto, camioneta) que permite al usuario:

- **Tracking en tiempo real** (GPS, velocidad, ruta, geocercas)
- **Encendido/apagado remoto** y **corte de corriente** (relé controlado)
- **Detección de movimiento y vibración** (acelerómetro/giroscopio)
- **Cámara interior independiente** con diseño propio inspirado en el form factor "Dasai Mochi" (mascota redonda, amigable, no copiada)
- **Métricas de uso:** km recorridos, trayectos, consumo estimado de combustible
- **Multi-tenant:** un admin puede gestionar varios dispositivos (flota o amigos)
- **Provisioning escalable:** comprar un nuevo chip → flashearlo → aparece en la app

### Diferenciador clave (valor agregado)

Tres ejes que nos separan de Cobra, LoJack, Hunter Pro, Tracker, etc:

1. **Cámara interior con personalidad propia** (form factor mascota, no caja industrial fea). Esto crea apego emocional y es vendible al mercado familiar.
2. **Modelo de licenciamiento por feature** — el corte de corriente, la cámara, las geocercas avanzadas, el reporte mensual a la empresa, etc., se activan/desactivan desde el panel de admin remotamente. Cobramos más por features premium sin cambiar el hardware.
3. **AI insights** (Fase 5): detección de conducción agresiva, predicción de mantenimiento por patrones de vibración, y alertas inteligentes (no solo "el auto se movió" sino "el auto se movió de forma incompatible con uso normal a las 3am").

---

## 3. Roadmap de fases

| Fase | Objetivo | Duración estimada |
|------|----------|-------------------|
| **Fase 0** | Compra de hardware + ambiente de desarrollo | 1–2 semanas |
| **Fase 1 — MVP** | 1 chip funcionando en mi auto: GPS + on/off + corte de corriente + app básica | 4–6 semanas |
| **Fase 2** | Multi-dispositivo, provisioning OTA, sensores de movimiento/vibración | 4 semanas |
| **Fase 3** | Cámara interior independiente (ESP32-CAM con diseño propio) | 4–6 semanas |
| **Fase 4** | Backend escalable en cloud, multi-tenant, panel admin web, licenciamiento por feature | 6 semanas |
| **Fase 5** | AI insights, comercialización, certificaciones | abierto |

**El MVP de la Fase 1 es lo único que importa ahora.** No optimizar antes de tiempo. No construir cámara antes de tener el tracking estable.

---

## 4. Arquitectura de alto nivel

```
┌─────────────────────┐         ┌─────────────────────┐
│   ESP32 + SIM7600   │  MQTT   │   Mosquitto/EMQX    │
│   (en el vehículo)  │ ◄─────► │   (broker pub/sub)  │
│   - GPS             │  TLS    │                     │
│   - Acelerómetro    │         └──────────┬──────────┘
│   - Relé corte 12V  │                    │
│   - Botón pánico    │                    │ MQTT
└─────────────────────┘                    ▼
                                ┌─────────────────────┐
                                │   NestJS Backend    │
                                │   - REST API        │
                                │   - WebSockets      │
                                │   - JWT auth        │
                                │   - Device registry │
                                └──────────┬──────────┘
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                       ┌──────────┐  ┌──────────┐  ┌──────────┐
                       │PostgreSQL│  │  Redis   │  │   S3     │
                       │ + Postgis│  │  (cache) │  │ (vídeos) │
                       └──────────┘  └──────────┘  └──────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │  React Native (móvil)   │
                              │  + Web admin (futuro)   │
                              └─────────────────────────┘
```

**Decisiones arquitectónicas clave:**

- **MQTT** sobre HTTP para comunicación dispositivo↔backend: menor consumo de datos móviles, soporte nativo para mensajes pequeños frecuentes, QoS configurable, retención de mensajes para offline.
- **PostGIS** sobre Postgres puro: consultas espaciales (geocercas, búsquedas por radio) son nativas y rápidas.
- **WebSocket** entre backend y app móvil: tracking en tiempo real sin polling.
- **JWT con refresh tokens** + **mTLS por dispositivo**: cada chip tiene su propio certificado X.509 firmado por nuestra CA.
- **OTA updates firmados**: cada firmware se firma con clave privada; el ESP32 verifica firma antes de aplicar.

---

## 5. Cumplimiento legal (Chile — IMPORTANTE)

Maximiliano está en Chile. Aspectos legales que **no podemos ignorar** desde el día 1:

- **Ley 19.628** (Protección de datos personales) — la ubicación GPS y vídeo son datos personales sensibles. Requerimos consentimiento explícito del conductor.
- **SUBTEL** — los dispositivos que transmiten radiofrecuencia (4G) deben usar módulos certificados o el producto comercial requerirá homologación.
- **Corte de corriente remoto**: jurídicamente delicado. Apagar un vehículo en movimiento puede causar accidentes. **REGLA DURA: el corte solo se permite si el vehículo está detenido (velocidad GPS < 5 km/h por al menos 10 segundos)**. Esta lógica vive en el firmware, no en el backend, para que no dependa de conectividad.
- **Comercialización**: si vendemos a empresas, necesitaremos eventualmente SII, contrato de prestación de servicios, política de privacidad, términos y condiciones.

Estos puntos **no son opinión legal profesional** — Maximiliano debe consultar con un abogado antes de comercializar. Pero el código debe estar diseñado defensivamente desde el inicio.

---

## 6. Estructura del repositorio

```
vehicle-guard/
├── CLAUDE.md                    ← este archivo
├── README.md                    ← punto de entrada humano
├── .claude/
│   ├── master-prompt.md         ← rol del agente principal
│   └── skills/                  ← skills especializadas
│       ├── esp32-firmware/
│       ├── nestjs-backend/
│       ├── react-native-mobile/
│       ├── hardware-installation/
│       ├── vehicle-security/
│       ├── ota-updates/
│       ├── device-provisioning/
│       ├── mqtt-protocol/
│       ├── gps-telemetry/
│       └── project-orchestrator/
├── docs/
│   ├── roadmap/                 ← guía paso a paso
│   ├── hardware/                ← lista de compras, esquemáticos
│   └── diagrams/                ← diagramas de arquitectura, instalación
├── firmware/                    ← código ESP32 (PlatformIO)
├── backend/                     ← NestJS API + MQTT bridge
├── mobile/                      ← React Native app
├── hardware-design/             ← PCB, modelo 3D de la cámara
└── scripts/                     ← utilidades (provisioning, OTA, build)
```

---

## 7. Convenciones de código

- **Idioma del código:** inglés (variables, funciones, comentarios técnicos).
- **Idioma de documentación y commits descriptivos:** español (Maximiliano es chileno, los stakeholders son hispanohablantes).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- **Branches:** `main` protegida, `develop` para integración, `feature/<nombre>` para features.
- **Tests:** todo módulo de backend debe tener tests unitarios. Firmware debe tener al menos pruebas en tabletop antes de instalar en vehículo real.
- **Secretos:** nunca en el repo. Usar `.env` local + variables de entorno en producción. Para el firmware, NVS (Non-Volatile Storage) cifrada del ESP32.

---

## 8. Reglas de oro para Claude Code

Cuando trabajes en este repo, recuerda:

1. **Leer primero, escribir después.** Antes de modificar un archivo, léelo. Antes de crear arquitectura, lee `CLAUDE.md` y los SKILL.md relevantes.
2. **Consulta el master-prompt.md** para entender tu rol y los límites de autonomía.
3. **Una sola fase a la vez.** Si Maximiliano pide algo de Fase 3 mientras estamos en Fase 1, recordarle el roadmap y preguntarle si quiere desviarse.
4. **Seguridad por encima de features.** El corte de corriente nunca debe ser fácil de explotar. La autenticación nunca debe tener bypass.
5. **Costos en mente.** Maximiliano financia esto personalmente. Antes de proponer un servicio cloud caro, verificar alternativas open-source.
6. **Pregunta antes de asumir.** Si el contexto no aclara una decisión técnica significativa (e.g., ¿qué proveedor de SIM card usar en Chile?), preguntar antes de codificar contra un supuesto.
7. **Documenta decisiones**. Cuando se tome una decisión arquitectónica importante, agregarla a `docs/decisions/ADR-XXX.md` (Architecture Decision Records).

---

## 9. Lo que NO está en alcance (todavía)

Para evitar scope creep, estas cosas están explícitamente fuera del MVP:

- ❌ App web de admin (la Fase 1 es solo móvil)
- ❌ Cámara (Fase 3)
- ❌ Multi-idioma (default español, inglés viene después)
- ❌ Pasarela de pago (cuando comercialicemos en Fase 5)
- ❌ Integración con seguros vehiculares
- ❌ Bluetooth con el celular del usuario (las primeras versiones usan solo 4G)
- ❌ App para Apple Watch / Wear OS

Si Maximiliano pide algo de esta lista, recordarle el alcance y solo proceder con consentimiento explícito.

---

## 10. Glosario

- **OBD-II**: Conector estándar de diagnóstico vehicular (en autos post-2008 en Chile aprox). Permite alimentación y lectura de datos del motor.
- **Geocerca (geofence)**: Polígono virtual; cuando el vehículo entra/sale, se dispara una alerta.
- **Provisioning**: Proceso de inicializar un chip nuevo y vincularlo a una cuenta de usuario.
- **OTA (Over-The-Air)**: Actualización de firmware remota.
- **MQTT**: Protocolo pub/sub liviano, estándar de IoT.
- **mTLS**: TLS mutuo — cliente y servidor se autentican mutuamente con certificados.
- **NVS**: Non-Volatile Storage del ESP32 (key-value persistente).
- **Lambda Architecture**: Patrón de procesamiento de datos con capas batch y stream (Maximiliano ya conoce esto de su trabajo en Big Data — relevante para Fase 5 cuando agreguemos analytics).

---

**Última actualización:** Fase 0 — versión inicial del documento.
**Mantenedor:** Maximiliano Ferrer Romero + Claude (asistente).
