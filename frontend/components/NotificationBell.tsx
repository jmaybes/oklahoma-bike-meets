import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../utils/api';

interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  carId?: string;
  eventId?: string;
}

interface NotificationBellProps {
  color?: string;
  size?: number;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ 
  color = '#fff', 
  size = 24 
}) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showModal, setShowModal] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const response = await axios.get(`${API_URL}/api/notifications/${user.id}`);
      const unreadNotifs = response.data.filter((n: Notification) => !n.isRead);
      setNotifications(unreadNotifs);
    } catch (error) {
      console.log('Failed to fetch notifications:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user?.id) {
        fetchNotifications();
      }
    }, [isAuthenticated, user?.id])
  );

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchNotifications();
    }
  }, [isAuthenticated, user?.id]);

  const markNotificationRead = async (notifId: string) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${notifId}/read`);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (error) {
      console.log('Failed to mark notification as read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!user?.id) return;
    try {
      await axios.put(`${API_URL}/api/notifications/user/${user.id}/read-all`);
      setNotifications([]);
    } catch (error) {
      console.log('Failed to mark all notifications as read:', error);
    }
  };

  const handleNotificationTap = async (notif: Notification) => {
    await markNotificationRead(notif.id);
    setShowModal(false);
    
    try {
      if (notif.type === 'garage_comment' && notif.carId) {
        router.push(`/garage/${notif.carId}`);
      } else if (notif.type === 'event_photo_tag' && notif.eventId) {
        router.push(`/event/${notif.eventId}/gallery`);
      } else if (notif.type === 'event_rsvp' && notif.eventId) {
        router.push(`/event/${notif.eventId}`);
      }
    } catch (e) {
      console.log('Navigation from notification failed:', e);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'garage_comment': return 'chatbubble';
      case 'event_photo_tag': return 'image';
      case 'event_rsvp': return 'calendar';
      case 'feedback': return 'star';
      case 'admin': return 'shield-checkmark';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'garage_comment': return '#4CAF50';
      case 'event_photo_tag': return '#9C27B0';
      case 'event_rsvp': return '#2196F3';
      case 'feedback': return '#FF9800';
      case 'admin': return '#E31837';
      default: return '#666';
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <TouchableOpacity onPress={() => setShowModal(true)} style={{ position: 'relative' }}>
        <Ionicons name="notifications-outline" size={size} color={color} />
        {notifications.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {notifications.length > 99 ? '99+' : notifications.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={markAllNotificationsRead}>
                    <Text style={styles.markAllRead}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={styles.notificationsList}>
              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="notifications-off-outline" size={48} color="#444" />
                  <Text style={styles.emptyText}>No new notifications</Text>
                </View>
              ) : (
                notifications.map((notif) => (
                  <TouchableOpacity
                    key={notif.id}
                    style={styles.notificationItem}
                    onPress={() => handleNotificationTap(notif)}
                  >
                    <View style={[styles.notifIcon, { backgroundColor: getNotificationColor(notif.type) }]}>
                      <Ionicons name={getNotificationIcon(notif.type) as any} size={20} color="#fff" />
                    </View>
                    <View style={styles.notifContent}>
                      <Text style={styles.notifMessage}>{notif.message}</Text>
                      <Text style={styles.notifTime}>
                        {new Date(notif.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#FF5252',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  markAllRead: {
    color: '#E31837',
    fontSize: 14,
  },
  notificationsList: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    marginTop: 12,
    fontSize: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#252525',
    borderRadius: 12,
    marginBottom: 8,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifMessage: {
    color: '#fff',
    fontSize: 14,
  },
  notifTime: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
});

export default NotificationBell;
