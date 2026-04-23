import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

import { API_URL } from '../../utils/api';

interface DiscoveredEvent {
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
  website: string;
  carTypes: string[];
  photos: string[];
  source: string;
  isRecurring: boolean;
  discoveredAt: string;
}

interface SearchStats {
  searches_performed: number;
  events_found: number;
  events_imported: number;
  duplicates_skipped: number;
  errors: number;
}

export default function EventSearchScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [pendingEvents, setPendingEvents] = useState<DiscoveredEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSearchStats, setLastSearchStats] = useState<SearchStats | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const fetchPendingEvents = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/events/pending?admin_id=${user.id}`
      );
      setPendingEvents(response.data.events || []);
    } catch (error) {
      console.error('Error fetching pending events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPendingEvents();
  }, [fetchPendingEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPendingEvents();
  }, [fetchPendingEvents]);

  const runEventSearch = async () => {
    if (!user?.id) return;
    
    setSearching(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/admin/events/search?admin_id=${user.id}`
      );
      
      setLastSearchStats(response.data.stats);
      
      Alert.alert(
        'Search Complete',
        response.data.message,
        [{ text: 'OK', onPress: fetchPendingEvents }]
      );
    } catch (error: any) {
      console.error('Search error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const approveEvent = async (eventId: string) => {
    if (!user?.id) return;
    
    setApproving(eventId);
    try {
      await axios.post(
        `${API_URL}/api/admin/events/${eventId}/approve?admin_id=${user.id}`
      );
      
      // Remove from list
      setPendingEvents(prev => prev.filter(e => e.id !== eventId));
      
      Alert.alert('Success', 'Event approved and published!');
    } catch (error: any) {
      console.error('Approve error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to approve');
    } finally {
      setApproving(null);
    }
  };

  const rejectEvent = async (eventId: string) => {
    if (!user?.id) return;
    
    Alert.alert(
      'Reject Event',
      'Are you sure you want to reject and delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setApproving(eventId);
            try {
              await axios.delete(
                `${API_URL}/api/admin/events/${eventId}/reject?admin_id=${user.id}`
              );
              
              setPendingEvents(prev => prev.filter(e => e.id !== eventId));
            } catch (error: any) {
              console.error('Reject error:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to reject');
            } finally {
              setApproving(null);
            }
          }
        }
      ]
    );
  };

  const approveAllEvents = async () => {
    if (!user?.id || pendingEvents.length === 0) return;
    
    Alert.alert(
      'Approve All Events',
      `Are you sure you want to approve all ${pendingEvents.length} pending events?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve All',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await axios.post(
                `${API_URL}/api/admin/events/approve-all?admin_id=${user.id}`
              );
              
              Alert.alert('Success', response.data.message);
              setPendingEvents([]);
            } catch (error: any) {
              console.error('Approve all error:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to approve all');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
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

  if (authLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#E31837" />
      </View>
    );
  }

  if (!user?.isAdmin) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={48} color="#E31837" />
          <Text style={styles.errorText}>Admin access required</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#9C27B0', '#E31837']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backArrow}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Event Search</Text>
          <Text style={styles.headerSubtitle}>
            Discover new Oklahoma bike events
          </Text>
        </View>
        <Ionicons name="search" size={28} color="#fff" />
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E31837"
          />
        }
      >
        {/* Search Button */}
        <TouchableOpacity
          style={styles.searchButton}
          onPress={runEventSearch}
          disabled={searching}
        >
          <LinearGradient
            colors={['#EFFF00', '#45a049']}
            style={styles.searchButtonGradient}
          >
            {searching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="search-outline" size={24} color="#fff" />
            )}
            <Text style={styles.searchButtonText}>
              {searching ? 'Searching for Events...' : 'Run Event Search Now'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Last Search Stats */}
        {lastSearchStats && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>Last Search Results</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{lastSearchStats.events_found}</Text>
                <Text style={styles.statLabel}>Found</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: '#EFFF00' }]}>
                  {lastSearchStats.events_imported}
                </Text>
                <Text style={styles.statLabel}>Imported</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: '#FF9800' }]}>
                  {lastSearchStats.duplicates_skipped}
                </Text>
                <Text style={styles.statLabel}>Duplicates</Text>
              </View>
            </View>
          </View>
        )}

        {/* Pending Events Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Pending Approval ({pendingEvents.length})
          </Text>
          {pendingEvents.length > 0 && (
            <TouchableOpacity
              style={styles.approveAllButton}
              onPress={approveAllEvents}
            >
              <Text style={styles.approveAllText}>Approve All</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E31837" />
            <Text style={styles.loadingText}>Loading pending events...</Text>
          </View>
        ) : pendingEvents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#EFFF00" />
            <Text style={styles.emptyText}>No events pending approval</Text>
            <Text style={styles.emptySubtext}>
              Run a search to discover new events
            </Text>
          </View>
        ) : (
          pendingEvents.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              {event.photos?.[0] && (
                <Image
                  source={{ uri: event.photos[0] }}
                  style={styles.eventImage}
                  resizeMode="cover"
                />
              )}
              
              <View style={styles.eventContent}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle} numberOfLines={2}>
                    {event.title}
                  </Text>
                  {event.isRecurring && (
                    <View style={styles.recurringBadge}>
                      <Ionicons name="repeat" size={12} color="#fff" />
                      <Text style={styles.recurringText}>Weekly</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.eventMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar" size={14} color="#E31837" />
                    <Text style={styles.metaText}>{formatDate(event.date)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time" size={14} color="#E31837" />
                    <Text style={styles.metaText}>{event.time || 'TBD'}</Text>
                  </View>
                </View>
                
                <View style={styles.metaItem}>
                  <Ionicons name="location" size={14} color="#E31837" />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {event.city || event.location}
                  </Text>
                </View>
                
                <View style={styles.eventTypeBadge}>
                  <Text style={styles.eventTypeText}>{event.eventType}</Text>
                </View>
                
                {event.description && (
                  <Text style={styles.eventDescription} numberOfLines={3}>
                    {event.description}
                  </Text>
                )}
                
                <View style={styles.eventActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => approveEvent(event.id)}
                    disabled={approving === event.id}
                  >
                    {approving === event.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => rejectEvent(event.id)}
                    disabled={approving === event.id}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
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
    paddingTop: 12,
  },
  backArrow: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  searchButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  approveAllButton: {
    backgroundColor: '#EFFF00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveAllText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  eventImage: {
    width: '100%',
    height: 150,
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFFF00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    gap: 4,
  },
  recurringText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  eventMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    color: '#ccc',
    fontSize: 13,
  },
  eventTypeBadge: {
    backgroundColor: '#E31837',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  eventTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventDescription: {
    color: '#999',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#EFFF00',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  backButton: {
    backgroundColor: '#E31837',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
