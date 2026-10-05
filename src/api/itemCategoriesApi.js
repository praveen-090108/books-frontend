import { httpClient } from './httpClient.js';

export const itemCategoriesApi = {
  list: async (includeInactive = false) => (await httpClient.get('/masters/item-categories', { params: { includeInactive } })).data,
  create: async (payload) => (await httpClient.post('/masters/item-categories', payload)).data,
  update: async (id, payload) => (await httpClient.put(`/masters/item-categories/${id}`, payload)).data,
  remove: async (id) => httpClient.delete(`/masters/item-categories/${id}`),
};
