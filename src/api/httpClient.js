import axios from 'axios';
import { normalizeSession, useAuthStore } from '../store/authStore.js';

const runtimeEnvironment = import.meta.env ?? {};

export const httpClient = axios.create({
  baseURL: runtimeEnvironment.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

httpClient.interceptors.request.use((config) => {
  const currentSession = useAuthStore.getState();
  const session = normalizeSession(currentSession);
  if (session?.token) {
    if (typeof config.headers?.set === 'function') {
      config.headers.set('Authorization', `Bearer ${session.token}`);
    } else {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${session.token}`,
      };
    }
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const method = error.config?.method?.toUpperCase() || 'REQUEST';
    const url = error.config?.url || 'unknown endpoint';
    const detail = error.response?.data?.message || error.message || 'Unknown API error';
    console.error(`[API] ${method} ${url} failed: ${detail}`, error);

    if (error.response?.status === 401 && useAuthStore.getState().user && !String(error.config?.url || '').includes('/auth/login')) {
      useAuthStore.getState().clearSession();
    }

    return Promise.reject(error);
  },
);
