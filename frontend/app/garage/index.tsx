import React, { useState, useEffect, useCallback } from 'react';
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
  Platform,
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
  mainPhotoIndex?: number;
  likedBy?: string[];
  description?: string;
  drivetrain?: string;
}

export default function BrowseGaragesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [garages, setGarages] = useState<UserCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGarages = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user-cars/public?sort=likes`);
      setGarages(response.data);
    } catch (error) {
      console.error('Error fetching garages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGarages();
  }, [fetchGarages]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGarages();
  };

  const handleLike = useCallback(async (carId: string) => {
    if (!user) return;
    try {
      // Optimistic UI update
      setGarages(prev => prev.map(car => {
        if (car.id === carId) {
          const isLiked = car.likedBy?.includes(user.id);
          return {
            ...car,
            likes: isLiked ? (car.likes || 1) - 1 : (car.likes || 0) + 1,
            likedBy: isLiked
              ? (car.likedBy || []).filter(id => id !== user.id)
              : [...(car.likedBy || []), user.id],
          };
        }
        return car;
      }));
      await axios.post(`${API_URL}/api/user-cars/${carId}/like?user_id=${user.id}`);
    } catch (error) {
      console.error('Error liking car:', error);
      fetchGarages(); // Revert on error
    }
  }, [user]);

  const getMainPhoto = (car: UserCar): string | null => {
    if (!car.photos || car.photos.length === 0) return null;
    const idx = car.mainPhotoIndex && car.mainPhotoIndex < car.photos.length ? car.mainPhotoIndex : 0;
    const photo = car.photos[idx];
    return photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`;
  };

  const filteredGarages = garages.filter(car => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      (car.make || '').toLowerCase().includes(searchLower) ||
      (car.model || '').toLowerCase().includes(searchLower) ||
      (car.year || '').toLowerCase().includes(searchLower) ||
      (car.ownerName || '').toLowerCase().includes(searchLower) ||
      (car.ownerNickname || '').toLowerCase().includes(searchLower)
    );
  });

  const renderGarageCard = (car: UserCar, index: number) => {
    const mainPhoto = getMainPhoto(car);
    const isLiked = user ? car.likedBy?.includes(user.id) : false;
    const isTopThree = index < 3;

    return (
      <TouchableOpacity
        key={car.id}
        style={styles.garageCard}
        onPress={() => router.push(`/garage/${car.id}`)}
        activeOpacity={0.85}
      >
        {/* Rank badge for top 3 */}
        {isTopThree && (
          <View style={[styles.rankBadge, index === 0 ? styles.rankGold : index === 1 ? styles.rankSilver : styles.rankBronze]}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
        )}

        {/* Car Image */}
        <View style={styles.imageContainer}>
          {mainPhoto ? (
            <Image
              source={{ uri: mainPhoto }}
              style={styles.carImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="car-sport" size={48} color="#444" />
              <Text style={styles.noImageText}>No Photos</Text>
            </View>
          )}
          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.imageGradient}
          />
          {/* Photo count badge */}
          <View style={styles.photoCount}>
            <Ionicons name="images" size={13} color="#fff" />
            <Text style={styles.photoCountText}>{car.photos?.length || 0}</Text>
          </View>
          {/* Owner name overlay */}
          <View style={styles.ownerOverlay}>
            <Ionicons name="person-circle" size={18} color="#FF6B35" />
            <Text style={styles.ownerOverlayText} numberOfLines={1}>
              {car.ownerNickname || car.ownerName}
            </Text>
          </View>
        </View>

        {/* Car Info */}
        <View style={styles.cardContent}>
          <Text style={styles.carTitle} numberOfLines={1}>
            {car.year} {car.make} {car.model}
          </Text>

          {/* Quick specs */}
          <View style={styles.specsRow}>
            {car.color ? (
              <View style={styles.specChip}>
                <Ionicons name="color-palette" size={12} color="#aaa" />
                <Text style={styles.specChipText}>{car.color}</Text>
              </View>
            ) : null}
            {car.horsepower ? (
              <View style={styles.specChip}>
                <Ionicons name="flash" size={12} color="#FF6B35" />
                <Text style={styles.specChipText}>{car.horsepower} HP</Text>
              </View>
            ) : null}
            {car.drivetrain ? (
              <View style={styles.specChip}>
                <Ionicons name="git-branch" size={12} color="#2196F3" />
                <Text style={styles.specChipText}>{car.drivetrain}</Text>
              </View>
            ) : null}
            {car.modifications && car.modifications.length > 0 ? (
              <View style={styles.specChip}>
                <Ionicons name="build" size={12} color="#4CAF50" />
                <Text style={styles.specChipText}>{car.modifications.length} mods</Text>
              </View>
            ) : null}
          </View>

          {/* Actions Row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={[styles.likeButton, isLiked && styles.likeButtonActive]}
              onPress={(e) => {
                e.stopPropagation?.();
                handleLike(car.id);
              }}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={20} 
                color={isLiked ? "#FF4444" : "#888"} 
              />
              <Text style={[styles.likeCount, isLiked && styles.likeCountActive]}>
                {car.likes || 0}
              </Text>
            </TouchableOpacity>
            <View style={styles.viewsInfo}>
              <Ionicons name="eye-outline" size={16} color="#666" />
              <Text style={styles.viewsText}>{car.views || 0}</Text>
            </View>
            <View style={styles.viewGarageBtn}>
              <Text style={styles.viewGarageBtnText}>View</Text>
              <Ionicons name="chevron-forward" size={14} color="#FF6B35" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
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
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Public Garages</Text>
            <Text style={styles.headerSubtitle}>Ranked by likes</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by make, model, year, or owner..."
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
          <Text style={styles.loadingText}>Loading garages...</Text>
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
              {filteredGarages.map((car, index) => renderGarageCard(car, index))}
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
    width: 32,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
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
    gap: 12,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
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
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rankGold: {
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
  },
  rankSilver: {
    backgroundColor: 'rgba(158, 158, 158, 0.9)',
  },
  rankBronze: {
    backgroundColor: 'rgba(205, 127, 50, 0.9)',
  },
  rankText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  imageContainer: {
    height: 200,
    position: 'relative',
  },
  carImage: {
    width: '100%',
    height: '100%',
    ...Platform.select({
      web: {
        objectFit: 'cover' as any,
      },
    }),
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#555',
    fontSize: 12,
    marginTop: 6,
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  photoCount: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  ownerOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerOverlayText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardContent: {
    padding: 14,
  },
  carTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  specChipText: {
    color: '#ccc',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#252525',
    marginRight: 12,
  },
  likeButtonActive: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
  },
  likeCount: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  likeCountActive: {
    color: '#FF4444',
  },
  viewsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsText: {
    color: '#666',
    fontSize: 13,
  },
  viewGarageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 2,
  },
  viewGarageBtnText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
});
