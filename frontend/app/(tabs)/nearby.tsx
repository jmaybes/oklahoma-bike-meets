import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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

  useEffect(() => {
    initializeLocation();
    fetchPrewrittenMessages();
  }, []);

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
      // Default to OKC coordinates for demo
      setLocation({
        latitude: 35.4676,
        longitude: -97.5164,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyUsers = async () => {
    if (!location || !user) return;

    try {
      const response = await axios.get(
        `${API_URL}/api/users/nearby/${user.id}`,
        {
          params: {
            latitude: location.latitude,
            longitude: location.longitude,
            radius: radius,
          },
        }
      );
      setNearbyUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching nearby users:', error);
    }
  };

  const fetchPrewrittenMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/meetup/prewritten-messages`);
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
      await axios.put(`${API_URL}/api/users/${user.id}`, {
        locationPrivate: value,
      });
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
      const response = await axios.post(`${API_URL}/api/meetup/send-invite`, {
        senderId: user.id,
        senderName: user.nickname || user.name,
        senderLatitude: location.latitude,
        senderLongitude: location.longitude,
        radius: radius,
        message: message,
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

  const renderUserCard = ({ item }: { item: NearbyUser }) => (
    <View style={styles.userCard}>
      <View style={styles.userAvatar}>
        <Ionicons name="person" size={24} color="#FF6B35" />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.nickname || item.name}</Text>
        <Text style={styles.userDistance}>{item.distance} miles away</Text>
      </View>
      <Ionicons name="car-sport" size={24} color="#666" />
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
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
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#FF6B35', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Nearby Enthusiasts</Text>
            <Text style={styles.headerSubtitle}>{nearbyUsers.length} users within {radius} miles</Text>
          </View>
          <Ionicons name="location" size={28} color="#fff" />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Privacy Toggle */}
        <View style={styles.privacyBar}>
          <View style={styles.privacyInfo}>
            <Ionicons 
              name={locationPrivate ? "eye-off" : "eye"} 
              size={20} 
              color={locationPrivate ? "#FF6B35" : "#4CAF50"} 
            />
            <Text style={styles.privacyText}>
              {locationPrivate ? "Hidden from map" : "Visible to others"}
            </Text>
          </View>
          <Switch
            value={locationPrivate}
            onValueChange={togglePrivacy}
            trackColor={{ false: '#4CAF50', true: '#FF6B35' }}
            thumbColor="#fff"
          />
        </View>

        {/* Location Info Card */}
        <View style={styles.locationCard}>
          <View style={styles.locationIcon}>
            <Ionicons name="navigate" size={32} color="#FF6B35" />
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.locationTitle}>Your Location</Text>
            {location && (
              <Text style={styles.locationCoords}>
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={initializeLocation}>
            <Ionicons name="refresh" size={20} color="#FF6B35" />
          </TouchableOpacity>
        </View>

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
            {nearbyUsers.length > 0 ? 'Nearby Car Enthusiasts' : 'No users found nearby'}
          </Text>
          
          {nearbyUsers.length === 0 ? (
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
            nearbyUsers.map((nearbyUser) => (
              <View key={nearbyUser.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Ionicons name="person" size={24} color="#FF6B35" />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{nearbyUser.nickname || nearbyUser.name}</Text>
                  <Text style={styles.userDistance}>{nearbyUser.distance} miles away</Text>
                </View>
                <Ionicons name="car-sport" size={24} color="#666" />
              </View>
            ))
          )}
        </View>

        {/* Spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Send Invite Button - Fixed at bottom */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={() => setShowInviteModal(true)}
        >
          <Ionicons name="paper-plane" size={20} color="#fff" />
          <Text style={styles.inviteButtonText}>Send Meetup Invite</Text>
        </TouchableOpacity>
      </View>

      {/* Invite Modal */}
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

            {/* Message Type Toggle */}
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
                    style={[
                      styles.messageOption,
                      selectedMessage === msg && styles.messageOptionActive,
                    ]}
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
    </SafeAreaView>
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
    paddingTop: 10,
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
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  locationCoords: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
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
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
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
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
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
});
