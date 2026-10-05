import { httpClient } from './httpClient.js';

const base = (projectType, projectId) => `/projects/${projectType}/${projectId}/documents`;

export const projectDocumentsApi = {
  list: async (projectType, projectId) => (await httpClient.get(base(projectType, projectId))).data,
  upload: async (projectType, projectId, file) => {
    const body = new FormData();
    body.append('file', file);
    return (await httpClient.post(base(projectType, projectId), body, { timeout: 60000 })).data;
  },
  remove: async (projectType, projectId, documentId) => {
    await httpClient.delete(`${base(projectType, projectId)}/${documentId}`);
  },
  download: async (projectType, projectId, document) => {
    const response = await httpClient.get(`${base(projectType, projectId)}/${document.id}/download`, { responseType: 'blob', timeout: 60000 });
    const url = URL.createObjectURL(response.data);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.originalFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  preview: async (projectType, projectId, document) => {
    const response = await httpClient.get(`${base(projectType, projectId)}/${document.id}/download`, { params: { inline: true }, responseType: 'blob', timeout: 60000 });
    const url = URL.createObjectURL(response.data);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};
