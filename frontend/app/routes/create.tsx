import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

import { API_URL } from '../../utils/api';

interface Waypoint {
  latitude: number;
  longitude: number;
  name: string;
  order: number;
}

export default function CreateRouteScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [addingWaypoint, setAddingWaypoint] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    distance: '',
    estimatedTime: '',
    difficulty: 'easy',
    isPublic: true,
  });
  
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [scenicHighlights, setScenicHighlights] = useState<string[]>([]);
  const [newHighlight, setNewHighlight] = useState('');
  const [waypointName, setWaypointName] = useState('');

  const addCurrentLocationAsWaypoint = async () => {
    setAddingWaypoint(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const name = waypointName.trim() || `Stop ${waypoints.length + 1}`;
      
      setWaypoints([
        ...waypoints,
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          name,
          order: waypoints.length,
        },
      ]);
      
      setWaypointName('');
      Alert.alert('Success', `Added "${name}" to your route!`);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your location.');
    } finally {
      setAddingWaypoint(false);
    }
  };

  const addManualWaypoint = () => {
    Alert.prompt(
      'Add Waypoint',
      'Enter coordinates (lat, lng) or use current location',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use Current Location',
          onPress: addCurrentLocationAsWaypoint,
        },
      ]
    );
  };

  const removeWaypoint = (index: number) => {
    const updated = waypoints.filter((_, i) => i !== index);
    // Reorder remaining waypoints
    const reordered = updated.map((wp, i) => ({ ...wp, order: i }));
    setWaypoints(reordered);
  };

  const addHighlight = () => {
    if (newHighlight.trim()) {
      setScenicHighlights([...scenicHighlights, newHighlight.trim()]);
      setNewHighlight('');
    }
  };

  const removeHighlight = (index: number) => {
    setScenicHighlights(scenicHighlights.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter a route name.');
      return;
    }
    
    if (waypoints.length < 2) {
      Alert.alert('Error', 'Please add at least 2 waypoints to create a route.');
      return;
    }

    setLoading(true);
    try {
      const routeData = {
        userId: user?.id,
        userName: user?.name,
        name: form.name.trim(),
        description: form.description.trim(),
        waypoints,
        distance: form.distance ? parseFloat(form.distance) : null,
        estimatedTime: form.estimatedTime || null,
        scenicHighlights,
        difficulty: form.difficulty,
        isPublic: form.isPublic,
      };

      await axios.post(`${API_URL}/api/routes`, routeData);
      
      Alert.alert(
        'Route Created!',
        'Your scenic route has been saved.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error creating route:', error);
      Alert.alert('Error', 'Failed to create route. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle" size={64} color="#666" />
          <Text style={styles.loginText}>Please login to create routes</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#E31837', '#E31837']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Route</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Route Name */}
        <Text style={styles.label}>Route Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Scenic Lake Loop"
          placeholderTextColor="#666"
          value={form.name}
          onChangeText={(text) => setForm({ ...form, name: text })}
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the route, scenic views, and what makes it special..."
          placeholderTextColor="#666"
          multiline
          numberOfLines={4}
          value={form.description}
          onChangeText={(text) => setForm({ ...form, description: text })}
        />

        {/* Waypoints Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>Waypoints *</Text>
          <Text style={styles.helpText}>(Add at least 2 stops)</Text>
        </View>

        {waypoints.map((wp, index) => (
          <View key={index} style={styles.waypointItem}>
            <View style={styles.waypointNumber}>
              <Text style={styles.waypointNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.waypointInfo}>
              <Text style={styles.waypointName}>{wp.name}</Text>
              <Text style={styles.waypointCoords}>
                {wp.latitude.toFixed(4)}, {wp.longitude.toFixed(4)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeWaypoint(index)}>
              <Ionicons name="close-circle" size={24} color="#F44336" />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.addWaypointContainer}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Waypoint name (optional)"
            placeholderTextColor="#666"
            value={waypointName}
            onChangeText={setWaypointName}
          />
          <TouchableOpacity
            style={styles.addWaypointButton}
            onPress={addCurrentLocationAsWaypoint}
            disabled={addingWaypoint}
          >
            {addingWaypoint ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="location" size={18} color="#fff" />
                <Text style={styles.addWaypointText}>Add Current Location</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Distance & Time */}
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Distance (miles)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 45"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={form.distance}
              onChangeText={(text) => setForm({ ...form, distance: text })}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Est. Time</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2h 30m"
              placeholderTextColor="#666"
              value={form.estimatedTime}
              onChangeText={(text) => setForm({ ...form, estimatedTime: text })}
            />
          </View>
        </View>

        {/* Difficulty */}
        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.difficultyContainer}>
          {['easy', 'moderate', 'challenging'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.difficultyButton,
                form.difficulty === level && styles.difficultyButtonActive,
                form.difficulty === level && {
                  backgroundColor: level === 'easy' ? '#EFFF00' : level === 'moderate' ? '#FFC107' : '#F44336'
                }
              ]}
              onPress={() => setForm({ ...form, difficulty: level })}
            >
              <Text style={[
                styles.difficultyButtonText,
                form.difficulty === level && styles.difficultyButtonTextActive
              ]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Scenic Highlights */}
        <Text style={styles.label}>Scenic Highlights</Text>
        <View style={styles.highlightsInput}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="e.g., Lake view, Mountain pass"
            placeholderTextColor="#666"
            value={newHighlight}
            onChangeText={setNewHighlight}
            onSubmitEditing={addHighlight}
          />
          <TouchableOpacity style={styles.addHighlightButton} onPress={addHighlight}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.highlightsList}>
          {scenicHighlights.map((highlight, index) => (
            <View key={index} style={styles.highlightTag}>
              <Text style={styles.highlightTagText}>{highlight}</Text>
              <TouchableOpacity onPress={() => removeHighlight(index)}>
                <Ionicons name="close" size={16} color="#E31837" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Public/Private Toggle */}
        <TouchableOpacity
          style={styles.publicToggle}
          onPress={() => setForm({ ...form, isPublic: !form.isPublic })}
        >
          <View style={styles.toggleInfo}>
            <Ionicons 
              name={form.isPublic ? "globe-outline" : "lock-closed-outline"} 
              size={24} 
              color={form.isPublic ? "#EFFF00" : "#FFC107"} 
            />
            <View>
              <Text style={styles.toggleTitle}>
                {form.isPublic ? 'Public Route' : 'Private Route'}
              </Text>
              <Text style={styles.toggleSubtitle}>
                {form.isPublic ? 'Anyone can discover and save this route' : 'Only you can see this route'}
              </Text>
            </View>
          </View>
          <View style={[styles.toggleSwitch, form.isPublic && styles.toggleSwitchActive]}>
            <View style={[styles.toggleKnob, form.isPublic && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Create Route</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  loginText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  loginButton: {
    backgroundColor: '#E31837',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerGradient: {
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    color: '#888',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#141414',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  waypointNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E31837',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  waypointNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  waypointCoords: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  addWaypointContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addWaypointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E31837',
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  addWaypointText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  difficultyContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  difficultyButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#141414',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  difficultyButtonActive: {
    borderColor: 'transparent',
  },
  difficultyButtonText: {
    color: '#888',
    fontWeight: '600',
  },
  difficultyButtonTextActive: {
    color: '#fff',
  },
  highlightsInput: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addHighlightButton: {
    backgroundColor: '#E31837',
    width: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  highlightTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  highlightTagText: {
    color: '#E31837',
    fontSize: 13,
  },
  publicToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141414',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    backgroundColor: '#333',
    borderRadius: 14,
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#EFFF00',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  toggleKnobActive: {
    marginLeft: 22,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E31837',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
