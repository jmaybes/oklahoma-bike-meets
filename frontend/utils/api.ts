import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// For native builds (iOS/Android): ALWAYS use production URL
// For web (Emergent preview): Allow env variable override
const API_URL = Platform.OS === 'web'
  ? (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.okccarmeets.com')
  : 'https://api.okccarmeets.com';

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
