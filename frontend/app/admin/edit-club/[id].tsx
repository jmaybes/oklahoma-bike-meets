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

interface ClubForm {
  name: string;
  description: string;
  location: string;
  city: string;
  carTypes: string;
  contactInfo: string;
  website: string;
  facebookGroup: string;
  meetingSchedule: string;
  memberCount: string;
}

export default function AdminEditClubScreen() {
  const { id: clubId } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [form, setForm] = useState<ClubForm>({
    name: '',
    description: '',
    location: '',
    city: '',
    carTypes: '',
    contactInfo: '',
    website: '',
    facebookGroup: '',
    meetingSchedule: '',
    memberCount: '',
  });

  useEffect(() => {
    if (clubId) {
      fetchClub();
    }
  }, [clubId]);

  const fetchClub = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/clubs/${clubId}`);
      const club = response.data;
      
      setForm({
        name: club.name || '',
        description: club.description || '',
        location: club.location || '',
        city: club.city || '',
        carTypes: Array.isArray(club.carTypes) ? club.carTypes.join(', ') : '',
        contactInfo: club.contactInfo || '',
        website: club.website || '',
        facebookGroup: club.facebookGroup || '',
        meetingSchedule: club.meetingSchedule || '',
        memberCount: club.memberCount || '',
      });
      setPhotos(club.photos || []);
    } catch (error) {
      console.error('Error fetching club:', error);
      Alert.alert('Error', 'Could not load club details');
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
    if (!form.name.trim()) {
      Alert.alert('Error', 'Club name is required');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        name: form.name.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        city: form.city.trim(),
        carTypes: form.carTypes.split(',').map(s => s.trim()).filter(s => s),
        contactInfo: form.contactInfo.trim(),
        website: form.website.trim(),
        facebookGroup: form.facebookGroup.trim(),
        meetingSchedule: form.meetingSchedule.trim(),
        memberCount: form.memberCount.trim(),
        photos: photos,
      };

      await axios.put(`${API_URL}/api/clubs/${clubId}`, updateData);
      Alert.alert('Success', 'Club updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating club:', error);
      Alert.alert('Error', 'Could not update club');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Club',
      'Are you sure you want to delete this club? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await axios.delete(`${API_URL}/api/clubs/${clubId}`);
              Alert.alert('Success', 'Club deleted successfully', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/clubs') }
              ]);
            } catch (error) {
              console.error('Error deleting club:', error);
              Alert.alert('Error', 'Could not delete club');
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
          <Text style={styles.headerTitle}>Edit Club</Text>
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
          <ActivityIndicator size="large" color="#9C27B0" />
          <Text style={styles.loadingText}>Loading club...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#9C27B0', '#673AB7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Club</Text>
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
                <Ionicons name="add" size={32} color="#9C27B0" />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <Text style={styles.label}>Club Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
              placeholder="Enter club name"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
              placeholder="Club description"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Car Types (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={form.carTypes}
              onChangeText={(text) => setForm({ ...form, carTypes: text })}
              placeholder="e.g., JDM, Muscle Cars, Euro"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Member Count</Text>
            <TextInput
              style={styles.input}
              value={form.memberCount}
              onChangeText={(text) => setForm({ ...form, memberCount: text })}
              placeholder="e.g., 50+ members"
              placeholderTextColor="#666"
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            
            <Text style={styles.label}>Meeting Location</Text>
            <TextInput
              style={styles.input}
              value={form.location}
              onChangeText={(text) => setForm({ ...form, location: text })}
              placeholder="e.g., Various locations in OKC"
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

            <Text style={styles.label}>Meeting Schedule</Text>
            <TextInput
              style={styles.input}
              value={form.meetingSchedule}
              onChangeText={(text) => setForm({ ...form, meetingSchedule: text })}
              placeholder="e.g., Every Saturday at 7 PM"
              placeholderTextColor="#666"
            />
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact & Links</Text>
            
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

            <Text style={styles.label}>Facebook Group</Text>
            <TextInput
              style={styles.input}
              value={form.facebookGroup}
              onChangeText={(text) => setForm({ ...form, facebookGroup: text })}
              placeholder="Facebook group URL"
              placeholderTextColor="#666"
              keyboardType="url"
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

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
    color: '#9C27B0',
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
