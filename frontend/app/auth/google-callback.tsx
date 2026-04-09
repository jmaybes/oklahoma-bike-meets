import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

import { API_URL } from '../../utils/api';

interface GoogleData {
  email: string;
  name: string;
  picture: string;
  googleId: string;
}

interface AppleData {
  email: string;
  name: string;
  appleId: string;
}

export default function GoogleCallbackScreen() {
  const { login } = useAuth();
  const params = useLocalSearchParams();
  const hasProcessed = useRef(false);
  
  const [loading, setLoading] = useState(true);
  const [googleData, setGoogleData] = useState<GoogleData | null>(null);
  const [appleData, setAppleData] = useState<AppleData | null>(null);
  const [authProvider, setAuthProvider] = useState<'google' | 'apple'>('google');
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    
    // Check if this is an Apple sign-in flow (has appleId param)
    if (params.authProvider === 'apple' && params.appleId) {
      processAppleAuth();
    } else {
      processGoogleAuth();
    }
  }, []);

  const processAppleAuth = async () => {
    try {
      const data: AppleData = {
        email: params.email as string,
        name: (params.name as string) || 'Apple User',
        appleId: params.appleId as string,
      };
      
      setAppleData(data);
      setAuthProvider('apple');
      
      // Suggest a username based on their name
      const suggestedNickname = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 15);
      setNickname(suggestedNickname || 'user');
      setLoading(false);
    } catch (error: any) {
      console.error('Apple auth callback error:', error);
      Alert.alert('Authentication Failed', 'Failed to process Apple sign-in');
      router.replace('/auth/login');
    }
  };

  const processGoogleAuth = async () => {
    try {
      // Get session_id from URL params or hash
      let sessionId = params.session_id as string;
      
      // Also check URL hash for web
      if (!sessionId && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const match = hash.match(/session_id=([^&]+)/);
        if (match) {
          sessionId = match[1];
        }
      }

      if (!sessionId) {
        Alert.alert('Error', 'No session ID found');
        router.replace('/auth/login');
        return;
      }

      // Exchange session_id for user data
      const response = await axios.post(`${API_URL}/api/auth/google/session`, {
        session_id: sessionId,
      });

      const { isNewUser, user, googleData: gData } = response.data;

      if (!isNewUser && user) {
        // Existing user - log them in directly
        await login(user);
        router.replace('/(tabs)/profile');
      } else {
        // New user - need to set username
        setGoogleData(gData);
        // Suggest a username based on their name
        const suggestedNickname = gData.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 15);
        setNickname(suggestedNickname);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Google auth error:', error);
      Alert.alert(
        'Authentication Failed',
        error.response?.data?.detail || 'Failed to sign in with Google'
      );
      router.replace('/auth/login');
    }
  };

  const checkNicknameAvailability = async (value: string) => {
    if (value.length < 3) {
      setNicknameError('Username must be at least 3 characters');
      return;
    }
    if (value.length > 20) {
      setNicknameError('Username must be 20 characters or less');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setNicknameError('Only letters, numbers, and underscores allowed');
      return;
    }

    setCheckingNickname(true);
    try {
      const response = await axios.get(`${API_URL}/api/auth/check-username/${value}`);
      if (!response.data.available) {
        setNicknameError('Username is already taken');
      } else {
        setNicknameError('');
      }
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setCheckingNickname(false);
    }
  };

  const handleNicknameChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setNickname(cleaned);
    setNicknameError('');
    
    // Debounce check
    if (cleaned.length >= 3) {
      const timeoutId = setTimeout(() => checkNicknameAvailability(cleaned), 500);
      return () => clearTimeout(timeoutId);
    }
  };

  const completeRegistration = async () => {
    if ((!googleData && !appleData) || !nickname) return;
    
    if (nicknameError) {
      Alert.alert('Invalid Username', nicknameError);
      return;
    }

    if (nickname.length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters');
      return;
    }

    setCompleting(true);
    try {
      let response;
      
      if (authProvider === 'apple' && appleData) {
        response = await axios.post(`${API_URL}/api/auth/apple/complete`, {
          email: appleData.email,
          name: appleData.name,
          nickname: nickname,
          appleId: appleData.appleId,
        });
      } else if (googleData) {
        response = await axios.post(`${API_URL}/api/auth/google/complete`, {
          email: googleData.email,
          name: googleData.name,
          nickname: nickname,
          picture: googleData.picture,
          googleId: googleData.googleId,
        });
      } else {
        throw new Error('No auth data available');
      }

      await login(response.data);
      Alert.alert('Welcome!', `Your account has been created as @${nickname}`);
      router.replace('/(tabs)/profile');
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert(
        'Registration Failed',
        error.response?.data?.detail || 'Failed to complete registration'
      );
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E1FF00" />
          <Text style={styles.loadingText}>
            {authProvider === 'apple' ? 'Signing in with Apple...' : 'Signing in with Google...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Welcome Message */}
          <View style={styles.welcomeSection}>
            <LinearGradient
              colors={['#E1FF00', '#E91E63']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.iconGradient}
            >
              <Ionicons name="person-add" size={40} color="#fff" />
            </LinearGradient>
            
            <Text style={styles.title}>Almost there!</Text>
            <Text style={styles.subtitle}>
              Welcome, {authProvider === 'apple' ? (appleData?.name || 'there') : (googleData?.name || 'there')}! Choose a username for your profile.
            </Text>
          </View>

          {/* Auth Provider Info */}
          <View style={styles.googleInfoCard}>
            <Ionicons 
              name={authProvider === 'apple' ? 'logo-apple' : 'logo-google'} 
              size={24} 
              color={authProvider === 'apple' ? '#fff' : '#4285F4'} 
            />
            <View style={styles.googleInfoText}>
              <Text style={styles.googleEmail}>
                {authProvider === 'apple' ? appleData?.email : googleData?.email}
              </Text>
              <Text style={styles.googleNote}>
                Signed in with {authProvider === 'apple' ? 'Apple' : 'Google'}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          </View>

          {/* Username Input */}
          <View style={styles.form}>
            <Text style={styles.inputLabel}>Choose your username</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.atSymbol}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                placeholderTextColor="#666"
                value={nickname}
                onChangeText={handleNicknameChange}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              {checkingNickname ? (
                <ActivityIndicator size="small" color="#E1FF00" />
              ) : nickname.length >= 3 && !nicknameError ? (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              ) : null}
            </View>
            
            {nicknameError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#F44336" />
                <Text style={styles.errorText}>{nicknameError}</Text>
              </View>
            ) : (
              <Text style={styles.hintText}>
                3-20 characters, letters, numbers, and underscores only
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.completeButton,
                (completing || nicknameError || nickname.length < 3) && styles.completeButtonDisabled
              ]}
              onPress={completeRegistration}
              disabled={completing || !!nicknameError || nickname.length < 3}
            >
              {completing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.completeButtonText}>Complete Registration</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  googleInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  googleInfoText: {
    flex: 1,
    marginLeft: 12,
  },
  googleEmail: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  googleNote: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  form: {
    flex: 1,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  atSymbol: {
    color: '#E1FF00',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 4,
  },
  input: {
    flex: 1,
    height: 56,
    color: '#fff',
    fontSize: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorText: {
    color: '#F44336',
    fontSize: 13,
  },
  hintText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1FF00',
    borderRadius: 12,
    padding: 16,
    marginTop: 32,
    gap: 8,
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
