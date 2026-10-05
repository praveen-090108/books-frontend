import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  MoreVertical,
  ReceiptText,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { recordsApi } from '../../api/recordsApi.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate } from '../../utils/records.js';
import { FinancialReportPage } from './FinancialReportPage.jsx';

const invoiceTypeOptions = ['Fixed Cost', 'Staffing'];
const durationOptions = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
const pendingStatuses = ['Draft', 'Due Soon', 'Overdue', 'Unpaid', 'Partially Paid', 'Pending'];

function parseNotes(notes) {
  try {
    return notes ? JSON.parse(notes) : {};
  } catch {
    return {};
  }
}

function toDateValue(value) {
  return value ? String(value).slice(0, 10) : '';
}

function money(value) {
  return formatCurrency(Number(value || 0));
}

function inferInvoiceType(record, index) {
  const notes = parseNotes(record.notes);
  const value = `${notes.invoiceType || record.category || record.secondaryStatus || ''}`.toLowerCase();
  if (value.includes('staff')) return 'Staffing';
  if (value.includes('fixed')) return 'Fixed Cost';
  return index % 2 === 0 ? 'Fixed Cost' : 'Staffing';
}

function invoiceReportRow(record, index) {
  const notes = parseNotes(record.notes);
  const amount = Number(record.amount || 0);
  const pendingAmount = Number(record.balanceAmount ?? amount);
  return {
    id: record.id,
    invoiceNumber: record.recordNumber,
    customerName: record.partyName,
    projectName: notes.projectName || record.referenceNumber || record.category || 'General Billing',
    invoiceType: inferInvoiceType(record, index),
    invoiceDate: toDateValue(record.recordDate),
    dueDate: toDateValue(record.dueDate),
    amount,
    pendingAmount,
    status: record.status || record.secondaryStatus || 'Pending',
  };
}

function isPendingInvoice(row) {
  if (row.pendingAmount > 0) return true;
  return !['Paid', 'Deposited', 'Success'].includes(row.status);
}

function isWithinDuration(dateValue, duration) {
  if (!duration || !dateValue) return true;
  const date = new Date(`${dateValue}T00:00:00`);
  const now = new Date();
  const months = {
    Monthly: 1,
    Quarterly: 3,
    'Half-Yearly': 6,
    Yearly: 12,
  }[duration];
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  return date >= start && date <= now;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportRowsAsExcel(rows) {
  const headers = ['Invoice Number', 'Customer Name', 'Invoice Type', 'Invoice Date', 'Due Date', 'Amount', 'Pending Amount', 'Status'];
  const csv = [
    headers.join(','),
    ...rows.map((row) => [
      row.invoiceNumber,
      row.customerName,
      row.invoiceType,
      formatDate(row.invoiceDate),
      formatDate(row.dueDate),
      row.amount,
      row.pendingAmount,
      row.status,
    ].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')),
  ].join('\n');
  downloadFile('invoice-report.csv', csv, 'text/csv;charset=utf-8');
}

function exportRowsAsPdf(rows) {
  const html = `
    <html>
      <head>
        <title>Invoice Report</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; color: #06134a; padding: 24px; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          p { margin: 0 0 18px; color: #475569; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
          th { background: #fff1f2; color: #06134a; }
          .amount { text-align: right; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>IntelliaTech Invoice Report</h1>
        <p>Pending invoice report</p>
        <table>
          <thead><tr><th>Invoice Number</th><th>Customer</th><th>Type</th><th>Invoice Date</th><th>Due Date</th><th>Amount</th><th>Pending</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.map((row) => `<tr><td>${row.invoiceNumber}</td><td>${row.customerName}</td><td>${row.invoiceType}</td><td>${formatDate(row.invoiceDate)}</td><td>${formatDate(row.dueDate)}</td><td class="amount">${money(row.amount)}</td><td class="amount">${money(row.pendingAmount)}</td><td>${row.status}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>`;
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) return;
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

export function ReportsPage({ type = 'invoice' }) {
  if (type !== 'invoice') return <FinancialReportPage type={type} />;
  return <InvoiceReportPage />;
}

function InvoiceReportPage() {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    customer: '',
    duration: '',
    invoiceType: '',
    status: '',
  });
  const [openMenuId, setOpenMenuId] = useState(null);
  const invoicesQuery = useQuery({
    queryKey: ['records', 'reports', 'invoice', 'pending'],
    queryFn: () => recordsApi.list({ module: 'sales', type: 'invoices', page: 0, size: 500, sort: 'recordDate,desc' }),
  });
  const customersQuery = useQuery({
    queryKey: ['records', 'reports', 'customers', 'active'],
    queryFn: () => recordsApi.list({ module: 'sales', type: 'customers', page: 0, size: 500, status: 'Active', sort: 'partyName,asc' }),
  });
  const rows = useMemo(() => (invoicesQuery.data?.content || [])
    .map(invoiceReportRow)
    .filter(isPendingInvoice)
    .filter((row) => !filters.dateFrom || row.invoiceDate >= filters.dateFrom)
    .filter((row) => !filters.dateTo || row.invoiceDate <= filters.dateTo)
    .filter((row) => !filters.customer || row.customerName === filters.customer)
    .filter((row) => !filters.duration || isWithinDuration(row.invoiceDate, filters.duration))
    .filter((row) => !filters.invoiceType || row.invoiceType === filters.invoiceType)
    .filter((row) => !filters.status || row.status === filters.status), [invoicesQuery.data, filters]);
  const customerOptions = useMemo(() => [...new Set((customersQuery.data?.content || []).map((customer) => customer.partyName).filter(Boolean))], [customersQuery.data]);
  const statusOptions = useMemo(() => [...new Set([...pendingStatuses, ...rows.map((row) => row.status)].filter(Boolean))], [rows]);
  const summary = useMemo(() => ({
    totalPendingInvoices: rows.length,
    totalPendingAmount: rows.reduce((sum, row) => sum + row.pendingAmount, 0),
    fixedCostPending: rows.filter((row) => row.invoiceType === 'Fixed Cost').reduce((sum, row) => sum + row.pendingAmount, 0),
    staffingPending: rows.filter((row) => row.invoiceType === 'Staffing').reduce((sum, row) => sum + row.pendingAmount, 0),
  }), [rows]);
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const resetFilters = () => setFilters({ dateFrom: '', dateTo: '', customer: '', duration: '', invoiceType: '', status: '' });

  return (
    <section className="space-y-6 text-[#06134a]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-normal">Invoice Report</h1>
          <p className="mt-2 text-base font-semibold text-slate-600">Track all pending invoices across fixed cost and staffing projects.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => exportRowsAsPdf(rows)} className="flex h-11 items-center gap-2 rounded-lg border border-red-200 bg-white px-5 text-sm font-black text-red-600 shadow-sm hover:bg-red-50">
            <FileDown className="h-4 w-4" /> Export PDF
          </button>
          <button onClick={() => exportRowsAsExcel(rows)} className="flex h-11 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white shadow-sm shadow-red-200 hover:bg-red-700">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportSummaryCard icon={ReceiptText} label="Total Pending Invoices" value={String(summary.totalPendingInvoices)} meta="Awaiting payment" />
        <ReportSummaryCard icon={WalletCards} label="Total Pending Amount" value={money(summary.totalPendingAmount)} meta="Across all customers" />
        <ReportSummaryCard icon={FileText} label="Fixed Cost Pending" value={money(summary.fixedCostPending)} meta="Fixed cost invoices" />
        <ReportSummaryCard icon={UsersRound} label="Staffing Pending" value={money(summary.staffingPending)} meta="Staffing invoices" />
      </div>

      <article className="report-filter-scroll rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-600"><Filter className="h-4 w-4" /></span>
          <h2 className="text-lg font-black">Filters</h2>
        </div>
        <div className="report-filter-grid report-filter-grid--invoice">
          <ReportDateInput label="Date From" value={filters.dateFrom} onChange={(value) => updateFilter('dateFrom', value)} />
          <ReportDateInput label="Date To" value={filters.dateTo} onChange={(value) => updateFilter('dateTo', value)} />
          <ReportSelect label="Customer" value={filters.customer} onChange={(value) => updateFilter('customer', value)} options={customerOptions} placeholder={customersQuery.isLoading ? 'Loading customers...' : 'All Customers'} />
          <ReportSelect label="Duration" value={filters.duration} onChange={(value) => updateFilter('duration', value)} options={durationOptions} placeholder="All Duration" />
          <ReportSelect label="Invoice Type" value={filters.invoiceType} onChange={(value) => updateFilter('invoiceType', value)} options={invoiceTypeOptions} placeholder="All Types" />
          <ReportSelect label="Status" value={filters.status} onChange={(value) => updateFilter('status', value)} options={statusOptions} placeholder="All Status" />
          <button onClick={resetFilters} className="h-9 self-end whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-black shadow-sm hover:bg-slate-50">Reset</button>
        </div>
      </article>

      {invoicesQuery.isLoading && <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-bold">Loading invoice report...</div>}
      {invoicesQuery.isError && <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-700">Unable to load invoice report. Please check backend API.</div>}

      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-black">Pending Invoices</h2>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">{rows.length} records</span>
        </div>
        <div className="overflow-visible">
          <table className="w-full table-fixed text-left text-[13px]">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {['Invoice Number', 'Customer Name', 'Invoice Type', 'Invoice Date', 'Due Date', 'Amount', 'Pending Amount', 'Status', 'Action'].map((column) => (
                  <th
                    key={column}
                    className={`px-3 py-4 font-black ${column === 'Action' ? 'w-16 text-center' : column.includes('Amount') ? 'w-[13%] text-right' : column.includes('Date') ? 'w-[11%]' : column === 'Invoice Type' || column === 'Status' ? 'w-[11%]' : 'w-[15%]'}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-4"><Link to={`/sales/invoices/${row.id}`} className="break-words font-black text-blue-600 hover:underline">{row.invoiceNumber}</Link></td>
                  <td className="px-3 py-4 font-bold leading-5">{row.customerName}</td>
                  <td className="px-3 py-4"><TypeBadge value={row.invoiceType} /></td>
                  <td className="px-3 py-4 font-semibold leading-5">{formatDate(row.invoiceDate)}</td>
                  <td className="px-3 py-4 font-semibold leading-5">{formatDate(row.dueDate)}</td>
                  <td className="px-3 py-4 text-right font-black">{money(row.amount)}</td>
                  <td className="px-3 py-4 text-right font-black text-red-600">{money(row.pendingAmount)}</td>
                  <td className="px-3 py-4"><StatusBadge value={row.status} /></td>
                  <td className="relative px-3 py-4 text-center">
                    <button onClick={() => setOpenMenuId((current) => current === row.id ? null : row.id)} className="mx-auto grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMenuId === row.id && (
                      <div className="absolute right-4 top-12 z-20 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm font-black shadow-xl">
                        <Link to={`/sales/invoices/${row.id}`} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50" onClick={() => setOpenMenuId(null)}><Eye className="h-4 w-4" />View</Link>
                        <button onClick={() => { setOpenMenuId(null); exportRowsAsPdf([row]); }} className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-slate-50"><Download className="h-4 w-4" />Download</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && !invoicesQuery.isLoading && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm font-bold text-slate-500">No pending invoices found for selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function ReportSummaryCard({ icon: Icon, label, value, meta }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black">{label}</p>
          <p className="mt-2 break-words text-2xl font-black">{value}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">{meta}</p>
        </div>
      </div>
    </article>
  );
}

function ReportSelect({ label, value, onChange, options, placeholder }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-bold text-slate-600">{label}</span>
      <span className="relative block">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 pr-8 text-xs font-semibold outline-none focus:border-red-400">
          <option value="">{placeholder}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#06134a]" />
      </span>
    </label>
  );
}

function ReportDateInput({ label, value, onChange }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-bold text-slate-600">{label}</span>
      <span className="relative block">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#06134a]" />
        <input value={value} onChange={(event) => onChange(event.target.value)} type="date" className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 pl-10 text-xs font-semibold outline-none focus:border-red-400" />
      </span>
    </label>
  );
}

function TypeBadge({ value }) {
  const className = value === 'Staffing' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600';
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black ${className}`}>{value}</span>;
}

function StatusBadge({ value }) {
  const tones = {
    Paid: 'bg-emerald-50 text-emerald-600',
    Overdue: 'bg-red-50 text-red-600',
    Unpaid: 'bg-red-50 text-red-600',
    'Partially Paid': 'bg-violet-50 text-violet-600',
    'Due Soon': 'bg-orange-50 text-orange-600',
    Draft: 'bg-slate-100 text-slate-600',
    Pending: 'bg-orange-50 text-orange-600',
  };
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black ${tones[value] || 'bg-slate-100 text-slate-700'}`}>{value}</span>;
}
