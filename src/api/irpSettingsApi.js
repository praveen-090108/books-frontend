import { httpClient } from './httpClient.js';
export const irpSettingsApi = {
  list: async () => (await httpClient.get('/settings/irp')).data,
  save: async (environment, payload) => (await httpClient.put(`/settings/irp/${environment}`, payload)).data,
  test: async (environment) => (await httpClient.post(`/settings/irp/${environment}/test-connection`)).data,
  activate: async (environment) => (await httpClient.post(`/settings/irp/${environment}/activate`)).data,
};
