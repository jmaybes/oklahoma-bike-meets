import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = 'https://event-hub-okc-1.preview.emergentagent.com';

interface Club {
  id: string;
  name: string;
  description: string;
  location: string;
  city: string;
  carTypes: string[];
  contactInfo: string;
  website: string;
  facebookGroup: string;
  meetingSchedule: string;
  memberCount: string;
}

export default function ClubsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [filteredClubs, setFilteredClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchClubs();
  }, []);

  useEffect(() => {
    filterClubs();
  }, [clubs, searchQuery]);

  const fetchClubs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/clubs`);
      setClubs(response.data);
    } catch (error) {
      console.error('Error fetching clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterClubs = () => {
    if (!searchQuery) {
      setFilteredClubs(clubs);
      return;
    }

    const filtered = clubs.filter(
      club =>
        club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.carTypes.some(type => type.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    setFilteredClubs(filtered);
  };

  const openLink = (url: string) => {
    if (url) {
      Linking.openURL(url).catch((err) =>
        console.error('Error opening URL:', err)
      );
    }
  };

  const renderClubCard = ({ item }: { item: Club }) => (
    <View style={styles.clubCard}>
      <View style={styles.clubHeader}>
        <View style={styles.clubIcon}>
          <Ionicons name="people-circle" size={40} color="#FF6B35" />
        </View>
        <View style={styles.clubHeaderInfo}>
          <Text style={styles.clubName}>{item.name}</Text>
          <Text style={styles.clubLocation}>{item.city}</Text>
        </View>
        {user?.isAdmin && (
          <TouchableOpacity 
            style={styles.adminEditButton}
            onPress={() => router.push(`/admin/edit-club/${item.id}`)}
          >
            <Ionicons name="create-outline" size={20} color="#9C27B0" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.clubDescription}>{item.description}</Text>

      {item.carTypes.length > 0 && (
        <View style={styles.carTypesContainer}>
          {item.carTypes.map((type, index) => (
            <View key={index} style={styles.carTypeChip}>
              <Ionicons name="car-sport" size={12} color="#FF6B35" />
              <Text style={styles.carTypeText}>{type}</Text>
            </View>
          ))}
        </View>
      )}

      {item.meetingSchedule && (
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#888" />
          <Text style={styles.infoText}>{item.meetingSchedule}</Text>
        </View>
      )}

      {item.memberCount && (
        <View style={styles.infoRow}>
          <Ionicons name="people-outline" size={16} color="#888" />
          <Text style={styles.infoText}>{item.memberCount} members</Text>
        </View>
      )}

      <View style={styles.linksContainer}>
        {item.website && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => openLink(item.website)}
          >
            <Ionicons name="globe" size={20} color="#2196F3" />
            <Text style={styles.linkButtonText}>Website</Text>
          </TouchableOpacity>
        )}

        {item.facebookGroup && (
          <TouchableOpacity
            style={[styles.linkButton, styles.facebookButton]}
            onPress={() => openLink(item.facebookGroup)}
          >
            <Ionicons name="logo-facebook" size={20} color="#1877F2" />
            <Text style={[styles.linkButtonText, styles.facebookText]}>Facebook</Text>
          </TouchableOpacity>
        )}

        {item.contactInfo && (
          <View style={styles.contactContainer}>
            <Ionicons name="mail" size={16} color="#666" />
            <Text style={styles.contactText}>{item.contactInfo}</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
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
          <Text style={styles.headerTitle}>Oklahoma Car Clubs</Text>
          <Text style={styles.headerSubtitle}>
            {filteredClubs.length} club{filteredClubs.length !== 1 ? 's' : ''} found
          </Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clubs, cities, or car types..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <TouchableOpacity 
        style={styles.submitClubButton}
        onPress={() => router.push('/clubs/submit')}
      >
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.submitClubText}>Submit Your Club</Text>
      </TouchableOpacity>

      <FlatList
        data={filteredClubs}
        keyExtractor={(item) => item.id}
        renderItem={renderClubCard}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="car" size={64} color="#333" />
            <Text style={styles.emptyText}>No clubs found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search</Text>
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
    padding: 4,
    marginRight: 12,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
  },
  submitClubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9C27B0',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitClubText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  clubCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  clubIcon: {
    marginRight: 12,
  },
  clubHeaderInfo: {
    flex: 1,
  },
  adminEditButton: {
    padding: 8,
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
    borderRadius: 8,
  },
  clubName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  clubLocation: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
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
    gap: 8,
    marginBottom: 12,
  },
  carTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  carTypeText: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 8,
  },
  linksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  facebookButton: {
    backgroundColor: 'rgba(24, 119, 242, 0.15)',
  },
  linkButtonText: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '600',
  },
  facebookText: {
    color: '#1877F2',
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  contactText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
