import { Injectable } from '@nestjs/common';
import { TelemetryPayload } from './telemetry.dto';

@Injectable()
export class DevicesService {
  private readonly state = new Map<string, TelemetryPayload>();

  setState(deviceId: string, telemetry: TelemetryPayload): void {
    this.state.set(deviceId, telemetry);
  }

  getState(deviceId: string): TelemetryPayload | undefined {
    return this.state.get(deviceId);
  }

  getAllStates(): TelemetryPayload[] {
    return Array.from(this.state.values());
  }
}
