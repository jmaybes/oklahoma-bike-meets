import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Club {
  id: string;
  name: string;
  description: string;
  location: string;
  focus: string;
  meetingSchedule: string;
  contactEmail: string;
  website: string;
  memberCount: number;
}

export default function ClubsScreen() {
  const insets = useSafeAreaInsets();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [filteredClubs, setFilteredClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchClubs();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = clubs.filter(
        (club) =>
          club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          club.focus.toLowerCase().includes(searchQuery.toLowerCase()) ||
          club.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredClubs(filtered);
    } else {
      setFilteredClubs(clubs);
    }
  }, [searchQuery, clubs]);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/clubs`);
      setClubs(response.data);
      setFilteredClubs(response.data);
    } catch (error) {
      console.error('Error fetching clubs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchClubs();
  };

  const getFocusColor = (focus: string) => {
    if (focus.includes('Mustang') || focus.includes('Ford')) return '#1E88E5';
    if (focus.includes('Corvette') || focus.includes('Camaro') || focus.includes('Chevrolet')) return '#FFD700';
    if (focus.includes('Mopar') || focus.includes('Dodge') || focus.includes('Challenger')) return '#FF3B30';
    if (focus.includes('JDM') || focus.includes('Japanese')) return '#FF6B35';
    if (focus.includes('European') || focus.includes('BMW') || focus.includes('Porsche')) return '#4CAF50';
    if (focus.includes('Truck') || focus.includes('Jeep')) return '#795548';
    if (focus.includes('Tesla') || focus.includes('Electric')) return '#E91E63';
    if (focus.includes('Classic') || focus.includes('Hot Rod')) return '#9C27B0';
    return '#FF6B35';
  };

  const renderClubCard = ({ item }: { item: Club }) => {
    const focusColor = getFocusColor(item.focus);
    
    return (
      <TouchableOpacity style={styles.clubCard}>
        <View style={[styles.clubColorBar, { backgroundColor: focusColor }]} />
        <View style={styles.clubContent}>
          <View style={styles.clubHeader}>
            <Text style={styles.clubName}>{item.name}</Text>
            <View style={[styles.memberBadge, { backgroundColor: `${focusColor}20` }]}>
              <Ionicons name="people" size={14} color={focusColor} />
              <Text style={[styles.memberCount, { color: focusColor }]}>{item.memberCount}</Text>
            </View>
          </View>
          
          <View style={[styles.focusBadge, { backgroundColor: `${focusColor}20` }]}>
            <Text style={[styles.focusText, { color: focusColor }]}>{item.focus}</Text>
          </View>
          
          <Text style={styles.clubDescription} numberOfLines={2}>
            {item.description}
          </Text>
          
          <View style={styles.clubDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color="#888" />
              <Text style={styles.detailText}>{item.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={14} color="#888" />
              <Text style={styles.detailText}>{item.meetingSchedule}</Text>
            </View>
          </View>
          
          <View style={styles.clubActions}>
            {item.contactEmail && (
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="mail-outline" size={18} color="#FF6B35" />
                <Text style={styles.actionText}>Contact</Text>
              </TouchableOpacity>
            )}
            {item.website && (
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="globe-outline" size={18} color="#2196F3" />
                <Text style={[styles.actionText, { color: '#2196F3' }]}>Website</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#9C27B0', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Car Clubs</Text>
            <Text style={styles.headerSubtitle}>{clubs.length} clubs in Oklahoma</Text>
          </View>
          <Ionicons name="people-circle" size={32} color="#fff" />
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clubs by name, focus, or location..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9C27B0" />
          <Text style={styles.loadingText}>Loading clubs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClubs}
          keyExtractor={(item) => item.id}
          renderItem={renderClubCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#9C27B0"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={80} color="#333" />
              <Text style={styles.emptyTitle}>No Clubs Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try a different search term' : 'Check back later for new clubs'}
              </Text>
            </View>
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
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
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
    paddingTop: 12,
  },
  clubCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  clubColorBar: {
    width: 6,
  },
  clubContent: {
    flex: 1,
    padding: 16,
  },
  clubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  clubName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  memberCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  focusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  focusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clubDescription: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 12,
  },
  clubDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#888',
  },
  clubActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
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
});
