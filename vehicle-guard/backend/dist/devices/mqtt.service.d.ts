import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesGateway } from './devices.gateway';
import { TripService } from './trip.service';
export declare class MqttService implements OnModuleInit, OnModuleDestroy {
    private readonly devicesService;
    private readonly devicesGateway;
    private readonly tripService;
    private client;
    constructor(devicesService: DevicesService, devicesGateway: DevicesGateway, tripService: TripService);
    onModuleInit(): void;
    publish(topic: string, payload: object): void;
    onModuleDestroy(): void;
}
