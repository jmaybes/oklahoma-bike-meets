import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
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
  time: string;
  address: string;
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
        <Text style={styles.headerSubtitle}>{events.length} events with locations</Text>
      </View>
      
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={24} color="#FF6B35" />
        <Text style={styles.infoText}>
          Download the mobile app to view events on an interactive map!
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.listContent}>
        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="map" size={64} color="#333" />
            <Text style={styles.emptyText}>No events with locations yet</Text>
          </View>
        ) : (
          events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => router.push(`/event/${event.id}`)}
            >
              <View style={styles.eventHeader}>
                <View style={styles.locationIcon}>
                  <Ionicons name="location" size={24} color="#FF6B35" />
                </View>
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventType}>{event.eventType}</Text>
                  <View style={styles.eventDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar" size={14} color="#888" />
                      <Text style={styles.detailText}>{event.date} at {event.time}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="pin" size={14} color="#888" />
                      <Text style={styles.detailText}>{event.city}</Text>
                    </View>
                    {event.address && (
                      <View style={styles.detailRow}>
                        <Ionicons name="navigate" size={14} color="#888" />
                        <Text style={styles.detailText}>{event.address}</Text>
                      </View>
                    )}
                  </View>
                  {event.latitude && event.longitude && (
                    <View style={styles.coordinatesRow}>
                      <Ionicons name="globe" size={12} color="#666" />
                      <Text style={styles.coordinatesText}>
                        {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    color: '#aaa',
    fontSize: 13,
    marginLeft: 12,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  eventHeader: {
    flexDirection: 'row',
  },
  locationIcon: {
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  eventType: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
    marginBottom: 12,
  },
  eventDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 6,
  },
  coordinatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  coordinatesText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 6,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
});
