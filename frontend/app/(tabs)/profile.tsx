import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface UserCar {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: string;
  color: string;
  modifications: string;
  description: string;
  photos: string[];
}

export default function ProfileScreen() {
  const { user, isAuthenticated, logout, login } = useAuth();
  const insets = useSafeAreaInsets();
  const [userCar, setUserCar] = useState<UserCar | null>(null);
  const [loadingCar, setLoadingCar] = useState(false);
  const [showCarModal, setShowCarModal] = useState(false);
  const [savingCar, setSavingCar] = useState(false);
  const [carPhotos, setCarPhotos] = useState<string[]>([]);
  
  const [carForm, setCarForm] = useState({
    make: '',
    model: '',
    year: '',
    color: '',
    modifications: '',
    description: '',
  });

  // Feedback states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    type: 'bug',
    subject: '',
    message: '',
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUserCar();
    }
  }, [isAuthenticated, user]);

  const fetchUserCar = async () => {
    try {
      setLoadingCar(true);
      const response = await axios.get(`${API_URL}/api/user-cars/user/${user?.id}`);
      if (response.data) {
        setUserCar(response.data);
        setCarForm({
          make: response.data.make || '',
          model: response.data.model || '',
          year: response.data.year || '',
          color: response.data.color || '',
          modifications: response.data.modifications || '',
          description: response.data.description || '',
        });
        setCarPhotos(response.data.photos || []);
      }
    } catch (error) {
      console.error('Error fetching user car:', error);
    } finally {
      setLoadingCar(false);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (!value) {
      Alert.alert(
        'Disable Notifications?',
        'You will not receive notifications about Pop Up events and other important updates. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await updateNotificationPreference(value);
            },
          },
        ]
      );
    } else {
      await updateNotificationPreference(value);
    }
  };

  const updateNotificationPreference = async (enabled: boolean) => {
    try {
      const response = await axios.put(`${API_URL}/api/users/${user?.id}`, {
        notificationsEnabled: enabled,
      });
      await login(response.data);
      Alert.alert(
        'Success',
        enabled
          ? 'Notifications enabled! You\'ll receive Pop Up event alerts.'
          : 'Notifications disabled.'
      );
    } catch (error) {
      console.error('Error updating notification preference:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const handleLocationToggle = async (value: boolean) => {
    if (!value) {
      Alert.alert(
        'Disable Location Sharing?',
        'Others will not be able to see your location at events. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await updateLocationPreference(value);
            },
          },
        ]
      );
    } else {
      await updateLocationPreference(value);
    }
  };

  const updateLocationPreference = async (enabled: boolean) => {
    try {
      const response = await axios.put(`${API_URL}/api/users/${user?.id}`, {
        locationSharingEnabled: enabled,
      });
      await login(response.data);
      Alert.alert(
        'Success',
        enabled
          ? 'Location sharing enabled! Others can see your location at events.'
          : 'Location sharing disabled.'
      );
    } catch (error) {
      console.error('Error updating location preference:', error);
      Alert.alert('Error', 'Failed to update location settings');
    }
  };

  const pickCarPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload images!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets) {
      const base64Images = result.assets
        .filter(asset => asset.base64)
        .map(asset => `data:image/jpeg;base64,${asset.base64}`);
      
      if (carPhotos.length + base64Images.length > 5) {
        Alert.alert('Limit Reached', 'You can upload a maximum of 5 images');
        return;
      }
      
      setCarPhotos([...carPhotos, ...base64Images]);
    }
  };

  const removeCarPhoto = (index: number) => {
    setCarPhotos(carPhotos.filter((_, i) => i !== index));
  };

  const saveCar = async () => {
    if (!carForm.make || !carForm.model || !carForm.year) {
      Alert.alert('Error', 'Please fill in Make, Model, and Year');
      return;
    }

    setSavingCar(true);
    try {
      const carData = {
        userId: user?.id,
        ...carForm,
        photos: carPhotos,
      };

      let response;
      if (userCar?.id) {
        response = await axios.put(`${API_URL}/api/user-cars/${userCar.id}`, carData);
      } else {
        response = await axios.post(`${API_URL}/api/user-cars`, carData);
      }
      
      setUserCar(response.data);
      setShowCarModal(false);
      Alert.alert('Success', 'Your car has been saved to your garage!');
    } catch (error) {
      console.error('Error saving car:', error);
      Alert.alert('Error', 'Failed to save car. Please try again.');
    } finally {
      setSavingCar(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackForm.subject.trim() || !feedbackForm.message.trim()) {
      Alert.alert('Error', 'Please fill in both subject and message');
      return;
    }

    setSendingFeedback(true);
    try {
      await axios.post(`${API_URL}/api/feedback`, {
        userId: user?.id,
        userName: user?.name,
        userEmail: user?.email,
        type: feedbackForm.type,
        subject: feedbackForm.subject,
        message: feedbackForm.message,
      });

      Alert.alert(
        'Thank You!',
        'Your feedback has been sent to the admin team. We appreciate your input!',
        [{ text: 'OK', onPress: () => {
          setShowFeedbackModal(false);
          setFeedbackForm({ type: 'bug', subject: '', message: '' });
        }}]
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSendingFeedback(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>My Garage</Text>
          <Text style={styles.headerSubtitle}>Showcase your ride</Text>
        </LinearGradient>
        
        <View style={styles.guestContainer}>
          <Ionicons name="car-sport-outline" size={80} color="#333" />
          <Text style={styles.guestTitle}>Guest Mode</Text>
          <Text style={styles.guestText}>
            Login to create your garage, save favorites, RSVP to events, and more
          </Text>
          
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/auth/register')}
          >
            <Text style={styles.registerButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>My Garage</Text>
              <Text style={styles.headerSubtitle}>{user?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCarModal(true)}>
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
        
        {/* Car Showcase */}
        <View style={styles.carShowcaseSection}>
          {loadingCar ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
            </View>
          ) : userCar ? (
            <View style={styles.carCard}>
              {userCar.photos && userCar.photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carPhotosScroll}>
                  {userCar.photos.map((photo, index) => (
                    <Image key={index} source={{ uri: photo }} style={styles.carPhoto} />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.noPhotoContainer}>
                  <Ionicons name="car-sport" size={60} color="#333" />
                  <Text style={styles.noPhotoText}>Add photos of your ride</Text>
                </View>
              )}
              
              <View style={styles.carInfo}>
                <Text style={styles.carTitle}>
                  {userCar.year} {userCar.make} {userCar.model}
                </Text>
                {userCar.color && (
                  <View style={styles.carDetailRow}>
                    <Ionicons name="color-palette" size={16} color="#888" />
                    <Text style={styles.carDetailText}>{userCar.color}</Text>
                  </View>
                )}
                {userCar.modifications && (
                  <View style={styles.carDetailRow}>
                    <Ionicons name="build" size={16} color="#FF6B35" />
                    <Text style={styles.carDetailText}>{userCar.modifications}</Text>
                  </View>
                )}
                {userCar.description && (
                  <Text style={styles.carDescription}>{userCar.description}</Text>
                )}
              </View>
              
              <TouchableOpacity style={styles.editCarButton} onPress={() => setShowCarModal(true)}>
                <Ionicons name="pencil" size={16} color="#FF6B35" />
                <Text style={styles.editCarButtonText}>Edit Car</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addCarCard} onPress={() => setShowCarModal(true)}>
              <Ionicons name="add-circle" size={60} color="#FF6B35" />
              <Text style={styles.addCarTitle}>Add Your Car</Text>
              <Text style={styles.addCarSubtitle}>Showcase your ride with photos and specs</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu Sections */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/messages')}>
            <Ionicons name="chatbubbles" size={24} color="#2196F3" />
            <Text style={styles.menuItemText}>Messages</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/timer/my-runs')}>
            <Ionicons name="speedometer" size={24} color="#FF6B35" />
            <Text style={styles.menuItemText}>My Performance Runs</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/home')}>
            <Ionicons name="heart" size={24} color="#E91E63" />
            <Text style={styles.menuItemText}>My Favorites</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/home')}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.menuItemText}>My RSVPs</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {user?.isAdmin && (
          <View style={styles.menuSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={20} color="#FF6B35" />
              <Text style={styles.sectionHeaderText}>Admin</Text>
            </View>
            <TouchableOpacity 
              style={[styles.menuItem, styles.adminMenuItem]} 
              onPress={() => router.push('/admin/pending')}
            >
              <Ionicons name="time" size={24} color="#FF6B35" />
              <Text style={styles.menuItemText}>Pending Events</Text>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, styles.adminMenuItem]} 
              onPress={() => router.push('/admin/pending-clubs')}
            >
              <Ionicons name="people" size={24} color="#9C27B0" />
              <Text style={styles.menuItemText}>Pending Clubs</Text>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.settingsSectionTitle}>Settings</Text>
          <View style={styles.menuItem}>
            <Ionicons name="notifications" size={24} color="#FF6B35" />
            <Text style={styles.menuItemText}>Notifications</Text>
            <Switch
              value={user?.notificationsEnabled !== false}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#3e3e3e', true: '#FF6B35' }}
              thumbColor={user?.notificationsEnabled !== false ? '#fff' : '#f4f3f4'}
            />
          </View>
          <View style={styles.menuItem}>
            <Ionicons name="location" size={24} color="#4CAF50" />
            <Text style={styles.menuItemText}>Location Sharing</Text>
            <Switch
              value={user?.locationSharingEnabled !== false}
              onValueChange={handleLocationToggle}
              trackColor={{ false: '#3e3e3e', true: '#4CAF50' }}
              thumbColor={user?.locationSharingEnabled !== false ? '#fff' : '#f4f3f4'}
            />
          </View>
          <Text style={styles.settingsHint}>
            Location sharing allows others to see your location at events
          </Text>
        </View>

        {/* Route Planning Section */}
        <View style={styles.menuSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="map" size={20} color="#FF6B35" />
            <Text style={styles.sectionHeaderText}>Route Planning</Text>
          </View>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/routes')}
          >
            <Ionicons name="navigate" size={24} color="#4CAF50" />
            <Text style={styles.menuItemText}>My Scenic Routes</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/routes/create')}
          >
            <Ionicons name="add-circle" size={24} color="#2196F3" />
            <Text style={styles.menuItemText}>Create New Route</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/routes?tab=discover')}
          >
            <Ionicons name="compass" size={24} color="#9C27B0" />
            <Text style={styles.menuItemText}>Discover Routes</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Report Suggestions & Bugs Section */}
        <View style={styles.menuSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#FF6B35" />
            <Text style={styles.sectionHeaderText}>Feedback</Text>
          </View>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => setShowFeedbackModal(true)}
          >
            <Ionicons name="bug" size={24} color="#F44336" />
            <Text style={styles.menuItemText}>Report Bug</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => {
              setFeedbackForm({ ...feedbackForm, type: 'suggestion' });
              setShowFeedbackModal(true);
            }}
          >
            <Ionicons name="bulb" size={24} color="#FFC107" />
            <Text style={styles.menuItemText}>Suggest a Feature</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => {
              setFeedbackForm({ ...feedbackForm, type: 'other' });
              setShowFeedbackModal(true);
            }}
          >
            <Ionicons name="mail" size={24} color="#2196F3" />
            <Text style={styles.menuItemText}>Contact Admin</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/feedback/history')}
          >
            <Ionicons name="time" size={24} color="#9C27B0" />
            <Text style={styles.menuItemText}>My Feedback History</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Car Edit Modal */}
      <Modal
        visible={showCarModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCarModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCarModal(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{userCar ? 'Edit Your Car' : 'Add Your Car'}</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalLabel}>Make *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Ford, Chevrolet, Toyota"
              placeholderTextColor="#666"
              value={carForm.make}
              onChangeText={(text) => setCarForm({ ...carForm, make: text })}
            />

            <Text style={styles.modalLabel}>Model *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Mustang, Camaro, Supra"
              placeholderTextColor="#666"
              value={carForm.model}
              onChangeText={(text) => setCarForm({ ...carForm, model: text })}
            />

            <Text style={styles.modalLabel}>Year *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., 2024"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={carForm.year}
              onChangeText={(text) => setCarForm({ ...carForm, year: text })}
            />

            <Text style={styles.modalLabel}>Color</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Grabber Blue, Triple Yellow"
              placeholderTextColor="#666"
              value={carForm.color}
              onChangeText={(text) => setCarForm({ ...carForm, color: text })}
            />

            <Text style={styles.modalLabel}>Modifications</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="e.g., Cold air intake, exhaust, lowering springs..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              value={carForm.modifications}
              onChangeText={(text) => setCarForm({ ...carForm, modifications: text })}
            />

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Tell us about your ride..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              value={carForm.description}
              onChangeText={(text) => setCarForm({ ...carForm, description: text })}
            />

            <Text style={styles.modalLabel}>Photos (Max 5)</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickCarPhoto}>
              <Ionicons name="images" size={24} color="#FF6B35" />
              <Text style={styles.uploadButtonText}>Upload Photos</Text>
            </TouchableOpacity>

            {carPhotos.length > 0 && (
              <View style={styles.photosPreview}>
                {carPhotos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image source={{ uri: photo }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removeCarPhoto(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveButton, savingCar && styles.saveButtonDisabled]}
              onPress={saveCar}
              disabled={savingCar}
            >
              {savingCar ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Car</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {feedbackForm.type === 'bug' ? 'Report a Bug' : 
               feedbackForm.type === 'suggestion' ? 'Suggest a Feature' : 'Contact Admin'}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.feedbackDescription}>
              {feedbackForm.type === 'bug' 
                ? 'Found something not working? Let us know and we\'ll fix it!' 
                : feedbackForm.type === 'suggestion'
                ? 'Have an idea to make the app better? We\'d love to hear it!'
                : 'Have a question or need help? Send us a message!'}
            </Text>

            <Text style={styles.modalLabel}>Type</Text>
            <View style={styles.feedbackTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.feedbackTypeButton,
                  feedbackForm.type === 'bug' && styles.feedbackTypeButtonActive
                ]}
                onPress={() => setFeedbackForm({ ...feedbackForm, type: 'bug' })}
              >
                <Ionicons 
                  name="bug" 
                  size={20} 
                  color={feedbackForm.type === 'bug' ? '#fff' : '#F44336'} 
                />
                <Text style={[
                  styles.feedbackTypeText,
                  feedbackForm.type === 'bug' && styles.feedbackTypeTextActive
                ]}>Bug</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.feedbackTypeButton,
                  feedbackForm.type === 'suggestion' && styles.feedbackTypeButtonActive
                ]}
                onPress={() => setFeedbackForm({ ...feedbackForm, type: 'suggestion' })}
              >
                <Ionicons 
                  name="bulb" 
                  size={20} 
                  color={feedbackForm.type === 'suggestion' ? '#fff' : '#FFC107'} 
                />
                <Text style={[
                  styles.feedbackTypeText,
                  feedbackForm.type === 'suggestion' && styles.feedbackTypeTextActive
                ]}>Suggestion</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.feedbackTypeButton,
                  feedbackForm.type === 'other' && styles.feedbackTypeButtonActive
                ]}
                onPress={() => setFeedbackForm({ ...feedbackForm, type: 'other' })}
              >
                <Ionicons 
                  name="mail" 
                  size={20} 
                  color={feedbackForm.type === 'other' ? '#fff' : '#2196F3'} 
                />
                <Text style={[
                  styles.feedbackTypeText,
                  feedbackForm.type === 'other' && styles.feedbackTypeTextActive
                ]}>Other</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Subject *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Brief summary of your feedback"
              placeholderTextColor="#666"
              value={feedbackForm.subject}
              onChangeText={(text) => setFeedbackForm({ ...feedbackForm, subject: text })}
            />

            <Text style={styles.modalLabel}>Message *</Text>
            <TextInput
              style={[styles.modalInput, styles.feedbackTextArea]}
              placeholder={
                feedbackForm.type === 'bug' 
                  ? "Please describe the bug, what you expected to happen, and steps to reproduce..."
                  : feedbackForm.type === 'suggestion'
                  ? "Describe your feature idea and how it would improve the app..."
                  : "Write your message here..."
              }
              placeholderTextColor="#666"
              multiline
              numberOfLines={6}
              value={feedbackForm.message}
              onChangeText={(text) => setFeedbackForm({ ...feedbackForm, message: text })}
              textAlignVertical="top"
            />

            <View style={styles.feedbackFromSection}>
              <Ionicons name="person-circle" size={24} color="#666" />
              <Text style={styles.feedbackFromText}>
                Sending as: {user?.name} ({user?.email})
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, sendingFeedback && styles.saveButtonDisabled]}
              onPress={submitFeedback}
              disabled={sendingFeedback}
            >
              {sendingFeedback ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Send Feedback</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
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
  headerRow: {
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
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  guestText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 32,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  guestMenuSection: {
    width: '100%',
    marginTop: 32,
  },
  guestMenuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  guestMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  guestMenuText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  carShowcaseSection: {
    padding: 20,
  },
  carCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  carPhotosScroll: {
    height: 200,
  },
  carPhoto: {
    width: 300,
    height: 200,
    marginRight: 8,
  },
  noPhotoContainer: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
  },
  noPhotoText: {
    color: '#666',
    marginTop: 8,
  },
  carInfo: {
    padding: 16,
  },
  carTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  carDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  carDetailText: {
    color: '#aaa',
    marginLeft: 8,
    fontSize: 14,
  },
  carDescription: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  editCarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  editCarButtonText: {
    color: '#FF6B35',
    marginLeft: 8,
    fontWeight: '600',
  },
  addCarCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
  },
  addCarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  addCarSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  adminMenuItem: {
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  settingsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    margin: 20,
    marginTop: 24,
    marginBottom: 40,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalContent: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  modalInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  uploadButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  photosPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  photoContainer: {
    position: 'relative',
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#0c0c0c',
    borderRadius: 12,
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  feedbackDescription: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  feedbackTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  feedbackTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  feedbackTypeButtonActive: {
    backgroundColor: '#FF6B35',
  },
  feedbackTypeText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackTypeTextActive: {
    color: '#fff',
  },
  feedbackTextArea: {
    height: 150,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  feedbackFromSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  feedbackFromText: {
    color: '#888',
    fontSize: 13,
  },
});
