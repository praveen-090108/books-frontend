import { httpClient } from './httpClient.js';
export const domainIndustriesApi = {
  list: async (includeInactive=false) => (await httpClient.get('/masters/domain-industries',{params:{includeInactive}})).data,
  create: async (payload) => (await httpClient.post('/masters/domain-industries',payload)).data,
  update: async (id,payload) => (await httpClient.put(`/masters/domain-industries/${id}`,payload)).data,
  remove: async (id) => httpClient.delete(`/masters/domain-industries/${id}`),
};
