import { httpClient } from './httpClient.js';

export const storageApi = {
  uploadBrandingLogo: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await httpClient.post('/uploads/branding/logo', formData);
    return data;
  },
  uploadPaymentAttachment: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await httpClient.post('/uploads/payments/attachment', formData);
    return data;
  },
  uploadPurchaseOrderAttachment: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await httpClient.post('/uploads/purchase-orders/attachment', formData);
    return data;
  },
  uploadBillAttachment: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await httpClient.post('/uploads/bills/attachment', formData);
    return data;
  },
  uploadLeadProfile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await httpClient.post('/uploads/leads/profile', formData);
    return data;
  },
  uploadCustomerAttachment: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await httpClient.post('/uploads/customers/attachment', formData);
    return data;
  },
};
