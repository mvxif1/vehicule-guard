import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTelemetry, Trip } from '../hooks/TelemetryContext';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function ActiveTripCard({ trip }: { trip: Trip }) {
  const elapsed = Math.round(
    (Date.now() - new Date(trip.startTime).getTime()) / 60000,
  );
  return (
    <View style={styles.activeTripCard}>
      <View style={styles.activeTripHeader}>
        <View style={styles.pulsingDot} />
        <Text style={styles.activeTripTitle}>Viaje en curso</Text>
        <Text style={styles.activeTripTime}>{formatDuration(elapsed)}</Text>
      </View>
      <View style={styles.activeTripMetrics}>
        <View style={styles.activeMetric}>
          <Text style={styles.activeMetricValue}>
            {trip.distanceKm.toFixed(2)}
          </Text>
          <Text style={styles.activeMetricLabel}>km</Text>
        </View>
        <View style={styles.activeMetricDivider} />
        <View style={styles.activeMetric}>
          <Text style={styles.activeMetricValue}>
            {trip.maxSpeedKmh.toFixed(0)}
          </Text>
          <Text style={styles.activeMetricLabel}>km/h máx</Text>
        </View>
        <View style={styles.activeMetricDivider} />
        <View style={styles.activeMetric}>
          <Text style={styles.activeMetricValue}>
            {trip.fuelLiters.toFixed(2)}
          </Text>
          <Text style={styles.activeMetricLabel}>L combustible</Text>
        </View>
      </View>
    </View>
  );
}

function TripItem({ trip }: { trip: Trip }) {
  return (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <Text style={styles.tripDate}>{formatDate(trip.startTime)}</Text>
        <Text style={styles.tripDuration}>{formatDuration(trip.durationMinutes)}</Text>
      </View>
      <View style={styles.tripMetrics}>
        <View style={styles.tripMetric}>
          <Text style={styles.tripMetricValue}>{trip.distanceKm.toFixed(2)}</Text>
          <Text style={styles.tripMetricLabel}>km</Text>
        </View>
        <View style={styles.tripMetric}>
          <Text style={styles.tripMetricValue}>{trip.maxSpeedKmh.toFixed(0)}</Text>
          <Text style={styles.tripMetricLabel}>km/h máx</Text>
        </View>
        <View style={styles.tripMetric}>
          <Text style={styles.tripMetricValue}>{trip.fuelLiters.toFixed(2)}</Text>
          <Text style={styles.tripMetricLabel}>litros</Text>
        </View>
      </View>
    </View>
  );
}

export function TripsScreen() {
  const { stats, trips, connected, refreshTrips } = useTelemetry();
  const [refreshing, setRefreshing] = React.useState(false);

  const completedTrips = trips.filter((t) => !t.isActive);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshTrips();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={completedTrips}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3b82f6"
        />
      }
      ListHeaderComponent={
        <>
          {/* Stats totales */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalTrips}</Text>
              <Text style={styles.statLabel}>Viajes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.totalDistanceKm.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>km totales</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.totalFuelLiters.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>litros gastados</Text>
            </View>
          </View>

          {/* Viaje activo */}
          {stats.activeTrip && <ActiveTripCard trip={stats.activeTrip} />}

          {/* Encabezado historial */}
          {completedTrips.length > 0 && (
            <Text style={styles.sectionTitle}>Historial de viajes</Text>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          {!connected ? (
            <Text style={styles.emptyText}>Sin conexión al backend</Text>
          ) : (
            <>
              <Text style={styles.emptyText}>Sin viajes registrados aún</Text>
              <Text style={styles.emptyHint}>
                Los viajes se detectan automáticamente cuando el dispositivo supera los 5 km/h
              </Text>
            </>
          )}
        </View>
      }
      renderItem={({ item }) => <TripItem trip={item} />}
    />
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    color: '#60a5fa',
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  activeTripCard: {
    backgroundColor: '#1a3a5c',
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  activeTripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  activeTripTitle: {
    color: '#f9fafb',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  activeTripTime: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTripMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  activeMetric: {
    alignItems: 'center',
  },
  activeMetricValue: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '700',
  },
  activeMetricLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  activeMetricDivider: {
    width: 1,
    backgroundColor: '#2d4a6e',
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  tripCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tripDate: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
  },
  tripDuration: {
    color: '#6b7280',
    fontSize: 13,
  },
  tripMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  tripMetric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  tripMetricValue: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
  tripMetricLabel: {
    color: '#6b7280',
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 10,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
  },
  emptyHint: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
