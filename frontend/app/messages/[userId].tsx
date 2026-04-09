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
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

import { API_URL } from '../../utils/api';

const getWebSocketUrl = () => {
  if (!API_URL) return '';
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
  isPopupInvite?: boolean;
  locationShareId?: string | null;
}

interface Partner {
  id: string;
  name: string;
  nickname?: string;
  email: string;
}

interface LocationShareData {
  latitude: number;
  longitude: number;
  expired: boolean;
  remainingSeconds?: number;
  userName?: string;
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

  // RSVP & location state caches
  const [rsvpStatuses, setRsvpStatuses] = useState<Record<string, string>>({});
  const [locationShares, setLocationShares] = useState<Record<string, LocationShareData>>({});
  const [rsvpLoading, setRsvpLoading] = useState<Record<string, boolean>>({});

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
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'new_message':
              if (data.message &&
                  (data.message.senderId === userId || data.message.receiverId === userId)) {
                setMessages(prev => {
                  const exists = prev.some(m => m.id === data.message.id);
                  if (exists) return prev;
                  return [...prev, data.message];
                });
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }
              break;
            case 'message_sent':
              if (data.message) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === data.message.id ? { ...m, status: 'sent' } : m
                  )
                );
              }
              break;
            case 'typing':
              if (data.senderId === userId) {
                setIsPartnerTyping(true);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 3000);
              }
              break;
            case 'user_online':
              if (data.userId === userId) setIsPartnerOnline(true);
              break;
            case 'user_offline':
              if (data.userId === userId) setIsPartnerOnline(false);
              break;
            case 'pong':
              break;
            case 'error':
              console.error('WebSocket error:', data.error);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = () => setConnectionStatus('disconnected');

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (user?.id) connectWebSocket();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionStatus('disconnected');
    }
  }, [user?.id, userId]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, []);

  const sendMessageViaWS = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && user?.id && userId) {
      const tempId = `temp-${Date.now()}`;
      wsRef.current.send(JSON.stringify({
        type: 'new_message', recipientId: userId, content, tempId,
      }));
      setMessages(prev => [...prev, {
        id: tempId, senderId: user.id, receiverId: userId,
        content, createdAt: new Date().toISOString(), status: 'sending',
      }]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      return true;
    }
    return false;
  }, [user?.id, userId]);

  const sendTypingIndicator = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
      wsRef.current.send(JSON.stringify({ type: 'typing', recipientId: userId }));
    }
  }, [userId]);

  const checkPartnerOnline = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/messages/online/${userId}`);
      setIsPartnerOnline(response.data.online);
    } catch (error) {
      console.error('Error checking online status:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user?.id) {
        connectWebSocket();
        checkPartnerOnline();
      }
      return () => disconnectWebSocket();
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

  // After messages load, fetch location data and RSVPs for popup invites
  useEffect(() => {
    if (messages.length > 0 && user) {
      const popupMessages = messages.filter(m => m.isPopupInvite);
      popupMessages.forEach(msg => {
        // Fetch location share data if not cached
        if (msg.locationShareId && !locationShares[msg.locationShareId]) {
          fetchLocationShare(msg.locationShareId);
        }
        // Fetch RSVP status if not cached
        if (!rsvpStatuses[msg.id]) {
          fetchRsvpStatus(msg.id);
        }
      });
    }
  }, [messages, user]);

  const fetchLocationShare = async (shareId: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/meetup/location-share/${shareId}`);
      setLocationShares(prev => ({ ...prev, [shareId]: response.data }));
    } catch (error) {
      console.error('Error fetching location share:', error);
    }
  };

  const fetchRsvpStatus = async (messageId: string) => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/api/meetup/popup-rsvp/${messageId}`);
      const myRsvp = response.data.rsvps?.find((r: any) => r.userId === user.id);
      if (myRsvp) {
        setRsvpStatuses(prev => ({ ...prev, [messageId]: myRsvp.status }));
      }
    } catch (error) {
      console.error('Error fetching RSVP status:', error);
    }
  };

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
    const sentViaWS = sendMessageViaWS(content);
    if (!sentViaWS) {
      setSending(true);
      try {
        const response = await axios.post(`${API_URL}/api/messages`, {
          senderId: user.id, receiverId: userId, content,
        });
        setMessages(prev => [...prev, response.data]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      } catch (error) {
        console.error('Error sending message:', error);
        setNewMessage(content);
      } finally {
        setSending(false);
      }
    }
  };

  const handleTextChange = (text: string) => {
    setNewMessage(text);
    sendTypingIndicator();
  };

  // ====== Location & RSVP Handlers ======
  const openLocationInMaps = (lat: number, lon: number) => {
    const label = 'Pop-Up Event Location';
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lon}&dirflg=d`,
      android: `google.navigation:q=${lat},${lon}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    });
    if (url) {
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to web Google Maps
          Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`);
        }
      });
    }
  };

  const handleRsvp = async (messageId: string, status: 'attending' | 'declined') => {
    if (!user) return;
    setRsvpLoading(prev => ({ ...prev, [messageId]: true }));
    try {
      await axios.post(`${API_URL}/api/meetup/popup-rsvp`, {
        messageId,
        userId: user.id,
        userName: user.nickname || user.name,
        status,
      });
      setRsvpStatuses(prev => ({ ...prev, [messageId]: status }));
    } catch (error) {
      console.error('Error sending RSVP:', error);
      Alert.alert('Error', 'Could not send your RSVP. Please try again.');
    } finally {
      setRsvpLoading(prev => ({ ...prev, [messageId]: false }));
    }
  };

  // ====== Formatters ======
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // ====== Render Pop-Up Invite Card ======
  const renderPopupInviteCard = (item: Message) => {
    const isMyMessage = item.senderId === user?.id;
    const currentRsvp = rsvpStatuses[item.id];
    const isRsvpLoading = rsvpLoading[item.id];
    const locShare = item.locationShareId ? locationShares[item.locationShareId] : null;
    const hasLocation = locShare && !locShare.expired && locShare.latitude;
    const locationExpired = locShare?.expired;

    return (
      <View style={[styles.messageContainer, isMyMessage && styles.myMessageContainer]}>
        <View style={styles.popupInviteCard}>
          {/* Header Gradient */}
          <LinearGradient
            colors={['#E1FF00', '#E91E63']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.popupCardHeader}
          >
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={styles.popupCardHeaderText}>Pop-Up Event Invite</Text>
          </LinearGradient>

          {/* Message Body */}
          <View style={styles.popupCardBody}>
            <Text style={styles.popupCardContent}>{item.content}</Text>

            {/* Location Button */}
            {item.locationShareId && (
              <View style={styles.locationSection}>
                {hasLocation ? (
                  <TouchableOpacity
                    style={styles.locationButton}
                    onPress={() => openLocationInMaps(locShare.latitude, locShare.longitude)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.locationButtonIcon}>
                      <Ionicons name="navigate" size={20} color="#fff" />
                    </View>
                    <View style={styles.locationButtonInfo}>
                      <Text style={styles.locationButtonTitle}>Get Directions</Text>
                      <Text style={styles.locationButtonSub}>
                        Tap to open in Maps • {Math.round((locShare.remainingSeconds || 0) / 60)} min left
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
                  </TouchableOpacity>
                ) : locationExpired ? (
                  <View style={styles.locationExpired}>
                    <Ionicons name="time-outline" size={18} color="#888" />
                    <Text style={styles.locationExpiredText}>Location share has expired</Text>
                  </View>
                ) : (
                  <View style={styles.locationLoading}>
                    <ActivityIndicator size="small" color="#E1FF00" />
                    <Text style={styles.locationLoadingText}>Loading location...</Text>
                  </View>
                )}
              </View>
            )}

            {/* RSVP Section - only for received invites */}
            {!isMyMessage && (
              <View style={styles.rsvpSection}>
                <Text style={styles.rsvpLabel}>Will you be there?</Text>
                {currentRsvp ? (
                  <View style={styles.rsvpStatus}>
                    <View style={[
                      styles.rsvpStatusBadge,
                      currentRsvp === 'attending' ? styles.rsvpAttendingBadge : styles.rsvpDeclinedBadge,
                    ]}>
                      <Ionicons
                        name={currentRsvp === 'attending' ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.rsvpStatusText}>
                        {currentRsvp === 'attending' ? "I'll be there!" : "Can't make it"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.rsvpChangeButton}
                      onPress={() => handleRsvp(item.id, currentRsvp === 'attending' ? 'declined' : 'attending')}
                      disabled={isRsvpLoading}
                    >
                      <Text style={styles.rsvpChangeText}>Change RSVP</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.rsvpButtons}>
                    <TouchableOpacity
                      style={[styles.rsvpButton, styles.rsvpAttendButton]}
                      onPress={() => handleRsvp(item.id, 'attending')}
                      disabled={isRsvpLoading}
                    >
                      {isRsvpLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                          <Text style={styles.rsvpButtonText}>I'll be there!</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.rsvpButton, styles.rsvpDeclineButton]}
                      onPress={() => handleRsvp(item.id, 'declined')}
                      disabled={isRsvpLoading}
                    >
                      {isRsvpLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="close-circle" size={18} color="#fff" />
                          <Text style={styles.rsvpButtonText}>Can't make it</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* If sender, show that this is the invite they sent */}
            {isMyMessage && (
              <View style={styles.sentBadge}>
                <Ionicons name="paper-plane" size={14} color="#888" />
                <Text style={styles.sentBadgeText}>Invite sent</Text>
              </View>
            )}
          </View>

          {/* Footer with time */}
          <View style={styles.popupCardFooter}>
            <Text style={styles.popupCardTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
      </View>
    );
  };

  // ====== Render Message ======
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.senderId === user?.id;

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

        {item.isPopupInvite ? (
          renderPopupInviteCard(item)
        ) : (
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
        )}
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

  // Pop-Up Invite Card
  popupInviteCard: {
    width: '90%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginVertical: 4,
  },
  popupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  popupCardHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  popupCardBody: {
    padding: 14,
  },
  popupCardContent: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },

  // Location Section
  locationSection: {
    marginBottom: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  locationButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationButtonInfo: {
    flex: 1,
  },
  locationButtonTitle: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: '700',
  },
  locationButtonSub: {
    color: '#7CB342',
    fontSize: 12,
    marginTop: 2,
  },
  locationExpired: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 10,
  },
  locationExpiredText: {
    color: '#888',
    fontSize: 13,
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  locationLoadingText: {
    color: '#888',
    fontSize: 13,
  },

  // RSVP Section
  rsvpSection: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingTop: 12,
  },
  rsvpLabel: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    minHeight: 48,
  },
  rsvpAttendButton: {
    backgroundColor: '#4CAF50',
  },
  rsvpDeclineButton: {
    backgroundColor: '#666',
  },
  rsvpButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  rsvpStatus: {
    alignItems: 'center',
    gap: 8,
  },
  rsvpStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  rsvpAttendingBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  rsvpDeclinedBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  rsvpStatusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rsvpChangeButton: {
    paddingVertical: 6,
  },
  rsvpChangeText: {
    color: '#E1FF00',
    fontSize: 12,
    fontWeight: '600',
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  sentBadgeText: {
    color: '#888',
    fontSize: 12,
  },

  // Card footer
  popupCardFooter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#151515',
    alignItems: 'flex-end',
  },
  popupCardTime: {
    color: '#666',
    fontSize: 11,
  },

  // Typing
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
  typingDot1: { opacity: 0.4 },
  typingDot2: { opacity: 0.6 },
  typingDot3: { opacity: 0.8 },

  // Empty & Auth
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
