import { MqttService } from './mqtt.service';
import { TripService } from './trip.service';
export declare class DevicesController {
    private readonly mqttService;
    private readonly tripService;
    constructor(mqttService: MqttService, tripService: TripService);
    sendCommand(deviceId: string, body: {
        type: string;
    }): {
        sent: boolean;
        topic: string;
        command: {
            type: string;
        };
    };
    getTrips(deviceId: string): import("./trip.service").Trip[];
    getStats(deviceId: string): import("./trip.service").DeviceStats;
}
