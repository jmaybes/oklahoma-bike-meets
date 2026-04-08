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
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../contexts/AuthContext';
import axios from 'axios';

import { API_URL } from '../../../utils/api';
const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

interface EventPhoto {
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
  likes: string[];
  likeCount: number;
  createdAt: string;
}

interface UserCar {
  id: string;
  make: string;
  model: string;
  year: number;
}

export default function EventGalleryScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [eventTitle, setEventTitle] = useState('');
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Photo viewer modal
  const [selectedPhoto, setSelectedPhoto] = useState<EventPhoto | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  
  // Tag modal
  const [showTagModal, setShowTagModal] = useState(false);
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [loadingCars, setLoadingCars] = useState(false);
  
  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadImage, setUploadImage] = useState<string | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchGallery();
    }, [eventId])
  );

  const fetchGallery = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/events/${eventId}/gallery`);
      setEventTitle(response.data.eventTitle);
      setPhotos(response.data.photos);
    } catch (error) {
      console.error('Error fetching gallery:', error);
      Alert.alert('Error', 'Could not load gallery');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserCars = async () => {
    if (!user?.id) return;
    setLoadingCars(true);
    try {
      const response = await axios.get(`${API_URL}/api/user-cars/user/${user.id}`);
      setUserCars(response.data);
    } catch (error) {
      console.error('Error fetching cars:', error);
    } finally {
      setLoadingCars(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGallery();
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setUploadImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setShowUploadModal(true);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setUploadImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setShowUploadModal(true);
    }
  };

  const uploadPhoto = async () => {
    if (!uploadImage || !user) return;

    setUploading(true);
    try {
      await axios.post(`${API_URL}/api/events/${eventId}/gallery/upload`, {
        eventId: eventId,
        uploaderId: user.id,
        uploaderName: user.nickname || user.name,
        photo: uploadImage,
        caption: uploadCaption,
      });

      setShowUploadModal(false);
      setUploadImage(null);
      setUploadCaption('');
      fetchGallery();
      Alert.alert('Success', 'Photo uploaded to gallery!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  };

  const toggleLike = async (photo: EventPhoto) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to like photos');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/api/events/${eventId}/gallery/${photo.id}/like?user_id=${user.id}`
      );
      
      // Update local state
      setPhotos(prev => prev.map(p => 
        p.id === photo.id 
          ? { ...p, likeCount: response.data.likeCount, likes: response.data.liked 
              ? [...p.likes, user.id] 
              : p.likes.filter(id => id !== user.id) }
          : p
      ));
      
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto(prev => prev ? {
          ...prev,
          likeCount: response.data.likeCount,
          likes: response.data.liked 
            ? [...prev.likes, user.id] 
            : prev.likes.filter(id => id !== user.id)
        } : null);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const openTagModal = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to tag your car');
      return;
    }
    fetchUserCars();
    setShowTagModal(true);
  };

  const tagCar = async (car: UserCar) => {
    if (!selectedPhoto || !user) return;

    try {
      const response = await axios.post(
        `${API_URL}/api/events/${eventId}/gallery/${selectedPhoto.id}/tag`,
        {
          userId: user.id,
          carId: car.id,
          carInfo: `${car.year} ${car.make} ${car.model}`,
        }
      );

      // Update local state
      setPhotos(prev => prev.map(p => 
        p.id === selectedPhoto.id ? response.data : p
      ));
      setSelectedPhoto(response.data);
      setShowTagModal(false);
      Alert.alert('Success', 'Your car has been tagged in this photo!');
    } catch (error: any) {
      console.error('Error tagging car:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Could not tag car');
    }
  };

  const removeTag = async (carId: string) => {
    if (!selectedPhoto || !user) return;

    Alert.alert(
      'Remove Tag',
      'Are you sure you want to remove this tag?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${API_URL}/api/events/${eventId}/gallery/${selectedPhoto.id}/tag/${carId}?user_id=${user.id}`
              );
              
              // Update local state
              const updatedTags = selectedPhoto.tags.filter(t => t.carId !== carId);
              setPhotos(prev => prev.map(p => 
                p.id === selectedPhoto.id ? { ...p, tags: updatedTags } : p
              ));
              setSelectedPhoto(prev => prev ? { ...prev, tags: updatedTags } : null);
            } catch (error) {
              console.error('Error removing tag:', error);
              Alert.alert('Error', 'Could not remove tag');
            }
          },
        },
      ]
    );
  };

  const deletePhoto = async () => {
    if (!selectedPhoto || !user) return;

    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${API_URL}/api/events/${eventId}/gallery/${selectedPhoto.id}?user_id=${user.id}`
              );
              setShowPhotoModal(false);
              setSelectedPhoto(null);
              fetchGallery();
            } catch (error: any) {
              console.error('Error deleting photo:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Could not delete photo');
            }
          },
        },
      ]
    );
  };

  const renderPhoto = ({ item }: { item: EventPhoto }) => {
    const isLiked = user ? item.likes.includes(user.id) : false;
    
    return (
      <TouchableOpacity
        style={styles.photoItem}
        onPress={() => {
          setSelectedPhoto(item);
          setShowPhotoModal(true);
        }}
      >
        <Image source={{ uri: item.photo }} style={styles.photoThumbnail} />
        {item.tags.length > 0 && (
          <View style={styles.tagBadge}>
            <Ionicons name="car-sport" size={12} color="#fff" />
            <Text style={styles.tagBadgeText}>{item.tags.length}</Text>
          </View>
        )}
        <View style={styles.photoOverlay}>
          <View style={styles.photoStats}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={14} color={isLiked ? "#E91E63" : "#fff"} />
            <Text style={styles.photoStatText}>{item.likeCount}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isMyPhoto = selectedPhoto?.uploaderId === user?.id;
  const isLiked = user && selectedPhoto ? selectedPhoto.likes.includes(user.id) : false;
  const myTagInPhoto = selectedPhoto?.tags.find(t => t.userId === user?.id);

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
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Event Gallery</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{eventTitle}</Text>
          </View>
          {isAuthenticated && (
            <TouchableOpacity onPress={pickImage} style={styles.uploadButton}>
              <Ionicons name="camera" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Photo count */}
      <View style={styles.countBar}>
        <Ionicons name="images-outline" size={18} color="#FF6B35" />
        <Text style={styles.countText}>{photos.length} photos</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading gallery...</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhoto}
          numColumns={3}
          contentContainerStyle={styles.photoGrid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="camera-outline" size={64} color="#444" />
              <Text style={styles.emptyTitle}>No Photos Yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to share photos from this event!</Text>
              {isAuthenticated && (
                <TouchableOpacity style={styles.uploadFirstButton} onPress={pickImage}>
                  <Ionicons name="cloud-upload" size={20} color="#fff" />
                  <Text style={styles.uploadFirstText}>Upload Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Upload FAB */}
      {isAuthenticated && photos.length > 0 && (
        <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={pickImage}>
          <LinearGradient
            colors={['#FF6B35', '#E91E63']}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
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
                <Text style={styles.photoModalUploader}>{selectedPhoto?.uploaderName}</Text>
                <Text style={styles.photoModalDate}>
                  {selectedPhoto?.createdAt && new Date(selectedPhoto.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {isMyPhoto && (
                <TouchableOpacity onPress={deletePhoto}>
                  <Ionicons name="trash-outline" size={24} color="#f44336" />
                </TouchableOpacity>
              )}
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

            {/* Caption */}
            {selectedPhoto?.caption && (
              <Text style={styles.photoModalCaption}>{selectedPhoto.caption}</Text>
            )}

            {/* Tags */}
            {selectedPhoto && selectedPhoto.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                <Text style={styles.tagsTitle}>Tagged Cars:</Text>
                {selectedPhoto.tags.map((tag, index) => (
                  <View key={index} style={styles.tagItem}>
                    <Ionicons name="car-sport" size={16} color="#FF6B35" />
                    <Text style={styles.tagText}>{tag.carInfo}</Text>
                    {tag.userId === user?.id && (
                      <TouchableOpacity onPress={() => removeTag(tag.carId)}>
                        <Ionicons name="close-circle" size={18} color="#888" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={styles.photoModalActions}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => selectedPhoto && toggleLike(selectedPhoto)}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={28} 
                  color={isLiked ? "#E91E63" : "#fff"} 
                />
                <Text style={styles.actionText}>{selectedPhoto?.likeCount || 0}</Text>
              </TouchableOpacity>

              {isAuthenticated && !myTagInPhoto && (
                <TouchableOpacity style={styles.tagButton} onPress={openTagModal}>
                  <Ionicons name="car-sport-outline" size={22} color="#fff" />
                  <Text style={styles.tagButtonText}>Tag My Car</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Tag Selection Modal */}
      <Modal
        visible={showTagModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTagModal(false)}
      >
        <View style={styles.tagModalOverlay}>
          <View style={[styles.tagModalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.tagModalHeader}>
              <Text style={styles.tagModalTitle}>Select Your Car</Text>
              <TouchableOpacity onPress={() => setShowTagModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {loadingCars ? (
              <ActivityIndicator size="large" color="#FF6B35" style={{ marginVertical: 40 }} />
            ) : userCars.length === 0 ? (
              <View style={styles.noCarsContainer}>
                <Ionicons name="car-outline" size={48} color="#444" />
                <Text style={styles.noCarsText}>No cars in your garage</Text>
                <TouchableOpacity 
                  style={styles.addCarButton}
                  onPress={() => {
                    setShowTagModal(false);
                    setShowPhotoModal(false);
                    router.push('/garage/add');
                  }}
                >
                  <Text style={styles.addCarButtonText}>Add a Car</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={userCars}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.carOption} onPress={() => tagCar(item)}>
                    <Ionicons name="car-sport" size={24} color="#FF6B35" />
                    <Text style={styles.carOptionText}>
                      {item.year} {item.make} {item.model}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingVertical: 10 }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowUploadModal(false);
          setUploadImage(null);
          setUploadCaption('');
        }}
      >
        <View style={styles.uploadModalOverlay}>
          <View style={[styles.uploadModalContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.uploadModalHeader}>
              <TouchableOpacity onPress={() => {
                setShowUploadModal(false);
                setUploadImage(null);
                setUploadCaption('');
              }}>
                <Text style={styles.uploadCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.uploadModalTitle}>New Photo</Text>
              <TouchableOpacity 
                onPress={uploadPhoto}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FF6B35" />
                ) : (
                  <Text style={styles.uploadShareText}>Share</Text>
                )}
              </TouchableOpacity>
            </View>

            {uploadImage && (
              <Image source={{ uri: uploadImage }} style={styles.uploadPreview} resizeMode="contain" />
            )}

            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor="#666"
              value={uploadCaption}
              onChangeText={setUploadCaption}
              multiline
              maxLength={200}
            />
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
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 8,
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
  uploadButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    gap: 6,
  },
  countText: {
    color: '#888',
    fontSize: 14,
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
  tagBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  tagBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  photoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoStatText: {
    color: '#fff',
    fontSize: 12,
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
  },
  uploadFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
  },
  uploadFirstText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  photoModalUploader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  photoModalCaption: {
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tagsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tagsTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 6,
    gap: 8,
  },
  tagText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  photoModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  tagButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Tag Modal
  tagModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  tagModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  tagModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tagModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  noCarsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noCarsText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  addCarButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  addCarButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  carOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    gap: 12,
  },
  carOptionText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  // Upload Modal
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  uploadModalContent: {
    flex: 1,
  },
  uploadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  uploadModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  uploadCancelText: {
    color: '#888',
    fontSize: 16,
  },
  uploadShareText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadPreview: {
    width: '100%',
    height: 300,
    marginVertical: 16,
  },
  captionInput: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
