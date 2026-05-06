---
name: nestjs-backend
description: Use this skill whenever working on the NestJS backend of VehicleGuard. Triggers include any TypeScript/Node.js code for the API server, REST controllers, WebSocket gateways, MQTT bridge, JWT authentication, Postgres/PostGIS queries, TypeORM/Prisma entities, multi-tenant logic, device registry, or feature licensing. Activate when Maximiliano mentions "API", "backend", "endpoint", "JWT", "database", "Postgres", "MQTT broker", "WebSocket", "controller", "service", or describes server-side behavior.
---

# NestJS Backend

Backend de VehicleGuard. Es el cerebro: recibe telemetría de los dispositivos vía MQTT, expone API REST para la app móvil, transmite ubicaciones en tiempo real vía WebSocket, gestiona usuarios y licencias.

## Stack confirmado

- **Framework:** NestJS 10+ (TypeScript)
- **DB:** PostgreSQL 15+ con extensión PostGIS
- **ORM:** Prisma (más simple que TypeORM, mejor DX, migraciones declarativas)
- **MQTT broker:** Mosquitto en desarrollo, EMQX en producción (mejor escalabilidad)
- **Cache:** Redis (para WebSocket pub/sub entre instancias y rate limiting)
- **Auth:** JWT con refresh tokens; los dispositivos usan certificados X.509 (mTLS)
- **Logging:** Pino (rápido, JSON estructurado)
- **Validación:** class-validator + class-transformer en DTOs

## Estructura del proyecto backend

```
backend/
├── prisma/
│   ├── schema.prisma           ← modelo de datos
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── modules/
│   │   ├── auth/               ← login, refresh, JWT strategy
│   │   ├── users/
│   │   ├── devices/            ← CRUD de dispositivos, vinculación
│   │   ├── vehicles/           ← entidad lógica vehículo, asociado a un device
│   │   ├── telemetry/          ← ingesta + queries históricas
│   │   ├── commands/           ← comandos al dispositivo (corte, encender)
│   │   ├── geofences/          ← geocercas con PostGIS
│   │   ├── trips/              ← agregación de trayectos
│   │   ├── licenses/           ← features habilitadas por device
│   │   ├── mqtt-bridge/        ← cliente MQTT que escucha y enruta
│   │   └── notifications/      ← push notifications via FCM
│   ├── common/
│   │   ├── guards/             ← JwtGuard, RoleGuard, DeviceMtlsGuard
│   │   ├── decorators/         ← @CurrentUser, @CurrentDevice
│   │   ├── filters/            ← exception filters
│   │   └── interceptors/
│   └── infra/
│       ├── prisma.service.ts
│       ├── redis.service.ts
│       └── mqtt.service.ts
└── test/
```

## Modelo de datos (Prisma schema esencial)

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  role          Role     @default(USER)
  devices       Device[]
  createdAt     DateTime @default(now())
}

enum Role { USER ADMIN FLEET_OWNER }

model Device {
  id            String   @id @default(uuid())
  serialNumber  String   @unique         // grabado en NVS del ESP32
  certFingerprint String @unique         // SHA-256 del cert X.509
  ownerId       String
  owner         User     @relation(fields: [ownerId], references: [id])
  vehicle       Vehicle?
  licenses      License[]
  status        DeviceStatus @default(OFFLINE)
  lastSeenAt    DateTime?
  fwVersion     String?
  createdAt     DateTime @default(now())
}

enum DeviceStatus { OFFLINE ONLINE TAMPER_DETECTED }

model Vehicle {
  id            String   @id @default(uuid())
  deviceId      String   @unique
  device        Device   @relation(fields: [deviceId], references: [id])
  plate         String?
  make          String?
  model         String?
  year          Int?
  fuelTankL     Float?           // capacidad para estimar consumo
  avgConsumptionLper100km Float?
  trips         Trip[]
}

model TelemetryPoint {
  id            BigInt   @id @default(autoincrement())
  deviceId      String
  ts            DateTime
  lat           Float
  lon           Float
  speedKmh      Float
  heading       Float?
  ignitionOn    Boolean
  battery12vMv  Int?
  // PostGIS geometry column added via raw migration:
  // geom Geometry(Point, 4326)
  @@index([deviceId, ts])
}

model License {
  id            String   @id @default(uuid())
  deviceId      String
  feature       Feature
  enabled       Boolean
  expiresAt     DateTime?
  device        Device @relation(fields: [deviceId], references: [id])
  @@unique([deviceId, feature])
}

enum Feature {
  REMOTE_KILL_SWITCH
  ADVANCED_GEOFENCES
  CAMERA_STREAM
  TRIP_ANALYTICS
  FLEET_DASHBOARD
}
```

## Reglas de negocio críticas

1. **Comando de corte de corriente** debe pasar por TRES validaciones antes de llegar al dispositivo:
   - Usuario autenticado y dueño del device.
   - Device tiene la `License` `REMOTE_KILL_SWITCH` activa.
   - Backend pide al dispositivo el último estado conocido — y solo emite el comando si la velocidad reportada en los últimos 30s es < 5 km/h. (Validación final en firmware también, pero la primera barrera es server-side.)

2. **Multi-tenancy soft:** todo query a `Device`, `Vehicle`, `Telemetry` debe filtrarse por `ownerId`. Implementar como middleware Prisma o interceptor que inyecte el filtro automáticamente. **Nunca** confiar en el query del cliente.

3. **Auditoría:** todo comando enviado al dispositivo se registra en tabla `command_audit` con `userId, deviceId, command, timestamp, ip, result`.

4. **Idempotencia de telemetría:** los devices tienen un buffer offline. Cuando vuelve la red mandan paquetes con timestamps pasados. La ingesta debe rechazar duplicados por `(deviceId, ts)`.

## MQTT bridge — diseño

El backend corre un cliente MQTT que se suscribe a topics de telemetría:

```
devices/+/telemetry           ← QoS 1, escucha
devices/+/events              ← QoS 1, escucha (alarmas, tamper)
devices/+/status              ← QoS 1 retained, escucha (online/offline)
devices/{id}/commands         ← QoS 1, publica
devices/{id}/ota              ← QoS 1, publica
```

El topic-level wildcard `+` matchea un device id.

```typescript
@Injectable()
export class MqttBridgeService implements OnModuleInit {
  async onModuleInit() {
    this.client = mqtt.connect(BROKER_URL, {
      ca: fs.readFileSync('certs/ca.pem'),
      cert: fs.readFileSync('certs/server.pem'),
      key:  fs.readFileSync('certs/server.key'),
      clientId: `backend-${os.hostname()}`,
      reconnectPeriod: 5000,
    });

    this.client.subscribe(['devices/+/telemetry', 'devices/+/events', 'devices/+/status'], { qos: 1 });
    this.client.on('message', this.routeMessage.bind(this));
  }

  private async routeMessage(topic: string, payload: Buffer) {
    const [, deviceId, type] = topic.split('/');
    switch (type) {
      case 'telemetry': return this.telemetryService.ingest(deviceId, payload);
      case 'events':    return this.eventsService.handle(deviceId, payload);
      case 'status':    return this.devicesService.updateStatus(deviceId, payload);
    }
  }
}
```

## WebSocket Gateway (tiempo real para la app)

```typescript
@WebSocketGateway({ cors: true, namespace: 'live' })
export class LiveGateway {
  @SubscribeMessage('subscribe:device')
  async onSubscribe(client: Socket, deviceId: string) {
    // verifica que el usuario del JWT sea owner
    if (!await this.canAccessDevice(client.data.userId, deviceId)) {
      throw new WsException('forbidden');
    }
    client.join(`device:${deviceId}`);
  }

  // llamado desde TelemetryService cuando llega un punto nuevo
  emitTelemetry(deviceId: string, point: TelemetryPoint) {
    this.server.to(`device:${deviceId}`).emit('telemetry', point);
  }
}
```

## Endpoints clave (REST)

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh

GET    /devices                       ← lista los devices del usuario
POST   /devices/claim                 ← reclamar un device por código de provisioning
GET    /devices/:id
PATCH  /devices/:id/vehicle           ← asociar info del vehículo

POST   /devices/:id/commands/kill     ← corte de corriente (con validaciones)
POST   /devices/:id/commands/start    ← liberar corte
POST   /devices/:id/commands/locate   ← pedir ubicación inmediata

GET    /devices/:id/telemetry?from=&to=
GET    /devices/:id/trips
GET    /devices/:id/trips/:tripId

POST   /devices/:id/geofences
GET    /devices/:id/geofences
DELETE /geofences/:id

GET    /devices/:id/licenses          ← qué features están activas
PATCH  /devices/:id/licenses          ← solo ADMIN
```

## Para profundizar

- `references/postgis-queries.md` — geocercas, búsqueda por radio, agregación de trips
- `references/jwt-and-mtls.md` — auth duales (usuarios JWT, devices mTLS)
- Skill `mqtt-protocol` para el contrato exacto de payloads
- Skill `vehicle-security` para validaciones del corte
