import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Banknote, Building2, CalendarDays,
  CheckCircle2, ChevronDown, CircleDollarSign, Clock3, Copy, CreditCard, Download,
  Edit3, Eye, FileSpreadsheet, FileText, Filter, Landmark, Mail, MapPin, MoreVertical,
  PackageCheck, Phone, Plus, Printer, ReceiptText, Search, Send, ShoppingCart,
  Trash2, UserRound, UsersRound, WalletCards, X,
} from 'lucide-react';
import { vendorsApi } from '../../api/vendorsApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

const emptyBank = {
  accountHolderName: '', beneficiaryName: '', bankName: '', accountNumber: '', confirmAccountNumber: '',
  ifscCode: '', branchName: '', accountType: '', swiftCode: '', iban: '', bankCountry: 'India',
  bankAddress: '', upiId: '', notes: '',
};

const emptyVendor = {
  vendorName: '', displayName: '', companyName: '', vendorType: '', sourceOfSupply: '',
  currency: 'INR - Indian Rupee', paymentTerms: 'Net 30', taxTreatment: 'Business',
  gstin: '', pan: '', status: 'ACTIVE', primaryContact: '', email: '', phone: '', mobile: '', website: '',
  billingAddressLine1: '', billingAddressLine2: '', billingCity: '', billingState: '', billingPincode: '', billingCountry: 'India',
  shippingAddressLine1: '', shippingAddressLine2: '', shippingCity: '', shippingState: '', shippingPincode: '', shippingCountry: 'India',
  bankDetails: emptyBank,
};

const statusClass = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
  Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Due: 'bg-amber-50 text-amber-700 ring-amber-200',
  Overdue: 'bg-red-50 text-red-700 ring-red-200',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  Approved: 'bg-blue-50 text-blue-700 ring-blue-200',
};

function money(value, currency = 'INR') {
  const code = String(currency || 'INR').trim().slice(0, 3).toUpperCase();
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, minimumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `${code} ${Number(value || 0).toFixed(2)}`; }
}

function date(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value));
}

function apiError(error, fallback) {
  const fields = error?.response?.data?.validationErrors;
  if (fields && Object.keys(fields).length) return Object.values(fields)[0];
  return error?.response?.data?.message || fallback;
}

function Badge({ value }) {
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black ring-1 ring-inset ${statusClass[value] || 'bg-blue-50 text-blue-700 ring-blue-200'}`}>{String(value || '-').replaceAll('_', ' ')}</span>;
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

function StatCard({ title, value, helper, icon: Icon, tone, active, onClick }) {
  const tones = {
    red: 'bg-red-50 text-red-600', green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600', purple: 'bg-violet-50 text-violet-600', orange: 'bg-amber-50 text-amber-600',
  };
  return (
    <button type="button" onClick={onClick} className={`min-w-0 rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold text-slate-600">{title}</p><p className="mt-1 truncate text-xl font-black text-[#06134a]">{value}</p><p className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</p></div></div>
    </button>
  );
}

function Pagination({ page, totalPages, totalElements, size, count, onPage, onSize }) {
  const start = totalElements ? page * size + 1 : 0;
  const end = totalElements ? Math.min(page * size + count, totalElements) : 0;
  return (
    <div className="flex flex-col gap-3 py-4 text-sm font-bold text-[#06134a] sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {start} to {end} of {totalElements} vendors</span>
      <div className="flex items-center gap-2">
        <select value={size} onChange={(event) => onSize(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3"><option value="10">10 / page</option><option value="20">20 / page</option><option value="50">50 / page</option></select>
        <button disabled={page === 0} onClick={() => onPage(page - 1)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 disabled:opacity-40">‹</button>
        <span className="grid h-9 min-w-9 place-items-center rounded-lg bg-red-600 px-2 text-white">{page + 1}</span>
        <span className="text-slate-500">of {Math.max(totalPages, 1)}</span>
        <button disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 disabled:opacity-40">›</button>
      </div>
    </div>
  );
}

export function VendorListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [payableStatus, setPayableStatus] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [sort, setSort] = useState('createdAt,desc');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [menuId, setMenuId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState(location.state?.message || '');
  const dates = datePresetRange(datePreset);
  const params = { search, status, payableStatus, dateFrom: dates.dateFrom, dateTo: dates.dateTo, page, size, sort };
  const listQuery = useQuery({ queryKey: ['vendors', params], queryFn: () => vendorsApi.list(params), placeholderData: (previous) => previous });
  const summaryQuery = useQuery({ queryKey: ['vendors-summary'], queryFn: vendorsApi.summary });
  const deleteMutation = useMutation({
    mutationFn: (id) => vendorsApi.remove(id),
    onSuccess: () => { setDeleteTarget(null); setMessage('Vendor deleted successfully.'); queryClient.invalidateQueries({ queryKey: ['vendors'] }); queryClient.invalidateQueries({ queryKey: ['vendors-summary'] }); },
  });
  const summary = summaryQuery.data || {};
  const selectWidget = (filter, nextStatus = '') => { setPayableStatus(filter); setStatus(nextStatus); setPage(0); };
  const cards = [
    ['Total Vendors', summary.totalVendors || 0, 'All vendors', UsersRound, 'red', !status && !payableStatus, () => selectWidget('', '')],
    ['Active Vendors', summary.activeVendors || 0, 'Currently active', CheckCircle2, 'green', status === 'ACTIVE', () => selectWidget('', 'ACTIVE')],
    ['Inactive Vendors', summary.inactiveVendors || 0, 'Not active', UserRound, 'purple', status === 'INACTIVE', () => selectWidget('', 'INACTIVE')],
    ['Total Payables', money(summary.totalPayables), 'Outstanding balance', WalletCards, 'blue', payableStatus === 'outstanding', () => selectWidget('outstanding')],
    ['Total Overdue', money(summary.totalOverdue), 'Past due', Clock3, 'orange', payableStatus === 'overdue', () => selectWidget('overdue')],
    ['Paid This Month', money(summary.paidThisMonth), 'Current month', CircleDollarSign, 'green', payableStatus === 'paid', () => selectWidget('paid')],
    ['Purchases This Month', money(summary.purchasesThisMonth), 'Current month', ShoppingCart, 'red', payableStatus === 'purchases', () => selectWidget('purchases')],
  ];
  const rows = listQuery.data?.content || [];
  const reset = () => { setSearch(''); setStatus(''); setPayableStatus(''); setDatePreset(''); setPage(0); };

  return (
    <section className="space-y-5">
      <PageHeader title="Vendors" subtitle="Manage vendors, payables, transactions and statements from live purchase data.">
        <Link to="/purchases/vendors/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white"><Plus className="h-4 w-4" /> Add Vendor</Link>
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">{cards.map(([title, value, helper, icon, tone, active, onClick]) => <StatCard key={title} title={title} value={value} helper={helper} icon={icon} tone={tone} active={active} onClick={onClick} />)}</div>
      {message && <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><span>{message}</span><button onClick={() => setMessage('')}><X className="h-4 w-4" /></button></div>}
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[1.5fr_0.65fr_0.75fr_0.7fr_0.85fr_auto]">
        <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search name, company, email, phone or GSTIN" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-red-300" /></label>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold"><option value="">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
        <select value={payableStatus} onChange={(e) => { setPayableStatus(e.target.value); setPage(0); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold"><option value="">All Payables</option><option value="outstanding">Outstanding</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="purchases">Purchases</option></select>
        <select value={datePreset} onChange={(e) => { setDatePreset(e.target.value); setPage(0); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold"><option value="">All Dates</option><option value="thisMonth">This Month</option><option value="last30">Last 30 Days</option><option value="thisYear">This Year</option></select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold"><option value="createdAt,desc">Newest First</option><option value="createdAt,asc">Oldest First</option><option value="vendorName,asc">Name A-Z</option><option value="vendorName,desc">Name Z-A</option></select>
        <Button icon={Filter} onClick={reset}>Reset</Button>
      </div>
      {listQuery.isPending ? <Loading text="Loading vendors..." /> : listQuery.isError ? <ErrorBox text={apiError(listQuery.error, 'Unable to load vendors.')} /> : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Vendor Name', 'Company Name', 'Email', 'Phone', 'GSTIN', 'Payables', 'Unused Credits', 'Status', 'Created', 'Actions'].map((column) => <th key={column} className="whitespace-nowrap px-4 py-3 font-black">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 text-[#06134a]">
            {rows.map((vendor) => <tr key={vendor.id} className="hover:bg-slate-50"><td className="px-4 py-3"><button onClick={() => navigate(`/purchases/vendors/${vendor.id}`)} className="flex items-center gap-3 text-left"><span className="grid h-9 w-9 place-items-center rounded-full bg-red-50 font-black text-red-600">{initials(vendor.vendorName)}</span><span><b className="block">{vendor.vendorName}</b><small className="text-slate-500">{vendor.vendorNumber}</small></span></button></td><td className="whitespace-nowrap px-4 py-3 font-semibold">{vendor.companyName || '-'}</td><td className="px-4 py-3">{vendor.email || '-'}</td><td className="whitespace-nowrap px-4 py-3">{vendor.phone || '-'}</td><td className="whitespace-nowrap px-4 py-3 font-semibold">{vendor.gstin || '-'}</td><td className="whitespace-nowrap px-4 py-3 font-black text-red-600">{money(vendor.financialSummary?.outstandingPayables)}</td><td className="whitespace-nowrap px-4 py-3 font-bold text-emerald-600">{money(vendor.financialSummary?.unusedCredits)}</td><td className="px-4 py-3"><Badge value={vendor.status} /></td><td className="whitespace-nowrap px-4 py-3">{date(vendor.createdAt)}</td><td className="px-4 py-3"><div className="relative"><button onClick={() => setMenuId(menuId === vendor.id ? null : vendor.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200"><MoreVertical className="h-4 w-4" /></button>{menuId === vendor.id && <div className="absolute right-0 top-10 z-30 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-xl"><button onClick={() => navigate(`/purchases/vendors/${vendor.id}`)} className="flex w-full items-center gap-2 px-3 py-2 font-bold hover:bg-slate-50"><Eye className="h-4 w-4" /> View</button><button onClick={() => navigate(`/purchases/vendors/${vendor.id}/edit`)} className="flex w-full items-center gap-2 px-3 py-2 font-bold hover:bg-slate-50"><Edit3 className="h-4 w-4" /> Edit</button><button onClick={() => { setMenuId(null); setDeleteTarget(vendor); }} className="flex w-full items-center gap-2 px-3 py-2 font-bold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button></div>}</div></td></tr>)}
            {!rows.length && <tr><td colSpan="10" className="px-6 py-14 text-center"><UsersRound className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-black">No vendors found</p><p className="mt-1 text-slate-500">Change filters or add your first vendor.</p></td></tr>}
          </tbody></table></div>
        </div>
      )}
      <Pagination page={page} totalPages={listQuery.data?.totalPages || 1} totalElements={listQuery.data?.totalElements || 0} size={size} count={rows.length} onPage={setPage} onSize={(next) => { setSize(next); setPage(0); }} />
      {deleteMutation.isError && <ErrorBox text={apiError(deleteMutation.error, 'Unable to delete vendor.')} />}
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete vendor?" message={`Are you sure you want to delete vendor '${deleteTarget?.vendorName || ''}'? This action cannot be undone.`} loading={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteMutation.mutate(deleteTarget.id)} />
    </section>
  );
}

function TextInput({ label, value, onChange, required, type = 'text', placeholder, error, disabled, hint }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black text-[#06134a]">{label}{required && <b className="ml-1 text-red-600">*</b>}</span><input type={type} value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-4 ${error ? 'border-red-400 focus:ring-red-50' : 'border-slate-200 focus:border-blue-300 focus:ring-blue-50'} disabled:bg-slate-50`} />{hint && <small className="mt-1 block font-semibold text-slate-500">{hint}</small>}{error && <small className="mt-1 block font-bold text-red-600">{error}</small>}</label>;
}

function SelectInput({ label, value, onChange, required, options, error }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black text-[#06134a]">{label}{required && <b className="ml-1 text-red-600">*</b>}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`h-10 w-full rounded-lg border bg-white px-3 text-sm font-semibold outline-none ${error ? 'border-red-400' : 'border-slate-200'}`}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={typeof option === 'string' ? option : option.value} value={typeof option === 'string' ? option : option.value}>{typeof option === 'string' ? option : option.label}</option>)}</select>{error && <small className="mt-1 block font-bold text-red-600">{error}</small>}</label>;
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black text-[#06134a]">{label}</span><textarea value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>;
}

function FormSection({ title, icon: Icon, children }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[#06134a]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600"><Icon className="h-4 w-4" /></span>{title}</h2>{children}</article>;
}

export function VendorFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyVendor);
  const [loadedId, setLoadedId] = useState(null);
  const [errors, setErrors] = useState({});
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const vendorQuery = useQuery({ queryKey: ['vendor', id], queryFn: () => vendorsApi.get(id), enabled: editing });
  useEffect(() => {
    if (!editing || !vendorQuery.data || loadedId === vendorQuery.data.id) return;
    const record = vendorQuery.data;
    setLoadedId(record.id);
    setForm({ ...emptyVendor, ...record, bankDetails: { ...emptyBank, ...(record.bankDetails || {}), accountNumber: '', confirmAccountNumber: '' } });
  }, [editing, loadedId, vendorQuery.data]);
  const mutation = useMutation({
    mutationFn: (payload) => editing ? vendorsApi.update(id, payload) : vendorsApi.create(payload),
    onSuccess: (vendor) => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); queryClient.invalidateQueries({ queryKey: ['vendors-summary'] }); navigate(`/purchases/vendors/${vendor.id}`, { replace: true, state: { message: editing ? 'Vendor updated successfully.' : 'Vendor created successfully.' } }); },
  });
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateBank = (field, value) => setForm((current) => ({ ...current, bankDetails: { ...current.bankDetails, [field]: value } }));
  const validate = () => {
    const next = {};
    if (!form.vendorName.trim()) next.vendorName = 'Vendor Name is required.';
    if (!form.displayName.trim()) next.displayName = 'Display Name is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.';
    if (form.phone && !/^[+0-9()\-\s]{7,40}$/.test(form.phone)) next.phone = 'Enter a valid phone number.';
    if (form.mobile && !/^[+0-9()\-\s]{7,40}$/.test(form.mobile)) next.mobile = 'Enter a valid mobile number.';
    if (form.website && !/^https?:\/\/.+/.test(form.website)) next.website = 'Website must start with http:// or https://.';
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.gstin.toUpperCase())) next.gstin = 'Enter a valid GSTIN.';
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan.toUpperCase())) next.pan = 'Enter a valid PAN.';
    const bank = form.bankDetails;
    const hasBank = Object.entries(bank).some(([key, value]) => !['maskedAccountNumber', 'bankCountry'].includes(key) && String(value || '').trim());
    if (hasBank) {
      if (!bank.accountHolderName.trim()) next.accountHolderName = 'Account Holder Name is required.';
      if (!bank.bankName.trim()) next.bankName = 'Bank Name is required.';
      if (!bank.accountNumber.trim() && !bank.maskedAccountNumber) next.accountNumber = 'Account Number is required.';
      if (bank.accountNumber && bank.accountNumber !== bank.confirmAccountNumber) next.confirmAccountNumber = 'Account numbers do not match.';
      if (bank.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifscCode.toUpperCase())) next.ifscCode = 'Enter a valid IFSC code.';
      if (bank.swiftCode && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bank.swiftCode.toUpperCase())) next.swiftCode = 'Enter a valid SWIFT code.';
      if (bank.iban && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(bank.iban.toUpperCase())) next.iban = 'Enter a valid IBAN.';
      if (bank.upiId && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(bank.upiId)) next.upiId = 'Enter a valid UPI ID.';
    }
    setErrors(next);
    return !Object.keys(next).length;
  };
  const submit = (event) => { event.preventDefault(); if (validate()) mutation.mutate({ ...form, gstin: form.gstin.toUpperCase(), pan: form.pan.toUpperCase(), bankDetails: { ...form.bankDetails, maskedAccountNumber: undefined } }); };
  const copyBilling = (checked) => { setSameAsBilling(checked); if (checked) setForm((current) => ({ ...current, shippingAddressLine1: current.billingAddressLine1, shippingAddressLine2: current.billingAddressLine2, shippingCity: current.billingCity, shippingState: current.billingState, shippingPincode: current.billingPincode, shippingCountry: current.billingCountry })); };

  if (editing && vendorQuery.isPending) return <Loading text="Loading vendor..." />;
  if (editing && vendorQuery.isError) return <ErrorBox text={apiError(vendorQuery.error, 'Unable to load vendor.')} />;
  return (
    <form onSubmit={submit} className="space-y-5">
      <PageHeader title={editing ? 'Edit Vendor' : 'Add Vendor'} subtitle={editing ? 'Update vendor, contact, address and bank information.' : 'Add a vendor to manage purchase transactions and payables.'}><Button onClick={() => navigate('/purchases/vendors')}>Cancel</Button><Button type="submit" primary icon={FileText} disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save Vendor'}</Button></PageHeader>
      {mutation.isError && <ErrorBox text={apiError(mutation.error, 'Unable to save vendor.')} />}
      <FormSection title="Basic Information" icon={Building2}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><TextInput label="Vendor Name" value={form.vendorName} onChange={(value) => { update('vendorName', value); if (!editing || !form.displayName) update('displayName', value); }} required error={errors.vendorName} /><TextInput label="Display Name" value={form.displayName} onChange={(value) => update('displayName', value)} required error={errors.displayName} /><TextInput label="Company Name" value={form.companyName} onChange={(value) => update('companyName', value)} /><SelectInput label="Vendor Type" value={form.vendorType} onChange={(value) => update('vendorType', value)} options={['Supplier', 'Manufacturer', 'Consultant', 'Service Provider', 'IT Service Provider', 'Contractor', 'Other']} /><TextInput label="Source of Supply" value={form.sourceOfSupply} onChange={(value) => update('sourceOfSupply', value)} placeholder="State / country" /><SelectInput label="Currency" value={form.currency} onChange={(value) => update('currency', value)} required options={['INR - Indian Rupee', 'USD - US Dollar', 'EUR - Euro', 'GBP - British Pound']} /><SelectInput label="Payment Terms" value={form.paymentTerms} onChange={(value) => update('paymentTerms', value)} options={['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60']} /><SelectInput label="Status" value={form.status} onChange={(value) => update('status', value)} required options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} /></div></FormSection>
      <FormSection title="Tax Details" icon={ReceiptText}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SelectInput label="Tax Treatment" value={form.taxTreatment} onChange={(value) => update('taxTreatment', value)} options={['Business', 'Registered Business - Regular', 'Registered Business - Composition', 'Unregistered Business', 'Overseas']} /><TextInput label="GSTIN" value={form.gstin} onChange={(value) => update('gstin', value.toUpperCase())} error={errors.gstin} /><TextInput label="PAN" value={form.pan} onChange={(value) => update('pan', value.toUpperCase())} error={errors.pan} /></div></FormSection>
      <FormSection title="Contact Information" icon={UserRound}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><TextInput label="Primary Contact" value={form.primaryContact} onChange={(value) => update('primaryContact', value)} /><TextInput label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} error={errors.email} /><TextInput label="Phone" value={form.phone} onChange={(value) => update('phone', value)} error={errors.phone} /><TextInput label="Mobile" value={form.mobile} onChange={(value) => update('mobile', value)} error={errors.mobile} /><TextInput label="Website" value={form.website} onChange={(value) => update('website', value)} placeholder="https://example.com" error={errors.website} /></div></FormSection>
      <div className="grid gap-5 xl:grid-cols-2"><AddressSection title="Billing Address" prefix="billing" form={form} update={update} /><article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-black text-[#06134a]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600"><MapPin className="h-4 w-4" /></span>Shipping Address</h2><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={sameAsBilling} onChange={(e) => copyBilling(e.target.checked)} /> Same as billing</label></div><AddressFields prefix="shipping" form={form} update={update} /></article></div>
      <FormSection title="Bank Details" icon={Landmark}><p className="mb-4 text-xs font-semibold text-slate-500">Optional. Once bank information is entered, Account Holder Name, Bank Name and Account Number are required. The account number is masked everywhere outside this form.</p><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><TextInput label="Account Holder Name" value={form.bankDetails.accountHolderName} onChange={(value) => updateBank('accountHolderName', value)} error={errors.accountHolderName} /><TextInput label="Beneficiary Name" value={form.bankDetails.beneficiaryName} onChange={(value) => updateBank('beneficiaryName', value)} /><TextInput label="Bank Name" value={form.bankDetails.bankName} onChange={(value) => updateBank('bankName', value)} error={errors.bankName} /><TextInput label="Account Number" value={form.bankDetails.accountNumber} onChange={(value) => updateBank('accountNumber', value)} placeholder={editing && form.bankDetails.maskedAccountNumber ? 'Leave blank to keep existing account' : ''} error={errors.accountNumber} hint={editing && form.bankDetails.maskedAccountNumber ? `Saved account: ${form.bankDetails.maskedAccountNumber}` : ''} /><TextInput label="Confirm Account Number" value={form.bankDetails.confirmAccountNumber} onChange={(value) => updateBank('confirmAccountNumber', value)} error={errors.confirmAccountNumber} /><TextInput label="IFSC Code" value={form.bankDetails.ifscCode} onChange={(value) => updateBank('ifscCode', value.toUpperCase())} error={errors.ifscCode} /><TextInput label="Branch Name" value={form.bankDetails.branchName} onChange={(value) => updateBank('branchName', value)} /><SelectInput label="Bank Account Type" value={form.bankDetails.accountType} onChange={(value) => updateBank('accountType', value)} options={['Savings', 'Current']} /><TextInput label="SWIFT Code" value={form.bankDetails.swiftCode} onChange={(value) => updateBank('swiftCode', value.toUpperCase())} error={errors.swiftCode} /><TextInput label="IBAN" value={form.bankDetails.iban} onChange={(value) => updateBank('iban', value.toUpperCase())} error={errors.iban} /><TextInput label="Bank Country" value={form.bankDetails.bankCountry} onChange={(value) => updateBank('bankCountry', value)} /><TextInput label="UPI ID" value={form.bankDetails.upiId} onChange={(value) => updateBank('upiId', value)} error={errors.upiId} /></div><div className="mt-4 grid gap-4 md:grid-cols-2"><TextArea label="Bank Address" value={form.bankDetails.bankAddress} onChange={(value) => updateBank('bankAddress', value)} /><TextArea label="Bank Notes" value={form.bankDetails.notes} onChange={(value) => updateBank('notes', value)} /></div></FormSection>
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur"><Button onClick={() => navigate('/purchases/vendors')}>Cancel</Button><Button type="submit" primary icon={FileText} disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save Vendor'}</Button></div>
    </form>
  );
}

function AddressSection({ title, prefix, form, update }) { return <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[#06134a]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600"><MapPin className="h-4 w-4" /></span>{title}</h2><AddressFields prefix={prefix} form={form} update={update} /></article>; }
function AddressFields({ prefix, form, update }) { const field = (name) => `${prefix}${name}`; return <div className="grid gap-4 md:grid-cols-2"><TextInput label="Address Line 1" value={form[field('AddressLine1')]} onChange={(value) => update(field('AddressLine1'), value)} /><TextInput label="Address Line 2" value={form[field('AddressLine2')]} onChange={(value) => update(field('AddressLine2'), value)} /><TextInput label="City" value={form[field('City')]} onChange={(value) => update(field('City'), value)} /><TextInput label="State" value={form[field('State')]} onChange={(value) => update(field('State'), value)} /><TextInput label="PIN / ZIP Code" value={form[field('Pincode')]} onChange={(value) => update(field('Pincode'), value)} /><TextInput label="Country" value={form[field('Country')]} onChange={(value) => update(field('Country'), value)} /></div>; }

function Loading({ text }) { return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-black text-[#06134a]"><span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-4 border-red-100 border-t-red-600" />{text}</div>; }
function ErrorBox({ text }) { return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{text}</div>; }
function initials(name) { return String(name || 'V').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }
function datePresetRange(preset) { const now = new Date(); const iso = (value) => value.toISOString().slice(0, 10); if (preset === 'thisMonth') return { dateFrom: iso(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: iso(now) }; if (preset === 'last30') return { dateFrom: iso(new Date(now.getTime() - 29 * 86400000)), dateTo: iso(now) }; if (preset === 'thisYear') return { dateFrom: iso(new Date(now.getFullYear(), 0, 1)), dateTo: iso(now) }; return { dateFrom: '', dateTo: '' }; }
