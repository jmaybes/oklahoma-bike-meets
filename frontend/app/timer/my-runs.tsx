import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const API_URL = 'https://event-hub-okc-1.preview.emergentagent.com';

interface PerformanceRun {
  id: string;
  userId: string;
  carInfo: string;
  zeroToSixty?: number;
  zeroToHundred?: number;
  quarterMile?: number;
  quarterMileSpeed?: number;
  topSpeed?: number;
  location: string;
  isManualEntry?: boolean;
  createdAt: string;
}

interface PersonalBests {
  zeroToSixty: number | null;
  zeroToHundred: number | null;
  quarterMile: number | null;
  totalRuns: number;
}

export default function MyRunsScreen() {
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [runs, setRuns] = useState<PerformanceRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [personalBests, setPersonalBests] = useState<PersonalBests | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchMyRuns();
      fetchPersonalBests();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const fetchMyRuns = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/performance-runs/user/${user?.id}`);
      setRuns(response.data);
    } catch (error) {
      console.error('Error fetching runs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPersonalBests = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/performance-runs/user/${user?.id}/best`);
      setPersonalBests(res.data);
    } catch (err) {
      console.log('Error fetching personal bests');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyRuns();
    fetchPersonalBests();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const shareRun = async (item: PerformanceRun) => {
    const runType = item.zeroToSixty ? '0-60 MPH' : item.zeroToHundred ? '0-100 MPH' : '1/4 Mile';
    const time = item.zeroToSixty || item.zeroToHundred || item.quarterMile || 0;
    let message = `🏁 ${runType}: ${time.toFixed(2)}s`;
    if (item.carInfo) message += `\n🚗 ${item.carInfo}`;
    if (item.topSpeed) message += `\n⚡ Top Speed: ${item.topSpeed.toFixed(1)} MPH`;
    if (item.quarterMileSpeed) message += `\n💨 Trap Speed: ${item.quarterMileSpeed.toFixed(1)} MPH`;
    if (item.isManualEntry) message += `\n📝 Manual Entry`;
    message += `\n📱 OKC Car Events`;

    try {
      await Share.share({ message });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const renderRunItem = ({ item }: { item: PerformanceRun }) => {
    const runType = item.zeroToSixty ? '0-60' : item.zeroToHundred ? '0-100' : '1/4 Mile';
    const time = item.zeroToSixty || item.zeroToHundred || item.quarterMile || 0;
    const color = item.zeroToSixty ? '#FF6B35' : item.zeroToHundred ? '#E91E63' : '#9C27B0';
    const icon = item.zeroToSixty ? 'speedometer' : item.zeroToHundred ? 'rocket' : 'flag';

    // Check if this is a personal best
    let isPB = false;
    if (personalBests) {
      if (item.zeroToSixty && personalBests.zeroToSixty === item.zeroToSixty) isPB = true;
      if (item.zeroToHundred && personalBests.zeroToHundred === item.zeroToHundred) isPB = true;
      if (item.quarterMile && personalBests.quarterMile === item.quarterMile) isPB = true;
    }

    return (
      <View style={[styles.runItem, isPB && { borderColor: '#FFD700', borderWidth: 1 }]}>
        <View style={[styles.runTypeIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <View style={styles.runDetails}>
          <View style={styles.runTitleRow}>
            <Text style={styles.runType}>{runType} MPH</Text>
            {isPB && (
              <View style={styles.pbTag}>
                <Ionicons name="trophy" size={10} color="#FFD700" />
                <Text style={styles.pbTagText}>PB</Text>
              </View>
            )}
            {item.isManualEntry && (
              <View style={styles.manualTag}>
                <Ionicons name="create" size={10} color="#4CAF50" />
                <Text style={styles.manualTagText}>Manual</Text>
              </View>
            )}
          </View>
          <Text style={styles.carInfo}>{item.carInfo}</Text>
          <View style={styles.metaRow}>
            {item.topSpeed ? (
              <>
                <Ionicons name="flash" size={11} color="#666" />
                <Text style={styles.metaText}>{item.topSpeed.toFixed(1)} MPH</Text>
                <Text style={styles.metaDot}>•</Text>
              </>
            ) : null}
            {item.quarterMileSpeed ? (
              <>
                <Text style={styles.metaText}>Trap: {item.quarterMileSpeed.toFixed(1)}</Text>
                <Text style={styles.metaDot}>•</Text>
              </>
            ) : null}
            <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.runRight}>
          <Text style={[styles.runTime, { color }]}>{time.toFixed(2)}</Text>
          <Text style={styles.runTimeUnit}>sec</Text>
          <TouchableOpacity
            onPress={() => shareRun(item)}
            style={styles.shareBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="share-outline" size={16} color="#888" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Runs</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        <View style={styles.authRequiredContainer}>
          <Ionicons name="lock-closed" size={60} color="#333" />
          <Text style={styles.authRequiredTitle}>Login Required</Text>
          <Text style={styles.authRequiredSubtitle}>
            Sign in to view and track your performance runs
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/auth/login')}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={['#FF6B35', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Runs</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Personal Bests */}
      {personalBests && (
        <View style={styles.personalBests}>
          <Text style={styles.personalBestsTitle}>
            Personal Bests ({personalBests.totalRuns} total runs)
          </Text>
          <View style={styles.bestsGrid}>
            <View style={styles.bestItem}>
              <Ionicons name="speedometer" size={18} color="#FF6B35" />
              <Text style={styles.bestLabel}>0-60</Text>
              <Text style={[styles.bestValue, { color: '#FF6B35' }]}>
                {personalBests.zeroToSixty?.toFixed(2) || '--'}s
              </Text>
            </View>
            <View style={styles.bestItem}>
              <Ionicons name="rocket" size={18} color="#E91E63" />
              <Text style={styles.bestLabel}>0-100</Text>
              <Text style={[styles.bestValue, { color: '#E91E63' }]}>
                {personalBests.zeroToHundred?.toFixed(2) || '--'}s
              </Text>
            </View>
            <View style={styles.bestItem}>
              <Ionicons name="flag" size={18} color="#9C27B0" />
              <Text style={styles.bestLabel}>1/4 Mile</Text>
              <Text style={[styles.bestValue, { color: '#9C27B0' }]}>
                {personalBests.quarterMile?.toFixed(2) || '--'}s
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Runs List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading your runs...</Text>
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(item) => item.id}
          renderItem={renderRunItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={80} color="#333" />
              <Text style={styles.emptyTitle}>No Runs Yet</Text>
              <Text style={styles.emptySubtitle}>
                Start your first performance run to track your times
              </Text>
              <TouchableOpacity style={styles.startRunButton} onPress={() => router.push('/timer')}>
                <LinearGradient colors={['#FF6B35', '#E91E63']} style={styles.startRunGradient}>
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.startRunText}>Start a Run</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
          }
          ListHeaderComponent={
            runs.length > 0 ? <Text style={styles.runHistoryTitle}>Run History</Text> : null
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  personalBests: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
  },
  personalBestsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 14,
    textAlign: 'center',
  },
  bestsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bestItem: {
    alignItems: 'center',
    gap: 6,
  },
  bestLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  bestValue: {
    fontSize: 20,
    fontWeight: 'bold',
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
  runHistoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 14,
  },
  runItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  runTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  runDetails: {
    flex: 1,
  },
  runTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  runType: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  pbTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  pbTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  manualTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  manualTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  carInfo: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 10,
    color: '#666',
  },
  metaDot: {
    fontSize: 10,
    color: '#666',
    marginHorizontal: 2,
  },
  runRight: {
    alignItems: 'center',
    marginLeft: 4,
  },
  runTime: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  runTimeUnit: {
    fontSize: 11,
    color: '#888',
    marginTop: -3,
  },
  shareBtn: {
    marginTop: 6,
    padding: 4,
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
    paddingHorizontal: 40,
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
  authRequiredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  authRequiredTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
  },
  authRequiredSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 24,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
