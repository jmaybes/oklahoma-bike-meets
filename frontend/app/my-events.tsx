import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://event-hub-okc-1.preview.emergentagent.com';

interface MyEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  address: string;
  city: string;
  eventType: string;
  entryFee: string;
  organizer: string;
  contactInfo: string;
  website: string;
  isApproved: boolean;
  isRecurring: boolean;
  recurrenceDay?: number;
  recurrenceEndDate?: string;
  photos?: string[];
}

export default function MyEventsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MyEvent | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editEntryFee, setEditEntryFee] = useState('');
  const [editOrganizer, setEditOrganizer] = useState('');
  const [editContactInfo, setEditContactInfo] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editEventType, setEditEventType] = useState('Car Meet');

  const eventTypes = ['Car Meet', 'Car Show', 'Cruise'];

  const fetchEvents = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const response = await axios.get(`${API_URL}/api/events/user/${user.id}`);
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching user events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const openEditModal = (event: MyEvent) => {
    setEditingEvent(event);
    setEditTitle(event.title);
    setEditDescription(event.description);
    setEditDate(event.date);
    setEditTime(event.time);
    setEditLocation(event.location);
    setEditAddress(event.address || '');
    setEditCity(event.city);
    setEditEntryFee(event.entryFee || '');
    setEditOrganizer(event.organizer || '');
    setEditContactInfo(event.contactInfo || '');
    setEditWebsite(event.website || '');
    setEditEventType(event.eventType || 'Car Meet');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;
    if (!editTitle.trim() || !editDate.trim() || !editTime.trim() || !editCity.trim()) {
      Alert.alert('Error', 'Title, date, time, and city are required.');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/events/${editingEvent.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        date: editDate.trim(),
        time: editTime.trim(),
        location: editLocation.trim(),
        address: editAddress.trim(),
        city: editCity.trim(),
        entryFee: editEntryFee.trim(),
        organizer: editOrganizer.trim(),
        contactInfo: editContactInfo.trim(),
        website: editWebsite.trim(),
        eventType: editEventType,
      });
      Alert.alert('Success', 'Event updated successfully!');
      setEditModalVisible(false);
      setEditingEvent(null);
      fetchEvents();
    } catch (error: any) {
      console.error('Error updating event:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update event.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = (event: MyEvent) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/events/${event.id}`);
              Alert.alert('Deleted', 'Event has been removed.');
              fetchEvents();
            } catch (error: any) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete event.');
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (event: MyEvent) => {
    if (event.isApproved) {
      return { label: 'Approved', color: '#4CAF50', bg: 'rgba(76,175,80,0.15)' };
    }
    return { label: 'Pending', color: '#FFC107', bg: 'rgba(255,193,7,0.15)' };
  };

  const getDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || '';
  };

  const renderEventCard = ({ item, index }: { item: MyEvent; index: number }) => {
    const status = getStatusBadge(item);
    return (
      <Animated.View entering={FadeInDown.delay(index * 80).springify().damping(14)}>
        <View style={styles.eventCard}>
          {/* Header row */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTypeRow}>
              <Ionicons name="car-sport" size={16} color="#FF6B35" />
              <Text style={styles.cardType}>{item.eventType}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.cardTitle}>{item.title}</Text>

          {/* Details */}
          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={15} color="#888" />
              <Text style={styles.detailText}>
                {item.date} at {item.time}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={15} color="#888" />
              <Text style={styles.detailText} numberOfLines={1}>{item.city}</Text>
            </View>
            {item.entryFee ? (
              <View style={styles.detailRow}>
                <Ionicons name="ticket-outline" size={15} color="#888" />
                <Text style={styles.detailText}>{item.entryFee}</Text>
              </View>
            ) : null}
            {item.isRecurring && item.recurrenceDay !== undefined && (
              <View style={styles.detailRow}>
                <Ionicons name="repeat" size={15} color="#FF6B35" />
                <Text style={[styles.detailText, { color: '#FF6B35' }]}>
                  Every {getDayName(item.recurrenceDay)}
                </Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => openEditModal(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color="#2196F3" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteEvent(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => router.push(`/event/${item.id}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-outline" size={18} color="#FF6B35" />
              <Text style={styles.viewButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Created Events</Text>
        <View style={{ width: 32 }} />
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Animated.View entering={FadeIn.duration(600)}>
            <Ionicons name="calendar-outline" size={64} color="#444" />
          </Animated.View>
          <Text style={styles.emptyTitle}>No Events Yet</Text>
          <Text style={styles.emptySubtitle}>
            Events you create and submit will appear here.
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/(tabs)/add')}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Create an Event</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEventCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
          }
        />
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 20 : insets.top }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Event</Text>
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FF6B35" />
                ) : (
                  <Text style={styles.modalSave}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Event Type Selector */}
              <Text style={styles.fieldLabel}>Event Type</Text>
              <View style={styles.typeSelector}>
                {eventTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeChip,
                      editEventType === type && styles.typeChipActive,
                    ]}
                    onPress={() => setEditEventType(type)}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        editEventType === type && styles.typeChipTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Title *</Text>
              <TextInput
                style={styles.modalInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Event title"
                placeholderTextColor="#555"
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Event description"
                placeholderTextColor="#555"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.fieldLabel}>Date * (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editDate}
                    onChangeText={setEditDate}
                    placeholder="2026-04-15"
                    placeholderTextColor="#555"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.fieldLabel}>Time *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editTime}
                    onChangeText={setEditTime}
                    placeholder="6:00 PM"
                    placeholderTextColor="#555"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.modalInput}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="Venue name"
                placeholderTextColor="#555"
              />

              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput
                style={styles.modalInput}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Street address"
                placeholderTextColor="#555"
              />

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.fieldLabel}>City *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="Oklahoma City"
                    placeholderTextColor="#555"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.fieldLabel}>Entry Fee</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editEntryFee}
                    onChangeText={setEditEntryFee}
                    placeholder="Free"
                    placeholderTextColor="#555"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Organizer</Text>
              <TextInput
                style={styles.modalInput}
                value={editOrganizer}
                onChangeText={setEditOrganizer}
                placeholder="Organizer name"
                placeholderTextColor="#555"
              />

              <Text style={styles.fieldLabel}>Contact Info</Text>
              <TextInput
                style={styles.modalInput}
                value={editContactInfo}
                onChangeText={setEditContactInfo}
                placeholder="Phone or email"
                placeholderTextColor="#555"
              />

              <Text style={styles.fieldLabel}>Website</Text>
              <TextInput
                style={styles.modalInput}
                value={editWebsite}
                onChangeText={setEditWebsite}
                placeholder="https://..."
                placeholderTextColor="#555"
                autoCapitalize="none"
                keyboardType="url"
              />

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  listContent: {
    padding: 16,
    gap: 14,
  },

  // ===== EVENT CARD =====
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardType: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  cardDetails: {
    gap: 6,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: '#999',
    fontSize: 13,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingTop: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(33,150,243,0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  editButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,48,0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,53,0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  viewButtonText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },

  // ===== EMPTY STATE =====
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 24,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // ===== EDIT MODAL =====
  modalContainer: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modalCancel: {
    color: '#888',
    fontSize: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  modalSave: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 16,
  },
  fieldLabel: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 14,
  },
  modalInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalTextArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  typeChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  typeChipText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#fff',
  },
});
