import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = 'https://event-hub-okc-1.preview.emergentagent.com';

interface PendingClub {
  id: string;
  name: string;
  description: string;
  location: string;
  city: string;
  carTypes: string[];
  website: string;
  facebookGroup: string;
  meetingSchedule: string;
}

export default function AdminPendingClubsScreen() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [pendingClubs, setPendingClubs] = useState<PendingClub[]>([]);
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
    fetchPendingClubs();
  }, [authLoading, isAuthenticated, user]);

  const fetchPendingClubs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/clubs/pending`, {
        params: { admin_id: user?.id }
      });
      setPendingClubs(response.data);
    } catch (error) {
      console.error('Error fetching pending clubs:', error);
      Alert.alert('Error', 'Failed to load pending clubs');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (clubId: string) => {
    setProcessing(clubId);
    try {
      await axios.put(
        `${API_URL}/api/admin/clubs/${clubId}/approve`,
        null,
        { params: { admin_id: user?.id } }
      );
      Alert.alert('Success', 'Club approved successfully!');
      setPendingClubs(prev => prev.filter(c => c.id !== clubId));
    } catch (error) {
      console.error('Error approving club:', error);
      Alert.alert('Error', 'Failed to approve club');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (clubId: string) => {
    Alert.alert(
      'Reject Club',
      'Are you sure you want to reject and delete this club submission?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(clubId);
            try {
              await axios.delete(
                `${API_URL}/api/admin/clubs/${clubId}/reject?admin_id=${user?.id}`
              );
              // Remove locally immediately
              setPendingClubs(prev => prev.filter(c => c.id !== clubId));
              Alert.alert('Success', 'Club rejected and deleted');
              // Re-fetch to ensure UI is synced with DB
              fetchPendingClubs();
            } catch (error) {
              console.error('Error rejecting club:', error);
              Alert.alert('Error', 'Failed to reject club');
            } finally {
              setProcessing(null);
            }
          }
        }
      ]
    );
  };

  const renderPendingClub = ({ item }: { item: PendingClub }) => (
    <View style={styles.clubCard}>
      <View style={styles.clubHeader}>
        <View style={styles.clubBadge}>
          <Text style={styles.badgeText}>PENDING</Text>
        </View>
        <Ionicons name="people-circle" size={32} color="#9C27B0" />
      </View>

      <Text style={styles.clubName}>{item.name}</Text>
      <Text style={styles.clubCity}>{item.city}</Text>
      <Text style={styles.clubDescription} numberOfLines={3}>
        {item.description}
      </Text>

      {item.carTypes.length > 0 && (
        <View style={styles.carTypesContainer}>
          {item.carTypes.map((type, index) => (
            <View key={index} style={styles.carTypeChip}>
              <Text style={styles.carTypeText}>{type}</Text>
            </View>
          ))}
        </View>
      )}

      {item.meetingSchedule && (
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color="#888" />
          <Text style={styles.infoText}>{item.meetingSchedule}</Text>
        </View>
      )}

      {(item.website || item.facebookGroup) && (
        <View style={styles.linksRow}>
          {item.website && (
            <TouchableOpacity
              style={styles.linkTag}
              onPress={() => Linking.openURL(item.website)}
            >
              <Ionicons name="globe" size={12} color="#2196F3" />
              <Text style={styles.linkTagText}>Website</Text>
            </TouchableOpacity>
          )}
          {item.facebookGroup && (
            <TouchableOpacity
              style={styles.linkTag}
              onPress={() => Linking.openURL(item.facebookGroup)}
            >
              <Ionicons name="logo-facebook" size={12} color="#1877F2" />
              <Text style={styles.linkTagText}>Facebook</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
        <ActivityIndicator size="large" color="#9C27B0" />
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
          <Text style={styles.headerTitle}>Pending Clubs</Text>
          <Text style={styles.headerSubtitle}>
            {pendingClubs.length} club{pendingClubs.length !== 1 ? 's' : ''} awaiting approval
          </Text>
        </View>
      </View>

      <FlatList
        data={pendingClubs}
        keyExtractor={(item) => item.id}
        renderItem={renderPendingClub}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle" size={64} color="#4CAF50" />
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>No clubs pending approval</Text>
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
    borderBottomColor: '#1a1a1a',
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
  clubCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#9C27B0',
  },
  clubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clubBadge: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  clubName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  clubCity: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  clubDescription: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 12,
  },
  carTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  carTypeChip: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  carTypeText: {
    color: '#9C27B0',
    fontSize: 11,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 6,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  linkTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  linkTagText: {
    color: '#888',
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
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
    backgroundColor: '#4CAF50',
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
