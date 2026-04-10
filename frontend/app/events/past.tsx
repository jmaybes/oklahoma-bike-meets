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
  Pressable,
} from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeIn,
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';

import { API_URL } from '../../utils/api';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  address: string;
  city: string;
  eventType: string;
  entryFee: string;
  organizer: string;
  carTypes: string[];
  photos: string[];
  attendeeCount: number;
}

export default function PastEventsScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    filterEvents();
  }, [events, searchQuery]);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events`);
      const allEvents = response.data || [];
      
      // Filter for past events — use event time, not just date
      const now = new Date();
      
      const pastEvents = allEvents.filter((event: Event) => {
        if (!event.date) return false;
        try {
          const eventDate = new Date(event.date);
          if (event.time) {
            const timeParts = event.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (timeParts) {
              let hours = parseInt(timeParts[1]);
              const minutes = parseInt(timeParts[2]);
              const ampm = timeParts[3];
              if (ampm) {
                if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
              }
              eventDate.setHours(hours, minutes, 0, 0);
            } else {
              eventDate.setHours(23, 59, 59, 0);
            }
          } else {
            eventDate.setHours(23, 59, 59, 0);
          }
          // Add 2 hour grace period
          eventDate.setTime(eventDate.getTime() + 2 * 60 * 60 * 1000);
          return eventDate < now;
        } catch {
          return false;
        }
      });
      
      // Sort by date descending (most recent first)
      pastEvents.sort((a: Event, b: Event) => {
        const dateA = new Date(a.date || '');
        const dateB = new Date(b.date || '');
        return dateB.getTime() - dateA.getTime();
      });
      
      setEvents(pastEvents);
    } catch (error) {
      console.error('Error fetching past events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterEvents = () => {
    let filtered = events;

    if (searchQuery) {
      filtered = filtered.filter(
        event =>
          event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.city.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredEvents(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysAgo = (dateStr: string) => {
    try {
      const eventDate = new Date(dateStr);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - eventDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return '';
    }
  };

  // Animated Event Card Component
  const AnimatedEventCard = ({ item, index }: { item: Event; index: number }) => {
    const scale = useSharedValue(1);
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    };

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(14)}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={[styles.eventCard, animatedStyle]}>
            {item.photos && item.photos.length > 0 && (
              <Animated.Image 
                source={{ uri: item.photos[0] }} 
                style={styles.eventImage}
                resizeMode="cover"
                entering={FadeIn.delay(index * 60 + 100).duration(400)}
              />
            )}
            
            {/* Past Event Overlay Badge */}
            <View style={styles.pastBadgeOverlay}>
              <Ionicons name="time" size={14} color="#fff" />
              <Text style={styles.pastBadgeText}>{getDaysAgo(item.date)}</Text>
            </View>
            
            <View style={styles.eventContent}>
              <View style={styles.eventHeader}>
                <View style={styles.eventTypeContainer}>
                  <Ionicons name="car-sport" size={16} color="#888" />
                  <Text style={styles.eventType}>{item.eventType}</Text>
                </View>
              </View>
              
              <Text style={styles.eventTitle}>{item.title}</Text>
              
              <View style={styles.eventDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={16} color="#888" />
                  <Text style={styles.detailText}>{formatDate(item.date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={16} color="#888" />
                  <Text style={styles.detailText}>{item.city}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.viewDetailsButton}
                  onPress={() => router.push(`/event/${item.id}`)}
                >
                  <Ionicons name="information-circle-outline" size={18} color="#FF5500" />
                  <Text style={styles.viewDetailsText}>View Details</Text>
                </TouchableOpacity>
                
                {isAuthenticated && (
                  <TouchableOpacity 
                    style={styles.uploadPhotosButton}
                    onPress={() => router.push(`/event/${item.id}/gallery`)}
                  >
                    <Ionicons name="camera" size={18} color="#4CAF50" />
                    <Text style={styles.uploadPhotosText}>Upload Photos</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderEventCard = ({ item, index }: { item: Event; index: number }) => (
    <AnimatedEventCard item={item} index={index} />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={['#D32F2F', '#B71C1C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Past Events</Text>
          <Text style={styles.headerSubtitle}>
            {filteredEvents.length} events from the past
          </Text>
        </View>
        <Ionicons name="time" size={28} color="#fff" />
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search past events..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={18} color="#FF5500" />
        <Text style={styles.infoBannerText}>
          Share your photos from events you attended!
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D32F2F" />
          <Text style={styles.loadingText}>Loading past events...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEventCard}
          contentContainerStyle={styles.eventsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#D32F2F"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No past events found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search' : 'Check back later'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(225, 85, 0, 0.15)',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  infoBannerText: {
    color: '#FF5500',
    fontSize: 13,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  eventsList: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  eventImage: {
    width: '100%',
    height: 160,
  },
  pastBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  pastBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventType: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  eventDetails: {
    gap: 6,
    marginBottom: 12,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  viewDetailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(225, 85, 0, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  viewDetailsText: {
    color: '#FF5500',
    fontSize: 13,
    fontWeight: '600',
  },
  uploadPhotosButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  uploadPhotosText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
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
