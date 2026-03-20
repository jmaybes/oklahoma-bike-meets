import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Share,
  Linking,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

interface Modification {
  category: string;
  name: string;
  brand?: string;
  description?: string;
  cost?: number;
}

interface UserCar {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: string;
  color: string;
  trim: string;
  engine: string;
  horsepower?: number;
  torque?: number;
  transmission: string;
  drivetrain: string;
  description: string;
  photos: string[];
  videos: string[];
  modifications: Modification[];
  modificationNotes: string;
  isPublic: boolean;
  instagramHandle: string;
  youtubeChannel: string;
  likes: number;
  views: number;
  ownerName: string;
  ownerNickname: string;
  createdAt: string;
}

const modCategories: { [key: string]: { icon: string; color: string } } = {
  Engine: { icon: 'flash', color: '#F44336' },
  Suspension: { icon: 'git-merge', color: '#2196F3' },
  Exterior: { icon: 'car-sport', color: '#4CAF50' },
  Interior: { icon: 'apps', color: '#9C27B0' },
  Wheels: { icon: 'ellipse', color: '#FF9800' },
  Exhaust: { icon: 'volume-high', color: '#795548' },
  Brakes: { icon: 'stop-circle', color: '#E91E63' },
  Other: { icon: 'construct', color: '#607D8B' },
};

export default function GarageDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [car, setCar] = useState<UserCar | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    fetchCar();
  }, [id]);

  const fetchCar = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user-cars/${id}`);
      setCar(response.data);
    } catch (error) {
      console.error('Error fetching car:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!user || !car) return;
    try {
      await axios.post(`${API_URL}/api/user-cars/${car.id}/like?user_id=${user.id}`);
      fetchCar();
    } catch (error) {
      console.error('Error liking car:', error);
    }
  };

  const handleShare = async () => {
    if (!car) return;
    try {
      await Share.share({
        title: `${car.year} ${car.make} ${car.model}`,
        message: `Check out this ${car.year} ${car.make} ${car.model} by ${car.ownerNickname || car.ownerName}!\n\n${car.description}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const openInstagram = () => {
    if (car?.instagramHandle) {
      Linking.openURL(`https://instagram.com/${car.instagramHandle.replace('@', '')}`);
    }
  };

  const openYouTube = () => {
    if (car?.youtubeChannel) {
      Linking.openURL(car.youtubeChannel);
    }
  };

  const groupModificationsByCategory = (mods: Modification[]) => {
    const grouped: { [key: string]: Modification[] } = {};
    mods.forEach(mod => {
      const cat = mod.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(mod);
    });
    return grouped;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </View>
    );
  }

  if (!car) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={64} color="#F44336" />
          <Text style={styles.errorText}>Garage not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const groupedMods = groupModificationsByCategory(car.modifications || []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {car.ownerNickname || car.ownerName}'s Garage
          </Text>
          <TouchableOpacity onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photo Gallery */}
        {car.photos && car.photos.length > 0 && (
          <TouchableOpacity 
            style={styles.photoGallery}
            onPress={() => setShowPhotoModal(true)}
          >
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setActivePhotoIndex(index);
              }}
            >
              {car.photos.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}` }}
                  style={styles.mainPhoto}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            <View style={styles.photoIndicator}>
              {car.photos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    activePhotoIndex === index && styles.activeDot,
                  ]}
                />
              ))}
            </View>
            <View style={styles.photoCountBadge}>
              <Ionicons name="images" size={14} color="#fff" />
              <Text style={styles.photoCountText}>
                {activePhotoIndex + 1}/{car.photos.length}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Car Title */}
        <View style={styles.titleSection}>
          <Text style={styles.carYear}>{car.year}</Text>
          <Text style={styles.carTitle}>{car.make} {car.model}</Text>
          {car.trim && <Text style={styles.carTrim}>{car.trim}</Text>}
          <View style={styles.ownerRow}>
            <Text style={styles.ownerLabel}>Owner:</Text>
            <Text style={styles.ownerName}>{car.ownerNickname || car.ownerName}</Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="heart" size={24} color="#FF6B35" />
            <Text style={styles.statValue}>{car.likes || 0}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="eye" size={24} color="#2196F3" />
            <Text style={styles.statValue}>{car.views || 0}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
          {car.horsepower && (
            <View style={styles.statCard}>
              <Ionicons name="flash" size={24} color="#FFC107" />
              <Text style={styles.statValue}>{car.horsepower}</Text>
              <Text style={styles.statLabel}>HP</Text>
            </View>
          )}
          {car.modifications && car.modifications.length > 0 && (
            <View style={styles.statCard}>
              <Ionicons name="build" size={24} color="#4CAF50" />
              <Text style={styles.statValue}>{car.modifications.length}</Text>
              <Text style={styles.statLabel}>Mods</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {car.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About This Build</Text>
            <Text style={styles.description}>{car.description}</Text>
          </View>
        )}

        {/* Specs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specifications</Text>
          <View style={styles.specsGrid}>
            {car.engine && (
              <View style={styles.specItem}>
                <Ionicons name="speedometer" size={20} color="#FF6B35" />
                <Text style={styles.specLabel}>Engine</Text>
                <Text style={styles.specValue}>{car.engine}</Text>
              </View>
            )}
            {car.horsepower && (
              <View style={styles.specItem}>
                <Ionicons name="flash" size={20} color="#FF6B35" />
                <Text style={styles.specLabel}>Horsepower</Text>
                <Text style={styles.specValue}>{car.horsepower} HP</Text>
              </View>
            )}
            {car.torque && (
              <View style={styles.specItem}>
                <Ionicons name="sync" size={20} color="#FF6B35" />
                <Text style={styles.specLabel}>Torque</Text>
                <Text style={styles.specValue}>{car.torque} lb-ft</Text>
              </View>
            )}
            {car.transmission && (
              <View style={styles.specItem}>
                <Ionicons name="cog" size={20} color="#FF6B35" />
                <Text style={styles.specLabel}>Transmission</Text>
                <Text style={styles.specValue}>{car.transmission}</Text>
              </View>
            )}
            {car.drivetrain && (
              <View style={styles.specItem}>
                <Ionicons name="git-branch" size={20} color="#FF6B35" />
                <Text style={styles.specLabel}>Drivetrain</Text>
                <Text style={styles.specValue}>{car.drivetrain}</Text>
              </View>
            )}
            {car.color && (
              <View style={styles.specItem}>
                <Ionicons name="color-palette" size={20} color="#FF6B35" />
                <Text style={styles.specLabel}>Color</Text>
                <Text style={styles.specValue}>{car.color}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Modifications */}
        {car.modifications && car.modifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modification List</Text>
            {Object.entries(groupedMods).map(([category, mods]) => (
              <View key={category} style={styles.modCategory}>
                <View style={styles.modCategoryHeader}>
                  <Ionicons 
                    name={modCategories[category]?.icon as any || 'construct'} 
                    size={20} 
                    color={modCategories[category]?.color || '#888'} 
                  />
                  <Text style={styles.modCategoryTitle}>{category}</Text>
                  <Text style={styles.modCount}>{mods.length}</Text>
                </View>
                {mods.map((mod, index) => (
                  <View key={index} style={styles.modItem}>
                    <Text style={styles.modName}>
                      {mod.brand ? `${mod.brand} ` : ''}{mod.name}
                    </Text>
                    {mod.description && (
                      <Text style={styles.modDescription}>{mod.description}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
            {car.modificationNotes && (
              <View style={styles.modNotes}>
                <Text style={styles.modNotesTitle}>Additional Notes</Text>
                <Text style={styles.modNotesText}>{car.modificationNotes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Social Links */}
        {(car.instagramHandle || car.youtubeChannel) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Follow This Build</Text>
            <View style={styles.socialRow}>
              {car.instagramHandle && (
                <TouchableOpacity style={styles.socialButton} onPress={openInstagram}>
                  <Ionicons name="logo-instagram" size={24} color="#E1306C" />
                  <Text style={styles.socialText}>@{car.instagramHandle.replace('@', '')}</Text>
                </TouchableOpacity>
              )}
              {car.youtubeChannel && (
                <TouchableOpacity style={styles.socialButton} onPress={openYouTube}>
                  <Ionicons name="logo-youtube" size={24} color="#FF0000" />
                  <Text style={styles.socialText}>YouTube</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
            <Ionicons name="heart" size={24} color="#fff" />
            <Text style={styles.likeButtonText}>Like This Build</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Photo Modal */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.photoModal}>
          <TouchableOpacity 
            style={styles.closeModalButton}
            onPress={() => setShowPhotoModal(false)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {car.photos?.map((photo, index) => (
              <Image
                key={index}
                source={{ uri: photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}` }}
                style={styles.fullScreenPhoto}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
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
    backgroundColor: '#FF6B35',
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
  },
  photoGallery: {
    height: 280,
    position: 'relative',
  },
  mainPhoto: {
    width: width,
    height: 280,
  },
  photoIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeDot: {
    backgroundColor: '#fff',
  },
  photoCountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  titleSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  carYear: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
  carTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  carTrim: {
    color: '#888',
    fontSize: 16,
    marginTop: 4,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  ownerLabel: {
    color: '#888',
    fontSize: 14,
  },
  ownerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    color: '#aaa',
    fontSize: 15,
    lineHeight: 24,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  specItem: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  specLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  specValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  modCategory: {
    marginBottom: 16,
  },
  modCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modCategoryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  modCount: {
    color: '#888',
    fontSize: 14,
  },
  modItem: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    marginLeft: 28,
  },
  modName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  modDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  modNotes: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  modNotesTitle: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modNotesText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 22,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  socialText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    padding: 20,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  likeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeModalButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullScreenPhoto: {
    width: width,
    height: '100%',
  },
});
