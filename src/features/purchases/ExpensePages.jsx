import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CalendarDays, ChevronDown, CircleDollarSign,
  Edit3, Eye, FileText, Filter, IndianRupee, MoreVertical, Paperclip, Plus,
  Printer, ReceiptText, Search, Trash2, Upload, UserRound, WalletCards, X,
} from 'lucide-react';
import { expensesApi } from '../../api/expensesApi.js';
import { expenseAccountsApi } from '../../api/expenseAccountsApi.js';
import { vendorsApi } from '../../api/vendorsApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { BankAccountSelect } from '../../components/BankAccountSelect.jsx';

const TODAY = new Date().toISOString().slice(0, 10);
const EMPTY_FORM = {
  expenseDate: TODAY, expenseAccount: '', expenseTitle: '', expenseType: 'SERVICES', vendorId: '',
  invoiceNumber: '', hsnCode: '', sacCode: '', gstTreatment: 'UNREGISTERED_BUSINESS',
  sourceOfSupplyCode: '', destinationOfSupplyCode: '', taxId: '', amountType: 'TAX_EXCLUSIVE',
  amount: '', tdsDeducted: '', currency: 'INR - Indian Rupee', referenceNumber: '', description: '', notes: '',
  paymentMode: '', paidThrough: '', bankAccountId: '', projectName: '', status: 'PAID', attachmentName: '', attachmentUrl: '',
};

const STATUS_STYLES = {
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
};

function money(value, currency = 'INR') {
  const code = String(currency || 'INR').trim().slice(0, 3).toUpperCase();
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `${code} ${Number(value || 0).toFixed(2)}`; }
}

function displayDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value));
}

function apiError(error, fallback) {
  const fields = error?.response?.data?.validationErrors;
  if (fields && Object.keys(fields).length) return Object.values(fields)[0];
  return error?.response?.data?.message || fallback;
}

function labelize(value) {
  return String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div><h1 className="text-2xl font-black text-[#06134a]">{title}</h1><p className="mt-1 text-sm font-semibold text-slate-600">{subtitle}</p></div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Button({ icon: Icon, children, primary = false, danger = false, onClick, disabled, type = 'button', className = '' }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${primary ? 'border-red-600 bg-red-600 text-white hover:bg-red-700' : danger ? 'border-red-200 bg-white text-red-600 hover:bg-red-50' : 'border-slate-200 bg-white text-[#06134a] hover:bg-slate-50'} ${className}`}>
      {Icon && <Icon className="h-4 w-4" />}{children}
    </button>
  );
}

function StatusBadge({ value }) {
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black ring-1 ring-inset ${STATUS_STYLES[value] || STATUS_STYLES.DRAFT}`}>{labelize(value || 'DRAFT')}</span>;
}

function Loading({ text = 'Loading...' }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm font-black text-[#06134a]"><span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-4 border-red-100 border-t-red-600" />{text}</div>;
}

function ErrorBox({ text }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{text}</div>;
}

function SuccessBox({ text, onClose }) {
  return <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><span>{text}</span>{onClose && <button onClick={onClose}><X className="h-4 w-4" /></button>}</div>;
}

function StatCard({ title, value, helper, icon: Icon, tone = 'red' }) {
  const tones = { red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600', green: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600' };
  return <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold text-slate-600">{title}</p><p className="mt-1 truncate text-xl font-black text-[#06134a]">{value}</p><p className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</p></div></div></article>;
}

function Field({ label, required, error, hint, children }) {
  return <div className="block min-w-0"><span className="mb-1.5 block text-xs font-black text-[#06134a]">{label}{required && <b className="ml-1 text-red-600">*</b>}</span>{children}{hint && <small className="mt-1 block font-semibold text-slate-500">{hint}</small>}{error && <small className="mt-1 block font-bold text-red-600">{error}</small>}</div>;
}

function printExpense() {
  document.body.classList.add('expense-print');
  const cleanup = () => document.body.classList.remove('expense-print');
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1000);
}

function TextInput({ label, value, onChange, required, error, hint, type = 'text', placeholder, disabled, min, step }) {
  return <Field label={label} required={required} error={error} hint={hint}><input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} min={min} step={step} className={`h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-4 ${error ? 'border-red-400 focus:ring-red-50' : 'border-slate-200 focus:border-blue-300 focus:ring-blue-50'} disabled:bg-slate-50`} /></Field>;
}

function SelectInput({ label, value, onChange, options, required, error, placeholder, disabled }) {
  return <Field label={label} required={required} error={error}><select value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={`h-10 w-full rounded-lg border bg-white px-3 text-sm font-semibold outline-none disabled:bg-slate-50 ${error ? 'border-red-400' : 'border-slate-200'}`}><option value="">{placeholder || `Select ${label.toLowerCase()}`}</option>{options.map((option) => { const item = typeof option === 'string' ? { value: option, label: option } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select></Field>;
}

function SearchSelect({ label, value, onChange, options, required, error, placeholder, disabled }) {
  const selected = options.find((option) => String(option.value) === String(value));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  useEffect(() => { if (!open) setQuery(selected?.label || ''); }, [open, selected?.label]);
  return <Field label={label} required={required} error={error}><div className="relative"><div className="relative"><input value={open ? query : (selected?.label || '')} onFocus={() => { setQuery(selected?.label || ''); setOpen(true); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onBlur={() => window.setTimeout(() => setOpen(false), 150)} placeholder={placeholder} disabled={disabled} className={`h-10 w-full rounded-lg border bg-white px-3 pr-9 text-sm font-semibold outline-none disabled:bg-slate-50 ${error ? 'border-red-400' : 'border-slate-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-50'}`} /><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div>{open && !disabled && <div className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">{filtered.map((option) => <button key={option.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.value); setQuery(option.label); setOpen(false); }} className={`block w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 ${String(option.value) === String(value) ? 'bg-red-50 text-red-700' : 'text-[#06134a]'}`}>{option.label}</button>)}{!filtered.length && <p className="px-3 py-4 text-center text-xs font-bold text-slate-500">No matching options</p>}</div>}</div></Field>;
}

function RadioGroup({ label, value, onChange, options, required, error, unframed = false }) {
  return <Field label={label} required={required} error={error}><div className={`flex min-h-10 flex-wrap items-center gap-5 ${unframed ? '' : 'rounded-lg border border-slate-200 px-3'}`}>{options.map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#06134a]"><input type="radio" name={label} checked={value === option.value} onChange={() => onChange(option.value)} className="h-4 w-4 accent-red-600" />{option.label}</label>)}</div></Field>;
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return <Field label={label}><textarea value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></Field>;
}

function FormSection({ title, icon: Icon, children }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[#06134a]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600"><Icon className="h-4 w-4" /></span>{title}</h2>{children}</article>;
}

function calculatePreview(form, taxes) {
  const amount = Math.max(Number(form.amount || 0), 0);
  const tax = taxes.find((option) => String(option.id) === String(form.taxId));
  const category = tax?.category || 'NON_TAXABLE';
  const rate = form.gstTreatment === 'OVERSEAS' || category !== 'TAXABLE' || !form.sourceOfSupplyCode ? 0 : Number(tax?.rate || 0);
  const taxable = form.amountType === 'TAX_INCLUSIVE' && rate > 0 ? amount / (1 + rate / 100) : amount;
  const totalTax = form.amountType === 'TAX_INCLUSIVE' ? amount - taxable : taxable * rate / 100;
  const intraState = form.sourceOfSupplyCode && form.sourceOfSupplyCode === form.destinationOfSupplyCode;
  return {
    enteredAmount: amount, taxableAmount: taxable, taxRate: rate,
    cgstAmount: intraState ? totalTax / 2 : 0, sgstAmount: intraState ? totalTax / 2 : 0,
    igstAmount: intraState ? 0 : totalTax, totalTaxAmount: totalTax,
    totalAmount: form.amountType === 'TAX_INCLUSIVE' ? amount : amount + totalTax,
  };
}

function vendorGstTreatment(vendor) {
  const raw = String(vendor?.taxTreatment || '').toUpperCase().replaceAll(' ', '_').replaceAll('-', '_');
  const supported = ['REGISTERED_BUSINESS_REGULAR', 'REGISTERED_BUSINESS_COMPOSITION', 'UNREGISTERED_BUSINESS', 'CONSUMER', 'OVERSEAS', 'SPECIAL_ECONOMIC_ZONE', 'DEEMED_EXPORT', 'TAX_DEDUCTOR', 'TAX_COLLECTOR'];
  if (supported.includes(raw)) return raw;
  if (String(vendor?.billingCountry || '').toLowerCase() !== 'india') return 'OVERSEAS';
  return vendor?.gstin ? 'REGISTERED_BUSINESS_REGULAR' : 'UNREGISTERED_BUSINESS';
}

function stateCodeForVendor(vendor, states) {
  const raw = `${vendor?.sourceOfSupply || ''} ${vendor?.billingState || ''}`;
  const code = raw.match(/\b(\d{2})\b/)?.[1];
  if (code && states.some((state) => state.code === code)) return code;
  const normalized = raw.toLowerCase();
  return states.find((state) => normalized.includes(state.name.toLowerCase()))?.code || (String(vendor?.billingCountry || '').toLowerCase() !== 'india' ? '97' : '');
}

function paymentModeRequiresBankAccount(value) {
  return Boolean(value) && !['cash', 'other'].includes(String(value).trim().toLowerCase());
}

function normalizeExpense(record) {
  return {
    ...EMPTY_FORM, ...record,
    vendorId: record.vendorId ? String(record.vendorId) : '',
    taxId: record.taxId ? String(record.taxId) : '',
    sourceOfSupplyCode: record.sourceOfSupplyCode || '',
    destinationOfSupplyCode: record.destinationOfSupplyCode || '',
    bankAccountId: record.bankAccountId ? String(record.bankAccountId) : '',
    amount: record.taxSummary?.enteredAmount ?? '',
    tdsDeducted: record.tdsDeducted ?? '',
  };
}

export function ExpenseFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadedId, setLoadedId] = useState(null);
  const [errors, setErrors] = useState({});
  const vendorsQuery = useQuery({ queryKey: ['expense-vendors'], queryFn: () => vendorsApi.list({ status: 'ACTIVE', page: 0, size: 500, sort: 'vendorName,asc' }) });
  const filtersQuery = useQuery({ queryKey: ['expense-filters', form.gstTreatment, form.sourceOfSupplyCode, form.destinationOfSupplyCode], queryFn: () => expensesApi.filters({ gstTreatment: form.gstTreatment, sourceOfSupply: form.sourceOfSupplyCode, destinationOfSupply: form.destinationOfSupplyCode }) });
  const accountsQuery = useQuery({ queryKey: ['expense-account-master', 'active'], queryFn: () => expenseAccountsApi.list(false) });
  const expenseQuery = useQuery({ queryKey: ['expense', id], queryFn: () => expensesApi.get(id), enabled: editing });
  const filters = filtersQuery.data || { gstTreatments: [], states: [], taxes: [], expenseAccounts: [], paymentModes: [] };
  const vendors = vendorsQuery.data?.content || [];
  const expenseAccounts = useMemo(() => {
    const rows = accountsQuery.data || [];
    if (editing && form.expenseAccount && !rows.some((account) => account.accountName === form.expenseAccount)) return [...rows, { id: null, accountName: form.expenseAccount }];
    return rows;
  }, [accountsQuery.data, editing, form.expenseAccount]);
  const selectedGstTreatment = (filters.gstTreatments || []).find((option) => option.value === form.gstTreatment);
  const sourceOfSupplyRequired = Boolean(selectedGstTreatment?.requiresSourceOfSupply);
  const bankAccountRequired = paymentModeRequiresBankAccount(form.paymentMode);

  useEffect(() => {
    if (editing && expenseQuery.data && loadedId !== expenseQuery.data.id) {
      setLoadedId(expenseQuery.data.id);
      setForm(normalizeExpense(expenseQuery.data));
    }
  }, [editing, expenseQuery.data, loadedId]);

  useEffect(() => {
    if (!editing && filters.organizationStateCode && !form.destinationOfSupplyCode) {
      setForm((current) => ({ ...current, destinationOfSupplyCode: filters.organizationStateCode }));
    }
  }, [editing, filters.organizationStateCode, form.destinationOfSupplyCode]);

  const update = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: '' })); };
  const selectVendor = (value) => {
    if (!value) {
      update('vendorId', '');
      return;
    }
    const vendor = vendors.find((item) => String(item.id) === String(value));
    const source = stateCodeForVendor(vendor, filters.states || []);
    setForm((current) => ({ ...current, vendorId: String(value), gstTreatment: vendorGstTreatment(vendor), sourceOfSupplyCode: source, currency: vendor?.currency || current.currency, taxId: '' }));
  };
  const preview = useMemo(() => calculatePreview(form, filters.taxes || []), [form, filters.taxes]);

  const validate = () => {
    const next = {};
    if (!form.expenseDate) next.expenseDate = 'Expense Date is required.';
    if (!form.expenseAccount) next.expenseAccount = 'Expense Account is required.';
    if (!form.expenseTitle.trim()) next.expenseTitle = 'Expense Title is required.';
    if (!form.expenseType) next.expenseType = 'Select Goods or Services.';
    if (!form.gstTreatment) next.gstTreatment = 'GST Treatment is required.';
    if (sourceOfSupplyRequired && !form.sourceOfSupplyCode) next.sourceOfSupplyCode = 'Source of Supply is required for the selected GST Treatment.';
    if (!form.destinationOfSupplyCode) next.destinationOfSupplyCode = 'Destination of Supply is required.';
    if (form.gstTreatment !== 'OVERSEAS' && !form.taxId) next.taxId = 'Tax is required.';
    if (!(Number(form.amount) > 0)) next.amount = 'Amount must be greater than zero.';
    if (form.tdsDeducted !== '' && Number(form.tdsDeducted) < 0) next.tdsDeducted = 'TDS Deducted cannot be negative.';
    if (bankAccountRequired && !form.bankAccountId) next.bankAccountId = 'Bank Account is required for the selected Payment Mode.';
    if (form.invoiceNumber && !/^[A-Za-z0-9/\- ]{1,100}$/.test(form.invoiceNumber.trim())) next.invoiceNumber = 'Use letters, numbers, slash, dash or spaces only.';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const mutation = useMutation({
    mutationFn: (payload) => editing ? expensesApi.update(id, payload) : expensesApi.create(payload),
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
      navigate(`/purchases/expenses/${expense.id}`, { replace: true, state: { message: editing ? 'Expense updated successfully.' : 'Expense created successfully.' } });
    },
  });
  const submit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      ...form, vendorId: form.vendorId ? Number(form.vendorId) : null, taxId: form.taxId ? Number(form.taxId) : null,
      bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : null,
      expenseAccountId: expenseAccounts.find((account) => account.accountName === form.expenseAccount)?.id || null,
      amount: Number(form.amount), tdsDeducted: form.tdsDeducted === '' ? null : Number(form.tdsDeducted), invoiceNumber: form.invoiceNumber.trim(),
      hsnCode: form.expenseType === 'GOODS' ? form.hsnCode.trim() : '',
      sacCode: form.expenseType === 'SERVICES' ? form.sacCode.trim() : '',
    });
  };

  if (editing && expenseQuery.isPending) return <Loading text="Loading expense..." />;
  if (editing && expenseQuery.isError) return <ErrorBox text={apiError(expenseQuery.error, 'Unable to load expense.')} />;
  return (
    <form onSubmit={submit} className="space-y-5">
      <PageHeader title={editing ? 'Edit Expense' : 'Create Expense'} subtitle="Record vendor expenses with validated supply, GST, and payment details.">
        <Button onClick={() => navigate('/purchases/expenses')}>Cancel</Button><Button type="submit" primary icon={FileText} disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save Expense'}</Button>
      </PageHeader>
      {filtersQuery.isError && <ErrorBox text={apiError(filtersQuery.error, 'Unable to load tax masters.')} />}
      {vendorsQuery.isError && <ErrorBox text={apiError(vendorsQuery.error, 'Unable to load active vendors.')} />}
      {mutation.isError && <ErrorBox text={apiError(mutation.error, 'Unable to save expense.')} />}
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <FormSection title="Basic Information" icon={ReceiptText}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextInput label="Expense Date" type="date" value={form.expenseDate} onChange={(value) => update('expenseDate', value)} required error={errors.expenseDate} />
              <TextInput label="Expense Title" value={form.expenseTitle} onChange={(value) => update('expenseTitle', value)} placeholder="Enter expense title" required error={errors.expenseTitle} />
              <SelectInput label="Expense Account" value={form.expenseAccount} onChange={(value) => update('expenseAccount', value)} options={expenseAccounts.map((account) => account.accountName)} required error={errors.expenseAccount} />
              <SearchSelect label="Vendor" value={form.vendorId} onChange={selectVendor} options={vendors.map((vendor) => ({ value: String(vendor.id), label: `${vendor.vendorName}${vendor.vendorNumber ? ` (${vendor.vendorNumber})` : ''}` }))} placeholder="Optional — search active vendors" error={errors.vendorId} />
              <TextInput label="Invoice#" value={form.invoiceNumber} onChange={(value) => update('invoiceNumber', value)} placeholder="Vendor invoice number" error={errors.invoiceNumber} />
              <TextInput label="Reference Number" value={form.referenceNumber} onChange={(value) => update('referenceNumber', value)} placeholder="Reference or bill number" />
              <RadioGroup label="Expense Type" unframed value={form.expenseType} onChange={(value) => setForm((current) => ({ ...current, expenseType: value, hsnCode: value === 'GOODS' ? current.hsnCode : '', sacCode: value === 'SERVICES' ? current.sacCode : '' }))} options={[{ value: 'GOODS', label: 'Goods' }, { value: 'SERVICES', label: 'Services' }]} required error={errors.expenseType} />
              {form.expenseType === 'GOODS' && <TextInput label="HSN & SAC Code" value={form.hsnCode} onChange={(value) => update('hsnCode', value)} placeholder="Optional HSN code" error={errors.hsnCode} />}
              {form.expenseType === 'SERVICES' && <TextInput label="HSN & SAC Code" value={form.sacCode} onChange={(value) => update('sacCode', value)} placeholder="Optional SAC code" error={errors.sacCode} />}
            </div>
            <div className="mt-4"><TextArea label="Description" value={form.description} onChange={(value) => update('description', value)} placeholder="Describe this expense" /></div>
          </FormSection>
          <FormSection title="GST and Supply Details" icon={IndianRupee}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectInput label="GST Treatment" value={form.gstTreatment} onChange={(value) => { setForm((current) => ({ ...current, gstTreatment: value, taxId: '' })); setErrors((current) => ({ ...current, gstTreatment: '', sourceOfSupplyCode: '' })); }} options={filters.gstTreatments || []} required error={errors.gstTreatment} />
              <SearchSelect label="Source of Supply" value={form.sourceOfSupplyCode} onChange={(value) => update('sourceOfSupplyCode', value)} options={(filters.states || []).map((state) => ({ value: state.code, label: state.label }))} placeholder={sourceOfSupplyRequired ? 'Search state' : 'Optional — search state'} required={sourceOfSupplyRequired} error={errors.sourceOfSupplyCode} />
              <SearchSelect label="Destination of Supply" value={form.destinationOfSupplyCode} onChange={(value) => update('destinationOfSupplyCode', value)} options={(filters.states || []).map((state) => ({ value: state.code, label: state.label }))} placeholder="Search state" required error={errors.destinationOfSupplyCode} />
              <SearchSelect label="Tax" value={form.taxId} onChange={(value) => update('taxId', value)} options={(filters.taxes || []).map((tax) => ({ value: String(tax.id), label: tax.displayName }))} placeholder="Search tax rates" required={form.gstTreatment !== 'OVERSEAS'} error={errors.taxId} />
              <RadioGroup label="Amount Is" value={form.amountType} onChange={(value) => update('amountType', value)} options={[{ value: 'TAX_EXCLUSIVE', label: 'Tax Exclusive' }, { value: 'TAX_INCLUSIVE', label: 'Tax Inclusive' }]} required />
              <TextInput label="Amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(value) => update('amount', value)} required error={errors.amount} placeholder="0.00" />
            </div>
          </FormSection>
          <FormSection title="Payment and Additional Details" icon={WalletCards}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectInput label="Payment Mode" value={form.paymentMode} onChange={(value) => update('paymentMode', value)} options={filters.paymentModes || []} />
              <BankAccountSelect label="Bank Account" value={form.bankAccountId} onChange={(value) => update('bankAccountId', value)} currency={String(form.currency || '').slice(0, 3)} required={bankAccountRequired} error={errors.bankAccountId} includeInactive={editing} />
              <TextInput label="TDS Deducted" type="number" min="0" step="0.01" value={form.tdsDeducted} onChange={(value) => update('tdsDeducted', value)} placeholder="0.00" hint="Optional" error={errors.tdsDeducted} />
              <TextInput label="Project / Customer" value={form.projectName} onChange={(value) => update('projectName', value)} placeholder="Optional association" />
              <SelectInput label="Currency" value={form.currency} onChange={(value) => update('currency', value)} options={['INR - Indian Rupee', 'USD - US Dollar', 'EUR - Euro', 'GBP - British Pound']} required />
              <SelectInput label="Status" value={form.status} onChange={(value) => update('status', value)} options={[{ value: 'PAID', label: 'Paid' }, { value: 'PENDING', label: 'Pending' }, { value: 'DRAFT', label: 'Draft' }]} required />
              <Field label="Attach Receipt"><label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm font-bold text-[#06134a]"><Upload className="h-4 w-4 text-red-600" /><span className="truncate">{form.attachmentName || 'Choose supporting file'}</span><input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => update('attachmentName', event.target.files?.[0]?.name || '')} /></label></Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><TextArea label="Notes" value={form.notes} onChange={(value) => update('notes', value)} placeholder="Internal notes" /><TextArea label="Attachment URL" value={form.attachmentUrl} onChange={(value) => update('attachmentUrl', value)} placeholder="Existing uploaded receipt URL" /></div>
          </FormSection>
        </div>
        <aside className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm 2xl:sticky 2xl:top-20">
          <h2 className="flex items-center gap-2 text-base font-black text-[#06134a]"><CircleDollarSign className="h-5 w-5 text-red-600" /> Expense Summary</h2>
          <SummaryLine label="Entered Amount" value={money(preview.enteredAmount, form.currency)} />
          <SummaryLine label="Taxable Amount" value={money(preview.taxableAmount, form.currency)} />
          {preview.cgstAmount > 0 && <SummaryLine label={`CGST (${preview.taxRate / 2}%)`} value={money(preview.cgstAmount, form.currency)} />}
          {preview.sgstAmount > 0 && <SummaryLine label={`SGST (${preview.taxRate / 2}%)`} value={money(preview.sgstAmount, form.currency)} />}
          {preview.igstAmount > 0 && <SummaryLine label={`IGST (${preview.taxRate}%)`} value={money(preview.igstAmount, form.currency)} />}
          <SummaryLine label="Total Tax" value={money(preview.totalTaxAmount, form.currency)} />
          {Number(form.tdsDeducted || 0) > 0 && <SummaryLine label="TDS Deducted" value={`(-) ${money(form.tdsDeducted, form.currency)}`} />}
          <div className="border-t border-slate-200 pt-4"><SummaryLine label="Total Amount" value={money(preview.totalAmount, form.currency)} strong /></div>
          <p className="rounded-lg bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800">Totals are previewed instantly here and recalculated by the backend before saving.</p>
        </aside>
      </div>
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur"><Button onClick={() => navigate('/purchases/expenses')}>Cancel</Button><Button type="submit" primary icon={FileText} disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save Expense'}</Button></div>
    </form>
  );
}

function SummaryLine({ label, value, strong = false }) {
  return <div className={`flex items-center justify-between gap-3 py-1.5 ${strong ? 'text-lg font-black text-[#06134a]' : 'text-sm font-bold text-slate-600'}`}><span>{label}</span><span className="text-right text-[#06134a]">{value}</span></div>;
}

export function ExpenseListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', vendorId: '', expenseType: '', gstTreatment: '', sourceOfSupply: '', destinationOfSupply: '', taxId: '', amountType: '', expenseAccount: '', status: '', paymentMode: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '' });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [sort, setSort] = useState('expenseDate,desc');
  const [menuId, setMenuId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState(location.state?.message || '');
  const params = { ...filters, page, size, sort };
  const listQuery = useQuery({ queryKey: ['expenses', params], queryFn: () => expensesApi.list(params), placeholderData: (previous) => previous });
  const summaryQuery = useQuery({ queryKey: ['expense-summary'], queryFn: expensesApi.summary });
  const masterQuery = useQuery({ queryKey: ['expense-list-filters'], queryFn: () => expensesApi.filters({}) });
  const vendorsQuery = useQuery({ queryKey: ['expense-vendors'], queryFn: () => vendorsApi.list({ status: 'ACTIVE', page: 0, size: 500, sort: 'vendorName,asc' }) });
  const deleteMutation = useMutation({ mutationFn: (id) => expensesApi.remove(id), onSuccess: () => { setDeleteTarget(null); setMessage('Expense deleted successfully.'); queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['expense-summary'] }); } });
  const rows = listQuery.data?.content || [];
  const masters = masterQuery.data || { gstTreatments: [], states: [], taxes: [], expenseAccounts: [], paymentModes: [] };
  const vendors = vendorsQuery.data?.content || [];
  const summary = summaryQuery.data || {};
  const updateFilter = (field, value) => { setFilters((current) => ({ ...current, [field]: value })); setPage(0); };
  const clearFilters = () => { setFilters({ search: '', vendorId: '', expenseType: '', gstTreatment: '', sourceOfSupply: '', destinationOfSupply: '', taxId: '', amountType: '', expenseAccount: '', status: '', paymentMode: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '' }); setPage(0); };
  const hasFilters = Object.values(filters).some(Boolean);
  return (
    <section className="space-y-5">
      <PageHeader title="Expenses" subtitle="Manage vendor expenses, GST, supply details and payments from live data."><Link to="/purchases/expenses/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white"><Plus className="h-4 w-4" /> Add Expense</Link></PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Total Expenses" value={money(summary.totalExpenses)} helper="All completed records" icon={WalletCards} tone="red" /><StatCard title="This Month" value={money(summary.thisMonth)} helper={new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date())} icon={CalendarDays} tone="amber" /><StatCard title="This Year" value={money(summary.thisYear)} helper={String(new Date().getFullYear())} icon={CircleDollarSign} tone="green" /><StatCard title="Expense Records" value={summary.totalCount || 0} helper="Database records" icon={ReceiptText} tone="blue" /></div>
      {message && <SuccessBox text={message} onClose={() => setMessage('')} />}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="expense-filter-row">
          <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search number, vendor, invoice, reference or description" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-red-300" /></label>
          <select value={filters.vendorId} onChange={(event) => updateFilter('vendorId', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold"><option value="">All Vendors</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendorName}</option>)}</select>
          <select value={filters.expenseType} onChange={(event) => updateFilter('expenseType', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold"><option value="">All Types</option><option value="GOODS">Goods</option><option value="SERVICES">Services</option></select>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold"><option value="">All Status</option><option value="PAID">Paid</option><option value="PENDING">Pending</option><option value="DRAFT">Draft</option><option value="CANCELLED">Cancelled</option></select>
          <select value={filters.gstTreatment} onChange={(event) => updateFilter('gstTreatment', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold"><option value="">All GST Treatments</option>{(masters.gstTreatments || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <Button icon={Filter} onClick={clearFilters} disabled={!hasFilters}>Clear</Button>
        </div>
        <details><summary className="cursor-pointer text-xs font-black text-[#06134a]">More filters</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <select value={filters.sourceOfSupply} onChange={(event) => updateFilter('sourceOfSupply', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="">Source Supply</option>{(masters.states || []).map((state) => <option key={state.code} value={state.code}>{state.label}</option>)}</select>
          <select value={filters.destinationOfSupply} onChange={(event) => updateFilter('destinationOfSupply', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="">Destination Supply</option>{(masters.states || []).map((state) => <option key={state.code} value={state.code}>{state.label}</option>)}</select>
          <select value={filters.taxId} onChange={(event) => updateFilter('taxId', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="">All Taxes</option>{(masters.taxes || []).map((tax) => <option key={tax.id} value={tax.id}>{tax.displayName}</option>)}</select>
          <select value={filters.amountType} onChange={(event) => updateFilter('amountType', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="">All Amount Types</option><option value="TAX_EXCLUSIVE">Tax Exclusive</option><option value="TAX_INCLUSIVE">Tax Inclusive</option></select>
          <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" aria-label="Date from" />
          <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" aria-label="Date to" />
          <select value={filters.expenseAccount} onChange={(event) => updateFilter('expenseAccount', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="">All Accounts</option>{(masters.expenseAccounts || []).map((account) => <option key={account}>{account}</option>)}</select>
          <select value={filters.paymentMode} onChange={(event) => updateFilter('paymentMode', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="">Payment Mode</option>{(masters.paymentModes || []).map((mode) => <option key={mode}>{mode}</option>)}</select>
          <input type="number" min="0" value={filters.amountMin} onChange={(event) => updateFilter('amountMin', event.target.value)} placeholder="Min amount" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          <input type="number" min="0" value={filters.amountMax} onChange={(event) => updateFilter('amountMax', event.target.value)} placeholder="Max amount" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="expenseDate,desc">Newest Date</option><option value="expenseDate,asc">Oldest Date</option><option value="totalAmount,desc">Amount High-Low</option><option value="totalAmount,asc">Amount Low-High</option><option value="expenseNumber,asc">Number A-Z</option></select>
        </div></details>
      </div>
      {listQuery.isPending ? <Loading text="Loading expenses..." /> : listQuery.isError ? <ErrorBox text={apiError(listQuery.error, 'Unable to load expenses.')} /> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Date', 'Expense #', 'Vendor / Invoice', 'Account / Type', 'Supply', 'Tax', 'Amount', 'Total', 'Status', 'Actions'].map((column) => <th key={column} className="whitespace-nowrap px-4 py-3 font-black">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 text-[#06134a]">{rows.map((expense) => <tr key={expense.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-semibold">{displayDate(expense.expenseDate)}</td><td className="px-4 py-3"><button onClick={() => navigate(`/purchases/expenses/${expense.id}`)} className="font-black text-blue-600 hover:underline">{expense.expenseNumber}</button><small className="mt-1 block max-w-44 truncate text-slate-500">{expense.expenseTitle}</small></td><td className="px-4 py-3"><b className="block max-w-44 truncate">{expense.vendorName}</b><small className="text-slate-500">{expense.invoiceNumber || 'No invoice number'}</small></td><td className="px-4 py-3"><b className="block max-w-40 truncate">{expense.expenseAccount}</b><small className="text-slate-500">{labelize(expense.expenseType)}</small></td><td className="px-4 py-3 text-xs font-semibold"><span className="block">{expense.sourceOfSupplyName || '-'}</span><span className="text-slate-400">to</span> {expense.destinationOfSupplyName || '-'}</td><td className="whitespace-nowrap px-4 py-3"><b>{expense.taxName || 'Non-Taxable'}</b><small className="block text-slate-500">{labelize(expense.amountType)}</small></td><td className="whitespace-nowrap px-4 py-3 font-bold">{money(expense.taxSummary?.enteredAmount, expense.currency)}</td><td className="whitespace-nowrap px-4 py-3 font-black">{money(expense.taxSummary?.totalAmount, expense.currency)}</td><td className="px-4 py-3"><StatusBadge value={expense.status} /></td><td className="px-4 py-3"><div className="relative"><button onClick={() => setMenuId(menuId === expense.id ? null : expense.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200"><MoreVertical className="h-4 w-4" /></button>{menuId === expense.id && <div className="absolute right-0 top-10 z-30 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-xl"><button onClick={() => navigate(`/purchases/expenses/${expense.id}`)} className="flex w-full items-center gap-2 px-3 py-2 font-bold hover:bg-slate-50"><Eye className="h-4 w-4" /> View</button><button onClick={() => navigate(`/purchases/expenses/${expense.id}/edit`)} className="flex w-full items-center gap-2 px-3 py-2 font-bold hover:bg-slate-50"><Edit3 className="h-4 w-4" /> Edit</button><button onClick={() => { setMenuId(null); setDeleteTarget(expense); }} className="flex w-full items-center gap-2 px-3 py-2 font-bold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button></div>}</div></td></tr>)}{!rows.length && <tr><td colSpan="10" className="px-6 py-14 text-center"><ReceiptText className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-black">No expenses found</p><p className="mt-1 text-slate-500">Change the filters or add your first expense.</p></td></tr>}</tbody></table></div></div>}
      <Pagination page={page} size={size} count={rows.length} totalPages={listQuery.data?.totalPages || 1} totalElements={listQuery.data?.totalElements || 0} onPage={setPage} onSize={(next) => { setSize(next); setPage(0); }} />
      {deleteMutation.isError && <ErrorBox text={apiError(deleteMutation.error, 'Unable to delete expense.')} />}
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete expense?" message={`Are you sure you want to delete expense '${deleteTarget?.expenseNumber || ''}'? This action cannot be undone.`} loading={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteMutation.mutate(deleteTarget.id)} />
    </section>
  );
}

function Pagination({ page, size, count, totalPages, totalElements, onPage, onSize }) {
  const start = totalElements ? page * size + 1 : 0;
  const end = totalElements ? Math.min(page * size + count, totalElements) : 0;
  return <div className="flex flex-col gap-3 py-4 text-sm font-bold text-[#06134a] sm:flex-row sm:items-center sm:justify-between"><span>Showing {start} to {end} of {totalElements} expenses</span><div className="flex items-center gap-2"><select value={size} onChange={(event) => onSize(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3"><option value="10">10 / page</option><option value="25">25 / page</option><option value="50">50 / page</option></select><button disabled={page === 0} onClick={() => onPage(page - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ArrowLeft className="h-4 w-4" /></button><span className="grid h-9 min-w-9 place-items-center rounded-lg bg-red-600 px-2 text-white">{page + 1}</span><span className="text-slate-500">of {Math.max(totalPages, 1)}</span><button disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ArrowRight className="h-4 w-4" /></button></div></div>;
}

export function ExpenseViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(location.state?.message || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const query = useQuery({ queryKey: ['expense', id], queryFn: () => expensesApi.get(id) });
  const removeMutation = useMutation({ mutationFn: () => expensesApi.remove(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['expense-summary'] }); navigate('/purchases/expenses', { replace: true, state: { message: 'Expense deleted successfully.' } }); } });
  if (query.isPending) return <Loading text="Loading expense details..." />;
  if (query.isError) return <ErrorBox text={apiError(query.error, 'Unable to load expense.')} />;
  const expense = query.data;
  const tax = expense.taxSummary || {};
  return <section className="expense-view space-y-5">
    <PageHeader title={expense.expenseNumber} subtitle={`${expense.expenseTitle} | ${displayDate(expense.expenseDate)}`}><Button icon={ArrowLeft} onClick={() => navigate('/purchases/expenses')}>Back</Button><Button icon={Edit3} onClick={() => navigate(`/purchases/expenses/${id}/edit`)}>Edit</Button><Button icon={Printer} onClick={printExpense}>Print</Button><Button icon={Trash2} danger onClick={() => setConfirmDelete(true)}>Delete</Button></PageHeader>
    {message && <SuccessBox text={message} onClose={() => setMessage('')} />}
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="flex items-start gap-4"><span className="grid h-12 w-12 place-items-center rounded-lg bg-red-50 text-red-600"><ReceiptText className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase text-slate-500">Vendor Expense</p><h2 className="mt-1 text-xl font-black text-[#06134a]">{expense.vendorName}</h2><p className="mt-1 text-sm font-semibold text-slate-500">Invoice# {expense.invoiceNumber || '-'}</p></div></div><div className="text-left md:text-right"><StatusBadge value={expense.status} /><p className="mt-3 text-3xl font-black text-[#06134a]">{money(tax.totalAmount, expense.currency)}</p><p className="text-xs font-semibold text-slate-500">Total Amount</p></div></div></article>
    <div className="grid gap-5 xl:grid-cols-2">
      <DetailCard title="Expense Details" icon={FileText}><Detail label="Expense Number" value={expense.expenseNumber} /><Detail label="Expense Date" value={displayDate(expense.expenseDate)} /><Detail label="Expense Account" value={expense.expenseAccount} /><Detail label="Expense Type" value={labelize(expense.expenseType)} /><Detail label="Vendor" value={expense.vendorName || '-'} /><Detail label="Vendor GSTIN" value={expense.vendorGstin || '-'} /><Detail label="Invoice Number" value={expense.invoiceNumber || '-'} /><Detail label={expense.expenseType === 'GOODS' ? 'HSN Code' : 'SAC'} value={(expense.expenseType === 'GOODS' ? expense.hsnCode : expense.sacCode) || '-'} /><Detail label="GST Treatment" value={labelize(expense.gstTreatment)} /><Detail label="Source of Supply" value={`${expense.sourceOfSupplyName || '-'}${expense.sourceOfSupplyCode ? ` (${expense.sourceOfSupplyCode})` : ''}`} /><Detail label="Destination of Supply" value={`${expense.destinationOfSupplyName || '-'}${expense.destinationOfSupplyCode ? ` (${expense.destinationOfSupplyCode})` : ''}`} /><Detail label="Tax" value={expense.taxName || 'Non-Taxable'} /><Detail label="Amount Is" value={labelize(expense.amountType)} /><Detail label="Reference Number" value={expense.referenceNumber || '-'} /><Detail label="Payment Mode" value={expense.paymentMode || '-'} /><Detail label="Bank Account" value={expense.bankAccountName || expense.paidThrough || '-'} /></DetailCard>
      <DetailCard title="Tax Summary" icon={IndianRupee}><Detail label="Entered Amount" value={money(tax.enteredAmount, expense.currency)} /><Detail label="Taxable Amount" value={money(tax.taxableAmount, expense.currency)} />{Number(tax.cgstAmount) > 0 && <Detail label={`CGST (${Number(tax.taxRate) / 2}%)`} value={money(tax.cgstAmount, expense.currency)} />}{Number(tax.sgstAmount) > 0 && <Detail label={`SGST (${Number(tax.taxRate) / 2}%)`} value={money(tax.sgstAmount, expense.currency)} />}{Number(tax.igstAmount) > 0 && <Detail label={`IGST (${tax.taxRate}%)`} value={money(tax.igstAmount, expense.currency)} />}{Number(tax.cessAmount) > 0 && <Detail label="Cess" value={money(tax.cessAmount, expense.currency)} />}<Detail label="Total Tax" value={money(tax.totalTaxAmount, expense.currency)} />{Number(expense.tdsDeducted || 0) > 0 && <Detail label="TDS Deducted" value={money(expense.tdsDeducted, expense.currency)} />}<div className="col-span-full mt-2 border-t border-slate-200 pt-3"><Detail label="Total Amount" value={money(tax.totalAmount, expense.currency)} strong /></div></DetailCard>
      <DetailCard title="Additional Information" icon={UserRound}><Detail label="Description" value={expense.description || '-'} wide /><Detail label="Notes" value={expense.notes || '-'} wide /><Detail label="Project / Customer" value={expense.projectName || '-'} /><Detail label="Created By" value={expense.createdBy || '-'} /><Detail label="Created Date" value={displayDate(expense.createdAt)} /><Detail label="Updated Date" value={displayDate(expense.updatedAt)} /></DetailCard>
      <DetailCard title="Attachments" icon={Paperclip}>{expense.attachmentName || expense.attachmentUrl ? <div className="col-span-full flex items-center justify-between rounded-lg border border-slate-200 p-3"><span className="flex items-center gap-2 text-sm font-bold text-[#06134a]"><FileText className="h-4 w-4 text-red-600" />{expense.attachmentName || 'Supporting document'}</span>{expense.attachmentUrl && <a href={expense.attachmentUrl} target="_blank" rel="noreferrer" className="text-sm font-black text-blue-600">Download</a>}</div> : <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">No supporting document attached.</div>}</DetailCard>
    </div>
    {removeMutation.isError && <ErrorBox text={apiError(removeMutation.error, 'Unable to delete expense.')} />}
    <ConfirmDialog open={confirmDelete} title="Delete expense?" message={`Are you sure you want to delete expense '${expense.expenseNumber}'? This action cannot be undone.`} loading={removeMutation.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={() => removeMutation.mutate()} />
  </section>;
}

function DetailCard({ title, icon: Icon, children }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[#06134a]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600"><Icon className="h-4 w-4" /></span>{title}</h2><div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</div></article>;
}

function Detail({ label, value, wide = false, strong = false }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><p className="text-xs font-bold text-slate-500">{label}</p><p className={`mt-1 whitespace-pre-wrap ${strong ? 'text-xl font-black' : 'text-sm font-bold'} text-[#06134a]`}>{value || '-'}</p></div>;
}
