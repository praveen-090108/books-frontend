import { httpClient } from './httpClient.js';

const params = (values = {}) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value != null));

export const leadApi = {
  options: () => httpClient.get('/lead-options').then((r) => r.data),
  dashboard: (filters) => httpClient.get('/lead-dashboard', { params: params(filters) }).then((r) => r.data),
  report: (reportType, filters) => httpClient.get(`/lead-reports/${reportType}`, { params: params(filters) }).then((r) => r.data),
  reportExportUrl: (reportType, filters = {}) => `/api/lead-reports/${reportType}/export?${new URLSearchParams(params(filters)).toString()}`,
  list: (filters) => httpClient.get('/leads', { params: params(filters) }).then((r) => r.data),
  get: (id) => httpClient.get(`/leads/${id}`).then((r) => r.data),
  timeline: (id, filters) => httpClient.get(`/leads/${id}/timeline`, { params: params(filters) }).then((r) => r.data),
  activities: (id, type) => httpClient.get(`/leads/${id}/activities`, { params: params({ type }) }).then((r) => r.data),
  tasks: (id) => httpClient.get(`/leads/${id}/tasks`).then((r) => r.data),
  events: (id) => httpClient.get(`/leads/${id}/events`).then((r) => r.data),
  calls: (id) => httpClient.get(`/leads/${id}/calls`).then((r) => r.data),
  stageHistory: (id) => httpClient.get(`/leads/${id}/stage-history`).then((r) => r.data),
  save: (id, body, draft = false) => httpClient[id ? 'put' : 'post'](id ? `/leads/${id}` : '/leads', body, { params: { draft } }).then((r) => r.data),
  remove: (id) => httpClient.delete(`/leads/${id}`),
  stage: (id, body) => httpClient.post(`/leads/${id}/change-stage`, body).then((r) => r.data),
  owner: (id, ownerId) => httpClient.post(`/leads/${id}/change-owner`, { ownerId }).then((r) => r.data),
  convert: (id, body) => httpClient.post(`/leads/${id}/convert`, body).then((r) => r.data),
  eligibleAssignees: () => httpClient.get('/leads/eligible-assignees').then((r) => r.data),
  profileVendors: () => httpClient.get('/leads/profile-vendors').then((r) => r.data),
  assign: (id, body) => httpClient.post(`/leads/${id}/assign`, body).then((r) => r.data),
  notifications: () => httpClient.get('/lead-notifications').then((r) => r.data),
  readNotification: (id) => httpClient.post(`/lead-notifications/${id}/read`).then((r) => r.data),
};

const crud = (path) => ({
  list: (filters) => httpClient.get(path, { params: params(filters) }).then((r) => r.data),
  get: (id) => httpClient.get(`${path}/${id}`).then((r) => r.data),
  save: (id, body) => httpClient[id ? 'put' : 'post'](id ? `${path}/${id}` : path, body).then((r) => r.data),
  remove: (id) => httpClient.delete(`${path}/${id}`),
});

export const pipelineApi = {
  ...crud('/pipelines'),
  kanban: (id) => httpClient.get(`/pipelines/${id}/kanban`).then((r) => r.data),
  clone: (id) => httpClient.post(`/pipelines/${id}/clone`).then((r) => r.data),
};
export const companyApi = crud('/companies');
export const contactApi = crud('/contacts');
export const supportApi = {
  add: (type, body) => httpClient.post(`/${type}`, body).then((r) => r.data),
  update: (type, id, body) => httpClient.put(`/${type}/${id}`, body).then((r) => r.data),
  remove: (type, id) => httpClient.delete(`/${type}/${id}`),
};
export const exportUrl = (entity) => `/api/lead-export/${entity}`;
