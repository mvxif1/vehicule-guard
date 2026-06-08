import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { DashboardScreen } from './screens/DashboardScreen';
import { MapScreen } from './screens/MapScreen';
import { TripsScreen } from './screens/TripsScreen';
import { ControlsScreen } from './screens/ControlsScreen';
import { TelemetryProvider } from './hooks/TelemetryContext';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <TelemetryProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#f9fafb',
            headerTitleStyle: { fontWeight: '700' },
            tabBarStyle: {
              backgroundColor: '#1e1e2e',
              borderTopColor: '#2d2d44',
            },
            tabBarActiveTintColor: '#3b82f6',
            tabBarInactiveTintColor: '#6b7280',
          }}
        >
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{
              title: 'VehicleGuard',
              tabBarLabel: 'Dashboard',
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 20, color }}>📊</Text>
              ),
            }}
          />
          <Tab.Screen
            name="Map"
            component={MapScreen}
            options={{
              title: 'Mapa en Vivo',
              tabBarLabel: 'Mapa',
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 20, color }}>🗺️</Text>
              ),
            }}
          />
          <Tab.Screen
            name="Trips"
            component={TripsScreen}
            options={{
              title: 'Viajes',
              tabBarLabel: 'Viajes',
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 20, color }}>🏍️</Text>
              ),
            }}
          />
          <Tab.Screen
            name="Controls"
            component={ControlsScreen}
            options={{
              title: 'Controles',
              tabBarLabel: 'Controles',
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 20, color }}>🔧</Text>
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </TelemetryProvider>
  );
}
