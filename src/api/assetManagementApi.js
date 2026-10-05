import { httpClient } from './httpClient.js';

const data = (request) => request.then((response) => response.data);

export const assetManagementApi = {
  dashboard: (params) => data(httpClient.get('/asset-management/dashboard', { params })),

  categoryOptions: () => data(httpClient.get('/asset-management/categories/options')),
  categories: (params) => data(httpClient.get('/asset-management/categories', { params })),
  category: (id) => data(httpClient.get(`/asset-management/categories/${id}`)),
  createCategory: (payload) => data(httpClient.post('/asset-management/categories', payload)),
  updateCategory: (id, payload) => data(httpClient.put(`/asset-management/categories/${id}`, payload)),
  deleteCategory: (id) => data(httpClient.delete(`/asset-management/categories/${id}`)),

  assets: (params) => data(httpClient.get('/asset-management/assets', { params })),
  eligibleAssets: () => data(httpClient.get('/asset-management/assets/eligible-for-assignment')),
  asset: (id) => data(httpClient.get(`/asset-management/assets/${id}`)),
  createAsset: (payload) => data(httpClient.post('/asset-management/assets', payload)),
  updateAsset: (id, payload) => data(httpClient.put(`/asset-management/assets/${id}`, payload)),
  deleteAsset: (id) => data(httpClient.delete(`/asset-management/assets/${id}`)),
  assetImages: (assetId) => data(httpClient.get(`/asset-management/assets/${assetId}/images`)),
  uploadAssetImage: (assetId, file) => {
    const body = new FormData();
    body.append('file', file);
    return data(httpClient.post(`/asset-management/assets/${assetId}/images`, body, { timeout: 60000 }));
  },
  deleteAssetImage: (assetId, imageId) => data(httpClient.delete(`/asset-management/assets/${assetId}/images/${imageId}`)),
  assetImageContent: (assetId, imageId) => data(httpClient.get(`/asset-management/assets/${assetId}/images/${imageId}/content`, { responseType: 'blob', timeout: 60000 })),

  assignments: (params) => data(httpClient.get('/asset-management/assignments', { params })),
  createAssignment: (payload) => data(httpClient.post('/asset-management/assignments', payload)),
  returnAssignment: (id, params) => data(httpClient.post(`/asset-management/assignments/${id}/return`, null, { params })),

  maintenanceList: (params) => data(httpClient.get('/asset-management/maintenance', { params })),
  maintenance: (id) => data(httpClient.get(`/asset-management/maintenance/${id}`)),
  createMaintenance: (payload) => data(httpClient.post('/asset-management/maintenance', payload)),
  updateMaintenance: (id, payload) => data(httpClient.put(`/asset-management/maintenance/${id}`, payload)),
  updateMaintenanceStatus: (id, payload) => data(httpClient.post(`/asset-management/maintenance/${id}/status`, payload)),
  deleteMaintenance: (id) => data(httpClient.delete(`/asset-management/maintenance/${id}`)),

  depreciationList: (params) => data(httpClient.get('/asset-management/depreciation', { params })),
  depreciation: (id) => data(httpClient.get(`/asset-management/depreciation/${id}`)),
  createDepreciation: (payload) => data(httpClient.post('/asset-management/depreciation', payload)),
  updateDepreciation: (id, payload) => data(httpClient.put(`/asset-management/depreciation/${id}`, payload)),
  runDepreciation: (id, throughDate) => data(httpClient.post(`/asset-management/depreciation/${id}/run`, null, { params: { throughDate } })),

  disposalList: (params) => data(httpClient.get('/asset-management/disposals', { params })),
  disposal: (id) => data(httpClient.get(`/asset-management/disposals/${id}`)),
  createDisposal: (payload) => data(httpClient.post('/asset-management/disposals', payload)),
  updateDisposal: (id, payload) => data(httpClient.put(`/asset-management/disposals/${id}`, payload)),
  updateDisposalStatus: (id, payload) => data(httpClient.post(`/asset-management/disposals/${id}/status`, payload)),
  deleteDisposal: (id) => data(httpClient.delete(`/asset-management/disposals/${id}`)),
};
