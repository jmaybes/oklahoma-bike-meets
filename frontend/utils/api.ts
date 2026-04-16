import axios from 'axios';
import Constants from 'expo-constants';

// Production URL - the definitive source of truth
const PRODUCTION_URL = 'https://api.okccarmeets.com';

// Determine API URL with strict safety:
// NEVER use the Emergent preview URL in a standalone/production app
const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
const isEmergentUrl = envUrl && envUrl.includes('emergentagent.com');
const isStandalone = Constants.expoConfig?.extra?.eas?.projectId || Constants.appOwnership !== 'expo';

let API_URL: string;
if (isEmergentUrl && isStandalone) {
  // Block Emergent URL in production/standalone builds
  API_URL = PRODUCTION_URL;
} else if (envUrl) {
  API_URL = envUrl;
} else {
  API_URL = PRODUCTION_URL;
}

console.log('[API] URL:', API_URL, '| env:', envUrl || 'not set');

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
