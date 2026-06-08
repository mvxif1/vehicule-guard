import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTelemetry } from '../hooks/TelemetryContext';
import { MetricCard } from '../components/MetricCard';

export function DashboardScreen() {
  const { telemetry, connected } = useTelemetry();

  const formatCoord = (val: number | null) =>
    val != null ? val.toFixed(6) : '—';

  const formatTs = (ts: number | undefined) => {
    if (!ts) return '—';
    const date = new Date(ts * 1000);
    return date.toLocaleTimeString('es-CL');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header de estado */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, connected ? styles.dotGreen : styles.dotRed]} />
        <Text style={styles.statusText}>
          {connected ? 'Conectado al backend' : 'Sin conexión al backend'}
        </Text>
      </View>

      {!telemetry && connected && (
        <View style={styles.waiting}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={styles.waitingText}>Esperando telemetría del dispositivo...</Text>
        </View>
      )}

      {!telemetry && !connected && (
        <View style={styles.waiting}>
          <Text style={styles.errorText}>No se puede conectar al backend.</Text>
          <Text style={styles.errorHint}>
            Verifica que el backend esté corriendo y que la IP en constants/api.ts sea correcta.
          </Text>
        </View>
      )}

      {telemetry && (
        <>
          {/* GPS Fix */}
          <View style={styles.fixBadge}>
            <View
              style={[
                styles.fixDot,
                telemetry.gpsFix ? styles.dotGreen : styles.dotOrange,
              ]}
            />
            <Text style={styles.fixText}>
              {telemetry.gpsFix ? 'GPS Fix OK' : 'Sin GPS Fix'}
            </Text>
            <Text style={styles.fixSub}>{telemetry.satellites} satélites</Text>
          </View>

          {/* Coordenadas */}
          <Text style={styles.sectionTitle}>Posición</Text>
          <View style={styles.row}>
            <MetricCard
              label="Latitud"
              value={formatCoord(telemetry.lat)}
              highlight={telemetry.gpsFix}
            />
            <MetricCard
              label="Longitud"
              value={formatCoord(telemetry.lon)}
              highlight={telemetry.gpsFix}
            />
          </View>

          {/* Métricas de movimiento */}
          <Text style={styles.sectionTitle}>Movimiento</Text>
          <View style={styles.row}>
            <MetricCard
              label="Velocidad"
              value={telemetry.speedKmh.toFixed(1)}
              unit="km/h"
            />
            <MetricCard
              label="Altitud"
              value={telemetry.altM.toFixed(0)}
              unit="m"
            />
          </View>

          {/* Info del dispositivo */}
          <Text style={styles.sectionTitle}>Dispositivo</Text>
          <View style={styles.row}>
            <MetricCard label="ID" value={telemetry.deviceId} />
            <MetricCard
              label="Última actualización"
              value={formatTs(telemetry.ts)}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: { backgroundColor: '#22c55e' },
  dotRed: { backgroundColor: '#ef4444' },
  dotOrange: { backgroundColor: '#f97316' },
  statusText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  waiting: {
    alignItems: 'center',
    marginTop: 60,
    gap: 16,
  },
  waitingText: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'center',
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorHint: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  fixBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e1e2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  fixDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fixText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  fixSub: {
    color: '#6b7280',
    fontSize: 13,
    marginLeft: 'auto',
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    marginLeft: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
});
