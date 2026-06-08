import { TelemetryPayload } from './telemetry.dto';
export declare class DevicesService {
    private readonly state;
    setState(deviceId: string, telemetry: TelemetryPayload): void;
    getState(deviceId: string): TelemetryPayload | undefined;
    getAllStates(): TelemetryPayload[];
}
