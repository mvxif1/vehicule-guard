"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttService = void 0;
const common_1 = require("@nestjs/common");
const mqtt = __importStar(require("mqtt"));
const devices_service_1 = require("./devices.service");
const devices_gateway_1 = require("./devices.gateway");
const trip_service_1 = require("./trip.service");
const MQTT_HOST = process.env.MQTT_HOST ?? 'mqtt://localhost:1883';
let MqttService = class MqttService {
    devicesService;
    devicesGateway;
    tripService;
    client;
    constructor(devicesService, devicesGateway, tripService) {
        this.devicesService = devicesService;
        this.devicesGateway = devicesGateway;
        this.tripService = tripService;
    }
    onModuleInit() {
        this.client = mqtt.connect(MQTT_HOST, {
            clientId: `vg-backend-${Date.now()}`,
            reconnectPeriod: 5000,
        });
        this.client.on('connect', () => {
            console.log(`[MQTT] Conectado a ${MQTT_HOST}`);
            this.client.subscribe('devices/+/telemetry', { qos: 1 });
        });
        this.client.on('message', (topic, payload) => {
            try {
                const telemetry = JSON.parse(payload.toString());
                this.devicesService.setState(telemetry.deviceId, telemetry);
                this.devicesGateway.broadcast(telemetry);
                this.tripService.processTelemetry(telemetry);
                const stats = this.tripService.getStats(telemetry.deviceId);
                this.devicesGateway.broadcastStats(stats);
            }
            catch (err) {
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
    publish(topic, payload) {
        this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
    }
    onModuleDestroy() {
        this.client.end();
    }
};
exports.MqttService = MqttService;
exports.MqttService = MqttService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [devices_service_1.DevicesService,
        devices_gateway_1.DevicesGateway,
        trip_service_1.TripService])
], MqttService);
//# sourceMappingURL=mqtt.service.js.map