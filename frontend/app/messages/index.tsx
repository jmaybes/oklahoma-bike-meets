import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

import { API_URL } from '../../utils/api';

// Get WebSocket URL from API URL
const getWebSocketUrl = () => {
  if (!API_URL) return '';
  const wsUrl = API_URL.replace(/^http/, 'ws');
  return wsUrl;
};

interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerNickname?: string;
  partnerEmail: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface User {
  id: string;
  name: string;
  nickname?: string;
  email: string;
}

export default function MessagesScreen() {
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!user?.id || wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${getWebSocketUrl()}/ws/messages/${user.id}`;
    
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Messages list WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'new_message':
              // Update conversations list with new message
              if (data.message) {
                updateConversationWithNewMessage(data.message);
              }
              break;

            case 'user_online':
              setOnlineUsers(prev => {
                if (!prev.includes(data.userId)) {
                  return [...prev, data.userId];
                }
                return prev;
              });
              break;

            case 'user_offline':
              setOnlineUsers(prev => prev.filter(id => id !== data.userId));
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Messages list WebSocket closed');
        // Attempt to reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          if (user?.id) {
            connectWebSocket();
          }
        }, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [user?.id]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, []);

  const updateConversationWithNewMessage = (message: any) => {
    setConversations(prev => {
      const partnerId = message.senderId === user?.id ? message.receiverId : message.senderId;
      const existingIndex = prev.findIndex(c => c.partnerId === partnerId);

      if (existingIndex >= 0) {
        // Update existing conversation
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          lastMessage: message.content,
          lastMessageTime: message.createdAt,
          unreadCount: message.senderId !== user?.id 
            ? updated[existingIndex].unreadCount + 1 
            : updated[existingIndex].unreadCount,
        };
        // Move to top
        const [conversation] = updated.splice(existingIndex, 1);
        return [conversation, ...updated];
      } else {
        // New conversation - fetch to get partner details
        fetchConversations();
        return prev;
      }
    });
  };

  // Connect WebSocket when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user?.id) {
        connectWebSocket();
        fetchOnlineUsers();
      }

      return () => {
        disconnectWebSocket();
      };
    }, [isAuthenticated, user?.id])
  );

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchConversations();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/messages/conversations/${user?.id}`);
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/messages/online`);
      setOnlineUsers(response.data.online_users || []);
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await axios.get(`${API_URL}/api/users/search`, {
        params: { q: query }
      });
      // Filter out current user
      const filtered = response.data.filter((u: User) => u.id !== user?.id);
      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
    fetchOnlineUsers();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const startNewChat = (selectedUser: User) => {
    setShowNewChatModal(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(`/messages/${selectedUser.id}`);
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isOnline = onlineUsers.includes(item.partnerId);
    
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => router.push(`/messages/${item.partnerId}`)}
      >
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={50} color="#2196F3" />
          {isOnline && <View style={styles.onlineBadge} />}
        </View>
        <View style={styles.conversationDetails}>
          <View style={styles.conversationHeader}>
            <Text style={styles.partnerName}>
              {item.partnerNickname || item.partnerName}
            </Text>
            <Text style={styles.messageTime}>{formatTime(item.lastMessageTime)}</Text>
          </View>
          <View style={styles.lastMessageRow}>
            <Text style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadMessage]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          </View>
        </View>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSearchResult = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => startNewChat(item)}
    >
      <Ionicons name="person-circle" size={44} color="#2196F3" />
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.nickname || item.name}</Text>
        <Text style={styles.searchResultEmail}>{item.email}</Text>
      </View>
      <Ionicons name="chatbubble-outline" size={24} color="#2196F3" />
    </TouchableOpacity>
  );

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LinearGradient
          colors={['#2196F3', '#1976D2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Messages</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        <View style={styles.authRequiredContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color="#333" />
          <Text style={styles.authRequiredTitle}>Login Required</Text>
          <Text style={styles.authRequiredSubtitle}>
            Sign in to message other riders
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={['#2196F3', '#1976D2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity 
            style={styles.newChatButton}
            onPress={() => setShowNewChatModal(true)}
          >
            <Ionicons name="create-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Online users indicator */}
      {onlineUsers.length > 0 && (
        <View style={styles.onlineIndicator}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>
            {onlineUsers.length} user{onlineUsers.length !== 1 ? 's' : ''} online
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.partnerId}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={80} color="#333" />
              <Text style={styles.emptyTitle}>No Messages Yet</Text>
              <Text style={styles.emptySubtitle}>
                Start connecting with other riders!
              </Text>
              <TouchableOpacity
                style={styles.startChatButton}
                onPress={() => setShowNewChatModal(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.startChatButtonText}>Start a Chat</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2196F3"
            />
          }
        />
      )}

      {/* New Chat Modal */}
      <Modal
        visible={showNewChatModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Message</Text>
              <TouchableOpacity onPress={() => {
                setShowNewChatModal(false);
                setSearchQuery('');
                setSearchResults([]);
              }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users by name or email..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchUsers(text);
                }}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {searching ? (
              <View style={styles.searchingContainer}>
                <ActivityIndicator size="small" color="#2196F3" />
                <Text style={styles.searchingText}>Searching...</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResult}
                contentContainerStyle={styles.searchResultsList}
                ListEmptyComponent={
                  searchQuery.length > 0 ? (
                    <View style={styles.noResultsContainer}>
                      <Ionicons name="person-outline" size={48} color="#444" />
                      <Text style={styles.noResultsText}>No users found</Text>
                    </View>
                  ) : (
                    <View style={styles.searchHintContainer}>
                      <Ionicons name="people-outline" size={48} color="#444" />
                      <Text style={styles.searchHintText}>
                        Search for users to start a conversation
                      </Text>
                    </View>
                  )
                }
              />
            )}
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  newChatButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 255, 0, 0.1)',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EFFF00',
  },
  onlineText: {
    color: '#EFFF00',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EFFF00',
    borderWidth: 2,
    borderColor: '#141414',
  },
  conversationDetails: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  messageTime: {
    fontSize: 12,
    color: '#888',
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#aaa',
    flex: 1,
  },
  unreadMessage: {
    color: '#fff',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
    alignItems: 'center',
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
  },
  startChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  authRequiredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  authRequiredTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
  },
  authRequiredSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 24,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  searchingText: {
    color: '#888',
    fontSize: 14,
  },
  searchResultsList: {
    padding: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  searchResultEmail: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  searchHintContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  searchHintText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});
