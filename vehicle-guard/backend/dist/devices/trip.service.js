"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripService = void 0;
const common_1 = require("@nestjs/common");
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
let TripService = class TripService {
    FUEL_L_PER_100KM = 5;
    MOVING_KMH = 5;
    STOP_KMH = 3;
    STOP_MS = 3 * 60 * 1000;
    trips = [];
    activeTrips = new Map();
    stoppedSince = new Map();
    lastPos = new Map();
    processTelemetry(t) {
        if (!t.gpsFix || t.lat == null || t.lon == null)
            return;
        const { deviceId, speedKmh, lat, lon } = t;
        const now = Date.now();
        const active = this.activeTrips.get(deviceId);
        const lastPosition = this.lastPos.get(deviceId);
        if (speedKmh >= this.MOVING_KMH) {
            this.stoppedSince.delete(deviceId);
            if (!active) {
                const trip = {
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
            }
            else {
                if (lastPosition) {
                    const dist = haversineKm(lastPosition.lat, lastPosition.lon, lat, lon);
                    if (dist < 1) {
                        active.distanceKm += dist;
                        active.fuelLiters = +((active.distanceKm / 100) *
                            this.FUEL_L_PER_100KM).toFixed(3);
                    }
                }
                if (speedKmh > active.maxSpeedKmh)
                    active.maxSpeedKmh = speedKmh;
                active.endLat = lat;
                active.endLon = lon;
            }
        }
        else if (speedKmh < this.STOP_KMH && active) {
            if (!this.stoppedSince.has(deviceId)) {
                this.stoppedSince.set(deviceId, now);
            }
            else if (now - this.stoppedSince.get(deviceId) >= this.STOP_MS) {
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
                console.log(`[TRIP] Viaje cerrado: ${active.id} — ${active.distanceKm} km`);
            }
        }
        this.lastPos.set(deviceId, { lat, lon });
    }
    getTrips(deviceId) {
        return [...this.trips]
            .filter((t) => t.deviceId === deviceId)
            .reverse();
    }
    getStats(deviceId) {
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
};
exports.TripService = TripService;
exports.TripService = TripService = __decorate([
    (0, common_1.Injectable)()
], TripService);
//# sourceMappingURL=trip.service.js.map