import { httpClient } from './httpClient.js';

const defaultsByType = {
  customers: {
    documentType: 'customers',
    autoGenerate: true,
    prefix: 'CUST',
    suffix: '',
    separator: '-',
    numberFormat: '0000',
    startingNumber: 1,
    nextNumber: 1,
  },
  quotes: {
    documentType: 'quotes',
    autoGenerate: true,
    prefix: 'QUO',
    suffix: '',
    separator: '-',
    numberFormat: '000000',
    startingNumber: 126,
    nextNumber: 126,
  },
  invoices: {
    documentType: 'invoices',
    autoGenerate: true,
    prefix: 'INT-2026',
    suffix: '',
    separator: '-',
    numberFormat: '000',
    startingNumber: 88,
    nextNumber: 88,
  },
  orders: {
    documentType: 'orders',
    autoGenerate: true,
    prefix: 'SO',
    suffix: '',
    separator: '-',
    numberFormat: '000000',
    startingNumber: 153,
    nextNumber: 153,
  },
  creditNotes: {
    documentType: 'creditNotes',
    autoGenerate: true,
    prefix: 'CN',
    suffix: '',
    separator: '-',
    numberFormat: '000',
    startingNumber: 33,
    nextNumber: 33,
  },
};

function normalizePreference(documentType, preference) {
  const defaults = defaultsByType[documentType] || defaultsByType.invoices;
  const next = {
    ...defaults,
    ...preference,
    documentType,
    startingNumber: Number(preference?.startingNumber ?? defaults.startingNumber),
    nextNumber: Number(preference?.nextNumber ?? defaults.nextNumber),
  };
  return {
    ...next,
    previewNumber: generateDocumentNumber(next),
  };
}

export function generateDocumentNumber(preference) {
  if (!preference) return '';
  const next = String(Number(preference.nextNumber || 1));
  const formatTokens = String(preference.numberFormat || '000').match(/[0#]/g)?.length || 1;
  const width = Math.max(formatTokens, next.length);
  const numeric = next.padStart(width, '0');
  const prefix = String(preference.prefix || '').trim();
  const suffix = String(preference.suffix || '').trim();
  const separator = String(preference.separator || '').trim();
  const before = prefix && separator && !prefix.endsWith(separator) ? `${prefix}${separator}` : prefix;
  const after = suffix && separator && !suffix.startsWith(separator) ? `${separator}${suffix}` : suffix;
  return `${before}${numeric}${after}`;
}

export const documentNumberApi = {
  get: async (documentType) => {
    const { data } = await httpClient.get(`/document-number-preferences/${documentType}`);
    return normalizePreference(documentType, data);
  },
  save: async (documentType, payload) => {
    const { data } = await httpClient.put(`/document-number-preferences/${documentType}`, payload);
    return normalizePreference(documentType, data);
  },
  consume: async (documentType) => {
    const { data } = await httpClient.post(`/document-number-preferences/${documentType}/consume`);
    return normalizePreference(documentType, data);
  },
};
