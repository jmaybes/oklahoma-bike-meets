import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../contexts/AuthContext';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface EventForm {
  title: string;
  description: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  address: string;
  city: string;
  eventType: string;
  cost: string;
  contactInfo: string;
  website: string;
  carTypes: string;
  amenities: string;
  rules: string;
}

export default function AdminEditEventScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [form, setForm] = useState<EventForm>({
    title: '',
    description: '',
    date: '',
    time: '',
    endTime: '',
    location: '',
    address: '',
    city: '',
    eventType: '',
    cost: '',
    contactInfo: '',
    website: '',
    carTypes: '',
    amenities: '',
    rules: '',
  });

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/events/${eventId}`);
      const event = response.data;
      
      setForm({
        title: event.title || '',
        description: event.description || '',
        date: event.date || '',
        time: event.time || '',
        endTime: event.endTime || '',
        location: event.location || '',
        address: event.address || '',
        city: event.city || '',
        eventType: event.eventType || '',
        cost: event.cost || '',
        contactInfo: event.contactInfo || '',
        website: event.website || '',
        carTypes: Array.isArray(event.carTypes) ? event.carTypes.join(', ') : '',
        amenities: Array.isArray(event.amenities) ? event.amenities.join(', ') : '',
        rules: Array.isArray(event.rules) ? event.rules.join(', ') : '',
      });
      setPhotos(event.photos || []);
    } catch (error) {
      console.error('Error fetching event:', error);
      Alert.alert('Error', 'Could not load event details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const newPhoto = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setPhotos([...photos, newPhoto]);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        title: form.title.trim(),
        description: form.description.trim(),
        date: form.date.trim(),
        time: form.time.trim(),
        endTime: form.endTime.trim(),
        location: form.location.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        eventType: form.eventType.trim(),
        cost: form.cost.trim(),
        contactInfo: form.contactInfo.trim(),
        website: form.website.trim(),
        carTypes: form.carTypes.split(',').map(s => s.trim()).filter(s => s),
        amenities: form.amenities.split(',').map(s => s.trim()).filter(s => s),
        rules: form.rules.split(',').map(s => s.trim()).filter(s => s),
        photos: photos,
      };

      await axios.put(`${API_URL}/api/events/${eventId}`, updateData);
      Alert.alert('Success', 'Event updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Error', 'Could not update event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await axios.delete(`${API_URL}/api/events/${eventId}`);
              Alert.alert('Success', 'Event deleted successfully', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
              ]);
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Could not delete event');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Event</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="shield-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>Admin access required</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#FF6B35', '#f44336']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Event</Text>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="trash-outline" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photos Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo }} style={styles.photoThumb} />
                  <TouchableOpacity 
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#f44336" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
                <Ionicons name="add" size={32} color="#FF6B35" />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
              placeholder="Enter event title"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
              placeholder="Event description"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Event Type</Text>
            <TextInput
              style={styles.input}
              value={form.eventType}
              onChangeText={(text) => setForm({ ...form, eventType: text })}
              placeholder="e.g., Car Meet, Car Show, Cruise"
              placeholderTextColor="#666"
            />
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={form.date}
              onChangeText={(text) => setForm({ ...form, date: text })}
              placeholder="e.g., July 4, 2025"
              placeholderTextColor="#666"
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  value={form.time}
                  onChangeText={(text) => setForm({ ...form, time: text })}
                  placeholder="e.g., 6:00 PM"
                  placeholderTextColor="#666"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>End Time</Text>
                <TextInput
                  style={styles.input}
                  value={form.endTime}
                  onChangeText={(text) => setForm({ ...form, endTime: text })}
                  placeholder="e.g., 10:00 PM"
                  placeholderTextColor="#666"
                />
              </View>
            </View>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            
            <Text style={styles.label}>Venue Name</Text>
            <TextInput
              style={styles.input}
              value={form.location}
              onChangeText={(text) => setForm({ ...form, location: text })}
              placeholder="e.g., Bricktown Parking Lot"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={form.address}
              onChangeText={(text) => setForm({ ...form, address: text })}
              placeholder="Full street address"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={form.city}
              onChangeText={(text) => setForm({ ...form, city: text })}
              placeholder="e.g., Oklahoma City"
              placeholderTextColor="#666"
            />
          </View>

          {/* Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            
            <Text style={styles.label}>Cost</Text>
            <TextInput
              style={styles.input}
              value={form.cost}
              onChangeText={(text) => setForm({ ...form, cost: text })}
              placeholder="e.g., Free, $10, $20 per car"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Car Types (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={form.carTypes}
              onChangeText={(text) => setForm({ ...form, carTypes: text })}
              placeholder="e.g., All Cars, Imports, Muscle Cars"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Amenities (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={form.amenities}
              onChangeText={(text) => setForm({ ...form, amenities: text })}
              placeholder="e.g., Food Trucks, DJ, Trophies"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Rules (comma separated)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.rules}
              onChangeText={(text) => setForm({ ...form, rules: text })}
              placeholder="e.g., No burnouts, No alcohol"
              placeholderTextColor="#666"
              multiline
            />
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            
            <Text style={styles.label}>Contact Info</Text>
            <TextInput
              style={styles.input}
              value={form.contactInfo}
              onChangeText={(text) => setForm({ ...form, contactInfo: text })}
              placeholder="Phone or email"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              value={form.website}
              onChangeText={(text) => setForm({ ...form, website: text })}
              placeholder="https://..."
              placeholderTextColor="#666"
              keyboardType="url"
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
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
    paddingHorizontal: 16,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  photosScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  photoContainer: {
    marginRight: 12,
    position: 'relative',
  },
  photoThumb: {
    width: 120,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 120,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
