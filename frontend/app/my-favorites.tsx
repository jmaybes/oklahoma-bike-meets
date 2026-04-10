import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  city: string;
  eventType: string;
  entryFee: string;
  photos?: string[];
}

export default function MyFavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchFavorites();
    }, [user?.id])
  );

  const fetchFavorites = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const response = await api.get(`/favorites/user/${user.id}`);
      const mapped = (response.data || []).map((e: any) => ({
        id: e._id || e.id,
        title: e.title || '',
        description: e.description || '',
        date: e.date || '',
        time: e.time || '',
        city: e.city || e.location || '',
        eventType: e.eventType || '',
        entryFee: e.entryFee || '',
        photos: e.photos || [],
      }));
      setEvents(mapped);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFavorites();
    setRefreshing(false);
  };

  const removeFavorite = async (eventId: string) => {
    if (!user?.id) return;
    try {
      await api.delete(`/favorites/${user.id}/${eventId}`);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('Error removing favorite:', error);
      Alert.alert('Error', 'Could not remove from favorites.');
    }
  };

  const renderEvent = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => router.push(`/event/${item.id}`)}
      activeOpacity={0.8}
    >
      {item.photos && item.photos.length > 0 && (
        <Image source={{ uri: item.photos[0] }} style={styles.eventImage} resizeMode="cover" />
      )}
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <View style={styles.typeBadge}>
            <Ionicons name="car-sport" size={14} color="#FF5500" />
            <Text style={styles.typeText}>{item.eventType}</Text>
          </View>
          <TouchableOpacity
            onPress={() => removeFavorite(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="heart" size={24} color="#E91E63" />
          </TouchableOpacity>
        </View>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={14} color="#888" />
          <Text style={styles.detailText}>{item.date} at {item.time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={14} color="#888" />
          <Text style={styles.detailText}>{item.city}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#E91E63', '#FF5500']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>My Favorite Events</Text>
          <Text style={styles.headerSubtitle}>{events.length} saved event{events.length !== 1 ? 's' : ''}</Text>
        </View>
        <Ionicons name="heart" size={28} color="#fff" />
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E91E63" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E91E63" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={64} color="#444" />
              <Text style={styles.emptyTitle}>No favorites yet</Text>
              <Text style={styles.emptyText}>
                Tap the heart icon on any event to save it here
              </Text>
              <TouchableOpacity style={styles.browseButton} onPress={() => router.push('/(tabs)/home')}>
                <Text style={styles.browseButtonText}>Browse Events</Text>
              </TouchableOpacity>
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
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  eventImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#2a2a2a',
  },
  eventContent: {
    padding: 14,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeText: {
    color: '#FF5500',
    fontSize: 12,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  eventDesc: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 10,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    color: '#888',
    fontSize: 13,
    marginLeft: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: '#E91E63',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
