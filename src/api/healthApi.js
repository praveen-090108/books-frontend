import { httpClient } from './httpClient.js';

export const API_COMPATIBILITY_VERSION = '2026-07-20-payment-received-v1';

export const healthApi = {
  get: async () => {
    const { data } = await httpClient.get('/health');
    return data;
  },
};
