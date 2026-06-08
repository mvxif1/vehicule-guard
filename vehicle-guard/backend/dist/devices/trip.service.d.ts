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
export declare class TripService {
    private readonly FUEL_L_PER_100KM;
    private readonly MOVING_KMH;
    private readonly STOP_KMH;
    private readonly STOP_MS;
    private trips;
    private activeTrips;
    private stoppedSince;
    private lastPos;
    processTelemetry(t: TelemetryPayload): void;
    getTrips(deviceId: string): Trip[];
    getStats(deviceId: string): DeviceStats;
}
