import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BetaNoticeModal from '../components/BetaNoticeModal';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
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
