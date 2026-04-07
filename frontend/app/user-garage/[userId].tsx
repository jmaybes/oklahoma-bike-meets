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
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { useFonts } from '@expo-google-fonts/rock-salt/useFonts';
import { RockSalt_400Regular } from '@expo-google-fonts/rock-salt/400Regular';

const API_URL = 'https://event-hub-okc-1.preview.emergentagent.com';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDESHOW_HEIGHT = 320;
const SLIDE_DURATION = 2000;
const FADE_DURATION = 800;

// Crossfade Slideshow Component
const CrossfadeSlideshow = ({ carId, photoCount }: { carId: string; photoCount: number }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const opacity1 = useSharedValue(1);
  const opacity2 = useSharedValue(0);
  const [frontIndex, setFrontIndex] = useState(0);
  const [backIndex, setBackIndex] = useState(1 % photoCount);
  const isFrontActive = useRef(true);

  // Build all photo URLs
  const photoUrls = Array.from({ length: photoCount }, (_, i) =>
    `${API_URL}/api/user-cars/${carId}/photo/${i}/image.jpg`
  );

  useEffect(() => {
    if (photoCount <= 1) return;

    const advanceSlide = () => {
      if (isFrontActive.current) {
        // Front is showing, fade to back
        const nextIdx = (backIndex + 1) % photoCount;
        opacity2.value = withTiming(1, { duration: FADE_DURATION });
        opacity1.value = withTiming(0, { duration: FADE_DURATION });
        // After fade completes, update the hidden layer
        setTimeout(() => {
          setFrontIndex(nextIdx);
          opacity1.value = 0;
          isFrontActive.current = false;
        }, FADE_DURATION + 50);
      } else {
        // Back is showing, fade to front
        const nextIdx = (frontIndex + 1) % photoCount;
        opacity1.value = withTiming(1, { duration: FADE_DURATION });
        opacity2.value = withTiming(0, { duration: FADE_DURATION });
        setTimeout(() => {
          setBackIndex(nextIdx);
          opacity2.value = 0;
          isFrontActive.current = true;
        }, FADE_DURATION + 50);
      }
    };

    const interval = setInterval(advanceSlide, SLIDE_DURATION + FADE_DURATION);
    return () => clearInterval(interval);
  }, [photoCount, frontIndex, backIndex]);

  const animStyle1 = useAnimatedStyle(() => ({
    opacity: opacity1.value,
  }));

  const animStyle2 = useAnimatedStyle(() => ({
    opacity: opacity2.value,
  }));

  if (photoCount === 0) return null;

  if (photoCount === 1) {
    return (
      <View style={slideshowStyles.container}>
        <Image source={{ uri: photoUrls[0] }} style={slideshowStyles.image} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(12,12,12,0.85)']} style={slideshowStyles.gradient} />
      </View>
    );
  }

  return (
    <View style={slideshowStyles.container}>
      {/* Back layer */}
      <Animated.View style={[slideshowStyles.layer, animStyle2]}>
        <Image source={{ uri: photoUrls[backIndex] }} style={slideshowStyles.image} resizeMode="cover" />
      </Animated.View>
      {/* Front layer */}
      <Animated.View style={[slideshowStyles.layer, animStyle1]}>
        <Image source={{ uri: photoUrls[frontIndex] }} style={slideshowStyles.image} resizeMode="cover" />
      </Animated.View>
      {/* Gradient overlay */}
      <LinearGradient colors={['transparent', 'rgba(12,12,12,0.85)']} style={slideshowStyles.gradient} />
      {/* Photo counter */}
      <View style={slideshowStyles.counter}>
        <Ionicons name="images" size={14} color="#fff" />
        <Text style={slideshowStyles.counterText}>{photoCount} photos</Text>
      </View>
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
  layer: {
    ...StyleSheet.absoluteFillObject,
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
  horsepower?: number;
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
  const { user } = useAuth();
  const isAdmin = (user as any)?.isAdmin === true;
  const [car, setCar] = useState<UserCar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);

  const [fontsLoaded] = useFonts({
    RockSalt_400Regular,
  });

  // Comments state
  const [comments, setComments] = useState<GarageComment[]>([]);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUserGarage();
    }
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
        // Fetch comments for this car
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
          <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: 'RockSalt_400Regular' }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>
            {car.ownerNickname || car.ownerName}'s Garage
          </Text>
        </View>
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
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Crossfade Photo Slideshow */}
        {(car.photoCount || 0) > 0 ? (
          <CrossfadeSlideshow carId={car.id} photoCount={car.photoCount || photos.length} />
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

          {/* View Full Gallery */}
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={() => router.push(`/garage/${car.id}`)}
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
          {(car.engine || car.horsepower || car.torque || car.transmission || car.drivetrain) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specifications</Text>
              <View style={styles.specsGrid}>
                {car.engine ? (
                  <View style={styles.specCard}>
                    <Ionicons name="speedometer" size={18} color="#FF6B35" />
                    <Text style={styles.specLabel}>Engine</Text>
                    <Text style={styles.specValue}>{car.engine}</Text>
                  </View>
                ) : null}
                {car.horsepower ? (
                  <View style={styles.specCard}>
                    <Ionicons name="flash" size={18} color="#FF6B35" />
                    <Text style={styles.specLabel}>Horsepower</Text>
                    <Text style={styles.specValue}>{car.horsepower} HP</Text>
                  </View>
                ) : null}
                {car.torque ? (
                  <View style={styles.specCard}>
                    <Ionicons name="sync" size={18} color="#FF6B35" />
                    <Text style={styles.specLabel}>Torque</Text>
                    <Text style={styles.specValue}>{car.torque} lb-ft</Text>
                  </View>
                ) : null}
                {car.transmission ? (
                  <View style={styles.specCard}>
                    <Ionicons name="cog" size={18} color="#FF6B35" />
                    <Text style={styles.specLabel}>Transmission</Text>
                    <Text style={styles.specValue}>{car.transmission}</Text>
                  </View>
                ) : null}
                {car.drivetrain ? (
                  <View style={styles.specCard}>
                    <Ionicons name="git-branch" size={18} color="#FF6B35" />
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
                  <Ionicons name="checkmark-circle" size={16} color="#FF6B35" />
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
                <Ionicons name="chatbubbles" size={20} color="#FF6B35" />
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
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
    backgroundColor: '#1a1a1a',
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
    backgroundColor: '#1a1a1a',
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
  // Comment button
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#333',
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
    backgroundColor: '#FF6B35',
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
    backgroundColor: '#FF6B35',
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
