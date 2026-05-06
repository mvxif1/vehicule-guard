---
name: gps-telemetry
description: Use this skill when working on GPS data parsing (NMEA), location accuracy, trajectory simplification, geofence calculations, distance computation, fuel consumption estimation, trip detection, speed smoothing, or any algorithm that processes location/sensor data. Triggers on "GPS", "NMEA", "ubicación", "trayecto", "ruta", "geocerca", "geofence", "kilómetros recorridos", "consumo de combustible", "Haversine", "interpolación de posición", "speed filter".
---

# GPS & Telemetry Processing

Skill enfocada en cómo procesar correctamente datos de ubicación y sensores. Esto importa porque:
- Datos crudos del GPS son ruidosos (saltos, jitter, deriva en interiores).
- Calcular kilómetros mal hace que el feature de "trayecto" sea inútil.
- Geocercas mal hechas generan falsos positivos.

## NMEA — qué leer del SIM7600

El SIM7600 entrega NMEA estándar por UART o por comando AT (`AT+CGNSSINFO`). Sentencias relevantes:

- **$GNRMC** — Recommended Minimum: lat, lon, speed, heading, fecha, hora.
- **$GNGGA** — Fix data: cantidad de satélites, HDOP, altitud.
- **$GNGSA** — Status: PDOP, HDOP, VDOP.
- **$GNGSV** — Satélites visibles (útil para diagnóstico).

```cpp
// Usando TinyGPSPlus
TinyGPSPlus gps;

void readGps() {
    while (modemSerial.available()) {
        char c = modemSerial.read();
        if (gps.encode(c)) {
            // sentencia completa parseada
        }
    }
    if (gps.location.isUpdated() && gps.location.isValid()) {
        TelemetryPoint p;
        p.lat = gps.location.lat();
        p.lon = gps.location.lng();
        p.speedKmh = gps.speed.kmph();
        p.heading = gps.course.deg();
        p.satellites = gps.satellites.value();
        p.hdop = gps.hdop.hdop();
        // emitir solo si pasa el filtro de calidad
        if (qualityFilter(p)) emit(p);
    }
}
```

## Filtros de calidad — antes de emitir un punto

Un punto debería emitirse solo si:

```cpp
bool qualityFilter(const TelemetryPoint& p) {
    if (p.satellites < 4)         return false;   // sin fix válido
    if (p.hdop > 5.0)             return false;   // muy mala precisión
    if (p.speedKmh > 250)         return false;   // outlier obvio
    if (jumpedTooFar(p, lastValidPoint)) return false;  // glitch
    return true;
}

bool jumpedTooFar(const TelemetryPoint& curr, const TelemetryPoint& last) {
    double dKm = haversineKm(curr, last);
    double dt = curr.ts - last.ts;
    if (dt <= 0) return true;
    double speedImpliedKmh = (dKm / dt) * 3600;
    return speedImpliedKmh > 200;  // implausible
}
```

## Distancia — fórmula Haversine

Para calcular distancia entre dos puntos GPS:

```cpp
double haversineKm(double lat1, double lon1, double lat2, double lon2) {
    constexpr double R = 6371.0;  // radio Tierra km
    double dLat = radians(lat2 - lat1);
    double dLon = radians(lon2 - lon1);
    double a = sin(dLat/2) * sin(dLat/2) +
               cos(radians(lat1)) * cos(radians(lat2)) *
               sin(dLon/2) * sin(dLon/2);
    return 2 * R * asin(sqrt(a));
}
```

Para distancias < 50km, también funciona la aproximación equirectangular (más rápida):

```cpp
double approxKm(double lat1, double lon1, double lat2, double lon2) {
    double x = radians(lon2 - lon1) * cos(radians((lat1+lat2)/2));
    double y = radians(lat2 - lat1);
    return sqrt(x*x + y*y) * 6371.0;
}
```

## Detección de trips (trayectos)

Un trip es un segmento entre `IGNITION_ON` y `IGNITION_OFF`. Reglas:

- Trip empieza cuando: ignición ON + se detecta movimiento (> 5 km/h por > 10s).
- Trip termina cuando: ignición OFF + auto detenido (< 1 km/h por > 60s).
- Si pasa > 5 minutos detenido pero ignición sigue ON (semáforo largo, congestión), **no** se cierra el trip — es el mismo viaje.
- Si la ignición se apaga pero el auto se mueve (parking en pendiente, remolque), se cierra el trip y se marca como anomalía.

Estructura de un trip almacenado:

```typescript
{
  id: uuid,
  deviceId: string,
  startedAt: timestamp,
  endedAt: timestamp,
  startLat, startLon, startAddress,
  endLat, endLon, endAddress,
  distanceKm: number,
  durationMin: number,
  maxSpeedKmh: number,
  avgSpeedKmh: number,
  fuelEstimateL: number,
  pathSimplified: GeoJSON.LineString,  // simplificado
  pathFull?: ref-to-blob               // completo en S3 si se necesita
}
```

## Simplificación de rutas (Douglas-Peucker)

Almacenar todos los puntos GPS de un trip de 30 km es ~3000 puntos. Inviable de cargar en mapas.

Aplicar **Douglas-Peucker** con tolerancia de ~10m reduce a 100-300 puntos manteniendo la forma:

```typescript
function douglasPeucker(points: LatLng[], tolMeters: number): LatLng[] {
  if (points.length < 3) return points;
  
  // distancia perpendicular máxima de un punto al segmento extremos
  const [first, last] = [points[0], points[points.length - 1]];
  let maxDist = 0;
  let maxIdx = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  
  if (maxDist > tolMeters) {
    const left  = douglasPeucker(points.slice(0, maxIdx + 1), tolMeters);
    const right = douglasPeucker(points.slice(maxIdx),       tolMeters);
    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}
```

## Estimación de consumo de combustible

Sin lectura del CAN-bus (que requeriría más hardware), estimamos por modelo:

```typescript
function estimateFuelL(distanceKm: number, vehicleSpec: VehicleSpec, drivingProfile: DrivingProfile): number {
  // base: consumo declarado
  const baseLper100 = vehicleSpec.avgConsumptionLper100km;
  
  // ajustes por estilo de manejo
  let factor = 1.0;
  if (drivingProfile.harshAccelerations > 5) factor += 0.10;
  if (drivingProfile.maxSpeedKmh > 120)      factor += 0.15;
  if (drivingProfile.idleMinutes > 10)       factor += 0.05;
  
  return (distanceKm / 100) * baseLper100 * factor;
}
```

Esto es aproximado. Para precisión real necesitamos OBD-II PID 0x5E (fuel rate) que viene en autos modernos. Considerarlo en Fase 3+.

## Geocercas (geofences)

### Tipos

1. **Circular**: centro + radio. Simple, rápido.
2. **Polygonal**: lista de vértices. Más flexible (forma irregular del estacionamiento, barrio).

### Detección de entrada/salida

```typescript
// Circular
function isInsideCircle(point: LatLng, center: LatLng, radiusM: number): boolean {
  return haversineMeters(point, center) <= radiusM;
}

// Polygonal — ray casting
function isInsidePolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon, yi = polygon[i].lat;
    const xj = polygon[j].lon, yj = polygon[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
                      (point.lon < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

### Anti-flapping

Si el GPS oscila justo sobre el borde, eventos `ENTER` / `EXIT` se dispararían continuamente. Solución:

- **Hysteresis**: el `ENTER` requiere estar dentro **por > 30s consecutivos**.
- **Buffer de salida**: el `EXIT` requiere estar fuera **por > 60s** o > 100m de la frontera.

### En el backend con PostGIS

Si las geocercas se evalúan server-side (recomendado):

```sql
-- crear geocerca circular
INSERT INTO geofences (id, device_id, name, geom)
VALUES ('uuid', 'device-uuid', 'Casa',
        ST_Buffer(ST_SetSRID(ST_MakePoint(-70.5678, -33.4123), 4326)::geography, 50)::geometry);

-- consultar si un punto está dentro
SELECT id, name FROM geofences
WHERE device_id = 'device-uuid'
  AND ST_Contains(geom, ST_SetSRID(ST_MakePoint($lon, $lat), 4326));
```

## Métricas agregadas

Para el dashboard del usuario:

| Métrica | Cálculo | Frecuencia |
|---------|---------|------------|
| Km hoy | suma de distancias de trips de hoy | en tiempo real |
| Km esta semana / mes | idem agrupado | diario |
| Combustible gastado mes | suma de fuelEstimateL | diario |
| Velocidad promedio | promedio ponderado por tiempo | post-trip |
| Tiempo total al volante mes | suma de durations | diario |
| Top 5 destinos | clustering de end points | semanal |
| Rutas más comunes | similarity matching de paths | semanal |

## Para profundizar

- `references/nmea-spec.md` — sentencias NMEA detalladas
- `references/postgis-cheatsheet.md` — queries comunes
- `references/kalman-filter.md` — filtro Kalman para suavizar GPS (Fase 2+)
- Skill `nestjs-backend` para storage y queries
- Skill `mqtt-protocol` para el formato de TelemetryPoint
