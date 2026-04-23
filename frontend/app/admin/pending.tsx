import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

import { API_URL } from '../../utils/api';

interface PendingEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  city: string;
  eventType: string;
  organizer: string;
}

export default function AdminPendingScreen() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to hydrate
    
    if (!isAuthenticated || !user?.isAdmin) {
      Alert.alert('Access Denied', 'You must be an admin to access this page', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }
    fetchPendingEvents();
  }, [authLoading, isAuthenticated, user]);

  const fetchPendingEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/events/pending`, {
        params: { admin_id: user?.id }
      });
      const data = response.data;
      setPendingEvents(Array.isArray(data) ? data : data.events || []);
    } catch (error) {
      console.error('Error fetching pending events:', error);
      Alert.alert('Error', 'Failed to load pending events');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (eventId: string) => {
    setProcessing(eventId);
    try {
      await axios.put(
        `${API_URL}/api/admin/events/${eventId}/approve`,
        null,
        { params: { admin_id: user?.id } }
      );
      Alert.alert('Success', 'Event approved successfully!');
      setPendingEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('Error approving event:', error);
      Alert.alert('Error', 'Failed to approve event');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (eventId: string) => {
    Alert.alert(
      'Reject Event',
      'Are you sure you want to reject and delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(eventId);
            try {
              await axios.delete(
                `${API_URL}/api/admin/events/${eventId}/reject`,
                { params: { admin_id: user?.id } }
              );
              Alert.alert('Success', 'Event rejected');
              setPendingEvents(prev => prev.filter(e => e.id !== eventId));
            } catch (error) {
              console.error('Error rejecting event:', error);
              Alert.alert('Error', 'Failed to reject event');
            } finally {
              setProcessing(null);
            }
          }
        }
      ]
    );
  };

  const renderPendingEvent = ({ item }: { item: PendingEvent }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.eventBadge}>
          <Text style={styles.badgeText}>PENDING</Text>
        </View>
        <View style={styles.typeTag}>
          <Text style={styles.typeText}>{item.eventType}</Text>
        </View>
      </View>

      <Text style={styles.eventTitle}>{item.title}</Text>
      <Text style={styles.eventDescription} numberOfLines={3}>
        {item.description}
      </Text>

      <View style={styles.eventInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar" size={16} color="#888" />
          <Text style={styles.infoText}>{item.date} at {item.time}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location" size={16} color="#888" />
          <Text style={styles.infoText}>{item.city}</Text>
        </View>
        {item.organizer && (
          <View style={styles.infoRow}>
            <Ionicons name="person" size={16} color="#888" />
            <Text style={styles.infoText}>{item.organizer}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item.id)}
          disabled={processing === item.id}
        >
          {processing === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApprove(item.id)}
          disabled={processing === item.id}
        >
          {processing === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#E31837" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Pending Events</Text>
          <Text style={styles.headerSubtitle}>
            {pendingEvents.length} event{pendingEvents.length !== 1 ? 's' : ''} awaiting approval
          </Text>
        </View>
      </View>

      <FlatList
        data={pendingEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderPendingEvent}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle" size={64} color="#EFFF00" />
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>No events pending approval</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
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
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  list: {
    padding: 16,
  },
  eventCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E31837',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventBadge: {
    backgroundColor: '#E31837',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  typeTag: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 12,
  },
  eventInfo: {
    gap: 6,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  approveButton: {
    backgroundColor: '#EFFF00',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
