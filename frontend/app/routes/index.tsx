import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://event-hub-okc-1.preview.emergentagent.com';

interface Route {
  id: string;
  userId: string;
  userName: string;
  name: string;
  description: string;
  waypoints: any[];
  distance?: number;
  estimatedTime?: string;
  scenicHighlights: string[];
  difficulty: string;
  isPublic: boolean;
  likes: number;
  savedBy: string[];
  createdAt: string;
}

const difficultyColors: { [key: string]: string } = {
  easy: '#4CAF50',
  moderate: '#FFC107',
  challenging: '#F44336',
};

export default function MyRoutesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [myRoutes, setMyRoutes] = useState<Route[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<Route[]>([]);
  const [publicRoutes, setPublicRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'saved' | 'discover'>('my');

  useEffect(() => {
    fetchRoutes();
  }, [user]);

  const fetchRoutes = async () => {
    try {
      if (user) {
        const [myRes, savedRes, publicRes] = await Promise.all([
          axios.get(`${API_URL}/api/routes/user/${user.id}`),
          axios.get(`${API_URL}/api/routes/saved/${user.id}`),
          axios.get(`${API_URL}/api/routes`),
        ]);
        setMyRoutes(myRes.data);
        setSavedRoutes(savedRes.data);
        setPublicRoutes(publicRes.data);
      } else {
        const publicRes = await axios.get(`${API_URL}/api/routes`);
        setPublicRoutes(publicRes.data);
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRoutes();
  };

  const handleSaveRoute = async (routeId: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to save routes.');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/api/routes/${routeId}/save?user_id=${user.id}`
      );
      Alert.alert('Success', response.data.message);
      fetchRoutes();
    } catch (error) {
      console.error('Error saving route:', error);
    }
  };

  const handleLikeRoute = async (routeId: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to like routes.');
      return;
    }
    
    try {
      await axios.post(`${API_URL}/api/routes/${routeId}/like?user_id=${user.id}`);
      fetchRoutes();
    } catch (error) {
      console.error('Error liking route:', error);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!user) return;
    
    Alert.alert(
      'Delete Route',
      'Are you sure you want to delete this route?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/routes/${routeId}?user_id=${user.id}`);
              Alert.alert('Success', 'Route deleted successfully');
              fetchRoutes();
            } catch (error) {
              console.error('Error deleting route:', error);
            }
          },
        },
      ]
    );
  };

  const renderRouteCard = (route: Route, showDelete: boolean = false) => {
    const isSaved = user && route.savedBy.includes(user.id);
    
    return (
      <TouchableOpacity
        key={route.id}
        style={styles.routeCard}
        onPress={() => router.push(`/routes/${route.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.routeInfo}>
            <Text style={styles.routeName}>{route.name}</Text>
            <Text style={styles.routeAuthor}>by {route.userName}</Text>
          </View>
          <View style={[styles.difficultyBadge, { backgroundColor: difficultyColors[route.difficulty] }]}>
            <Text style={styles.difficultyText}>{route.difficulty.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.routeDescription} numberOfLines={2}>
          {route.description}
        </Text>

        <View style={styles.routeStats}>
          <View style={styles.statItem}>
            <Ionicons name="map-outline" size={16} color="#888" />
            <Text style={styles.statText}>{route.waypoints.length} stops</Text>
          </View>
          {route.distance && (
            <View style={styles.statItem}>
              <Ionicons name="speedometer-outline" size={16} color="#888" />
              <Text style={styles.statText}>{route.distance} mi</Text>
            </View>
          )}
          {route.estimatedTime && (
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color="#888" />
              <Text style={styles.statText}>{route.estimatedTime}</Text>
            </View>
          )}
        </View>

        {route.scenicHighlights.length > 0 && (
          <View style={styles.highlightsContainer}>
            {route.scenicHighlights.slice(0, 3).map((highlight, index) => (
              <View key={index} style={styles.highlightBadge}>
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLikeRoute(route.id)}
          >
            <Ionicons name="heart-outline" size={20} color="#FF6B35" />
            <Text style={styles.actionText}>{route.likes}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleSaveRoute(route.id)}
          >
            <Ionicons 
              name={isSaved ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color={isSaved ? "#FF6B35" : "#888"} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push(`/routes/${route.id}`)}
          >
            <Ionicons name="navigate-outline" size={20} color="#2196F3" />
          </TouchableOpacity>

          {showDelete && route.userId === user?.id && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleDeleteRoute(route.id)}
            >
              <Ionicons name="trash-outline" size={20} color="#F44336" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const getCurrentRoutes = () => {
    switch (activeTab) {
      case 'my':
        return myRoutes;
      case 'saved':
        return savedRoutes;
      case 'discover':
        return publicRoutes;
      default:
        return [];
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          <Text style={styles.headerTitle}>Route Planning</Text>
          {user && (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => router.push('/routes/create')}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Tabs */}
      {user && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my' && styles.activeTab]}
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>
              My Routes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
            onPress={() => setActiveTab('saved')}
          >
            <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>
              Saved
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'discover' && styles.activeTab]}
            onPress={() => setActiveTab('discover')}
          >
            <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>
              Discover
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
          }
        >
          {getCurrentRoutes().length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={64} color="#333" />
              <Text style={styles.emptyTitle}>
                {activeTab === 'my' ? 'No routes created yet' : 
                 activeTab === 'saved' ? 'No saved routes' : 'No routes available'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'my' 
                  ? 'Create your first scenic driving route!' 
                  : activeTab === 'saved'
                  ? 'Save routes from the Discover tab'
                  : 'Be the first to create a route!'}
              </Text>
              {activeTab === 'my' && user && (
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => router.push('/routes/create')}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Create Route</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {getCurrentRoutes().map((route) => renderRouteCard(route, activeTab === 'my'))}
              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
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
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  routeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  routeAuthor: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  difficultyText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  routeDescription: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 12,
  },
  routeStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#888',
    fontSize: 13,
  },
  highlightsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  highlightBadge: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  highlightText: {
    color: '#FF6B35',
    fontSize: 11,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#888',
    fontSize: 14,
  },
});
