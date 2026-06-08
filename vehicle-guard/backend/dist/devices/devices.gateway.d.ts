import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TelemetryPayload } from './telemetry.dto';
import { DeviceStats } from './trip.service';
export declare class DevicesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    broadcast(telemetry: TelemetryPayload): void;
    broadcastStats(stats: DeviceStats): void;
}
