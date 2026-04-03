import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_GAP = 4;

// ====================== TYPES ======================

interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
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
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString();
}

function countTextLines(text: string): number {
  // Rough heuristic: count newlines + wrap estimate
  const newlines = (text.match(/\n/g) || []).length + 1;
  // Estimate chars per line based on screen width (~40 chars per line at normal size)
  const charsPerLine = Math.floor((SCREEN_WIDTH - 80) / 9);
  const wrappedLines = text.split('\n').reduce((acc, line) => {
    return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
  return Math.max(newlines, wrappedLines);
}

// ====================== IMAGE GRID COMPONENT ======================

const ImageGrid = ({
  images,
  onImagePress,
}: {
  images: string[];
  onImagePress: (index: number) => void;
}) => {
  const containerWidth = SCREEN_WIDTH - 40; // 20px padding each side

  if (images.length === 0) return null;

  const ensureUri = (img: string) => {
    if (img.startsWith('data:')) return img;
    return `data:image/jpeg;base64,${img}`;
  };

  if (images.length === 1) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onImagePress(0)}
        style={[gridStyles.container, { width: containerWidth }]}
      >
        <Image
          source={{ uri: ensureUri(images[0]) }}
          style={[gridStyles.singleImage, { width: containerWidth, height: containerWidth * 0.65 }]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  if (images.length === 2) {
    const imgWidth = (containerWidth - IMAGE_GAP) / 2;
    return (
      <View style={[gridStyles.container, gridStyles.row, { width: containerWidth }]}>
        {images.map((img, i) => (
          <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onImagePress(i)}>
            <Image
              source={{ uri: ensureUri(img) }}
              style={[gridStyles.halfImage, { width: imgWidth, height: imgWidth * 1.1 }]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (images.length === 3) {
    const leftWidth = containerWidth * 0.6;
    const rightWidth = containerWidth - leftWidth - IMAGE_GAP;
    const rightHeight = (containerWidth * 0.65 - IMAGE_GAP) / 2;
    return (
      <View style={[gridStyles.container, gridStyles.row, { width: containerWidth, height: containerWidth * 0.65 }]}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress(0)}>
          <Image
            source={{ uri: ensureUri(images[0]) }}
            style={{ width: leftWidth, height: containerWidth * 0.65, borderRadius: 10 }}
            resizeMode="cover"
          />
        </TouchableOpacity>
        <View style={{ gap: IMAGE_GAP }}>
          {images.slice(1).map((img, i) => (
            <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onImagePress(i + 1)}>
              <Image
                source={{ uri: ensureUri(img) }}
                style={{ width: rightWidth, height: rightHeight, borderRadius: 10 }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // 4 images: 2x2 grid
  const imgSize = (containerWidth - IMAGE_GAP) / 2;
  return (
    <View style={[gridStyles.container, { width: containerWidth }]}>
      <View style={[gridStyles.row, { gap: IMAGE_GAP }]}>
        {images.slice(0, 2).map((img, i) => (
          <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onImagePress(i)}>
            <Image
              source={{ uri: ensureUri(img) }}
              style={{ width: imgSize, height: imgSize * 0.75, borderRadius: 10 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
      <View style={[gridStyles.row, { gap: IMAGE_GAP, marginTop: IMAGE_GAP }]}>
        {images.slice(2, 4).map((img, i) => (
          <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onImagePress(i + 2)}>
            <Image
              source={{ uri: ensureUri(img) }}
              style={{ width: imgSize, height: imgSize * 0.75, borderRadius: 10 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const gridStyles = StyleSheet.create({
  container: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: IMAGE_GAP,
  },
  singleImage: {
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
  },
  halfImage: {
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
  },
});

// ====================== FULLSCREEN IMAGE VIEWER ======================

const ImageViewer = ({
  visible,
  images,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const ensureUri = (img: string) => {
    if (img.startsWith('data:')) return img;
    return `data:image/jpeg;base64,${img}`;
  };

  if (!visible || images.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={viewerStyles.overlay}>
        <TouchableOpacity
          style={[viewerStyles.closeButton, { top: insets.top + 10 }]}
          onPress={onClose}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <Image
          source={{ uri: ensureUri(images[currentIndex]) }}
          style={viewerStyles.fullImage}
          resizeMode="contain"
        />

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[viewerStyles.arrow, viewerStyles.arrowLeft]}
                onPress={() => setCurrentIndex(currentIndex - 1)}
              >
                <Ionicons name="chevron-back" size={32} color="#fff" />
              </TouchableOpacity>
            )}
            {currentIndex < images.length - 1 && (
              <TouchableOpacity
                style={[viewerStyles.arrow, viewerStyles.arrowRight]}
                onPress={() => setCurrentIndex(currentIndex + 1)}
              >
                <Ionicons name="chevron-forward" size={32} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Dot indicators */}
            <View style={[viewerStyles.dots, { bottom: insets.bottom + 30 }]}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[viewerStyles.dot, i === currentIndex && viewerStyles.dotActive]}
                />
              ))}
            </View>
          </>
        )}

        {/* Counter */}
        <View style={[viewerStyles.counter, { top: insets.top + 16 }]}>
          <Text style={viewerStyles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const viewerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  arrow: {
    position: 'absolute',
    top: '45%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowLeft: {
    left: 12,
  },
  arrowRight: {
    right: 12,
  },
  dots: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#FF6B35',
    width: 20,
  },
  counter: {
    position: 'absolute',
    left: 20,
  },
  counterText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
});

// ====================== COMMENTS MODAL ======================

const CommentsModal = ({
  visible,
  postId,
  onClose,
  userId,
  userName,
  onCommentCountChange,
}: {
  visible: boolean;
  postId: string;
  onClose: () => void;
  userId: string;
  userName: string;
  onCommentCountChange: (delta: number) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible && postId) {
      fetchComments();
    }
  }, [visible, postId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/feeds/${postId}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendComment = async () => {
    if (!commentText.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/feeds/${postId}/comments`, {
        userId,
        userName,
        text: commentText.trim(),
      });
      setComments((prev) => [...prev, res.data]);
      setCommentText('');
      onCommentCountChange(1);
      Keyboard.dismiss();
    } catch (err) {
      Alert.alert('Error', 'Failed to send comment');
    } finally {
      setSending(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/feeds/${postId}/comments/${commentId}?user_id=${userId}`);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            onCommentCountChange(-1);
          } catch {
            Alert.alert('Error', 'Failed to delete comment');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={commentStyles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[commentStyles.container, { paddingBottom: insets.bottom }]}
        >
          {/* Header */}
          <View style={commentStyles.header}>
            <Text style={commentStyles.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={commentStyles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {loading ? (
            <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              ListEmptyComponent={
                <Text style={commentStyles.emptyText}>
                  No comments yet. Be the first!
                </Text>
              }
              renderItem={({ item }) => (
                <View style={commentStyles.commentItem}>
                  <View style={commentStyles.commentHeader}>
                    <View style={commentStyles.commentAvatar}>
                      <Text style={commentStyles.commentAvatarText}>
                        {item.userName?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={commentStyles.commentName}>{item.userName}</Text>
                      <Text style={commentStyles.commentTime}>{timeAgo(item.createdAt)}</Text>
                    </View>
                    {item.userId === userId && (
                      <TouchableOpacity
                        onPress={() => deleteComment(item.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={commentStyles.commentText}>{item.text}</Text>
                </View>
              )}
            />
          )}

          {/* Comment Input */}
          <View style={commentStyles.inputRow}>
            <TextInput
              style={commentStyles.input}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write a comment..."
              placeholderTextColor="#666"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[commentStyles.sendBtn, !commentText.trim() && { opacity: 0.4 }]}
              onPress={sendComment}
              disabled={!commentText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const commentStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  commentItem: {
    marginBottom: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  commentName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  commentTime: {
    color: '#666',
    fontSize: 11,
  },
  commentText: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 42,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ====================== MAIN FEEDS SCREEN ======================

export default function FeedsScreen() {
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  // Feed state
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Compose state
  const [composeText, setComposeText] = useState('');
  const [composeImages, setComposeImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  // Edit state
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editText, setEditText] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Image viewer
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Comments
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);

  // ==================== API CALLS ====================

  const fetchPosts = useCallback(async (skip = 0, append = false) => {
    try {
      if (!append) setLoading(true);
      const res = await api.get(`/feeds?limit=15&skip=${skip}`);
      const newPosts = res.data;
      if (append) {
        setPosts((prev) => [...prev, ...newPosts]);
      } else {
        setPosts(newPosts);
      }
      setHasMore(newPosts.length === 15);
    } catch (err) {
      console.error('Error fetching feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    fetchPosts(0, false);
  }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPosts(posts.length, true);
  }, [loadingMore, hasMore, posts.length, fetchPosts]);

  // ==================== CREATE POST ====================

  const pickImages = async (target: 'compose' | 'edit') => {
    const current = target === 'compose' ? composeImages : editImages;
    const remaining = 4 - current.length;
    if (remaining <= 0) {
      Alert.alert('Limit Reached', 'Maximum 4 images per post.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const compressed: string[] = [];
      for (const asset of result.assets) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1000 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          if (manipulated.base64) {
            compressed.push(`data:image/jpeg;base64,${manipulated.base64}`);
          }
        } catch (e) {
          console.error('Image processing error:', e);
        }
      }

      if (target === 'compose') {
        setComposeImages((prev) => [...prev, ...compressed].slice(0, 4));
      } else {
        setEditImages((prev) => [...prev, ...compressed].slice(0, 4));
      }
    }
  };

  const removeImage = (target: 'compose' | 'edit', index: number) => {
    if (target === 'compose') {
      setComposeImages((prev) => prev.filter((_, i) => i !== index));
    } else {
      setEditImages((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const submitPost = async () => {
    if (!composeText.trim() && composeImages.length === 0) return;
    if (!user) {
      Alert.alert('Login Required', 'Please log in to create a post.');
      return;
    }

    setPosting(true);
    try {
      const res = await api.post('/feeds', {
        userId: user.id,
        userName: user.nickname || user.name,
        userAvatar: user.profilePic || null,
        text: composeText.trim(),
        images: composeImages,
      });
      setPosts((prev) => [res.data, ...prev]);
      setComposeText('');
      setComposeImages([]);
      Keyboard.dismiss();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to create post';
      Alert.alert('Error', msg);
    } finally {
      setPosting(false);
    }
  };

  // ==================== LIKE ====================

  const toggleLike = async (postId: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to like posts.');
      return;
    }

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const isLiked = p.likedBy.includes(user.id);
        return {
          ...p,
          likes: isLiked ? p.likes - 1 : p.likes + 1,
          likedBy: isLiked
            ? p.likedBy.filter((id) => id !== user.id)
            : [...p.likedBy, user.id],
        };
      })
    );

    try {
      await api.post(`/feeds/${postId}/like?user_id=${user.id}`);
    } catch (err) {
      // Revert on failure
      fetchPosts();
    }
  };

  // ==================== EDIT / DELETE ====================

  const openEdit = (post: FeedPost) => {
    setEditingPost(post);
    setEditText(post.text);
    setEditImages([...post.images]);
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editingPost || !user) return;
    setSavingEdit(true);
    try {
      const res = await api.put(`/feeds/${editingPost.id}?user_id=${user.id}`, {
        text: editText.trim(),
        images: editImages,
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === editingPost.id ? { ...p, ...res.data } : p))
      );
      setShowEditModal(false);
      setEditingPost(null);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to update post';
      Alert.alert('Error', msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const deletePost = (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/feeds/${postId}?user_id=${user?.id}`);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch {
            Alert.alert('Error', 'Failed to delete post');
          }
        },
      },
    ]);
  };

  // ==================== COMMENTS ====================

  const openComments = (postId: string) => {
    setCommentsPostId(postId);
    setShowComments(true);
  };

  const handleCommentCountChange = (delta: number) => {
    if (!commentsPostId) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === commentsPostId
          ? { ...p, commentCount: Math.max(0, p.commentCount + delta) }
          : p
      )
    );
  };

  // ==================== IMAGE VIEWER ====================

  const openViewer = (images: string[], index: number) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerVisible(true);
  };

  // ==================== RENDER POST ====================

  const renderPost = useCallback(
    ({ item }: { item: FeedPost }) => {
      const isOwner = user?.id === item.userId;
      const isLiked = user ? item.likedBy.includes(user.id) : false;
      const textLines = countTextLines(item.text);
      const isShortText = textLines <= 2 && item.text.length <= 80;

      return (
        <View style={styles.postCard}>
          {/* Post Header */}
          <View style={styles.postHeader}>
            <View style={styles.avatarContainer}>
              {item.userAvatar ? (
                <Image
                  source={{ uri: item.userAvatar.startsWith('data:') ? item.userAvatar : `data:image/jpeg;base64,${item.userAvatar}` }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {item.userName?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{item.userName}</Text>
              <Text style={styles.postTime}>
                {timeAgo(item.createdAt)}
                {item.edited && ' · edited'}
              </Text>
            </View>
            {isOwner && (
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => {
                  Alert.alert('Post Options', '', [
                    { text: 'Edit', onPress: () => openEdit(item) },
                    { text: 'Delete', style: 'destructive', onPress: () => deletePost(item.id) },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#888" />
              </TouchableOpacity>
            )}
          </View>

          {/* Post Text */}
          {item.text ? (
            <Text style={[styles.postText, isShortText && styles.postTextLarge]}>
              {item.text}
            </Text>
          ) : null}

          {/* Post Images */}
          {item.images && item.images.length > 0 && (
            <ImageGrid
              images={item.images}
              onImagePress={(index) => openViewer(item.images, index)}
            />
          )}

          {/* Actions Row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => toggleLike(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={isLiked ? '#FF4444' : '#888'}
              />
              {item.likes > 0 && (
                <Text style={[styles.actionCount, isLiked && { color: '#FF4444' }]}>
                  {item.likes}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => openComments(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#888" />
              {item.commentCount > 0 && (
                <Text style={styles.actionCount}>{item.commentCount}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [user, posts]
  );

  // ==================== COMPOSE SECTION ====================

  const ComposeSection = useMemo(
    () => (
      <View style={styles.composeCard}>
        <View style={styles.composeRow}>
          <View style={styles.composeAvatarContainer}>
            {user?.profilePic ? (
              <Image
                source={{
                  uri: user.profilePic.startsWith('data:')
                    ? user.profilePic
                    : `data:image/jpeg;base64,${user.profilePic}`,
                }}
                style={styles.composeAvatar}
              />
            ) : (
              <View style={styles.composeAvatarPlaceholder}>
                <Ionicons name="person" size={18} color="#888" />
              </View>
            )}
          </View>
          <TextInput
            style={styles.composeInput}
            value={composeText}
            onChangeText={setComposeText}
            placeholder="Share your thoughts, build info, your current project, etc.. Please keep all posts related to automobiles."
            placeholderTextColor="#666"
            multiline
            maxLength={2000}
          />
        </View>

        {/* Image Previews */}
        {composeImages.length > 0 && (
          <View style={styles.composeImageRow}>
            {composeImages.map((img, i) => (
              <View key={i} style={styles.composeImageContainer}>
                <Image source={{ uri: img }} style={styles.composeImagePreview} />
                <TouchableOpacity
                  style={styles.composeImageRemove}
                  onPress={() => removeImage('compose', i)}
                >
                  <Ionicons name="close-circle" size={22} color="#FF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Action bar */}
        <View style={styles.composeActions}>
          <TouchableOpacity
            style={styles.composeMediaBtn}
            onPress={() => pickImages('compose')}
            disabled={composeImages.length >= 4}
          >
            <Ionicons
              name="image-outline"
              size={22}
              color={composeImages.length >= 4 ? '#444' : '#FF6B35'}
            />
            <Text
              style={[
                styles.composeMediaText,
                composeImages.length >= 4 && { color: '#444' },
              ]}
            >
              Photo {composeImages.length > 0 ? `(${composeImages.length}/4)` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.postButton,
              (!composeText.trim() && composeImages.length === 0) && styles.postButtonDisabled,
            ]}
            onPress={submitPost}
            disabled={(!composeText.trim() && composeImages.length === 0) || posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    ),
    [composeText, composeImages, posting, user]
  );

  // ==================== EDIT MODAL ====================

  const EditModal = () => (
    <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
      <View style={editStyles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[editStyles.container, { paddingBottom: insets.bottom }]}
        >
          <View style={editStyles.header}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={editStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={editStyles.title}>Edit Post</Text>
            <TouchableOpacity
              onPress={saveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color="#FF6B35" />
              ) : (
                <Text style={editStyles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <TextInput
            style={editStyles.input}
            value={editText}
            onChangeText={setEditText}
            multiline
            maxLength={2000}
            placeholder="What's on your mind?"
            placeholderTextColor="#666"
          />

          {editImages.length > 0 && (
            <View style={styles.composeImageRow}>
              {editImages.map((img, i) => (
                <View key={i} style={styles.composeImageContainer}>
                  <Image
                    source={{ uri: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` }}
                    style={styles.composeImagePreview}
                  />
                  <TouchableOpacity
                    style={styles.composeImageRemove}
                    onPress={() => removeImage('edit', i)}
                  >
                    <Ionicons name="close-circle" size={22} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={editStyles.addPhotoBtn}
            onPress={() => pickImages('edit')}
            disabled={editImages.length >= 4}
          >
            <Ionicons name="image-outline" size={20} color={editImages.length >= 4 ? '#444' : '#FF6B35'} />
            <Text style={[editStyles.addPhotoText, editImages.length >= 4 && { color: '#444' }]}>
              Add Photos ({editImages.length}/4)
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  // ==================== MAIN RENDER ====================

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community Lounge</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.authPrompt}>
          <Ionicons name="chatbubbles-outline" size={60} color="#444" />
          <Text style={styles.authTitle}>Join the Conversation</Text>
          <Text style={styles.authSub}>Log in to view and create posts</Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.authButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Lounge</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Feed */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={() => ComposeSection}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
            colors={['#FF6B35']}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color="#FF6B35" style={{ marginVertical: 20 }} />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={48} color="#444" />
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySub}>
                Be the first to share something with the community!
              </Text>
            </View>
          ) : null
        }
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={7}
      />

      {loading && posts.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      )}

      {/* Modals */}
      <ImageViewer
        visible={viewerVisible}
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />

      {showComments && commentsPostId && (
        <CommentsModal
          visible={showComments}
          postId={commentsPostId}
          onClose={() => {
            setShowComments(false);
            setCommentsPostId(null);
          }}
          userId={user?.id || ''}
          userName={user?.nickname || user?.name || 'User'}
          onCommentCountChange={handleCommentCountChange}
        />
      )}

      <EditModal />
    </View>
  );
}

// ====================== EDIT MODAL STYLES ======================

const editStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  cancelText: {
    color: '#888',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  saveText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  addPhotoText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
});

// ====================== MAIN STYLES ======================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  listContent: {
    paddingBottom: 40,
  },

  // Compose
  composeCard: {
    backgroundColor: '#151515',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  composeAvatarContainer: {
    marginTop: 2,
  },
  composeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  composeAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  composeInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 120,
    paddingTop: 6,
  },
  composeImageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  composeImageContainer: {
    position: 'relative',
  },
  composeImagePreview: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
  },
  composeImageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  composeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  composeMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  composeMediaText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
  postButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Post Card
  postCard: {
    backgroundColor: '#151515',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatarContainer: {},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  postTime: {
    color: '#666',
    fontSize: 12,
    marginTop: 1,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postText: {
    color: '#e0e0e0',
    fontSize: 15,
    lineHeight: 21,
  },
  postTextLarge: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: '#fff',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionCount: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty / Auth
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#888',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySub: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  authTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 20,
  },
  authSub: {
    color: '#888',
    fontSize: 15,
    marginTop: 8,
  },
  authButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0c0c0c',
  },
});
