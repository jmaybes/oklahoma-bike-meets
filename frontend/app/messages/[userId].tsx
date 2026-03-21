import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Get WebSocket URL from API URL
const getWebSocketUrl = () => {
  if (!API_URL) return '';
  // Replace http/https with ws/wss
  const wsUrl = API_URL.replace(/^http/, 'ws');
  return wsUrl;
};

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface Partner {
  id: string;
  name: string;
  nickname?: string;
  email: string;
}

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!user?.id || wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${getWebSocketUrl()}/ws/messages/${user.id}`;
    console.log('Connecting to WebSocket:', wsUrl);
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        
        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data.type);

          switch (data.type) {
            case 'new_message':
              // Only add messages from the current chat partner
              if (data.message && 
                  (data.message.senderId === userId || data.message.receiverId === userId)) {
                setMessages(prev => {
                  // Check if message already exists to prevent duplicates
                  const exists = prev.some(m => m.id === data.message.id);
                  if (exists) return prev;
                  return [...prev, data.message];
                });
                // Scroll to bottom on new message
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }
              break;

            case 'message_sent':
              // Update message status when confirmed sent
              if (data.message) {
                setMessages(prev => 
                  prev.map(m => 
                    m.id === data.message.id ? { ...m, status: 'sent' } : m
                  )
                );
              }
              break;

            case 'typing':
              // Show typing indicator if it's from our chat partner
              if (data.senderId === userId) {
                setIsPartnerTyping(true);
                // Clear typing indicator after 3 seconds
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
                typingTimeoutRef.current = setTimeout(() => {
                  setIsPartnerTyping(false);
                }, 3000);
              }
              break;

            case 'user_online':
              if (data.userId === userId) {
                setIsPartnerOnline(true);
              }
              break;

            case 'user_offline':
              if (data.userId === userId) {
                setIsPartnerOnline(false);
              }
              break;

            case 'pong':
              // Heartbeat response received
              break;

            case 'error':
              console.error('WebSocket error:', data.error);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setConnectionStatus('disconnected');
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (user?.id) {
            connectWebSocket();
          }
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionStatus('disconnected');
    }
  }, [user?.id, userId]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, []);

  // Send message via WebSocket
  const sendMessageViaWS = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && user?.id && userId) {
      const tempId = `temp-${Date.now()}`;
      const messageData = {
        type: 'new_message',
        recipientId: userId,
        content: content,
        tempId: tempId,
      };

      // Optimistically add message to UI
      const optimisticMessage: Message = {
        id: tempId,
        senderId: user.id,
        receiverId: userId,
        content: content,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      wsRef.current.send(JSON.stringify(messageData));
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      return true;
    }
    return false;
  }, [user?.id, userId]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        recipientId: userId,
      }));
    }
  }, [userId]);

  // Check if partner is online
  const checkPartnerOnline = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/messages/online/${userId}`);
      setIsPartnerOnline(response.data.online);
    } catch (error) {
      console.error('Error checking online status:', error);
    }
  };

  // Connect WebSocket when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user?.id) {
        connectWebSocket();
        checkPartnerOnline();
      }

      return () => {
        disconnectWebSocket();
      };
    }, [isAuthenticated, user?.id, connectWebSocket, disconnectWebSocket])
  );

  useEffect(() => {
    if (isAuthenticated && user && userId) {
      fetchMessages();
      fetchPartnerInfo();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user, userId]);

  const fetchPartnerInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users/${userId}`);
      setPartner(response.data);
    } catch (error) {
      console.error('Error fetching partner info:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/messages/thread/${user?.id}/${userId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !userId) return;

    const content = newMessage.trim();
    setNewMessage('');
    Keyboard.dismiss();

    // Try to send via WebSocket first
    const sentViaWS = sendMessageViaWS(content);

    if (!sentViaWS) {
      // Fallback to HTTP if WebSocket is not connected
      setSending(true);
      try {
        const messageData = {
          senderId: user.id,
          receiverId: userId,
          content: content,
        };

        const response = await axios.post(`${API_URL}/api/messages`, messageData);
        setMessages(prev => [...prev, response.data]);
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } catch (error) {
        console.error('Error sending message:', error);
        // Show the message back in input if failed
        setNewMessage(content);
      } finally {
        setSending(false);
      }
    }
  };

  const handleTextChange = (text: string) => {
    setNewMessage(text);
    // Send typing indicator (debounced)
    sendTypingIndicator();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.senderId === user?.id;
    
    // Check if we should show date header
    let showDateHeader = false;
    if (index === 0) {
      showDateHeader = true;
    } else {
      const prevDate = new Date(messages[index - 1].createdAt).toDateString();
      const currDate = new Date(item.createdAt).toDateString();
      showDateHeader = prevDate !== currDate;
    }

    return (
      <>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formatDateHeader(item.createdAt)}</Text>
          </View>
        )}
        <View style={[styles.messageContainer, isMyMessage && styles.myMessageContainer]}>
          <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble]}>
            <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
              {item.content}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
                {formatTime(item.createdAt)}
              </Text>
              {isMyMessage && item.status && (
                <Ionicons 
                  name={item.status === 'sending' ? 'time-outline' : 'checkmark-done'} 
                  size={14} 
                  color={item.status === 'sending' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.7)'} 
                  style={styles.statusIcon}
                />
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.authRequired}>
          <Text style={styles.authText}>Please login to send messages</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          <View style={styles.headerInfo}>
            <View style={styles.avatarWrapper}>
              <Ionicons name="person-circle" size={36} color="#fff" />
              {isPartnerOnline && <View style={styles.onlineIndicator} />}
            </View>
            <View>
              <Text style={styles.headerTitle}>{partner?.nickname || partner?.name || 'Loading...'}</Text>
              {isPartnerTyping ? (
                <Text style={styles.typingIndicator}>typing...</Text>
              ) : isPartnerOnline ? (
                <Text style={styles.onlineStatus}>Online</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.connectionIndicator}>
            <View style={[
              styles.connectionDot,
              connectionStatus === 'connected' ? styles.connectedDot :
              connectionStatus === 'connecting' ? styles.connectingDot :
              styles.disconnectedDot
            ]} />
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            onLayout={() => flatListRef.current?.scrollToEnd()}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubble-outline" size={60} color="#333" />
                <Text style={styles.emptyChatText}>No messages yet</Text>
                <Text style={styles.emptyChatSubtext}>Start the conversation!</Text>
              </View>
            }
          />
        )}

        {/* Typing indicator */}
        {isPartnerTyping && (
          <View style={styles.typingBubble}>
            <View style={styles.typingDots}>
              <View style={[styles.typingDot, styles.typingDot1]} />
              <View style={[styles.typingDot, styles.typingDot2]} />
              <View style={[styles.typingDot, styles.typingDot3]} />
            </View>
          </View>
        )}

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            value={newMessage}
            onChangeText={handleTextChange}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
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
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginLeft: 8,
  },
  avatarWrapper: {
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  typingIndicator: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
  },
  onlineStatus: {
    fontSize: 12,
    color: '#90EE90',
  },
  connectionIndicator: {
    width: 40,
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedDot: {
    backgroundColor: '#4CAF50',
  },
  connectingDot: {
    backgroundColor: '#FFC107',
  },
  disconnectedDot: {
    backgroundColor: '#f44336',
  },
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderText: {
    color: '#666',
    fontSize: 12,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  messageContainer: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#2196F3',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#888',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  statusIcon: {
    marginLeft: 4,
  },
  typingBubble: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingDots: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyChatText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  authRequired: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authText: {
    color: '#888',
    fontSize: 16,
  },
});
