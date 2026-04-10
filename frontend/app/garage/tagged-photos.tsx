import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

import { API_URL } from '../../utils/api';
const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

interface TaggedPhoto {
  id: string;
  eventId: string;
  uploaderId: string;
  uploaderName: string;
  photo: string;
  caption: string;
  tags: Array<{
    userId: string;
    carId: string;
    carInfo: string;
    taggedAt: string;
  }>;
  likeCount: number;
  createdAt: string;
  eventTitle: string;
  eventDate: string;
  userTags: Array<{
    userId: string;
    carId: string;
    carInfo: string;
  }>;
}

export default function TaggedPhotosScreen() {
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [photos, setPhotos] = useState<TaggedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<TaggedPhoto | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchTaggedPhotos();
      }
    }, [user?.id])
  );

  const fetchTaggedPhotos = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/users/${user?.id}/tagged-photos`);
      setPhotos(response.data);
    } catch (error) {
      console.error('Error fetching tagged photos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTaggedPhotos();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderPhoto = ({ item }: { item: TaggedPhoto }) => (
    <TouchableOpacity
      style={styles.photoItem}
      onPress={() => {
        setSelectedPhoto(item);
        setShowPhotoModal(true);
      }}
    >
      <Image source={{ uri: item.photo }} style={styles.photoThumbnail} />
      <View style={styles.photoOverlay}>
        <Text style={styles.photoEventName} numberOfLines={1}>{item.eventTitle}</Text>
      </View>
    </TouchableOpacity>
  );

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tagged Photos</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="images-outline" size={64} color="#444" />
          <Text style={styles.loginPrompt}>Please login to view tagged photos</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#FF5500', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Tagged Photos</Text>
            <Text style={styles.headerSubtitle}>Photos of your car from events</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#2196F3" />
        <Text style={styles.infoBannerText}>
          These photos don't count toward your garage photo limit
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5500" />
          <Text style={styles.loadingText}>Loading your tagged photos...</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhoto}
          numColumns={3}
          contentContainerStyle={styles.photoGrid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5500" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color="#444" />
              <Text style={styles.emptyTitle}>No Tagged Photos Yet</Text>
              <Text style={styles.emptySubtitle}>
                When photographers tag your car in event photos, they'll appear here!
              </Text>
              <TouchableOpacity
                style={styles.browseEventsButton}
                onPress={() => router.push('/(tabs)/home')}
              >
                <Ionicons name="calendar" size={20} color="#fff" />
                <Text style={styles.browseEventsText}>Browse Events</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Photo Viewer Modal */}
      <Modal
        visible={showPhotoModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.photoModalOverlay}>
          <View style={[styles.photoModalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.photoModalHeader}>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <View style={styles.photoModalHeaderInfo}>
                <Text style={styles.photoModalEventName}>{selectedPhoto?.eventTitle}</Text>
                <Text style={styles.photoModalDate}>
                  {selectedPhoto?.eventDate && formatDate(selectedPhoto.eventDate)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                setShowPhotoModal(false);
                if (selectedPhoto) {
                  router.push(`/event/${selectedPhoto.eventId}/gallery`);
                }
              }}>
                <Ionicons name="images-outline" size={24} color="#FF5500" />
              </TouchableOpacity>
            </View>

            {/* Photo */}
            <View style={styles.photoModalImageContainer}>
              {selectedPhoto && (
                <Image
                  source={{ uri: selectedPhoto.photo }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              )}
            </View>

            {/* Tagged Cars Info */}
            {selectedPhoto?.userTags && selectedPhoto.userTags.length > 0 && (
              <View style={styles.taggedCarsContainer}>
                <Text style={styles.taggedCarsTitle}>Your Tagged Cars:</Text>
                {selectedPhoto.userTags.map((tag, index) => (
                  <View key={index} style={styles.taggedCarItem}>
                    <Ionicons name="car-sport" size={18} color="#FF5500" />
                    <Text style={styles.taggedCarText}>{tag.carInfo}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Photo Info */}
            <View style={styles.photoInfoContainer}>
              <View style={styles.photoInfoRow}>
                <Ionicons name="person" size={16} color="#888" />
                <Text style={styles.photoInfoText}>Photo by {selectedPhoto?.uploaderName}</Text>
              </View>
              <View style={styles.photoInfoRow}>
                <Ionicons name="heart" size={16} color="#E91E63" />
                <Text style={styles.photoInfoText}>{selectedPhoto?.likeCount || 0} likes</Text>
              </View>
            </View>
          </View>
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
  headerGradient: {
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  infoBannerText: {
    color: '#2196F3',
    fontSize: 13,
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loginPrompt: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  photoGrid: {
    padding: 8,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  photoEventName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  browseEventsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5500',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
  },
  browseEventsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Photo Modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  photoModalContent: {
    flex: 1,
  },
  photoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  photoModalHeaderInfo: {
    flex: 1,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  photoModalEventName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  photoModalDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  photoModalImageContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  photoModalImage: {
    width: '100%',
    height: '100%',
  },
  taggedCarsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(225, 85, 0, 0.1)',
  },
  taggedCarsTitle: {
    color: '#FF5500',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  taggedCarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  taggedCarText: {
    color: '#fff',
    fontSize: 14,
  },
  photoInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  photoInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoInfoText: {
    color: '#888',
    fontSize: 13,
  },
});
