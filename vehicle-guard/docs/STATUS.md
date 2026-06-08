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

- [ ] Instalar Docker Desktop → https://www.docker.com/products/docker-desktop/
- [x] Conectar GPS Neo-6M al ESP32 (GPIO16=RX, GPIO17=TX, 3V3, GND) ← **hecho**
- [ ] Editar `firmware/src/config.h` con SSID, password y la IP de tu PC (`ipconfig`)
- [ ] Flashear firmware: `pio run -d firmware --target upload`
- [ ] Levantar broker: `cd backend && docker compose up -d`
- [ ] Verificar telemetría en MQTT Explorer suscrito a `devices/#`

## Bloqueadores

- Docker Desktop no instalado aún (necesario para levantar Mosquitto + PostgreSQL)

## Notas para Claude (próxima sesión)

- Maximiliano es nuevo en electrónica — explicar conceptos básicos cuando sea necesario
- Tiene experiencia sólida en .NET, SQL Server y Big Data (GCP) — el backend NestJS le será familiar
- Presupuesto personal, optimizar costos siempre
- Suzuki Gixxer 250 será la primera moto a instrumentar

## Próximo hito medible

Ver coordenadas GPS reales publicándose como mensajes MQTT en MQTT Explorer.
