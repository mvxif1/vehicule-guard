"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesController = void 0;
const common_1 = require("@nestjs/common");
const mqtt_service_1 = require("./mqtt.service");
const trip_service_1 = require("./trip.service");
let DevicesController = class DevicesController {
    mqttService;
    tripService;
    constructor(mqttService, tripService) {
        this.mqttService = mqttService;
        this.tripService = tripService;
    }
    sendCommand(deviceId, body) {
        const { type } = body;
        if (!type || !['KILL_ENGINE', 'RELEASE_KILL'].includes(type)) {
            throw new common_1.BadRequestException('type debe ser KILL_ENGINE o RELEASE_KILL');
        }
        const topic = `devices/${deviceId}/commands`;
        this.mqttService.publish(topic, { type });
        return { sent: true, topic, command: { type } };
    }
    getTrips(deviceId) {
        return this.tripService.getTrips(deviceId);
    }
    getStats(deviceId) {
        return this.tripService.getStats(deviceId);
    }
};
exports.DevicesController = DevicesController;
__decorate([
    (0, common_1.Post)(':id/commands'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DevicesController.prototype, "sendCommand", null);
__decorate([
    (0, common_1.Get)(':id/trips'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DevicesController.prototype, "getTrips", null);
__decorate([
    (0, common_1.Get)(':id/stats'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DevicesController.prototype, "getStats", null);
exports.DevicesController = DevicesController = __decorate([
    (0, common_1.Controller)('devices'),
    __metadata("design:paramtypes", [mqtt_service_1.MqttService,
        trip_service_1.TripService])
], DevicesController);
//# sourceMappingURL=devices.controller.js.map