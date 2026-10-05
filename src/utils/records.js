import { formatCurrency } from './formatCurrency.js';

export function formatDate(value) {
  if (!value) return '-';
  const normalized = String(value).includes('T') ? String(value) : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function recordToSalesRow(record, type) {
  const amount = formatCurrency(Number(record.amount || 0));
  const balance = formatCurrency(Number(record.balanceAmount || 0));
  const baseMeta = [initials(record.partyName), record.partyCity || '-', record.id];

  if (type === 'customers') {
    return [record.partyName, record.recordNumber, record.partyEmail || '-', record.partyPhone || '-', balance, record.status, record.category || '-', ...baseMeta];
  }
  if (type === 'quotes') {
    return [record.recordNumber, record.partyName, formatDate(record.dueDate), amount, record.status, record.ownerName || '-', formatDate(record.recordDate), ...baseMeta];
  }
  if (type === 'orders') {
    return [record.recordNumber, record.partyName, formatDate(record.recordDate), formatDate(record.dueDate), amount, record.status, record.secondaryStatus || '-', record.ownerName || '-', ...baseMeta];
  }
  if (type === 'invoices') {
    return [record.recordNumber, record.partyName, formatDate(record.recordDate), formatDate(record.dueDate), amount, record.status, record.category || '-', balance, ...baseMeta];
  }
  if (type === 'creditNotes') {
    return [record.recordNumber, record.partyName, formatDate(record.recordDate), record.referenceNumber || '-', amount, record.status, balance, formatDate(record.dueDate), ...baseMeta];
  }
  if (type === 'payments') {
    return [record.recordNumber, record.partyName, record.referenceNumber || '-', formatDate(record.recordDate), record.paymentMode || '-', amount, balance, record.status, ...baseMeta];
  }
  return [record.recordNumber, record.referenceNumber || '-', record.partyName, formatDate(record.recordDate), formatDate(record.dueDate), amount, record.status, record.secondaryStatus || '-', record.ownerName || '-', ...baseMeta];
}

export function recordToPurchaseRow(record, type) {
  const amount = formatCurrency(Number(record.amount || 0));
  const balance = formatCurrency(Number(record.balanceAmount || 0));
  const baseMeta = [initials(record.partyName), record.partyCity || '-', record.id];

  if (type === 'vendors') {
    return [record.partyName, record.partyPhone || '-', record.partyEmail || '-', record.category || '-', 'Net 30', balance, record.status, ...baseMeta];
  }
  if (type === 'items') {
    return [record.partyName, record.referenceNumber || '-', record.category || '-', 'Pcs', amount, String(Math.round(Number(record.balanceAmount || 0))), record.status, formatDate(record.recordDate), record.category || '-', '', record.id];
  }
  if (type === 'expenses') {
    return [formatDate(record.recordDate), record.notes || record.partyName, record.category || '-', record.partyName, record.paymentMode || '-', amount, record.status, record.referenceNumber ? 'File' : '-', record.id];
  }
  if (type === 'orders') {
    return [record.recordNumber, record.partyName, formatDate(record.recordDate), formatDate(record.dueDate), amount, record.status, record.secondaryStatus || '-', record.ownerName || '-', ...baseMeta];
  }
  return [record.recordNumber, record.partyName, formatDate(record.recordDate), formatDate(record.dueDate), amount, record.status, 'Net 30', ...baseMeta];
}

export function makeRecordPayload({ module, type, titlePrefix = '' }) {
  const now = Date.now().toString().slice(-6);
  const partyName = module === 'sales' ? 'New Customer' : 'New Vendor';
  return {
    recordNumber: `${prefixFor(module, type)}-${now}`,
    partyName,
    partyEmail: module === 'sales' ? 'customer@example.com' : 'vendor@example.com',
    partyPhone: '+91 90000 00000',
    partyCity: 'Chennai, India',
    category: type === 'expenses' ? 'Office Supplies' : 'General',
    status: defaultStatus(type),
    secondaryStatus: defaultSecondaryStatus(type),
    amount: 0,
    balanceAmount: 0,
    recordDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    referenceNumber: '',
    paymentMode: type === 'payments' || type === 'expenses' ? 'Bank Transfer' : '',
    ownerName: 'Praveen Admin',
    notes: `${titlePrefix || 'Created'} from IntelliaTech Books UI`,
  };
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IT';
}

function prefixFor(module, type) {
  const prefixes = {
    customers: 'CUS',
    quotes: 'QUO',
    orders: module === 'sales' ? 'SO' : 'PO',
    invoices: 'INV',
    creditNotes: 'CN',
    payments: 'PAY',
    challans: 'DC',
    bills: 'BILL',
    expenses: 'EXP',
    vendors: 'VEN',
    items: 'ITEM',
  };
  return prefixes[type] || 'REC';
}

function defaultStatus(type) {
  if (type === 'customers' || type === 'vendors') return 'Active';
  if (type === 'payments') return 'Deposited';
  if (type === 'items') return 'In Stock';
  if (type === 'expenses') return 'Paid';
  if (type === 'bills') return 'Due';
  if (type === 'quotes') return 'Open';
  return 'Draft';
}

function defaultSecondaryStatus(type) {
  if (type === 'orders') return 'Pending';
  if (type === 'invoices') return 'Unpaid';
  if (type === 'challans') return 'Pending';
  return '';
}
