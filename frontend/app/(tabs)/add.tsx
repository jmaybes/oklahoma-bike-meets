import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { NotificationBell } from '../../components/NotificationBell';

import { API_URL } from '../../utils/api';

export default function AddEventScreen() {
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isPopUp, setIsPopUp] = useState(false);
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [scanningFlyer, setScanningFlyer] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDay, setRecurrenceDay] = useState<number | null>(null);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [showEventTypePicker, setShowEventTypePicker] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    address: '',
    city: '',
    organizer: '',
    entryFee: '',
    eventType: 'Bike Meet',
    carTypes: '',
    contactInfo: '',
    website: '',
  });

  const eventTypes = [
    'Bike Meet', 
    'Bike Show', 
    'Bike Night',
    'Swap Meet',
    'Poker Run',
    'Charity Ride',
    'Group Ride', 
    'Rally',
    'Race', 
    'Cruise',
    'Auction',
    'Other'
  ];
  
  const daysOfWeek = [
    { label: 'Sunday', value: 0 },
    { label: 'Monday', value: 1 },
    { label: 'Tuesday', value: 2 },
    { label: 'Wednesday', value: 3 },
    { label: 'Thursday', value: 4 },
    { label: 'Friday', value: 5 },
    { label: 'Saturday', value: 6 },
  ];

  const scanFlyer = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to scan flyers');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setScanningFlyer(true);
      try {
        const response = await axios.post(`${API_URL}/api/ocr/scan-flyer`, {
          image: `data:image/jpeg;base64,${result.assets[0].base64}`,
        });

        if (response.data.success) {
          const parsed = response.data.parsedData;
          
          // Update form with extracted data
          setFormData(prev => ({
            ...prev,
            title: parsed.title || prev.title,
            description: parsed.description || prev.description,
            date: parsed.date || prev.date,
            time: parsed.time || prev.time,
            address: parsed.address || prev.address,
            location: parsed.address || prev.location,
          }));

          // Add the scanned image to photos
          if (result.assets[0].uri) {
            setPhotos(prev => [...prev, `data:image/jpeg;base64,${result.assets[0].base64}`]);
          }

          Alert.alert(
            'Flyer Scanned!',
            'We extracted the following information. Please review and edit as needed.',
            [{ text: 'OK' }]
          );
        }
      } catch (error: any) {
        console.error('OCR error:', error);
        Alert.alert('Scan Failed', 'Could not extract text from the image. Please enter details manually.');
      } finally {
        setScanningFlyer(false);
      }
    }
  };

  const getMyLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature');
        setUseMyLocation(false);
        setLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Reverse geocode to get address
      const address = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (address && address.length > 0) {
        const addr = address[0];
        setFormData({
          ...formData,
          location: addr.name || addr.street || 'Current Location',
          address: `${addr.street || ''} ${addr.streetNumber || ''}`.trim(),
          city: addr.city || addr.subregion || '',
        });
      }
      
      Alert.alert('Success', 'Location captured! Coordinates will be saved with your event.');
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
      setUseMyLocation(false);
    } finally {
      setLoadingLocation(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload images!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6,
      base64: false,
    });

    if (!result.canceled && result.assets) {
      if (photos.length + result.assets.length > 5) {
        Alert.alert('Limit Reached', 'You can upload a maximum of 5 images');
        return;
      }

      // Resize and compress each photo to fit event card (landscape, 800px wide)
      const formattedImages: string[] = [];
      for (const asset of result.assets) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 800 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          if (manipulated.base64) {
            formattedImages.push(`data:image/jpeg;base64,${manipulated.base64}`);
          }
        } catch (err) {
          console.error('Image formatting error:', err);
        }
      }

      setPhotos([...photos, ...formattedImages]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.date || !formData.time || !formData.city) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate recurring event fields
    if (isRecurring && recurrenceDay === null) {
      Alert.alert('Error', 'Please select which day of the week this event repeats');
      return;
    }

    setLoading(true);
    try {
      const carTypesArray = formData.carTypes
        ? formData.carTypes.split(',').map(type => type.trim())
        : [];

      let latitude = null;
      let longitude = null;

      // Get current location coordinates if user selected "Use My Location"
      if (useMyLocation) {
        try {
          const location = await Location.getCurrentPositionAsync({});
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        } catch (error) {
          console.error('Error getting coordinates:', error);
        }
      }

      const eventData = {
        ...formData,
        carTypes: carTypesArray,
        userId: user?.id || null,
        photos: photos,
        isPopUp: isPopUp,
        latitude: latitude,
        longitude: longitude,
        isRecurring: isRecurring,
        recurrenceDay: isRecurring ? recurrenceDay : null,
        recurrenceEndDate: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
      };

      await axios.post(`${API_URL}/api/events`, eventData);
      
      let approvalMessage = 'Event created and published successfully!';
      
      if (isRecurring) {
        approvalMessage += `\n\n🔄 This event will repeat every ${daysOfWeek.find(d => d.value === recurrenceDay)?.label || 'week'}.`;
      }
      
      if (isPopUp && user?.isAdmin) {
        approvalMessage += '\n\n🚨 All users have been notified about this Pop Up event!';
      } else if (isPopUp) {
        approvalMessage += '\n\nOnce approved, all users will be notified about this Pop Up event!';
      }
      
      Alert.alert('Success', approvalMessage, [
        { text: 'OK', onPress: () => {
          setFormData({
            title: '',
            description: '',
            date: '',
            time: '',
            location: '',
            address: '',
            city: '',
            organizer: '',
            entryFee: '',
            eventType: 'Bike Meet',
            carTypes: '',
            contactInfo: '',
            website: '',
          });
          setPhotos([]);
          setIsRecurring(false);
          setRecurrenceDay(null);
          setRecurrenceEndDate('');
          router.push('/(tabs)/home');
        }}
      ]);
    } catch (error: any) {
      console.error('Error creating event:', error);
      const msg = error.response?.data?.detail 
        || (error.message?.includes('413') || error.message?.includes('Network') 
          ? 'Photos may be too large. Try uploading fewer or smaller images.' 
          : 'Failed to create event. Please try again.');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#E31837', '#E31837']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Add New Event</Text>
                <Text style={styles.headerSubtitle}>
                  Share a bike event with the community
                </Text>
              </View>
              <NotificationBell />
            </View>
          </LinearGradient>

          {!isAuthenticated && (
            <View style={styles.authNotice}>
              <Ionicons name="information-circle" size={20} color="#E31837" />
              <Text style={styles.authNoticeText}>
                You can add events as a guest, or login for more features
              </Text>
            </View>
          )}

          {/* Scan Flyer Button */}
          <TouchableOpacity
            style={styles.scanFlyerButton}
            onPress={scanFlyer}
            disabled={scanningFlyer}
          >
            <LinearGradient
              colors={['#9C27B0', '#E31837']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scanFlyerGradient}
            >
              {scanningFlyer ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="scan" size={24} color="#fff" />
              )}
              <View style={styles.scanFlyerTextContainer}>
                <Text style={styles.scanFlyerTitle}>
                  {scanningFlyer ? 'Scanning...' : 'Scan Event Flyer'}
                </Text>
                <Text style={styles.scanFlyerSubtitle}>
                  Auto-fill form from an image
                </Text>
              </View>
              <Ionicons name="camera" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.form}>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., OKC Bikes & Coffee"
              placeholderTextColor="#666"
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about the event..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
            />

            <Text style={styles.label}>Event Type</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowEventTypePicker(true)}
            >
              <Text style={styles.dropdownButtonText}>{formData.eventType}</Text>
              <Ionicons name="chevron-down" size={20} color="#fff" />
            </TouchableOpacity>

            {/* Event Type Picker Modal */}
            <Modal
              visible={showEventTypePicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowEventTypePicker(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowEventTypePicker(false)}
              >
                <View style={styles.pickerModalContent}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>Select Event Type</Text>
                    <TouchableOpacity onPress={() => setShowEventTypePicker(false)}>
                      <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.pickerList}>
                    {eventTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.pickerItem,
                          formData.eventType === type && styles.pickerItemActive,
                        ]}
                        onPress={() => {
                          setFormData({ ...formData, eventType: type });
                          setShowEventTypePicker(false);
                        }}
                      >
                        <Text style={[
                          styles.pickerItemText,
                          formData.eventType === type && styles.pickerItemTextActive,
                        ]}>
                          {type}
                        </Text>
                        {formData.eventType === type && (
                          <Ionicons name="checkmark" size={20} color="#E31837" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2025-08-15"
                  placeholderTextColor="#666"
                  value={formData.date}
                  onChangeText={(text) => setFormData({ ...formData, date: text })}
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Time *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="9:00 AM"
                  placeholderTextColor="#666"
                  value={formData.time}
                  onChangeText={(text) => setFormData({ ...formData, time: text })}
                />
              </View>
            </View>

            <Text style={styles.label}>Location Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Bricktown Plaza"
              placeholderTextColor="#666"
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Full address"
              placeholderTextColor="#666"
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
            />

            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Oklahoma City"
              placeholderTextColor="#666"
              value={formData.city}
              onChangeText={(text) => setFormData({ ...formData, city: text })}
            />

            {/* Use My Location Button */}
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getMyLocation}
              disabled={loadingLocation}
            >
              {loadingLocation ? (
                <ActivityIndicator size="small" color="#EFFF00" />
              ) : (
                <Ionicons name="location" size={20} color="#EFFF00" />
              )}
              <Text style={styles.locationButtonText}>
                {loadingLocation ? 'Getting Location...' : 'Use My Current Location'}
              </Text>
            </TouchableOpacity>

            {/* Pop Up Event Toggle */}
            <View style={styles.popupToggleContainer}>
              <View style={styles.popupToggleInfo}>
                <Ionicons name="flash" size={24} color="#FF3B30" />
                <View style={styles.popupToggleText}>
                  <Text style={styles.popupToggleTitle}>Pop Up Event</Text>
                  <Text style={styles.popupToggleDescription}>
                    Mark this as a last-minute event to send urgent notifications to all users
                  </Text>
                </View>
              </View>
              <Switch
                value={isPopUp}
                onValueChange={setIsPopUp}
                trackColor={{ false: '#3e3e3e', true: '#FF3B30' }}
                thumbColor={isPopUp ? '#fff' : '#f4f3f4'}
              />
            </View>

            {/* Recurring Event Toggle */}
            <View style={styles.recurringToggleContainer}>
              <View style={styles.recurringToggleInfo}>
                <Ionicons name="repeat" size={24} color="#EFFF00" />
                <View style={styles.recurringToggleText}>
                  <Text style={styles.recurringToggleTitle}>Recurring Event</Text>
                  <Text style={styles.recurringToggleDescription}>
                    This event repeats weekly on the same day
                  </Text>
                </View>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: '#3e3e3e', true: '#EFFF00' }}
                thumbColor={isRecurring ? '#fff' : '#f4f3f4'}
              />
            </View>

            {/* Recurring Event Options */}
            {isRecurring && (
              <View style={styles.recurringOptionsContainer}>
                <Text style={styles.label}>Repeat Every Week On</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayList}>
                  {daysOfWeek.map((day) => (
                    <TouchableOpacity
                      key={day.value}
                      style={[
                        styles.dayChip,
                        recurrenceDay === day.value && styles.dayChipActive,
                      ]}
                      onPress={() => setRecurrenceDay(day.value)}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          recurrenceDay === day.value && styles.dayChipTextActive,
                        ]}
                      >
                        {day.label.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { marginTop: 16 }]}>End Recurring On (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Leave empty for 1 year (default)"
                  placeholderTextColor="#666"
                  value={recurrenceEndDate}
                  onChangeText={setRecurrenceEndDate}
                />
                <Text style={styles.helperText}>
                  Events will be generated for each week until this date
                </Text>
              </View>
            )}

            <Text style={styles.label}>Organizer</Text>
            <TextInput
              style={styles.input}
              placeholder="Who's organizing this event?"
              placeholderTextColor="#666"
              value={formData.organizer}
              onChangeText={(text) => setFormData({ ...formData, organizer: text })}
            />

            <Text style={styles.label}>Entry Fee</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Free, $10, $5 per bike"
              placeholderTextColor="#666"
              value={formData.entryFee}
              onChangeText={(text) => setFormData({ ...formData, entryFee: text })}
            />

            <Text style={styles.label}>Bike Types Expected</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., JDM, Muscle, Euro (comma separated)"
              placeholderTextColor="#666"
              value={formData.carTypes}
              onChangeText={(text) => setFormData({ ...formData, carTypes: text })}
            />

            <Text style={styles.label}>Contact Info</Text>
            <TextInput
              style={styles.input}
              placeholder="Email or phone number"
              placeholderTextColor="#666"
              value={formData.contactInfo}
              onChangeText={(text) => setFormData({ ...formData, contactInfo: text })}
            />

            <Text style={styles.label}>Website/Social Media</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor="#666"
              value={formData.website}
              onChangeText={(text) => setFormData({ ...formData, website: text })}
            />

            <Text style={styles.label}>Event Photos (Max 5)</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Ionicons name="images" size={24} color="#E31837" />
              <Text style={styles.uploadButtonText}>Upload Photos</Text>
            </TouchableOpacity>

            {photos.length > 0 && (
              <View style={styles.photosPreview}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image source={{ uri: photo }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Create Event</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
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
  authNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  authNoticeText: {
    flex: 1,
    color: '#aaa',
    fontSize: 12,
    marginLeft: 8,
  },
  scanFlyerButton: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scanFlyerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  scanFlyerTextContainer: {
    flex: 1,
  },
  scanFlyerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  scanFlyerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  form: {
    padding: 20,
    paddingTop: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeList: {
    flexGrow: 0,
    marginBottom: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#141414',
    borderRadius: 20,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: '#E31837',
  },
  typeChipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#E31837',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  uploadButton: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E31837',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#E31837',
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
    backgroundColor: '#1E1E1E',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#0c0c0c',
    borderRadius: 12,
  },
  locationButton: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#EFFF00',
  },
  locationButtonText: {
    color: '#EFFF00',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  popupToggleContainer: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  popupToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  popupToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  popupToggleTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  popupToggleDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  recurringToggleContainer: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EFFF00',
  },
  recurringToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  recurringToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  recurringToggleTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recurringToggleDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  recurringOptionsContainer: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#EFFF00',
  },
  dayList: {
    flexGrow: 0,
    marginTop: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    marginRight: 8,
  },
  dayChipActive: {
    backgroundColor: '#EFFF00',
  },
  dayChipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  dayChipTextActive: {
    color: '#fff',
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  dropdownButton: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dropdownButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  pickerList: {
    padding: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginVertical: 4,
  },
  pickerItemActive: {
    backgroundColor: '#252525',
  },
  pickerItemText: {
    color: '#fff',
    fontSize: 16,
  },
  pickerItemTextActive: {
    color: '#E31837',
    fontWeight: '600',
  },
});
