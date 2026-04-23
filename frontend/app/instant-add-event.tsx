import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, Image, Platform, KeyboardAvoidingView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../utils/api';

type Step = 'capture' | 'scanning' | 'review' | 'submitting' | 'done';

interface EventData {
  title: string;
  description: string;
  date: string;
  time: string;
  address: string;
  location: string;
  eventType: string;
  entryFee: string;
  organizer: string;
  website: string;
}

export default function InstantAddEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [eventData, setEventData] = useState<EventData>({
    title: '',
    description: '',
    date: '',
    time: '',
    address: '',
    location: '',
    eventType: 'Bike Meet',
    entryFee: 'Free',
    organizer: '',
    website: '',
  });

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to scan flyers');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      processImage(result.assets[0].base64 || '');
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Gallery access is needed to scan flyers');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      processImage(result.assets[0].base64 || '');
    }
  };

  const processImage = async (base64: string) => {
    setStep('scanning');
    try {
      const response = await axios.post(`${API_URL}/api/ocr/scan-flyer`, {
        image: `data:image/jpeg;base64,${base64}`,
      });

      if (response.data.success) {
        const parsed = response.data.parsedData;
        setExtractedText(response.data.extractedText || '');
        setEventData(prev => ({
          ...prev,
          title: parsed.title || '',
          description: parsed.description || '',
          date: parsed.date || '',
          time: parsed.time || '',
          address: parsed.address || '',
          location: parsed.address || '',
          organizer: parsed.organizer || '',
        }));
        setStep('review');
      } else {
        Alert.alert('Scan Issue', 'Could not extract details. You can fill them in manually.');
        setStep('review');
      }
    } catch (error: any) {
      console.error('OCR error:', error);
      Alert.alert(
        'Scan Failed',
        'Could not read the flyer. Would you like to fill in the details manually?',
        [
          { text: 'Try Again', onPress: () => setStep('capture') },
          { text: 'Fill Manually', onPress: () => setStep('review') },
        ]
      );
    }
  };

  const submitEvent = async () => {
    if (!eventData.title.trim()) {
      Alert.alert('Missing Info', 'Please enter at least an event title.');
      return;
    }

    setStep('submitting');
    try {
      const payload: any = {
        title: eventData.title,
        description: eventData.description,
        date: eventData.date,
        time: eventData.time,
        address: eventData.address,
        location: eventData.location || eventData.address,
        eventType: eventData.eventType,
        entryFee: eventData.entryFee,
        organizer: eventData.organizer,
        website: eventData.website,
        carTypes: ['All'],
        userId: user?.id,
      };

      if (imageBase64) {
        payload.photos = [`data:image/jpeg;base64,${imageBase64}`];
      }

      await axios.post(`${API_URL}/api/events`, payload);
      setStep('done');
    } catch (error: any) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit event. Please try again.');
      setStep('review');
    }
  };

  // Event type options
  const eventTypes = ['Bike Meet', 'Bike Show', 'Car Cruise', 'Rally', 'Autocross', 'Auction', 'Other'];
  const feeOptions = ['Free', 'Paid', 'Donation'];

  // Capture step — camera/gallery buttons
  if (step === 'capture') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Instant Add Event</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.captureContainer}>
          <View style={styles.captureIconWrap}>
            <LinearGradient
              colors={['#E31837', '#E31837']}
              style={styles.captureIconGradient}
            >
              <Ionicons name="camera" size={48} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.captureTitle}>Snap a Flyer</Text>
          <Text style={styles.captureSubtitle}>
            Take a photo of an event flyer or choose one from your gallery.{'\n'}We'll read it and create the event for you.
          </Text>

          <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} activeOpacity={0.8}>
            <LinearGradient
              colors={['#E31837', '#E31837']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.captureBtnGradient}
            >
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.captureBtnText}>Take Photo</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureBtn} onPress={pickFromGallery} activeOpacity={0.8}>
            <View style={styles.captureBtnOutline}>
              <Ionicons name="images" size={24} color="#E31837" />
              <Text style={[styles.captureBtnText, { color: '#E31837' }]}>Choose from Gallery</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Scanning step
  if (step === 'scanning') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('capture')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scanning...</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.scanningContainer}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.scanningImage} resizeMode="contain" />
          )}
          <View style={styles.scanningOverlay}>
            <ActivityIndicator size="large" color="#E31837" />
            <Text style={styles.scanningText}>Reading your flyer...</Text>
            <Text style={styles.scanningSubtext}>Extracting event details</Text>
          </View>
        </View>
      </View>
    );
  }

  // Done step
  if (step === 'done') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Event Created!</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.doneContainer}>
          <View style={styles.doneIconWrap}>
            <Ionicons name="checkmark-circle" size={80} color="#EFFF00" />
          </View>
          <Text style={styles.doneTitle}>Event Submitted!</Text>
          <Text style={styles.doneSubtitle}>
            Your event "{eventData.title}" has been submitted and is pending admin approval.
          </Text>

          <TouchableOpacity
            style={styles.captureBtn}
            onPress={() => {
              setStep('capture');
              setImageUri(null);
              setImageBase64(null);
              setEventData({
                title: '', description: '', date: '', time: '',
                address: '', location: '', eventType: 'Bike Meet',
                entryFee: 'Free', organizer: '', website: '',
              });
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#E31837', '#E31837']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.captureBtnGradient}
            >
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.captureBtnText}>Scan Another Flyer</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <View style={styles.captureBtnOutline}>
              <Text style={[styles.captureBtnText, { color: '#E31837' }]}>Back to Profile</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Review step (also submitting)
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('capture')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Event</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.reviewScroll} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Flyer Preview */}
          {imageUri && (
            <View style={styles.flyerPreview}>
              <Image source={{ uri: imageUri }} style={styles.flyerImage} resizeMode="cover" />
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setStep('capture')}>
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Event Details</Text>
            <Text style={styles.formHint}>Review and edit the info we extracted</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={styles.input}
                value={eventData.title}
                onChangeText={(v) => setEventData(prev => ({ ...prev, title: v }))}
                placeholder="e.g. Bikes & Coffee OKC"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={eventData.description}
                onChangeText={(v) => setEventData(prev => ({ ...prev, description: v }))}
                placeholder="Brief description of the event"
                placeholderTextColor="#666"
                multiline
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={eventData.date}
                  onChangeText={(v) => setEventData(prev => ({ ...prev, date: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#666"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Time</Text>
                <TextInput
                  style={styles.input}
                  value={eventData.time}
                  onChangeText={(v) => setEventData(prev => ({ ...prev, time: v }))}
                  placeholder="e.g. 8:00 AM"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                value={eventData.address}
                onChangeText={(v) => setEventData(prev => ({ ...prev, address: v }))}
                placeholder="Full street address"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Venue / Location Name</Text>
              <TextInput
                style={styles.input}
                value={eventData.location}
                onChangeText={(v) => setEventData(prev => ({ ...prev, location: v }))}
                placeholder="e.g. Parlor OKC"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Event Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {eventTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      eventData.eventType === type && styles.chipSelected,
                    ]}
                    onPress={() => setEventData(prev => ({ ...prev, eventType: type }))}
                  >
                    <Text style={[
                      styles.chipText,
                      eventData.eventType === type && styles.chipTextSelected,
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Entry Fee</Text>
              <View style={styles.chipRow}>
                {feeOptions.map((fee) => (
                  <TouchableOpacity
                    key={fee}
                    style={[
                      styles.chip,
                      eventData.entryFee === fee && styles.chipSelected,
                    ]}
                    onPress={() => setEventData(prev => ({ ...prev, entryFee: fee }))}
                  >
                    <Text style={[
                      styles.chipText,
                      eventData.entryFee === fee && styles.chipTextSelected,
                    ]}>
                      {fee}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Organizer</Text>
              <TextInput
                style={styles.input}
                value={eventData.organizer}
                onChangeText={(v) => setEventData(prev => ({ ...prev, organizer: v }))}
                placeholder="Who's hosting?"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Website</Text>
              <TextInput
                style={styles.input}
                value={eventData.website}
                onChangeText={(v) => setEventData(prev => ({ ...prev, website: v }))}
                placeholder="https://..."
                placeholderTextColor="#666"
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={[styles.submitBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={submitEvent}
            disabled={step === 'submitting'}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#E31837', '#E31837']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {step === 'submitting' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.submitText}>Submit Event</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  // Capture step
  captureContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  captureIconWrap: {
    marginBottom: 24,
  },
  captureIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  captureSubtitle: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  captureBtn: {
    width: '100%',
    marginBottom: 14,
  },
  captureBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  captureBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E31837',
    gap: 10,
  },
  captureBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },

  // Scanning step
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scanningImage: {
    width: '80%',
    height: 300,
    borderRadius: 12,
    marginBottom: 24,
    opacity: 0.5,
  },
  scanningOverlay: {
    alignItems: 'center',
  },
  scanningText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
  },
  scanningSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },

  // Done step
  doneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  doneIconWrap: {
    marginBottom: 16,
  },
  doneTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  doneSubtitle: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },

  // Review step
  reviewScroll: {
    flex: 1,
  },
  flyerPreview: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  flyerImage: {
    width: '100%',
    height: 200,
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  retakeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  formSection: {
    paddingHorizontal: 16,
  },
  formSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  formHint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  row: {
    flexDirection: 'row',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: 'rgba(225, 85, 0, 0.2)',
    borderColor: '#E31837',
  },
  chipText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#E31837',
  },

  // Submit bar
  submitBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  submitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
