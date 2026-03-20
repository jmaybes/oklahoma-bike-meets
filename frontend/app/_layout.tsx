import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import BetaNoticeModal from '../components/BetaNoticeModal';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ headerShown: false }} />
      </Stack>
      <BetaNoticeModal />
    </AuthProvider>
  );
}
