import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import api from '../../utils/api';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import MapErrorBoundary from '../../components/MapErrorBoundary';

// Lazy-load NearbyMapView to prevent crashes on import
let NearbyMapView: React.ComponentType<any> | null = null;
try {
  NearbyMapView = require('../../components/NearbyMapView').default;
} catch (error) {
  console.log('NearbyMapView could not be loaded:', error);
}

interface NearbyUser {
  id: string;
  name: string;
  nickname: string;
  profilePic: string;
  latitude: number;
  longitude: number;
  distance: number;
}

export default function NearbyScreen() {
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [radius, setRadius] = useState(25);
  const [locationPrivate, setLocationPrivate] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [prewrittenMessages, setPrewrittenMessages] = useState<string[]>([]);
  const [selectedMessage, setSelectedMessage] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const locationRef = useRef<{latitude: number; longitude: number} | null>(null);

  // Selection & Pop-Up Invite state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showPopupModal, setShowPopupModal] = useState(false);
  const [popupStep, setPopupStep] = useState<1 | 2 | 3>(1);
  const [wantsLocationShare, setWantsLocationShare] = useState(false);
  const [locationDuration, setLocationDuration] = useState(30);
  const [popupDetails, setPopupDetails] = useState('');
  const [sendingPopup, setSendingPopup] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    initializeLocation();
    fetchPrewrittenMessages();
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useFocusEffect(
    useCallback(() => {
      if (locationRef.current && user) {
        fetchNearbyUsers();
      }
    }, [user, radius])
  );

  useEffect(() => {
    if (location && user) {
      fetchNearbyUsers();
    }
  }, [location, radius, user]);

  useEffect(() => {
    if (user) {
      setLocationPrivate(user.locationPrivate || false);
    }
  }, [user]);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        setLoading(false);
        return;
      }
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      setLocation({ latitude: 35.4676, longitude: -97.5164 });
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyUsers = useCallback(async (isRetry = false) => {
    const loc = locationRef.current || location;
    if (!loc || !user) return;
    try {
      if (!isRetry) setFetchError(false);
      const response = await api.get(`/users/nearby/${user.id}`, {
        params: { latitude: loc.latitude, longitude: loc.longitude, radius },
      });
      if (!isMountedRef.current) return;
      setNearbyUsers(response.data.users || []);
      setFetchError(false);
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Error fetching nearby users:', error);
      if (!isMountedRef.current) return;
      if (retryCountRef.current < 3) {
        retryCountRef.current += 1;
        const delay = retryCountRef.current * 2000;
        setTimeout(() => { if (isMountedRef.current) fetchNearbyUsers(true); }, delay);
      } else {
        setFetchError(true);
      }
    }
  }, [location, radius, user]);

  const fetchPrewrittenMessages = async () => {
    try {
      const response = await api.get('/meetup/prewritten-messages');
      setPrewrittenMessages(response.data.messages);
      if (response.data.messages.length > 0) {
        setSelectedMessage(response.data.messages[0]);
      }
    } catch (error) {
      console.error('Error fetching prewritten messages:', error);
    }
  };

  const togglePrivacy = async (value: boolean) => {
    if (!user) return;
    try {
      setLocationPrivate(value);
      await api.put(`/users/${user.id}`, { locationPrivate: value });
      if (updateUser) {
        updateUser({ ...user, locationPrivate: value });
      }
    } catch (error) {
      console.error('Error updating privacy:', error);
      setLocationPrivate(!value);
    }
  };

  const sendMeetupInvite = async () => {
    if (!user || !location) return;
    const message = useCustomMessage ? customMessage : selectedMessage;
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message for your invite.');
      return;
    }
    setSendingInvite(true);
    try {
      const response = await api.post('/meetup/send-invite', {
        senderId: user.id,
        senderName: user.nickname || user.name,
        senderLatitude: location.latitude,
        senderLongitude: location.longitude,
        radius,
        message,
        isCustomMessage: useCustomMessage,
      });
      Alert.alert(
        'Invite Sent!',
        `Your meetup invite was sent to ${response.data.invitesSent} nearby users.`,
        [{ text: 'OK', onPress: () => setShowInviteModal(false) }]
      );
    } catch (error) {
      console.error('Error sending invite:', error);
      Alert.alert('Error', 'Could not send meetup invite. Please try again.');
    } finally {
      setSendingInvite(false);
    }
  };

  // ====== Selection Mode Helpers ======
  const toggleSelectionMode = () => {
    if (selectionMode) {
      // Exiting selection mode - clear selections
      setSelectedUsers(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === nearbyUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(nearbyUsers.map(u => u.id)));
    }
  };

  // ====== Pop-Up Invite Flow ======
  const openPopupFlow = () => {
    if (selectedUsers.size === 0) {
      Alert.alert('No Users Selected', 'Please select at least one nearby user to invite.');
      return;
    }
    setPopupStep(1);
    setWantsLocationShare(false);
    setLocationDuration(30);
    setPopupDetails('');
    setShowPopupModal(true);
  };

  const handlePopupStep1Yes = () => {
    setPopupStep(2);
  };

  const handlePopupStep2 = (shareLocation: boolean) => {
    setWantsLocationShare(shareLocation);
    setPopupStep(3);
  };

  const sendPopupInvite = async () => {
    if (!user || !location) return;
    setSendingPopup(true);
    Keyboard.dismiss();

    try {
      const response = await api.post('/meetup/send-popup-invite', {
        senderId: user.id,
        senderName: user.nickname || user.name,
        recipientIds: Array.from(selectedUsers),
        message: popupDetails.trim(),
        shareLocation: wantsLocationShare,
        latitude: wantsLocationShare ? location.latitude : null,
        longitude: wantsLocationShare ? location.longitude : null,
        locationDuration,
      });

      Alert.alert(
        'Pop-Up Invites Sent!',
        `Invites sent to ${response.data.invitesSent} user${response.data.invitesSent !== 1 ? 's' : ''}. They'll see your message in their chat.`,
        [{
          text: 'OK',
          onPress: () => {
            setShowPopupModal(false);
            setSelectionMode(false);
            setSelectedUsers(new Set());
          }
        }]
      );
    } catch (error) {
      console.error('Error sending popup invite:', error);
      Alert.alert('Error', 'Could not send pop-up invites. Please try again.');
    } finally {
      setSendingPopup(false);
    }
  };

  // ====== Render Helpers ======
  const renderUserCard = (nearbyUser: NearbyUser, showCheckbox: boolean) => (
    <TouchableOpacity
      key={nearbyUser.id}
      style={[
        styles.userCard,
        showCheckbox && selectedUsers.has(nearbyUser.id) && styles.userCardSelected,
      ]}
      onPress={() => {
        if (showCheckbox) {
          toggleUserSelection(nearbyUser.id);
        }
      }}
      activeOpacity={showCheckbox ? 0.7 : 1}
    >
      {showCheckbox && (
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => toggleUserSelection(nearbyUser.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[
            styles.checkbox,
            selectedUsers.has(nearbyUser.id) && styles.checkboxChecked,
          ]}>
            {selectedUsers.has(nearbyUser.id) && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
      )}
      <View style={styles.userAvatar}>
        <Ionicons name="person" size={24} color="#FF6B35" />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{nearbyUser.nickname || nearbyUser.name}</Text>
        <Text style={styles.userDistance}>{nearbyUser.distance} miles away</Text>
      </View>
      {!showCheckbox && (
        <View style={styles.userActions}>
          <TouchableOpacity
            style={styles.garageButton}
            onPress={() => router.push(`/user-garage/${nearbyUser.id}`)}
          >
            <Ionicons name="car-sport" size={18} color="#FF6B35" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => router.push(`/messages/${nearbyUser.id}`)}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
            <Text style={styles.messageButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  // ====== Early returns ======
  if (!user) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Nearby Enthusiasts</Text>
            <Ionicons name="location" size={28} color="#fff" />
          </View>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle" size={80} color="#666" />
          <Text style={styles.loginPrompt}>Please log in to find nearby car enthusiasts</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </View>
    );
  }

  const allSelected = nearbyUsers.length > 0 && selectedUsers.size === nearbyUsers.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#FF6B35', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Nearby Enthusiasts</Text>
            <Text style={styles.headerSubtitle}>{nearbyUsers.length} users within {radius} miles</Text>
          </View>
          <View style={styles.headerActions}>
            {nearbyUsers.length > 0 && (
              <TouchableOpacity
                style={[styles.headerBtn, selectionMode && styles.headerBtnActive]}
                onPress={toggleSelectionMode}
              >
                <Ionicons
                  name={selectionMode ? "close" : "people"}
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowMap(!showMap)}
            >
              <Ionicons name={showMap ? "list" : "map"} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Selection Mode Toolbar */}
      {selectionMode && nearbyUsers.length > 0 && (
        <View style={styles.selectionBar}>
          <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
            <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
              {allSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={styles.selectAllText}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.selectedCount}>
            {selectedUsers.size} of {nearbyUsers.length} selected
          </Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Visibility Toggle */}
        <View style={styles.privacyBar}>
          <View style={styles.privacyInfo}>
            <Ionicons
              name={locationPrivate ? "eye-off" : "eye"}
              size={20}
              color={locationPrivate ? "#888" : "#4CAF50"}
            />
            <Text style={styles.privacyText}>
              {locationPrivate ? "Hidden from map" : "Visible to others"}
            </Text>
          </View>
          <Switch
            value={!locationPrivate}
            onValueChange={(value) => togglePrivacy(!value)}
            trackColor={{ false: '#444', true: '#4CAF50' }}
            thumbColor="#fff"
          />
        </View>

        {/* Live Map */}
        {showMap && location && (
          NearbyMapView ? (
            <MapErrorBoundary fallbackMessage="The map could not be loaded on this device. Use the list view instead to see nearby car enthusiasts.">
              <NearbyMapView
                location={location}
                radius={radius}
                nearbyUsers={nearbyUsers}
                onCenterOnUser={() => {}}
                onRefresh={initializeLocation}
              />
            </MapErrorBoundary>
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons name="map-outline" size={48} color="#FF6B35" />
              <Text style={styles.mapFallbackTitle}>Map Not Available</Text>
              <Text style={styles.mapFallbackText}>
                Switch to list view to browse nearby users
              </Text>
            </View>
          )
        )}

        {/* Radius Slider */}
        <View style={styles.sliderContainer}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Search Radius</Text>
            <Text style={styles.radiusValue}>{radius} miles</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={50}
            step={1}
            value={radius}
            onValueChange={setRadius}
            minimumTrackTintColor="#FF6B35"
            maximumTrackTintColor="#444"
            thumbTintColor="#FF6B35"
          />
          <View style={styles.sliderMarks}>
            <Text style={styles.sliderMark}>1 mi</Text>
            <Text style={styles.sliderMark}>25 mi</Text>
            <Text style={styles.sliderMark}>50 mi</Text>
          </View>
        </View>

        {/* Nearby Users List */}
        <View style={styles.usersSection}>
          <Text style={styles.sectionTitle}>
            {fetchError
              ? "Couldn't load nearby users"
              : nearbyUsers.length > 0
                ? 'Nearby Car Enthusiasts'
                : 'No users found nearby'}
          </Text>

          {fetchError ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline" size={48} color="#FF5252" />
              <Text style={styles.emptyText}>Check your connection and try again</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => { retryCountRef.current = 0; setFetchError(false); fetchNearbyUsers(); }}
              >
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.retryButtonText}>Tap to Retry</Text>
              </TouchableOpacity>
            </View>
          ) : nearbyUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-sport-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>
                No car enthusiasts found within {radius} miles.
              </Text>
              <Text style={styles.emptySubtext}>
                Try increasing your search radius or check back later!
              </Text>
            </View>
          ) : (
            nearbyUsers.map((nu) => renderUserCard(nu, selectionMode))
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {selectionMode ? (
          <TouchableOpacity
            style={[
              styles.inviteButton,
              styles.popupInviteButton,
              selectedUsers.size === 0 && styles.inviteButtonDisabled,
            ]}
            onPress={openPopupFlow}
            disabled={selectedUsers.size === 0}
          >
            <Ionicons name="flash" size={20} color="#fff" />
            <Text style={styles.inviteButtonText}>
              Send Pop-Up Invite ({selectedUsers.size})
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => setShowInviteModal(true)}
          >
            <Ionicons name="paper-plane" size={20} color="#fff" />
            <Text style={styles.inviteButtonText}>Send Meetup Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ====== Existing Meetup Invite Modal ====== */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Meetup Invite</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              This will notify {nearbyUsers.length} users within {radius} miles
            </Text>
            <View style={styles.messageToggle}>
              <TouchableOpacity
                style={[styles.toggleOption, !useCustomMessage && styles.toggleOptionActive]}
                onPress={() => setUseCustomMessage(false)}
              >
                <Text style={[styles.toggleText, !useCustomMessage && styles.toggleTextActive]}>
                  Prewritten
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleOption, useCustomMessage && styles.toggleOptionActive]}
                onPress={() => setUseCustomMessage(true)}
              >
                <Text style={[styles.toggleText, useCustomMessage && styles.toggleTextActive]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>
            {!useCustomMessage ? (
              <ScrollView style={styles.messageList}>
                {prewrittenMessages.map((msg, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.messageOption, selectedMessage === msg && styles.messageOptionActive]}
                    onPress={() => setSelectedMessage(msg)}
                  >
                    <Text style={styles.messageOptionText}>{msg}</Text>
                    {selectedMessage === msg && (
                      <Ionicons name="checkmark-circle" size={20} color="#FF6B35" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TextInput
                style={styles.customInput}
                placeholder="Type your custom message..."
                placeholderTextColor="#666"
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                maxLength={200}
              />
            )}
            <TouchableOpacity
              style={[styles.sendButton, sendingInvite && styles.sendButtonDisabled]}
              onPress={sendMeetupInvite}
              disabled={sendingInvite}
            >
              {sendingInvite ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.sendButtonText}>Send Invite</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ====== Pop-Up Invite Multi-Step Modal ====== */}
      <Modal
        visible={showPopupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPopupModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.popupModalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {popupStep > 1 && (
                  <TouchableOpacity onPress={() => setPopupStep((popupStep - 1) as 1 | 2 | 3)}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
                <Text style={styles.modalTitle}>Pop-Up Event</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPopupModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Step Indicators */}
            <View style={styles.stepIndicator}>
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  style={[
                    styles.stepDot,
                    popupStep >= s && styles.stepDotActive,
                  ]}
                />
              ))}
            </View>

            {/* ====== STEP 1: Confirm Pop-Up ====== */}
            {popupStep === 1 && (
              <View style={styles.stepContent}>
                <View style={styles.stepIconContainer}>
                  <Ionicons name="flash" size={48} color="#FF6B35" />
                </View>
                <Text style={styles.stepQuestion}>
                  Would you like to send invites for a pop-up event?
                </Text>
                <Text style={styles.stepDescription}>
                  {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected. They'll each receive a personal message in their chat inbox.
                </Text>
                <View style={styles.stepButtons}>
                  <TouchableOpacity
                    style={styles.stepButtonPrimary}
                    onPress={handlePopupStep1Yes}
                  >
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    <Text style={styles.stepButtonPrimaryText}>Yes, let's go!</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButtonSecondary}
                    onPress={() => setShowPopupModal(false)}
                  >
                    <Text style={styles.stepButtonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ====== STEP 2: Share Location? ====== */}
            {popupStep === 2 && (
              <View style={styles.stepContent}>
                <View style={styles.stepIconContainer}>
                  <Ionicons name="location" size={48} color="#4CAF50" />
                </View>
                <Text style={styles.stepQuestion}>
                  Would you like to share your precise location as the pop-up event location?
                </Text>
                <Text style={styles.stepDescription}>
                  Your location will be visible to invited users for a limited time. You can choose the duration.
                </Text>

                {/* Duration Picker */}
                <View style={styles.durationPicker}>
                  <Text style={styles.durationLabel}>Share duration</Text>
                  <View style={styles.durationOptions}>
                    {[15, 30, 45, 60].map((mins) => (
                      <TouchableOpacity
                        key={mins}
                        style={[
                          styles.durationChip,
                          locationDuration === mins && styles.durationChipActive,
                        ]}
                        onPress={() => setLocationDuration(mins)}
                      >
                        <Text style={[
                          styles.durationChipText,
                          locationDuration === mins && styles.durationChipTextActive,
                        ]}>
                          {mins} min
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.stepButtons}>
                  <TouchableOpacity
                    style={styles.stepButtonPrimary}
                    onPress={() => handlePopupStep2(true)}
                  >
                    <Ionicons name="location" size={20} color="#fff" />
                    <Text style={styles.stepButtonPrimaryText}>Yes, share location</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButtonOutline}
                    onPress={() => handlePopupStep2(false)}
                  >
                    <Ionicons name="location-outline" size={20} color="#FF6B35" />
                    <Text style={styles.stepButtonOutlineText}>No, skip this</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ====== STEP 3: Compose Message ====== */}
            {popupStep === 3 && (
              <ScrollView
                style={styles.stepContentScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Preview Banner */}
                <View style={styles.previewBanner}>
                  <LinearGradient
                    colors={['#FF6B35', '#E91E63']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.previewGradient}
                  >
                    <Ionicons name="flash" size={20} color="#fff" />
                    <Text style={styles.previewTitle}>Pop-Up Event Invite</Text>
                  </LinearGradient>
                  <View style={styles.previewBody}>
                    <Text style={styles.previewLine}>
                      <Text style={styles.previewEmoji}>{'🏁 '}</Text>
                      Invite from {user?.nickname || user?.name}
                    </Text>
                    {wantsLocationShare && (
                      <View style={styles.previewLocationTag}>
                        <Ionicons name="location" size={14} color="#4CAF50" />
                        <Text style={styles.previewLocationText}>
                          Live location shared for {locationDuration} min
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Message Input */}
                <Text style={styles.composeLabel}>Add event details (optional)</Text>
                <TextInput
                  style={styles.composeInput}
                  placeholder="e.g. Come check out the new builds! Parking lot behind Target on Memorial..."
                  placeholderTextColor="#555"
                  value={popupDetails}
                  onChangeText={setPopupDetails}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{popupDetails.length}/300</Text>

                {/* Summary */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Invite Summary</Text>
                  <View style={styles.summaryRow}>
                    <Ionicons name="people" size={16} color="#FF6B35" />
                    <Text style={styles.summaryText}>{selectedUsers.size} recipient{selectedUsers.size !== 1 ? 's' : ''}</Text>
                  </View>
                  {wantsLocationShare && (
                    <View style={styles.summaryRow}>
                      <Ionicons name="location" size={16} color="#4CAF50" />
                      <Text style={styles.summaryText}>Location shared for {locationDuration} min</Text>
                    </View>
                  )}
                  <View style={styles.summaryRow}>
                    <Ionicons name="chatbubble" size={16} color="#2196F3" />
                    <Text style={styles.summaryText}>Sent as a personal chat message</Text>
                  </View>
                </View>

                {/* Send Button */}
                <TouchableOpacity
                  style={[styles.sendPopupButton, sendingPopup && styles.sendButtonDisabled]}
                  onPress={sendPopupInvite}
                  disabled={sendingPopup}
                >
                  {sendingPopup ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={20} color="#fff" />
                      <Text style={styles.sendPopupButtonText}>
                        Send Pop-Up Invite{selectedUsers.size > 1 ? 's' : ''}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loginPrompt: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
  },

  // Selection Bar
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectAllText: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '600',
  },
  selectedCount: {
    color: '#aaa',
    fontSize: 13,
  },

  // Checkbox
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },

  // Privacy
  privacyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyText: {
    color: '#fff',
    fontSize: 14,
  },

  // Slider
  sliderContainer: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  radiusValue: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderMark: {
    color: '#666',
    fontSize: 12,
  },

  // Users section
  usersSection: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 16,
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // User cards
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  userCardSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#1a1520',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userDistance: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  garageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },

  // Bottom button container
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#0c0c0c',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  popupInviteButton: {
    backgroundColor: '#E91E63',
  },
  inviteButtonDisabled: {
    opacity: 0.4,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal common
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  messageToggle: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleOptionActive: {
    backgroundColor: '#FF6B35',
  },
  toggleText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  messageList: {
    maxHeight: 250,
    marginBottom: 16,
  },
  messageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  messageOptionActive: {
    backgroundColor: '#333',
    borderColor: '#FF6B35',
    borderWidth: 1,
  },
  messageOptionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  customInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Pop-Up Modal
  popupModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    marginTop: 8,
  },
  stepDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
  },
  stepDotActive: {
    backgroundColor: '#FF6B35',
  },

  // Step Content
  stepContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  stepContentScroll: {
    flex: 1,
  },
  stepIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,107,53,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepQuestion: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  stepDescription: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stepButtons: {
    width: '100%',
    gap: 10,
  },
  stepButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  stepButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  stepButtonSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  stepButtonSecondaryText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  stepButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    gap: 8,
  },
  stepButtonOutlineText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '700',
  },

  // Duration Picker
  durationPicker: {
    width: '100%',
    marginBottom: 24,
  },
  durationLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  durationOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  durationChipActive: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76,175,80,0.15)',
  },
  durationChipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  durationChipTextActive: {
    color: '#4CAF50',
  },

  // Step 3 - Compose
  previewBanner: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  previewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  previewBody: {
    backgroundColor: '#2a2a2a',
    padding: 14,
  },
  previewLine: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  previewEmoji: {
    fontSize: 16,
  },
  previewLocationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(76,175,80,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  previewLocationText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
  },
  composeLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
  },
  composeInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  charCount: {
    color: '#555',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryText: {
    color: '#ccc',
    fontSize: 13,
  },
  sendPopupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E91E63',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  sendPopupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Map fallback
  mapFallback: {
    height: 280,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  mapFallbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  mapFallbackText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
