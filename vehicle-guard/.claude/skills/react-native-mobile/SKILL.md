---
name: react-native-mobile
description: Use this skill whenever working on the React Native mobile app of VehicleGuard. Triggers include any TypeScript/JSX code for the mobile client, screens, navigation, state management, real-time map display, push notifications, secure storage, biometric auth, or integration with the NestJS backend via REST and WebSocket. Activate when Maximiliano mentions "app móvil", "mobile", "React Native", "Expo", "navigation", "screen", "map", "notifications", "live tracking" in the context of UI, or describes user-facing flows.
---

# React Native Mobile

App móvil de VehicleGuard. Es la cara que ve el usuario final: tracking en tiempo real, comandos al dispositivo, configuración, alertas.

## Stack confirmado

- **Framework:** React Native con **Expo (bare workflow)** — Expo da DX rápido pero el bare workflow nos permite agregar módulos nativos cuando los necesitemos (ej: notificaciones críticas, MQTT directo si decidiéramos saltar el backend).
- **Lenguaje:** TypeScript estricto.
- **Navegación:** React Navigation 7 (stack + bottom tabs).
- **Estado global:** Zustand (más simple que Redux, suficiente para esta app).
- **Server state:** TanStack Query (React Query) — caché, refetch, optimistic updates.
- **Mapas:** `react-native-maps` con tiles de OpenStreetMap (gratuito) en dev, Mapbox o Google en producción.
- **Real-time:** `socket.io-client` para WebSocket con el backend.
- **Storage seguro:** `expo-secure-store` (iOS Keychain / Android Keystore) para tokens.
- **Push:** `expo-notifications` (FCM bajo el capó en Android, APNs en iOS).
- **Auth biométrica:** `expo-local-authentication` para confirmar acciones críticas (corte de corriente).

## Estructura del proyecto

```
mobile/
├── app.json                    ← config Expo
├── eas.json                    ← config builds EAS
├── package.json
├── tsconfig.json
├── src/
│   ├── App.tsx
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── AuthStack.tsx
│   │   └── MainTabs.tsx
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── home/
│   │   │   ├── DeviceListScreen.tsx
│   │   │   └── ClaimDeviceScreen.tsx     ← escanear QR del chip
│   │   ├── device/
│   │   │   ├── LiveMapScreen.tsx          ← mapa con marker en tiempo real
│   │   │   ├── TripsScreen.tsx
│   │   │   ├── TripDetailScreen.tsx
│   │   │   ├── GeofencesScreen.tsx
│   │   │   └── DeviceSettingsScreen.tsx
│   │   ├── commands/
│   │   │   └── KillSwitchScreen.tsx       ← UI con confirmación + biometría
│   │   └── settings/
│   │       └── ProfileScreen.tsx
│   ├── components/
│   │   ├── DeviceCard.tsx
│   │   ├── LiveMap.tsx
│   │   ├── SpeedGauge.tsx
│   │   ├── DangerButton.tsx               ← botón con doble confirmación
│   │   └── ...
│   ├── services/
│   │   ├── api.ts                         ← cliente axios con interceptor JWT
│   │   ├── socket.ts                      ← cliente socket.io
│   │   ├── auth.ts
│   │   ├── secureStore.ts
│   │   └── notifications.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useDevice.ts
│   │   ├── useLiveTelemetry.ts            ← suscribe al WS y devuelve point
│   │   └── useBiometric.ts
│   ├── stores/
│   │   ├── authStore.ts                   ← Zustand
│   │   └── uiStore.ts
│   ├── types/
│   │   └── api.ts                         ← tipos compartidos con el backend
│   └── utils/
│       ├── format.ts
│       └── constants.ts
└── assets/
```

## Pantallas críticas — flujos UX

### 1. Live Map (la pantalla más usada)

- Mapa centrado en el último punto del device.
- Marker animado moviéndose en tiempo real (interpolar entre puntos vía `react-native-reanimated`).
- Trail de los últimos 30 minutos.
- Speed gauge en esquina (km/h actual).
- Estado: 🟢 ONLINE, 🔴 OFFLINE, ⚠️ TAMPER.
- FAB con acciones: localizar, cortar corriente, encender, llamar.

### 2. Kill Switch (corte de corriente)

Esta pantalla **debe** tener fricción intencional:

```
┌─────────────────────────────────┐
│                                 │
│     ⚠️ Cortar corriente         │
│                                 │
│  Esto detendrá el motor del     │
│  vehículo. Solo funciona si el  │
│  vehículo está detenido.        │
│                                 │
│  Estado actual:                 │
│  ✓ Vehículo detenido (0 km/h)   │
│  ✓ Motor encendido              │
│  ✓ Dispositivo online           │
│                                 │
│  [Mantén presionado 3s] ━━━━    │
│                                 │
│  [Cancelar]                     │
└─────────────────────────────────┘
```

- Botón "mantener presionado" (no tap simple).
- Tras 3s, pide confirmación biométrica.
- Si pasa, llama `POST /devices/:id/commands/kill`.
- Tras emitir, esperar evento `command:ack` por WebSocket o timeout 10s.
- Mostrar feedback claro (✓ ejecutado, ✗ falló — razón).

### 3. Claim Device (vincular un chip nuevo)

- Botón "Agregar dispositivo" → escanea QR.
- El QR contiene `{ serial, claimToken }`.
- Llama `POST /devices/claim` con `{ serial, claimToken }`.
- Si ok, navega a configuración del vehículo (placa, marca, modelo).

## Patrón de api.ts (cliente axios)

```typescript
import axios from 'axios';
import { secureStore } from './secureStore';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await secureStore.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true;
      const newToken = await refreshToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return api.request(error.config);
      }
    }
    return Promise.reject(error);
  },
);
```

## Hook useLiveTelemetry (ejemplo)

```typescript
export function useLiveTelemetry(deviceId: string) {
  const [point, setPoint] = useState<TelemetryPoint | null>(null);

  useEffect(() => {
    const socket = io(`${API_URL}/live`, {
      auth: { token: getAccessTokenSync() },
    });

    socket.on('connect', () => socket.emit('subscribe:device', deviceId));
    socket.on('telemetry', (p: TelemetryPoint) => setPoint(p));

    return () => { socket.disconnect(); };
  }, [deviceId]);

  return point;
}
```

## Lo que NO hacemos en la app móvil

- ❌ Lógica de negocio crítica (todo eso es server-side).
- ❌ Cachear comandos en cola (si no hay red, fallamos rápido y avisamos).
- ❌ Persistir telemetría completa local — solo la última hora para experiencia offline.
- ❌ Comunicación directa al dispositivo (siempre vía backend).
- ❌ Modo "anti-bricking" — el bypass no existe.

## Tema visual y UX

- Paleta sobria: gris oscuro + acento amarillo/naranja para alertas.
- Tipografía: Inter o el sistema.
- Acciones destructivas siempre rojas y con confirmación.
- Loading states explícitos. Nunca pantalla en blanco.
- Empty states con CTAs claros ("Agrega tu primer dispositivo").

## Para profundizar

- `references/screens-wireframes.md` — wireframes de cada pantalla
- `references/expo-eas-build.md` — cómo generar APK/IPA para distribución a amigos en testing
- Skill `nestjs-backend` para los DTOs y endpoints exactos
