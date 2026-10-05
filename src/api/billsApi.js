import { httpClient } from './httpClient.js';

export const billsApi = {
  list: async (params = {}) => (await httpClient.get('/bills', { params })).data,
  summary: async () => (await httpClient.get('/bills/summary')).data,
  filters: async () => (await httpClient.get('/bills/filters')).data,
  get: async (id) => (await httpClient.get(`/bills/${id}`)).data,
  create: async (payload, action = 'draft') => (await httpClient.post('/bills', payload, { params: { action } })).data,
  update: async (id, payload, action = 'draft') => (await httpClient.put(`/bills/${id}`, payload, { params: { action } })).data,
  convertToOpen: async (id) => (await httpClient.post(`/bills/${id}/open`)).data,
  recordPayment: async (id, payload, idempotencyKey) => (await httpClient.post(`/bills/${id}/payments`, payload, { headers: { 'Idempotency-Key': idempotencyKey } })).data,
  updatePayment: async (id, paymentId, payload) => (await httpClient.put(`/bills/${id}/payments/${paymentId}`, payload)).data,
  reversePayment: async (id, paymentId, reason) => (await httpClient.post(`/bills/${id}/payments/${paymentId}/reverse`, { reason })).data,
  paymentReceipt: async (id, paymentId) => (await httpClient.get(`/bills/${id}/payments/${paymentId}/receipt`, { responseType: 'blob' })).data,
  clone: async (id) => (await httpClient.post(`/bills/${id}/clone`)).data,
  void: async (id, reason) => (await httpClient.post(`/bills/${id}/void`, { reason })).data,
  setExpectedPaymentDate: async (id, expectedPaymentDate) => (await httpClient.post(`/bills/${id}/expected-payment-date`, { expectedPaymentDate })).data,
  remove: async (id) => httpClient.delete(`/bills/${id}`),
  pdf: async (id) => (await httpClient.get(`/bills/${id}/pdf`, { responseType: 'blob' })).data,
};
