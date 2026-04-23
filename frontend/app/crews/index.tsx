import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, RockSalt_400Regular } from '@expo-google-fonts/rock-salt';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../../utils/api';

interface Crew {
  id: string;
  name: string;
  creatorId: string;
  memberCount: number;
  isCreator: boolean;
}

interface PendingInvite {
  id: string;
  crewId: string;
  crewName: string;
  fromUserId: string;
  fromUserName: string;
  createdAt: string;
}

export default function MyCrewsScreen() {
  const { user, token, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ RockSalt_400Regular });
  const [crews, setCrews] = useState<Crew[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createdCrew, setCreatedCrew] = useState<Crew | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id || !token) return;
    try {
      const [crewsRes, invitesRes] = await Promise.all([
        axios.get(`${API_URL}/api/crews/user/${user.id}`),
        axios.get(`${API_URL}/api/crews/invites/pending/${user.id}`),
      ]);
      const crewsList = crewsRes.data || [];
      setCrews(crewsList);
      setPendingInvites(invitesRes.data || []);
      const myCreated = crewsList.find((c: Crew) => c.isCreator);
      setCreatedCrew(myCreated || null);
    } catch (err) {
      console.error('Error fetching crews:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, token]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      await axios.put(
        `${API_URL}/api/crews/invites/${inviteId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Welcome!', 'You joined the crew!');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to accept invite');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await axios.put(
        `${API_URL}/api/crews/invites/${inviteId}/decline`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to decline invite');
    }
  };

  const renderInvite = ({ item }: { item: PendingInvite }) => (
    <View style={styles.inviteCard}>
      <View style={styles.inviteInfo}>
        <Ionicons name="mail-open" size={20} color="#FFE707" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.inviteText}>
            <Text style={styles.inviteName}>{item.fromUserName}</Text> invited you to join
          </Text>
          <Text style={styles.inviteCrewName}>{item.crewName}</Text>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => handleAcceptInvite(item.id)}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.acceptBtnText}>Join</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={() => handleDeclineInvite(item.id)}
        >
          <Ionicons name="close" size={18} color="#aaa" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCrew = ({ item }: { item: Crew }) => (
    <TouchableOpacity
      style={styles.crewCard}
      onPress={() => router.push(`/crews/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.crewIconContainer}>
        <Ionicons name="people" size={24} color="#FFE707" />
      </View>
      <View style={styles.crewInfo}>
        <Text style={styles.crewName}>{item.name}</Text>
        <Text style={styles.crewMeta}>
          {item.memberCount} member{item.memberCount !== 1 ? 's' : ''}
          {item.isCreator ? '  •  Creator' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color="#666" />
          <Text style={styles.emptyText}>Log in to view your crews</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={['#FFE707', '#E31837']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: 'RockSalt-Regular' }]}>My Crews</Text>
            <Text style={styles.headerSubtitle}>Ride together</Text>
          </View>
          {!createdCrew ? (
            <TouchableOpacity
              onPress={() => router.push('/crews/create')}
              style={styles.createBtn}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFE707" />
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              {/* Pending Invites */}
              {pendingInvites.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Pending Invites ({pendingInvites.length})
                  </Text>
                  {pendingInvites.map((invite) => (
                    <View key={invite.id}>
                      {renderInvite({ item: invite })}
                    </View>
                  ))}
                </View>
              )}

              {/* Create Crew CTA */}
              {!createdCrew && (
                <TouchableOpacity
                  style={styles.createCrewCTA}
                  onPress={() => router.push('/crews/create')}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#1a1a2e', '#252545']}
                    style={styles.ctaGradient}
                  >
                    <Ionicons name="add-circle" size={32} color="#FFE707" />
                    <Text style={styles.ctaTitle}>Create Your Crew</Text>
                    <Text style={styles.ctaSubtitle}>Build your squad and ride together</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* My Crews */}
              {crews.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>My Crews</Text>
                  {crews.map((crew) => (
                    <View key={crew.id}>
                      {renderCrew({ item: crew })}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={64} color="#333" />
                  <Text style={styles.emptyTitle}>No Crews Yet</Text>
                  <Text style={styles.emptyText}>
                    Create your own crew or wait for an invite!
                  </Text>
                </View>
              )}
            </>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
              tintColor="#FFE707"
            />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerGradient: {
    paddingBottom: 0,
    paddingHorizontal: 20,
    overflow: 'hidden',
    boxShadow: 'inset 2px 6px 19px 8px #000000',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
    textShadow: '0px 3px 4px #000000cc',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(65, 59, 59, 0.9)',
    marginTop: -5,
    marginBottom: 5,
  },
  createBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFE707',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Invite card styles
  inviteCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,231,7,0.2)',
  },
  inviteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inviteText: {
    color: '#ccc',
    fontSize: 14,
  },
  inviteName: {
    color: '#fff',
    fontWeight: '700',
  },
  inviteCrewName: {
    color: '#FFE707',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E31837',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Crew card styles
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  crewIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,231,7,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  crewMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  // Create CTA
  createCrewCTA: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaGradient: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,231,7,0.2)',
  },
  ctaTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  ctaSubtitle: {
    color: '#888',
    fontSize: 14,
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
