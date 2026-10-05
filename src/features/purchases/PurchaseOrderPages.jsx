import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign,
  ClipboardCheck, Copy as Clone, Download, Edit3, Eye, FileText, Filter, History, Mail, MapPin,
  MoreVertical, Package, PackageCheck, Paperclip, Plus, Printer, ReceiptText, RefreshCw, Search,
  Send, ShoppingCart, Trash2, Truck, Upload, UserRound, X,
} from 'lucide-react';
import { purchaseOrdersApi } from '../../api/purchaseOrdersApi.js';
import { recordsApi } from '../../api/recordsApi.js';
import { storageApi } from '../../api/storageApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import intelliaTechLogo from '../../assets/intelliatech-logo-black-tm.png';

const TODAY = new Date().toISOString().slice(0, 10);
const PAGE_SIZES = [10, 25, 50];
const EMPTY_ADDRESS = { attention: '', addressLine1: '', addressLine2: '', city: '', state: '', stateCode: '', country: 'India', postalCode: '', phone: '', email: '', gstin: '' };
const EMPTY_ITEM = { key: crypto.randomUUID(), itemId: '', description: '', quantity: '1', unit: '', rate: '0', discountType: 'NONE', discountValue: '0', taxId: '', hsnCode: '', sacCode: '', accountName: '', warehouseName: '', projectName: '' };
const EMPTY_FORM = {
  purchaseOrderDate: TODAY, expectedDeliveryDate: '', vendorId: '', referenceNumber: '', shipmentPreference: '',
  paymentTerms: 'Net 30', currencyCode: 'INR', exchangeRate: '1', gstTreatment: 'UNREGISTERED_BUSINESS',
  sourceOfSupplyCode: '', destinationOfSupplyCode: '', placeOfSupplyCode: '', deliveryAddressSource: 'ORGANIZATION',
  vendorAddress: { ...EMPTY_ADDRESS }, deliveryAddress: { ...EMPTY_ADDRESS }, projectName: '', branchName: '', warehouseName: '', attention: '',
  amountType: 'TAX_EXCLUSIVE', shippingCharge: '0', adjustmentAmount: '0', notes: '', termsAndConditions: '', attachmentName: '', attachmentUrl: '', items: [{ ...EMPTY_ITEM }],
};

const STATUS_STYLE = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200', ISSUED: 'bg-blue-50 text-blue-700 ring-blue-200',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700 ring-amber-200', RECEIVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PARTIALLY_BILLED: 'bg-violet-50 text-violet-700 ring-violet-200', BILLED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 ring-emerald-200', CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
};

function money(value, currency = 'INR') {
  const code = String(currency || 'INR').trim().slice(0, 3).toUpperCase();
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `${code} ${Number(value || 0).toFixed(2)}`; }
}

function dateText(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(String(value).length === 10 ? `${value}T00:00:00` : value));
}

function dateTimeText(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function titleize(value) {
  return String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorText(error, fallback = 'Something went wrong. Please try again.') {
  const fields = error?.response?.data?.validationErrors;
  if (fields && Object.keys(fields).length) return Object.values(fields)[0];
  return error?.response?.data?.message || fallback;
}

function StatusBadge({ value }) {
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-black ring-1 ring-inset ${STATUS_STYLE[value] || STATUS_STYLE.DRAFT}`}>{titleize(value || 'DRAFT')}</span>;
}

function PageHeader({ title, subtitle, children }) {
  return <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><h1 className="text-2xl font-black text-[#06134a]">{title}</h1><p className="mt-1 text-sm font-semibold text-slate-600">{subtitle}</p></div><div className="flex flex-wrap items-center gap-2">{children}</div></div>;
}

function Button({ icon: Icon, children, primary, danger, onClick, disabled, type = 'button', className = '' }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${primary ? 'border-red-600 bg-red-600 text-white hover:bg-red-700' : danger ? 'border-red-200 bg-white text-red-600 hover:bg-red-50' : 'border-slate-200 bg-white text-[#06134a] hover:bg-slate-50'} ${className}`}>{Icon && <Icon className="h-4 w-4" />}{children}</button>;
}

function Loading({ label = 'Loading purchase orders...' }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm font-black text-[#06134a]"><span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-4 border-red-100 border-t-red-600" />{label}</div>;
}

function Alert({ children, type = 'error', onClose }) {
  const colors = type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700';
  return <div className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-bold ${colors}`}><span>{children}</span>{onClose && <button onClick={onClose}><X className="h-4 w-4" /></button>}</div>;
}

function SummaryCard({ icon: Icon, label, value, helper, tone }) {
  const tones = { red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', green: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600' };
  return <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold text-slate-600">{label}</p><p className="mt-1 truncate text-xl font-black text-[#06134a]">{value}</p><p className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</p></div></div></article>;
}

function ActionMenu({ order, onDelete, onClone }) {
  const [open, setOpen] = useState(false);
  const canEdit = order.availableActions?.includes('EDIT');
  const canDelete = order.availableActions?.includes('DELETE');
  return <div className="relative"><button aria-label="Purchase order actions" onClick={() => setOpen((value) => !value)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-[#06134a] hover:bg-slate-50"><MoreVertical className="h-4 w-4" /></button>{open && <><button className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} aria-label="Close actions" /><div className="absolute right-0 top-10 z-40 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"><Link to={`/purchases/orders/${order.id}`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#06134a] hover:bg-slate-50"><Eye className="h-4 w-4" />View</Link>{canEdit && <Link to={`/purchases/orders/${order.id}/edit`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#06134a] hover:bg-slate-50"><Edit3 className="h-4 w-4" />Edit</Link>}<button onClick={() => { setOpen(false); onClone(order); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#06134a] hover:bg-slate-50"><Clone className="h-4 w-4" />Clone</button>{canDelete && <button onClick={() => { setOpen(false); onDelete(order); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" />Delete</button>}</div></>}</div>;
}

export function PurchaseOrderListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [sort, setSort] = useState('purchaseOrderDate,desc');
  const [search, setSearch] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sourceOfSupply, setSourceOfSupply] = useState('');
  const [destinationOfSupply, setDestinationOfSupply] = useState('');
  const [currency, setCurrency] = useState('');
  const [gstTreatment, setGstTreatment] = useState('');
  const [expectedDeliveryFrom, setExpectedDeliveryFrom] = useState('');
  const [expectedDeliveryTo, setExpectedDeliveryTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState(location.state?.message || '');
  const params = {
    page, size, sort, search: search.trim() || undefined, vendorId: vendorId || undefined,
    status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
    sourceOfSupply: sourceOfSupply || undefined, destinationOfSupply: destinationOfSupply || undefined,
    currency: currency || undefined, gstTreatment: gstTreatment || undefined,
    expectedDeliveryFrom: expectedDeliveryFrom || undefined, expectedDeliveryTo: expectedDeliveryTo || undefined,
    minAmount: minAmount || undefined, maxAmount: maxAmount || undefined, createdBy: createdBy.trim() || undefined,
  };
  const listQuery = useQuery({ queryKey: ['purchase-orders', params], queryFn: () => purchaseOrdersApi.list(params), placeholderData: (previous) => previous });
  const summaryQuery = useQuery({ queryKey: ['purchase-order-summary'], queryFn: purchaseOrdersApi.summary });
  const filtersQuery = useQuery({ queryKey: ['purchase-order-filters'], queryFn: purchaseOrdersApi.filters });
  const removeMutation = useMutation({ mutationFn: (id) => purchaseOrdersApi.remove(id), onSuccess: () => { setDeleteTarget(null); setNotice('Purchase order deleted successfully.'); queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); queryClient.invalidateQueries({ queryKey: ['purchase-order-summary'] }); } });
  const cloneMutation = useMutation({ mutationFn: (id) => purchaseOrdersApi.clone(id), onSuccess: (order) => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); navigate(`/purchases/orders/${order.id}/edit`, { state: { message: `Cloned as ${order.purchaseOrderNumber}.` } }); } });
  const content = listQuery.data?.content || [];
  const summary = summaryQuery.data || {};
  const filters = filtersQuery.data || { vendors: [], statuses: [] };
  const currencies = [...new Set((filters.vendors || []).map((vendor) => String(vendor.currency || 'INR').split(' ')[0]).filter(Boolean))].sort();
  const resetPage = (callback) => { setPage(0); callback(); };
  const clearFilters = () => {
    setSearch(''); setVendorId(''); setStatus(''); setDateFrom(''); setDateTo('');
    setSourceOfSupply(''); setDestinationOfSupply(''); setCurrency(''); setGstTreatment('');
    setExpectedDeliveryFrom(''); setExpectedDeliveryTo(''); setMinAmount(''); setMaxAmount(''); setCreatedBy(''); setPage(0);
  };
  return <div className="space-y-5 overflow-x-hidden">
    <PageHeader title="Purchase Orders" subtitle="Create, issue, receive, bill, and track vendor purchase orders from live database data."><Link to="/purchases/orders/new"><Button icon={Plus} primary>New Purchase Order</Button></Link></PageHeader>
    {notice && <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>}
    {(listQuery.error || cloneMutation.error || removeMutation.error) && <Alert>{errorText(listQuery.error || cloneMutation.error || removeMutation.error)}</Alert>}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <SummaryCard icon={ReceiptText} label="Total Orders" value={summary.totalOrders ?? 0} helper={`${summary.draftOrders ?? 0} Draft`} tone="red" />
      <SummaryCard icon={CircleDollarSign} label="Total Value" value={money(summary.totalValue)} helper="All purchase orders" tone="blue" />
      <SummaryCard icon={CalendarDays} label="This Month" value={money(summary.thisMonthValue)} helper="Current month" tone="violet" />
      <SummaryCard icon={Truck} label="In Progress" value={(summary.issuedOrders || 0) + (summary.partiallyReceivedOrders || 0)} helper={`${summary.partiallyReceivedOrders ?? 0} Partially received`} tone="amber" />
      <SummaryCard icon={PackageCheck} label="Received / Billed" value={(summary.receivedOrders || 0) + (summary.billedOrders || 0)} helper={money(summary.outstandingValue)} tone="green" />
    </section>
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-2">
          <label className="relative w-[300px] shrink-0"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Search PO, vendor, reference or item..." className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
          <select value={vendorId} onChange={(event) => resetPage(() => setVendorId(event.target.value))} className="h-10 w-[175px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#06134a]"><option value="">All Vendors</option>{filters.vendors?.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.displayName || vendor.name}</option>)}</select>
          <select value={status} onChange={(event) => resetPage(() => setStatus(event.target.value))} className="h-10 w-[155px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#06134a]"><option value="">All Statuses</option>{filters.statuses?.map((value) => <option key={value} value={value}>{titleize(value)}</option>)}</select>
          <input type="date" aria-label="From date" value={dateFrom} onChange={(event) => resetPage(() => setDateFrom(event.target.value))} className="h-10 w-[145px] shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-semibold" />
          <input type="date" aria-label="To date" value={dateTo} onChange={(event) => resetPage(() => setDateTo(event.target.value))} className="h-10 w-[145px] shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-semibold" />
          <Button className="shrink-0" icon={Filter} onClick={() => setShowMoreFilters((value) => !value)}>{showMoreFilters ? 'Less' : 'More'} Filters</Button>
          <Button className="shrink-0" icon={X} onClick={clearFilters}>Clear</Button>
        </div>
      </div>
      {showMoreFilters && <div className="mt-2 overflow-x-auto border-t border-slate-100 pt-3"><div className="flex min-w-max items-center gap-2">
        <select aria-label="Source of Supply" value={sourceOfSupply} onChange={(event) => resetPage(() => setSourceOfSupply(event.target.value))} className="h-10 w-[190px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#06134a]"><option value="">All Source States</option>{filters.states?.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.code})</option>)}</select>
        <select aria-label="Destination of Supply" value={destinationOfSupply} onChange={(event) => resetPage(() => setDestinationOfSupply(event.target.value))} className="h-10 w-[205px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#06134a]"><option value="">All Destination States</option>{filters.states?.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.code})</option>)}</select>
        <select aria-label="Currency" value={currency} onChange={(event) => resetPage(() => setCurrency(event.target.value))} className="h-10 w-[145px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#06134a]"><option value="">All Currencies</option>{currencies.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="GST Treatment" value={gstTreatment} onChange={(event) => resetPage(() => setGstTreatment(event.target.value))} className="h-10 w-[205px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#06134a]"><option value="">All GST Treatments</option>{filters.gstTreatments?.map((value) => <option key={value} value={value}>{titleize(value)}</option>)}</select>
        <input aria-label="Created By" value={createdBy} onChange={(event) => resetPage(() => setCreatedBy(event.target.value))} placeholder="Created by" className="h-10 w-[155px] shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-300" />
        <input type="date" aria-label="Expected delivery from" value={expectedDeliveryFrom} onChange={(event) => resetPage(() => setExpectedDeliveryFrom(event.target.value))} className="h-10 w-[145px] shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-semibold" />
        <input type="date" aria-label="Expected delivery to" value={expectedDeliveryTo} onChange={(event) => resetPage(() => setExpectedDeliveryTo(event.target.value))} className="h-10 w-[145px] shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-semibold" />
        <input type="number" min="0" step="0.01" aria-label="Minimum amount" value={minAmount} onChange={(event) => resetPage(() => setMinAmount(event.target.value))} placeholder="Minimum amount" className="h-10 w-[155px] shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-semibold" />
        <input type="number" min="0" step="0.01" aria-label="Maximum amount" value={maxAmount} onChange={(event) => resetPage(() => setMaxAmount(event.target.value))} placeholder="Maximum amount" className="h-10 w-[155px] shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-semibold" />
      </div></div>}
    </section>
    {listQuery.isLoading ? <Loading /> : <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] table-fixed text-left"><thead className="bg-red-50/60 text-[11px] uppercase text-slate-600"><tr><th className="w-[14%] px-4 py-3">PO Number</th><th className="w-[20%] px-4 py-3">Vendor</th><th className="w-[12%] px-4 py-3"><button onClick={() => setSort(sort === 'purchaseOrderDate,desc' ? 'purchaseOrderDate,asc' : 'purchaseOrderDate,desc')}>PO Date</button></th><th className="w-[13%] px-4 py-3">Expected Date</th><th className="w-[13%] px-4 py-3 text-right">Amount</th><th className="w-[14%] px-4 py-3">Status</th><th className="w-[10%] px-4 py-3">Receipt</th><th className="w-[4%] px-2 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{content.map((order) => { const received = order.items?.reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0) || 0; const quantity = order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0; return <tr key={order.id} className="text-sm hover:bg-slate-50/70"><td className="px-4 py-3"><Link className="font-black text-blue-600 hover:underline" to={`/purchases/orders/${order.id}`}>{order.purchaseOrderNumber}</Link><p className="mt-1 truncate text-xs font-semibold text-slate-500">{order.referenceNumber || 'No reference'}</p></td><td className="px-4 py-3"><p className="truncate font-black text-[#06134a]">{order.vendorName}</p><p className="truncate text-xs font-semibold text-slate-500">{order.vendorGstin || order.vendorEmail || '-'}</p></td><td className="px-4 py-3 font-semibold text-[#06134a]">{dateText(order.purchaseOrderDate)}</td><td className="px-4 py-3 font-semibold text-[#06134a]">{dateText(order.expectedDeliveryDate)}</td><td className="px-4 py-3 text-right font-black text-[#06134a]">{money(order.totalAmount, order.currencyCode)}</td><td className="px-4 py-3"><StatusBadge value={order.status} /></td><td className="px-4 py-3"><p className="text-xs font-black text-[#06134a]">{quantity ? `${Math.round(received / quantity * 100)}%` : '0%'}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full bg-emerald-500" style={{ width: `${quantity ? Math.min(received / quantity * 100, 100) : 0}%` }} /></div></td><td className="px-2 py-3"><ActionMenu order={order} onDelete={setDeleteTarget} onClone={(value) => cloneMutation.mutate(value.id)} /></td></tr>; })}{!content.length && <tr><td colSpan="8" className="px-4 py-16 text-center"><ShoppingCart className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-black text-[#06134a]">No purchase orders found</p><p className="mt-1 text-sm font-semibold text-slate-500">Adjust the filters or create your first purchase order.</p></td></tr>}</tbody></table></div>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold text-slate-600">Showing {listQuery.data?.numberOfElements || 0} of {listQuery.data?.totalElements || 0} purchase orders</p><div className="flex items-center gap-2"><select aria-label="Rows per page" value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} className="h-9 rounded-lg border border-slate-200 px-2 text-sm font-bold">{PAGE_SIZES.map((value) => <option key={value} value={value}>{value} / page</option>)}</select><button disabled={page === 0} onClick={() => setPage((value) => value - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="grid h-9 min-w-9 place-items-center rounded-lg bg-red-600 px-2 font-black text-white">{page + 1}</span><button disabled={page + 1 >= (listQuery.data?.totalPages || 1)} onClick={() => setPage((value) => value + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
    </section>}
    <ConfirmDialog open={Boolean(deleteTarget)} title="Delete purchase order?" message={`Delete '${deleteTarget?.purchaseOrderNumber || ''}'? Only draft purchase orders can be deleted and this action cannot be undone.`} loading={removeMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeMutation.mutate(deleteTarget.id)} />
  </div>;
}

function Field({ label, required, error, hint, children, className = '' }) {
  return <label className={`block min-w-0 ${className}`}><span className="mb-1.5 block text-xs font-black text-[#06134a]">{label}{required && <b className="ml-1 text-red-600">*</b>}</span>{children}{hint && <small className="mt-1 block text-xs font-semibold text-slate-500">{hint}</small>}{error && <small className="mt-1 block text-xs font-bold text-red-600">{error}</small>}</label>;
}

function Input({ label, value, onChange, required, error, hint, type = 'text', placeholder, disabled, min, step, className }) {
  return <Field label={label} required={required} error={error} hint={hint} className={className}><input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} min={min} step={step} className={`h-10 w-full rounded-lg border bg-white px-3 text-sm font-semibold outline-none focus:ring-4 disabled:bg-slate-50 ${error ? 'border-red-400 focus:ring-red-50' : 'border-slate-200 focus:border-blue-300 focus:ring-blue-50'}`} /></Field>;
}

function Select({ label, value, onChange, options, required, error, placeholder, disabled, className }) {
  return <Field label={label} required={required} error={error} className={className}><div className="relative"><select value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={`h-10 w-full appearance-none rounded-lg border bg-white py-0 pl-3 pr-10 text-sm font-semibold text-[#06134a] outline-none focus:ring-4 disabled:bg-slate-50 ${error ? 'border-red-400 focus:ring-red-50' : 'border-slate-200 focus:border-blue-300 focus:ring-blue-50'}`}><option value="">{placeholder || `Select ${label.toLowerCase()}`}</option>{options.map((option) => { const item = typeof option === 'string' ? { value: option, label: titleize(option) } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div></Field>;
}

function SearchPicker({ label, value, onChange, options, required, error, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((option) => String(option.value) === String(value));
  const matches = options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase())).slice(0, 40);
  useEffect(() => { if (!open) setSearch(selected?.label || ''); }, [open, selected?.label]);
  return <Field label={label} required={required} error={error}><div className="relative"><input disabled={disabled} value={open ? search : (selected?.label || '')} placeholder={placeholder} onFocus={() => { setSearch(selected?.label || ''); setOpen(true); }} onChange={(event) => { setSearch(event.target.value); setOpen(true); }} onBlur={() => window.setTimeout(() => setOpen(false), 150)} className={`h-10 w-full rounded-lg border bg-white py-0 pl-3 pr-10 text-sm font-semibold outline-none disabled:bg-slate-50 ${error ? 'border-red-400' : 'border-slate-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-50'}`} /><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />{open && !disabled && <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">{matches.map((option) => <button key={option.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.value); setSearch(option.label); setOpen(false); }} className={`block w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 ${String(option.value) === String(value) ? 'bg-red-50 text-red-700' : 'text-[#06134a]'}`}>{option.label}{option.helper && <small className="mt-0.5 block text-xs text-slate-500">{option.helper}</small>}</button>)}{!matches.length && <p className="px-3 py-5 text-center text-xs font-bold text-slate-500">No matching records</p>}</div>}</div></Field>;
}

function Radio({ label, value, onChange, options }) {
  return <Field label={label}><div className="flex min-h-10 flex-wrap items-center gap-5">{options.map((option) => { const checked = value === option.value; return <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#06134a]"><input type="radio" name={label} checked={checked} onChange={() => onChange(option.value)} className="sr-only" /><span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full ${checked ? 'bg-red-600 shadow-[0_0_0_3px_rgba(254,226,226,1)]' : 'bg-slate-200'}`} />{option.label}</label>; })}</div></Field>;
}

function FormSection({ title, icon: Icon, children, actions }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-black text-[#06134a]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600"><Icon className="h-4 w-4" /></span>{title}</h2>{actions}</div>{children}</section>;
}

function addressLines(address) {
  return [address?.attention, address?.addressLine1, address?.addressLine2, [address?.city, address?.state, address?.postalCode].filter(Boolean).join(', '), address?.country, address?.gstin ? `GSTIN: ${address.gstin}` : '', address?.phone, address?.email].filter(Boolean);
}

function AddressFields({ title, value, onChange, states, compact = false, actions }) {
  const set = (field, fieldValue) => onChange({ ...value, [field]: fieldValue });
  const selectState = (code) => { const state = states.find((item) => item.code === code); onChange({ ...value, stateCode: code, state: state?.name || '' }); };
  return <section className="min-w-0"><div className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2"><h3 className="flex items-center gap-2 text-sm font-black text-[#06134a]"><MapPin className="h-4 w-4 text-red-600" />{title}</h3>{actions}</div><div className={compact ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4'}><Input label="Attention" value={value.attention} onChange={(v) => set('attention', v)} /><Input label="Address Line 1" value={value.addressLine1} onChange={(v) => set('addressLine1', v)} /><Input label="Address Line 2" value={value.addressLine2} onChange={(v) => set('addressLine2', v)} /><Input label="City" value={value.city} onChange={(v) => set('city', v)} /><Select label="State" value={value.stateCode} onChange={selectState} options={states.map((item) => ({ value: item.code, label: `${item.name} (${item.code})` }))} /><Input label="Country" value={value.country} onChange={(v) => set('country', v)} /><Input label="PIN / ZIP" value={value.postalCode} onChange={(v) => set('postalCode', v)} /><Input label="GSTIN" value={value.gstin} onChange={(v) => set('gstin', v.toUpperCase())} /><Input label="Phone" value={value.phone} onChange={(v) => set('phone', v)} /><Input label="Email" type="email" value={value.email} onChange={(v) => set('email', v)} /></div></section>;
}

function stateCode(value, states) {
  if (!value) return '';
  if (states.some((state) => state.code === String(value))) return String(value);
  const match = String(value).match(/\b(\d{2})\b/);
  if (match) return match[1];
  return states.find((state) => String(value).toLowerCase().includes(state.name.toLowerCase()))?.code || '';
}

function vendorTreatment(vendor) {
  const raw = String(vendor?.gstTreatment || '').toUpperCase().replaceAll(' ', '_').replaceAll('-', '_');
  if (raw.includes('REGULAR')) return 'REGISTERED_BUSINESS_REGULAR';
  if (raw.includes('COMPOSITION')) return 'REGISTERED_BUSINESS_COMPOSITION';
  if (raw.includes('OVERSEAS')) return 'OVERSEAS';
  if (raw.includes('SEZ')) return 'SPECIAL_ECONOMIC_ZONE';
  return vendor?.gstin ? 'REGISTERED_BUSINESS_REGULAR' : 'UNREGISTERED_BUSINESS';
}

function normalizeAddress(address) { return { ...EMPTY_ADDRESS, ...(address || {}) }; }

function normalizeItem(item) {
  return { key: crypto.randomUUID(), id: item.id, itemId: String(item.itemId || ''), description: item.description || '', quantity: String(item.quantity ?? 1), unit: item.unit || '', rate: String(item.rate ?? 0), discountType: item.discountType || 'NONE', discountValue: String(item.discountValue ?? 0), taxId: item.taxId ? String(item.taxId) : '', hsnCode: item.hsnCode || '', sacCode: item.sacCode || '', accountName: item.accountName || '', warehouseName: item.warehouseName || '', projectName: item.projectName || '', itemName: item.itemName, itemSku: item.itemSku, receivedQuantity: item.receivedQuantity || 0, billedQuantity: item.billedQuantity || 0 };
}

function normalizeOrder(order) {
  return { ...EMPTY_FORM, ...order, vendorId: String(order.vendorId || ''), exchangeRate: String(order.exchangeRate ?? 1), shippingCharge: String(order.shippingCharge ?? 0), adjustmentAmount: String(order.adjustmentAmount ?? 0), vendorAddress: normalizeAddress(order.vendorAddress), deliveryAddress: normalizeAddress(order.deliveryAddress), items: order.items?.map(normalizeItem) || [{ ...EMPTY_ITEM, key: crypto.randomUUID() }] };
}

function previewLine(item, taxes, amountType, gstTreatment, source, destination) {
  const quantity = Math.max(Number(item.quantity || 0), 0);
  const rate = Math.max(Number(item.rate || 0), 0);
  const gross = quantity * rate;
  const discountValue = Math.max(Number(item.discountValue || 0), 0);
  const discount = item.discountType === 'PERCENTAGE' ? gross * Math.min(discountValue, 100) / 100 : item.discountType === 'FLAT_AMOUNT' ? Math.min(discountValue, gross) : 0;
  const entered = Math.max(gross - discount, 0);
  const tax = taxes.find((value) => String(value.id) === String(item.taxId));
  const ratePercent = gstTreatment === 'OVERSEAS' || tax?.category !== 'TAXABLE' ? 0 : Number(tax?.rate || 0);
  const taxable = amountType === 'TAX_INCLUSIVE' && ratePercent ? entered / (1 + ratePercent / 100) : entered;
  const totalTax = amountType === 'TAX_INCLUSIVE' ? entered - taxable : taxable * ratePercent / 100;
  const intra = source && source === destination;
  return { gross, discount, taxable, tax: totalTax, cgst: intra ? totalTax / 2 : 0, sgst: intra ? totalTax / 2 : 0, igst: intra ? 0 : totalTax, total: amountType === 'TAX_INCLUSIVE' ? entered : entered + totalTax };
}

function formTotals(form, taxes) {
  const lines = form.items.map((item) => previewLine(item, taxes, form.amountType, form.gstTreatment, form.sourceOfSupplyCode, form.destinationOfSupplyCode));
  const sum = (field) => lines.reduce((total, line) => total + line[field], 0);
  const shipping = Number(form.shippingCharge || 0); const adjustment = Number(form.adjustmentAmount || 0);
  return { subtotal: sum('gross'), discount: sum('discount'), taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), igst: sum('igst'), tax: sum('tax'), total: sum('total') + shipping + adjustment, lines };
}

function LineItems({ form, setForm, filters, errors }) {
  const updateLine = (index, field, value) => setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const selectItem = (index, id) => { const master = filters.items?.find((item) => String(item.id) === String(id)); setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, itemId: String(id), description: master?.description || master?.name || '', unit: master?.unit || 'Nos', rate: String(master?.purchaseRate ?? 0), taxId: master?.taxId ? String(master.taxId) : '', hsnCode: master?.hsnCode || '', sacCode: master?.sacCode || '', accountName: master?.accountName || 'Purchases', itemName: master?.name, itemSku: master?.sku } : item) })); };
  const add = () => setForm((current) => ({ ...current, items: [...current.items, { ...EMPTY_ITEM, key: crypto.randomUUID() }] }));
  const remove = (index) => setForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index) }));
  const itemOptions = (filters.items || []).map((item) => ({ value: String(item.id), label: item.name, helper: [item.sku, item.itemType, money(item.purchaseRate)].filter(Boolean).join(' · ') }));
  const taxOptions = (filters.taxes || []).map((tax) => ({ value: String(tax.id), label: `${tax.name} (${Number(tax.rate || 0)}%)` }));
  const totals = formTotals(form, filters.taxes || []);
  return <FormSection title="Items" icon={Package} actions={<Button icon={Plus} onClick={add}>Add Item</Button>}><div className="overflow-x-auto"><table className="w-full min-w-[1180px] table-fixed"><thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-600"><tr><th className="w-10 px-2 py-3">#</th><th className="w-56 px-2 py-3">Item</th><th className="w-56 px-2 py-3">Description</th><th className="w-24 px-2 py-3">HSN/SAC</th><th className="w-20 px-2 py-3">Qty</th><th className="w-20 px-2 py-3">Unit</th><th className="w-28 px-2 py-3">Rate</th><th className="w-32 px-2 py-3">Discount</th><th className="w-36 px-2 py-3">Tax</th><th className="w-28 px-2 py-3 text-right">Amount</th><th className="w-10" /></tr></thead><tbody className="divide-y divide-slate-100">{form.items.map((item, index) => <tr key={item.key}><td className="px-2 py-3 text-sm font-black text-[#06134a]">{index + 1}</td><td className="px-2 py-3"><SearchPicker label="" value={item.itemId} onChange={(value) => selectItem(index, value)} options={itemOptions} error={errors[`item_${index}`]} placeholder="Search or select item" /></td><td className="px-2 py-3"><input value={item.description} onChange={(event) => updateLine(index, 'description', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></td><td className="px-2 py-3"><input value={item.hsnCode || item.sacCode} onChange={(event) => updateLine(index, item.sacCode ? 'sacCode' : 'hsnCode', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm" /></td><td className="px-2 py-3"><input type="number" min="0.0001" step="0.01" value={item.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm" /></td><td className="px-2 py-3"><input value={item.unit} onChange={(event) => updateLine(index, 'unit', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm" /></td><td className="px-2 py-3"><input type="number" min="0" step="0.01" value={item.rate} onChange={(event) => updateLine(index, 'rate', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm" /></td><td className="px-2 py-3"><div className="flex"><select value={item.discountType} onChange={(event) => updateLine(index, 'discountType', event.target.value)} className="h-10 w-[55px] rounded-l-lg border border-r-0 border-slate-200 bg-white px-1 text-xs"><option value="NONE">-</option><option value="PERCENTAGE">%</option><option value="FLAT_AMOUNT">₹</option></select><input disabled={item.discountType === 'NONE'} type="number" min="0" value={item.discountValue} onChange={(event) => updateLine(index, 'discountValue', event.target.value)} className="h-10 min-w-0 flex-1 rounded-r-lg border border-slate-200 px-2 text-sm disabled:bg-slate-50" /></div></td><td className="px-2 py-3"><select value={item.taxId} onChange={(event) => updateLine(index, 'taxId', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold"><option value="">Non-Taxable</option>{taxOptions.map((tax) => <option key={tax.value} value={tax.value}>{tax.label}</option>)}</select></td><td className="px-2 py-3 text-right text-sm font-black text-[#06134a]">{money(totals.lines[index]?.total, form.currencyCode)}</td><td><button type="button" aria-label="Remove item" onClick={() => remove(index)} disabled={form.items.length === 1} className="grid h-9 w-9 place-items-center text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>{errors.items && <p className="mt-2 text-xs font-bold text-red-600">{errors.items}</p>}</FormSection>;
}

function payload(form) {
  const cleanAddress = (address) => Object.fromEntries(Object.entries(address || {}).map(([key, value]) => [key, value || null]));
  return { ...form, vendorId: Number(form.vendorId), exchangeRate: Number(form.exchangeRate || 1), shippingCharge: Number(form.shippingCharge || 0), adjustmentAmount: Number(form.adjustmentAmount || 0), expectedDeliveryDate: form.expectedDeliveryDate || null, placeOfSupplyCode: form.placeOfSupplyCode || form.destinationOfSupplyCode, vendorAddress: cleanAddress(form.vendorAddress), deliveryAddress: cleanAddress(form.deliveryAddress), items: form.items.map(({ key, id, itemName, itemSku, receivedQuantity, billedQuantity, ...item }) => ({ ...item, itemId: Number(item.itemId), quantity: Number(item.quantity), rate: Number(item.rate), discountValue: Number(item.discountValue || 0), taxId: item.taxId ? Number(item.taxId) : null })) };
}

export function PurchaseOrderFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_FORM, vendorAddress: { ...EMPTY_ADDRESS }, deliveryAddress: { ...EMPTY_ADDRESS }, items: [{ ...EMPTY_ITEM, key: crypto.randomUUID() }] });
  const [loadedId, setLoadedId] = useState(null);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(location.state?.message || '');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const filtersQuery = useQuery({ queryKey: ['purchase-order-filters'], queryFn: purchaseOrdersApi.filters });
  const orderQuery = useQuery({ queryKey: ['purchase-order', id], queryFn: () => purchaseOrdersApi.get(id), enabled: editing });
  const filters = filtersQuery.data || { vendors: [], items: [], taxes: [], states: [], gstTreatments: [] };
  useEffect(() => { if (editing && orderQuery.data && orderQuery.data.id !== loadedId) { setLoadedId(orderQuery.data.id); setForm(normalizeOrder(orderQuery.data)); } }, [editing, loadedId, orderQuery.data]);
  useEffect(() => { if (!editing && filters.organizationStateCode && !form.destinationOfSupplyCode) setForm((current) => ({ ...current, destinationOfSupplyCode: filters.organizationStateCode, placeOfSupplyCode: filters.organizationStateCode, deliveryAddress: { ...current.deliveryAddress, stateCode: filters.organizationStateCode, state: filters.organizationStateName || '', country: filters.organizationCountry || 'India' } })); }, [editing, filters.organizationCountry, filters.organizationStateCode, filters.organizationStateName, form.destinationOfSupplyCode]);
  const update = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: '' })); };
  const selectVendor = (value) => { const vendor = filters.vendors?.find((item) => String(item.id) === String(value)); const source = stateCode(vendor?.sourceOfSupply || vendor?.address?.stateCode || vendor?.address?.state, filters.states || []); setForm((current) => ({ ...current, vendorId: String(value), vendorAddress: normalizeAddress(vendor?.address), gstTreatment: vendorTreatment(vendor), sourceOfSupplyCode: source, currencyCode: String(vendor?.currency || 'INR').split(' ')[0], paymentTerms: vendor?.paymentTerms || current.paymentTerms, attention: vendor?.contactName || '', taxId: '' })); setErrors((current) => ({ ...current, vendorId: '', sourceOfSupplyCode: '' })); };
  const uploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!supportedTypes.includes(file.type)) {
      setUploadError('Only PDF, PNG, JPG, DOC, DOCX, XLS, and XLSX attachments are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Attachment size must be 10 MB or less.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const uploaded = await storageApi.uploadPurchaseOrderAttachment(file);
      setForm((current) => ({ ...current, attachmentName: uploaded.originalName || file.name, attachmentUrl: uploaded.url }));
    } catch (error) {
      setUploadError(errorText(error, 'Unable to upload the attachment.'));
    } finally {
      setUploading(false);
    }
  };
  const validate = () => { const next = {}; if (!form.purchaseOrderDate) next.purchaseOrderDate = 'Purchase Order date is required.'; if (form.expectedDeliveryDate && form.purchaseOrderDate && form.expectedDeliveryDate < form.purchaseOrderDate) next.expectedDeliveryDate = 'Expected Delivery Date cannot be before the Purchase Order Date.'; if (!form.vendorId) next.vendorId = 'Vendor is required.'; if (!form.currencyCode) next.currencyCode = 'Currency is required.'; if (!form.gstTreatment) next.gstTreatment = 'GST treatment is required.'; if (!form.sourceOfSupplyCode) next.sourceOfSupplyCode = 'Source of Supply is required.'; if (!form.destinationOfSupplyCode) next.destinationOfSupplyCode = 'Destination of Supply is required.'; if (!form.items.length) next.items = 'At least one item is required.'; form.items.forEach((item, index) => { if (!item.itemId) next[`item_${index}`] = 'Select an item.'; if (!(Number(item.quantity) > 0)) next.items = 'Every item quantity must be greater than zero.'; if (Number(item.rate) < 0) next.items = 'Item rates cannot be negative.'; }); setErrors(next); return !Object.keys(next).length; };
  const saveMutation = useMutation({ mutationFn: async ({ action }) => { if (!validate()) throw new Error('VALIDATION'); const body = payload(form); if (!editing) return purchaseOrdersApi.create(body, action); const updated = await purchaseOrdersApi.update(id, body); if (action === 'issue' && updated.status === 'DRAFT') return purchaseOrdersApi.issue(id); if (action === 'send') return purchaseOrdersApi.sendEmail(id, { to: updated.vendorEmail, cc: '', bcc: '', subject: `Purchase Order ${updated.purchaseOrderNumber}`, message: `Please find Purchase Order ${updated.purchaseOrderNumber} attached.`, attachPdf: true }); return updated; }, onSuccess: (order, variables) => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); queryClient.invalidateQueries({ queryKey: ['purchase-order-summary'] }); const message = variables.action === 'send' ? 'Purchase order saved and email queued successfully.' : editing ? 'Purchase order updated successfully.' : 'Purchase order created successfully.'; navigate(`/purchases/orders/${order.id}`, { replace: true, state: { message } }); } });
  const totals = useMemo(() => formTotals(form, filters.taxes || []), [filters.taxes, form]);
  const vendorOptions = (filters.vendors || []).map((vendor) => ({ value: String(vendor.id), label: vendor.displayName || vendor.name, helper: [vendor.vendorNumber, vendor.gstin, vendor.sourceOfSupply].filter(Boolean).join(' · ') }));
  const stateOptions = (filters.states || []).map((state) => ({ value: state.code, label: `${state.name} (${state.code})` }));
  if (filtersQuery.isLoading || (editing && orderQuery.isLoading)) return <Loading label="Loading purchase order form..." />;
  return <form className="space-y-4 overflow-x-hidden" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate({ action: 'draft' }); }}>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><Link to={editing ? `/purchases/orders/${id}` : '/purchases/orders'} className="mb-2 inline-flex items-center gap-1 text-xs font-black text-blue-600"><ArrowLeft className="h-3.5 w-3.5" />Back to Purchase Orders</Link><h1 className="text-2xl font-black text-[#06134a]">{editing ? `Edit ${orderQuery.data?.purchaseOrderNumber || 'Purchase Order'}` : 'Create Purchase Order'}</h1><p className="mt-1 text-sm font-semibold text-slate-600">Create a vendor commitment with server-validated items, discounts, and GST.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => navigate(editing ? `/purchases/orders/${id}` : '/purchases/orders')}>Cancel</Button><Button disabled={saveMutation.isPending || uploading} type="submit">Save Draft</Button><Button disabled={saveMutation.isPending || uploading} icon={Check} onClick={() => saveMutation.mutate({ action: 'issue' })}>Save & Issue</Button><Button disabled={saveMutation.isPending || uploading || !(form.vendorAddress?.email || filters.vendors?.find((v) => String(v.id) === String(form.vendorId))?.email)} icon={Send} primary onClick={() => saveMutation.mutate({ action: 'send' })}>Save & Send</Button></div></div>
    {notice && <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>}{saveMutation.error && saveMutation.error.message !== 'VALIDATION' && <Alert>{errorText(saveMutation.error, 'Unable to save purchase order.')}</Alert>}
    <FormSection title="Vendor & Purchase Details" icon={UserRound}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SearchPicker label="Vendor" required value={form.vendorId} onChange={selectVendor} options={vendorOptions} error={errors.vendorId} placeholder="Search active vendors" /><Input label="Purchase Order Date" type="date" required value={form.purchaseOrderDate} onChange={(v) => update('purchaseOrderDate', v)} error={errors.purchaseOrderDate} /><Input label="Expected Delivery Date" type="date" min={form.purchaseOrderDate || undefined} value={form.expectedDeliveryDate} onChange={(v) => update('expectedDeliveryDate', v)} error={errors.expectedDeliveryDate} /><Input label="Reference Number" value={form.referenceNumber} onChange={(v) => update('referenceNumber', v)} placeholder="Vendor quotation or reference" /><Input label="Payment Terms" value={form.paymentTerms} onChange={(v) => update('paymentTerms', v)} /><Input label="Shipment Preference" value={form.shipmentPreference} onChange={(v) => update('shipmentPreference', v)} /><Input label="Currency" required value={form.currencyCode} onChange={(v) => update('currencyCode', v.toUpperCase())} error={errors.currencyCode} /><Input label="Exchange Rate" required type="number" min="0.000001" step="0.000001" value={form.exchangeRate} onChange={(v) => update('exchangeRate', v)} /><Select label="GST Treatment" required value={form.gstTreatment} onChange={(v) => update('gstTreatment', v)} error={errors.gstTreatment} options={(filters.gstTreatments || []).map((value) => ({ value, label: titleize(value) }))} /><Select label="Source of Supply" required value={form.sourceOfSupplyCode} onChange={(v) => update('sourceOfSupplyCode', v)} error={errors.sourceOfSupplyCode} options={stateOptions} /><Select label="Destination of Supply" required value={form.destinationOfSupplyCode} onChange={(v) => { update('destinationOfSupplyCode', v); update('placeOfSupplyCode', v); }} error={errors.destinationOfSupplyCode} options={stateOptions} /><Select label="Place of Supply" value={form.placeOfSupplyCode} onChange={(v) => update('placeOfSupplyCode', v)} options={stateOptions} /><Input label="Project" value={form.projectName} onChange={(v) => update('projectName', v)} /><Input label="Branch" value={form.branchName} onChange={(v) => update('branchName', v)} /><Input label="Warehouse" value={form.warehouseName} onChange={(v) => update('warehouseName', v)} /><Input label="Attention" value={form.attention} onChange={(v) => update('attention', v)} /></div></FormSection>
    <FormSection title="Addresses" icon={MapPin}>
      <div className="mb-5 max-w-sm">
        <Select label="Delivery Address Source" value={form.deliveryAddressSource} onChange={(v) => update('deliveryAddressSource', v)} options={[{ value: 'ORGANIZATION', label: 'Organization Address' }, { value: 'VENDOR', label: 'Vendor Address' }, { value: 'WAREHOUSE', label: 'Warehouse / Other' }]} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">
        <AddressFields title="Vendor Billing Address" value={form.vendorAddress} onChange={(v) => update('vendorAddress', v)} states={filters.states || []} compact />
        <div className="lg:pl-6">
          <AddressFields
            title="Delivery Address"
            value={form.deliveryAddress}
            onChange={(v) => update('deliveryAddress', v)}
            states={filters.states || []}
            compact
            actions={<Button icon={Clone} className="h-9 border-blue-200 bg-blue-50 px-3 text-xs text-blue-700 hover:bg-blue-100" onClick={() => update('deliveryAddress', normalizeAddress(form.vendorAddress))}>Use vendor address</Button>}
          />
        </div>
      </div>
    </FormSection>
    <LineItems form={form} setForm={setForm} filters={filters} errors={errors} />
    <FormSection title="Attachments" icon={Paperclip}><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 text-sm font-black text-blue-700 hover:bg-blue-100 ${uploading ? 'pointer-events-none opacity-60' : ''}`}><Upload className="h-4 w-4" />{uploading ? 'Uploading...' : 'Upload attachment'}<input type="file" accept="application/pdf,image/png,image/jpeg,.doc,.docx,.xls,.xlsx" className="sr-only" disabled={uploading} onChange={uploadAttachment} /></label>{form.attachmentUrl && <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><Paperclip className="h-4 w-4 shrink-0 text-slate-500" /><a className="min-w-0 flex-1 truncate text-sm font-bold text-blue-600 hover:underline" href={form.attachmentUrl} target="_blank" rel="noreferrer">{form.attachmentName || 'Purchase order attachment'}</a><button type="button" aria-label="Remove attachment" onClick={() => setForm((current) => ({ ...current, attachmentName: '', attachmentUrl: '' }))} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-red-600 hover:bg-red-50"><X className="h-4 w-4" /></button></div>}</div><p className="mt-2 text-xs font-semibold text-slate-500">PDF, PNG, JPG, DOC, DOCX, XLS, or XLSX. Maximum file size 10 MB.</p>{uploadError && <p className="mt-2 text-xs font-bold text-red-600">{uploadError}</p>}</FormSection>
    <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]">
      <FormSection title="Terms & Conditions" icon={FileText}>
        <textarea value={form.termsAndConditions} onChange={(event) => update('termsAndConditions', event.target.value)} rows="5" placeholder="Enter purchase terms and conditions" className="min-h-[132px] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
      </FormSection>
      <FormSection title="Notes" icon={ClipboardCheck}>
        <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} rows="5" placeholder="Internal or vendor-facing notes" className="min-h-[132px] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
      </FormSection>
      <FormSection title="Purchase Summary" icon={CircleDollarSign}>
        <Radio label="Amounts are" value={form.amountType} onChange={(v) => update('amountType', v)} options={[{ value: 'TAX_EXCLUSIVE', label: 'Tax Exclusive' }, { value: 'TAX_INCLUSIVE', label: 'Tax Inclusive' }]} />
        <div className="mt-2 space-y-2.5 border-t border-slate-100 pt-3 text-sm">
          <SummaryRow label="Sub Total" value={money(totals.subtotal, form.currencyCode)} />
          {totals.discount > 0 && <SummaryRow label="Discount" value={`(-) ${money(totals.discount, form.currencyCode)}`} danger />}
          <SummaryRow label="Taxable Amount" value={money(totals.taxable, form.currencyCode)} />
          {totals.cgst > 0 && <SummaryRow label="CGST" value={money(totals.cgst, form.currencyCode)} />}
          {totals.sgst > 0 && <SummaryRow label="SGST" value={money(totals.sgst, form.currencyCode)} />}
          {totals.igst > 0 && <SummaryRow label="IGST" value={money(totals.igst, form.currencyCode)} />}
          <CompactMoneyInput label="Shipping Charge" value={form.shippingCharge} onChange={(v) => update('shippingCharge', v)} min="0" currency={form.currencyCode} />
          <CompactMoneyInput label="Adjustment" value={form.adjustmentAmount} onChange={(v) => update('adjustmentAmount', v)} currency={form.currencyCode} />
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-black text-[#06134a]"><span>Total</span><span>{money(totals.total, form.currencyCode)}</span></div>
          <p className="text-xs font-semibold leading-5 text-slate-500">Final totals are recalculated and validated by the backend.</p>
        </div>
      </FormSection>
    </section>
    <div className="flex flex-wrap justify-end gap-2 rounded-lg border border-slate-200 bg-white p-3"><Button onClick={() => navigate(editing ? `/purchases/orders/${id}` : '/purchases/orders')}>Cancel</Button><Button disabled={saveMutation.isPending || uploading} type="submit">Save Draft</Button><Button disabled={saveMutation.isPending || uploading} icon={Check} onClick={() => saveMutation.mutate({ action: 'issue' })}>Save & Issue</Button></div>
  </form>;
}

function SummaryRow({ label, value, strong, danger }) { return <div className={`flex items-center justify-between gap-4 ${strong ? 'font-black text-[#06134a]' : 'font-semibold text-slate-600'} ${danger ? 'text-red-600' : ''}`}><span>{label}</span><span>{value}</span></div>; }

function CompactMoneyInput({ label, value, onChange, min, currency = 'INR' }) {
  return <label className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-600"><span>{label}</span><span className="relative w-32 shrink-0"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{currency === 'INR' ? '₹' : currency}</span><input type="number" min={min} step="0.01" value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-right text-sm font-bold text-[#06134a] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></span></label>;
}

function Modal({ title, subtitle, children, onClose, footer, size = 'max-w-2xl' }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#06134a]/60 px-4 py-6"><div className={`my-auto w-full ${size} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl`}><header className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-black text-[#06134a]">{title}</h2>{subtitle && <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>}</div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"><X className="h-5 w-5" /></button></header><div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>{footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">{footer}</footer>}</div></div>;
}

function ReceiveModal({ order, onClose, onSave, loading, error }) {
  const [receivedDate, setReceivedDate] = useState(TODAY);
  const [warehouse, setWarehouse] = useState(order.warehouseName || '');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState(Object.fromEntries(order.items.map((item) => [item.id, '0'])));
  const save = () => onSave({ receivedDate, warehouse: warehouse || null, notes: notes || null, items: order.items.map((item) => ({ purchaseOrderItemId: item.id, receivedQuantity: Number(quantities[item.id] || 0) })).filter((item) => item.receivedQuantity > 0) });
  return <Modal title="Receive Items" subtitle={`Record goods or services received against ${order.purchaseOrderNumber}.`} onClose={onClose} size="max-w-3xl" footer={<><Button onClick={onClose}>Cancel</Button><Button icon={PackageCheck} primary disabled={loading} onClick={save}>Save Receipt</Button></>}>
    {error && <Alert>{errorText(error)}</Alert>}<div className="mb-4 grid gap-3 sm:grid-cols-2"><Input label="Received Date" type="date" required value={receivedDate} onChange={setReceivedDate} /><Input label="Warehouse" value={warehouse} onChange={setWarehouse} placeholder="Warehouse or location" /></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-3 py-3">Item</th><th className="px-3 py-3 text-right">Ordered</th><th className="px-3 py-3 text-right">Already Received</th><th className="px-3 py-3 text-right">Remaining</th><th className="px-3 py-3">Receive Now</th></tr></thead><tbody className="divide-y divide-slate-100">{order.items.map((item) => { const remaining = Math.max(Number(item.quantity) - Number(item.receivedQuantity), 0); return <tr key={item.id}><td className="px-3 py-3 font-black text-[#06134a]">{item.itemName}<small className="block font-semibold text-slate-500">{item.itemSku || item.unit}</small></td><td className="px-3 py-3 text-right">{item.quantity}</td><td className="px-3 py-3 text-right">{item.receivedQuantity}</td><td className="px-3 py-3 text-right font-black">{remaining}</td><td className="px-3 py-3"><input type="number" min="0" max={remaining} step="0.01" value={quantities[item.id]} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} className="h-9 w-28 rounded-lg border border-slate-200 px-2" /></td></tr>; })}</tbody></table></div><label className="mt-4 block text-xs font-black text-[#06134a]">Receipt Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="3" className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-medium" /></label>
  </Modal>;
}

function EmailModal({ order, onClose, onSave, loading, error }) {
  const [form, setForm] = useState({ to: order.vendorEmail || order.vendorAddress?.email || '', cc: '', bcc: '', subject: `Purchase Order ${order.purchaseOrderNumber}`, message: `Hello ${order.vendorName},\n\nPlease find Purchase Order ${order.purchaseOrderNumber} attached.\n\nRegards,\nIntelliaTech`, attachPdf: true });
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return <Modal title="Email Purchase Order" subtitle="The latest purchase-order PDF will be attached." onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button icon={Send} primary disabled={loading} onClick={() => onSave(form)}>Send Email</Button></>}>
    {error && <Alert>{errorText(error)}</Alert>}<div className="grid gap-3 sm:grid-cols-2"><Input label="To" type="email" required value={form.to} onChange={(v) => set('to', v)} /><Input label="CC" type="email" value={form.cc} onChange={(v) => set('cc', v)} /><Input label="BCC" type="email" value={form.bcc} onChange={(v) => set('bcc', v)} /><Input label="Subject" required value={form.subject} onChange={(v) => set('subject', v)} className="sm:col-span-2" /></div><label className="mt-3 block text-xs font-black text-[#06134a]">Message<textarea value={form.message} onChange={(event) => set('message', event.target.value)} rows="7" className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-medium" /></label><label className="mt-3 flex items-center gap-2 text-sm font-bold text-[#06134a]"><input type="checkbox" checked={form.attachPdf} onChange={(event) => set('attachPdf', event.target.checked)} className="h-4 w-4 accent-red-600" />Attach PDF</label>
  </Modal>;
}

function InfoCell({ label, value, children }) { return <div className="min-w-0"><p className="text-[11px] font-black uppercase text-slate-500">{label}</p>{children || <p className="mt-1 break-words text-sm font-black text-[#06134a]">{value || '-'}</p>}</div>; }

function DetailsCard({ title, icon: Icon, children, actions }) { return <section className="rounded-lg border border-slate-200 bg-white shadow-sm"><header className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-black text-[#06134a]"><Icon className="h-4 w-4 text-red-600" />{title}</h2>{actions}</header><div className="p-4">{children}</div></section>; }

function parseObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function purchaseOrderCompany(record, filters = {}) {
  const notes = parseObject(record?.notes);
  return {
    name: record?.partyName || 'IntelliaTech Pvt. Ltd.',
    address: notes.address || record?.partyCity || '',
    state: notes.state || filters.organizationStateName || '',
    country: notes.country || filters.organizationCountry || 'India',
    gstin: record?.referenceNumber || '',
    email: record?.partyEmail || '',
    phone: record?.partyPhone || '',
  };
}

function PurchaseOrderDocument({ order, company }) {
  const vendorAddress = addressLines(order.vendorAddress);
  const deliveryAddress = addressLines(order.deliveryAddress);
  return <div className="w-full pb-2"><article className="relative mx-auto min-h-[900px] w-full max-w-[940px] overflow-hidden bg-white p-4 font-serif text-[12px] leading-relaxed text-slate-950 shadow-xl ring-1 ring-slate-200 sm:p-6 sm:text-[14px] lg:p-8">
    <div className={`absolute -left-11 top-7 z-10 w-40 -rotate-45 py-1.5 text-center font-sans text-[11px] font-black uppercase tracking-wide text-white ${order.status === 'CANCELLED' ? 'bg-red-500' : order.status === 'DRAFT' ? 'bg-slate-500' : 'bg-emerald-500'}`}>{titleize(order.status)}</div>
    <header className="grid items-center gap-6 border-b-2 border-slate-900 pb-6 md:grid-cols-[minmax(0,1fr)_220px]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:pl-6">
        <img src={intelliaTechLogo} alt="IntelliaTech" className="h-auto w-[190px] shrink-0 object-contain" />
        <div className="min-w-0 text-left"><h2 className="text-lg font-bold sm:text-xl">{company.name}</h2>{company.address && <p>{company.address}</p>}{company.state && <p>{company.state}</p>}{company.country && <p>{company.country}</p>}{company.gstin && <p>GSTIN {company.gstin}</p>}{company.phone && <p>{company.phone}</p>}{company.email && <p className="break-all">{company.email}</p>}</div>
      </div>
      <h1 className="text-left text-2xl font-bold tracking-wide md:text-right md:text-3xl">PURCHASE<br />ORDER</h1>
    </header>

    <div className="mt-5 grid border border-slate-400 md:grid-cols-2">
      <dl className="grid grid-cols-[112px_1fr] gap-x-2 gap-y-1 border-b border-slate-400 p-3 sm:grid-cols-[150px_1fr] md:border-b-0 md:border-r"><dt className="font-bold">Purchase Order #</dt><dd>: {order.purchaseOrderNumber}</dd><dt className="font-bold">Purchase Order Date</dt><dd>: {dateText(order.purchaseOrderDate)}</dd><dt className="font-bold">Expected Delivery</dt><dd>: {dateText(order.expectedDeliveryDate)}</dd><dt className="font-bold">Reference</dt><dd>: {order.referenceNumber || ''}</dd></dl>
      <dl className="grid grid-cols-[112px_1fr] gap-x-2 gap-y-1 p-3 sm:grid-cols-[140px_1fr]"><dt className="font-bold">Place of Supply</dt><dd>: {order.placeOfSupplyName || order.destinationOfSupplyName || ''}</dd><dt className="font-bold">Payment Terms</dt><dd>: {order.paymentTerms || ''}</dd><dt className="font-bold">Shipment</dt><dd>: {order.shipmentPreference || ''}</dd><dt className="font-bold">Currency</dt><dd>: {order.currencyCode || 'INR'}</dd></dl>
    </div>

    <div className="grid border-x border-b border-slate-400 md:grid-cols-2">
      <section className="min-h-40 border-b border-slate-400 md:border-b-0 md:border-r"><h3 className="border-b border-slate-400 bg-slate-100 px-3 py-1.5 font-bold">Vendor</h3><div className="p-3"><p className="font-bold text-blue-700">{order.vendorName}</p>{vendorAddress.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div></section>
      <section className="min-h-40"><h3 className="border-b border-slate-400 bg-slate-100 px-3 py-1.5 font-bold">Deliver To</h3><div className="p-3">{deliveryAddress.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div></section>
    </div>

    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] border-collapse border border-slate-400 text-left"><thead className="bg-slate-100"><tr><th className="w-10 border border-slate-400 px-2 py-2 text-center">#</th><th className="border border-slate-400 px-2 py-2">Item & Description</th><th className="w-24 border border-slate-400 px-2 py-2">HSN/SAC</th><th className="w-20 border border-slate-400 px-2 py-2 text-right">Qty</th><th className="w-24 border border-slate-400 px-2 py-2 text-right">Rate</th><th className="w-24 border border-slate-400 px-2 py-2 text-right">Tax</th><th className="w-28 border border-slate-400 px-2 py-2 text-right">Amount</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={item.id || index}><td className="border border-slate-400 px-2 py-2 text-center align-top">{index + 1}</td><td className="border border-slate-400 px-2 py-2 align-top"><p className="font-bold">{item.itemName}</p>{item.description && <p className="mt-1 text-slate-700">{item.description}</p>}</td><td className="border border-slate-400 px-2 py-2 align-top">{item.hsnCode || item.sacCode || ''}</td><td className="border border-slate-400 px-2 py-2 text-right align-top">{item.quantity} {item.unit}</td><td className="border border-slate-400 px-2 py-2 text-right align-top">{money(item.rate, order.currencyCode)}</td><td className="border border-slate-400 px-2 py-2 text-right align-top">{item.taxName ? `${Number(item.taxRate || 0)}%` : '-'}</td><td className="border border-slate-400 px-2 py-2 text-right align-top font-bold">{money(item.lineTotal, order.currencyCode)}</td></tr>)}</tbody></table></div>

    <div className="grid border-x border-b border-slate-400 md:grid-cols-[minmax(0,1fr)_340px]"><section className="min-h-56 border-b border-slate-400 p-3 md:border-b-0 md:border-r"><h3 className="font-bold">Terms & Conditions</h3><p className="mt-2 whitespace-pre-wrap">{order.termsAndConditions || ''}</p>{order.notes && <><h3 className="mt-6 font-bold">Notes</h3><p className="mt-2 whitespace-pre-wrap">{order.notes}</p></>}</section><section className="p-3"><div className="space-y-2"><SummaryRow label="Sub Total" value={money(order.subtotal, order.currencyCode)} />{Number(order.discountAmount) > 0 && <SummaryRow label="Discount" value={`(-) ${money(order.discountAmount, order.currencyCode)}`} danger />}{Number(order.cgstAmount) > 0 && <SummaryRow label="CGST" value={money(order.cgstAmount, order.currencyCode)} />}{Number(order.sgstAmount) > 0 && <SummaryRow label="SGST" value={money(order.sgstAmount, order.currencyCode)} />}{Number(order.igstAmount) > 0 && <SummaryRow label="IGST" value={money(order.igstAmount, order.currencyCode)} />}{Number(order.cessAmount) > 0 && <SummaryRow label="Cess" value={money(order.cessAmount, order.currencyCode)} />}{Number(order.shippingCharge) > 0 && <SummaryRow label="Shipping" value={money(order.shippingCharge, order.currencyCode)} />}{Number(order.adjustmentAmount) !== 0 && <SummaryRow label="Adjustment" value={money(order.adjustmentAmount, order.currencyCode)} />}<div className="border-t border-slate-400 pt-2 text-base"><SummaryRow strong label="Total" value={money(order.totalAmount, order.currencyCode)} /></div></div><div className="mt-20 border-t border-slate-400 pt-2 text-center">Authorized Signature</div></section></div>
  </article></div>;
}

function downloadBlob(blob, filename, print = false) {
  const url = URL.createObjectURL(blob);
  if (print) { const tab = window.open(url, '_blank', 'noopener,noreferrer'); if (tab) window.setTimeout(() => tab.print?.(), 1200); }
  else { const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function PdfPrintMenu({ loading, onDownload, onPrint }) {
  const [open, setOpen] = useState(false);
  return <div className="relative z-50"><button type="button" disabled={loading} onClick={() => setOpen((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold text-[#06134a] transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"><Printer className="h-4 w-4" />PDF / Print<ChevronDown className="h-4 w-4" /></button>{open && <><button type="button" aria-label="Close PDF and print menu" className="fixed inset-0 z-40" onClick={() => setOpen(false)} /><div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 min-w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl"><button type="button" onClick={() => { setOpen(false); onDownload(); }} className="flex w-full items-center gap-2 whitespace-nowrap px-4 py-2.5 text-left font-bold text-[#06134a] hover:bg-slate-50"><Download className="h-4 w-4" />Download PDF</button><button type="button" onClick={() => { setOpen(false); onPrint(); }} className="flex w-full items-center gap-2 whitespace-nowrap px-4 py-2.5 text-left font-bold text-[#06134a] hover:bg-slate-50"><Printer className="h-4 w-4" />Print Purchase Order</button></div></>}</div>;
}

function ViewActionMenu({ order, onDelete, onClone, onConvert, onCancel, onCloseOrder }) {
  const [open, setOpen] = useState(false);
  const actionClass = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#06134a] hover:bg-slate-50';
  return <div className="relative z-50"><button type="button" aria-label="More purchase order actions" onClick={() => setOpen((value) => !value)} className="grid h-9 w-10 place-items-center rounded-lg text-[#06134a] transition hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button>{open && <><button type="button" aria-label="Close purchase order actions" className="fixed inset-0 z-40" onClick={() => setOpen(false)} /><div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"><button onClick={() => { setOpen(false); onClone(); }} className={actionClass}><Clone className="h-4 w-4" />Clone Purchase Order</button>{order.availableActions?.includes('CONVERT_TO_BILL') && <button onClick={() => { setOpen(false); onConvert(); }} className={actionClass}><ReceiptText className="h-4 w-4" />Convert to Bill</button>}{order.availableActions?.includes('CLOSE') && <button onClick={() => { setOpen(false); onCloseOrder(); }} className={actionClass}><Check className="h-4 w-4" />Close Purchase Order</button>}{order.availableActions?.includes('CANCEL') && <button onClick={() => { setOpen(false); onCancel(); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-amber-700 hover:bg-amber-50"><X className="h-4 w-4" />Cancel Purchase Order</button>}{order.availableActions?.includes('DELETE') && <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" />Delete</button>}</div></>}</div>;
}

export function PurchaseOrderViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState(location.state?.message || '');
  const [confirm, setConfirm] = useState('');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const orderQuery = useQuery({ queryKey: ['purchase-order', id], queryFn: () => purchaseOrdersApi.get(id) });
  const viewerListQuery = useQuery({ queryKey: ['purchase-orders', 'viewer-list'], queryFn: () => purchaseOrdersApi.list({ page: 0, size: 50, sort: 'purchaseOrderDate,desc' }) });
  const filtersQuery = useQuery({ queryKey: ['purchase-order-filters'], queryFn: purchaseOrdersApi.filters, staleTime: 60_000 });
  const organizationQuery = useQuery({ queryKey: ['records', 'settings', 'organization', 'purchase-order-view'], queryFn: () => recordsApi.list({ module: 'settings', type: 'organization', page: 0, size: 1, sort: 'recordDate,desc' }), staleTime: 60_000 });
  const refresh = (message) => { setNotice(message); queryClient.invalidateQueries({ queryKey: ['purchase-order', id] }); queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); queryClient.invalidateQueries({ queryKey: ['purchase-order-summary'] }); };
  const issueMutation = useMutation({ mutationFn: () => purchaseOrdersApi.issue(id), onSuccess: () => refresh('Purchase order issued successfully.') });
  const receiveMutation = useMutation({ mutationFn: (body) => purchaseOrdersApi.receive(id, body), onSuccess: () => { setReceiveOpen(false); refresh('Receipt saved and quantities updated.'); } });
  const emailMutation = useMutation({ mutationFn: (body) => purchaseOrdersApi.sendEmail(id, body), onSuccess: () => { setEmailOpen(false); refresh('Purchase order email recorded successfully.'); } });
  const cloneMutation = useMutation({ mutationFn: () => purchaseOrdersApi.clone(id), onSuccess: (order) => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); navigate(`/purchases/orders/${order.id}/edit`, { state: { message: `Cloned as ${order.purchaseOrderNumber}.` } }); } });
  const convertMutation = useMutation({ mutationFn: () => purchaseOrdersApi.convertToBill(id), onSuccess: (order) => { setConfirm(''); refresh(`Bill ${order.linkedBillNumber} created successfully.`); } });
  const cancelMutation = useMutation({ mutationFn: () => purchaseOrdersApi.cancel(id), onSuccess: () => { setConfirm(''); refresh('Purchase order cancelled successfully.'); } });
  const closeMutation = useMutation({ mutationFn: () => purchaseOrdersApi.close(id), onSuccess: () => { setConfirm(''); refresh('Purchase order closed successfully.'); } });
  const deleteMutation = useMutation({ mutationFn: () => purchaseOrdersApi.remove(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); navigate('/purchases/orders', { replace: true, state: { message: 'Purchase order deleted successfully.' } }); } });
  const pdfMutation = useMutation({ mutationFn: () => purchaseOrdersApi.pdf(id), onSuccess: (blob, print) => downloadBlob(blob, `Purchase_Order_${orderQuery.data.purchaseOrderNumber}.pdf`, print === true) });
  if (orderQuery.isLoading) return <Loading label="Loading purchase order..." />;
  if (orderQuery.error) return <Alert>{errorText(orderQuery.error, 'Unable to load purchase order.')}</Alert>;
  const order = orderQuery.data;
  const actionError = issueMutation.error || receiveMutation.error || emailMutation.error || cloneMutation.error || convertMutation.error || cancelMutation.error || closeMutation.error || deleteMutation.error || pdfMutation.error;
  const totalOrdered = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalReceived = order.items.reduce((sum, item) => sum + Number(item.receivedQuantity), 0);
  const receiptPercent = totalOrdered ? Math.min(totalReceived / totalOrdered * 100, 100) : 0;
  const viewerOrders = viewerListQuery.data?.content || [];
  const company = purchaseOrderCompany(organizationQuery.data?.content?.[0], filtersQuery.data);
  const toolbarClass = 'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold text-[#06134a] transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40';
  return <section className="min-h-[calc(100vh-96px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-sm">
    <div className="grid min-h-[calc(100vh-96px)] xl:grid-cols-[350px_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200 bg-white xl:block"><div className="flex h-16 items-center justify-between border-b border-slate-200 px-5"><Link to="/purchases/orders" className="text-sm font-black">All Purchase Orders</Link><div className="flex gap-2"><Link to="/purchases/orders/new" className="grid h-9 w-10 place-items-center rounded-lg bg-red-600 text-white"><Plus className="h-4 w-4" /></Link><button className="grid h-9 w-10 place-items-center rounded-lg border border-slate-200"><MoreVertical className="h-4 w-4" /></button></div></div><div className="max-h-[calc(100vh-160px)] overflow-y-auto">{viewerOrders.map((item) => <Link key={item.id} to={`/purchases/orders/${item.id}`} className={`block border-b border-slate-100 px-5 py-4 hover:bg-blue-50/70 ${Number(item.id) === Number(id) ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''}`}><div className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" readOnly /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="truncate text-sm font-black">{item.vendorName}</p><p className="shrink-0 text-sm font-black">{money(item.totalAmount, item.currencyCode)}</p></div><p className="mt-2 text-xs font-semibold text-slate-500">{item.purchaseOrderNumber} <span className="px-2">•</span> {dateText(item.purchaseOrderDate)}</p><span className={`mt-3 inline-flex rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ring-inset ${STATUS_STYLE[item.status] || STATUS_STYLE.DRAFT}`}>{titleize(item.status)}</span></div></div></Link>)}{!viewerOrders.length && <p className="p-6 text-sm font-semibold text-slate-500">No purchase orders found.</p>}</div></aside>

      <main className="min-w-0 bg-slate-50"><div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5"><div className="flex min-w-0 items-center gap-3 sm:gap-4"><Link to="/purchases/orders" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link><h1 className="truncate text-lg font-black text-slate-950 sm:text-2xl">{order.purchaseOrderNumber}</h1><StatusBadge value={order.status} /></div><div className="flex items-center gap-2">{order.attachmentUrl && <a href={order.attachmentUrl} target="_blank" rel="noreferrer" title="View attachment" className="grid h-9 min-w-12 place-items-center rounded-lg border border-slate-200 bg-white px-3"><Paperclip className="h-4 w-4" /></a>}<button title="Activity count" className="grid h-9 min-w-12 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">{order.activities?.length || 0}</button><Link to="/purchases/orders" className="grid h-9 w-9 place-items-center rounded-lg text-red-600 hover:bg-red-50"><X className="h-5 w-5" /></Link></div></div>

        <div className="relative z-30 overflow-visible border-b border-slate-200 bg-white"><div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-5">{order.availableActions?.includes('EDIT') && <Link to={`/purchases/orders/${order.id}/edit`} className={toolbarClass}><Edit3 className="h-4 w-4" />Edit</Link>}{order.availableActions?.includes('ISSUE') && <button className={toolbarClass} disabled={issueMutation.isPending} onClick={() => issueMutation.mutate()}><Check className="h-4 w-4" />Issue</button>}{order.availableActions?.includes('SEND') && <button className={toolbarClass} onClick={() => setEmailOpen(true)}><Mail className="h-4 w-4" />Send</button>}{order.availableActions?.includes('RECEIVE') && <button className={toolbarClass} onClick={() => setReceiveOpen(true)}><PackageCheck className="h-4 w-4" />Receive</button>}<PdfPrintMenu loading={pdfMutation.isPending} onDownload={() => pdfMutation.mutate(false)} onPrint={() => pdfMutation.mutate(true)} /><ViewActionMenu order={order} onClone={() => cloneMutation.mutate()} onConvert={() => setConfirm('convert')} onDelete={() => setConfirm('delete')} onCancel={() => setConfirm('cancel')} onCloseOrder={() => setConfirm('close')} /></div></div>
        {(notice || actionError) && <div className="border-b border-slate-200 bg-white px-5 py-3">{notice && <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>}{actionError && <Alert>{errorText(actionError)}</Alert>}</div>}

        <div className="max-h-[calc(100vh-225px)] overflow-auto p-3 sm:p-5 lg:p-6">{order.status === 'DRAFT' && <section className="mx-auto mb-4 flex max-w-[940px] flex-col items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center"><div><p className="font-black">What’s next?</p><p className="text-sm font-semibold text-slate-600">Issue or email this draft before receiving items.</p></div><Button icon={Send} primary onClick={() => setEmailOpen(true)}>Send to Vendor</Button></section>}{['ISSUED', 'PARTIALLY_RECEIVED'].includes(order.status) && <section className="mx-auto mb-4 flex max-w-[940px] flex-col items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center"><div><p className="font-black">{order.status === 'ISSUED' ? 'Awaiting delivery' : 'Partially received'}</p><p className="text-sm font-semibold text-slate-600">Record received quantities and keep this order up to date.</p></div><Button icon={PackageCheck} primary onClick={() => setReceiveOpen(true)}>Receive Items</Button></section>}{order.status === 'RECEIVED' && order.availableActions?.includes('CONVERT_TO_BILL') && <section className="mx-auto mb-4 flex max-w-[940px] flex-col items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center"><div><p className="font-black">Items received</p><p className="text-sm font-semibold text-slate-600">All quantities are received and ready to convert to a vendor bill.</p></div><Button icon={ReceiptText} primary onClick={() => setConfirm('convert')}>Convert to Bill</Button></section>}
          <PurchaseOrderDocument order={order} company={company} />
          <div className="mx-auto mt-5 grid max-w-[960px] gap-4 lg:grid-cols-[280px_1fr]"><DetailsCard title="Receipt Progress" icon={PackageCheck}><div className="flex items-end justify-between"><div><p className="text-3xl font-black">{Math.round(receiptPercent)}%</p><p className="mt-1 text-xs font-semibold text-slate-500">{totalReceived} of {totalOrdered} received</p></div><InfoCell label="Linked Bill" value={order.linkedBillNumber || 'Not billed'} /></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full bg-emerald-500" style={{ width: `${receiptPercent}%` }} /></div></DetailsCard><DetailsCard title="Activity History" icon={History}><div className="space-y-4">{order.activities?.map((activity) => <div key={activity.id} className="flex gap-3"><span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600"><Check className="h-4 w-4" /></span><div><p className="text-sm font-black">{titleize(activity.action)}</p><p className="mt-0.5 text-sm font-semibold text-slate-600">{activity.details || '-'}</p><p className="mt-1 text-xs font-semibold text-slate-400">{dateTimeText(activity.createdAt)} · {activity.performedBy || 'System'}</p></div></div>)}{!order.activities?.length && <p className="text-sm font-semibold text-slate-500">No activity recorded.</p>}</div></DetailsCard></div>
        </div>
      </main>
    </div>
    {receiveOpen && <ReceiveModal order={order} onClose={() => setReceiveOpen(false)} onSave={(body) => receiveMutation.mutate(body)} loading={receiveMutation.isPending} error={receiveMutation.error} />}{emailOpen && <EmailModal order={order} onClose={() => setEmailOpen(false)} onSave={(body) => emailMutation.mutate(body)} loading={emailMutation.isPending} error={emailMutation.error} />}
    <ConfirmDialog open={confirm === 'delete'} title="Delete purchase order?" message={`Delete '${order.purchaseOrderNumber}'? This is only allowed for drafts and cannot be undone.`} loading={deleteMutation.isPending} onCancel={() => setConfirm('')} onConfirm={() => deleteMutation.mutate()} />
    <ConfirmDialog open={confirm === 'convert'} title="Convert to bill?" message={`Create a vendor Bill from '${order.purchaseOrderNumber}' and link both records?`} confirmLabel="Convert" loading={convertMutation.isPending} onCancel={() => setConfirm('')} onConfirm={() => convertMutation.mutate()} />
    <ConfirmDialog open={confirm === 'cancel'} title="Cancel purchase order?" message={`Cancel '${order.purchaseOrderNumber}'? It will remain available for history but cannot be edited, received, or billed.`} confirmLabel="Cancel Order" loading={cancelMutation.isPending} onCancel={() => setConfirm('')} onConfirm={() => cancelMutation.mutate()} />
    <ConfirmDialog open={confirm === 'close'} title="Close purchase order?" message={`Close '${order.purchaseOrderNumber}'? No further receiving or billing actions will be available.`} confirmLabel="Close Order" loading={closeMutation.isPending} onCancel={() => setConfirm('')} onConfirm={() => closeMutation.mutate()} />
  </section>;
}
