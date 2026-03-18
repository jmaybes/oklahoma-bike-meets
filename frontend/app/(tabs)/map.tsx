import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Event {
  id: string;
  title: string;
  location: string;
  latitude?: number;
  longitude?: number;
  city: string;
  eventType: string;
  date: string;
}

export default function MapScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events`);
      const eventsWithCoords = response.data.filter(
        (event: Event) => event.latitude && event.longitude
      );
      setEvents(eventsWithCoords);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Event Locations</Text>
        <Text style={styles.headerSubtitle}>{events.length} events on map</Text>
      </View>
      
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 35.4676,
          longitude: -97.5164,
          latitudeDelta: 2,
          longitudeDelta: 2,
        }}
      >
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.latitude!,
              longitude: event.longitude!,
            }}
            pinColor="#FF6B35"
          >
            <Callout
              onPress={() => router.push(`/event/${event.id}`)}
              style={styles.callout}
            >
              <View style={styles.calloutContent}>
                <Text style={styles.calloutTitle}>{event.title}</Text>
                <Text style={styles.calloutType}>{event.eventType}</Text>
                <Text style={styles.calloutDate}>{event.date}</Text>
                <Text style={styles.calloutLocation}>{event.city}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {events.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Ionicons name="map" size={48} color="#666" />
          <Text style={styles.emptyText}>No events with locations yet</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0c0c0c',
  },
  header: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  map: {
    flex: 1,
  },
  callout: {
    width: 200,
  },
  calloutContent: {
    padding: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  calloutType: {
    fontSize: 12,
    color: '#FF6B35',
    marginBottom: 2,
  },
  calloutDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  calloutLocation: {
    fontSize: 12,
    color: '#666',
  },
  emptyOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -50 }],
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    padding: 24,
    borderRadius: 16,
    width: 200,
  },
  emptyText: {
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
});
