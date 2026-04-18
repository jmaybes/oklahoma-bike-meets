import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useFonts, RockSalt_400Regular } from '@expo-google-fonts/rock-salt';

import { API_URL } from '../../utils/api';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const width = SCREEN_WIDTH;

// Carousel constants
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.55;
const CARD_SPACING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

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
  mainPhotoIndex?: number;
  likedBy?: string[];
}

interface GarageComment {
  id: string;
  carId: string;
  userId: string;
  userName: string;
  text: string;
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
  const { id, showPhotos } = useLocalSearchParams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ RockSalt_400Regular });
  const [car, setCar] = useState<UserCar | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const isAdmin = user?.isAdmin === true;
  const [showSetLikes, setShowSetLikes] = useState(false);
  const [likesInput, setLikesInput] = useState('');
  
  // Lazy-loaded full-size photos (keyed by index)
  const [fullPhotos, setFullPhotos] = useState<{ [key: number]: string }>({});
  const [loadingPhoto, setLoadingPhoto] = useState<number | null>(null);

  // Comments state
  const [comments, setComments] = useState<GarageComment[]>([]);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Crew state
  const [ownerCrews, setOwnerCrews] = useState<any[]>([]);

  useEffect(() => {
    fetchCar();
    fetchComments();
  }, [id]);

  // Auto-open photo gallery if navigated with showPhotos param
  useEffect(() => {
    if (showPhotos === 'true' && car && car.photos && car.photos.length > 0 && !loading) {
      openPhotoModal(0);
    }
  }, [showPhotos, car, loading]);

  const fetchCar = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user-cars/${id}`);
      setCar(response.data);
      // Fetch owner's crews
      if (response.data.userId) {
        fetchOwnerCrews(response.data.userId);
      }
      // Log broken photos for debugging, but don't alarm the user
      if (response.data.brokenPhotos && response.data.brokenPhotos.length > 0) {
        console.log('Broken photo indices:', response.data.brokenPhotos);
      }
    } catch (error) {
      console.error('Error fetching car:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOwnerCrews = async (ownerId: string) => {
    try {
      const res = await axios.get(`${API_URL}/api/crews/user/${ownerId}`);
      setOwnerCrews(res.data || []);
    } catch (err) {
      console.error('Error fetching owner crews:', err);
    }
  };

  // Fetch full-size photo on demand
  const fetchFullPhoto = async (index: number) => {
    if (fullPhotos[index]) return fullPhotos[index];
    setLoadingPhoto(index);
    try {
      const response = await axios.get(`${API_URL}/api/user-cars/${id}/photo/${index}`);
      const photo = response.data.photo;
      setFullPhotos(prev => ({ ...prev, [index]: photo }));
      return photo;
    } catch (error) {
      console.error('Error fetching full photo:', error);
      return null;
    } finally {
      setLoadingPhoto(null);
    }
  };

  // Pre-fetch adjacent photos when modal opens
  const openPhotoModal = async (startIndex: number) => {
    setCarouselIndex(startIndex);
    scrollX.setValue(startIndex * (CARD_WIDTH + 16));
    setShowPhotoModal(true);
    // Pre-fetch the current photo and adjacent ones
    fetchFullPhoto(startIndex);
    if (startIndex > 0) fetchFullPhoto(startIndex - 1);
    if (car && startIndex < car.photos.length - 1) fetchFullPhoto(startIndex + 1);
  };

  // Get the best available photo for display
  const getDisplayPhoto = (index: number): string => {
    // Check for lazy-loaded full-size photo first
    const full = fullPhotos[index];
    if (full) {
      if (full.startsWith('http')) return full;
      return full.startsWith('data:') ? full : `data:image/jpeg;base64,${full}`;
    }
    // Fall back to the photo URL from car data (now HTTP URLs)
    const thumb = car?.photos?.[index];
    if (thumb) {
      if (thumb.startsWith('http')) return thumb;
      return thumb.startsWith('data:') ? thumb : `data:image/jpeg;base64,${thumb}`;
    }
    return '';
  };

  const handleLike = async () => {
    if (!user || !car) return;
    try {
      // Optimistic update
      const isCurrentlyLiked = car.likedBy?.includes(user.id);
      setCar({
        ...car,
        likes: isCurrentlyLiked ? (car.likes || 1) - 1 : (car.likes || 0) + 1,
        likedBy: isCurrentlyLiked
          ? (car.likedBy || []).filter(id => id !== user.id)
          : [...(car.likedBy || []), user.id],
      });
      await axios.post(`${API_URL}/api/user-cars/${car.id}/like?user_id=${user.id}`);
    } catch (error) {
      console.error('Error liking car:', error);
      fetchCar(); // Revert on error
    }
  };

  const handleSetLikes = async () => {
    if (!user || !car) return;
    const count = parseInt(likesInput);
    if (isNaN(count) || count < 0) {
      Alert.alert('Invalid', 'Enter a valid number (0 or higher)');
      return;
    }
    try {
      await axios.put(
        `${API_URL}/api/admin/user-cars/${car.id}/set-likes?admin_id=${user.id}&likes=${count}`
      );
      setCar({ ...car, likes: count });
      setShowSetLikes(false);
      setLikesInput('');
      Alert.alert('Success', `Likes set to ${count}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to set likes');
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

  // Comment functions
  const fetchComments = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/garage-comments/${id}`);
      setComments(response.data);
    } catch (error) {
      console.log('Failed to fetch comments:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to leave a comment.');
      return;
    }
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      await axios.post(`${API_URL}/api/garage-comments`, {
        carId: id,
        userId: user.id,
        userName: user.nickname || user.name,
        text: commentText.trim(),
      });
      setCommentText('');
      setShowCommentModal(false);
      fetchComments();
      Alert.alert('Comment Posted', 'Your comment has been added!');
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`${API_URL}/api/garage-comments/${commentId}?user_id=${user.id}`);
            fetchComments();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete comment.');
          }
        }
      }
    ]);
  };

  // Comment edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const handleEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      await axios.put(
        `${API_URL}/api/garage-comments/${commentId}?user_id=${user?.id}&text=${encodeURIComponent(editCommentText.trim())}`
      );
      setEditingCommentId(null);
      setEditCommentText('');
      fetchComments();
    } catch (error) {
      Alert.alert('Error', 'Failed to update comment');
    }
  };

  const formatCommentDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch { return ''; }
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
          <ActivityIndicator size="large" color="#FF5500" />
        </View>
      </View>
    );
  }

  if (!car) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="car-sport-outline" size={64} color="#666" />
          <Text style={styles.errorText}>This Ride Is Gone</Text>
          <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', marginTop: 8, marginHorizontal: 30 }}>
            This car may have been removed by its owner or is no longer available.
          </Text>
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
        colors={['#FFE707', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: 'RockSalt_400Regular' }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>
            {car.ownerNickname || car.ownerName}'s Garage
          </Text>
          <TouchableOpacity onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photo Gallery - Hero Image */}
        {car.photos && car.photos.length > 0 && (
          <View style={styles.photoGallery}>
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
                <View key={index} style={styles.mainPhotoContainer}>
                  <Image
                    source={{ uri: getDisplayPhoto(index) }}
                    style={styles.mainPhoto}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>
            {/* Gradient overlay at bottom for readability */}
            <LinearGradient
              colors={['transparent', 'rgba(12,12,12,0.9)']}
              style={styles.photoBottomGradient}
            />
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
            {/* View Photos Button */}
            {car.photos.length > 0 && (
              <TouchableOpacity 
                style={styles.viewPhotosButton}
                onPress={() => openPhotoModal(activePhotoIndex)}
                activeOpacity={0.8}
              >
                <Ionicons name="images-outline" size={18} color="#fff" />
                <Text style={styles.viewPhotosText}>View Photos</Text>
              </TouchableOpacity>
            )}
            {/* Comment Button */}
            <TouchableOpacity 
              style={styles.commentButton}
              onPress={() => {
                if (!user) {
                  Alert.alert('Login Required', 'Please log in to leave a comment.');
                  return;
                }
                setShowCommentModal(true);
              }}
              activeOpacity={0.8}
            >
              <Image 
                source={require('../../assets/images/message-icon.png')} 
                style={{ width: 20, height: 20 }} 
                resizeMode="contain"
              />
              <Text style={styles.commentButtonText}>
                Comment{comments.length > 0 ? ` (${comments.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
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
          {/* Crew Badges */}
          {ownerCrews.length > 0 && (
            <View style={styles.crewBadgesRow}>
              {ownerCrews.map((crew: any) => (
                <TouchableOpacity
                  key={crew.id}
                  style={styles.crewBadgeChip}
                  onPress={() => router.push(`/crews/${crew.id}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people" size={11} color="#FFE707" />
                  <Text style={styles.crewBadgeChipText}>{crew.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="heart" size={24} color="#FF5500" />
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
                <Ionicons name="speedometer" size={20} color="#FF5500" />
                <Text style={styles.specLabel}>Engine</Text>
                <Text style={styles.specValue}>{car.engine}</Text>
              </View>
            )}
            {car.horsepower && (
              <View style={styles.specItem}>
                <Ionicons name="flash" size={20} color="#FF5500" />
                <Text style={styles.specLabel}>Horsepower</Text>
                <Text style={styles.specValue}>{car.horsepower} HP</Text>
              </View>
            )}
            {car.torque && (
              <View style={styles.specItem}>
                <Ionicons name="sync" size={20} color="#FF5500" />
                <Text style={styles.specLabel}>Torque</Text>
                <Text style={styles.specValue}>{car.torque} lb-ft</Text>
              </View>
            )}
            {car.transmission && (
              <View style={styles.specItem}>
                <Ionicons name="cog" size={20} color="#FF5500" />
                <Text style={styles.specLabel}>Transmission</Text>
                <Text style={styles.specValue}>{car.transmission}</Text>
              </View>
            )}
            {car.drivetrain && (
              <View style={styles.specItem}>
                <Ionicons name="git-branch" size={20} color="#FF5500" />
                <Text style={styles.specLabel}>Drivetrain</Text>
                <Text style={styles.specValue}>{car.drivetrain}</Text>
              </View>
            )}
            {car.color && (
              <View style={styles.specItem}>
                <Ionicons name="color-palette" size={20} color="#FF5500" />
                <Text style={styles.specLabel}>Color</Text>
                <Text style={styles.specValue}>{car.color}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Modifications */}
        {((car.modifications && car.modifications.length > 0) || car.modificationNotes) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modifications</Text>
            {car.modifications && car.modifications.length > 0 && Object.entries(groupedMods).map(([category, mods]) => (
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
                <Text style={styles.modNotesTitle}>
                  {car.modifications && car.modifications.length > 0 ? 'Additional Notes' : 'Build Details'}
                </Text>
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

        {/* Comments Section */}
        {comments.length > 0 && (
          <View style={styles.commentsSection}>
            <View style={styles.commentsSectionHeader}>
              <Ionicons name="chatbubbles" size={20} color="#FF5500" />
              <Text style={styles.commentsSectionTitle}>Comments ({comments.length})</Text>
            </View>
            {comments.map((comment) => (
              <View key={comment.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {comment.userName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentAuthor}>{comment.userName}</Text>
                    <Text style={styles.commentDate}>
                      {formatCommentDate(comment.createdAt)}{comment.edited ? ' (edited)' : ''}
                    </Text>
                  </View>
                  {user && user.id === comment.userId && (
                    <TouchableOpacity 
                      style={styles.commentEditBtn}
                      onPress={() => {
                        setEditingCommentId(comment.id);
                        setEditCommentText(comment.text);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#FF5500" />
                    </TouchableOpacity>
                  )}
                  {user && (user.id === comment.userId || isAdmin) && (
                    <TouchableOpacity 
                      style={styles.commentDeleteBtn}
                      onPress={() => handleDeleteComment(comment.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#666" />
                    </TouchableOpacity>
                  )}
                </View>
                {editingCommentId === comment.id ? (
                  <View style={styles.editCommentContainer}>
                    <TextInput
                      style={styles.editCommentInput}
                      value={editCommentText}
                      onChangeText={setEditCommentText}
                      multiline
                      maxLength={500}
                      autoFocus
                    />
                    <View style={styles.editCommentActions}>
                      <TouchableOpacity 
                        style={styles.editCancelBtn}
                        onPress={() => { setEditingCommentId(null); setEditCommentText(''); }}
                      >
                        <Text style={styles.editCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.editSaveBtn}
                        onPress={() => handleEditComment(comment.id)}
                      >
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.editSaveText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.commentText}>{comment.text}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[
              styles.likeButton, 
              user && car.likedBy?.includes(user.id) && styles.likeButtonLiked
            ]} 
            onPress={handleLike}
          >
            <Ionicons 
              name={user && car.likedBy?.includes(user.id) ? "heart" : "heart-outline"} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.likeButtonText}>
              {user && car.likedBy?.includes(user.id) ? 'Liked' : 'Like This Build'} ({car.likes || 0})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Admin Set Likes */}
        {isAdmin && (
          <View style={styles.adminSetLikesSection}>
            {showSetLikes ? (
              <View style={styles.setLikesRow}>
                <TextInput
                  style={styles.setLikesInput}
                  value={likesInput}
                  onChangeText={setLikesInput}
                  placeholder={String(car.likes || 0)}
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
                <TouchableOpacity style={styles.setLikesSave} onPress={handleSetLikes}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.setLikesCancel} onPress={() => { setShowSetLikes(false); setLikesInput(''); }}>
                  <Ionicons name="close" size={18} color="#aaa" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.adminSetLikesBtn}
                onPress={() => { setShowSetLikes(true); setLikesInput(String(car.likes || 0)); }}
              >
                <Ionicons name="shield" size={14} color="#2196F3" />
                <Text style={styles.adminSetLikesText}>Admin: Set Likes</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Carousel Photo Modal */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
        statusBarTranslucent
      >
        <View style={styles.carouselModal}>
          {/* Close button */}
          <TouchableOpacity 
            style={[styles.closeModalButton, { top: insets.top + 10 }]}
            onPress={() => setShowPhotoModal(false)}
          >
            <View style={styles.closeButtonBg}>
              <Ionicons name="close" size={24} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Car info header */}
          <View style={[styles.carouselHeader, { top: insets.top + 10 }]}>
            <Text style={styles.carouselTitle}>{car.year} {car.make} {car.model}</Text>
          </View>

          {/* Carousel */}
          <Animated.FlatList
            data={car.photos || []}
            keyExtractor={(_, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 16}
            decelerationRate="fast"
            contentContainerStyle={{
              paddingHorizontal: CARD_SPACING - 8,
              alignItems: 'center',
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 16));
              const newIdx = Math.max(0, Math.min(idx, (car.photos?.length || 1) - 1));
              setCarouselIndex(newIdx);
              // Pre-fetch adjacent full photos
              fetchFullPhoto(newIdx);
              if (newIdx > 0) fetchFullPhoto(newIdx - 1);
              if (newIdx < (car.photos?.length || 0) - 1) fetchFullPhoto(newIdx + 1);
            }}
            initialScrollIndex={carouselIndex}
            getItemLayout={(_, index) => ({
              length: CARD_WIDTH + 16,
              offset: (CARD_WIDTH + 16) * index,
              index,
            })}
            renderItem={({ item: photo, index }) => {
              const photoUri = getDisplayPhoto(index);

              return (
                <View
                  style={styles.carouselCard}
                >
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.carouselImage}
                    resizeMode="cover"
                  />
                  {loadingPhoto === index && (
                    <View style={styles.photoLoadingOverlay}>
                      <ActivityIndicator size="large" color="#FF5500" />
                      <Text style={{ color: '#fff', marginTop: 8, fontSize: 12 }}>Loading HD...</Text>
                    </View>
                  )}
                  {/* Photo number overlay */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.carouselCardGradient}
                  >
                    <Text style={styles.carouselPhotoNumber}>
                      {index + 1} / {car.photos?.length}
                    </Text>
                  </LinearGradient>
                </View>
              );
            }}
          />

          {/* Dot indicators */}
          <View style={styles.carouselDots}>
            {(car.photos || []).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.carouselDot,
                  {
                    width: index === carouselIndex ? 24 : 8,
                    opacity: index === carouselIndex ? 1 : 0.4,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </Modal>

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommentModal(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.commentModalOverlay}>
            <View style={styles.commentModalContent}>
              <View style={styles.commentModalHeader}>
                <Text style={styles.commentModalTitle}>Leave a Comment</Text>
                <TouchableOpacity onPress={() => setShowCommentModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.commentInput}
                placeholder="What do you think of this build?"
                placeholderTextColor="#666"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                autoFocus
              />
              <Text style={styles.commentCharCount}>{commentText.length}/500</Text>
              <TouchableOpacity
                style={[
                  styles.commentSubmitBtn,
                  (!commentText.trim() || submittingComment) && styles.commentSubmitBtnDisabled,
                ]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.commentSubmitText}>Post Comment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    backgroundColor: '#FF5500',
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
    overflow: 'hidden',
    boxShadow: 'inset 0px 1px 20px 1px #000000',
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    textShadow: '3px 2px 3px #000000c2',
  },
  content: {
    flex: 1,
  },
  photoGallery: {
    height: 320,
    position: 'relative',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  mainPhotoContainer: {
    width: width,
    height: 320,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
    ...Platform.select({
      web: {
        objectFit: 'cover' as any,
      },
    }),
  },
  photoBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
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
    color: '#FF5500',
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
    color: '#FF5500',
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
    backgroundColor: '#FF5500',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  likeButtonLiked: {
    backgroundColor: '#E91E63',
  },
  likeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  adminSetLikesSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  adminSetLikesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(33,150,243,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.3)',
  },
  adminSetLikesText: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '600',
  },
  setLikesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setLikesInput: {
    flex: 1,
    backgroundColor: '#252525',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  setLikesSave: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setLikesCancel: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeModalButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  closeButtonBg: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenPhoto: {
    width: width,
    height: '100%',
  },
  viewPhotosButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(225, 85, 0, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  viewPhotosText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  carouselModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
  },
  carouselHeader: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  carouselTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.9,
  },
  carouselCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginHorizontal: 8,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    ...Platform.select({
      ios: {
        shadowColor: '#FF5500',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'flex-end',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  carouselPhotoNumber: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  carouselDot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5500',
  },
  photoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Comment Button
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
    marginTop: 8,
  },
  commentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Comments Section
  commentsSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  commentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  commentsSectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  commentCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF5500',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  commentAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  commentMeta: {
    flex: 1,
  },
  commentAuthor: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commentDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 1,
  },
  commentDeleteBtn: {
    padding: 6,
  },
  commentEditBtn: {
    padding: 6,
    marginRight: 2,
  },
  editCommentContainer: {
    marginTop: 8,
  },
  editCommentInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editCommentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  editCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  editCancelText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '600',
  },
  editSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#FF5500',
  },
  editSaveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  commentText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  // Comment Modal
  commentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  commentModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  commentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  commentModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  commentInput: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
  },
  commentCharCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 12,
  },
  commentSubmitBtn: {
    backgroundColor: '#FF5500',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  commentSubmitBtnDisabled: {
    opacity: 0.5,
  },
  commentSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Crew badge styles for garage detail
  crewBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  crewBadgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,231,7,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,231,7,0.25)',
  },
  crewBadgeChipText: {
    color: '#FFE707',
    fontSize: 11,
    fontWeight: '700',
  },
});
