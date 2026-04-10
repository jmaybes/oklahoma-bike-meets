import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NearbyMapViewProps {
  location: { latitude: number; longitude: number } | null;
  radius: number;
  nearbyUsers?: any[];
  onCenterOnUser?: () => void;
  onRefresh?: () => void;
}

// Web fallback - show a styled placeholder since react-native-maps doesn't work on web
export default function NearbyMapView({ location, radius }: NearbyMapViewProps) {
  return (
    <View style={styles.mapPlaceholder}>
      <View style={styles.mapPlaceholderInner}>
        <Ionicons name="map" size={48} color="#FF5500" />
        <Text style={styles.mapPlaceholderTitle}>Your Location</Text>
        <Text style={styles.mapPlaceholderCoords}>
          {location ? `${location.latitude.toFixed(4)}°N, ${Math.abs(location.longitude).toFixed(4)}°W` : 'Loading...'}
        </Text>
        <View style={styles.mapPlaceholderRadius}>
          <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
          <Text style={styles.mapPlaceholderRadiusText}>
            Searching within {radius} miles
          </Text>
        </View>
        <Text style={styles.mapPlaceholderNote}>
          Open in Expo Go app for live map view
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapPlaceholder: {
    height: 280,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  mapPlaceholderInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  mapPlaceholderCoords: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  mapPlaceholderRadius: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapPlaceholderRadiusText: {
    color: '#4CAF50',
    fontSize: 13,
  },
  mapPlaceholderNote: {
    color: '#666',
    fontSize: 12,
    marginTop: 16,
    fontStyle: 'italic',
  },
});
