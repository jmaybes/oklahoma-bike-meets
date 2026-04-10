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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

import { API_URL } from '../../utils/api';

export default function SubmitClubScreen() {
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
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

  const handleSubmit = async () => {
    if (!formData.name || !formData.city || !formData.description) {
      Alert.alert('Error', 'Please fill in club name, city, and description');
      return;
    }

    setLoading(true);
    try {
      const carTypesArray = formData.carTypes
        ? formData.carTypes.split(',').map(type => type.trim())
        : [];

      const clubData = {
        ...formData,
        carTypes: carTypesArray,
        userId: user?.id || null,
      };

      await axios.post(`${API_URL}/api/clubs`, clubData);
      
      const approvalMessage = user?.isAdmin 
        ? 'Club created and published successfully!' 
        : 'Club submitted successfully! It will be visible after admin approval.';
      
      Alert.alert('Success', approvalMessage, [
        { text: 'OK', onPress: () => {
          setFormData({
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
          router.back();
        }}
      ]);
    } catch (error) {
      console.error('Error creating club:', error);
      Alert.alert('Error', 'Failed to submit club. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Submit Car Club</Text>
            <Text style={styles.headerSubtitle}>Add a club to the directory</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {!isAuthenticated && (
            <View style={styles.authNotice}>
              <Ionicons name="information-circle" size={20} color="#E15500" />
              <Text style={styles.authNoticeText}>
                You can submit clubs as a guest, or login for more features
              </Text>
            </View>
          )}

          <View style={styles.form}>
            <Text style={styles.label}>Club Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Oklahoma Mustang Club"
              placeholderTextColor="#666"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about the club..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
            />

            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Oklahoma City"
              placeholderTextColor="#666"
              value={formData.city}
              onChangeText={(text) => setFormData({ ...formData, city: text })}
            />

            <Text style={styles.label}>Location/Meeting Place</Text>
            <TextInput
              style={styles.input}
              placeholder="Where does the club meet?"
              placeholderTextColor="#666"
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
            />

            <Text style={styles.label}>Car Types/Specialties</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Mustang, Corvette, All Makes (comma separated)"
              placeholderTextColor="#666"
              value={formData.carTypes}
              onChangeText={(text) => setFormData({ ...formData, carTypes: text })}
            />

            <Text style={styles.label}>Meeting Schedule</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 1st Saturday monthly, 7 PM"
              placeholderTextColor="#666"
              value={formData.meetingSchedule}
              onChangeText={(text) => setFormData({ ...formData, meetingSchedule: text })}
            />

            <Text style={styles.label}>Member Count</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 50+, 100+ members"
              placeholderTextColor="#666"
              value={formData.memberCount}
              onChangeText={(text) => setFormData({ ...formData, memberCount: text })}
            />

            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor="#666"
              value={formData.website}
              onChangeText={(text) => setFormData({ ...formData, website: text })}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Facebook Group</Text>
            <TextInput
              style={styles.input}
              placeholder="https://facebook.com/groups/..."
              placeholderTextColor="#666"
              value={formData.facebookGroup}
              onChangeText={(text) => setFormData({ ...formData, facebookGroup: text })}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Contact Info</Text>
            <TextInput
              style={styles.input}
              placeholder="Email or phone number"
              placeholderTextColor="#666"
              value={formData.contactInfo}
              onChangeText={(text) => setFormData({ ...formData, contactInfo: text })}
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
                  <Ionicons name="people-circle" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Club</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  authNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  authNoticeText: {
    flex: 1,
    color: '#aaa',
    fontSize: 12,
    marginLeft: 8,
  },
  form: {
    padding: 20,
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
  submitButton: {
    backgroundColor: '#9C27B0',
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
