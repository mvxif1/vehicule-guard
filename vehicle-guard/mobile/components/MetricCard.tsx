import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}

export function MetricCard({ label, value, unit, highlight }: MetricCardProps) {
  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, highlight && styles.valueHighlight]}>
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    margin: 6,
    minWidth: 140,
  },
  cardHighlight: {
    backgroundColor: '#1a3a5c',
    borderColor: '#3b82f6',
    borderWidth: 1,
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    color: '#f9fafb',
    fontSize: 24,
    fontWeight: '700',
  },
  valueHighlight: {
    color: '#60a5fa',
  },
  unit: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 3,
  },
});
