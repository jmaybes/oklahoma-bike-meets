import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BetaNoticeModal from '../components/BetaNoticeModal';
import { useEffect, useCallback } from 'react';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Alert, Platform, View } from 'react-native';

// Prevent splash screen from auto-hiding until fonts are loaded
SplashScreen.preventAutoHideAsync();

async function checkForUpdates() {
  if (__DEV__) return; // Skip in development
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Update Available',
        'A new version has been downloaded. Restart to apply?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart', onPress: () => Updates.reloadAsync() },
        ]
      );
    }
  } catch (e) {
    // Silent fail - don't bother user
    console.log('Update check failed:', e);
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'RockSalt_400Regular': require('../assets/fonts/RockSalt_400Regular.ttf'),
  });

  useEffect(() => {
    checkForUpdates();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }
  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <AuthProvider>
        <Stack 
          screenOptions={{ 
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 250,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen 
            name="(tabs)" 
            options={{ 
              headerShown: false,
              animation: 'fade',
            }} 
          />
          <Stack.Screen 
            name="event/[id]/index" 
            options={{ 
              headerShown: false,
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }} 
          />
          <Stack.Screen 
            name="auth/login" 
            options={{ 
              headerShown: false,
              animation: 'fade_from_bottom',
              animationDuration: 300,
            }} 
          />
          <Stack.Screen 
            name="auth/register" 
            options={{ 
              headerShown: false,
              animation: 'slide_from_right',
            }} 
          />
        </Stack>
        <BetaNoticeModal />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
