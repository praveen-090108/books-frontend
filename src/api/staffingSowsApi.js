import { httpClient } from './httpClient.js';

const base = (projectId) => `/staffing-projects/${projectId}/sows`;
const form = ({ startDate, endDate, document, notes }) => {
  const body = new FormData();
  body.append('startDate', startDate);
  body.append('endDate', endDate);
  if (document) body.append('document', document);
  if (notes?.trim()) body.append('notes', notes.trim());
  return body;
};

export const staffingSowsApi = {
  list: async (projectId) => (await httpClient.get(base(projectId))).data,
  current: async (projectId) => (await httpClient.get(`${base(projectId)}/current`)).data,
  initialize: async (projectId, payload) => (await httpClient.post(`${base(projectId)}/initialize`, form(payload), { timeout: 60000 })).data,
  updateCurrent: async (projectId, payload) => (await httpClient.put(`${base(projectId)}/current`, form(payload), { timeout: 60000 })).data,
  renew: async (projectId, payload) => (await httpClient.post(`${base(projectId)}/renew`, form(payload), { timeout: 60000 })).data,
};
