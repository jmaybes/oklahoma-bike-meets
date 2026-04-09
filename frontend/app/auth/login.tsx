import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Animated, { 
  FadeInDown, 
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../contexts/AuthContext';

import { API_URL } from '../../utils/api';

// Keys for secure storage
const REMEMBER_ME_KEY = 'rememberMe';
const SAVED_EMAIL_KEY = 'savedEmail';
const SAVED_PASSWORD_KEY = 'savedPassword';

export default function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const remembered = await SecureStore.getItemAsync(REMEMBER_ME_KEY);
      
      if (remembered === 'true') {
        const savedEmail = await SecureStore.getItemAsync(SAVED_EMAIL_KEY);
        const savedPassword = await SecureStore.getItemAsync(SAVED_PASSWORD_KEY);
        
        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
        }
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    } finally {
      setLoadingCredentials(false);
    }
  };

  const saveCredentials = async () => {
    try {
      if (rememberMe) {
        await SecureStore.setItemAsync(REMEMBER_ME_KEY, 'true');
        await SecureStore.setItemAsync(SAVED_EMAIL_KEY, email);
        await SecureStore.setItemAsync(SAVED_PASSWORD_KEY, password);
      } else {
        await SecureStore.deleteItemAsync(REMEMBER_ME_KEY);
        await SecureStore.deleteItemAsync(SAVED_EMAIL_KEY);
        await SecureStore.deleteItemAsync(SAVED_PASSWORD_KEY);
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setLoginError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setLoginError('');
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });
      
      // Save credentials if remember me is checked
      await saveCredentials();
      
      await login(response.data);
      Alert.alert('Success', 'Logged in successfully!');
      router.replace('/(tabs)/profile');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error?.response?.status === 401) {
        setLoginError('Invalid email or password. If you recently created an account and it\'s not working, you may need to re-register.');
      } else if (error?.response?.status >= 500) {
        setLoginError('The server is temporarily unavailable. Please try again in a moment.');
      } else if (error?.response) {
        setLoginError(`Connection issue (${error.response.status}). Please try again.`);
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        setLoginError('Connection timed out. Check your internet connection and try again.');
      } else {
        setLoginError('Unable to reach the server. Please check your internet connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRememberMeChange = async (value: boolean) => {
    setRememberMe(value);
    
    // If turning off, clear saved credentials
    if (!value) {
      try {
        await SecureStore.deleteItemAsync(REMEMBER_ME_KEY);
        await SecureStore.deleteItemAsync(SAVED_EMAIL_KEY);
        await SecureStore.deleteItemAsync(SAVED_PASSWORD_KEY);
      } catch (error) {
        console.error('Error clearing credentials:', error);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const currentUrl = Platform.OS === 'web' 
        ? window.location.origin 
        : ExpoLinking.createURL('');
      
      const callbackUrl = Platform.OS === 'web'
        ? `${currentUrl}/auth/google-callback`
        : ExpoLinking.createURL('auth/google-callback');
      
      const authServiceUrl = process.env.EXPO_PUBLIC_AUTH_SERVICE_URL || 'https://demobackend.emergentagent.com';
      const authUrl = `${authServiceUrl}/auth/v1/env/oauth/google?callback_url=${encodeURIComponent(callbackUrl)}`;
      
      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);
        
        if (result.type === 'success' && result.url) {
          const url = new URL(result.url);
          const sessionId = url.searchParams.get('session_id') || 
                           url.hash.match(/session_id=([^&]+)/)?.[1];
          
          if (sessionId) {
            router.push(`/auth/google-callback?session_id=${sessionId}`);
          }
        }
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      Alert.alert('Error', 'Failed to initiate Google sign-in');
    } finally {
      setGoogleLoading(false);
    }
  };

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

  if (loadingCredentials) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </View>
    );
  }

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
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Ionicons name="car-sport" size={64} color="#FF6B35" />
          </Animated.View>
          <Animated.Text 
            entering={FadeInDown.delay(200).springify()}
            style={styles.title}
          >
            Welcome Back
          </Animated.Text>
          <Animated.Text 
            entering={FadeInDown.delay(300).springify()}
            style={styles.subtitle}
          >
            Login to access all features
          </Animated.Text>

          <Animated.View 
            entering={FadeInDown.delay(400).springify()}
            style={styles.form}
          >
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={(text) => { setEmail(text); setLoginError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {email.length > 0 && (
                <TouchableOpacity onPress={() => setEmail('')}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666"
                value={password}
                onChangeText={(text) => { setPassword(text); setLoginError(''); }}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>

            {/* Remember Me Toggle */}
            <View style={styles.rememberMeContainer}>
              <TouchableOpacity 
                style={styles.rememberMeRow}
                onPress={() => handleRememberMeChange(!rememberMe)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  rememberMe && styles.checkboxChecked
                ]}>
                  {rememberMe && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>
              <Text style={styles.rememberMeHint}>
                Save login info on this device
              </Text>
            </View>

            {loginError ? (
              <View style={styles.loginErrorBox}>
                <Ionicons name="alert-circle" size={18} color="#FF3B30" />
                <Text style={styles.loginErrorText}>{loginError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            {rememberMe && email && password && (
              <View style={styles.savedIndicator}>
                <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
                <Text style={styles.savedIndicatorText}>
                  Credentials will be saved securely
                </Text>
              </View>
            )}

            {/* Social Sign-In Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In */}
            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton, googleLoading && { opacity: 0.6 }]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#333" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={22} color="#4285F4" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple Sign-In (iOS only) */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton, appleLoading && { opacity: 0.6 }]}
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
              style={styles.registerLink}
              onPress={() => router.push('/auth/register')}
            >
              <Text style={styles.registerLinkText}>
                Don't have an account? <Text style={styles.registerLinkBold}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    justifyContent: 'center',
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
  rememberMeContainer: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  rememberMeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  rememberMeHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 34,
  },
  loginButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  loginErrorText: {
    flex: 1,
    fontSize: 13,
    color: '#FF6B6B',
    lineHeight: 18,
  },
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  savedIndicatorText: {
    color: '#4CAF50',
    fontSize: 12,
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  registerLinkText: {
    color: '#888',
    fontSize: 14,
  },
  registerLinkBold: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#666',
    fontSize: 13,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 10,
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  appleButton: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#333',
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
