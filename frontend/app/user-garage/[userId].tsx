import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import Garage3DCarousel from '../../components/Garage3DCarousel';

const API_URL = 'https://event-hub-okc-1.preview.emergentagent.com';

interface UserCar {
  id: string;
  userId: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  description: string;
  modifications: string[];
  photos: string[];
  photoCount: number;
  isPublic: boolean;
  likes: number;
  likedBy: string[];
  views: number;
  ownerName: string;
  ownerNickname: string;
}

export default function UserGarageScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [car, setCar] = useState<UserCar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (userId) fetchUserGarage();
  }, [userId]);

  const fetchUserGarage = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/user-cars/user/${userId}?include_photos=true`);
      if (response.data) {
        setCar(response.data);
        if (user?.id && response.data.likedBy) {
          setIsLiked(response.data.likedBy.includes(user.id));
        }
      } else {
        setError('no_garage');
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('no_garage');
      } else {
        setError('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async () => {
    if (!user?.id || !car) return;
    try {
      await axios.post(`${API_URL}/api/user-cars/${car.id}/like`, null, {
        params: { user_id: user.id },
      });
      setIsLiked(!isLiked);
      setCar(prev => prev ? {
        ...prev,
        likes: isLiked ? prev.likes - 1 : prev.likes + 1,
      } : null);
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const getPhotoUri = (photo: string) => {
    if (!photo) return '';
    if (photo.startsWith('data:') || photo.startsWith('http')) return photo;
    return `data:image/jpeg;base64,${photo}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Garage</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </View>
    );
  }

  if (error || !car) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Garage</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="car-sport-outline" size={64} color="#444" />
          <Text style={styles.emptyTitle}>
            {error === 'no_garage' ? 'No Public Garage' : 'Error Loading Garage'}
          </Text>
          <Text style={styles.emptyText}>
            {error === 'no_garage'
              ? "This user hasn't set up a public garage yet."
              : 'Something went wrong. Try again later.'}
          </Text>
        </View>
      </View>
    );
  }

  if (!car.isPublic && car.userId !== user?.id) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Garage</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={64} color="#444" />
          <Text style={styles.emptyTitle}>Private Garage</Text>
          <Text style={styles.emptyText}>This garage is set to private.</Text>
        </View>
      </View>
    );
  }

  const photos = (car.photos || []).map(getPhotoUri).filter(p => p.length > 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={['#FF6B35', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{car.ownerNickname || car.ownerName}'s Garage</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/messages/${car.userId}`)}
          style={styles.messageBtn}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 3D Photo Carousel */}
        {photos.length > 0 ? (
          <Garage3DCarousel photos={photos} />
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="car-sport" size={48} color="#444" />
            <Text style={styles.noPhotoText}>No Photos</Text>
          </View>
        )}

        {/* Car Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.carTitle}>
                {car.year} {car.make} {car.model}
              </Text>
              {car.trim ? <Text style={styles.carTrim}>{car.trim}</Text> : null}
            </View>
            <TouchableOpacity onPress={toggleLike} style={styles.likeBtn}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={28}
                color={isLiked ? '#E91E63' : '#888'}
              />
              <Text style={[styles.likeCount, isLiked && { color: '#E91E63' }]}>
                {car.likes || 0}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="eye" size={16} color="#888" />
              <Text style={styles.statText}>{car.views || 0} views</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="images" size={16} color="#888" />
              <Text style={styles.statText}>{car.photoCount || photos.length} photos</Text>
            </View>
            {car.color ? (
              <View style={styles.statItem}>
                <Ionicons name="color-palette" size={16} color="#888" />
                <Text style={styles.statText}>{car.color}</Text>
              </View>
            ) : null}
          </View>

          {/* Description */}
          {car.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About This Build</Text>
              <Text style={styles.description}>{car.description}</Text>
            </View>
          ) : null}

          {/* Modifications */}
          {car.modifications && car.modifications.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Modifications</Text>
              {car.modifications.map((mod, idx) => (
                <View key={idx} style={styles.modRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#FF6B35" />
                  <Text style={styles.modText}>{mod}</Text>
                </View>
              ))}
            </View>
          )}

          {/* View Full Gallery */}
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={() => router.push(`/garage/${car.id}`)}
          >
            <Ionicons name="images" size={20} color="#fff" />
            <Text style={styles.galleryButtonText}>View Full Gallery</Text>
          </TouchableOpacity>
        </View>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  messageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
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
  noPhoto: {
    height: 200,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoText: {
    color: '#666',
    marginTop: 8,
    fontSize: 14,
  },
  infoCard: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  carTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  carTrim: {
    fontSize: 15,
    color: '#FF6B35',
    fontWeight: '600',
    marginTop: 2,
  },
  likeBtn: {
    alignItems: 'center',
    paddingLeft: 16,
  },
  likeCount: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#888',
    fontSize: 13,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 22,
  },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modText: {
    color: '#ccc',
    fontSize: 14,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  galleryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
