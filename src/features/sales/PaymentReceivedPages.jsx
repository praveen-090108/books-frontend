import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileText,
  Mail,
  MoreVertical,
  Paperclip,
  Printer,
  ReceiptIndianRupee,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  Upload,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { paymentReceivedApi } from '../../api/paymentReceivedApi.js';
import { recordsApi } from '../../api/recordsApi.js';
import { storageApi } from '../../api/storageApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { BankAccountSelect } from '../../components/BankAccountSelect.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate } from '../../utils/records.js';

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Credit Card', 'Debit Card', 'Cheque', 'PayPal', 'Wise', 'NEFT', 'RTGS', 'IMPS', 'Other'];
const PAGE_SIZES = [10, 25, 50];
const emptyForm = {
  customerId: '', amountReceived: '', paymentDate: new Date().toISOString().slice(0, 10), paymentMode: '',
  depositAccount: '', bankAccountId: '', referenceNumber: '', tdsDeducted: false, tdsPercentage: '', tdsAmount: '',
  tdsSectionCode: '', tdsCertificateNumber: '', tdsCertificateDate: '', tdsRemarks: '', bankCharges: '',
  notes: '', attachmentUrl: '', sendThankYouEmail: true, bankAccountName: '', bankName: '',
  maskedAccountNumber: '', transactionId: '', chequeNumber: '', chequeDate: '',
};

export function PaymentReceivedListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [tds, setTds] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sort, setSort] = useState('paymentDate,desc');
  const [activeWidget, setActiveWidget] = useState('all');
  const [menuId, setMenuId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();
  const customersQuery = useActiveCustomers();
  const summaryQuery = useQuery({ queryKey: ['payments-received-summary'], queryFn: paymentReceivedApi.summary });
  const listQuery = useQuery({
    queryKey: ['payments-received', page, size, search, invoiceNumber, customerId, paymentMode, tds, status, fromDate, toDate, sort],
    queryFn: () => paymentReceivedApi.list({
      page, size, search: search || undefined, invoiceNumber: invoiceNumber || undefined,
      customerId: customerId || undefined,
      fromDate: fromDate || undefined, toDate: toDate || undefined, paymentMode: paymentMode || undefined,
      tds: tds === '' ? undefined : tds === 'true', status: status || undefined,
      sortBy: sort.split(',')[0], sortDirection: sort.split(',')[1],
    }),
    placeholderData: (previous) => previous,
  });
  const deleteMutation = useMutation({
    mutationFn: paymentReceivedApi.remove,
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['payments-received'] });
      queryClient.invalidateQueries({ queryKey: ['payments-received-summary'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lifecycle'] });
    },
  });
  const data = listQuery.data?.content || [];
  const summary = summaryQuery.data || {};
  const resetFilters = () => {
    setSearch(''); setInvoiceNumber(''); setCustomerId(''); setPaymentMode(''); setTds(''); setStatus('');
    setFromDate(''); setToDate(''); setPage(0); setActiveWidget('all');
  };
  const selectMonth = () => {
    setFromDate(summary.monthStart || '');
    setToDate(summary.monthEnd || ''); setPage(0); setActiveWidget('month');
  };
  const selectYear = () => {
    setFromDate(summary.yearStart || ''); setToDate(summary.yearEnd || '');
    setPage(0); setActiveWidget('year');
  };
  const cards = [
    { key: 'all', title: 'Total Received', value: summary.totalReceived, caption: 'All Time', icon: WalletCards, tone: 'blue', action: resetFilters },
    { key: 'month', title: 'This Month', value: summary.thisMonthReceived, caption: summary.monthLabel, icon: CalendarDays, tone: 'green', action: selectMonth },
    { key: 'year', title: 'This Year', value: summary.thisYearReceived, caption: summary.yearLabel, icon: ReceiptIndianRupee, tone: 'purple', action: selectYear },
    { key: 'overdue', title: 'Overdue', value: summary.overdueAmount, caption: `From ${summary.overdueInvoiceCount || 0} Invoices`, icon: FileText, tone: 'orange', action: () => navigate('/sales/invoices?overdue=true') },
  ];

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h1 className="text-2xl font-black text-[#06134a]">Payments Received</h1><p className="mt-1 text-sm font-semibold text-slate-600">Track customer payments, TDS and invoice allocations in one place</p></div>
        <Link to="/sales/payments-received/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white shadow-sm hover:bg-red-700"><ReceiptIndianRupee className="h-4 w-4" /> Record Payment</Link>
      </header>
      {location.state?.message && <Alert tone="success">{location.state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <SummaryWidget key={card.key} {...card} active={activeWidget === card.key} loading={summaryQuery.isLoading} />)}
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
        <label className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); setActiveWidget('custom'); }} placeholder="Payment, customer or reference..." className="form-control pl-10" /></label>
        <input value={invoiceNumber} onChange={(event) => { setInvoiceNumber(event.target.value); setPage(0); setActiveWidget('custom'); }} placeholder="Invoice number" className="form-control" />
        <select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setPage(0); setActiveWidget('custom'); }} className="form-control"><option value="">All Customers</option>{(customersQuery.data || []).map((customer) => <option key={customer.id} value={customer.id}>{customer.partyName}</option>)}</select>
        <select value={paymentMode} onChange={(event) => { setPaymentMode(event.target.value); setPage(0); setActiveWidget('custom'); }} className="form-control"><option value="">All Payment Modes</option>{PAYMENT_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select>
        <select value={tds} onChange={(event) => { setTds(event.target.value); setPage(0); setActiveWidget('custom'); }} className="form-control"><option value="">TDS / Non-TDS</option><option value="true">TDS</option><option value="false">Non-TDS</option></select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); setActiveWidget('custom'); }} className="form-control"><option value="">All Status</option><option>Paid</option><option>Reversed</option></select>
        <input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0); setActiveWidget('custom'); }} className="form-control" title="From date" />
        <input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(0); setActiveWidget('custom'); }} className="form-control" title="To date" />
        <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); setActiveWidget('custom'); }} className="form-control"><option value="paymentDate,desc">Newest payment</option><option value="paymentDate,asc">Oldest payment</option><option value="paymentNumber,asc">Payment number</option><option value="customer,asc">Customer</option><option value="amount,desc">Highest amount</option><option value="amount,asc">Lowest amount</option></select>
        <button onClick={resetFilters} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50">Reset</button>
      </div>
      {listQuery.isError && <Alert tone="error">{apiError(listQuery.error, 'Payments could not be loaded.')}</Alert>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1400px] table-fixed text-left text-[11px] text-[#06134a]">
          <thead className="bg-slate-50 uppercase text-slate-500"><tr>{['Payment #', 'Invoice #', 'Date', 'Customer', 'Mode', 'Gross', 'TDS', 'Charges', 'Net Credit', 'Allocated', 'Unallocated', 'Reference', 'Status', ''].map((label, index) => <th key={`${label}-${index}`} className={`${index === 3 ? 'w-[13%]' : index === 13 ? 'w-10' : ''} px-2 py-3 font-black`}>{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {listQuery.isLoading && <SkeletonRows columns={14} />}
            {!listQuery.isLoading && data.map((payment) => (
              <tr key={payment.id} className="align-top hover:bg-slate-50">
                <td className="px-2 py-3"><Link to={`/sales/payments-received/${payment.id}`} className="font-black text-blue-600 hover:underline">{payment.paymentNumber}</Link></td>
                <td className="px-2 py-3"><InvoiceLinks allocations={payment.allocations} /></td>
                <td className="px-2 py-3">{formatDate(payment.paymentDate)}</td>
                <td className="break-words px-2 py-3 font-bold">{payment.customerName}</td>
                <td className="break-words px-2 py-3">{payment.paymentMode || '-'}</td>
                <MoneyCell value={payment.grossAmountReceived} /><MoneyCell value={payment.tdsAmount} /><MoneyCell value={payment.bankCharges} /><MoneyCell value={payment.netBankCredit} /><MoneyCell value={payment.allocatedAmount} /><MoneyCell value={payment.unallocatedAmount} />
                <td className="break-words px-2 py-3">{payment.referenceNumber || '-'}</td>
                <td className="px-2 py-3"><StatusBadge value={payment.status} /></td>
                <td className="relative px-2 py-3"><button onClick={() => setMenuId(menuId === payment.id ? null : payment.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200"><MoreVertical className="h-4 w-4" /></button>{menuId === payment.id && <RowMenu onClose={() => setMenuId(null)} actions={[{ label: 'View', icon: Eye, onClick: () => navigate(`/sales/payments-received/${payment.id}`) }, { label: 'Edit', icon: Edit3, onClick: () => navigate(`/sales/payments-received/${payment.id}/edit`), disabled: payment.reversed }, { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteTarget(payment), disabled: payment.reconciled }]} />}</td>
              </tr>
            ))}
            {!listQuery.isLoading && !data.length && <tr><td colSpan="14" className="px-5 py-14 text-center text-sm font-bold text-slate-500">No payments match the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} size={size} data={listQuery.data} onPage={setPage} onSize={(next) => { setSize(next); setPage(0); }} />
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete payment?" message="This will remove the receipt, reverse its invoice allocations, and recalculate every linked invoice." loading={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteMutation.mutate(deleteTarget.id)} />
    </section>
  );
}

export function PaymentReceivedFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState({});
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const initialized = useRef(false);
  const customersQuery = useActiveCustomers();
  const paymentQuery = useQuery({ queryKey: ['payment-received', id], queryFn: () => paymentReceivedApi.get(id), enabled: isEdit });
  const invoicesQuery = useQuery({
    queryKey: ['payment-eligible-invoices', form.customerId, id],
    queryFn: () => paymentReceivedApi.eligibleInvoices({ customerId: form.customerId, paymentId: id }),
    enabled: Boolean(form.customerId),
  });
  useEffect(() => {
    if (!isEdit || !paymentQuery.data || initialized.current) return;
    const payment = paymentQuery.data;
    setForm({
      customerId: String(payment.customerId || ''), amountReceived: String(payment.grossAmountReceived || ''),
      paymentDate: payment.paymentDate || '', paymentMode: payment.paymentMode || '', depositAccount: payment.depositAccount || '',
      bankAccountId: payment.bankAccountId ? String(payment.bankAccountId) : '',
      referenceNumber: payment.referenceNumber || '', tdsDeducted: Number(payment.tdsAmount || 0) > 0,
      tdsPercentage: String(payment.tdsPercentage || ''), tdsAmount: String(payment.tdsAmount || ''),
      tdsSectionCode: payment.tdsSectionCode || '', tdsCertificateNumber: payment.tdsCertificateNumber || '',
      tdsCertificateDate: payment.tdsCertificateDate || '', tdsRemarks: payment.tdsRemarks || '',
      bankCharges: String(payment.bankCharges || ''), notes: payment.notes || '', attachmentUrl: payment.attachmentUrl || '',
      sendThankYouEmail: Boolean(payment.sendThankYouEmail), bankAccountName: payment.bankAccountName || '',
      bankName: payment.bankName || '', maskedAccountNumber: payment.maskedAccountNumber || '',
      transactionId: payment.transactionId || '', chequeNumber: payment.chequeNumber || '', chequeDate: payment.chequeDate || '',
    });
    setRows(Object.fromEntries((payment.allocations || []).map((allocation) => [String(allocation.invoiceId), {
      enabled: true, paymentApplied: String(allocation.paymentApplied || 0), tdsApplied: String(allocation.tdsApplied || 0), creditApplied: String(allocation.creditApplied || 0),
    }])));
    initialized.current = true;
  }, [isEdit, paymentQuery.data]);
  const invoices = invoicesQuery.data || [];
  const customer = (customersQuery.data || []).find((entry) => String(entry.id) === String(form.customerId));
  const calculations = useMemo(() => allocationTotals(form, rows), [form, rows]);
  const mutation = useMutation({
    mutationFn: async (payload) => isEdit ? paymentReceivedApi.update({ id, payload }) : paymentReceivedApi.create(payload),
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ['payments-received'] });
      queryClient.invalidateQueries({ queryKey: ['payments-received-summary'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lifecycle'] });
      navigate(`/sales/payments-received/${payment.id}`, { replace: true, state: { message: `Payment ${isEdit ? 'updated' : 'recorded'} successfully.` } });
    },
    onError: (failure) => setError(apiError(failure, 'Payment could not be saved.')),
  });
  const updateForm = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const changeCustomer = (value) => {
    setForm((current) => ({ ...current, customerId: value }));
    setRows({}); setError('');
  };
  const updateRow = (invoiceId, field, value) => setRows((current) => ({ ...current, [invoiceId]: { enabled: true, paymentApplied: '', tdsApplied: '', creditApplied: '', ...current[invoiceId], [field]: value } }));
  const toggleRow = (invoiceId, enabled) => setRows((current) => ({ ...current, [invoiceId]: enabled ? { enabled: true, paymentApplied: '', tdsApplied: '', creditApplied: '', ...current[invoiceId] } : { enabled: false, paymentApplied: '', tdsApplied: '', creditApplied: '' } }));
  const autoAllocate = () => {
    let cash = number(form.amountReceived); let tds = form.tdsDeducted ? number(form.tdsAmount) : 0;
    const allocated = {};
    invoices.forEach((invoice) => {
      const paymentApplied = Math.min(cash, number(invoice.balanceDue)); cash = round(cash - paymentApplied);
      const remaining = round(number(invoice.balanceDue) - paymentApplied);
      const tdsApplied = Math.min(tds, remaining); tds = round(tds - tdsApplied);
      allocated[String(invoice.invoiceId)] = { enabled: paymentApplied + tdsApplied > 0, paymentApplied: valueNumber(paymentApplied), tdsApplied: valueNumber(tdsApplied), creditApplied: '' };
    });
    setRows(allocated);
  };
  const calculateTds = (rateValue) => {
    const rate = Math.max(0, Math.min(100, number(rateValue)));
    const selected = invoices.filter((invoice) => rows[String(invoice.invoiceId)]?.enabled);
    const base = (selected.length ? selected : invoices.slice(0, 1)).reduce((sum, invoice) => sum + number(invoice.tdsBase), 0);
    setForm((current) => ({ ...current, tdsPercentage: rateValue, tdsAmount: valueNumber(base * rate / 100) }));
  };
  const uploadAttachment = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('Attachment must be 10 MB or smaller.'); return; }
    try { const result = await storageApi.uploadPaymentAttachment(file); updateForm('attachmentUrl', result.url); setFileName(file.name); }
    catch (failure) { setError(apiError(failure, 'Attachment upload failed.')); }
  };
  const submit = () => {
    setError('');
    const allocations = invoices.map((invoice) => ({ invoice, row: rows[String(invoice.invoiceId)] })).filter(({ row }) => row?.enabled && (number(row.paymentApplied) + number(row.tdsApplied) + number(row.creditApplied) > 0));
    if (!form.customerId) return setError('Customer is required.');
    if (!form.paymentDate) return setError('Payment date is required.');
    if (!allocations.length) return setError('Allocate the payment to at least one invoice.');
    if (number(form.amountReceived) > 0 && !form.paymentMode) return setError('Payment mode is required.');
    if (number(form.amountReceived) > 0 && !['Cash', 'Other'].includes(form.paymentMode) && !form.bankAccountId) return setError('Deposit To / Bank Account is required.');
    if (Math.abs(calculations.unallocated) > 0.009) return setError('Allocate the full available settlement before saving.');
    const exceeded = allocations.find(({ invoice, row }) => number(row.paymentApplied) + number(row.tdsApplied) + number(row.creditApplied) > number(invoice.balanceDue) + 0.009);
    if (exceeded) return setError(`Allocation for ${exceeded.invoice.invoiceNumber} exceeds its outstanding balance.`);
    mutation.mutate({
      ...form, customerId: Number(form.customerId), amountReceived: number(form.amountReceived), bankCharges: number(form.bankCharges),
      bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : null,
      tdsPercentage: form.tdsDeducted ? number(form.tdsPercentage) : 0, tdsAmount: form.tdsDeducted ? number(form.tdsAmount) : 0,
      tdsCertificateDate: form.tdsCertificateDate || null, chequeDate: form.chequeDate || null,
      allocations: allocations.map(({ invoice, row }) => ({ invoiceId: invoice.invoiceId, paymentApplied: number(row.paymentApplied), tdsApplied: form.tdsDeducted ? number(row.tdsApplied) : 0, creditApplied: number(row.creditApplied) })),
      idempotencyKey: isEdit ? `edit-payment-${id}` : crypto.randomUUID(),
    });
  };

  if (isEdit && paymentQuery.isLoading) return <PageLoading label="Loading payment..." />;
  return (
    <section className="space-y-5">
      <PageTitle title={isEdit ? 'Edit Payment Received' : 'Record Payment Received'} subtitle="Allocate one customer payment across open invoices" back="/sales/payments-received" actions={<><button onClick={() => navigate('/sales/payments-received')} className="secondary-button">Cancel</button><button onClick={submit} disabled={mutation.isPending} className="primary-button">{mutation.isPending ? 'Saving...' : 'Save Payment'}</button></>} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-4 xl:grid-cols-3">
        <FormSection title="Customer & Payment">
          <FieldLabel label="Customer" required><select value={form.customerId} onChange={(event) => changeCustomer(event.target.value)} className="form-control"><option value="">Select active customer</option>{(customersQuery.data || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.partyName}</option>)}</select></FieldLabel>
          {customer && <div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-black text-[#06134a]">{customer.partyName}</p><p className="mt-1 text-slate-600">{customer.partyEmail || customer.partyPhone || customer.partyCity || 'Customer master record'}</p></div>}
          <div className="grid gap-3 sm:grid-cols-2"><InputField label="Payment Date" required type="date" value={form.paymentDate} onChange={(value) => updateForm('paymentDate', value)} /><InputField label="Amount Received" required type="number" prefix="₹" value={form.amountReceived} onChange={(value) => updateForm('amountReceived', value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><SelectField label="Payment Mode" required value={form.paymentMode} onChange={(value) => updateForm('paymentMode', value)} options={PAYMENT_MODES} /><InputField label="Reference Number" value={form.referenceNumber} onChange={(value) => updateForm('referenceNumber', value)} /></div>
        </FormSection>
        <FormSection title="Tax Deducted">
          <div className="grid gap-2 sm:grid-cols-2"><RadioCard checked={!form.tdsDeducted} onChange={() => { updateForm('tdsDeducted', false); updateForm('tdsAmount', ''); setRows((current) => Object.fromEntries(Object.entries(current).map(([key, row]) => [key, { ...row, tdsApplied: '' }]))); }} label="No Tax Deducted" /><RadioCard checked={form.tdsDeducted} onChange={() => updateForm('tdsDeducted', true)} label="Yes, TDS (Income Tax)" /></div>
          {form.tdsDeducted && <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><InputField label="TDS Percentage" type="number" suffix="%" value={form.tdsPercentage} onChange={calculateTds} /><InputField label="TDS Amount" type="number" prefix="₹" value={form.tdsAmount} onChange={(value) => updateForm('tdsAmount', value)} /></div><div className="grid gap-3 sm:grid-cols-2"><InputField label="TDS Section / Code" value={form.tdsSectionCode} onChange={(value) => updateForm('tdsSectionCode', value)} /><InputField label="Certificate Number" value={form.tdsCertificateNumber} onChange={(value) => updateForm('tdsCertificateNumber', value)} /></div><InputField label="Certificate Date" type="date" value={form.tdsCertificateDate} onChange={(value) => updateForm('tdsCertificateDate', value)} /><InputField label="TDS Remarks" value={form.tdsRemarks} onChange={(value) => updateForm('tdsRemarks', value)} /></div>}
        </FormSection>
        <FormSection title="Bank Details (for this payment)">
          <BankAccountSelect label="Deposit To / Bank Account" value={form.bankAccountId} onChange={(value)=>updateForm('bankAccountId',value)} currency={invoices[0]?.currency || 'INR'} required={number(form.amountReceived)>0&&!['Cash','Other'].includes(form.paymentMode)} includeInactive={isEdit}/>
          <InputField label="Transaction ID" value={form.transactionId} onChange={(value) => updateForm('transactionId', value)} />
          {form.paymentMode === 'Cheque' && <div className="grid gap-3 sm:grid-cols-2"><InputField label="Cheque Number" value={form.chequeNumber} onChange={(value) => updateForm('chequeNumber', value)} /><InputField label="Cheque Date" type="date" value={form.chequeDate} onChange={(value) => updateForm('chequeDate', value)} /></div>}
          <InputField label="Bank Charges" type="number" prefix="₹" value={form.bankCharges} onChange={(value) => updateForm('bankCharges', value)} />
          <div className="rounded-lg bg-blue-50 p-3 text-xs font-bold text-blue-800"><p className="flex justify-between"><span>Gross Amount Received</span><span>{formatCurrency(number(form.amountReceived))}</span></p><p className="mt-2 flex justify-between"><span>Net Bank Credit</span><span>{formatCurrency(Math.max(0, number(form.amountReceived) - number(form.bankCharges)))}</span></p></div>
        </FormSection>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-[#06134a]">Allocate Payment</h2><p className="mt-1 text-xs font-semibold text-slate-500">Only open invoices for the selected customer are shown.</p></div><button type="button" disabled={!invoices.length} onClick={autoAllocate} className="secondary-button"><ArrowDownToLine className="h-4 w-4" /> Auto Allocate Oldest First</button></div>
        {!form.customerId && <EmptyState text="Select a customer to load unpaid invoices." />}
        {form.customerId && invoicesQuery.isLoading && <PageLoading label="Loading open invoices..." compact />}
        {invoicesQuery.isError && <Alert tone="error">{apiError(invoicesQuery.error, 'Open invoices could not be loaded.')}</Alert>}
        {form.customerId && !invoicesQuery.isLoading && !invoices.length && <EmptyState text="This customer has no unpaid or partially paid invoices." />}
        {invoices.length > 0 && <div className="overflow-x-auto"><table className="min-w-[1200px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr>{['', 'Invoice Number', 'Invoice Date', 'Due Date', 'Invoice Amount', 'Amount Paid', 'TDS Applied', 'Credits Applied', 'Balance Due', 'Payment Applied', 'TDS Applied Now', 'Credit Applied', 'Remaining'].map((label) => <th key={label} className="px-3 py-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{invoices.map((invoice) => { const row = rows[String(invoice.invoiceId)] || {}; const settlement = number(row.paymentApplied) + number(row.tdsApplied) + number(row.creditApplied); const remaining = Math.max(0, number(invoice.balanceDue) - settlement); return <tr key={invoice.invoiceId} className="align-middle"><td className="px-3 py-3"><input type="checkbox" checked={Boolean(row.enabled)} onChange={(event) => toggleRow(String(invoice.invoiceId), event.target.checked)} /></td><td className="px-3 py-3 font-black text-blue-600">{invoice.invoiceNumber}</td><td className="px-3 py-3">{formatDate(invoice.invoiceDate)}</td><td className="px-3 py-3">{formatDate(invoice.dueDate)}</td><MoneyCell value={invoice.invoiceAmount} /><MoneyCell value={invoice.amountPaid} /><MoneyCell value={invoice.tdsApplied} /><MoneyCell value={number(invoice.creditsApplied) + number(invoice.creditNotesApplied)} /><MoneyCell value={invoice.balanceDue} /><AllocationInput disabled={!row.enabled} value={row.paymentApplied} onChange={(value) => updateRow(String(invoice.invoiceId), 'paymentApplied', value)} /><AllocationInput disabled={!row.enabled || !form.tdsDeducted} value={row.tdsApplied} onChange={(value) => updateRow(String(invoice.invoiceId), 'tdsApplied', value)} /><AllocationInput disabled={!row.enabled} value={row.creditApplied} onChange={(value) => updateRow(String(invoice.invoiceId), 'creditApplied', value)} /><MoneyCell value={remaining} strong /></tr>; })}</tbody></table></div>}
        <div className="grid gap-2 border-t border-slate-200 bg-slate-50 p-4 text-sm font-bold sm:grid-cols-4"><SummaryValue label="Available Settlement" value={calculations.available} /><SummaryValue label="Allocated Settlement" value={calculations.allocated} /><SummaryValue label="Unallocated Amount" value={calculations.unallocated} tone={Math.abs(calculations.unallocated) > 0.009 ? 'red' : 'green'} /><SummaryValue label="Net Bank Credit" value={Math.max(0, number(form.amountReceived) - number(form.bankCharges))} /></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <FormSection title="Notes & Attachment"><FieldLabel label="Notes"><textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} rows="4" className="form-control h-auto py-3" placeholder="Add payment notes" /></FieldLabel><label className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 p-5 text-sm font-bold text-blue-600 hover:bg-blue-50"><Upload className="h-5 w-5" /> {fileName || (form.attachmentUrl ? 'Attachment uploaded' : 'Upload payment attachment')}<input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => uploadAttachment(event.target.files?.[0])} /></label></FormSection>
        <FormSection title="Receipt Delivery"><label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm font-bold text-[#06134a]"><input type="checkbox" checked={form.sendThankYouEmail} onChange={(event) => updateForm('sendThankYouEmail', event.target.checked)} className="mt-0.5" /><span>Send payment thank-you email<span className="mt-1 block text-xs font-semibold text-slate-500">The customer receives a receipt after the payment is saved.</span></span></label></FormSection>
      </div>
      <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur"><button onClick={() => navigate('/sales/payments-received')} className="secondary-button">Cancel</button><button onClick={submit} disabled={mutation.isPending} className="primary-button">{mutation.isPending ? 'Saving...' : 'Save Payment'}</button></div>
    </section>
  );
}

export function PaymentReceivedViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState('');
  const query = useQuery({ queryKey: ['payment-received', id], queryFn: () => paymentReceivedApi.get(id) });
  const reverseMutation = useMutation({ mutationFn: () => paymentReceivedApi.reverse({ id, reason }), onSuccess: () => { setConfirm(''); setReason(''); queryClient.invalidateQueries({ queryKey: ['payment-received'] }); queryClient.invalidateQueries({ queryKey: ['payments-received'] }); queryClient.invalidateQueries({ queryKey: ['invoice-lifecycle'] }); } });
  const deleteMutation = useMutation({ mutationFn: () => paymentReceivedApi.remove(id), onSuccess: () => navigate('/sales/payments-received', { replace: true, state: { message: 'Payment deleted and invoice balances recalculated.' } }) });
  if (query.isLoading) return <PageLoading label="Loading payment receipt..." />;
  if (query.isError) return <Alert tone="error">{apiError(query.error, 'Payment receipt could not be loaded.')}</Alert>;
  const payment = query.data;
  const emailReceipt = () => { window.location.href = `mailto:${payment.customerEmail || ''}?subject=${encodeURIComponent(`Payment Receipt ${payment.receiptNumber}`)}&body=${encodeURIComponent(`Thank you for your payment of ${formatCurrency(number(payment.grossAmountReceived))}. Receipt: ${payment.receiptNumber}`)}`; };
  const share = async () => { const text = `Payment receipt ${payment.receiptNumber} for ${formatCurrency(number(payment.grossAmountReceived))}`; if (navigator.share) await navigator.share({ title: payment.receiptNumber, text }); else await navigator.clipboard.writeText(text); };
  return (
    <section className="space-y-5">
      <PageTitle title={payment.receiptNumber || payment.paymentNumber} subtitle={`Payment ${payment.status}`} back="/sales/payments-received" actions={<StatusBadge value={payment.status} />} />
      {location.state?.message && <Alert tone="success">{location.state.message}</Alert>}
      {(reverseMutation.isError || deleteMutation.isError) && <Alert tone="error">{apiError(reverseMutation.error || deleteMutation.error, 'Payment action failed.')}</Alert>}
      <div className="flex flex-wrap items-center gap-1 border-y border-slate-200 bg-slate-50 px-2 py-2">
        <ToolbarButton icon={Edit3} label="Edit" disabled={payment.reversed || payment.reconciled} onClick={() => navigate(`/sales/payments-received/${id}/edit`)} />
        <ToolbarButton icon={Mail} label="Send Email" onClick={emailReceipt} /><ToolbarButton icon={Share2} label="Share" onClick={share} />
        <ToolbarButton icon={Download} label="Download PDF" onClick={() => openReceipt(payment, true)} /><ToolbarButton icon={Printer} label="Print" onClick={() => openReceipt(payment, false)} />
        <ToolbarButton icon={RotateCcw} label="Reverse" disabled={payment.reversed || payment.reconciled} onClick={() => setConfirm('reverse')} />
        <ToolbarButton icon={Trash2} label="Delete" danger disabled={payment.reconciled} onClick={() => setConfirm('delete')} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <FormSection title="Payment Receipt"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Customer" value={payment.customerName} /><Detail label="Payment Date" value={formatDate(payment.paymentDate)} /><Detail label="Payment Number" value={payment.paymentNumber} /><Detail label="Amount Received" value={formatCurrency(number(payment.grossAmountReceived))} strong /><Detail label="TDS Deducted" value={formatCurrency(number(payment.tdsAmount))} /><Detail label="Bank Charges" value={formatCurrency(number(payment.bankCharges))} /><Detail label="Net Bank Credit" value={formatCurrency(number(payment.netBankCredit))} /><Detail label="Payment Mode" value={payment.paymentMode || '-'} /><Detail label="Reference Number" value={payment.referenceNumber || '-'} /></div></FormSection>
          <FormSection title={`Allocated Invoices (${payment.allocations.length})`}><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Invoice Number', 'Invoice Date', 'Invoice Total', 'Payment Applied', 'TDS Applied', 'Credit Applied', 'Balance After'].map((label) => <th key={label} className="px-3 py-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{payment.allocations.map((allocation) => <tr key={allocation.invoiceId}><td className="px-3 py-4"><Link to={`/sales/invoices/${allocation.invoiceId}`} className="font-black text-blue-600 hover:underline">{allocation.invoiceNumber}</Link></td><td className="px-3 py-4">{formatDate(allocation.invoiceDate)}</td><MoneyCell value={allocation.invoiceTotal} /><MoneyCell value={allocation.paymentApplied} /><MoneyCell value={allocation.tdsApplied} /><MoneyCell value={allocation.creditApplied} /><MoneyCell value={allocation.balanceAfterPayment} strong /></tr>)}</tbody></table></div></FormSection>
        </div>
        <div className="space-y-4"><FormSection title="Bank Details"><Detail label="Deposit To" value={payment.depositAccount || '-'} /><Detail label="Account Name" value={payment.bankAccountName || '-'} /><Detail label="Bank Name" value={payment.bankName || '-'} /><Detail label="Account Number" value={payment.maskedAccountNumber || '-'} /><Detail label="Transaction ID" value={payment.transactionId || '-'} />{payment.chequeNumber && <><Detail label="Cheque Number" value={payment.chequeNumber} /><Detail label="Cheque Date" value={formatDate(payment.chequeDate)} /></>}</FormSection><FormSection title="Settlement Summary"><SummaryValue label="Gross Amount" value={payment.grossAmountReceived} /><SummaryValue label="TDS Deducted" value={payment.tdsAmount} /><SummaryValue label="Allocated Settlement" value={payment.allocatedAmount} /><SummaryValue label="Unallocated Amount" value={payment.unallocatedAmount} tone={number(payment.unallocatedAmount) ? 'red' : 'green'} /><SummaryValue label="Net Bank Credit" value={payment.netBankCredit} /></FormSection>{payment.notes && <FormSection title="Notes"><p className="whitespace-pre-wrap text-sm text-slate-700">{payment.notes}</p></FormSection>}{payment.attachmentUrl && <a href={payment.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-black text-blue-600"><Paperclip className="h-5 w-5" /> View Attachment</a>}</div>
      </div>
      <ConfirmDialog open={confirm === 'delete'} title="Delete payment?" message="The receipt will be deleted and all linked invoice balances will be recalculated." loading={deleteMutation.isPending} onCancel={() => setConfirm('')} onConfirm={() => deleteMutation.mutate()} />
      {confirm === 'reverse' && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-black text-[#06134a]">Reverse payment?</h2><p className="mt-2 text-sm text-slate-600">All invoice allocations will be reversed and balances recalculated.</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows="3" placeholder="Reason for reversal" className="form-control mt-4 h-auto py-3" /><div className="mt-5 flex justify-end gap-3"><button onClick={() => setConfirm('')} className="secondary-button">Cancel</button><button onClick={() => reverseMutation.mutate()} disabled={reverseMutation.isPending} className="primary-button">Reverse Payment</button></div></div></div>}
    </section>
  );
}

function useActiveCustomers() {
  return useQuery({
    queryKey: ['active-customers-for-payment'],
    queryFn: async () => {
      const data = await recordsApi.list({ module: 'sales', type: 'customers', page: 0, size: 500, status: 'Active', sort: 'partyName,asc' });
      return data.content || [];
    },
    staleTime: 60_000,
  });
}

function SummaryWidget({ title, value, caption, icon: Icon, tone, active, action, loading }) {
  const styles = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', purple: 'bg-violet-50 text-violet-600', orange: 'bg-orange-50 text-orange-600' };
  return <button type="button" onClick={action} className={`flex min-h-28 items-center gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${styles[tone]}`}><Icon className="h-6 w-6" /></span><span className="min-w-0"><span className="block text-xs font-bold text-slate-600">{title}</span>{loading ? <span className="mt-2 block h-6 w-24 animate-pulse rounded bg-slate-200" /> : <span className="mt-1 block text-xl font-black text-[#06134a]">{formatCurrency(number(value))}</span>}<span className="mt-1 block text-xs font-semibold text-slate-500">{caption || '-'}</span></span></button>;
}

function PageTitle({ title, subtitle, back, actions }) {
  return <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><Link to={back} className="mt-1 grid h-8 w-8 place-items-center rounded-lg border border-slate-200"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="text-2xl font-black text-[#06134a]">{title}</h1><p className="mt-1 text-sm font-semibold text-slate-600">{subtitle}</p></div></div><div className="flex flex-wrap gap-3">{actions}</div></header>;
}

function FormSection({ title, children }) { return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black text-[#06134a]">{title}</h2>{children}</section>; }
function FieldLabel({ label, required, children }) { return <label className="block text-xs font-bold text-[#06134a]"><span className="mb-2 block">{label}{required && <span className="text-red-600"> *</span>}</span>{children}</label>; }
function InputField({ label, required, type = 'text', value, onChange, prefix, suffix, placeholder }) { return <FieldLabel label={label} required={required}><span className="relative block">{prefix && <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-500">{prefix}</span>}<input type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`form-control ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-8' : ''}`} />{suffix && <span className="absolute right-3 top-2.5 text-sm font-bold text-slate-500">{suffix}</span>}</span></FieldLabel>; }
function SelectField({ label, required, value, onChange, options }) { return <FieldLabel label={label} required={required}><select value={value} onChange={(event) => onChange(event.target.value)} className="form-control"><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option}>{option}</option>)}</select></FieldLabel>; }
function RadioCard({ checked, onChange, label }) { return <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-bold ${checked ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-700'}`}><input type="radio" checked={checked} onChange={onChange} />{label}</label>; }
function AllocationInput({ disabled, value, onChange }) { return <td className="px-2 py-2"><input disabled={disabled} type="number" min="0" step="0.01" value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-28 rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-red-400 disabled:bg-slate-100" /></td>; }
function MoneyCell({ value, strong }) { return <td className={`px-2 py-3 text-right tabular-nums ${strong ? 'font-black' : 'font-semibold'}`}>{formatCurrency(number(value))}</td>; }
function SummaryValue({ label, value, tone }) { return <p className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{label}</span><span className={`font-black tabular-nums ${tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-600' : 'text-[#06134a]'}`}>{formatCurrency(number(value))}</span></p>; }
function Detail({ label, value, strong }) { return <div><p className="text-xs font-bold text-slate-500">{label}</p><p className={`mt-1 break-words text-sm text-[#06134a] ${strong ? 'text-lg font-black' : 'font-bold'}`}>{value || '-'}</p></div>; }
function StatusBadge({ value }) { const tone = value === 'Paid' ? 'bg-emerald-100 text-emerald-700' : value === 'Reversed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'; return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black uppercase ${tone}`}>{value}</span>; }
function ToolbarButton({ icon: Icon, label, onClick, disabled, danger }) { return <button disabled={disabled} onClick={onClick} className={`inline-flex h-10 items-center gap-2 border-r border-slate-200 px-4 text-sm font-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'text-red-600' : 'text-[#06134a]'}`}><Icon className="h-4 w-4" />{label}</button>; }
function Alert({ tone, children }) { return <div className={`rounded-lg border p-4 text-sm font-bold ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</div>; }
function EmptyState({ text }) { return <div className="grid min-h-32 place-items-center p-6 text-sm font-bold text-slate-500">{text}</div>; }
function PageLoading({ label, compact }) { return <div className={`grid place-items-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-500 ${compact ? 'min-h-28' : 'min-h-72'}`}>{label}</div>; }
function SkeletonRows({ columns }) { return Array.from({ length: 5 }).map((_, row) => <tr key={row}>{Array.from({ length: columns }).map((__, col) => <td key={col} className="px-2 py-4"><span className="block h-3 animate-pulse rounded bg-slate-100" /></td>)}</tr>); }

function RowMenu({ actions, onClose }) { return <><button aria-label="Close menu" onClick={onClose} className="fixed inset-0 z-20 cursor-default" /><div className="absolute right-2 top-11 z-30 w-36 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl">{actions.map(({ label, icon: Icon, onClick, danger, disabled }) => <button key={label} disabled={disabled} onClick={() => { onClick(); onClose(); }} className={`flex w-full items-center gap-2 px-3 py-2 text-left font-bold hover:bg-slate-50 disabled:opacity-40 ${danger ? 'text-red-600' : 'text-[#06134a]'}`}><Icon className="h-4 w-4" />{label}</button>)}</div></>; }
function InvoiceLinks({ allocations }) { if (!allocations?.length) return <span>-</span>; const [first, ...rest] = allocations; return <span><Link to={`/sales/invoices/${first.invoiceId}`} className="font-bold text-blue-600 hover:underline">{first.invoiceNumber}</Link>{rest.length > 0 && <span title={rest.map((item) => item.invoiceNumber).join(', ')} className="ml-1 rounded bg-blue-50 px-1 py-0.5 font-black text-blue-600">+{rest.length}</span>}</span>; }

function Pagination({ page, size, data, onPage, onSize }) { const totalPages = Math.max(data?.totalPages || 1, 1); const total = data?.totalElements || 0; const shown = data?.numberOfElements || 0; const start = total ? page * size + 1 : 0; return <div className="flex flex-col gap-3 text-sm font-bold text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>Showing {start} to {start + Math.max(shown - 1, 0)} of {total} payments</span><div className="flex items-center gap-2"><select value={size} onChange={(event) => onSize(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 px-3">{PAGE_SIZES.map((option) => <option key={option} value={option}>{option} / page</option>)}</select><button disabled={page <= 0} onClick={() => onPage(page - 1)} className="page-button"><ChevronLeft className="h-4 w-4" /></button><span className="grid h-9 min-w-9 place-items-center rounded-lg bg-red-600 px-3 text-white">{page + 1}</span><button disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} className="page-button"><ChevronRight className="h-4 w-4" /></button></div></div>; }

function allocationTotals(form, rows) { const allocated = Object.values(rows).filter((row) => row.enabled).reduce((sum, row) => sum + number(row.paymentApplied) + number(row.tdsApplied) + number(row.creditApplied), 0); const credits = Object.values(rows).filter((row) => row.enabled).reduce((sum, row) => sum + number(row.creditApplied), 0); const available = number(form.amountReceived) + (form.tdsDeducted ? number(form.tdsAmount) : 0) + credits; return { available: round(available), allocated: round(allocated), unallocated: round(available - allocated) }; }
function number(value) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function round(value) { return Math.round((number(value) + Number.EPSILON) * 100) / 100; }
function valueNumber(value) { return value > 0 ? String(round(value)) : ''; }
function toLocalIso(date) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10); }
function apiError(error, fallback) { return error?.response?.data?.message || error?.response?.data?.detail || error?.message || fallback; }

function openReceipt(payment, pdf) {
  const view = window.open('', '_blank', 'width=900,height=900');
  if (!view) return;
  const allocations = (payment.allocations || []).map((item) => `<tr><td>${escapeHtml(item.invoiceNumber)}</td><td>${escapeHtml(formatCurrency(number(item.paymentApplied)))}</td><td>${escapeHtml(formatCurrency(number(item.tdsApplied)))}</td><td>${escapeHtml(formatCurrency(number(item.balanceAfterPayment)))}</td></tr>`).join('');
  view.document.write(`<!doctype html><html><head><title>${escapeHtml(payment.receiptNumber)}</title><style>body{font-family:Arial,sans-serif;color:#06134a;margin:0;padding:32px}.actions{text-align:right;margin-bottom:18px}.actions button{background:#dc2626;color:white;border:0;border-radius:6px;padding:10px 16px;font-weight:700}.sheet{max-width:780px;margin:auto;border:1px solid #dbe3ef;padding:36px}h1{font-size:26px;margin:0}h2{font-size:17px;color:#dc2626;margin:6px 0 28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}.grid p{margin:0;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #e2e8f0;padding:10px;text-align:left;font-size:12px}th{background:#f8fafc}.totals{margin:28px 0 0 auto;width:340px}.totals p{display:flex;justify-content:space-between;font-size:13px}.totals .strong{font-size:16px;font-weight:800}@media print{.actions{display:none}.sheet{border:0;padding:0}body{padding:0}}</style></head><body><div class="actions"><button onclick="window.print()">${pdf ? 'Save as PDF' : 'Print Receipt'}</button></div><main class="sheet"><h1>IntelliaTech Books</h1><h2>PAYMENT RECEIPT</h2><div class="grid"><p><b>Receipt Number</b><br>${escapeHtml(payment.receiptNumber)}</p><p><b>Payment Date</b><br>${escapeHtml(formatDate(payment.paymentDate))}</p><p><b>Customer</b><br>${escapeHtml(payment.customerName)}</p><p><b>Payment Mode</b><br>${escapeHtml(payment.paymentMode || '-')}</p></div><table><thead><tr><th>Invoice</th><th>Payment Applied</th><th>TDS Applied</th><th>Balance After</th></tr></thead><tbody>${allocations}</tbody></table><div class="totals"><p><span>Gross Amount Received</span><b>${escapeHtml(formatCurrency(number(payment.grossAmountReceived)))}</b></p><p><span>TDS Deducted</span><b>${escapeHtml(formatCurrency(number(payment.tdsAmount)))}</b></p><p><span>Bank Charges</span><b>${escapeHtml(formatCurrency(number(payment.bankCharges)))}</b></p><p class="strong"><span>Net Bank Credit</span><span>${escapeHtml(formatCurrency(number(payment.netBankCredit)))}</span></p></div>${payment.notes ? `<p><b>Notes</b><br>${escapeHtml(payment.notes)}</p>` : ''}</main></body></html>`);
  view.document.close(); view.focus(); if (pdf) window.setTimeout(() => view.print(), 300);
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
