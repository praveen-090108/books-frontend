import { httpClient } from './httpClient.js';

export const expenseAccountsApi = {
  list: async (includeInactive = false) => (await httpClient.get('/masters/expense-accounts', { params: { includeInactive } })).data,
  create: async (payload) => (await httpClient.post('/masters/expense-accounts', payload)).data,
  update: async (id, payload) => (await httpClient.put(`/masters/expense-accounts/${id}`, payload)).data,
  remove: async (id) => httpClient.delete(`/masters/expense-accounts/${id}`),
};
