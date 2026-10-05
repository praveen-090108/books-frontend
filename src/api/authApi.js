import { httpClient } from './httpClient.js';
export const authApi = {
  login: async (payload) => (await httpClient.post('/auth/login', payload)).data,
  forgotPassword: async (email) => (await httpClient.post('/auth/forgot-password', { email })).data,
  resetPassword: async (token, password) => (await httpClient.post('/auth/reset-password', { token, password })).data,
};
export const usersApi = {
  list: async ({ search = '', page = 0, size = 200 } = {}) => (await httpClient.get('/settings/users', { params: { search, page, size, sort: 'name,asc' } })).data,
  create: async (payload) => (await httpClient.post('/settings/users', payload)).data,
  update: async (id, payload) => (await httpClient.put(`/settings/users/${id}`, payload)).data,
  remove: async (id) => httpClient.delete(`/settings/users/${id}`),
};
export const resourceUsersApi = {
  dropdown: async () => (await httpClient.get('/resources/dropdown')).data,
  loginProfile: async (id) => (await httpClient.get(`/resources/${id}/login-profile`)).data,
  reportingManagers: async (department, excludeResourceId) => (await httpClient.get('/resources/reporting-managers', {
    params: { department, excludeResourceId: excludeResourceId || undefined },
  })).data,
  salesPersons: async () => (await httpClient.get('/resources/sales-persons')).data,
};
