import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTelemetry } from '../hooks/TelemetryContext';
import { BACKEND_URL, DEVICE_ID } from '../constants/api';

export function ControlsScreen() {
  const { telemetry, connected } = useTelemetry();
  const [loading, setLoading] = useState(false);

  // Estado real del relé viene directamente del ESP32 via telemetría
  const relayActive = telemetry?.relayActive ?? false;
  const gpsFix      = telemetry?.gpsFix ?? false;
  const speed       = telemetry?.speedKmh ?? 0;
  const satellites  = telemetry?.satellites ?? 0;
  const hdop        = telemetry?.hdop ?? 99.9;

  const sendCommand = async (type: 'KILL_ENGINE' | 'RELEASE_KILL') => {
    if (!connected) {
      Alert.alert('Sin conexión', 'No hay conexión con el backend.');
      return;
    }
    if (type === 'KILL_ENGINE') {
      Alert.alert(
        'Confirmar corte de motor',
        gpsFix
          ? `Velocidad actual: ${speed.toFixed(1)} km/h\n\nEl corte solo se activa si el vehículo está detenido (< 5 km/h). El firmware lo verifica.`
          : 'El GPS no tiene señal. Sin fix GPS se asume vehículo detenido y el corte se activará.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', style: 'destructive', onPress: () => doSend(type) },
        ],
      );
    } else {
      doSend(type);
    }
  };

  const doSend = async (type: 'KILL_ENGINE' | 'RELEASE_KILL') => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/devices/${DEVICE_ID}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error('Error en el servidor');
      // El estado real del relé llegará en el próximo telemetry del ESP32
    } catch {
      Alert.alert('Error', 'No se pudo enviar el comando. Verifica la conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── ESTADO DEL DISPOSITIVO ──────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Estado del dispositivo</Text>
      <View style={styles.statusGrid}>

        {/* GPS */}
        <View style={[styles.statusCard, gpsFix ? styles.cardGreen : styles.cardOrange]}>
          <Text style={styles.statusIcon}>{gpsFix ? '📡' : '🔍'}</Text>
          <Text style={styles.statusLabel}>GPS</Text>
          <Text style={[styles.statusValue, gpsFix ? styles.textGreen : styles.textOrange]}>
            {gpsFix ? 'FIX OK' : 'Sin señal'}
          </Text>
          <Text style={styles.statusSub}>
            {gpsFix
              ? `${satellites} sat · HDOP ${hdop.toFixed(1)}`
              : `${satellites} sat buscando...`}
          </Text>
        </View>

        {/* Relé */}
        <View style={[styles.statusCard, relayActive ? styles.cardRed : styles.cardGray]}>
          <Text style={styles.statusIcon}>{relayActive ? '🔴' : '🟢'}</Text>
          <Text style={styles.statusLabel}>Relé</Text>
          <Text style={[styles.statusValue, relayActive ? styles.textRed : styles.textGreen]}>
            {telemetry ? (relayActive ? 'CORTADO' : 'NORMAL') : '—'}
          </Text>
          <Text style={styles.statusSub}>
            {telemetry ? 'Estado real del ESP32' : 'Sin datos aún'}
          </Text>
        </View>

      </View>

      {/* Velocidad */}
      <View style={styles.speedCard}>
        <Text style={styles.speedLabel}>Velocidad actual</Text>
        <View style={styles.speedRow}>
          <Text style={[styles.speedValue, speed >= 5 && styles.textOrange]}>
            {telemetry ? speed.toFixed(1) : '—'}
          </Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
        {speed >= 5 && (
          <Text style={styles.speedWarning}>
            Vehículo en movimiento — el corte será rechazado por el firmware
          </Text>
        )}
      </View>

      {/* ── CONTROLES ───────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Controles del motor</Text>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonDanger,
            relayActive && styles.buttonActiveState,
            (!connected || loading) && styles.buttonDisabled,
          ]}
          onPress={() => sendCommand('KILL_ENGINE')}
          disabled={!connected || loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              <Text style={styles.buttonIcon}>🔴</Text>
              <Text style={styles.buttonText}>Cortar Motor</Text>
              <Text style={styles.buttonSub}>
                {relayActive ? '✓ Relé ya está activado' : 'Activa el relé → corta ignición'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonSuccess,
            !relayActive && styles.buttonActiveState,
            (!connected || loading) && styles.buttonDisabled,
          ]}
          onPress={() => sendCommand('RELEASE_KILL')}
          disabled={!connected || loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              <Text style={styles.buttonIcon}>🟢</Text>
              <Text style={styles.buttonText}>Liberar Motor</Text>
              <Text style={styles.buttonSub}>
                {!relayActive ? '✓ Relé ya está liberado' : 'Desactiva el relé → restaura ignición'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Nota de seguridad */}
      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          ⚠️  La restricción de velocidad {'<'} 5 km/h está en el firmware del ESP32, no en la app.
          El comando se envía siempre, pero el ESP32 lo rechaza si el vehículo está en movimiento.
        </Text>
      </View>

      {!connected && (
        <Text style={styles.disconnectedText}>
          Sin conexión al backend — controles deshabilitados
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statusCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  cardGreen:  { backgroundColor: '#052e16', borderColor: '#22c55e' },
  cardOrange: { backgroundColor: '#1c1007', borderColor: '#f97316' },
  cardRed:    { backgroundColor: '#1c0505', borderColor: '#ef4444' },
  cardGray:   { backgroundColor: '#1e1e2e', borderColor: '#374151' },
  statusIcon:  { fontSize: 28, marginBottom: 4 },
  statusLabel: { color: '#9ca3af', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statusValue: { fontSize: 16, fontWeight: '800' },
  statusSub:   { color: '#6b7280', fontSize: 10, textAlign: 'center' },
  textGreen:   { color: '#22c55e' },
  textOrange:  { color: '#f97316' },
  textRed:     { color: '#ef4444' },
  speedCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  speedLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 6 },
  speedRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  speedValue: { color: '#f9fafb', fontSize: 36, fontWeight: '800' },
  speedUnit:  { color: '#6b7280', fontSize: 16, marginBottom: 6 },
  speedWarning: {
    color: '#f97316',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  buttonsContainer: { gap: 12, marginBottom: 16 },
  button: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  buttonDanger:      { backgroundColor: '#450a0a', borderColor: '#ef4444' },
  buttonSuccess:     { backgroundColor: '#052e16', borderColor: '#22c55e' },
  buttonActiveState: { opacity: 0.5 },
  buttonDisabled:    { opacity: 0.3 },
  buttonIcon:   { fontSize: 28 },
  buttonText:   { color: '#f9fafb', fontSize: 18, fontWeight: '700' },
  buttonSub:    { color: '#9ca3af', fontSize: 12 },
  noteCard: {
    backgroundColor: '#1c1007',
    borderColor: '#92400e',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  noteText: { color: '#fcd34d', fontSize: 12, lineHeight: 18 },
  disconnectedText: {
    color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 16,
  },
});
