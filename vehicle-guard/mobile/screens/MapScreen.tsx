import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useTelemetry } from '../hooks/TelemetryContext';

const DEFAULT_REGION: Region = {
  latitude: -33.45,    // Santiago de Chile por defecto
  longitude: -70.67,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export function MapScreen() {
  const { telemetry, connected } = useTelemetry();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (telemetry?.lat && telemetry?.lon) {
      mapRef.current?.animateToRegion(
        {
          latitude: telemetry.lat,
          longitude: telemetry.lon,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500,
      );
    }
  }, [telemetry?.lat, telemetry?.lon]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {telemetry?.lat && telemetry?.lon && (
          <Marker
            coordinate={{
              latitude: telemetry.lat,
              longitude: telemetry.lon,
            }}
            title="VehicleGuard"
            description={`${telemetry.speedKmh.toFixed(1)} km/h · ${telemetry.satellites} sat`}
            pinColor="#3b82f6"
          />
        )}
      </MapView>

      {/* Overlay de estado */}
      <View style={styles.overlay}>
        {!connected && (
          <View style={styles.badge}>
            <View style={[styles.dot, styles.dotRed]} />
            <Text style={styles.badgeText}>Sin conexión</Text>
          </View>
        )}
        {connected && !telemetry?.gpsFix && (
          <View style={styles.badge}>
            <View style={[styles.dot, styles.dotOrange]} />
            <Text style={styles.badgeText}>Sin GPS Fix</Text>
          </View>
        )}
        {telemetry?.gpsFix && (
          <View style={styles.badge}>
            <View style={[styles.dot, styles.dotGreen]} />
            <Text style={styles.badgeText}>
              {telemetry.speedKmh.toFixed(1)} km/h · {telemetry.satellites} sat
            </Text>
          </View>
        )}
      </View>

      {!telemetry?.lat && connected && (
        <View style={styles.noGps}>
          <ActivityIndicator color="#3b82f6" />
          <Text style={styles.noGpsText}>
            Esperando coordenadas GPS...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: { backgroundColor: '#22c55e' },
  dotRed: { backgroundColor: '#ef4444' },
  dotOrange: { backgroundColor: '#f97316' },
  noGps: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  noGpsText: {
    color: '#9ca3af',
    fontSize: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
});
