# VehicleGuard

> Dispositivo IoT de telemática y seguridad vehicular. Tracking GPS en tiempo real, control remoto del motor, detección de movimiento/vibración, cámara interior con personalidad propia. Para uso personal y flotas.

[![Estado](https://img.shields.io/badge/estado-Fase%200-orange)]()
[![Licencia](https://img.shields.io/badge/licencia-Privada-red)]()

---

## ¿Qué es esto?

VehicleGuard es un proyecto personal de Maximiliano Ferrer Romero para construir un dispositivo IoT vehicular vendible al mercado individual y empresarial, con un enfoque diferente al de los productos existentes (Cobra, LoJack, Hunter Pro):

1. **Cámara interior con form factor amigable** (estilo mascota), no caja industrial fea.
2. **Modelo de licenciamiento por feature** — pagas más solo por lo que usas.
3. **AI insights futuros** — no solo "el auto se movió", sino "el auto se movió de forma incompatible con el patrón habitual del dueño".

## Empezar acá

🤖 **Si eres Claude (o cualquier IA asistente):**
Lee, en este orden, antes de hacer cualquier otra cosa:
1. [`CLAUDE.md`](./CLAUDE.md) — contexto completo del proyecto
2. [`.claude/master-prompt.md`](./.claude/master-prompt.md) — tu rol y comportamiento esperado
3. [`.claude/skills/project-orchestrator/SKILL.md`](./.claude/skills/project-orchestrator/SKILL.md) — cómo coordinar el trabajo
4. [`docs/STATUS.md`](./docs/STATUS.md) — estado actual del proyecto

👤 **Si eres humano (Maximiliano u otro colaborador):**
1. Lee [`docs/roadmap/ROADMAP.md`](./docs/roadmap/ROADMAP.md) para saber dónde estamos.
2. Lee [`CLAUDE.md`](./CLAUDE.md) para entender la arquitectura y decisiones.
3. Si vas a contribuir código, mira la skill correspondiente al subsistema en `.claude/skills/`.

---

## Stack

- **Hardware:** ESP32 + módulo SIM7600G-H (4G LTE + GPS)
- **Firmware:** C++ con Arduino sobre PlatformIO, FreeRTOS
- **Backend:** NestJS + PostgreSQL/PostGIS + MQTT (Mosquitto/EMQX) + Redis
- **Móvil:** React Native (Expo bare workflow) + TypeScript
- **Infra (futuro):** VPS o AWS/GCP, EMQX clustered, S3 para storage de vídeo

## Estructura del repositorio

```
vehicle-guard/
├── CLAUDE.md                    Contexto maestro del proyecto
├── README.md                    Este archivo
├── .claude/
│   ├── master-prompt.md         System prompt del agente principal
│   └── skills/                  Skills especializadas (10 skills)
├── docs/
│   ├── roadmap/                 Roadmap detallado por fases
│   ├── hardware/                BOM, esquemáticos, fotos de referencia
│   ├── diagrams/                Arquitectura, flujos
│   └── STATUS.md                Estado actual (actualizado cada sesión)
├── firmware/                    Código C++ del ESP32 (PlatformIO)
├── backend/                     NestJS API + MQTT bridge
├── mobile/                      App React Native
├── hardware-design/             Diseño de PCB y carcasa 3D
└── scripts/                     Provisioning, OTA, build automation
```

## Skills disponibles para Claude

| Skill | Propósito |
|-------|-----------|
| `project-orchestrator` | Meta-skill que coordina todas las demás |
| `esp32-firmware` | Firmware del dispositivo |
| `nestjs-backend` | API + MQTT bridge + DB |
| `react-native-mobile` | App móvil |
| `hardware-installation` | Compras, cableado, instalación física |
| `vehicle-security` | Lógica del corte de corriente, anti-tampering |
| `ota-updates` | Actualización remota de firmware firmada |
| `device-provisioning` | Flashear y vincular nuevos chips |
| `mqtt-protocol` | Contrato de mensajes entre device y backend |
| `gps-telemetry` | Procesamiento de GPS, trayectos, geocercas |

## Roadmap resumido

- **Fase 0** — Setup de ambiente y compra de hardware (1-2 sem)
- **Fase 1** — MVP: 1 chip en auto con GPS + corte + app (4-6 sem) ← **acá empezamos**
- **Fase 2** — Multi-dispositivo + OTA + sensores (4 sem)
- **Fase 3** — Cámara interior estilo mascota (4-6 sem)
- **Fase 4** — Cloud + panel admin + licenciamiento (6 sem)
- **Fase 5** — Comercialización + AI insights (abierto)

Detalle completo en [`docs/roadmap/ROADMAP.md`](./docs/roadmap/ROADMAP.md).

## Cómo trabajar con este proyecto en Claude Code

```bash
cd vehicle-guard
claude
```

Claude Code leerá automáticamente `CLAUDE.md` y tendrá disponibles las skills del directorio `.claude/skills/`. Empieza preguntándole:

> "¿En qué fase del roadmap estamos? ¿Qué tres opciones tengo para hoy?"

Y deja que el agente cargue las skills relevantes para tu tarea.

## Aspectos legales (Chile)

- Datos personales (ubicación, vídeo) sujetos a Ley 19.628.
- Dispositivos 4G requieren módulos certificados y eventual homologación SUBTEL.
- Corte remoto de motor: **solo con vehículo detenido < 5 km/h por > 10s**, regla aplicada en firmware.
- Comercialización futura requiere consultoría legal antes de salir al mercado.

Detalles en [`CLAUDE.md`](./CLAUDE.md).

## Licencia

Privado. © Maximiliano Ferrer Romero, 2026. Todos los derechos reservados.

Cuando se comercialice, evaluaremos licenciamiento dual (OSS para firmware no-crítico, propietario para componentes diferenciadores).

---

**Mantenedor:** Maximiliano Ferrer Romero
**Stack actual:** Fase 0 — Setup
**Última actualización:** Generación inicial del proyecto
