import { httpClient } from './httpClient.js';

export const vendorsApi = {
  list: async (params) => (await httpClient.get('/vendors', { params })).data,
  summary: async () => (await httpClient.get('/vendors/summary')).data,
  get: async (id) => (await httpClient.get(`/vendors/${id}`)).data,
  create: async (payload) => (await httpClient.post('/vendors', payload)).data,
  update: async (id, payload) => (await httpClient.put(`/vendors/${id}`, payload)).data,
  updateStatus: async (id, status) => (await httpClient.patch(`/vendors/${id}/status`, { status })).data,
  clone: async (id) => (await httpClient.post(`/vendors/${id}/clone`)).data,
  remove: async (id) => httpClient.delete(`/vendors/${id}`),
  transactions: async (id, params) => (await httpClient.get(`/vendors/${id}/transactions`, { params })).data,
  statement: async (id, params) => (await httpClient.get(`/vendors/${id}/statement`, { params })).data,
  emailStatement: async (id, params, payload) => (await httpClient.post(`/vendors/${id}/statement/email`, payload, { params })).data,
  downloadStatement: async (id, format, params) => httpClient.get(`/vendors/${id}/statement/${format}`, { params, responseType: 'blob' }),
};
