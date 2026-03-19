import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface PerformanceRun {
  id: string;
  userId: string;
  carInfo: string;
  zeroToSixty?: number;
  zeroToHundred?: number;
  quarterMile?: number;
  location: string;
  createdAt: string;
}

export default function MyRunsScreen() {
  const { user, isAuthenticated } = useAuth();
  const [runs, setRuns] = useState<PerformanceRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchMyRuns();
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyRuns();
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

  const getBestTimes = () => {
    const best060 = runs.filter(r => r.zeroToSixty).sort((a, b) => (a.zeroToSixty || 99) - (b.zeroToSixty || 99))[0];
    const best0100 = runs.filter(r => r.zeroToHundred).sort((a, b) => (a.zeroToHundred || 99) - (b.zeroToHundred || 99))[0];
    const bestQuarter = runs.filter(r => r.quarterMile).sort((a, b) => (a.quarterMile || 99) - (b.quarterMile || 99))[0];
    
    return { best060, best0100, bestQuarter };
  };

  const renderRunItem = ({ item }: { item: PerformanceRun }) => {
    const runType = item.zeroToSixty ? '0-60' : item.zeroToHundred ? '0-100' : '1/4 Mile';
    const time = item.zeroToSixty || item.zeroToHundred || item.quarterMile || 0;
    const color = item.zeroToSixty ? '#FF6B35' : item.zeroToHundred ? '#E91E63' : '#9C27B0';
    const icon = item.zeroToSixty ? 'speedometer' : item.zeroToHundred ? 'rocket' : 'flag';

    return (
      <View style={styles.runItem}>
        <View style={[styles.runTypeIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.runDetails}>
          <Text style={styles.runType}>{runType} MPH</Text>
          <Text style={styles.carInfo}>{item.carInfo}</Text>
          <Text style={styles.runDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={styles.runTimeContainer}>
          <Text style={[styles.runTime, { color }]}>{time.toFixed(2)}</Text>
          <Text style={styles.runTimeUnit}>sec</Text>
        </View>
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
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
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { best060, best0100, bestQuarter } = getBestTimes();

  return (
    <SafeAreaView style={styles.container}>
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
      {runs.length > 0 && (
        <View style={styles.personalBests}>
          <Text style={styles.personalBestsTitle}>Personal Bests</Text>
          <View style={styles.bestsGrid}>
            <View style={styles.bestItem}>
              <Ionicons name="speedometer" size={20} color="#FF6B35" />
              <Text style={styles.bestLabel}>0-60</Text>
              <Text style={[styles.bestValue, { color: '#FF6B35' }]}>
                {best060?.zeroToSixty?.toFixed(2) || '--'}s
              </Text>
            </View>
            <View style={styles.bestItem}>
              <Ionicons name="rocket" size={20} color="#E91E63" />
              <Text style={styles.bestLabel}>0-100</Text>
              <Text style={[styles.bestValue, { color: '#E91E63' }]}>
                {best0100?.zeroToHundred?.toFixed(2) || '--'}s
              </Text>
            </View>
            <View style={styles.bestItem}>
              <Ionicons name="flag" size={20} color="#9C27B0" />
              <Text style={styles.bestLabel}>1/4 Mile</Text>
              <Text style={[styles.bestValue, { color: '#9C27B0' }]}>
                {bestQuarter?.quarterMile?.toFixed(2) || '--'}s
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
              <TouchableOpacity
                style={styles.startRunButton}
                onPress={() => router.push('/timer')}
              >
                <LinearGradient
                  colors={['#FF6B35', '#E91E63']}
                  style={styles.startRunGradient}
                >
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.startRunText}>Start a Run</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
            />
          }
          ListHeaderComponent={
            runs.length > 0 ? (
              <Text style={styles.runHistoryTitle}>Run History</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
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
    fontSize: 12,
    color: '#888',
  },
  bestValue: {
    fontSize: 22,
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
    marginBottom: 16,
  },
  runItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  runTypeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  runDetails: {
    flex: 1,
  },
  runType: {
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
  runDate: {
    fontSize: 11,
    color: '#666',
  },
  runTimeContainer: {
    alignItems: 'center',
  },
  runTime: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  runTimeUnit: {
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
