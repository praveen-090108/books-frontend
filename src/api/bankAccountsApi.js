import { httpClient } from './httpClient.js';

export const bankAccountsApi = {
  list: async (includeInactive = false) => (await httpClient.get('/masters/bank-accounts', { params: { includeInactive } })).data,
  create: async (payload) => (await httpClient.post('/masters/bank-accounts', payload)).data,
  update: async (id, payload) => (await httpClient.put(`/masters/bank-accounts/${id}`, payload)).data,
  setStatus: async (id, active) => (await httpClient.patch(`/masters/bank-accounts/${id}/status`, null, { params: { active } })).data,
  remove: async (id) => httpClient.delete(`/masters/bank-accounts/${id}`),
};
