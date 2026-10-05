import { httpClient } from './httpClient.js';

export const paymentReceivedApi = {
  eligibleInvoices: async ({ customerId, paymentId }) => {
    const { data } = await httpClient.get('/payments-received/eligible-invoices', {
      params: { customerId, paymentId: paymentId || undefined },
    });
    return data;
  },
  summary: async () => {
    const { data } = await httpClient.get('/payments-received/summary');
    return data;
  },
  list: async (params) => {
    const { data } = await httpClient.get('/payments-received', { params });
    return data;
  },
  get: async (id) => {
    const { data } = await httpClient.get(`/payments-received/${id}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await httpClient.post('/payments-received', payload);
    return data;
  },
  update: async ({ id, payload }) => {
    const { data } = await httpClient.put(`/payments-received/${id}`, payload);
    return data;
  },
  reverse: async ({ id, reason }) => {
    const { data } = await httpClient.post(`/payments-received/${id}/reverse`, { reason });
    return data;
  },
  remove: async (id) => {
    await httpClient.delete(`/payments-received/${id}`);
  },
};
