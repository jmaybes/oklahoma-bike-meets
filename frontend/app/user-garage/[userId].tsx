import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useFonts, RockSalt_400Regular } from '@expo-google-fonts/rock-salt';

import { API_URL } from '../../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDESHOW_HEIGHT = 320;

// Static Photo Display Component (no animation)
const CrossfadeSlideshow = ({ carId, photoCount }: { carId: string; photoCount: number }) => {
  // Build all photo URLs
  const photoUrls = Array.from({ length: photoCount }, (_, i) =>
    `${API_URL}/api/user-cars/${carId}/photo/${i}/image.jpg`
  );

  if (photoCount === 0) return null;

  return (
    <View style={slideshowStyles.container}>
      <Image source={{ uri: photoUrls[0] }} style={slideshowStyles.image} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(12,12,12,0.85)']} style={slideshowStyles.gradient} />
      {photoCount > 1 && (
        <View style={slideshowStyles.counter}>
          <Ionicons name="images" size={14} color="#fff" />
          <Text style={slideshowStyles.counterText}>{photoCount} photos</Text>
        </View>
      )}
    </View>
  );
};

const slideshowStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SLIDESHOW_HEIGHT,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  counter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

interface UserCar {
  id: string;
  userId: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  engine?: string;
  displacement?: number;
  torque?: number;
  transmission?: string;
  drivetrain?: string;
  description: string;
  modifications: any[];
  modificationNotes?: string;
  instagramHandle?: string;
  youtubeChannel?: string;
  photos: string[];
  photoCount: number;
  isPublic: boolean;
  likes: number;
  likedBy: string[];
  views: number;
  ownerName: string;
  ownerNickname: string;
}

interface CarSummary {
  id: string;
  userId: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  thumbnailUrl: string;
  isActive: boolean;
  photoCount: number;
  likes: number;
  views: number;
  ownerName: string;
  ownerNickname: string;
}

interface GarageComment {
  id: string;
  carId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export default function UserGarageScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const isAdmin = (user as any)?.isAdmin === true;
  const [car, setCar] = useState<UserCar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);

  const [fontsLoaded] = useFonts({
    RockSalt_400Regular,
  });

  // Multi-car state
  const [allCars, setAllCars] = useState<CarSummary[]>([]);
  const [showCarSelectionModal, setShowCarSelectionModal] = useState(false);

  // Comments state
  const [comments, setComments] = useState<GarageComment[]>([]);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Crew state
  const [userCrews, setUserCrews] = useState<any[]>([]);
  const [myCreatedCrew, setMyCreatedCrew] = useState<any>(null);
  const [inviteSending, setInviteSending] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchAllCarsAndDecide();
      fetchUserCrews();
      fetchMyCreatedCrew();
    }
  }, [userId]);

  const fetchUserCrews = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/crews/user/${userId}`);
      setUserCrews(res.data || []);
    } catch (err) {
      console.error('Error fetching user crews:', err);
    }
  };

  const fetchMyCreatedCrew = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API_URL}/api/crews/created/${user.id}`);
      setMyCreatedCrew(res.data);
    } catch (err) {
      console.error('Error fetching my crew:', err);
    }
  };

  const handleInviteToCrew = async () => {
    if (!user?.id || !myCreatedCrew) {
      Alert.alert('No Crew', 'You need to create a crew first before inviting others.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create Crew', onPress: () => router.push('/crews/create') },
      ]);
      return;
    }
    setInviteSending(true);
    try {
      await axios.post(
        `${API_URL}/api/crews/${myCreatedCrew.id}/invite/${userId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Invite Sent! 🏎️', `Invited to join "${myCreatedCrew.name}"`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to send invite';
      Alert.alert('Error', msg);
    } finally {
      setInviteSending(false);
    }
  };

  const fetchAllCarsAndDecide = async () => {
    try {
      setLoading(true);
      setError(null);
      // First, fetch all cars for this user
      const allRes = await axios.get(`${API_URL}/api/user-cars/user/${userId}/all`);
      const cars: CarSummary[] = allRes.data || [];
      setAllCars(cars);

      if (cars.length === 0) {
        setError('no_garage');
        setLoading(false);
        return;
      }

      if (cars.length > 1) {
        // Multiple cars — show the selection modal
        setShowCarSelectionModal(true);
        setLoading(false);
        return;
      }

      // Single car — load it directly
      await loadCarById(cars[0].id);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('no_garage');
      } else {
        setError('error');
      }
      setLoading(false);
    }
  };

  const loadCarById = async (carId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/user-cars/${carId}`);
      if (response.data) {
        setCar(response.data);
        if (user?.id && response.data.likedBy) {
          setIsLiked(response.data.likedBy.includes(user.id));
        }
        fetchComments(response.data.id);
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

  const handleCarSelection = (carId: string) => {
    setShowCarSelectionModal(false);
    loadCarById(carId);
  };

  const fetchComments = async (carId: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/garage-comments/${carId}`);
      setComments(response.data);
    } catch (err) {
      console.log('Failed to fetch comments:', err);
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !car) return;
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await axios.post(`${API_URL}/api/garage-comments`, {
        carId: car.id,
        userId: user.id,
        userName: (user as any).nickname || user.name,
        text: commentText.trim(),
      });
      setCommentText('');
      setShowCommentModal(false);
      fetchComments(car.id);
      Alert.alert('Comment Posted', 'Your comment has been added!');
    } catch (err) {
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
            if (car) fetchComments(car.id);
          } catch (err) {
            Alert.alert('Error', 'Failed to delete comment.');
          }
        }
      }
    ]);
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

  if (loading && !showCarSelectionModal) {
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
          <ActivityIndicator size="large" color="#E31837" />
        </View>
      </View>
    );
  }

  // Show car selection modal when multiple cars exist and none selected yet
  if (showCarSelectionModal && !car) {
    const ownerName = allCars.length > 0 ? (allCars[0].ownerNickname || allCars[0].ownerName) : 'User';
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{ownerName}'s Garage</Text>
          <View style={{ width: 40 }} />
        </View>

        <Modal
          visible={showCarSelectionModal}
          transparent
          animationType="fade"
          onRequestClose={() => router.back()}
          statusBarTranslucent
        >
          <View style={carPickerStyles.overlay}>
            <View style={carPickerStyles.container}>
              {/* Header */}
              <View style={carPickerStyles.header}>
                <View style={carPickerStyles.headerIcon}>
                  <Ionicons name="bicycle" size={28} color="#E31837" />
                </View>
                <Text style={carPickerStyles.title}>Choose a Ride</Text>
                <Text style={carPickerStyles.subtitle}>
                  {ownerName} has {allCars.length} cars in their garage
                </Text>
              </View>

              {/* Car Cards */}
              <View style={carPickerStyles.carList}>
                {allCars.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={carPickerStyles.carCard}
                    onPress={() => handleCarSelection(c.id)}
                    activeOpacity={0.7}
                  >
                    {/* Thumbnail */}
                    <View style={carPickerStyles.thumbContainer}>
                      {c.thumbnailUrl ? (
                        <Image
                          source={{ uri: c.thumbnailUrl }}
                          style={carPickerStyles.thumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={carPickerStyles.thumbPlaceholder}>
                          <Ionicons name="bicycle" size={32} color="#555" />
                        </View>
                      )}
                      {c.isActive && (
                        <View style={carPickerStyles.activeBadge}>
                          <Ionicons name="star" size={10} color="#fff" />
                          <Text style={carPickerStyles.activeBadgeText}>Active</Text>
                        </View>
                      )}
                    </View>

                    {/* Car Info */}
                    <View style={carPickerStyles.carInfo}>
                      <Text style={carPickerStyles.carName} numberOfLines={1}>
                        {c.year} {c.make} {c.model}
                      </Text>
                      {c.trim ? (
                        <Text style={carPickerStyles.carTrim} numberOfLines={1}>{c.trim}</Text>
                      ) : null}
                      <View style={carPickerStyles.carStats}>
                        <View style={carPickerStyles.statChip}>
                          <Ionicons name="images-outline" size={12} color="#999" />
                          <Text style={carPickerStyles.statChipText}>{c.photoCount}</Text>
                        </View>
                        <View style={carPickerStyles.statChip}>
                          <Ionicons name="heart-outline" size={12} color="#999" />
                          <Text style={carPickerStyles.statChipText}>{c.likes}</Text>
                        </View>
                        <View style={carPickerStyles.statChip}>
                          <Ionicons name="eye-outline" size={12} color="#999" />
                          <Text style={carPickerStyles.statChipText}>{c.views}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Arrow */}
                    <Ionicons name="chevron-forward" size={22} color="#555" />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Close button */}
              <TouchableOpacity
                style={carPickerStyles.closeBtn}
                onPress={() => router.back()}
              >
                <Text style={carPickerStyles.closeBtnText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
          <Ionicons name="bicycle-outline" size={64} color="#444" />
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
        colors={['#FFE707', '#E31837']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: 'RockSalt_400Regular' }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>
            {car.ownerNickname || car.ownerName}'s Garage
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {allCars.length > 1 && (
            <TouchableOpacity
              onPress={() => setShowCarSelectionModal(true)}
              style={styles.switchCarBtn}
            >
              <Ionicons name="swap-horizontal" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push(`/messages/${car.userId}`)}
            style={styles.messageBtn}
          >
            <Image 
              source={require('../../assets/images/message-icon.png')} 
              style={{ width: 22, height: 22 }} 
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Crew Badges - shown at top of public garage */}
      {userCrews.length > 0 && (
        <View style={styles.crewBadgesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crewBadgesScroll}>
            {userCrews.map((crew) => (
              <TouchableOpacity
                key={crew.id}
                style={styles.crewBadge}
                onPress={() => router.push(`/crews/${crew.id}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="people" size={12} color="#FFE707" />
                <Text style={styles.crewBadgeText}>{crew.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Invite to Crew Button (shown when viewing someone else's garage) */}
      {user && user.id !== userId && (
        <TouchableOpacity
          style={styles.inviteCrewBtn}
          onPress={handleInviteToCrew}
          disabled={inviteSending}
          activeOpacity={0.8}
        >
          {inviteSending ? (
            <ActivityIndicator size="small" color="#FFE707" />
          ) : (
            <>
              <Ionicons name="person-add" size={16} color="#FFE707" />
              <Text style={styles.inviteCrewBtnText}>Invite to Crew</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Crossfade Photo Slideshow */}
        {(car.photoCount || 0) > 0 ? (
          <CrossfadeSlideshow carId={car.id} photoCount={car.photoCount || photos.length} />
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="bicycle" size={48} color="#444" />
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
                color={isLiked ? '#E31837' : '#888'}
              />
              <Text style={[styles.likeCount, isLiked && { color: '#E31837' }]}>
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

          {/* View Full Gallery */}
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={() => router.push(`/garage/${car.id}?showPhotos=true`)}
          >
            <Ionicons name="images" size={20} color="#fff" />
            <Text style={styles.galleryButtonText}>View Full Gallery</Text>
          </TouchableOpacity>

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

          {/* Specifications */}
          {(car.engine || car.displacement || car.torque || car.transmission || car.drivetrain) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specifications</Text>
              <View style={styles.specsGrid}>
                {car.engine ? (
                  <View style={styles.specCard}>
                    <Ionicons name="speedometer" size={18} color="#E31837" />
                    <Text style={styles.specLabel}>Engine</Text>
                    <Text style={styles.specValue}>{car.engine}</Text>
                  </View>
                ) : null}
                {car.displacement ? (
                  <View style={styles.specCard}>
                    <Ionicons name="flash" size={18} color="#E31837" />
                    <Text style={styles.specLabel}>Displacement</Text>
                    <Text style={styles.specValue}>{car.displacement} CC</Text>
                  </View>
                ) : null}
                {car.torque ? (
                  <View style={styles.specCard}>
                    <Ionicons name="sync" size={18} color="#E31837" />
                    <Text style={styles.specLabel}>Torque</Text>
                    <Text style={styles.specValue}>{car.torque} lb-ft</Text>
                  </View>
                ) : null}
                {car.transmission ? (
                  <View style={styles.specCard}>
                    <Ionicons name="cog" size={18} color="#E31837" />
                    <Text style={styles.specLabel}>Transmission</Text>
                    <Text style={styles.specValue}>{car.transmission}</Text>
                  </View>
                ) : null}
                {car.drivetrain ? (
                  <View style={styles.specCard}>
                    <Ionicons name="git-branch" size={18} color="#E31837" />
                    <Text style={styles.specLabel}>Drivetrain</Text>
                    <Text style={styles.specValue}>{car.drivetrain}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* Description */}
          {car.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About This Build</Text>
              <Text style={styles.description}>{car.description}</Text>
            </View>
          ) : null}

          {/* Modifications / Build Details */}
          {((car.modifications && car.modifications.length > 0) || car.modificationNotes) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {car.modifications && car.modifications.length > 0 ? 'Modifications' : 'Build Details'}
              </Text>
              {car.modifications && car.modifications.length > 0 && car.modifications.map((mod: any, idx: number) => (
                <View key={idx} style={styles.modRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#E31837" />
                  <Text style={styles.modText}>
                    {typeof mod === 'string' ? mod : `${mod.brand ? mod.brand + ' ' : ''}${mod.name || ''}`}
                  </Text>
                </View>
              ))}
              {car.modificationNotes ? (
                <View style={styles.modNotesBox}>
                  <Text style={styles.modNotesText}>{car.modificationNotes}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Comments Section */}
          {comments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.commentsSectionHeader}>
                <Ionicons name="chatbubbles" size={20} color="#E31837" />
                <Text style={styles.sectionTitle}>Comments ({comments.length})</Text>
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
                      <Text style={styles.commentDate}>{formatCommentDate(comment.createdAt)}</Text>
                    </View>
                    {user && (user.id === comment.userId || isAdmin) && (
                      <TouchableOpacity
                        style={styles.commentDeleteBtn}
                        onPress={() => handleDeleteComment(comment.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Car Selection Modal (for switching between cars) */}
      {allCars.length > 1 && (
        <Modal
          visible={showCarSelectionModal && !!car}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCarSelectionModal(false)}
          statusBarTranslucent
        >
          <View style={carPickerStyles.overlay}>
            <View style={carPickerStyles.container}>
              <View style={carPickerStyles.header}>
                <View style={carPickerStyles.headerIcon}>
                  <Ionicons name="bicycle" size={28} color="#E31837" />
                </View>
                <Text style={carPickerStyles.title}>Switch Ride</Text>
                <Text style={carPickerStyles.subtitle}>
                  Viewing {car?.ownerNickname || car?.ownerName}'s garage
                </Text>
              </View>

              <View style={carPickerStyles.carList}>
                {allCars.map((c) => {
                  const isCurrentCar = car?.id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[carPickerStyles.carCard, isCurrentCar && carPickerStyles.carCardSelected]}
                      onPress={() => {
                        if (!isCurrentCar) handleCarSelection(c.id);
                        else setShowCarSelectionModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={carPickerStyles.thumbContainer}>
                        {c.thumbnailUrl ? (
                          <Image
                            source={{ uri: c.thumbnailUrl }}
                            style={carPickerStyles.thumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={carPickerStyles.thumbPlaceholder}>
                            <Ionicons name="bicycle" size={32} color="#555" />
                          </View>
                        )}
                        {isCurrentCar && (
                          <View style={[carPickerStyles.activeBadge, { backgroundColor: '#E31837' }]}>
                            <Ionicons name="eye" size={10} color="#fff" />
                            <Text style={carPickerStyles.activeBadgeText}>Viewing</Text>
                          </View>
                        )}
                      </View>
                      <View style={carPickerStyles.carInfo}>
                        <Text style={carPickerStyles.carName} numberOfLines={1}>
                          {c.year} {c.make} {c.model}
                        </Text>
                        {c.trim ? (
                          <Text style={carPickerStyles.carTrim} numberOfLines={1}>{c.trim}</Text>
                        ) : null}
                        <View style={carPickerStyles.carStats}>
                          <View style={carPickerStyles.statChip}>
                            <Ionicons name="images-outline" size={12} color="#999" />
                            <Text style={carPickerStyles.statChipText}>{c.photoCount}</Text>
                          </View>
                          <View style={carPickerStyles.statChip}>
                            <Ionicons name="heart-outline" size={12} color="#999" />
                            <Text style={carPickerStyles.statChipText}>{c.likes}</Text>
                          </View>
                        </View>
                      </View>
                      <Ionicons name={isCurrentCar ? 'checkmark-circle' : 'chevron-forward'} size={22} color={isCurrentCar ? '#E31837' : '#555'} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={carPickerStyles.closeBtn}
                onPress={() => setShowCarSelectionModal(false)}
              >
                <Text style={carPickerStyles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommentModal(false)}
        statusBarTranslucent
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
      </Modal>
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
    overflow: 'hidden',
    boxShadow: 'inset 0px 1px 20px 1px #000000',
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
    flex: 1,
    textAlign: 'center',
    textShadow: '3px 2px 3px #000000c2',
  },
  messageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchCarBtn: {
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
    backgroundColor: '#141414',
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
    color: '#E31837',
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
    marginTop: 8,
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
  // Specs grid
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  specCard: {
    backgroundColor: '#141414',
    borderRadius: 10,
    padding: 12,
    width: '47%',
    borderWidth: 1,
    borderColor: '#252525',
  },
  specLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 6,
  },
  specValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  // Mods
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  modNotesBox: {
    backgroundColor: '#141414',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#252525',
  },
  modNotesText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
  },
  // Gallery button
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E31837',
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
  // Comment button
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  commentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Comments section
  commentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentCard: {
    backgroundColor: '#141414',
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
    backgroundColor: '#E31837',
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
  commentText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  // Comment modal
  commentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  commentModalContent: {
    backgroundColor: '#141414',
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
    borderColor: '#2A2A2A',
  },
  commentCharCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 12,
  },
  commentSubmitBtn: {
    backgroundColor: '#E31837',
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
});


const carPickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(225, 85, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  carList: {
    gap: 12,
  },
  carCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  carCardSelected: {
    borderColor: '#E31837',
    backgroundColor: 'rgba(225, 85, 0, 0.08)',
  },
  thumbContainer: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  activeBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  carInfo: {
    flex: 1,
    marginLeft: 12,
  },
  carName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  carTrim: {
    fontSize: 13,
    color: '#E31837',
    fontWeight: '600',
    marginTop: 2,
  },
  carStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statChipText: {
    fontSize: 12,
    color: '#999',
  },
  closeBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#333',
  },
  closeBtnText: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '600',
  },
  // Crew badge styles
  crewBadgesContainer: {
    backgroundColor: '#111',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  crewBadgesScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  crewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,231,7,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,231,7,0.25)',
  },
  crewBadgeText: {
    color: '#FFE707',
    fontSize: 12,
    fontWeight: '700',
  },
  inviteCrewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,231,7,0.1)',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,231,7,0.2)',
  },
  inviteCrewBtnText: {
    color: '#FFE707',
    fontSize: 13,
    fontWeight: '700',
  },
});
