import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  city: string;
  eventType: string;
  entryFee: string;
  attendeeCount: number;
  photos?: string[];
  latitude?: number;
  longitude?: number;
  distance?: number;
}

// Calculate distance between two coordinates in miles
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [freeOnly, setFreeOnly] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);
  const [locationError, setLocationError] = useState(false);
  
  const eventTypes = ['All', 'Car Meet', 'Car Show', 'Cruise', 'Race', 'Other'];
  const distanceOptions = [
    { label: 'Any', value: null },
    { label: '10 mi', value: 10 },
    { label: '25 mi', value: 25 },
    { label: '50 mi', value: 50 },
    { label: '100 mi', value: 100 },
  ];

  useEffect(() => {
    fetchEvents();
    getUserLocation();
  }, []);

  useEffect(() => {
    filterEvents();
  }, [events, searchQuery, selectedType, freeOnly, maxDistance, userLocation]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(true);
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lon: location.coords.longitude
      });
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError(true);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events`);
      // Calculate distance for each event if user location is available
      const eventsWithDistance = response.data.map((event: Event) => {
        if (userLocation && event.latitude && event.longitude) {
          return {
            ...event,
            distance: calculateDistance(
              userLocation.lat,
              userLocation.lon,
              event.latitude,
              event.longitude
            )
          };
        }
        return event;
      });
      setEvents(eventsWithDistance);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterEvents = () => {
    let filtered = events;

    // Filter by event type
    if (selectedType !== 'All') {
      filtered = filtered.filter(event => event.eventType === selectedType);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        event =>
          event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by free events only
    if (freeOnly) {
      filtered = filtered.filter(event => {
        const fee = event.entryFee?.toLowerCase() || '';
        return fee === '' || fee === 'free' || fee === '$0' || fee === '0';
      });
    }

    // Filter by distance
    if (maxDistance !== null && userLocation) {
      filtered = filtered.filter(event => {
        if (event.distance !== undefined) {
          return event.distance <= maxDistance;
        }
        // If no coordinates, don't filter out (include by default)
        return true;
      });
      
      // Sort by distance when distance filter is active
      filtered = filtered.sort((a, b) => {
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      });
    }

    setFilteredEvents(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const renderEventCard = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => router.push(`/event/${item.id}`)}
    >
      {item.photos && item.photos.length > 0 && (
        <Image 
          source={{ uri: item.photos[0] }} 
          style={styles.eventImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <View style={styles.eventTypeContainer}>
            <Ionicons name="car-sport" size={16} color="#FF6B35" />
            <Text style={styles.eventType}>{item.eventType}</Text>
          </View>
          <View style={styles.eventBadges}>
            {item.distance !== undefined && (
              <View style={styles.distanceBadge}>
                <Ionicons name="navigate" size={12} color="#4CAF50" />
                <Text style={styles.distanceText}>{item.distance.toFixed(1)} mi</Text>
              </View>
            )}
            {item.entryFee && (
              <Text style={[
                styles.entryFee,
                (item.entryFee.toLowerCase() === 'free' || item.entryFee === '$0') && styles.freeBadge
              ]}>
                {item.entryFee}
              </Text>
            )}
          </View>
        </View>
        
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventDescription} numberOfLines={2}>
          {item.description}
        </Text>
        
        <View style={styles.eventDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color="#888" />
            <Text style={styles.detailText}>{item.date} at {item.time}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={16} color="#888" />
            <Text style={styles.detailText}>{item.city}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="people" size={16} color="#888" />
            <Text style={styles.detailText}>{item.attendeeCount} attending</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#FF6B35', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Oklahoma Car Events</Text>
            <Text style={styles.headerSubtitle}>Discover car meets near you</Text>
          </View>
          <Ionicons name="car-sport" size={32} color="#fff" />
        </View>
      </LinearGradient>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events or cities..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Row 1: Event Types */}
      <View style={styles.filterWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {eventTypes.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.filterChip,
                selectedType === item && styles.filterChipActive,
              ]}
              onPress={() => setSelectedType(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedType === item && styles.filterChipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filter Row 2: Free & Distance */}
      <View style={styles.filterRow2}>
        {/* Free Toggle */}
        <TouchableOpacity
          style={[
            styles.toggleFilterChip,
            freeOnly && styles.toggleFilterChipActive,
          ]}
          onPress={() => setFreeOnly(!freeOnly)}
        >
          <Ionicons 
            name={freeOnly ? "checkmark-circle" : "pricetag-outline"} 
            size={16} 
            color={freeOnly ? "#fff" : "#4CAF50"} 
          />
          <Text
            style={[
              styles.toggleFilterText,
              freeOnly && styles.toggleFilterTextActive,
            ]}
          >
            Free Only
          </Text>
        </TouchableOpacity>

        {/* Distance Filter */}
        <View style={styles.distanceFilterContainer}>
          <Ionicons name="navigate-outline" size={16} color="#2196F3" />
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.distanceOptions}
          >
            {distanceOptions.map((option) => (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.distanceChip,
                  maxDistance === option.value && styles.distanceChipActive,
                ]}
                onPress={() => setMaxDistance(option.value)}
              >
                <Text
                  style={[
                    styles.distanceChipText,
                    maxDistance === option.value && styles.distanceChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Location Warning */}
      {maxDistance !== null && !userLocation && (
        <View style={styles.locationWarning}>
          <Ionicons name="warning" size={14} color="#FFC107" />
          <Text style={styles.locationWarningText}>
            Enable location to filter by distance
          </Text>
        </View>
      )}

      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderEventCard}
        contentContainerStyle={styles.eventsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="car" size={64} color="#333" />
            <Text style={styles.emptyText}>No events found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        }
      />
    </View>
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
  headerGradient: {
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
  },
  filterWrapper: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  filterContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#404040',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#606060',
  },
  filterChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  filterChipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  eventsList: {
    padding: 20,
    paddingTop: 0,
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#2a2a2a',
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventType: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  entryFee: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  freeBadge: {
    backgroundColor: '#4CAF50',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  eventBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  distanceText: {
    color: '#4CAF50',
    fontSize: 11,
    fontWeight: '600',
  },
  filterRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  toggleFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
    gap: 6,
  },
  toggleFilterChipActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  toggleFilterText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleFilterTextActive: {
    color: '#fff',
  },
  distanceFilterContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingLeft: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  distanceOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  distanceChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  distanceChipActive: {
    backgroundColor: '#2196F3',
  },
  distanceChipText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  distanceChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    marginBottom: 8,
  },
  locationWarningText: {
    color: '#FFC107',
    fontSize: 12,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 12,
    lineHeight: 20,
  },
  eventDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
