import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

import { API_URL } from '../../utils/api';

interface Waypoint {
  latitude: number;
  longitude: number;
  name: string;
  order: number;
}

interface Route {
  id: string;
  userId: string;
  userName: string;
  name: string;
  description: string;
  waypoints: Waypoint[];
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

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoute();
  }, [id]);

  const fetchRoute = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/routes/${id}`);
      setRoute(response.data);
    } catch (error) {
      console.error('Error fetching route:', error);
      Alert.alert('Error', 'Could not load route details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to save routes.');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/api/routes/${id}/save?user_id=${user.id}`
      );
      Alert.alert('Success', response.data.message);
      fetchRoute();
    } catch (error) {
      console.error('Error saving route:', error);
    }
  };

  const handleLike = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to like routes.');
      return;
    }
    
    try {
      await axios.post(`${API_URL}/api/routes/${id}/like?user_id=${user.id}`);
      fetchRoute();
    } catch (error) {
      console.error('Error liking route:', error);
    }
  };

  const handleShare = async () => {
    if (!route) return;
    
    try {
      await Share.share({
        title: route.name,
        message: `Check out this scenic driving route: ${route.name}\n\n${route.description}\n\nDistance: ${route.distance || 'N/A'} miles\nDifficulty: ${route.difficulty}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const openInMaps = (waypoint: Waypoint) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${waypoint.latitude},${waypoint.longitude}`;
    Linking.openURL(url);
  };

  const startNavigation = () => {
    if (!route || route.waypoints.length < 2) return;
    
    // Build Google Maps directions URL with waypoints
    const origin = route.waypoints[0];
    const destination = route.waypoints[route.waypoints.length - 1];
    const waypointsStr = route.waypoints
      .slice(1, -1)
      .map(wp => `${wp.latitude},${wp.longitude}`)
      .join('|');
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}`;
    
    if (waypointsStr) {
      url += `&waypoints=${waypointsStr}`;
    }
    
    url += '&travelmode=driving';
    
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E15500" />
        </View>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={64} color="#F44336" />
          <Text style={styles.errorText}>Route not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isSaved = user && route.savedBy.includes(user.id);
  const isOwner = user && route.userId === user.id;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#E15500', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{route.name}</Text>
          <TouchableOpacity onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Route Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View>
              <Text style={styles.routeAuthor}>Created by {route.userName}</Text>
              <Text style={styles.routeDate}>
                {new Date(route.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={[styles.difficultyBadge, { backgroundColor: difficultyColors[route.difficulty] }]}>
              <Text style={styles.difficultyText}>{route.difficulty.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.description}>{route.description}</Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="map-outline" size={24} color="#E15500" />
              <Text style={styles.statValue}>{route.waypoints.length}</Text>
              <Text style={styles.statLabel}>Stops</Text>
            </View>
            {route.distance && (
              <View style={styles.statBox}>
                <Ionicons name="speedometer-outline" size={24} color="#E15500" />
                <Text style={styles.statValue}>{route.distance}</Text>
                <Text style={styles.statLabel}>Miles</Text>
              </View>
            )}
            {route.estimatedTime && (
              <View style={styles.statBox}>
                <Ionicons name="time-outline" size={24} color="#E15500" />
                <Text style={styles.statValue}>{route.estimatedTime}</Text>
                <Text style={styles.statLabel}>Est. Time</Text>
              </View>
            )}
            <View style={styles.statBox}>
              <Ionicons name="heart" size={24} color="#E15500" />
              <Text style={styles.statValue}>{route.likes}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          </View>
        </View>

        {/* Scenic Highlights */}
        {route.scenicHighlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scenic Highlights</Text>
            <View style={styles.highlightsContainer}>
              {route.scenicHighlights.map((highlight, index) => (
                <View key={index} style={styles.highlightBadge}>
                  <Ionicons name="star" size={12} color="#E15500" />
                  <Text style={styles.highlightText}>{highlight}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Waypoints */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Waypoints</Text>
          {route.waypoints.map((waypoint, index) => (
            <TouchableOpacity
              key={index}
              style={styles.waypointCard}
              onPress={() => openInMaps(waypoint)}
            >
              <View style={styles.waypointLeft}>
                <View style={styles.waypointNumber}>
                  <Text style={styles.waypointNumberText}>{index + 1}</Text>
                </View>
                {index < route.waypoints.length - 1 && <View style={styles.waypointLine} />}
              </View>
              <View style={styles.waypointContent}>
                <Text style={styles.waypointName}>{waypoint.name}</Text>
                <Text style={styles.waypointCoords}>
                  {waypoint.latitude.toFixed(4)}, {waypoint.longitude.toFixed(4)}
                </Text>
              </View>
              <Ionicons name="navigate-outline" size={20} color="#888" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Ionicons name="heart-outline" size={24} color="#E15500" />
            <Text style={styles.actionBtnText}>Like</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
            <Ionicons 
              name={isSaved ? "bookmark" : "bookmark-outline"} 
              size={24} 
              color={isSaved ? "#E15500" : "#888"} 
            />
            <Text style={[styles.actionBtnText, isSaved && { color: '#E15500' }]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={24} color="#888" />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Start Navigation Button */}
        <TouchableOpacity style={styles.startButton} onPress={startNavigation}>
          <Ionicons name="navigate" size={24} color="#fff" />
          <Text style={styles.startButtonText}>Start Navigation</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  backBtn: {
    backgroundColor: '#E15500',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeAuthor: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  routeDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  difficultyText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  description: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 16,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  highlightsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  highlightText: {
    color: '#fff',
    fontSize: 13,
  },
  waypointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  waypointLeft: {
    alignItems: 'center',
    marginRight: 12,
  },
  waypointNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E15500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waypointNumberText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  waypointLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E15500',
    marginTop: 4,
  },
  waypointContent: {
    flex: 1,
  },
  waypointName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  waypointCoords: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    color: '#888',
    fontSize: 12,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
