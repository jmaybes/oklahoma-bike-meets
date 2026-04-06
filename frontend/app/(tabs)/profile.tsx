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
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Garage3DCarousel from '../../components/Garage3DCarousel';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://event-hub-okc-1.preview.emergentagent.com';

interface Modification {
  category: string;
  name: string;
  brand?: string;
  description?: string;
}

interface UserCar {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: string;
  color: string;
  trim: string;
  engine: string;
  horsepower?: number;
  torque?: number;
  transmission: string;
  drivetrain: string;
  description: string;
  photos: string[];
  videos: string[];
  modifications: Modification[];
  modificationNotes: string;
  isPublic: boolean;
  instagramHandle: string;
  youtubeChannel: string;
}

export default function ProfileScreen() {
  const { user, isAuthenticated, logout, login } = useAuth();
  const insets = useSafeAreaInsets();
  const [userCar, setUserCar] = useState<UserCar | null>(null);
  const [loadingCar, setLoadingCar] = useState(false);
  const [showCarModal, setShowCarModal] = useState(false);
  const [savingCar, setSavingCar] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState('');
  const [photoUploadCount, setPhotoUploadCount] = useState(0);
  const [carPhotos, setCarPhotos] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [garagePublic, setGaragePublic] = useState(true);
  
  const [carForm, setCarForm] = useState({
    make: '',
    model: '',
    year: '',
    color: '',
    trim: '',
    engine: '',
    horsepower: '',
    torque: '',
    transmission: '',
    drivetrain: '',
    description: '',
    modificationNotes: '',
    instagramHandle: '',
    youtubeChannel: '',
  });
  
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');

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
      fetchUserCar(true);
    }
  }, [isAuthenticated, user]);

  const fetchUserCar = async (includeAllPhotos = false) => {
    try {
      setLoadingCar(true);
      const url = includeAllPhotos 
        ? `${API_URL}/api/user-cars/user/${user?.id}?include_photos=true`
        : `${API_URL}/api/user-cars/user/${user?.id}`;
      const response = await axios.get(url);
      if (response.data) {
        setUserCar(response.data);
        setCarForm({
          make: response.data.make || '',
          model: response.data.model || '',
          year: response.data.year || '',
          color: response.data.color || '',
          trim: response.data.trim || '',
          engine: response.data.engine || '',
          horsepower: response.data.horsepower?.toString() || '',
          torque: response.data.torque?.toString() || '',
          transmission: response.data.transmission || '',
          drivetrain: response.data.drivetrain || '',
          description: response.data.description || '',
          modificationNotes: response.data.modificationNotes || '',
          instagramHandle: response.data.instagramHandle || '',
          youtubeChannel: response.data.youtubeChannel || '',
        });
        setCarPhotos(response.data.photos || []);
        setMainPhotoIndex(response.data.mainPhotoIndex || 0);
        setVideoUrls(response.data.videos || []);
        setGaragePublic(response.data.isPublic !== false);
      }
    } catch (error) {
      console.error('Error fetching user car:', error);
    } finally {
      setLoadingCar(false);
    }
  };

  const toggleGaragePublic = async (value: boolean) => {
    setGaragePublic(value);
    
    if (userCar?.id) {
      try {
        await axios.put(`${API_URL}/api/user-cars/${userCar.id}`, {
          isPublic: value,
        });
        Alert.alert(
          'Success',
          value 
            ? 'Your garage is now public! Others can see your build.' 
            : 'Your garage is now private.'
        );
      } catch (error) {
        console.error('Error updating garage privacy:', error);
        setGaragePublic(!value); // Revert on error
        Alert.alert('Error', 'Failed to update privacy setting');
      }
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
      quality: 0.5,
      base64: false,
    });

    if (!result.canceled && result.assets) {
      if (carPhotos.length + result.assets.length > 10) {
        Alert.alert('Limit Reached', 'You can upload a maximum of 10 images');
        return;
      }

      // Compress and resize each image aggressively for reliable uploads
      const compressedImages: string[] = [];
      for (const asset of result.assets) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 800 } }],
            { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          if (manipulated.base64) {
            compressedImages.push(`data:image/jpeg;base64,${manipulated.base64}`);
          }
        } catch (err) {
          console.error('Image compression error:', err);
        }
      }

      setCarPhotos([...carPhotos, ...compressedImages]);
    }
  };

  const removeCarPhoto = (index: number) => {
    setCarPhotos(carPhotos.filter((_, i) => i !== index));
    // Adjust mainPhotoIndex if needed
    if (index === mainPhotoIndex) {
      setMainPhotoIndex(0);
    } else if (index < mainPhotoIndex) {
      setMainPhotoIndex(mainPhotoIndex - 1);
    }
  };

  const addVideoUrl = () => {
    if (!newVideoUrl.trim()) {
      Alert.alert('Error', 'Please enter a video URL');
      return;
    }
    
    // Basic URL validation
    if (!newVideoUrl.match(/^https?:\/\/.+/i)) {
      Alert.alert('Invalid URL', 'Please enter a valid URL starting with http:// or https://');
      return;
    }
    
    if (videoUrls.length >= 5) {
      Alert.alert('Limit Reached', 'You can add up to 5 video links');
      return;
    }
    
    setVideoUrls([...videoUrls, newVideoUrl.trim()]);
    setNewVideoUrl('');
  };

  const removeVideoUrl = (index: number) => {
    setVideoUrls(videoUrls.filter((_, i) => i !== index));
  };

  const saveCar = async () => {
    if (!carForm.make || !carForm.model || !carForm.year) {
      Alert.alert('Error', 'Please fill in Make, Model, and Year');
      return;
    }

    setSavingCar(true);
    setPhotoUploadProgress('');
    setPhotoUploadCount(0);
    try {
      // Step 1: Save car metadata WITHOUT photos (small payload, always works)
      const metadataPayload = {
        userId: user?.id,
        make: carForm.make,
        model: carForm.model,
        year: carForm.year,
        color: carForm.color,
        trim: carForm.trim,
        engine: carForm.engine,
        horsepower: carForm.horsepower ? parseInt(carForm.horsepower) : null,
        torque: carForm.torque ? parseInt(carForm.torque) : null,
        transmission: carForm.transmission,
        drivetrain: carForm.drivetrain,
        description: carForm.description,
        photos: [],  // Photos uploaded separately
        videos: videoUrls,
        modifications: [],
        modificationNotes: carForm.modificationNotes,
        isPublic: garagePublic,
        instagramHandle: carForm.instagramHandle,
        youtubeChannel: carForm.youtubeChannel,
        mainPhotoIndex: Math.min(mainPhotoIndex, Math.max(0, carPhotos.length - 1)),
      };

      setPhotoUploadProgress('Saving car info...');
      let carResponse;
      try {
        carResponse = await axios.post(`${API_URL}/api/user-cars/create-or-update-metadata`, metadataPayload);
      } catch (metaError: any) {
        console.error('Metadata save error:', metaError);
        throw new Error('Failed to save car details. Please try again.');
      }

      const savedCarId = carResponse.data?.id;
      if (!savedCarId) {
        throw new Error('Failed to get car ID after save');
      }

      // Step 2: Figure out which photos need to be uploaded
      // Existing photos (already in DB) start with "data:image" and are from the server
      // We need to determine which photos are NEW vs already stored
      const existingPhotoCount = carResponse.data?.photoCount || 0;
      
      // If the user hasn't changed photos (same count, no new ones), skip upload
      const newPhotos = carPhotos.filter(p => p && p.length > 0);
      
      if (newPhotos.length > 0) {
        // Clear existing photos first, then upload all current ones fresh
        // This ensures the photo order matches what the user sees
        setPhotoUploadProgress('Preparing photos...');
        
        // Delete all existing photos by setting to empty array, then upload fresh
        try {
          await axios.put(`${API_URL}/api/user-cars/${savedCarId}`, {
            photos: [],
            mainPhotoIndex: 0,
          });
        } catch (clearErr) {
          console.log('Note: Could not clear old photos, continuing with upload');
        }

        // Step 3: Upload each photo individually (chunked - bypasses proxy limits)
        let uploadedCount = 0;
        let failedCount = 0;
        for (let i = 0; i < newPhotos.length; i++) {
          setPhotoUploadProgress(`Uploading photo ${i + 1} of ${newPhotos.length}...`);
          setPhotoUploadCount(i + 1);
          try {
            await axios.post(
              `${API_URL}/api/user-cars/${savedCarId}/photos/upload?user_id=${user?.id}`,
              { photo: newPhotos[i] },
              { timeout: 30000 }
            );
            uploadedCount++;
          } catch (photoErr: any) {
            failedCount++;
            console.error(`Failed to upload photo ${i + 1}:`, photoErr?.response?.status, photoErr?.message);
            // Continue uploading remaining photos
          }
        }

        // Step 4: Set the main photo index
        if (uploadedCount > 0) {
          try {
            const adjustedIndex = Math.min(mainPhotoIndex, uploadedCount - 1);
            await axios.put(`${API_URL}/api/user-cars/${savedCarId}`, {
              mainPhotoIndex: adjustedIndex,
            });
          } catch (idxErr) {
            console.log('Note: Could not set main photo index');
          }
        }

        if (failedCount > 0 && uploadedCount === 0) {
          throw new Error(`All ${failedCount} photos failed to upload. Your car info was saved but photos could not be uploaded. This may be due to image size limits.`);
        } else if (failedCount > 0) {
          Alert.alert(
            'Partially Saved',
            `Car saved! ${uploadedCount} of ${newPhotos.length} photos uploaded successfully. ${failedCount} photo(s) were too large and skipped.`
          );
        }
      }

      setPhotoUploadProgress('');
      // Refresh car data
      const refreshed = await axios.get(`${API_URL}/api/user-cars/user/${user?.id}?include_photos=true`);
      setUserCar(refreshed.data);
      setShowCarModal(false);
      if (!newPhotos.length || carPhotos.length === 0) {
        Alert.alert('Success', 'Your car has been saved to your garage!');
      } else {
        Alert.alert('Success', 'Your car and photos have been saved!');
      }
    } catch (error: any) {
      console.error('Error saving car:', error);
      let errorMsg = error?.message || 'Failed to save car. Please try again.';
      if (error?.response?.status === 413) {
        errorMsg = 'Data too large. Try removing some photos or using lower resolution images.';
      } else if (error?.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error?.message?.includes?.('Network')) {
        errorMsg = 'Network error. Please check your connection and try again.';
      } else if (error?.message?.includes?.('timeout')) {
        errorMsg = 'Upload timed out. Try with fewer or smaller photos.';
      }
      Alert.alert('Error Saving Garage', errorMsg);
    } finally {
      setSavingCar(false);
      setPhotoUploadProgress('');
      setPhotoUploadCount(0);
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
      <View style={styles.container}>
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
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
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>My Garage</Text>
              <Text style={styles.headerSubtitle}>{user?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => { fetchUserCar(true); setShowCarModal(true); }}>
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
                <View style={styles.carMainPhotoContainer}>
                  <Garage3DCarousel photos={userCar.photos} />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                    style={styles.carPhotoGradient}
                  />
                  <View style={styles.carPhotoCountBadge}>
                    <Ionicons name="images" size={13} color="#fff" />
                    <Text style={styles.carPhotoCountText}>{(userCar as any).photoCount || userCar.photos.length}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.viewPicsButton}
                    onPress={() => router.push(`/garage/${userCar.id}`)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images-outline" size={12} color="#fff" />
                    <Text style={styles.viewPicsText}>View Pics</Text>
                  </TouchableOpacity>
                </View>
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
                {userCar.trim && (
                  <Text style={styles.carTrim}>{userCar.trim}</Text>
                )}
                <View style={styles.carStatsRow}>
                  {userCar.color && (
                    <View style={styles.carDetailRow}>
                      <Ionicons name="color-palette" size={16} color="#888" />
                      <Text style={styles.carDetailText}>{userCar.color}</Text>
                    </View>
                  )}
                  {userCar.horsepower && (
                    <View style={styles.carDetailRow}>
                      <Ionicons name="flash" size={16} color="#FF6B35" />
                      <Text style={styles.carDetailText}>{userCar.horsepower} HP</Text>
                    </View>
                  )}
                </View>
                {userCar.engine && (
                  <View style={styles.carDetailRow}>
                    <Ionicons name="speedometer" size={16} color="#2196F3" />
                    <Text style={styles.carDetailText}>{userCar.engine}</Text>
                  </View>
                )}
                {userCar.modificationNotes && (
                  <View style={styles.carDetailRow}>
                    <Ionicons name="build" size={16} color="#4CAF50" />
                    <Text style={styles.carDetailText}>{userCar.modificationNotes}</Text>
                  </View>
                )}
                {userCar.videos && userCar.videos.length > 0 && (
                  <View style={styles.carDetailRow}>
                    <Ionicons name="videocam" size={16} color="#9C27B0" />
                    <Text style={styles.carDetailText}>{userCar.videos.length} video{userCar.videos.length !== 1 ? 's' : ''}</Text>
                  </View>
                )}
                {userCar.description && (
                  <Text style={styles.carDescription}>{userCar.description}</Text>
                )}
              </View>
              
              <TouchableOpacity style={styles.editCarButton} onPress={() => { fetchUserCar(true); setShowCarModal(true); }}>
                <Ionicons name="pencil" size={16} color="#FF6B35" />
                <Text style={styles.editCarButtonText}>Edit Car & Photos</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addCarCard} onPress={() => setShowCarModal(true)}>
              <View style={styles.nudgeBadge}>
                <Ionicons name="construct" size={12} color="#fff" />
                <Text style={styles.nudgeBadgeText}>FIXED & READY</Text>
              </View>
              <Ionicons name="car-sport" size={56} color="#FF6B35" />
              <Text style={styles.addCarTitle}>Set Up Your Garage!</Text>
              <Text style={styles.addCarSubtitle}>
                We've fixed the saving issues — your garage will save correctly now. Add your ride with photos, specs, and mods!
              </Text>
              <View style={styles.nudgeButton}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.nudgeButtonText}>Get Started</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* View Public Garages Link - prominent placement */}
        <TouchableOpacity 
          style={styles.publicGarageLink}
          onPress={() => router.push('/garage')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#1e1e1e', '#252525']}
            style={styles.publicGarageLinkGradient}
          >
            <View style={styles.publicGarageLinkContent}>
              <View style={styles.publicGarageLinkLeft}>
                <Ionicons name="people" size={24} color="#FF6B35" />
                <View>
                  <Text style={styles.publicGarageLinkTitle}>View Public Garages</Text>
                  <Text style={styles.publicGarageLinkSub}>Browse and like community builds</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#FF6B35" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Community Lounge Link */}
        <TouchableOpacity 
          style={styles.publicGarageLink}
          onPress={() => router.push('/feeds')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#1e1e1e', '#252525']}
            style={styles.publicGarageLinkGradient}
          >
            <View style={styles.publicGarageLinkContent}>
              <View style={styles.publicGarageLinkLeft}>
                <Ionicons name="chatbubbles" size={24} color="#FF6B35" />
                <View>
                  <Text style={styles.publicGarageLinkTitle}>Community Lounge</Text>
                  <Text style={styles.publicGarageLinkSub}>Share posts and connect with the community</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#FF6B35" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

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

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/timer')}>
            <Ionicons name="timer" size={24} color="#E91E63" />
            <Text style={styles.menuItemText}>Performance Timer</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/timer/leaderboard')}>
            <Ionicons name="trophy" size={24} color="#FFC107" />
            <Text style={styles.menuItemText}>Area Leaderboards</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/my-rsvps')}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.menuItemText}>My RSVPs</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/my-favorites')}>
            <Ionicons name="heart" size={24} color="#E91E63" />
            <Text style={styles.menuItemText}>My Favorite Events</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/my-events')}>
            <Ionicons name="create" size={24} color="#FF6B35" />
            <Text style={styles.menuItemText}>My Created Events</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/garage/tagged-photos')}>
            <Ionicons name="images" size={24} color="#9C27B0" />
            <Text style={styles.menuItemText}>Tagged Photos</Text>
            <View style={styles.menuItemBadge}>
              <Text style={styles.menuItemBadgeText}>NEW</Text>
            </View>
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
            <TouchableOpacity 
              style={[styles.menuItem, styles.adminMenuItem]} 
              onPress={() => router.push('/admin/feedback')}
            >
              <Ionicons name="chatbubble-ellipses" size={24} color="#2196F3" />
              <Text style={styles.menuItemText}>Manage Feedback</Text>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, styles.adminMenuItem]} 
              onPress={() => router.push('/admin/event-search')}
            >
              <Ionicons name="search" size={24} color="#4CAF50" />
              <Text style={styles.menuItemText}>Event Search</Text>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, styles.adminMenuItem]} 
              onPress={() => router.push('/admin/broadcast')}
            >
              <Ionicons name="megaphone" size={24} color="#FF9800" />
              <Text style={styles.menuItemText}>Broadcast Message</Text>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.settingsSectionTitle}>Settings</Text>
          
          {/* Debug: Server connection info */}
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: '#1a1a2e' }]}
            onPress={() => Alert.alert('Server Info', `Connected to:\n${API_URL || 'NOT SET'}`)}
          >
            <Ionicons name="server" size={24} color="#FF6B35" />
            <Text style={[styles.menuItemText, { fontSize: 11, color: '#888' }]}>
              Server: {API_URL ? API_URL.replace('https://', '').split('.')[0] : 'NOT SET'}
            </Text>
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <Ionicons name="notifications" size={24} color={user?.notificationsEnabled !== false ? '#4CAF50' : '#F44336'} />
            <Text style={styles.menuItemText}>Notifications</Text>
            <Switch
              value={user?.notificationsEnabled !== false}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#F44336', true: '#4CAF50' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.menuItem}>
            <Ionicons name="location" size={24} color={user?.locationSharingEnabled !== false ? '#4CAF50' : '#F44336'} />
            <Text style={styles.menuItemText}>Location Sharing</Text>
            <Switch
              value={user?.locationSharingEnabled !== false}
              onValueChange={handleLocationToggle}
              trackColor={{ false: '#F44336', true: '#4CAF50' }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.settingsHint}>
            Location sharing allows others to see your location at events
          </Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={async () => {
              Alert.alert(
                'Clear Saved Login',
                'This will remove your saved login credentials from this device. You will need to enter them again next time.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await SecureStore.deleteItemAsync('rememberMe');
                        await SecureStore.deleteItemAsync('savedEmail');
                        await SecureStore.deleteItemAsync('savedPassword');
                        Alert.alert('Success', 'Saved login credentials have been cleared.');
                      } catch (error) {
                        console.error('Error clearing credentials:', error);
                        Alert.alert('Error', 'Failed to clear saved credentials.');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="key" size={24} color="#FFC107" />
            <Text style={styles.menuItemText}>Clear Saved Login</Text>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.settingsHint}>
            Remove saved login credentials from this device
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

        {/* Garage Visibility Section */}
        <View style={styles.menuSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye" size={20} color="#FF6B35" />
            <Text style={styles.sectionHeaderText}>Garage Visibility</Text>
          </View>
          <View style={[
            styles.visibilityToggleCard,
            { borderColor: garagePublic ? '#4CAF50' : '#FF5252', borderWidth: 1.5 }
          ]}>
            <View style={styles.visibilityStatusRow}>
              <View style={[
                styles.visibilityBadge,
                { backgroundColor: garagePublic ? 'rgba(76,175,80,0.15)' : 'rgba(255,82,82,0.15)' }
              ]}>
                <Ionicons 
                  name={garagePublic ? "globe-outline" : "lock-closed"} 
                  size={20} 
                  color={garagePublic ? "#4CAF50" : "#FF5252"} 
                />
                <Text style={[
                  styles.visibilityBadgeText,
                  { color: garagePublic ? '#4CAF50' : '#FF5252' }
                ]}>
                  {garagePublic ? 'PUBLIC' : 'PRIVATE'}
                </Text>
              </View>
              <Switch
                value={garagePublic}
                onValueChange={toggleGaragePublic}
                trackColor={{ false: '#FF5252', true: '#4CAF50' }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.visibilityDescription}>
              {garagePublic 
                ? 'Your garage is visible to everyone in Community Garages. Other users can browse, view, and like your build.'
                : 'Your garage is hidden. Only you can see it. Turn on to share your build with the community.'}
            </Text>
          </View>
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

        <TouchableOpacity style={styles.logoutButton} onPress={() => router.push('/account-settings')}>
          <Ionicons name="settings-outline" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>Log Out or Delete Account</Text>
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
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCarModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{userCar ? 'Edit Your Car' : 'Add Your Car'}</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Basic Info */}
              <Text style={styles.modalSectionTitle}>Basic Information</Text>
              
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

              <Text style={styles.modalLabel}>Trim</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., GT, SS, TRD Pro"
                placeholderTextColor="#666"
                value={carForm.trim}
                onChangeText={(text) => setCarForm({ ...carForm, trim: text })}
              />

              <Text style={styles.modalLabel}>Color</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Grabber Blue, Triple Yellow"
                placeholderTextColor="#666"
                value={carForm.color}
                onChangeText={(text) => setCarForm({ ...carForm, color: text })}
              />

              {/* Performance Specs */}
              <Text style={[styles.modalSectionTitle, { marginTop: 24 }]}>Performance Specs</Text>

              <Text style={styles.modalLabel}>Engine</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., 5.0L V8, 2JZ-GTE, LS3"
                placeholderTextColor="#666"
                value={carForm.engine}
                onChangeText={(text) => setCarForm({ ...carForm, engine: text })}
              />

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.modalLabel}>Horsepower</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., 450"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={carForm.horsepower}
                    onChangeText={(text) => setCarForm({ ...carForm, horsepower: text })}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.modalLabel}>Torque (lb-ft)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., 410"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={carForm.torque}
                    onChangeText={(text) => setCarForm({ ...carForm, torque: text })}
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>Transmission</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., 6-Speed Manual, 10-Speed Auto"
                placeholderTextColor="#666"
                value={carForm.transmission}
                onChangeText={(text) => setCarForm({ ...carForm, transmission: text })}
              />

              <Text style={styles.modalLabel}>Drivetrain</Text>
              <View style={styles.drivetrainOptions}>
                {['RWD', 'FWD', 'AWD', '4WD'].map((dt) => (
                  <TouchableOpacity
                    key={dt}
                    style={[
                      styles.drivetrainButton,
                      carForm.drivetrain === dt && styles.drivetrainButtonActive
                    ]}
                    onPress={() => setCarForm({ ...carForm, drivetrain: dt })}
                  >
                    <Text style={[
                      styles.drivetrainText,
                      carForm.drivetrain === dt && styles.drivetrainTextActive
                    ]}>{dt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Modifications */}
              <Text style={[styles.modalSectionTitle, { marginTop: 24 }]}>Modifications</Text>

              <Text style={styles.modalLabel}>Modification List</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="List your mods: cold air intake, exhaust, lowering springs, wheels, etc..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={5}
                value={carForm.modificationNotes}
                onChangeText={(text) => setCarForm({ ...carForm, modificationNotes: text })}
                textAlignVertical="top"
              />

              {/* Photos */}
              <Text style={[styles.modalSectionTitle, { marginTop: 24 }]}>Photos</Text>
              
              <Text style={styles.modalLabel}>Photos (Max 10)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={pickCarPhoto}>
                <Ionicons name="images" size={24} color="#FF6B35" />
                <Text style={styles.uploadButtonText}>Upload Photos</Text>
              </TouchableOpacity>
              <Text style={styles.photoHint}>
                Tip: Tap the star to set a cover photo. Tap X to delete.
              </Text>

              {carPhotos.length > 0 && (
                <View style={styles.photosPreview}>
                  {carPhotos.map((photo, index) => (
                    <View key={index} style={[
                      styles.photoContainer,
                      index === mainPhotoIndex && styles.photoContainerMain,
                    ]}>
                      <Image source={{ uri: photo }} style={styles.photoPreview} />
                      {/* Cover badge */}
                      {index === mainPhotoIndex && (
                        <View style={styles.coverBadge}>
                          <Text style={styles.coverBadgeText}>COVER</Text>
                        </View>
                      )}
                      {/* Set as Cover button */}
                      <TouchableOpacity
                        style={[
                          styles.setCoverButton,
                          index === mainPhotoIndex && styles.setCoverButtonActive,
                        ]}
                        onPress={() => setMainPhotoIndex(index)}
                      >
                        <Ionicons 
                          name={index === mainPhotoIndex ? "star" : "star-outline"} 
                          size={18} 
                          color={index === mainPhotoIndex ? "#FFD700" : "#fff"} 
                        />
                      </TouchableOpacity>
                      {/* Delete button */}
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

              {/* Videos */}
              <Text style={[styles.modalSectionTitle, { marginTop: 24 }]}>Videos</Text>
              
              <Text style={styles.modalLabel}>Video Links (Max 5)</Text>
              <Text style={styles.modalHint}>Add YouTube or other video links to show off your car</Text>
              
              <View style={styles.videoInputRow}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor="#666"
                  value={newVideoUrl}
                  onChangeText={setNewVideoUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.addVideoButton} onPress={addVideoUrl}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {videoUrls.length > 0 && (
                <View style={styles.videoList}>
                  {videoUrls.map((url, index) => (
                    <View key={index} style={styles.videoItem}>
                      <Ionicons name="videocam" size={20} color="#9C27B0" />
                      <Text style={styles.videoUrl} numberOfLines={1}>{url}</Text>
                      <TouchableOpacity onPress={() => removeVideoUrl(index)}>
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Social & Visibility */}
              <Text style={[styles.modalSectionTitle, { marginTop: 24 }]}>Social & Visibility</Text>

              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Tell us about your ride, its story, future plans..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                value={carForm.description}
                onChangeText={(text) => setCarForm({ ...carForm, description: text })}
                textAlignVertical="top"
              />

              <Text style={styles.modalLabel}>Instagram Handle</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="@yourusername"
                placeholderTextColor="#666"
                value={carForm.instagramHandle}
                onChangeText={(text) => setCarForm({ ...carForm, instagramHandle: text })}
                autoCapitalize="none"
              />

              <Text style={styles.modalLabel}>YouTube Channel URL</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="https://youtube.com/@yourchannel"
                placeholderTextColor="#666"
                value={carForm.youtubeChannel}
                onChangeText={(text) => setCarForm({ ...carForm, youtubeChannel: text })}
                autoCapitalize="none"
              />

              <View style={[
                styles.publicToggleContainer,
                { borderColor: garagePublic ? '#4CAF50' : '#FF5252', borderWidth: 1.5 }
              ]}>
                <View style={styles.publicToggleInfo}>
                  <View style={[
                    styles.visibilityBadge,
                    { backgroundColor: garagePublic ? 'rgba(76,175,80,0.15)' : 'rgba(255,82,82,0.15)' }
                  ]}>
                    <Ionicons 
                      name={garagePublic ? "globe-outline" : "lock-closed"} 
                      size={18} 
                      color={garagePublic ? "#4CAF50" : "#FF5252"} 
                    />
                    <Text style={[
                      styles.visibilityBadgeText,
                      { color: garagePublic ? '#4CAF50' : '#FF5252' }
                    ]}>
                      {garagePublic ? 'PUBLIC' : 'PRIVATE'}
                    </Text>
                  </View>
                  <Text style={styles.publicToggleHint}>
                    {garagePublic 
                      ? 'Visible to everyone in Community Garages' 
                      : 'Hidden — only you can see your garage'}
                  </Text>
                </View>
                <Switch
                  value={garagePublic}
                  onValueChange={setGaragePublic}
                  trackColor={{ false: '#FF5252', true: '#4CAF50' }}
                  thumbColor="#fff"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, savingCar && styles.saveButtonDisabled]}
                onPress={saveCar}
                disabled={savingCar}
              >
                {savingCar ? (
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <ActivityIndicator color="#fff" />
                    {photoUploadProgress ? (
                      <Text style={{ color: '#fff', fontSize: 12 }}>{photoUploadProgress}</Text>
                    ) : null}
                  </View>
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Save Car</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
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
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
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
          </KeyboardAvoidingView>
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  carShowcaseSection: {
    paddingVertical: 20,
    paddingHorizontal: 0,
  },
  carCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 0,
    overflow: 'hidden',
    width: '100%',
  },
  carPhotosScroll: {
    height: 220,
  },
  carPhoto: {
    width: 300,
    height: 200,
    marginRight: 8,
  },
  carMainPhotoContainer: {
    height: 220,
    position: 'relative',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  carMainPhoto: {
    width: '100%',
    height: '100%',
    ...Platform.select({
      web: {
        objectFit: 'cover' as any,
      },
    }),
  },
  carPhotoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  carPhotoCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  carPhotoCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  viewPicsButton: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  viewPicsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
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
    marginBottom: 4,
  },
  carTrim: {
    fontSize: 14,
    color: '#FF6B35',
    marginBottom: 12,
  },
  carStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
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
    flex: 1,
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
  publicGarageLink: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  publicGarageLinkGradient: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  publicGarageLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  publicGarageLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  publicGarageLinkTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  publicGarageLinkSub: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  addCarCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
  },
  nudgeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 14,
  },
  nudgeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  addCarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  addCarSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  nudgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    marginTop: 18,
  },
  nudgeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
  menuItemBadge: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  menuItemBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#fff',
  },
  settingHintSmall: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    margin: 20,
    marginTop: 12,
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
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  modalHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  modalTextArea: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  drivetrainOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  drivetrainButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  drivetrainButtonActive: {
    backgroundColor: '#FF6B35',
  },
  drivetrainText: {
    color: '#888',
    fontWeight: '600',
  },
  drivetrainTextActive: {
    color: '#fff',
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
  photoHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
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
  photoContainerMain: {
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 14,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 2,
    alignItems: 'center',
  },
  coverBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  setCoverButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#444',
  },
  setCoverButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderColor: '#FFD700',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#0c0c0c',
    borderRadius: 12,
  },
  videoInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  addVideoButton: {
    backgroundColor: '#FF6B35',
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoList: {
    marginTop: 12,
    gap: 8,
  },
  videoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  videoUrl: {
    flex: 1,
    color: '#aaa',
    fontSize: 13,
  },
  publicToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  publicToggleInfo: {
    flex: 1,
    gap: 8,
    marginRight: 12,
  },
  publicToggleTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  publicToggleHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  visibilityToggleCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 4,
  },
  visibilityStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  visibilityBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  visibilityDescription: {
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
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
