import { Injectable } from '@nestjs/common';
import { TelemetryPayload } from './telemetry.dto';

export interface Trip {
  id: string;
  deviceId: string;
  startTime: string;
  endTime: string | null;
  startLat: number;
  startLon: number;
  endLat: number | null;
  endLon: number | null;
  distanceKm: number;
  maxSpeedKmh: number;
  fuelLiters: number;
  durationMinutes: number | null;
  isActive: boolean;
}

export interface DeviceStats {
  totalTrips: number;
  totalDistanceKm: number;
  totalFuelLiters: number;
  activeTrip: Trip | null;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class TripService {
  // Gixxer 250 consume ~5L/100km
  private readonly FUEL_L_PER_100KM = 5;
  private readonly MOVING_KMH = 5;    // umbral para considerar "en movimiento"
  private readonly STOP_KMH = 3;      // umbral para considerar "detenido"
  private readonly STOP_MS = 3 * 60 * 1000; // 3 min parado → cierra viaje

  private trips: Trip[] = [];
  private activeTrips = new Map<string, Trip>();
  private stoppedSince = new Map<string, number>(); // deviceId → timestamp ms
  private lastPos = new Map<string, { lat: number; lon: number }>();

  processTelemetry(t: TelemetryPayload): void {
    if (!t.gpsFix || t.lat == null || t.lon == null) return;

    const { deviceId, speedKmh, lat, lon } = t;
    const now = Date.now();
    const active = this.activeTrips.get(deviceId);
    const lastPosition = this.lastPos.get(deviceId);

    if (speedKmh >= this.MOVING_KMH) {
      // Vehículo en movimiento
      this.stoppedSince.delete(deviceId);

      if (!active) {
        // Iniciar viaje nuevo
        const trip: Trip = {
          id: `trip-${deviceId}-${now}`,
          deviceId,
          startTime: new Date().toISOString(),
          endTime: null,
          startLat: lat,
          startLon: lon,
          endLat: null,
          endLon: null,
          distanceKm: 0,
          maxSpeedKmh: speedKmh,
          fuelLiters: 0,
          durationMinutes: null,
          isActive: true,
        };
        this.activeTrips.set(deviceId, trip);
        this.trips.push(trip);
        console.log(`[TRIP] Viaje iniciado: ${trip.id}`);
      } else {
        // Acumular distancia en viaje activo
        if (lastPosition) {
          const dist = haversineKm(lastPosition.lat, lastPosition.lon, lat, lon);
          // Filtrar saltos GPS absurdos (> 1 km en 10s = 360 km/h)
          if (dist < 1) {
            active.distanceKm += dist;
            active.fuelLiters = +(
              (active.distanceKm / 100) *
              this.FUEL_L_PER_100KM
            ).toFixed(3);
          }
        }
        if (speedKmh > active.maxSpeedKmh) active.maxSpeedKmh = speedKmh;
        active.endLat = lat;
        active.endLon = lon;
      }
    } else if (speedKmh < this.STOP_KMH && active) {
      // Vehículo detenido con viaje activo
      if (!this.stoppedSince.has(deviceId)) {
        this.stoppedSince.set(deviceId, now);
      } else if (now - this.stoppedSince.get(deviceId)! >= this.STOP_MS) {
        // Cerrar viaje
        const startMs = new Date(active.startTime).getTime();
        active.endTime = new Date().toISOString();
        active.endLat = lat;
        active.endLon = lon;
        active.isActive = false;
        active.durationMinutes = +((now - startMs) / 60000).toFixed(1);
        active.distanceKm = +active.distanceKm.toFixed(2);
        active.fuelLiters = +active.fuelLiters.toFixed(2);
        this.activeTrips.delete(deviceId);
        this.stoppedSince.delete(deviceId);
        console.log(
          `[TRIP] Viaje cerrado: ${active.id} — ${active.distanceKm} km`,
        );
      }
    }

    this.lastPos.set(deviceId, { lat, lon });
  }

  getTrips(deviceId: string): Trip[] {
    return [...this.trips]
      .filter((t) => t.deviceId === deviceId)
      .reverse();
  }

  getStats(deviceId: string): DeviceStats {
    const deviceTrips = this.trips.filter((t) => t.deviceId === deviceId);
    const completed = deviceTrips.filter((t) => !t.isActive);
    return {
      totalTrips: completed.length,
      totalDistanceKm: +deviceTrips
        .reduce((s, t) => s + t.distanceKm, 0)
        .toFixed(2),
      totalFuelLiters: +deviceTrips
        .reduce((s, t) => s + t.fuelLiters, 0)
        .toFixed(2),
      activeTrip: this.activeTrips.get(deviceId) ?? null,
    };
  }
}
