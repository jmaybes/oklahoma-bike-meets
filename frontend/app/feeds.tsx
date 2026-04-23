import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ImageBackground,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  RefreshControl,
  Keyboard,
  StatusBar,
  Pressable,
  ScrollView,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../utils/api';
import { API_URL } from '../utils/api';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_GAP = 3;

// ====================== TYPES ======================

interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  carThumbnailUrl?: string;
  text: string;
  images: string[];
  imageCount: number;
  likes: number;
  likedBy: string[];
  commentCount: number;
  createdAt: string;
  updatedAt?: string;
  edited: boolean;
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

// ====================== HELPERS ======================

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return date.toLocaleDateString();
}

function countTextLines(text: string): number {
  const charsPerLine = Math.floor((SCREEN_WIDTH - 48) / 9);
  return text.split('\n').reduce((acc, line) => {
    return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
}

const ensureUri = (img: string) => {
  if (!img) return '';
  if (img.startsWith('data:')) return img;
  if (img.startsWith('http')) return img;
  return `data:image/jpeg;base64,${img}`;
};

// ====================== IMAGE GRID ======================

const ImageGrid = ({ images, onImagePress }: { images: string[]; onImagePress: (i: number) => void }) => {
  const w = SCREEN_WIDTH;
  if (!images || images.length === 0) return null;

  if (images.length === 1) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress(0)}>
        <Image source={{ uri: ensureUri(images[0]) }} style={{ width: w, height: w * 0.65, backgroundColor: '#e8e8e8' }} resizeMode="cover" />
      </TouchableOpacity>
    );
  }
  if (images.length === 2) {
    const iw = (w - IMAGE_GAP) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: IMAGE_GAP }}>
        {images.map((img, i) => (
          <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onImagePress(i)}>
            <Image source={{ uri: ensureUri(img) }} style={{ width: iw, height: iw * 1.1, backgroundColor: '#e8e8e8' }} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  if (images.length === 3) {
    const lw = w * 0.6;
    const rw = w - lw - IMAGE_GAP;
    const th = w * 0.65;
    const rh = (th - IMAGE_GAP) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: IMAGE_GAP, height: th }}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress(0)}>
          <Image source={{ uri: ensureUri(images[0]) }} style={{ width: lw, height: th, backgroundColor: '#e8e8e8' }} resizeMode="cover" />
        </TouchableOpacity>
        <View style={{ gap: IMAGE_GAP }}>
          {images.slice(1).map((img, i) => (
            <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onImagePress(i + 1)}>
              <Image source={{ uri: ensureUri(img) }} style={{ width: rw, height: rh, backgroundColor: '#e8e8e8' }} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }
  const iSize = (w - IMAGE_GAP) / 2;
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: IMAGE_GAP }}>
        {images.slice(0, 2).map((img, i) => (
          <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onImagePress(i)}>
            <Image source={{ uri: ensureUri(img) }} style={{ width: iSize, height: iSize * 0.75, backgroundColor: '#e8e8e8' }} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: IMAGE_GAP, marginTop: IMAGE_GAP }}>
        {images.slice(2, 4).map((img, i) => (
          <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onImagePress(i + 2)}>
            <Image source={{ uri: ensureUri(img) }} style={{ width: iSize, height: iSize * 0.75, backgroundColor: '#e8e8e8' }} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ====================== FULLSCREEN IMAGE VIEWER ======================

const ImageViewer = ({ visible, images, initialIndex, onClose }: { visible: boolean; images: string[]; initialIndex: number; onClose: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const insets = useSafeAreaInsets();
  useEffect(() => { setCurrentIndex(initialIndex); }, [initialIndex]);
  if (!visible || images.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={viewerStyles.overlay}>
        <TouchableOpacity style={[viewerStyles.closeButton, { top: insets.top + 10 }]} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Image source={{ uri: ensureUri(images[currentIndex]) }} style={viewerStyles.fullImage} resizeMode="contain" />
        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity style={[viewerStyles.arrow, viewerStyles.arrowLeft]} onPress={() => setCurrentIndex(currentIndex - 1)}>
                <Ionicons name="chevron-back" size={32} color="#fff" />
              </TouchableOpacity>
            )}
            {currentIndex < images.length - 1 && (
              <TouchableOpacity style={[viewerStyles.arrow, viewerStyles.arrowRight]} onPress={() => setCurrentIndex(currentIndex + 1)}>
                <Ionicons name="chevron-forward" size={32} color="#fff" />
              </TouchableOpacity>
            )}
            <View style={[viewerStyles.dots, { bottom: insets.bottom + 30 }]}>
              {images.map((_, i) => (<View key={i} style={[viewerStyles.dot, i === currentIndex && viewerStyles.dotActive]} />))}
            </View>
          </>
        )}
        <View style={[viewerStyles.counter, { top: insets.top + 16 }]}>
          <Text style={viewerStyles.counterText}>{currentIndex + 1} / {images.length}</Text>
        </View>
      </View>
    </Modal>
  );
};

const viewerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', right: 16, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 },
  arrow: { position: 'absolute', top: '45%', width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  arrowLeft: { left: 12 }, arrowRight: { right: 12 },
  dots: { position: 'absolute', flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#E31837', width: 20 },
  counter: { position: 'absolute', left: 20 },
  counterText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
});

// ====================== COMMENTS MODAL ======================

const CommentsModal = ({ visible, postId, onClose, userId, userName, onCommentCountChange }: {
  visible: boolean; postId: string; onClose: () => void; userId: string; userName: string; onCommentCountChange: (d: number) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { if (visible && postId) fetchComments(); }, [visible, postId]);

  const fetchComments = async () => {
    setLoading(true);
    try { const res = await api.get(`/feeds/${postId}/comments`); setComments(res.data); }
    catch (err) { console.error('Error fetching comments:', err); }
    finally { setLoading(false); }
  };

  const sendComment = async () => {
    if (!commentText.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/feeds/${postId}/comments`, { userId, userName, text: commentText.trim() });
      setComments((prev) => [...prev, res.data]);
      setCommentText('');
      onCommentCountChange(1);
      Keyboard.dismiss();
    } catch { Alert.alert('Error', 'Failed to send comment'); }
    finally { setSending(false); }
  };

  const deleteComment = async (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/feeds/${postId}/comments/${commentId}?user_id=${userId}`); setComments((prev) => prev.filter((c) => c.id !== commentId)); onCommentCountChange(-1); }
        catch { Alert.alert('Error', 'Failed to delete comment'); }
      }},
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cmtS.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[cmtS.container, { paddingBottom: insets.bottom }]}>
          <View style={cmtS.handle} />
          <View style={cmtS.header}>
            <Text style={cmtS.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={cmtS.closeBtn}><Ionicons name="close" size={22} color="#333" /></TouchableOpacity>
          </View>
          {loading ? <ActivityIndicator color="#E31837" style={{ marginTop: 40 }} /> : (
            <FlatList data={comments} keyExtractor={(item) => item.id} contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              ListEmptyComponent={<View style={{ alignItems: 'center', paddingTop: 40 }}><Ionicons name="chatbubble-outline" size={40} color="#ccc" /><Text style={cmtS.emptyText}>No comments yet</Text><Text style={cmtS.emptySubText}>Start the conversation!</Text></View>}
              renderItem={({ item }) => (
                <View style={cmtS.commentItem}>
                  <View style={cmtS.commentAvatar}><Text style={cmtS.commentAvatarText}>{item.userName?.charAt(0)?.toUpperCase() || '?'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={cmtS.commentName}>{item.userName}</Text>
                      <Text style={cmtS.commentTime}>{timeAgo(item.createdAt)}</Text>
                      {item.userId === userId && (<TouchableOpacity onPress={() => deleteComment(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="trash-outline" size={14} color="#999" /></TouchableOpacity>)}
                    </View>
                    <Text style={cmtS.commentText}>{item.text}</Text>
                  </View>
                </View>
              )}
            />
          )}
          <View style={cmtS.inputRow}>
            <TextInput style={cmtS.input} value={commentText} onChangeText={setCommentText} placeholder="Add a comment..." placeholderTextColor="#999" multiline maxLength={500} />
            <TouchableOpacity style={[cmtS.sendBtn, !commentText.trim() && { opacity: 0.4 }]} onPress={sendComment} disabled={!commentText.trim() || sending}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const cmtS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', minHeight: '50%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { color: '#141414', fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', textAlign: 'center', marginTop: 12, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: '#bbb', textAlign: 'center', marginTop: 4, fontSize: 13 },
  commentItem: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E31837', justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentName: { color: '#141414', fontWeight: '700', fontSize: 13 },
  commentTime: { color: '#999', fontSize: 11 },
  commentText: { color: '#444', fontSize: 14, lineHeight: 19, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 10 },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#141414', fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E31837', justifyContent: 'center', alignItems: 'center' },
});

// ====================== COMPOSE MODAL ======================

const ComposeModal = ({ visible, onClose, onPostCreated, user, userCarPhoto }: {
  visible: boolean; onClose: () => void; onPostCreated: (post: FeedPost) => void; user: any; userCarPhoto: string | null;
}) => {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const avatarSource = userCarPhoto ? ensureUri(userCarPhoto) : (user?.profilePic ? ensureUri(user.profilePic) : null);
  const displayName = user?.nickname || user?.name || 'User';

  const pickImages = async () => {
    const remaining = 4 - images.length;
    if (remaining <= 0) { Alert.alert('Limit Reached', 'Maximum 4 images per post.'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      const compressed: string[] = [];
      for (const asset of result.assets) {
        try {
          const m = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 1000 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
          if (m.base64) compressed.push(`data:image/jpeg;base64,${m.base64}`);
        } catch (e) { console.error('Image error:', e); }
      }
      setImages((prev) => [...prev, ...compressed].slice(0, 4));
    }
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const submitPost = async () => {
    if (!text.trim() && images.length === 0) return;
    setPosting(true);
    try {
      const res = await api.post('/feeds', {
        userId: user.id, userName: displayName,
        userAvatar: userCarPhoto || user.profilePic || null,
        text: text.trim(), images,
      });
      onPostCreated(res.data);
      setText(''); setImages([]); onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create post');
    } finally { setPosting(false); }
  };

  const handleClose = () => {
    if (text.trim() || images.length > 0) {
      Alert.alert('Discard Post?', 'Your post will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { setText(''); setImages([]); onClose(); } },
      ]);
    } else { onClose(); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[composeModalS.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        {/* Header */}
        <View style={composeModalS.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={composeModalS.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={composeModalS.title}>Create Post</Text>
          <TouchableOpacity
            style={[composeModalS.postBtn, (!text.trim() && images.length === 0) && { opacity: 0.4 }]}
            onPress={submitPost}
            disabled={(!text.trim() && images.length === 0) || posting}
          >
            {posting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={composeModalS.postBtnText}>Post</Text>}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView style={composeModalS.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* User info */}
            <View style={composeModalS.userRow}>
              {avatarSource ? (
                <Image source={{ uri: avatarSource }} style={composeModalS.avatar} />
              ) : (
                <View style={composeModalS.avatarPlaceholder}><Ionicons name="person" size={20} color="#999" /></View>
              )}
              <Text style={composeModalS.userName}>{displayName}</Text>
            </View>

            {/* Text input */}
            <TextInput
              style={composeModalS.input}
              value={text}
              onChangeText={setText}
              placeholder="Share your thoughts, build info, your current project, etc.. Please keep all posts related to automobiles."
              placeholderTextColor="#aaa"
              multiline
              maxLength={2000}
              autoFocus
              scrollEnabled={false}
            />

            {/* Image previews */}
            {images.length > 0 && (
              <View style={composeModalS.imageGrid}>
                {images.map((img, i) => (
                  <View key={i} style={composeModalS.imageWrap}>
                    <Image source={{ uri: img }} style={composeModalS.imagePreview} />
                    <TouchableOpacity style={composeModalS.imageRemove} onPress={() => removeImage(i)}>
                      <Ionicons name="close-circle" size={24} color="#FF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Bottom toolbar */}
          <View style={[composeModalS.toolbar, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={composeModalS.toolbarBtn} onPress={pickImages} disabled={images.length >= 4}>
              <Ionicons name="image" size={24} color={images.length >= 4 ? '#ccc' : '#E31837'} />
              <Text style={[composeModalS.toolbarText, images.length >= 4 && { color: '#ccc' }]}>
                Photo {images.length > 0 ? `(${images.length}/4)` : ''}
              </Text>
            </TouchableOpacity>
            <Text style={composeModalS.charCount}>{text.length}/2000</Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const composeModalS = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cancelText: { color: '#666', fontSize: 16, fontWeight: '500' },
  title: { color: '#141414', fontSize: 18, fontWeight: '700' },
  postBtn: { backgroundColor: '#E31837', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 18 },
  postBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scrollContent: { flex: 1, paddingHorizontal: 16 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#e8e8e8' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#e8e8e8', justifyContent: 'center', alignItems: 'center' },
  userName: { color: '#141414', fontSize: 16, fontWeight: '700' },
  input: { color: '#141414', fontSize: 17, lineHeight: 24, minHeight: 100, textAlignVertical: 'top', paddingBottom: 16 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  imageWrap: { position: 'relative' },
  imagePreview: { width: (SCREEN_WIDTH - 64) / 2, height: (SCREEN_WIDTH - 64) / 2 * 0.75, borderRadius: 12, backgroundColor: '#e8e8e8' },
  imageRemove: { position: 'absolute', top: -8, right: -8 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff' },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolbarText: { color: '#E31837', fontSize: 15, fontWeight: '600' },
  charCount: { color: '#bbb', fontSize: 13 },
});

// ====================== BOTTOM NAV BAR ======================

const BottomNavBar = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'ios' ? Math.max(insets.bottom, 4) : Math.max(insets.bottom, 8);

  const tabs = [
    { name: 'Events', icon: 'calendar-outline', route: '/(tabs)/home' },
    { name: 'Nearby', icon: 'location-outline', route: '/(tabs)/nearby' },
    { name: 'Clubs', icon: 'people-outline', route: '/(tabs)/clubs' },
    { name: 'Garage', icon: 'settings-outline', route: '/(tabs)/profile' },
  ];

  return (
    <LinearGradient
      colors={['#E31837', '#E31837']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[navS.container, { paddingBottom: bottomPadding, height: 50 + bottomPadding, opacity: 0.9 }]}
    >
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={navS.tab}
          onPress={() => router.replace(tab.route as any)}
          activeOpacity={0.7}
        >
          <Ionicons name={tab.icon as any} size={20} color="rgba(255,255,255,0.85)" />
          <Text style={navS.tabLabel}>{tab.name}</Text>
        </TouchableOpacity>
      ))}
    </LinearGradient>
  );
};

const navS = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
});

// ====================== MAIN FEEDS SCREEN ======================

export default function FeedsScreen() {
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [userCarPhoto, setUserCarPhoto] = useState<string | null>(null);

  // Compose modal
  const [showCompose, setShowCompose] = useState(false);

  // Edit
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editText, setEditText] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Viewer
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Comments
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);

  // Scroll animation
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 15 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const newIds = new Set(seenIdsRef.current);
    let changed = false;
    for (const item of viewableItems) {
      if (item.isViewable && item.item?.id && !seenIdsRef.current.has(item.item.id)) {
        newIds.add(item.item.id);
        changed = true;
      }
    }
    if (changed) { seenIdsRef.current = newIds; setVisibleIds(new Set(newIds)); }
  }).current;

  // Fetch user car photo
  useEffect(() => {
    if (user?.id) {
      api.get(`/user-cars/user/${user.id}`).then((res) => {
        if (res.data?.photos?.length > 0) {
          const idx = res.data.mainPhotoIndex && res.data.mainPhotoIndex < res.data.photos.length ? res.data.mainPhotoIndex : 0;
          setUserCarPhoto(res.data.photos[idx]);
        }
      }).catch(() => {});
    }
  }, [user?.id]);

  const fetchPosts = useCallback(async (skip = 0, append = false) => {
    try {
      if (!append) setLoading(true);
      const res = await api.get(`/feeds?limit=15&skip=${skip}`);
      if (append) setPosts((prev) => [...prev, ...res.data]);
      else setPosts(res.data);
      setHasMore(res.data.length === 15);
    } catch (err) { console.error('Error fetching feed:', err); }
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Refetch posts when screen gains focus (navigating back)
  useFocusEffect(
    useCallback(() => {
      fetchPosts(0, false);
    }, [fetchPosts])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true); setHasMore(true);
    seenIdsRef.current = new Set(); setVisibleIds(new Set());
    fetchPosts(0, false);
  }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true); fetchPosts(posts.length, true);
  }, [loadingMore, hasMore, posts.length, fetchPosts]);

  // Like
  const toggleLike = async (postId: string) => {
    if (!user) { Alert.alert('Login Required', 'Please log in to like posts.'); return; }
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const liked = p.likedBy.includes(user.id);
      return { ...p, likes: liked ? p.likes - 1 : p.likes + 1, likedBy: liked ? p.likedBy.filter((id) => id !== user.id) : [...p.likedBy, user.id] };
    }));
    try { await api.post(`/feeds/${postId}/like?user_id=${user.id}`); } catch { fetchPosts(); }
  };

  // Edit
  const openEdit = (post: FeedPost) => { setEditingPost(post); setEditText(post.text); setEditImages([...post.images]); setShowEditModal(true); };

  const pickEditImages = async () => {
    const remaining = 4 - editImages.length;
    if (remaining <= 0) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.8 });
    if (!result.canceled && result.assets) {
      const compressed: string[] = [];
      for (const asset of result.assets) {
        try {
          const m = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 1000 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
          if (m.base64) compressed.push(`data:image/jpeg;base64,${m.base64}`);
        } catch {}
      }
      setEditImages((prev) => [...prev, ...compressed].slice(0, 4));
    }
  };

  const saveEdit = async () => {
    if (!editingPost || !user) return;
    setSavingEdit(true);
    try {
      const res = await api.put(`/feeds/${editingPost.id}?user_id=${user.id}`, { text: editText.trim(), images: editImages });
      setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? { ...p, ...res.data } : p)));
      setShowEditModal(false); setEditingPost(null);
    } catch (err: any) { Alert.alert('Error', err?.response?.data?.detail || 'Failed to update'); }
    finally { setSavingEdit(false); }
  };

  const deletePost = (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/feeds/${postId}?user_id=${user?.id}`); setPosts((prev) => prev.filter((p) => p.id !== postId)); }
        catch { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  const openComments = (postId: string) => { setCommentsPostId(postId); setShowComments(true); };
  const handleCommentCountChange = (delta: number) => {
    if (!commentsPostId) return;
    setPosts((prev) => prev.map((p) => p.id === commentsPostId ? { ...p, commentCount: Math.max(0, p.commentCount + delta) } : p));
  };

  const openViewer = (imgs: string[], idx: number) => { setViewerImages(imgs); setViewerIndex(idx); setViewerVisible(true); };

  // ==================== ANIMATED POST CARD ====================

  const AnimatedPostCard = ({ item, isVisible }: { item: FeedPost; isVisible: boolean }) => {
    const cardOpacity = useSharedValue(0);
    const cardTranslateY = useSharedValue(50);
    const cardScale = useSharedValue(0.92);
    const contentOpacity = useSharedValue(0);
    const contentTranslateY = useSharedValue(20);
    const pressScale = useSharedValue(1);

    useEffect(() => {
      if (isVisible) {
        cardOpacity.value = withTiming(1, { duration: 400 });
        cardTranslateY.value = withTiming(0, { duration: 425 });
        cardScale.value = withTiming(1, { duration: 400 });
        contentOpacity.value = withTiming(1, { duration: 350 });
        contentTranslateY.value = withTiming(0, { duration: 375 });
      }
    }, [isVisible]);

    const cardAnim = useAnimatedStyle(() => ({ opacity: cardOpacity.value, transform: [{ translateY: cardTranslateY.value }, { scale: cardScale.value * pressScale.value }] }));
    const contentAnim = useAnimatedStyle(() => ({ opacity: contentOpacity.value, transform: [{ translateY: contentTranslateY.value }] }));

    const isOwner = user?.id === item.userId;
    const isAdminUser = (user as any)?.isAdmin === true;
    const isLiked = user ? item.likedBy.includes(user.id) : false;
    const isShortText = countTextLines(item.text) <= 2 && item.text.length <= 80;
    const avatarUri = item.carThumbnailUrl 
      ? `${API_URL}${item.carThumbnailUrl}` 
      : (item.userAvatar ? ensureUri(item.userAvatar) : null);

    return (
      <Animated.View style={cardAnim}>
        <Pressable onPressIn={() => { pressScale.value = withSpring(0.98, { damping: 15, stiffness: 200 }); }} onPressOut={() => { pressScale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}>
          <View style={s.postCard}>
            <View style={s.postHeader}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={s.avatar} /> : <View style={s.avatarPlaceholder}><Text style={s.avatarText}>{item.userName?.charAt(0)?.toUpperCase() || '?'}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.userName}>{item.userName}</Text>
                <Text style={s.postTime}>{timeAgo(item.createdAt)}{item.edited ? ' · edited' : ''}</Text>
              </View>
              {(isOwner || isAdminUser) && <TouchableOpacity style={s.moreBtn} onPress={() => {
                const options: any[] = [];
                if (isOwner) options.push({ text: 'Edit', onPress: () => openEdit(item) });
                options.push({ text: 'Delete', style: 'destructive', onPress: () => deletePost(item.id) });
                options.push({ text: 'Cancel', style: 'cancel' });
                Alert.alert('Post Options', '', options);
              }}><Ionicons name="ellipsis-horizontal" size={20} color="#999" /></TouchableOpacity>}
            </View>

            <Animated.View style={contentAnim}>
              {item.text ? <Text style={[s.postText, isShortText && s.postTextLarge]}>{item.text}</Text> : null}
            </Animated.View>

            {item.images?.length > 0 && <View style={{ marginTop: 2 }}><ImageGrid images={item.images} onImagePress={(i) => openViewer(item.images, i)} /></View>}

            <Animated.View style={[s.actionsRow, contentAnim]}>
              <TouchableOpacity style={s.actionBtn} onPress={() => toggleLike(item.id)} activeOpacity={0.7}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? '#FF4444' : '#999'} />
                {item.likes > 0 && <Text style={[s.actionCount, isLiked && { color: '#FF4444' }]}>{item.likes}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.commentActionBtn} onPress={() => openComments(item.id)} activeOpacity={0.7}>
                <Ionicons name="chatbubble-outline" size={20} color="#E31837" />
                <Text style={s.commentActionText}>{item.commentCount > 0 ? `${item.commentCount} Comment${item.commentCount > 1 ? 's' : ''}` : 'Comment'}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderPost = useCallback(({ item }: { item: FeedPost }) => (
    <AnimatedPostCard item={item} isVisible={visibleIds.has(item.id)} />
  ), [user, visibleIds]);

  // ==================== COMPOSE TRIGGER (inline) ====================

  const ComposeTrigger = () => {
    const avatarSource = userCarPhoto ? ensureUri(userCarPhoto) : (user?.profilePic ? ensureUri(user.profilePic) : null);
    return (
      <TouchableOpacity style={s.composeTrigger} onPress={() => setShowCompose(true)} activeOpacity={0.8}>
        {avatarSource ? <Image source={{ uri: avatarSource }} style={s.triggerAvatar} /> : <View style={s.triggerAvatarPlaceholder}><Ionicons name="person" size={16} color="#999" /></View>}
        <Text style={s.triggerText}>Share your thoughts...</Text>
        <View style={s.triggerPhotoBtn}><Ionicons name="image" size={18} color="#E31837" /></View>
      </TouchableOpacity>
    );
  };

  // ==================== AUTH SCREEN ====================

  if (!isAuthenticated) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={['#E31837', '#E31837']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={s.headerTitle}>Community Lounge</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={s.authPrompt}>
          <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
          <Text style={s.authTitle}>Join the Conversation</Text>
          <Text style={s.authSub}>Log in to view and create posts</Text>
          <TouchableOpacity style={s.authButton} onPress={() => router.push('/auth/login')}><Text style={s.authButtonText}>Log In</Text></TouchableOpacity>
        </View>
        <BottomNavBar />
      </View>
    );
  }

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const scrollY = useSharedValue(0);
  const parallaxScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, 1000], [0, -300], Extrapolation.CLAMP) },
    ],
  }));

  // ==================== MAIN RENDER ====================

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Parallax Background Image */}
      <Animated.Image
        source={require('../assets/images/lounge-bg.png')}
        style={[{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT + 300,
          opacity: 0.6,
        }, parallaxStyle]}
        resizeMode="cover"
      />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['rgba(255,107,53,0.9)', 'rgba(233,30,99,0.9)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.headerBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={s.headerTitle}>Community Lounge</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <Animated.FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={ComposeTrigger}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={parallaxScrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E31837" colors={['#E31837']} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#E31837" style={{ marginVertical: 20 }} /> : null}
        ListEmptyComponent={!loading ? (
          <View style={s.emptyContainer}>
            <Ionicons name="newspaper-outline" size={48} color="#ccc" />
            <Text style={s.emptyTitle}>No posts yet</Text>
            <Text style={s.emptySub}>Be the first to share something with the community!</Text>
          </View>
        ) : null}
        initialNumToRender={5} maxToRenderPerBatch={5} windowSize={7}
      />

      {loading && posts.length === 0 && <View style={s.loadingOverlay}><ActivityIndicator size="large" color="#E31837" /></View>}

      <BottomNavBar />

      {/* Modals */}
      <ComposeModal visible={showCompose} onClose={() => setShowCompose(false)} onPostCreated={(post) => setPosts((prev) => [post, ...prev])} user={user} userCarPhoto={userCarPhoto} />

      <ImageViewer visible={viewerVisible} images={viewerImages} initialIndex={viewerIndex} onClose={() => setViewerVisible(false)} />

      {showComments && commentsPostId && (
        <CommentsModal visible={showComments} postId={commentsPostId}
          onClose={() => { setShowComments(false); setCommentsPostId(null); }}
          userId={user?.id || ''} userName={user?.nickname || user?.name || 'User'}
          onCommentCountChange={handleCommentCountChange}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={[composeModalS.container, { paddingTop: insets.top }]}>
          <View style={composeModalS.header}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}><Text style={composeModalS.cancelText}>Cancel</Text></TouchableOpacity>
            <Text style={composeModalS.title}>Edit Post</Text>
            <TouchableOpacity style={composeModalS.postBtn} onPress={saveEdit} disabled={savingEdit}>
              {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={composeModalS.postBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView style={composeModalS.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput style={composeModalS.input} value={editText} onChangeText={setEditText} multiline maxLength={2000} placeholder="What's on your mind?" placeholderTextColor="#aaa" scrollEnabled={false} />
              {editImages.length > 0 && (
                <View style={composeModalS.imageGrid}>
                  {editImages.map((img, i) => (
                    <View key={i} style={composeModalS.imageWrap}>
                      <Image source={{ uri: ensureUri(img) }} style={composeModalS.imagePreview} />
                      <TouchableOpacity style={composeModalS.imageRemove} onPress={() => setEditImages((prev) => prev.filter((_, idx) => idx !== i))}>
                        <Ionicons name="close-circle" size={24} color="#FF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ height: 120 }} />
            </ScrollView>
            <View style={[composeModalS.toolbar, { paddingBottom: insets.bottom + 8 }]}>
              <TouchableOpacity style={composeModalS.toolbarBtn} onPress={pickEditImages} disabled={editImages.length >= 4}>
                <Ionicons name="image" size={24} color={editImages.length >= 4 ? '#ccc' : '#E31837'} />
                <Text style={[composeModalS.toolbarText, editImages.length >= 4 && { color: '#ccc' }]}>Photo ({editImages.length}/4)</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

// ====================== MAIN STYLES ======================

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  listContent: { paddingBottom: 20 },

  // Compose trigger
  composeTrigger: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 8, borderBottomColor: '#ebebeb', gap: 12 },
  triggerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e8e8e8' },
  triggerAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e8e8e8', justifyContent: 'center', alignItems: 'center' },
  triggerText: { flex: 1, color: '#aaa', fontSize: 15 },
  triggerPhotoBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF3ED', justifyContent: 'center', alignItems: 'center' },

  // Post Card
  postCard: { backgroundColor: 'rgba(255, 255, 255, 0.8)', borderTopWidth: 1, borderTopColor: '#ccc', borderBottomWidth: 1, borderBottomColor: '#ccc', marginBottom: 8 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#e8e8e8' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#E31837', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  userName: { color: '#141414', fontSize: 15, fontWeight: '700' },
  postTime: { color: '#999', fontSize: 12, marginTop: 1 },
  moreBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  postText: { color: '#333', fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingBottom: 8 },
  postTextLarge: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: '#141414' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  actionCount: { color: '#999', fontSize: 14, fontWeight: '600' },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#FFF3ED', borderRadius: 16 },
  commentActionText: { color: '#E31837', fontSize: 13, fontWeight: '600' },

  // Empty / Auth
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { color: '#999', fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { color: '#bbb', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  authPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  authTitle: { color: '#141414', fontSize: 22, fontWeight: '800', marginTop: 20 },
  authSub: { color: '#999', fontSize: 15, marginTop: 8 },
  authButton: { backgroundColor: '#E31837', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 25, marginTop: 24 },
  authButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f2f2f2' },
});
