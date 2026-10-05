import { httpClient } from './httpClient.js';

export const purchaseOrdersApi = {
  list: async (params = {}) => {
    const { data } = await httpClient.get('/purchase-orders', { params });
    return data;
  },
  summary: async () => {
    const { data } = await httpClient.get('/purchase-orders/summary');
    return data;
  },
  filters: async () => {
    const { data } = await httpClient.get('/purchase-orders/filters');
    return data;
  },
  get: async (id) => {
    const { data } = await httpClient.get(`/purchase-orders/${id}`);
    return data;
  },
  create: async (payload, action = 'draft') => {
    const { data } = await httpClient.post('/purchase-orders', payload, { params: { action } });
    return data;
  },
  update: async (id, payload) => {
    const { data } = await httpClient.put(`/purchase-orders/${id}`, payload);
    return data;
  },
  issue: async (id) => {
    const { data } = await httpClient.post(`/purchase-orders/${id}/issue`);
    return data;
  },
  receive: async (id, payload) => {
    const { data } = await httpClient.post(`/purchase-orders/${id}/receive`, payload);
    return data;
  },
  clone: async (id) => {
    const { data } = await httpClient.post(`/purchase-orders/${id}/clone`);
    return data;
  },
  convertToBill: async (id) => {
    const { data } = await httpClient.post(`/purchase-orders/${id}/convert-to-bill`);
    return data;
  },
  sendEmail: async (id, payload) => {
    const { data } = await httpClient.post(`/purchase-orders/${id}/send-email`, payload);
    return data;
  },
  cancel: async (id, reason = '') => {
    const { data } = await httpClient.post(`/purchase-orders/${id}/cancel`, { reason });
    return data;
  },
  close: async (id, reason = '') => {
    const { data } = await httpClient.post(`/purchase-orders/${id}/close`, { reason });
    return data;
  },
  remove: async (id) => httpClient.delete(`/purchase-orders/${id}`),
  pdf: async (id) => {
    const { data } = await httpClient.get(`/purchase-orders/${id}/pdf`, { responseType: 'blob' });
    return data;
  },
};
