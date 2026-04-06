import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
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
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://event-hub-okc-1.preview.emergentagent.com';

interface RSVP {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  reminderSent: boolean;
  createdAt: string;
}

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
}

export default function MyRSVPsScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRSVPs = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Fetch RSVP list
      const rsvpResponse = await axios.get(`${API_URL}/api/rsvp/user/${user.id}`);
      const rsvpData: RSVP[] = rsvpResponse.data;
      setRsvps(rsvpData);

      // Fetch full event details for each RSVP
      const eventPromises = rsvpData.map(async (rsvp) => {
        try {
          const eventResponse = await axios.get(`${API_URL}/api/events/${rsvp.eventId}`);
          return eventResponse.data;
        } catch {
          // Event might have been deleted; return a placeholder from RSVP data
          return {
            id: rsvp.eventId,
            title: rsvp.eventTitle,
            date: rsvp.eventDate,
            time: rsvp.eventTime,
            location: rsvp.eventLocation,
            city: '',
            eventType: 'Event',
            entryFee: '',
            attendeeCount: 0,
            description: '',
          } as Event;
        }
      });

      const eventResults = await Promise.all(eventPromises);
      setEvents(eventResults);
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchRSVPs();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user, fetchRSVPs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRSVPs();
  };

  const handleCancelRSVP = async (eventId: string) => {
    if (!user?.id) return;
    try {
      await axios.delete(`${API_URL}/api/rsvp/${user.id}/${eventId}`);
      // Remove from local state
      setRsvps((prev) => prev.filter((r) => r.eventId !== eventId));
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (error) {
      console.error('Error cancelling RSVP:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isUpcoming = (dateStr: string) => {
    try {
      const eventDate = new Date(dateStr + 'T23:59:59');
      return eventDate >= new Date();
    } catch {
      return true;
    }
  };

  const EventCard = ({ item, index }: { item: Event; index: number }) => {
    const scale = useSharedValue(1);
    const upcoming = isUpcoming(item.date);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(14)}>
        <Pressable
          onPress={() => router.push(`/event/${item.id}`)}
          onPressIn={() => {
            scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15, stiffness: 200 });
          }}
        >
          <Animated.View style={[styles.eventCard, animatedStyle, !upcoming && styles.pastEventCard]}>
            {item.photos && item.photos.length > 0 && (
              <Animated.Image
                source={{ uri: item.photos[0] }}
                style={styles.eventImage}
                resizeMode="cover"
                entering={FadeIn.delay(index * 60 + 100).duration(400)}
              />
            )}
            <View style={styles.eventContent}>
              <View style={styles.eventHeader}>
                <View style={styles.eventTypeContainer}>
                  <Ionicons name="car-sport" size={16} color="#FF6B35" />
                  <Text style={styles.eventType}>{item.eventType}</Text>
                </View>
                {!upcoming && (
                  <View style={styles.pastBadge}>
                    <Text style={styles.pastBadgeText}>Past</Text>
                  </View>
                )}
                {upcoming && (
                  <View style={styles.goingBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                    <Text style={styles.goingBadgeText}>Going</Text>
                  </View>
                )}
              </View>

              <Text style={styles.eventTitle} numberOfLines={2}>
                {item.title}
              </Text>

              <View style={styles.eventDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={14} color="#FF6B35" />
                  <Text style={styles.detailText}>{formatDate(item.date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={14} color="#FF6B35" />
                  <Text style={styles.detailText}>{item.time}</Text>
                </View>
                {(item.location || item.city) && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={14} color="#FF6B35" />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {item.location || item.city}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.attendeeInfo}>
                  <Ionicons name="people-outline" size={14} color="#888" />
                  <Text style={styles.attendeeText}>{item.attendeeCount} going</Text>
                </View>
                {upcoming && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancelRSVP(item.id)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#ef5350" />
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>My RSVPs</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="log-in-outline" size={64} color="#444" />
          <Text style={styles.emptyTitle}>Login Required</Text>
          <Text style={styles.emptySubtitle}>Sign in to view your RSVP'd events</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>My RSVPs</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color="#444" />
          <Text style={styles.emptyTitle}>No RSVPs Yet</Text>
          <Text style={styles.emptySubtitle}>
            Browse events and RSVP to see them here
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(tabs)/home')}
          >
            <Text style={styles.browseButtonText}>Browse Events</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <EventCard item={item} index={index} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
              colors={['#FF6B35']}
            />
          }
          ListHeaderComponent={
            <Animated.View entering={FadeInDown.springify()} style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{events.filter((e) => isUpcoming(e.date)).length}</Text>
                <Text style={styles.statLabel}>Upcoming</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{events.filter((e) => !isUpcoming(e.date)).length}</Text>
                <Text style={styles.statLabel}>Past</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{events.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </Animated.View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    padding: 4,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#252525',
  },
  pastEventCard: {
    opacity: 0.6,
  },
  eventImage: {
    width: '100%',
    height: 160,
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
    backgroundColor: '#252525',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventType: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  goingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  goingBadgeText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  pastBadge: {
    backgroundColor: 'rgba(158, 158, 158, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pastBadgeText: {
    color: '#9E9E9E',
    fontSize: 12,
    fontWeight: '600',
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
    gap: 8,
  },
  detailText: {
    color: '#aaa',
    fontSize: 13,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attendeeText: {
    color: '#888',
    fontSize: 13,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
  },
  cancelText: {
    color: '#ef5350',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
