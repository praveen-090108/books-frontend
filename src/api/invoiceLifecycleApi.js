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
  getEInvoice: async (invoiceId) => {
    const { data } = await httpClient.get(`/invoices/${invoiceId}/e-invoice`);
    return data;
  },
  generateIrn: async (invoiceId) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/e-invoice/generate`);
    return data;
  },
  cancelIrn: async ({ invoiceId, reasonCode, remarks = '' }) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/e-invoice/cancel`, { reasonCode, remarks });
    return data;
  },
  refreshIrn: async (invoiceId) => {
    const { data } = await httpClient.post(`/invoices/${invoiceId}/e-invoice/refresh`);
    return data;
  },
  getCreditNoteEInvoice: async (creditNoteId) => {
    const { data } = await httpClient.get(`/credit-notes/${creditNoteId}/e-invoice`);
    return data;
  },
  generateCreditNoteIrn: async (creditNoteId) => {
    const { data } = await httpClient.post(`/credit-notes/${creditNoteId}/e-invoice/generate`);
    return data;
  },
  cancelCreditNoteIrn: async ({ creditNoteId, reasonCode, remarks = '' }) => {
    const { data } = await httpClient.post(`/credit-notes/${creditNoteId}/e-invoice/cancel`, { reasonCode, remarks });
    return data;
  },
  refreshCreditNoteIrn: async (creditNoteId) => {
    const { data } = await httpClient.post(`/credit-notes/${creditNoteId}/e-invoice/refresh`);
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
