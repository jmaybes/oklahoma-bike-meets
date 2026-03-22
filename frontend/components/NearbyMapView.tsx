import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';

interface NearbyUser {
  id: string;
  name: string;
  nickname: string;
  latitude: number;
  longitude: number;
  distance: number;
}

interface NearbyMapViewProps {
  location: { latitude: number; longitude: number } | null;
  radius: number;
  nearbyUsers?: NearbyUser[];
  onCenterOnUser?: () => void;
  onRefresh?: () => void;
}

// Dark map style
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
];

export default function NearbyMapView({ 
  location, 
  radius, 
  nearbyUsers = [], 
  onCenterOnUser, 
  onRefresh 
}: NearbyMapViewProps) {
  const mapRef = useRef<MapView>(null);

  // Guard against null location
  if (!location) {
    return (
      <View style={styles.mapPlaceholder}>
        <Ionicons name="location-outline" size={48} color="#666" />
        <Text style={styles.mapPlaceholderText}>Getting your location...</Text>
      </View>
    );
  }

  // Convert radius in miles to meters for Circle component
  const radiusInMeters = radius * 1609.34;
  
  // Calculate appropriate zoom level based on radius
  // Smaller radius = more zoomed in, larger radius = more zoomed out
  const getLatitudeDelta = (r: number) => {
    if (r <= 5) return 0.1;
    if (r <= 10) return 0.2;
    if (r <= 25) return 0.5;
    return r / 50;
  };

  useEffect(() => {
    if (location && mapRef.current) {
      const delta = getLatitudeDelta(radius);
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }, 1000);
    }
  }, [location, radius]);

  const handleCenterOnUser = () => {
    if (location && mapRef.current) {
      const delta = getLatitudeDelta(radius);
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }, 500);
    }
    if (onCenterOnUser) onCenterOnUser();
  };
  
  const handleZoomIn = () => {
    if (mapRef.current && location) {
      try {
        // Use region-based zooming instead of camera API for better compatibility
        const currentDelta = getLatitudeDelta(radius);
        const newDelta = Math.max(0.01, currentDelta * 0.5);
        mapRef.current.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: newDelta,
          longitudeDelta: newDelta,
        }, 300);
      } catch (error) {
        console.log('Zoom in error:', error);
      }
    }
  };
  
  const handleZoomOut = () => {
    if (mapRef.current && location) {
      try {
        const currentDelta = getLatitudeDelta(radius);
        const newDelta = Math.min(10, currentDelta * 2);
        mapRef.current.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: newDelta,
          longitudeDelta: newDelta,
        }, 300);
      } catch (error) {
        console.log('Zoom out error:', error);
      }
    }
  };

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: getLatitudeDelta(radius),
          longitudeDelta: getLatitudeDelta(radius),
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        showsTraffic={false}
        showsBuildings={true}
        mapType="standard"
        customMapStyle={darkMapStyle}
      >
        {/* User's location marker */}
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="You are here"
          description="Your current location"
        >
          <View style={styles.userMarker}>
            <Ionicons name="car-sport" size={20} color="#fff" />
          </View>
        </Marker>

        {/* Search radius circle - semi-transparent */}
        <Circle
          center={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          radius={radiusInMeters}
          fillColor="rgba(255, 107, 53, 0.08)"
          strokeColor="rgba(255, 107, 53, 0.3)"
          strokeWidth={1}
        />

        {/* Nearby users markers */}
        {nearbyUsers.map((nearbyUser) => (
          <Marker
            key={nearbyUser.id}
            coordinate={{
              latitude: nearbyUser.latitude,
              longitude: nearbyUser.longitude,
            }}
            title={nearbyUser.nickname || nearbyUser.name}
            description={`${nearbyUser.distance} miles away`}
          >
            <View style={styles.nearbyUserMarker}>
              <Ionicons name="person" size={16} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Map overlay controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.mapControlButton} onPress={handleCenterOnUser}>
          <Ionicons name="locate" size={22} color="#FF6B35" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapControlButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={22} color="#FF6B35" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapControlButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={22} color="#FF6B35" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapControlButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      {/* User count badge */}
      <View style={styles.userCountBadge}>
        <Ionicons name="people" size={16} color="#fff" />
        <Text style={styles.userCountText}>
          {nearbyUsers.length} nearby
        </Text>
      </View>
      
      {/* Radius info */}
      <View style={styles.radiusInfoBadge}>
        <Ionicons name="radio-button-on" size={14} color="#4CAF50" />
        <Text style={styles.radiusInfoText}>{radius} mi radius</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 350,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    height: 350,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#888',
    marginTop: 12,
  },
  mapControls: {
    position: 'absolute',
    right: 12,
    top: 12,
    gap: 8,
  },
  mapControlButton: {
    backgroundColor: '#1a1a1a',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 8,
  },
  userCountBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  userCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  radiusInfoBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  radiusInfoText: {
    color: '#fff',
    fontSize: 12,
  },
  userMarker: {
    backgroundColor: '#FF6B35',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  nearbyUserMarker: {
    backgroundColor: '#4CAF50',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
