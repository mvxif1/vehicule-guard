# Estado del proyecto — 2026-05-06

> Este archivo se actualiza al final de cada sesión de trabajo. Contiene el estado real del proyecto y los pendientes inmediatos. Es la primera cosa que Claude debería leer (después de CLAUDE.md) al inicio de una sesión nueva.

---

## Fase actual

**Fase 1 — MVP (prototipo WiFi+GPS en mesa)**

## Avances confirmados

- ✅ Ambiente de desarrollo completo: VS Code + PlatformIO 6.1.19 + NestJS CLI + extensiones
- ✅ Proyecto firmware inicializado en `firmware/` (PlatformIO, board esp32dev, framework arduino)
- ✅ Proyecto backend inicializado en `backend/` (NestJS 11, Node 22)
- ✅ Docker Compose configurado en `backend/docker-compose.yml` (PostgreSQL/PostGIS + Mosquitto)
- ✅ Hardware comprado: ESP32 DevKit V1 USB-C, GPS Neo-6M, relé 5V, LM2596, dupont, protoboard
- ✅ GPS Neo-6M conectado y leyendo datos NMEA correctamente en monitor serial
- ✅ Guía de conexiones: `docs/hardware/conexiones-protoboard.md`
- ✅ Guía paso a paso Fase 1: `docs/roadmap/fase1-prototipo-paso-a-paso.md`

## Decisiones tomadas

- **Prototipo usa WiFi** en lugar de SIM7600 para reducir costo (~$20.000 CLP). SIM7600 se agrega después.
- **ESP32 DevKit V1 de 38 pines con USB-C** — requiere driver CP210x (Silicon Labs) en Windows
- **Sin soldadura en prototipo** excepto: header pins del GPS Neo-6M (4 puntos simples, inevitable)
- **Relé usa VIN (5V), GPS usa 3V3** — crítico no confundir

## Pendientes inmediatos

- [ ] Instalar Docker Desktop
- [ ] Soldar header pins al GPS Neo-6M
- [ ] Levantar broker con `docker compose up -d` en `backend/`
- [ ] Editar `firmware/src/config.h` con SSID, password y IP del PC (ver con `ipconfig`)
- [ ] Flashear firmware completo (código en `docs/roadmap/fase1-prototipo-paso-a-paso.md` Paso 7)
- [ ] Verificar telemetría llegando en MQTT Explorer cada 10 segundos

## Bloqueadores

- GPS Neo-6M necesita soldadura de header pins
- Docker Desktop no instalado aún

## Notas para Claude (próxima sesión)

- Maximiliano es nuevo en electrónica — explicar conceptos básicos cuando sea necesario
- Tiene experiencia sólida en .NET, SQL Server y Big Data (GCP) — el backend NestJS le será familiar
- Presupuesto personal, optimizar costos siempre
- Suzuki Gixxer 250 será la primera moto a instrumentar

## Próximo hito medible

Ver coordenadas GPS reales publicándose como mensajes MQTT en MQTT Explorer.
