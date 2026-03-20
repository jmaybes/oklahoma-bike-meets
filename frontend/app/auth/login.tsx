import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Keys for secure storage
const REMEMBER_ME_KEY = 'rememberMe';
const SAVED_EMAIL_KEY = 'savedEmail';
const SAVED_PASSWORD_KEY = 'savedPassword';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Get the current URL for the callback
      const currentUrl = Platform.OS === 'web' 
        ? window.location.origin 
        : 'okccarmeets://';
      
      // Construct the callback URL
      const callbackUrl = `${currentUrl}/auth/google-callback`;
      
      // Emergent Auth URL
      const authUrl = `https://demobackend.emergentagent.com/auth/v1/env/oauth/google?callback_url=${encodeURIComponent(callbackUrl)}`;
      
      if (Platform.OS === 'web') {
        // On web, redirect directly
        window.location.href = authUrl;
      } else {
        // On mobile, open in browser
        const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);
        
        if (result.type === 'success' && result.url) {
          // Extract session_id from URL
          const url = new URL(result.url);
          const sessionId = url.searchParams.get('session_id') || 
                           url.hash.match(/session_id=([^&]+)/)?.[1];
          
          if (sessionId) {
            // Navigate to callback screen with session_id
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

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
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
      Alert.alert(
        'Login Failed',
        error.response?.data?.detail || 'Invalid credentials'
      );
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

  if (loadingCredentials) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Ionicons name="car-sport" size={64} color="#FF6B35" />
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Login to access all features</Text>

          <View style={styles.form}>
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
                onChangeText={setPassword}
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

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
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

            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => router.push('/auth/register')}
            >
              <Text style={styles.registerLinkText}>
                Don't have an account? <Text style={styles.registerLinkBold}>Sign Up</Text>
              </Text>
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
  keyboardView: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  backButton: {
    padding: 4,
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
  registerLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  registerLinkText: {
    color: '#888',
    fontSize: 14,
  },
  registerLinkBold: {
    color: '#FF6B35',
    fontWeight: 'bold',
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
});
