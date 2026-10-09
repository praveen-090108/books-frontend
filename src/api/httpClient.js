import axios from 'axios';
import { normalizeSession, useAuthStore } from '../store/authStore.js';

const runtimeEnvironment = import.meta.env ?? {};
const REQUEST_ID_HEADER = 'X-Request-ID';
const isDevelopment = import.meta.env.DEV;
const fallbackMessages = {
  400: 'The request contains invalid or incomplete information.', 401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to perform this action.", 404: 'The requested record could not be found.',
  409: 'This record conflicts with existing or recently changed data.', 422: 'Please check the highlighted fields and try again.',
  429: 'Too many requests were made. Please wait a moment and try again.',
  500: "We couldn't complete your request. Please try again or contact support.",
  502: 'An external service is temporarily unavailable. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
  504: 'The server took too long to respond. Please try again shortly.',
};

function createRequestId() {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeServerMessage(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) return null;
  if (/exception|stack\s*trace|hibernate|jdbc:|\bselect\s|\binsert\s|\bdelete\s+from|\bjava\./i.test(value)) return null;
  return value.trim();
}

export function normalizeApiError(error) {
  const status = Number(error?.response?.status || 0);
  const data = error?.response?.data && typeof error.response.data === 'object' ? error.response.data : {};
  const timedOut = error?.code === 'ECONNABORTED';
  const networkFailure = !error?.response;
  const serverMessage = safeServerMessage(data.message);
  const message = timedOut
    ? 'The request took too long. Please check your connection and try again.'
    : networkFailure
      ? "We couldn't connect to IntelliaTech Books. Please check that the service is running and try again."
      : serverMessage || fallbackMessages[status] || (status >= 500 ? fallbackMessages[500] : 'The request could not be completed.');
  return {
    status,
    errorCode: typeof data.errorCode === 'string' ? data.errorCode : (networkFailure ? 'NETWORK_ERROR' : 'REQUEST_FAILED'),
    message,
    fieldErrors: data.fieldErrors || data.validationErrors || {},
    path: typeof data.path === 'string' ? data.path : null,
    timestamp: data.timestamp || new Date().toISOString(),
    traceId: data.traceId || error?.response?.headers?.['x-request-id'] || error?.config?.headers?.[REQUEST_ID_HEADER] || null,
    method: error?.config?.method?.toUpperCase() || 'REQUEST',
    url: error?.config?.url || 'unknown endpoint',
    isNetworkError: networkFailure,
  };
}

export const httpClient = axios.create({
  baseURL: runtimeEnvironment.VITE_API_BASE_URL || '/api', timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use((config) => {
  const session = normalizeSession(useAuthStore.getState());
  const setHeader = (name, value) => {
    if (typeof config.headers?.set === 'function') config.headers.set(name, value);
    else config.headers = { ...config.headers, [name]: value };
  };
  setHeader(REQUEST_ID_HEADER, createRequestId());
  if (session?.token) setHeader('Authorization', `Bearer ${session.token}`);
  if (config.data instanceof FormData) {
    if (typeof config.headers?.delete === 'function') config.headers.delete('Content-Type');
    else delete config.headers['Content-Type'];
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const appError = normalizeApiError(error);
    error.appError = appError;
    const diagnostic = { method: appError.method, url: appError.url, status: appError.status || 'network-error', errorCode: appError.errorCode, traceId: appError.traceId };
    if (isDevelopment) console.error('[API request failed]', diagnostic, error);
    else console.error('[API request failed]', diagnostic);
    const isLogin = String(error.config?.url || '').includes('/auth/login');
    if (appError.status === 401 && useAuthStore.getState().user && !isLogin) useAuthStore.getState().clearSession();
    if (typeof window !== 'undefined' && !isLogin) window.dispatchEvent(new CustomEvent('app:api-error', { detail: appError }));
    return Promise.reject(error);
  },
);
