import { httpClient } from './httpClient.js';

export const dashboardApi = {
  summary: async (range = {}) => {
    const { data } = await httpClient.get('/dashboard/summary', { params: range });
    return data;
  },
  salesOverview: async (range = {}) => {
    const { data } = await httpClient.get('/dashboard/sales-overview', { params: range });
    return data;
  },
  purchaseOverview: async (range = {}) => {
    const { data } = await httpClient.get('/dashboard/purchase-overview', { params: range });
    return data;
  },
};
