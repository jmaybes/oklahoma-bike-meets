import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../../utils/api';

export default function CreateCrewScreen() {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    Keyboard.dismiss();
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Enter a Name', 'Your crew needs a name!');
      return;
    }
    if (trimmed.length > 30) {
      Alert.alert('Too Long', 'Crew name must be 30 characters or less.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/crews`,
        { name: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Crew Created! 🏎️', `"${trimmed}" is ready to roll!`, [
        {
          text: 'View Crew',
          onPress: () => {
            const crewId = res.data?.crew?.id || res.data?.crew?._id;
            if (crewId) {
              router.replace(`/crews/${crewId}`);
            } else {
              router.back();
            }
          },
        },
      ]);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to create crew';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient
          colors={['#FFE707', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Your Crew</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={48} color="#FFE707" />
          </View>

          <Text style={styles.label}>Crew Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. OKC Street Kings"
            placeholderTextColor="#555"
            maxLength={30}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Text style={styles.charCount}>{name.length}/30</Text>

          <Text style={styles.hint}>
            This is the name everyone will see when they view your crew. Choose something that represents your squad!
          </Text>

          <TouchableOpacity
            style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={loading || !name.trim()}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="flag" size={20} color="#000" />
                <Text style={styles.createButtonText}>Create Crew</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,231,7,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  label: {
    color: '#FFE707',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  charCount: {
    color: '#555',
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 16,
  },
  hint: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE707',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 8,
    width: '100%',
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
});
