import { httpClient } from './httpClient.js';

export const invoiceLifecycleApi = {
  list: async (ids = []) => {
    if (!ids.length) return {};
    const { data } = await httpClient.get('/invoices/lifecycle', {
      params: { ids },
      paramsSerializer: { indexes: null },
    });
    return data;
  },
  get: async (invoiceId) => {
    const { data } = await httpClient.get(`/invoices/${invoiceId}/lifecycle`);
    return data;
  },
  eligibleForCreditNote: async ({ customerId, creditNoteId }) => {
    const { data } = await httpClient.get('/invoices/eligible-for-credit-note', {
      params: {
        customerId,
        ...(creditNoteId ? { creditNoteId } : {}),
      },
    });
    return data;
  },
  markSent: async ({ invoiceId, recipient = '' }) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/mark-sent`, null, { params: { recipient } });
    return data;
  },
  markViewed: async (invoiceId) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/viewed`);
    return data;
  },
  communicate: async ({ invoiceId, payload }) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/communications`, payload);
    return data;
  },
  recordPayment: async ({ invoiceId, payload }) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/payments`, payload);
    return data;
  },
  updatePayment: async ({ invoiceId, paymentId, payload }) => {
    const { data } = await httpClient.put(`/invoices/${invoiceId}/payments/${paymentId}`, payload);
    return data;
  },
  reversePayment: async ({ invoiceId, paymentId, reason = '' }) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/payments/${paymentId}/reverse`, { reason });
    return data;
  },
  deletePayment: async ({ invoiceId, paymentId }) => {
    const { data } = await httpClient.delete(`/invoices/${invoiceId}/payments/${paymentId}`);
    return data;
  },
  reminder: async ({ invoiceId, payload }) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/reminders`, payload);
    return data;
  },
  voidInvoice: async ({ invoiceId, reason = '' }) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/void`, { reason });
    return data;
  },
  applyCreditNote: async ({ invoiceId, creditNoteId, amount }) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/credit-notes/${creditNoteId}`, { amount });
    return data;
  },
  removeCreditNote: async ({ invoiceId, creditNoteId }) => {
    const { data } = await httpClient.delete(`/invoices/${invoiceId}/credit-notes/${creditNoteId}`);
    return data;
  },
};
