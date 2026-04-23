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
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Animated, { 
  FadeInRight, 
  FadeIn,
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

import { API_URL } from '../../utils/api';

interface Club {
  id: string;
  name: string;
  description: string;
  location: string;
  focus: string;
  meetingSchedule: string;
  contactEmail: string;
  website: string;
  memberCount: number;
}

export default function ClubsScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [filteredClubs, setFilteredClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Create club form state
  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [clubLocation, setClubLocation] = useState('');
  const [clubCity, setClubCity] = useState('');
  const [clubFocus, setClubFocus] = useState('');
  const [clubSchedule, setClubSchedule] = useState('');
  const [clubContact, setClubContact] = useState('');
  const [clubWebsite, setClubWebsite] = useState('');
  const [clubFacebook, setClubFacebook] = useState('');

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Refetch clubs every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchClubs();
    }, [])
  );

  useEffect(() => {
    if (searchQuery) {
      const filtered = clubs.filter(
        (club) =>
          club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          club.focus.toLowerCase().includes(searchQuery.toLowerCase()) ||
          club.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredClubs(filtered);
    } else {
      setFilteredClubs(clubs);
    }
  }, [searchQuery, clubs]);

  const fetchClubs = useCallback(async (isRetry = false) => {
    try {
      if (!isRetry) setFetchError(false);
      const response = await api.get('/clubs');
      if (!isMountedRef.current) return;
      setClubs(response.data);
      setFilteredClubs(response.data);
      setFetchError(false);
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Error fetching clubs:', error);
      if (!isMountedRef.current) return;
      // Auto-retry up to 3 times with backoff
      if (retryCountRef.current < 3) {
        retryCountRef.current += 1;
        const delay = retryCountRef.current * 2000;
        setTimeout(() => {
          if (isMountedRef.current) fetchClubs(true);
        }, delay);
      } else {
        setFetchError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    retryCountRef.current = 0;
    setFetchError(false);
    fetchClubs();
  };

  const getFocusColor = (focus: string) => {
    if (focus.includes('Mustang') || focus.includes('Ford')) return '#1E88E5';
    if (focus.includes('Corvette') || focus.includes('Camaro') || focus.includes('Chevrolet')) return '#FFD700';
    if (focus.includes('Mopar') || focus.includes('Dodge') || focus.includes('Challenger')) return '#FF3B30';
    if (focus.includes('JDM') || focus.includes('Japanese')) return '#E31837';
    if (focus.includes('European') || focus.includes('BMW') || focus.includes('Porsche')) return '#EFFF00';
    if (focus.includes('Truck') || focus.includes('Jeep')) return '#795548';
    if (focus.includes('Tesla') || focus.includes('Electric')) return '#E31837';
    if (focus.includes('Classic') || focus.includes('Hot Rod')) return '#9C27B0';
    return '#E31837';
  };

  // Animated Club Card Component
  const AnimatedClubCard = ({ item, index }: { item: Club; index: number }) => {
    const focusColor = getFocusColor(item.focus);
    const scale = useSharedValue(1);
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    };
    
    return (
      <Animated.View 
        entering={FadeInRight.delay(index * 80).springify().damping(14)}
      >
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={[styles.clubCard, animatedStyle]}>
            <View style={[styles.clubColorBar, { backgroundColor: focusColor }]} />
            <View style={styles.clubContent}>
              <View style={styles.clubHeader}>
                <Text style={styles.clubName}>{item.name}</Text>
                <View style={[styles.memberBadge, { backgroundColor: `${focusColor}20` }]}>
                  <Ionicons name="people" size={14} color={focusColor} />
                  <Text style={[styles.memberCount, { color: focusColor }]}>{item.memberCount}</Text>
                </View>
              </View>
              
              <View style={[styles.focusBadge, { backgroundColor: `${focusColor}20` }]}>
                <Text style={[styles.focusText, { color: focusColor }]}>{item.focus}</Text>
              </View>
              
              <Text style={styles.clubDescription} numberOfLines={2}>
                {item.description}
              </Text>
              
              <View style={styles.clubDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={14} color="#888" />
                  <Text style={styles.detailText}>{item.location}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={14} color="#888" />
                  <Text style={styles.detailText}>{item.meetingSchedule}</Text>
                </View>
              </View>
              
              <View style={styles.clubActions}>
                {item.contactEmail && (
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="mail-outline" size={18} color="#E31837" />
                    <Text style={styles.actionText}>Contact</Text>
                  </TouchableOpacity>
                )}
                {item.website && (
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="globe-outline" size={18} color="#2196F3" />
                    <Text style={[styles.actionText, { color: '#2196F3' }]}>Website</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Admin actions */}
              {user?.isAdmin && (
                <View style={styles.adminActions}>
                  <TouchableOpacity
                    style={styles.adminEditBtn}
                    onPress={() => router.push(`/admin/edit-club/${item.id}`)}
                  >
                    <Ionicons name="create-outline" size={16} color="#2196F3" />
                    <Text style={styles.adminEditText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.adminDeleteBtn}
                    onPress={() => handleDeleteClub(item)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                    <Text style={styles.adminDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderClubCard = ({ item, index }: { item: Club; index: number }) => (
    <AnimatedClubCard item={item} index={index} />
  );

  const resetForm = () => {
    setClubName('');
    setClubDescription('');
    setClubLocation('');
    setClubCity('');
    setClubFocus('');
    setClubSchedule('');
    setClubContact('');
    setClubWebsite('');
    setClubFacebook('');
  };

  const handleDeleteClub = (club: Club) => {
    Alert.alert(
      'Delete Club',
      `Are you sure you want to delete "${club.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            api.delete(`/clubs/${club.id}`)
              .then(() => {
                setClubs(prev => prev.filter(c => c.id !== club.id));
                setFilteredClubs(prev => prev.filter(c => c.id !== club.id));
                fetchClubs();
              })
              .catch((error: any) => {
                console.error('Error deleting club:', error);
                Alert.alert('Error', error.response?.data?.detail || 'Failed to delete club.');
              });
          },
        },
      ]
    );
  };

  const handleSubmitClub = async () => {
    if (!clubName.trim() || !clubDescription.trim() || !clubCity.trim()) {
      Alert.alert('Required Fields', 'Please fill in the club name, description, and city.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/clubs', {
        name: clubName.trim(),
        description: clubDescription.trim(),
        location: clubLocation.trim(),
        city: clubCity.trim(),
        focus: clubFocus.trim(),
        meetingSchedule: clubSchedule.trim(),
        contactInfo: clubContact.trim(),
        website: clubWebsite.trim(),
        facebookGroup: clubFacebook.trim(),
        carTypes: [],
        userId: user?.id || null,
      });
      Alert.alert('Success', 'Car club created and published successfully!');
      setShowCreateModal(false);
      resetForm();
      fetchClubs();
    } catch (error: any) {
      console.error('Error creating club:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit club.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#9C27B0', '#E31837']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Bike Clubs</Text>
            <Text style={styles.headerSubtitle}>{clubs.length} clubs in Oklahoma</Text>
          </View>
          <Ionicons name="people-circle" size={32} color="#fff" />
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clubs by name, focus, or location..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9C27B0" />
          <Text style={styles.loadingText}>Loading clubs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClubs}
          keyExtractor={(item) => item.id}
          renderItem={renderClubCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#9C27B0"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {fetchError ? (
                <>
                  <Ionicons name="cloud-offline" size={80} color="#FF5252" />
                  <Text style={styles.emptyTitle}>{"Couldn't load clubs"}</Text>
                  <Text style={styles.emptySubtitle}>Check your connection and try again</Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => { retryCountRef.current = 0; setFetchError(false); setLoading(true); fetchClubs(); }}
                  >
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={styles.retryButtonText}>Tap to Retry</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="people-outline" size={80} color="#333" />
                  <Text style={styles.emptyTitle}>No Clubs Found</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery ? 'Try a different search term' : 'Check back later for new clubs'}
                  </Text>
                </>
              )}
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      {isAuthenticated && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#9C27B0', '#E31837']}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Create Club Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 20 : insets.top }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Submit a Club</Text>
              <TouchableOpacity onPress={handleSubmitClub} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#9C27B0" />
                ) : (
                  <Text style={styles.modalSubmit}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fieldLabel}>Club Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={clubName}
                onChangeText={setClubName}
                placeholder="e.g. OKC Mustang Club"
                placeholderTextColor="#555"
              />

              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={clubDescription}
                onChangeText={setClubDescription}
                placeholder="What is your club about?"
                placeholderTextColor="#555"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>Focus / Car Types</Text>
              <TextInput
                style={styles.modalInput}
                value={clubFocus}
                onChangeText={setClubFocus}
                placeholder="e.g. Mustangs, JDM, Classic Cars"
                placeholderTextColor="#555"
              />

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.fieldLabel}>City *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={clubCity}
                    onChangeText={setClubCity}
                    placeholder="Oklahoma City"
                    placeholderTextColor="#555"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.fieldLabel}>Location</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={clubLocation}
                    onChangeText={setClubLocation}
                    placeholder="Meeting spot"
                    placeholderTextColor="#555"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Meeting Schedule</Text>
              <TextInput
                style={styles.modalInput}
                value={clubSchedule}
                onChangeText={setClubSchedule}
                placeholder="e.g. Every Saturday 7PM"
                placeholderTextColor="#555"
              />

              <Text style={styles.fieldLabel}>Contact Info</Text>
              <TextInput
                style={styles.modalInput}
                value={clubContact}
                onChangeText={setClubContact}
                placeholder="Email or phone"
                placeholderTextColor="#555"
              />

              <Text style={styles.fieldLabel}>Website</Text>
              <TextInput
                style={styles.modalInput}
                value={clubWebsite}
                onChangeText={setClubWebsite}
                placeholder="https://..."
                placeholderTextColor="#555"
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text style={styles.fieldLabel}>Facebook Group</Text>
              <TextInput
                style={styles.modalInput}
                value={clubFacebook}
                onChangeText={setClubFacebook}
                placeholder="Facebook group URL"
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
  headerGradient: {
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
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
    paddingTop: 12,
  },
  clubCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  clubColorBar: {
    width: 6,
  },
  clubContent: {
    flex: 1,
    padding: 16,
  },
  clubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  clubName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  memberCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  focusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  focusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clubDescription: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 12,
  },
  clubDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#888',
  },
  clubActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#E31837',
    fontWeight: '600',
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ===== ADMIN ACTIONS =====
  adminActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingTop: 12,
  },
  adminEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(33,150,243,0.12)',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  adminEditText: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '600',
  },
  adminDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,48,0.12)',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  adminDeleteText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
  },

  // ===== FAB =====
  fab: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },

  // ===== CREATE MODAL =====
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
    borderBottomColor: '#141414',
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
  modalSubmit: {
    color: '#9C27B0',
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
    backgroundColor: '#141414',
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
});
