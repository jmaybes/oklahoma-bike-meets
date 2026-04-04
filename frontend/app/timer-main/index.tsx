import { Redirect } from 'expo-router';

// This route has been consolidated into /timer
// Redirecting for backwards compatibility
export default function TimerMainRedirect() {
  return <Redirect href="/timer" />;
}
