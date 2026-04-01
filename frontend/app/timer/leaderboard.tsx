import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type LeaderboardType = '0-60' | '0-100' | 'quarter-mile';

interface LeaderboardEntry {
  id: string;
  userId: string;
  userName: string;
  nickname: string;
  carInfo: string;
  time: number;
  location: string;
  createdAt: string;
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<LeaderboardType>('0-60');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isAdmin = user?.isAdmin === true;

  const types: { type: LeaderboardType; label: string; icon: string; color: string }[] = [
    { type: '0-60', label: '0-60', icon: 'speedometer', color: '#FF6B35' },
    { type: '0-100', label: '0-100', icon: 'rocket', color: '#E91E63' },
    { type: 'quarter-mile', label: '1/4 Mile', icon: 'flag', color: '#9C27B0' },
  ];

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedType]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/leaderboard/${selectedType}`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const handleDeleteEntry = (entry: LeaderboardEntry) => {
    Alert.alert(
      'Delete Entry',
      `Remove ${entry.nickname || entry.userName}'s ${entry.time.toFixed(2)}s run from the leaderboard?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            axios.delete(
              `${API_URL}/api/admin/performance-runs/${entry.id}?admin_id=${user?.id}`
            ).then(() => {
              setLeaderboard(prev => prev.filter(e => e.id !== entry.id));
              fetchLeaderboard();
            }).catch((error: any) => {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete entry.');
            });
          },
        },
      ]
    );
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#888';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return 'trophy';
    if (rank === 2) return 'medal';
    if (rank === 3) return 'medal-outline';
    return null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const rank = index + 1;
    const rankIcon = getRankIcon(rank);
    const isTopThree = rank <= 3;

    return (
      <View style={[styles.leaderboardItem, isTopThree && styles.topThreeItem]}>
        <View style={[styles.rankContainer, { backgroundColor: `${getRankColor(rank)}20` }]}>
          {rankIcon ? (
            <Ionicons name={rankIcon as any} size={24} color={getRankColor(rank)} />
          ) : (
            <Text style={[styles.rankText, { color: getRankColor(rank) }]}>#{rank}</Text>
          )}
        </View>

        <View style={styles.entryDetails}>
          <Text style={styles.userName}>
            {item.nickname || item.userName}
          </Text>
          <Text style={styles.carInfo}>{item.carInfo}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color="#666" />
            <Text style={styles.metaText}>{item.location || 'Unknown'}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Ionicons name="calendar-outline" size={12} color="#666" />
            <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.timeContainer}>
          <Text style={[styles.timeValue, isTopThree && { color: getRankColor(rank) }]}>
            {item.time.toFixed(2)}
          </Text>
          <Text style={styles.timeUnit}>sec</Text>
        </View>

        {isAdmin && (
          <TouchableOpacity
            style={styles.adminDeleteButton}
            onPress={() => handleDeleteEntry(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="trophy-outline" size={80} color="#333" />
      <Text style={styles.emptyTitle}>No Records Yet</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to set a {selectedType} record!
      </Text>
      <TouchableOpacity
        style={styles.startRunButton}
        onPress={() => router.push('/timer')}
      >
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.startRunGradient}
        >
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={styles.startRunText}>Start a Run</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <LinearGradient
        colors={['#FFD700', '#FF6B35']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Ionicons name="trophy" size={32} color="#fff" />
            <Text style={styles.headerTitle}>Leaderboard</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Type Selector */}
      <View style={styles.typeSelector}>
        {types.map((type) => (
          <TouchableOpacity
            key={type.type}
            style={[
              styles.typeButton,
              selectedType === type.type && { backgroundColor: type.color },
            ]}
            onPress={() => setSelectedType(type.type)}
          >
            {type.icon === 'rocket' ? (
              <Image source={require('../../assets/images/okc-logo.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
            ) : (
              <Ionicons name={type.icon as any} size={18} color={selectedType === type.type ? '#fff' : '#888'} />
            )}
            <Text
              style={[
                styles.typeButtonText,
                selectedType === type.type && styles.typeButtonTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats Banner */}
      {leaderboard.length > 0 && (
        <View style={styles.statsBanner}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={20} color="#FF6B35" />
            <Text style={styles.statValue}>{leaderboard.length}</Text>
            <Text style={styles.statLabel}>Entries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="flash" size={20} color="#4CAF50" />
            <Text style={styles.statValue}>
              {leaderboard[0]?.time.toFixed(2)}s
            </Text>
            <Text style={styles.statLabel}>Best Time</Text>
          </View>
        </View>
      )}

      {/* Leaderboard List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.id}
          renderItem={renderLeaderboardItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
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
  headerGradient: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  typeButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 20,
    borderRadius: 16,
    gap: 30,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#333',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
  },
  listContent: {
    padding: 20,
    paddingTop: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  topThreeItem: {
    borderWidth: 1,
    borderColor: '#333',
  },
  rankContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  entryDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  carInfo: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#666',
  },
  metaDot: {
    fontSize: 11,
    color: '#666',
    marginHorizontal: 4,
  },
  timeContainer: {
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  timeUnit: {
    fontSize: 12,
    color: '#888',
    marginTop: -4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  startRunButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  startRunGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 10,
  },
  startRunText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  adminDeleteButton: {
    padding: 8,
    marginLeft: 4,
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderRadius: 8,
  },
});
