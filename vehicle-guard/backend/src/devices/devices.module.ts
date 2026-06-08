import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesGateway } from './devices.gateway';
import { MqttService } from './mqtt.service';
import { TripService } from './trip.service';
import { DevicesController } from './devices.controller';

@Module({
  providers: [DevicesService, DevicesGateway, MqttService, TripService],
  controllers: [DevicesController],
})
export class DevicesModule {}
