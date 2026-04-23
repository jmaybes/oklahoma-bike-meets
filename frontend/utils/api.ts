import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Detect if we're running in Expo Go (development) or a standalone build
const isExpoGo = Constants.appOwnership === 'expo';

// For Expo Go development: Use the Emergent preview URL
// For standalone/production builds: Use production URL
const getApiUrl = () => {
  // Always use env variable if available (works for web and Expo Go)
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  
  // Fallback to production for standalone builds
  return 'https://api.okcbikemeets.com';
};

const API_URL = getApiUrl();

console.log('[API] Platform:', Platform.OS, '| Expo Go:', isExpoGo, '| API_URL:', API_URL);

// Create axios instance with automatic retry for resilience
const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry interceptor - automatically retries failed requests
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Don't retry if we've already retried 3 times, or if it's a POST/PUT/DELETE
    // (to avoid duplicate writes)
    if (
      !config ||
      config._retryCount >= 3 ||
      ['post', 'put', 'delete'].includes(config.method)
    ) {
      return Promise.reject(error);
    }

    config._retryCount = config._retryCount || 0;
    config._retryCount += 1;

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, config._retryCount - 1) * 1000;

    await new Promise((resolve) => setTimeout(resolve, delay));

    return api(config);
  }
);

export { api, API_URL };
export default api;
