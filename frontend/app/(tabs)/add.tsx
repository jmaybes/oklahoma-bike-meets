import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AddEventScreen() {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  
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
    eventType: 'Car Meet',
    carTypes: '',
    contactInfo: '',
    website: '',
  });

  const eventTypes = ['Car Meet', 'Car Show', 'Cruise', 'Race', 'Other'];

  const handleSubmit = async () => {
    if (!formData.title || !formData.date || !formData.time || !formData.city) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const carTypesArray = formData.carTypes
        ? formData.carTypes.split(',').map(type => type.trim())
        : [];

      const eventData = {
        ...formData,
        carTypes: carTypesArray,
        userId: user?.id || null,
      };

      await axios.post(`${API_URL}/api/events`, eventData);
      
      Alert.alert('Success', 'Event created successfully!', [
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
            eventType: 'Car Meet',
            carTypes: '',
            contactInfo: '',
            website: '',
          });
          router.push('/(tabs)/home');
        }}
      ]);
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add New Event</Text>
            <Text style={styles.headerSubtitle}>
              Share a car event with the community
            </Text>
          </View>

          {!isAuthenticated && (
            <View style={styles.authNotice}>
              <Ionicons name="information-circle" size={20} color="#FF6B35" />
              <Text style={styles.authNoticeText}>
                You can add events as a guest, or login for more features
              </Text>
            </View>
          )}

          <View style={styles.form}>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., OKC Cars & Coffee"
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeList}>
              {eventTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    formData.eventType === type && styles.typeChipActive,
                  ]}
                  onPress={() => setFormData({ ...formData, eventType: type })}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      formData.eventType === type && styles.typeChipTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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
              placeholder="e.g., Free, $10, $5 per car"
              placeholderTextColor="#666"
              value={formData.entryFee}
              onChangeText={(text) => setFormData({ ...formData, entryFee: text })}
            />

            <Text style={styles.label}>Car Types Expected</Text>
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
    </SafeAreaView>
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
  header: {
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  authNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
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
    backgroundColor: '#1a1a1a',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: '#FF6B35',
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
    backgroundColor: '#FF6B35',
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
});
