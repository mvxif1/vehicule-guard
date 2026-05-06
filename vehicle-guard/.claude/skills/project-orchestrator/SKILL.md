---
name: project-orchestrator
description: Use this skill at the START of every new session in the VehicleGuard repo, OR whenever Maximiliano asks "what's next", "where are we", "what should I do today", or describes a high-level goal that spans multiple subsystems (firmware + backend + mobile). Also use when reviewing the current phase, planning a sprint, or deciding which skills to activate. This skill is the entry point that orchestrates all other skills.
---

# Project Orchestrator

Skill maestra que coordina el trabajo entre las demás skills del proyecto VehicleGuard. Su rol es darte el contexto correcto, identificar la fase actual y decidir qué otras skills activar.

## Cuándo usarme

Activa esta skill cuando:
- Inicia una sesión nueva en el repositorio
- Maximiliano describe un objetivo amplio que cruza varios subsistemas
- Hay duda sobre en qué fase del roadmap estamos
- Se necesita planificar un sprint o sesión de trabajo
- Maximiliano pregunta "¿qué sigue?" o "¿en qué orden hago esto?"

## Workflow

### Paso 1: Refrescar contexto

```
1. Lee CLAUDE.md completo
2. Lee docs/STATUS.md si existe (estado del proyecto al cierre de la última sesión)
3. Revisa el último commit con: git log -1 --stat
```

### Paso 2: Identificar fase actual

Basándote en lo leído, determina en cuál de estas fases está el proyecto:

| Fase | Indicador | Skills primarias |
|------|-----------|------------------|
| **Fase 0** — Setup | No hay hardware comprado o ambiente sin instalar | `hardware-installation` (lista de compras), `device-provisioning` |
| **Fase 1** — MVP | Hardware llegó pero no hay firmware funcionando, o backend/app no existen aún | `esp32-firmware`, `nestjs-backend`, `react-native-mobile`, `mqtt-protocol`, `gps-telemetry` |
| **Fase 2** — Multi-dispositivo | MVP funciona en 1 chip, replicar a más | `device-provisioning`, `ota-updates` |
| **Fase 3** — Cámara | Tracking estable, agregar visión | (nueva skill `camera-streaming`, aún no creada) |
| **Fase 4** — Cloud + multi-tenant | Hay múltiples usuarios, falta panel admin | `nestjs-backend` (avanzado), nueva skill `admin-panel` |
| **Fase 5** — AI/comercialización | Producto vendible, optimizar | nuevas skills de ML/business |

### Paso 3: Plan de sesión

Una vez identificada la fase, propón a Maximiliano un plan corto:

```markdown
**Fase actual:** Fase 1 — MVP
**Última cosa hecha:** Configuración de PlatformIO para ESP32-DevKit-V1
**Próximos 3 candidatos para hoy:**

1. 🔧 Conectar el SIM7600 al ESP32 y verificar comunicación AT por UART
2. 🛰️ Leer GPS NMEA y publicar a MQTT cada 10 segundos (requiere broker)
3. 🧪 Setup del MQTT broker local con Mosquitto en tu PC para pruebas

¿Cuál atacamos? Cualquier respuesta corta sirve ("1", "el MQTT", etc).
```

Si Maximiliano elige uno, **carga las skills correspondientes** (no antes).

### Paso 4: Cierre de sesión

Cuando Maximiliano dice "cerremos" o terminamos un bloque grande, actualiza `docs/STATUS.md` con:

```markdown
# Estado del proyecto — [fecha]

## Última fase trabajada
Fase 1 — MVP

## Avances de la sesión
- [bullets concretos]

## Pendientes inmediatos (próxima sesión)
- [ ] tarea 1
- [ ] tarea 2

## Bloqueadores
- ninguno / [descripción]

## Notas para Claude (próxima sesión)
- [contexto que sería caro reconstruir]
```

## Reglas que aplico siempre

1. **Una fase a la vez.** Si Maximiliano pide algo de Fase 3 estando en Fase 1, le recuerdo el roadmap y le pregunto si quiere desviarse.
2. **No paralelismo prematuro.** No empezamos backend antes de tener firmware leyendo GPS.
3. **Documentación fluye conmigo.** Cada decisión arquitectónica significativa va a `docs/decisions/ADR-NNN.md`.
4. **Costos visibles.** Si una decisión implica un gasto (servicio cloud, hardware adicional), lo menciono explícitamente.

## Mapa de dependencias entre skills

```
project-orchestrator (yo)
    │
    ├─► hardware-installation ─► device-provisioning ─► esp32-firmware
    │                                                        │
    │                                                        ▼
    │                                                  mqtt-protocol
    │                                                        │
    │                                                        ▼
    └─► nestjs-backend ◄─────────────────────────── gps-telemetry
              │                                              │
              ▼                                              ▼
       react-native-mobile ◄──────────────────────── vehicle-security
                                                            │
                                                            ▼
                                                      ota-updates
```

Una flecha A → B significa "B depende de que A esté al menos parcialmente lista".

## Plantilla de respuesta para "¿qué hago hoy?"

```markdown
Estamos en **Fase X — [nombre]**. Lo último que hicimos fue [resumen 1 línea].

Tres opciones para hoy, ordenadas por impacto:

**Opción A — [nombre]** (~Xh)
[descripción corta + qué skill se activa]

**Opción B — [nombre]** (~Xh)
[...]

**Opción C — [nombre]** (~Xh)
[...]

Mi recomendación: **A**, porque [razón].

¿Cuál?
```
