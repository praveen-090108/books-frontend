import { httpClient } from './httpClient.js';

export const expensesApi = {
  list: async (params) => (await httpClient.get('/expenses', { params })).data,
  summary: async () => (await httpClient.get('/expenses/summary')).data,
  filters: async (params) => (await httpClient.get('/expenses/filters', { params })).data,
  get: async (id) => (await httpClient.get(`/expenses/${id}`)).data,
  create: async (payload) => (await httpClient.post('/expenses', payload)).data,
  update: async (id, payload) => (await httpClient.put(`/expenses/${id}`, payload)).data,
  remove: async (id) => httpClient.delete(`/expenses/${id}`),
};
