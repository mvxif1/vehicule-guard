import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TelemetryPayload } from './telemetry.dto';
import { DeviceStats } from './trip.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class DevicesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`[WS] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS] Client disconnected: ${client.id}`);
  }

  broadcast(telemetry: TelemetryPayload): void {
    this.server.emit('telemetry', telemetry);
  }

  broadcastStats(stats: DeviceStats): void {
    this.server.emit('stats', stats);
  }
}
