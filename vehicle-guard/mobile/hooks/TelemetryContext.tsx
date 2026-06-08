import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL, DEVICE_ID } from '../constants/api';

export interface Telemetry {
  v: number;
  ts: number;
  deviceId: string;
  lat: number | null;
  lon: number | null;
  speedKmh: number;
  altM: number;
  satellites: number;
  hdop: number;
  gpsFix: boolean;
  relayActive: boolean;
}

export interface Trip {
  id: string;
  deviceId: string;
  startTime: string;
  endTime: string | null;
  startLat: number;
  startLon: number;
  endLat: number | null;
  endLon: number | null;
  distanceKm: number;
  maxSpeedKmh: number;
  fuelLiters: number;
  durationMinutes: number | null;
  isActive: boolean;
}

export interface DeviceStats {
  totalTrips: number;
  totalDistanceKm: number;
  totalFuelLiters: number;
  activeTrip: Trip | null;
}

interface TelemetryContextValue {
  telemetry: Telemetry | null;
  connected: boolean;
  stats: DeviceStats;
  trips: Trip[];
  refreshTrips: () => Promise<void>;
}

const DEFAULT_STATS: DeviceStats = {
  totalTrips: 0,
  totalDistanceKm: 0,
  totalFuelLiters: 0,
  activeTrip: null,
};

const TelemetryContext = createContext<TelemetryContextValue>({
  telemetry: null,
  connected: false,
  stats: DEFAULT_STATS,
  trips: [],
  refreshTrips: async () => {},
});

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<DeviceStats>(DEFAULT_STATS);
  const [trips, setTrips] = useState<Trip[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const refreshTrips = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/devices/${DEVICE_ID}/trips`);
      if (res.ok) {
        const data: Trip[] = await res.json();
        setTrips(data);
      }
    } catch (_) {}
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/devices/${DEVICE_ID}/stats`);
      if (res.ok) {
        const data: DeviceStats = await res.json();
        setStats(data);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Cargar datos iniciales al conectar
      refreshTrips();
      refreshStats();
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('telemetry', (data: Telemetry) => setTelemetry(data));

    socket.on('stats', (data: DeviceStats) => {
      setStats(data);
      // Si el viaje activo cambió de estado, refrescar lista
      refreshTrips();
    });

    return () => {
      socket.disconnect();
    };
  }, [refreshTrips, refreshStats]);

  return (
    <TelemetryContext.Provider value={{ telemetry, connected, stats, trips, refreshTrips }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry(): TelemetryContextValue {
  return useContext(TelemetryContext);
}
