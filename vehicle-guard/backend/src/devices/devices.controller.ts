import { Controller, Get, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { TripService } from './trip.service';

@Controller('devices')
export class DevicesController {
  constructor(
    private readonly mqttService: MqttService,
    private readonly tripService: TripService,
  ) {}

  @Post(':id/commands')
  sendCommand(
    @Param('id') deviceId: string,
    @Body() body: { type: string },
  ) {
    const { type } = body;
    if (!type || !['KILL_ENGINE', 'RELEASE_KILL'].includes(type)) {
      throw new BadRequestException('type debe ser KILL_ENGINE o RELEASE_KILL');
    }
    const topic = `devices/${deviceId}/commands`;
    this.mqttService.publish(topic, { type });
    return { sent: true, topic, command: { type } };
  }

  @Get(':id/trips')
  getTrips(@Param('id') deviceId: string) {
    return this.tripService.getTrips(deviceId);
  }

  @Get(':id/stats')
  getStats(@Param('id') deviceId: string) {
    return this.tripService.getStats(deviceId);
  }
}
