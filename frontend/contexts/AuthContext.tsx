import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../utils/api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface User {
  id: string;
  email: string;
  name: string;
  nickname?: string;
  profilePic?: string;
  isAdmin?: boolean;
  notificationsEnabled?: boolean;
  locationSharingEnabled?: boolean;
  locationPrivate?: boolean;
  latitude?: number;
  longitude?: number;
  pushToken?: string;
  authProvider?: string;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  expoPushToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token = null;
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E15500',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'a936daac-9d2d-4795-aba0-e6e7554f9395',
      });
      token = tokenData.data;
    } catch (error) {
      console.log('Error getting push token:', error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    loadUser();
    
    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Navigate based on notification type when user taps
      const data = response.notification.request.content.data;
      if (data) {
        try {
          if (data.type === 'garage_comment' && data.carId) {
            router.push(`/garage/${data.carId}`);
          } else if (data.type === 'message' && data.senderId) {
            router.push('/messages');
          } else if (data.type === 'popup_event' && data.eventId) {
            router.push(`/event/${data.eventId}`);
          } else if (data.type === 'event_reminder' && data.eventId) {
            router.push(`/event/${data.eventId}`);
          } else if (data.type === 'rsvp_reminder' && data.eventId) {
            router.push(`/event/${data.eventId}`);
          } else if (data.type === 'meetup_invite') {
            router.push('/(tabs)/nearby');
          } else if (data.type === 'feedback_response' && data.feedbackId) {
            router.push('/feedback/history');
          }
        } catch (e) {
          console.log('Navigation from notification failed:', e);
        }
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const loadUser = async () => {
    try {
      const userData = await Promise.race([
        AsyncStorage.getItem('user'),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      if (userData && typeof userData === 'string') {
        const parsedUser = JSON.parse(userData);
        
        // Validate that this user still exists in the current database
        // This handles cases where the backend database changed (e.g. after a migration)
        try {
          const validateRes = await Promise.race([
            axios.get(`${API_URL}/api/users/${parsedUser.id}`),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
          ]);
          if (validateRes && (validateRes as any).status === 200) {
            // Use fresh data from API — the endpoint now returns full user data
            const freshUser = (validateRes as any).data;
            // Only merge if we got valid data back
            if (freshUser && freshUser.id) {
              await AsyncStorage.setItem('user', JSON.stringify(freshUser));
              setUser(freshUser);
            } else {
              // Unexpected response format — keep cached user
              setUser(parsedUser);
            }
          } else {
            // User not found in current database — clear stale session silently
            console.log('Cached user not found in database, clearing session');
            await AsyncStorage.removeItem('user');
            setUser(null);
          }
        } catch (validateError: any) {
          if (validateError?.response?.status === 404 || validateError?.response?.status === 400) {
            // User definitely doesn't exist in new database — clear session, show login
            console.log('Cached user not found on server, clearing session');
            await AsyncStorage.removeItem('user');
            setUser(null);
          } else {
            // Network error, timeout, or server hiccup — keep cached user logged in
            // They'll validate successfully on the next launch when connection is stable
            console.log('Temporary validation issue, keeping user logged in');
            setUser(parsedUser);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Defer push token registration to avoid interfering with initial render
  useEffect(() => {
    if (user && !isLoading) {
      const timer = setTimeout(() => {
        registerPushToken(user.id);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading]);

  const registerPushToken = async (userId: string) => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setExpoPushToken(token);
        // Send token to backend
        await axios.post(`${API_URL}/api/users/register-push-token`, {
          userId: userId,
          pushToken: token,
        });
        console.log('Push token registered:', token);
      }
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  };

  const login = async (userData: User) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      // Register push notifications on login
      registerPushToken(userData.id);
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      setUser(null);
      setExpoPushToken(null);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  };

  const updateUser = async (userData: User) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated: !!user, isLoading, expoPushToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
