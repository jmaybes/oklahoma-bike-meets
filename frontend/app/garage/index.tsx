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
import { useFonts, RockSalt_400Regular } from '@expo-google-fonts/rock-salt';

import { API_URL } from '../../utils/api';

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
  photoCount?: number;
  commentCount?: number;
}

export default function BrowseGaragesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ RockSalt_400Regular });
  const [garages, setGarages] = useState<UserCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState('random');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const sortOptions = [
    { key: 'random', label: 'Random', icon: 'shuffle' as const },
    { key: 'likes', label: 'Most Liked', icon: 'heart' as const },
    { key: 'newest', label: 'Date Added', icon: 'calendar' as const },
    { key: 'views', label: 'Most Viewed', icon: 'eye' as const },
  ];

  const fetchGarages = useCallback(async () => {
    try {
      setFetchError(null);
      const response = await axios.get(`${API_URL}/api/user-cars/public?sort=${sortBy}`, {
        timeout: 15000,
      });
      const data = response.data;
      if (Array.isArray(data)) {
        setGarages(data);
      } else {
        console.error('Garage response is not an array:', typeof data);
        setFetchError('Unexpected response format. Please try again.');
        setGarages([]);
      }
    } catch (error: any) {
      console.error('Error fetching garages:', error?.message || error);
      const msg = error?.response
        ? `Server error (${error.response.status})`
        : error?.code === 'ECONNABORTED'
        ? 'Request timed out. Check your connection.'
        : 'Could not load garages. Check your connection.';
      setFetchError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortBy]);

  useEffect(() => {
    setLoading(true);
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
    try {
      if (!car.photos || !Array.isArray(car.photos) || car.photos.length === 0) return null;
      const idx = car.mainPhotoIndex && car.mainPhotoIndex < car.photos.length ? car.mainPhotoIndex : 0;
      const photo = car.photos[idx];
      if (!photo || typeof photo !== 'string' || photo.length < 10) return null;
      // Handle both base64 strings and data URIs
      if (photo.startsWith('data:')) return photo;
      if (photo.startsWith('http')) return photo;
      return `data:image/jpeg;base64,${photo}`;
    } catch {
      return null;
    }
  };

  const filteredGarages = garages.filter(car => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      String(car.make || '').toLowerCase().includes(searchLower) ||
      String(car.model || '').toLowerCase().includes(searchLower) ||
      String(car.year || '').toLowerCase().includes(searchLower) ||
      String(car.ownerName || '').toLowerCase().includes(searchLower) ||
      String(car.ownerNickname || '').toLowerCase().includes(searchLower)
    );
  });

  const renderGarageCard = (car: UserCar, index: number) => {
    try {
      if (!car || !car.id) return null;
      const mainPhoto = getMainPhoto(car);
      const isLiked = user ? car.likedBy?.includes(user.id) : false;
      const isTopThree = index < 3;

    return (
      <TouchableOpacity
        key={car.id}
        style={styles.garageCard}
        onPress={() => router.push(`/user-garage/${car.userId}`)}
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
          {mainPhoto && !failedImages.has(car.id) ? (
            <Image
              source={{ uri: mainPhoto }}
              style={styles.carImage}
              resizeMode="cover"
              onError={() => {
                setFailedImages(prev => new Set(prev).add(car.id));
              }}
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
            <Text style={styles.photoCountText}>{car.photoCount || car.photos?.length || 0}</Text>
          </View>
          {/* Owner name overlay */}
          <View style={styles.ownerOverlay}>
            <Ionicons name="person-circle" size={18} color="#E15500" />
            <Text style={styles.ownerOverlayText} numberOfLines={1}>
              {car.ownerNickname || car.ownerName}
            </Text>
          </View>
        </View>

        {/* View Button - right under photo */}
        <TouchableOpacity 
          style={styles.viewUnderPhoto}
          onPress={() => router.push(`/user-garage/${car.userId}`)}
          activeOpacity={0.7}
        >
          <Text style={styles.viewUnderPhotoText}>View</Text>
          <Ionicons name="chevron-forward" size={14} color="#E15500" />
        </TouchableOpacity>

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
                <Ionicons name="flash" size={12} color="#E15500" />
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
            <TouchableOpacity 
              style={styles.commentsLink}
              onPress={() => router.push(`/user-garage/${car.userId}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#E15500" />
              <Text style={styles.commentsLinkText}>
                Comments{car.commentCount ? ` (${car.commentCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
    } catch (e) {
      console.error('Error rendering garage card:', car?.id, e);
      return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#FFE707', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: 'RockSalt_400Regular' }]}>Public Garages</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity 
              onPress={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery('');
              }} 
              style={styles.sortButton}
            >
              <Ionicons name={showSearch ? "close" : "search"} size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setShowSortMenu(!showSortMenu)} 
              style={styles.sortButton}
            >
              <Ionicons name="funnel-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Sort Dropdown */}
      {showSortMenu && (
        <View style={styles.sortDropdown}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortOption,
                sortBy === option.key && styles.sortOptionActive,
              ]}
              onPress={() => {
                setSortBy(option.key);
                setShowSortMenu(false);
              }}
            >
              <Ionicons 
                name={option.icon as any} 
                size={16} 
                color={sortBy === option.key ? '#E15500' : '#888'} 
              />
              <Text style={[
                styles.sortOptionText,
                sortBy === option.key && styles.sortOptionTextActive,
              ]}>
                {option.label}
              </Text>
              {sortBy === option.key && (
                <Ionicons name="checkmark" size={16} color="#E15500" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search Bar - Hidden until search icon is tapped */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by make, model, year, or owner..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E15500" />
          <Text style={styles.loadingText}>Loading garages...</Text>
        </View>
      ) : fetchError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#E15500" />
          <Text style={styles.errorTitle}>Unable to Load Garages</Text>
          <Text style={styles.errorText}>{fetchError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchGarages(); }}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E15500" />
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
              <View style={{ height: 100 }} />
            </>
          )}
        </ScrollView>
      )}

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 20) }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/home')}>
          <Ionicons name="car-sport-outline" size={24} color="#ccc" />
          <Text style={styles.navLabel}>Events</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/nearby')}>
          <Ionicons name="location-outline" size={24} color="#ccc" />
          <Text style={styles.navLabel}>Nearby</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/clubs')}>
          <Ionicons name="people-outline" size={24} color="#ccc" />
          <Text style={styles.navLabel}>Clubs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/feeds')}>
          <Ionicons name="chatbubbles-outline" size={24} color="#ccc" />
          <Text style={styles.navLabel}>Lounge</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/profile')}>
          <Ionicons name="person-outline" size={24} color="#ccc" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
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
    overflow: 'hidden',
    boxShadow: 'inset 0px 1px 20px 1px #000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    marginLeft: 8,
    textShadow: '3px 2px 3px #000000c2',
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortDropdown: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sortOptionActive: {
    backgroundColor: 'rgba(225, 85, 0, 0.1)',
  },
  sortOptionText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  sortOptionTextActive: {
    color: '#E15500',
    fontWeight: '700',
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
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  resultCount: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E15500',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 2,
    position: 'relative',
    width: '100%',
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
    color: '#E15500',
    fontSize: 14,
    fontWeight: '600',
  },
  viewUnderPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E15500',
    paddingVertical: 10,
    gap: 4,
  },
  viewUnderPhotoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  commentsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 5,
  },
  commentsLinkText: {
    color: '#E15500',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderTopColor: '#444',
    borderTopWidth: 1,
    paddingTop: 10,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#ccc',
  },
});
