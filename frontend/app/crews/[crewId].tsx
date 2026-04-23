import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, RockSalt_400Regular } from '@expo-google-fonts/rock-salt';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../../utils/api';

interface CrewMember {
  id: string;
  name: string;
  nickname: string;
  carCount: number;
  isCreator: boolean;
  isCoLeader: boolean;
  role: 'Creator' | 'Co-Leader' | 'Member';
}

interface CrewDetail {
  id: string;
  name: string;
  creatorId: string;
  members: CrewMember[];
  memberCount: number;
  createdAt: string;
}

export default function CrewDetailScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ RockSalt_400Regular });
  const [crew, setCrew] = useState<CrewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isCreator = crew?.creatorId === user?.id;
  const isMember = crew?.members.some((m) => m.id === user?.id);

  const fetchCrew = useCallback(async () => {
    if (!crewId) return;
    try {
      const res = await axios.get(`${API_URL}/api/crews/${crewId}`);
      setCrew(res.data);
    } catch (err) {
      console.error('Error fetching crew:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [crewId]);

  useFocusEffect(
    useCallback(() => {
      fetchCrew();
    }, [fetchCrew])
  );

  const handleLeaveCrew = () => {
    Alert.alert('Leave Crew', `Are you sure you want to leave "${crew?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(
              `${API_URL}/api/crews/${crewId}/members/${user?.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            Alert.alert('Left Crew', 'You have left the crew.');
            router.back();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to leave crew');
          }
        },
      },
    ]);
  };

  const handleDeleteCrew = () => {
    Alert.alert(
      'Delete Crew',
      `Are you sure you want to delete "${crew?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/crews/${crewId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              Alert.alert('Crew Deleted', 'Your crew has been disbanded.');
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.detail || 'Failed to delete crew');
            }
          },
        },
      ]
    );
  };

  const handleKickMember = (memberId: string, memberName: string) => {
    Alert.alert('Remove Member', `Remove ${memberName} from the crew?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(
              `${API_URL}/api/crews/${crewId}/members/${memberId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchCrew();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to remove member');
          }
        },
      },
    ]);
  };

  const handlePromote = (memberId: string, memberName: string) => {
    Alert.alert('Promote to Co-Leader', `Make ${memberName} a co-leader? They'll be able to invite and kick members.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Promote',
        onPress: async () => {
          try {
            await axios.put(
              `${API_URL}/api/crews/${crewId}/co-leader/${memberId}`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            Alert.alert('Promoted! ⭐', `${memberName} is now a co-leader.`);
            fetchCrew();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to promote member');
          }
        },
      },
    ]);
  };

  const handleDemote = (memberId: string, memberName: string) => {
    Alert.alert('Remove Co-Leader', `Remove co-leader status from ${memberName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Demote',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(
              `${API_URL}/api/crews/${crewId}/co-leader/${memberId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchCrew();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to demote member');
          }
        },
      },
    ]);
  };

  const renderMember = ({ item }: { item: CrewMember }) => {
    const displayName = item.nickname || item.name;
    const roleColor = item.isCreator ? '#FFE707' : (item.isCoLeader ? '#4FC3F7' : '#888');
    const roleIcon = item.isCreator ? 'star' : (item.isCoLeader ? 'shield-checkmark' : 'person');

    return (
      <TouchableOpacity
        style={styles.memberCard}
        onPress={() => router.push(`/user-garage/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.memberAvatar, { borderColor: roleColor, borderWidth: item.isCreator || item.isCoLeader ? 2 : 0 }]}>
          <Ionicons name={roleIcon} size={20} color={roleColor} />
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {displayName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={[styles.roleTag, { color: roleColor }]}>{item.role}</Text>
            <Text style={styles.memberCars}>
              • {item.carCount} car{item.carCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        {/* Creator actions for non-creator members */}
        {isCreator && !item.isCreator && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {item.isCoLeader ? (
              <TouchableOpacity
                onPress={() => handleDemote(item.id, displayName)}
                style={styles.roleActionBtn}
              >
                <Ionicons name="shield-outline" size={18} color="#666" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handlePromote(item.id, displayName)}
                style={styles.roleActionBtn}
              >
                <Ionicons name="shield-checkmark" size={18} color="#4FC3F7" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => handleKickMember(item.id, displayName)}
              style={styles.kickBtn}
            >
              <Ionicons name="remove-circle-outline" size={20} color="#E31837" />
            </TouchableOpacity>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color="#444" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFE707" />
        </View>
      </View>
    );
  }

  if (!crew) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color="#666" />
          <Text style={styles.emptyText}>Crew not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.goBackBtn}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
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
        style={styles.headerGradient}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: 'RockSalt-Regular' }]} numberOfLines={1}>{crew.name}</Text>
            <Text style={styles.headerSubtitle}>
              {crew.memberCount} member{crew.memberCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Crew Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="people" size={36} color="#FFE707" />
        </View>
        <Text style={styles.bannerName}>{crew.name}</Text>
        <Text style={styles.bannerDate}>
          Est. {new Date(crew.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </Text>
      </View>

      {/* Members List */}
      <FlatList
        data={crew.members}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Members</Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchCrew();
            }}
            tintColor="#FFE707"
          />
        }
      />

      {/* Bottom Actions */}
      {isMember && (
        <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 12 }]}>
          {isCreator ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteCrew}>
              <Ionicons name="trash-outline" size={18} color="#E31837" />
              <Text style={styles.deleteBtnText}>Delete Crew</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveCrew}>
              <Ionicons name="exit-outline" size={18} color="#E31837" />
              <Text style={styles.leaveBtnText}>Leave Crew</Text>
            </TouchableOpacity>
          )}
        </View>
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
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
    textShadow: '0px 3px 4px #000000cc',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(65, 59, 59, 0.9)',
    marginTop: -5,
    marginBottom: 5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  goBackBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#141414',
    borderRadius: 20,
  },
  goBackText: {
    color: '#FFE707',
    fontWeight: '600',
  },
  // Banner
  banner: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  bannerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,231,7,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bannerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  bannerDate: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },
  // Members
  listContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFE707',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  memberCars: {
    color: '#666',
    fontSize: 12,
  },
  roleTag: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleActionBtn: {
    padding: 6,
  },
  kickBtn: {
    padding: 8,
    marginRight: 4,
  },
  // Bottom actions
  bottomActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#141414',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E31837',
    gap: 8,
  },
  deleteBtnText: {
    color: '#E31837',
    fontWeight: '600',
    fontSize: 15,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E31837',
    gap: 8,
  },
  leaveBtnText: {
    color: '#E31837',
    fontWeight: '600',
    fontSize: 15,
  },
});
