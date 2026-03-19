import { Redirect, useRootNavigationState, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const { isAuthenticated } = useAuth();
  const [hasSeenLanding, setHasSeenLanding] = useState<boolean | null>(null);
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    checkLandingStatus();
  }, []);

  const checkLandingStatus = async () => {
    try {
      const seen = await AsyncStorage.getItem('hasSeenLanding');
      setHasSeenLanding(seen === 'true');
    } catch (error) {
      console.error('Error checking landing status:', error);
      setHasSeenLanding(false);
    }
  };

  // Wait until we have checked landing status and navigation is ready
  if (hasSeenLanding === null || !rootNavigationState?.key) {
    return null;
  }

  // Show landing page for first-time non-authenticated users
  if (!isAuthenticated && !hasSeenLanding) {
    return <Redirect href="/landing" />;
  }

  // Otherwise go to home
  return <Redirect href="/(tabs)/home" />;
}
