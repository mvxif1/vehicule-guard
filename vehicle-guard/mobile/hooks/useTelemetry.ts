import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../constants/api';

export interface Telemetry {
  v: number;
  ts: number;
  deviceId: string;
  lat: number | null;
  lon: number | null;
  speedKmh: number;
  altM: number;
  satellites: number;
  gpsFix: boolean;
}

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('telemetry', (data: Telemetry) => {
      setTelemetry(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { telemetry, connected };
}
