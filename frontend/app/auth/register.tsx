import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as ExpoLinking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../contexts/AuthContext';

import { API_URL } from '../../utils/api';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client IDs - Replace with your own from Google Cloud Console
const GOOGLE_WEB_CLIENT_ID = '211008012524-l8k1999l1llvlfsqp0rm8jshg2ad96ev.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '211008012524-tq7bfhgk3bn9oaobtc4ls23srmaa577d.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '211008012524-3pfd27u1p30br8v03mt9colo9kqlpt9o.apps.googleusercontent.com';

export default function RegisterScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Google Auth setup
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  // Handle Google Auth response
  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      if (id_token) {
        handleGoogleToken(id_token);
      }
    } else if (googleResponse?.type === 'error') {
      setGoogleLoading(false);
      Alert.alert('Error', 'Google sign-in failed');
    }
  }, [googleResponse]);

  const handleRegister = async () => {
    if (!name || !nickname || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        name,
        nickname,
        email,
        password,
      });
      
      await login(response.data.user);
      Alert.alert('Success', 'Account created successfully!');
      router.replace('/(tabs)/profile');
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert(
        'Registration Failed',
        error.response?.data?.detail || 'Failed to create account'
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================== Google Sign In ====================
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await googlePromptAsync();
    } catch (error) {
      console.error('Google sign-in error:', error);
      Alert.alert('Error', 'Failed to initiate Google sign-in');
      setGoogleLoading(false);
    }
  };

  const handleGoogleToken = async (idToken: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/google/verify-token`, {
        id_token: idToken,
      });

      const { isNewUser, user, googleData } = response.data;

      if (isNewUser) {
        router.push({
          pathname: '/auth/google-callback',
          params: {
            email: googleData.email,
            name: googleData.name,
            picture: googleData.picture || '',
            googleId: googleData.googleId,
            isNewUser: 'true',
          },
        });
      } else {
        await login(user);
        router.replace('/(tabs)/home');
      }
    } catch (error: any) {
      console.error('Google token verification error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ==================== Apple Sign In ====================
  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert('Error', 'Failed to get Apple identity token');
        return;
      }

      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(' ')
        : '';

      const response = await axios.post(`${API_URL}/api/auth/apple/session`, {
        identityToken: credential.identityToken,
        fullName: fullName || undefined,
        email: credential.email || undefined,
      });

      const { isNewUser, user, appleData } = response.data;

      if (isNewUser) {
        router.push({
          pathname: '/auth/google-callback',
          params: {
            email: appleData.email,
            name: appleData.name || 'Apple User',
            picture: '',
            googleId: '',
            appleId: appleData.appleId,
            authProvider: 'apple',
          },
        });
      } else {
        await login(user);
        Alert.alert('Welcome back!', `Signed in as ${user.nickname || user.email}`);
        router.replace('/(tabs)/profile');
      }
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(
          'Apple Sign In Failed',
          error.message || 'Could not sign in with Apple. Please try again.'
        );
      }
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Ionicons name="car-sport" size={64} color="#FF5500" />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the car community</Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#666"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="car" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nickname (visible to other users)"
                  placeholderTextColor="#666"
                  value={nickname}
                  onChangeText={setNickname}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={22}
                    color="#888"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#666"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>

              <TouchableOpacity
                style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign-In Button */}
              <TouchableOpacity
                style={[styles.googleButton, googleLoading && styles.googleButtonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#333" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#4285F4" />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Apple Sign-In Button (iOS only) */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.appleButton, appleLoading && styles.appleButtonDisabled]}
                  onPress={handleAppleSignIn}
                  disabled={appleLoading}
                >
                  {appleLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={22} color="#fff" />
                      <Text style={styles.appleButtonText}>Continue with Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => router.push('/auth/login')}
              >
                <Text style={styles.loginLinkText}>
                  Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
                </Text>
              </TouchableOpacity>
            </View>
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
    padding: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    paddingTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
  },
  form: {
    width: '100%',
    marginTop: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    color: '#fff',
    fontSize: 16,
  },
  registerButton: {
    backgroundColor: '#FF5500',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#666',
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
    marginTop: 10,
  },
  appleButtonDisabled: {
    opacity: 0.6,
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  loginLinkText: {
    color: '#888',
    fontSize: 14,
  },
  loginLinkBold: {
    color: '#FF5500',
    fontWeight: 'bold',
  },
});
