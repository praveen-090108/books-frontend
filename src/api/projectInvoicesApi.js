import { httpClient } from './httpClient.js';

export const projectInvoicesApi = {
  lookup: async ({ projectType, customer = '' }) => (await httpClient.get('/project-invoices/lookup', { params: { projectType, customer } })).data,
  list: async (projectType, projectId) => (await httpClient.get(`/project-invoices/projects/${projectType}/${projectId}`)).data,
};
