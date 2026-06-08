export interface TelemetryPayload {
    v: number;
    ts: number;
    deviceId: string;
    lat: number | null;
    lon: number | null;
    speedKmh: number;
    altM: number;
    satellites: number;
    hdop: number;
    gpsFix: boolean;
    relayActive: boolean;
}
export interface CommandPayload {
    type: 'KILL_ENGINE' | 'RELEASE_KILL';
}
