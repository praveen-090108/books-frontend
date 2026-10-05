import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays, ChevronDown, CircleDollarSign, Download, Eye, FileText,
  IndianRupee, Percent, Printer, ReceiptText, RefreshCw, TrendingUp, WalletCards,
} from 'lucide-react';
import { recordsApi } from '../../api/recordsApi.js';
import { expensesApi } from '../../api/expensesApi.js';
import { paymentReceivedApi } from '../../api/paymentReceivedApi.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

const COLORS = ['#ef233c', '#2563eb', '#10b981', '#f59e0b', '#7c3aed', '#64748b'];
const MONTH_FORMAT = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });

function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function money(value) { return formatCurrency(number(value)); }
function dateValue(value) { return value ? String(value).slice(0, 10) : ''; }
function monthKey(value) { return dateValue(value).slice(0, 7); }
function monthLabel(key) { if (!key) return '-'; const [year, month] = key.split('-').map(Number); return MONTH_FORMAT.format(new Date(year, month - 1, 1)); }
function parseNotes(value) { try { return value ? JSON.parse(value) : {}; } catch { return {}; } }
function getFinancialYear() {
  const today = new Date(); const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { label: `FY ${startYear}-${String(startYear + 1).slice(-2)}`, from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}
function csvDownload(filename, headers, rows) {
  const content = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function useReportData() {
  const invoices = useQuery({ queryKey: ['financial-report', 'invoices'], queryFn: () => recordsApi.list({ module: 'sales', type: 'invoices', page: 0, size: 500, sort: 'recordDate,asc' }) });
  const credits = useQuery({ queryKey: ['financial-report', 'credit-notes'], queryFn: () => recordsApi.list({ module: 'sales', type: 'creditNotes', page: 0, size: 500, sort: 'recordDate,asc' }) });
  const expenses = useQuery({ queryKey: ['financial-report', 'expenses'], queryFn: () => expensesApi.list({ page: 0, size: 500, sort: 'expenseDate,asc' }) });
  const payments = useQuery({ queryKey: ['financial-report', 'payments'], queryFn: () => paymentReceivedApi.list({ page: 0, size: 500, sort: 'paymentDate,asc' }) });
  return {
    invoices: invoices.data?.content || [], credits: credits.data?.content || [], expenses: expenses.data?.content || [], payments: payments.data?.content || [],
    isLoading: invoices.isLoading || credits.isLoading || expenses.isLoading || payments.isLoading,
    isError: invoices.isError || credits.isError || expenses.isError || payments.isError,
  };
}

function toSales(record) {
  const notes = parseNotes(record.notes); const tax = number(notes?.totals?.taxAmount ?? notes.taxAmount); const amount = number(record.amount);
  return { id: record.id, date: dateValue(record.recordDate), number: record.recordNumber, party: record.partyName, category: record.category || notes.invoiceType || 'Other', amount, tax, description: record.referenceNumber || record.recordNumber };
}
function toExpense(record) {
  const tax = number(record.taxSummary?.totalTaxAmount); const amount = number(record.taxSummary?.totalAmount ?? record.amount);
  return { id: record.id, date: dateValue(record.expenseDate), number: record.expenseNumber, party: record.vendorName || record.createdBy || '-', category: record.expenseAccount || record.expenseType || 'Other', amount, tax, tds: number(record.tdsDeducted), description: record.expenseTitle || record.description || record.expenseNumber, status: record.status };
}
function inRange(row, filters) { return (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to); }
function aggregateMonths(sales, credits, expenses) {
  const map = new Map();
  const ensure = (key) => { if (!map.has(key)) map.set(key, { key, grossSales: 0, sales: 0, credits: 0, expenses: 0, taxOut: 0, taxIn: 0, tds: 0, invoices: 0, expenseCount: 0 }); return map.get(key); };
  sales.forEach((row) => { const item = ensure(monthKey(row.date)); item.grossSales += row.amount; item.sales += row.amount; item.taxOut += row.tax; item.invoices += 1; });
  credits.forEach((row) => { const item = ensure(monthKey(row.date)); item.credits += row.amount; item.sales -= row.amount; });
  expenses.forEach((row) => { const item = ensure(monthKey(row.date)); item.expenses += row.amount; item.taxIn += row.tax; item.tds += row.tds; item.expenseCount += 1; });
  return [...map.values()].filter((row) => row.key).sort((a, b) => a.key.localeCompare(b.key)).map((row) => ({ ...row, profit: row.sales - row.expenses, margin: row.sales ? ((row.sales - row.expenses) / row.sales) * 100 : 0 }));
}

export function FinancialReportPage({ type }) {
  const { month } = useParams();
  if (type === 'sales-expenses-detail') return <MonthDetailPage month={month} />;
  return <FinancialOverview type={type} />;
}

function FinancialOverview({ type }) {
  const fy = useMemo(getFinancialYear, []); const data = useReportData();
  const [filters, setFilters] = useState({ from: fy.from, to: fy.to, group: 'Month', party: '' });
  const sales = useMemo(() => data.invoices.map(toSales).filter((row) => inRange(row, filters)), [data.invoices, filters]);
  const credits = useMemo(() => data.credits.map(toSales).filter((row) => inRange(row, filters)), [data.credits, filters]);
  const expenses = useMemo(() => data.expenses.map(toExpense).filter((row) => inRange(row, filters)), [data.expenses, filters]);
  const months = useMemo(() => aggregateMonths(sales, credits, expenses), [sales, credits, expenses]);
  const totals = useMemo(() => {
    const grossSales = sales.reduce((sum, row) => sum + row.amount, 0); const returns = credits.reduce((sum, row) => sum + row.amount, 0); const netSales = grossSales - returns;
    const expense = expenses.reduce((sum, row) => sum + row.amount, 0); const taxOut = sales.reduce((sum, row) => sum + row.tax, 0); const taxIn = expenses.reduce((sum, row) => sum + row.tax, 0);
    const tds = expenses.reduce((sum, row) => sum + row.tds, 0); const profit = netSales - expense;
    return { grossSales, returns, netSales, expense, profit, margin: netSales ? profit / netSales * 100 : 0, taxOut, taxIn, gstPayable: Math.max(0, taxOut - taxIn), tds };
  }, [sales, credits, expenses]);
  const title = ({ sales: 'Sales Report', expenses: 'Expenses Report', 'sales-expenses': 'Sales & Expenses (P&L) Report', gst: 'GST Report', tds: 'TDS Report' })[type];
  const subtitle = ({ sales: 'Track and analyze your sales performance', expenses: 'Track and analyze your business expenses', 'sales-expenses': 'Track income, expenses and profit/loss performance', gst: 'Track GST collected, paid and outstanding amount', tds: 'Track TDS deductions for the selected period' })[type];
  const reset = () => setFilters({ from: fy.from, to: fy.to, group: 'Month', party: '' });
  const exportReport = () => csvDownload(`${type}-report.csv`, ['Month', 'Sales', 'Expenses', 'Net Profit', 'GST Output', 'GST Input', 'TDS'], months.map((row) => [monthLabel(row.key), row.sales, row.expenses, row.profit, row.taxOut, row.taxIn, row.tds]));

  return <section className="space-y-4 text-[#06134a]">
    <ReportHeader title={title} subtitle={subtitle} onExport={exportReport} />
    <FilterPanel fy={fy} filters={filters} setFilters={setFilters} reset={reset} showParty={type === 'tds'} parties={[...new Set(expenses.map((row) => row.party).filter(Boolean))]} />
    {data.isLoading && <Notice>Loading report data...</Notice>}
    {data.isError && <Notice error>Report data could not be loaded from the backend.</Notice>}
    {!data.isLoading && !data.isError && <>
      <SummaryCards type={type} totals={totals} sales={sales} expenses={expenses} payments={data.payments} />
      {type === 'sales' && <SalesBody rows={months} sales={sales} totals={totals} />}
      {type === 'expenses' && <ExpenseBody rows={months} expenses={expenses} totals={totals} />}
      {type === 'sales-expenses' && <ProfitBody rows={months} totals={totals} />}
      {type === 'gst' && <GstBody rows={months} totals={totals} />}
      {type === 'tds' && <TdsBody rows={months} expenses={expenses} totals={totals} party={filters.party} />}
    </>}
  </section>;
}

function ReportHeader({ title, subtitle, onExport }) {
  return <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="mb-2 text-xs font-bold text-slate-500">Reports <span className="px-2">›</span> {title}</p><h1 className="text-2xl font-black">{title}</h1><p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p></div><div className="flex gap-2"><button onClick={onExport} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black shadow-sm hover:bg-slate-50"><Download className="h-4 w-4" /> Export</button><button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black shadow-sm hover:bg-slate-50"><Printer className="h-4 w-4" /> Print</button></div></div>;
}
function FilterPanel({ fy, filters, setFilters, reset, showParty, parties }) {
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return <article className="report-filter-scroll rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="report-filter-grid report-filter-grid--financial">
    <CompactSelect label="Financial Year" value={fy.label} options={[fy.label]} onChange={() => {}} />
    <CompactDate label="From Date" value={filters.from} onChange={(value) => update('from', value)} />
    <CompactDate label="To Date" value={filters.to} onChange={(value) => update('to', value)} />
    {showParty ? <CompactSelect label="Party / Client" value={filters.party} options={parties} placeholder="All" onChange={(value) => update('party', value)} /> : <CompactSelect label="Group By" value={filters.group} options={['Month', 'Quarter', 'Year']} onChange={(value) => update('group', value)} />}
    <button className="h-9 self-end whitespace-nowrap rounded-md bg-red-600 px-4 text-xs font-black text-white">Apply Filter</button><button onClick={reset} className="inline-flex h-9 items-center justify-center gap-2 self-end whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-black shadow-sm hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Reset</button>
  </div></article>;
}
function CompactSelect({ label, value, options, onChange, placeholder }) { return <label className="min-w-0"><span className="mb-1 block text-[11px] font-bold text-slate-600">{label}</span><span className="relative block"><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 pr-8 text-xs font-semibold outline-none focus:border-red-400"><option value="">{placeholder}</option>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4" /></span></label>; }
function CompactDate({ label, value, onChange }) { return <label className="min-w-0"><span className="mb-1 block text-[11px] font-bold text-slate-600">{label}</span><span className="relative block"><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-3 pr-8 text-xs font-semibold outline-none focus:border-red-400" /><CalendarDays className="pointer-events-none absolute right-3 top-2.5 h-4 w-4" /></span></label>; }
function Notice({ children, error }) { return <div className={`rounded-xl border p-5 text-sm font-bold ${error ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white'}`}>{children}</div>; }

function SummaryCards({ type, totals, sales, expenses, payments }) {
  const cards = type === 'sales' ? [
    ['Total Sales', money(totals.grossSales), TrendingUp], ['Total Invoices', sales.length, ReceiptText], ['Average Invoice Value', money(sales.length ? totals.grossSales / sales.length : 0), IndianRupee], ['Total Returns', money(totals.returns), RefreshCw], ['Net Sales', money(totals.netSales), CircleDollarSign],
  ] : type === 'expenses' ? [
    ['Total Expenses', money(totals.expense), WalletCards], ['Expense Records', expenses.length, ReceiptText], ['Average Expense Value', money(expenses.length ? totals.expense / expenses.length : 0), IndianRupee], ['Total Payments', money(expenses.filter((row) => row.status === 'PAID').reduce((sum, row) => sum + row.amount, 0)), WalletCards], ['Pending Amount', money(expenses.filter((row) => row.status === 'PENDING').reduce((sum, row) => sum + row.amount, 0)), CircleDollarSign],
  ] : type === 'sales-expenses' ? [
    ['Total Sales (Income)', money(totals.netSales), TrendingUp], ['Total Expenses', money(totals.expense), WalletCards], ['Net Profit', money(totals.profit), CircleDollarSign], ['Profit Margin', `${totals.margin.toFixed(2)}%`, Percent], ['Avg. Monthly Profit', money(totals.profit / 12), FileText],
  ] : type === 'gst' ? [
    ['Total GST Collected', money(totals.taxOut), WalletCards], ['Total GST Paid', money(totals.taxIn), ReceiptText], ['GST Payable', money(totals.gstPayable), FileText], ['GST Settled', money(Math.min(totals.taxOut, totals.taxIn)), IndianRupee], ['Outstanding GST', money(totals.gstPayable), CircleDollarSign],
  ] : [
    ['Total Amount (Before TDS)', money(totals.netSales), FileText], ['Total TDS Deducted', money(totals.tds), WalletCards], ['Average TDS Rate', `${totals.netSales ? (totals.tds / totals.netSales * 100).toFixed(2) : '0.00'}%`, Percent], ['Total TDS Paid', money(payments.reduce((sum, row) => sum + number(row.tdsAmount), 0)), IndianRupee], ['TDS Payable', money(Math.max(0, totals.tds - payments.reduce((sum, row) => sum + number(row.tdsAmount), 0))), CircleDollarSign],
  ];
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value, Icon], index) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: `${COLORS[index]}16`, color: COLORS[index] }}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[11px] font-black text-slate-600">{label}</p><p className="mt-1 truncate text-xl font-black">{value}</p><p className="mt-1 text-[10px] font-bold text-emerald-600">Database totals</p></div></div></article>)}</div>;
}

function SalesBody({ rows, sales, totals }) { return <><div className="grid gap-4 xl:grid-cols-2"><ChartCard title="Sales Overview (Month Wise)"><BarChart rows={rows} series={[['sales', '#2563eb']]} /></ChartCard><ChartCard title="Sales by Category"><DonutChart rows={groupRows(sales, 'category')} total={totals.grossSales} /></ChartCard></div><MonthTable title="Sales Summary (Month Wise)" rows={rows} columns={[['invoices', 'Total Invoices', false], ['grossSales', 'Total Sales', true], ['credits', 'Returns', true], ['sales', 'Net Sales', true]]} /></>; }
function ExpenseBody({ rows, expenses, totals }) { return <><div className="grid gap-4 xl:grid-cols-2"><ChartCard title="Expenses Overview (Month Wise)"><BarChart rows={rows} series={[['expenses', '#ef4444']]} /></ChartCard><ChartCard title="Expenses by Category"><DonutChart rows={groupRows(expenses, 'category')} total={totals.expense} /></ChartCard></div><MonthTable title="Expenses Summary (Month Wise)" rows={rows} columns={[['expenseCount', 'Expense Records', false], ['expenses', 'Total Expenses', true], ['taxIn', 'GST Paid', true], ['tds', 'TDS Deducted', true]]} /></>; }
function ProfitBody({ rows, totals }) { return <><div className="grid gap-4 xl:grid-cols-2"><ChartCard title="Income vs Expenses (Month Wise)"><BarChart rows={rows} series={[['sales', '#2563eb'], ['expenses', '#ef4444']]} /></ChartCard><ChartCard title="Profit / Loss (Month Wise)"><BarChart rows={rows} series={[['profit', '#10b981']]} /></ChartCard></div><MonthTable title="Monthly Summary" rows={rows} columns={[['sales', 'Total Sales', true], ['expenses', 'Total Expenses', true], ['profit', 'Net Profit / (Loss)', true], ['margin', 'Profit Margin (%)', false]]} action />{!rows.length && <Notice>No transactions exist in the selected period.</Notice>}<QuickSummary totals={totals} /></>; }
function GstBody({ rows, totals }) { return <><div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]"><ChartCard title="GST Overview (Month Wise)"><BarChart rows={rows} series={[['taxOut', '#10b981'], ['taxIn', '#2563eb']]} /></ChartCard><ChartCard title="GST Summary"><DonutChart rows={[{ label: 'Output GST', value: totals.taxOut }, { label: 'Input GST', value: totals.taxIn }, { label: 'Outstanding GST', value: totals.gstPayable }]} total={totals.taxOut + totals.taxIn + totals.gstPayable} /></ChartCard></div><MonthTable title="GST Summary (Month Wise)" rows={rows} columns={[['taxOut', 'GST Collected (Output)', true], ['taxIn', 'GST Paid (Input)', true], ['taxOut', 'Net GST Payable', true]]} /><QuickSummary totals={totals} gst /></>; }
function TdsBody({ rows, expenses, totals, party }) { const filtered = party ? expenses.filter((row) => row.party === party) : expenses; const groups = groupRows(filtered.filter((row) => row.tds > 0), 'party', 'tds'); return <><div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]"><ChartCard title="TDS Deducted (Month Wise)"><BarChart rows={rows} series={[['tds', '#2563eb']]} /></ChartCard><ChartCard title="TDS Deducted by Party"><DonutChart rows={groups} total={totals.tds} /></ChartCard></div><SimpleTable title="TDS Summary by Party / Client" headers={['Party / Client', 'Total Amount', 'TDS Deducted', 'TDS Rate']} rows={groups.map((row) => [row.label, money(filtered.filter((item) => item.party === row.label).reduce((sum, item) => sum + item.amount, 0)), money(row.value), `${filtered.filter((item) => item.party === row.label).reduce((sum, item) => sum + item.amount, 0) ? (row.value / filtered.filter((item) => item.party === row.label).reduce((sum, item) => sum + item.amount, 0) * 100).toFixed(2) : '0.00'}%`])} /></>; }

function ChartCard({ title, children }) { return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-4 text-sm font-black">{title}</h2>{children}</article>; }
function BarChart({ rows, series }) { const max = Math.max(1, ...rows.flatMap((row) => series.map(([key]) => Math.abs(number(row[key]))))); return <div className="flex h-52 items-end gap-2 overflow-hidden border-b border-slate-200 px-2"><div className="flex h-full flex-1 items-end justify-around gap-2">{rows.map((row) => <div key={row.key} className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="flex h-[170px] items-end justify-center gap-1">{series.map(([key, color]) => <span key={key} className="w-full max-w-5 rounded-t-sm" title={`${monthLabel(row.key)}: ${money(row[key])}`} style={{ height: `${Math.max(2, Math.abs(number(row[key])) / max * 100)}%`, backgroundColor: number(row[key]) < 0 ? '#ef4444' : color }} />)}</div><span className="mt-2 truncate text-center text-[9px] font-bold text-slate-500">{monthLabel(row.key).replace(' ', " '")}</span></div>)}</div></div>; }
function DonutChart({ rows, total }) { const safeTotal = Math.max(1, number(total)); let used = 0; const gradient = rows.map((row, index) => { const start = used; used += number(row.value) / safeTotal * 100; return `${COLORS[index % COLORS.length]} ${start}% ${Math.min(100, used)}%`; }).join(', '); return <div className="flex min-h-52 flex-col items-center justify-center gap-5 sm:flex-row"><div className="grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: rows.length ? `conic-gradient(${gradient})` : '#e2e8f0' }}><div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center"><span className="text-xs font-black">Total<br />{money(total)}</span></div></div><div className="w-full space-y-2">{rows.slice(0, 6).map((row, index) => <div key={row.label} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 font-bold"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[index % COLORS.length] }} /> <span className="truncate">{row.label}</span></span><strong>{money(row.value)}</strong></div>)}</div></div>; }
function groupRows(rows, key, valueKey = 'amount') { const map = new Map(); rows.forEach((row) => map.set(row[key] || 'Other', (map.get(row[key] || 'Other') || 0) + number(row[valueKey]))); return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); }

function MonthTable({ title, rows, columns, action }) { return <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 px-4 py-3 text-sm font-black">{title}</h2><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50"><tr><th className="px-4 py-3 font-black">Month</th>{columns.map(([, label]) => <th key={label} className="px-4 py-3 text-center font-black">{label}</th>)}{action && <th className="px-4 py-3 text-center font-black">Action</th>}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.key}><td className="px-4 py-2.5 font-bold">{monthLabel(row.key)}</td>{columns.map(([key, label, currency]) => <td key={label} className={`px-4 py-2.5 text-center font-semibold ${key === 'profit' ? number(row[key]) >= 0 ? 'text-emerald-600' : 'text-red-600' : ''}`}>{currency ? money(key === 'taxOut' && label.includes('Net') ? Math.max(0, row.taxOut - row.taxIn) : row[key]) : key === 'margin' ? `${number(row[key]).toFixed(2)}%` : row[key]}</td>)}{action && <td className="px-4 py-2 text-center"><Link to={`/reports/sales-expenses/${row.key}`} className="inline-grid h-8 w-8 place-items-center rounded-lg text-blue-600 hover:bg-blue-50" title={`View ${monthLabel(row.key)} details`}><Eye className="h-4 w-4" /></Link></td>}</tr>)}{!rows.length && <tr><td colSpan={columns.length + 2} className="px-4 py-10 text-center font-bold text-slate-400">No report data found.</td></tr>}</tbody></table></div></article>; }
function SimpleTable({ title, headers, rows }) { return <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 px-4 py-3 text-sm font-black">{title}</h2><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-slate-50"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-black">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 font-semibold">{cell}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headers.length} className="px-4 py-10 text-center font-bold text-slate-400">No report data found.</td></tr>}</tbody></table></div></article>; }
function QuickSummary({ totals, gst }) { const rows = gst ? [['Total Output GST', totals.taxOut], ['Total Input GST', totals.taxIn], ['Outstanding GST', totals.gstPayable]] : [['Total Sales', totals.netSales], ['Total Expenses', totals.expense], ['Net Profit', totals.profit]]; return <article className="ml-auto w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:w-1/3"><h2 className="mb-3 text-sm font-black">Quick Insight</h2>{rows.map(([label, value]) => <div key={label} className="flex justify-between border-b border-slate-100 py-2 text-xs font-bold"><span>{label}</span><strong>{money(value)}</strong></div>)}</article>; }

function MonthDetailPage({ month }) {
  const data = useReportData();
  const invoices = data.invoices.map(toSales).filter((row) => monthKey(row.date) === month);
  const credits = data.credits.map(toSales).filter((row) => monthKey(row.date) === month);
  const expenses = data.expenses.map(toExpense).filter((row) => monthKey(row.date) === month);
  const grossSales = invoices.reduce((sum, row) => sum + row.amount, 0);
  const returns = credits.reduce((sum, row) => sum + row.amount, 0);
  const saleTotal = grossSales - returns;
  const expenseTotal = expenses.reduce((sum, row) => sum + row.amount, 0); const profit = saleTotal - expenseTotal;
  const incomeRows = [...invoices.map((row) => ({ ...row, entryType: 'Invoice', displayAmount: row.amount })), ...credits.map((row) => ({ ...row, entryType: 'Credit Note', displayAmount: -row.amount }))].sort((a, b) => a.date.localeCompare(b.date));
  return <section className="space-y-4 text-[#06134a]"><ReportHeader title={`Sales & Expenses (P&L) Report - ${monthLabel(month)}`} subtitle="Detailed income and expenses for the selected month" onExport={() => csvDownload(`p-and-l-${month}.csv`, ['Type', 'Description', 'Date', 'Party', 'Amount'], [...incomeRows.map((row) => [row.entryType, row.description, row.date, row.party, row.displayAmount]), ...expenses.map((row) => ['Expense', row.description, row.date, row.party, row.amount])])} />
    {data.isLoading ? <Notice>Loading month details...</Notice> : data.isError ? <Notice error>Month details could not be loaded from the backend.</Notice> : <><SummaryCards type="sales-expenses" totals={{ netSales: saleTotal, expense: expenseTotal, profit, margin: saleTotal ? profit / saleTotal * 100 : 0 }} sales={invoices} expenses={expenses} payments={[]} /><label className="block max-w-[220px]"><span className="mb-1 block text-[11px] font-bold text-slate-600">Month</span><input type="month" value={month || ''} readOnly className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold" /></label><div className="grid gap-4 xl:grid-cols-2"><SimpleTable title="Income (Sales) Details" headers={['#', 'Type', 'Description', 'Date', 'Party', 'Amount']} rows={incomeRows.map((row, index) => [index + 1, row.entryType, row.description, row.date, row.party, money(row.displayAmount)])} /><SimpleTable title="Expenses Details" headers={['#', 'Description', 'Date', 'Party', 'Amount', 'GST Paid']} rows={expenses.map((row, index) => [index + 1, row.description, row.date, row.party, money(row.amount), money(row.tax)])} /></div><QuickSummary totals={{ netSales: saleTotal, expense: expenseTotal, profit }} /></>}
  </section>;
}
