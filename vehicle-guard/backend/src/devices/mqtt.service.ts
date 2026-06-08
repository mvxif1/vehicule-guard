import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { DevicesService } from './devices.service';
import { DevicesGateway } from './devices.gateway';
import { TripService } from './trip.service';
import { TelemetryPayload } from './telemetry.dto';

const MQTT_HOST = process.env.MQTT_HOST ?? 'mqtt://localhost:1883';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;

  constructor(
    private readonly devicesService: DevicesService,
    private readonly devicesGateway: DevicesGateway,
    private readonly tripService: TripService,
  ) {}

  onModuleInit() {
    this.client = mqtt.connect(MQTT_HOST, {
      clientId: `vg-backend-${Date.now()}`,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      console.log(`[MQTT] Conectado a ${MQTT_HOST}`);
      this.client.subscribe('devices/+/telemetry', { qos: 1 });
    });

    this.client.on('message', (topic: string, payload: Buffer) => {
      try {
        const telemetry: TelemetryPayload = JSON.parse(payload.toString());
        this.devicesService.setState(telemetry.deviceId, telemetry);
        this.devicesGateway.broadcast(telemetry);
        this.tripService.processTelemetry(telemetry);
        const stats = this.tripService.getStats(telemetry.deviceId);
        this.devicesGateway.broadcastStats(stats);
      } catch (err) {
        console.error('[MQTT] Error parsing message:', err);
      }
    });

    this.client.on('error', (err) => {
      console.error('[MQTT] Error:', err.message);
    });

    this.client.on('reconnect', () => {
      console.log('[MQTT] Reconectando...');
    });
  }

  publish(topic: string, payload: object): void {
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }

  onModuleDestroy() {
    this.client.end();
  }
}
