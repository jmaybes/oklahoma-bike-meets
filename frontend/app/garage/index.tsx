import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface UserCar {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: string;
  color: string;
  photos: string[];
  modifications: any[];
  isPublic: boolean;
  likes: number;
  views: number;
  ownerName: string;
  ownerNickname: string;
  horsepower?: number;
  engine?: string;
}

export default function BrowseGaragesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [garages, setGarages] = useState<UserCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchGarages();
  }, []);

  const fetchGarages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user-cars/public`);
      setGarages(response.data);
    } catch (error) {
      console.error('Error fetching garages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGarages();
  };

  const handleLike = async (carId: string) => {
    if (!user) return;
    try {
      await axios.post(`${API_URL}/api/user-cars/${carId}/like?user_id=${user.id}`);
      fetchGarages();
    } catch (error) {
      console.error('Error liking car:', error);
    }
  };

  const filteredGarages = garages.filter(car => {
    const searchLower = searchQuery.toLowerCase();
    return (
      car.make.toLowerCase().includes(searchLower) ||
      car.model.toLowerCase().includes(searchLower) ||
      car.ownerName.toLowerCase().includes(searchLower) ||
      (car.ownerNickname && car.ownerNickname.toLowerCase().includes(searchLower))
    );
  });

  const renderGarageCard = (car: UserCar) => (
    <TouchableOpacity
      key={car.id}
      style={styles.garageCard}
      onPress={() => router.push(`/garage/${car.id}`)}
    >
      {/* Car Image */}
      <View style={styles.imageContainer}>
        {car.photos && car.photos.length > 0 ? (
          <Image
            source={{ uri: car.photos[0].startsWith('data:') ? car.photos[0] : `data:image/jpeg;base64,${car.photos[0]}` }}
            style={styles.carImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.noImageContainer}>
            <Ionicons name="car-sport" size={48} color="#444" />
          </View>
        )}
        <View style={styles.photoCount}>
          <Ionicons name="images" size={14} color="#fff" />
          <Text style={styles.photoCountText}>{car.photos?.length || 0}</Text>
        </View>
      </View>

      {/* Car Info */}
      <View style={styles.cardContent}>
        <Text style={styles.carTitle}>
          {car.year} {car.make} {car.model}
        </Text>
        <Text style={styles.ownerName}>
          by {car.ownerNickname || car.ownerName}
        </Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {car.horsepower && (
            <View style={styles.statItem}>
              <Ionicons name="flash" size={14} color="#FF6B35" />
              <Text style={styles.statText}>{car.horsepower} HP</Text>
            </View>
          )}
          {car.modifications && car.modifications.length > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="build" size={14} color="#2196F3" />
              <Text style={styles.statText}>{car.modifications.length} mods</Text>
            </View>
          )}
        </View>

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(car.id)}
          >
            <Ionicons name="heart" size={18} color="#FF6B35" />
            <Text style={styles.actionText}>{car.likes || 0}</Text>
          </TouchableOpacity>
          <View style={styles.actionButton}>
            <Ionicons name="eye" size={18} color="#888" />
            <Text style={styles.actionText}>{car.views || 0}</Text>
          </View>
          <TouchableOpacity style={styles.viewButton}>
            <Text style={styles.viewButtonText}>View Garage</Text>
            <Ionicons name="chevron-forward" size={16} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

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
          <Text style={styles.headerTitle}>Community Garages</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by make, model, or owner..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

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
          {filteredGarages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-sport-outline" size={64} color="#333" />
              <Text style={styles.emptyTitle}>No Public Garages Yet</Text>
              <Text style={styles.emptyText}>
                Be the first to share your ride with the community!
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultCount}>
                {filteredGarages.length} garage{filteredGarages.length !== 1 ? 's' : ''} found
              </Text>
              {filteredGarages.map(renderGarageCard)}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
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
  resultCount: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
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
  },
  garageCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  imageContainer: {
    height: 180,
    position: 'relative',
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCount: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  carTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  ownerName: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#aaa',
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 16,
  },
  actionText: {
    color: '#888',
    fontSize: 14,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 4,
  },
  viewButtonText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
});
