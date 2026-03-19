import { Stack } from 'expo-router';

export default function TimerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="my-runs" />
    </Stack>
  );
}
