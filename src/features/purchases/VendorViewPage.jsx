import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Landmark,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { vendorsApi } from '../../api/vendorsApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import intelliatechLogo from '../../assets/intelliatech-logo-black-tm.png';

const statusClasses = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Approved: 'bg-blue-50 text-blue-700 ring-blue-200',
  Due: 'bg-amber-50 text-amber-700 ring-amber-200',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  Overdue: 'bg-red-50 text-red-700 ring-red-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const transactionTypes = [
  { value: '', label: 'All Transactions' },
  { value: 'orders', label: 'Purchase Orders' },
  { value: 'bills', label: 'Bills' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'paymentsMade', label: 'Payments Made' },
  { value: 'vendorCredits', label: 'Vendor Credits' },
];

const statementPresets = [
  ['today', 'Today'],
  ['thisWeek', 'This Week'],
  ['thisMonth', 'This Month'],
  ['lastMonth', 'Last Month'],
  ['thisQuarter', 'This Quarter'],
  ['lastQuarter', 'Last Quarter'],
  ['thisFinancialYear', 'This Financial Year'],
  ['lastFinancialYear', 'Last Financial Year'],
  ['custom', 'Custom Date Range'],
];

function currency(value, configuredCurrency = 'INR') {
  const code = String(configuredCurrency || 'INR').startsWith('USD') ? 'USD' : 'INR';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function apiError(error, fallback) {
  const fields = error?.response?.data?.validationErrors;
  if (fields && Object.keys(fields).length) return Object.values(fields)[0];
  return error?.response?.data?.message || fallback;
}

function initials(name) {
  return String(name || 'V')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function Badge({ value }) {
  const label = String(value || '-').replaceAll('_', ' ');
  return (
    <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black ring-1 ring-inset ${statusClasses[value] || 'bg-blue-50 text-blue-700 ring-blue-200'}`}>
      {label}
    </span>
  );
}

function ActionButton({ icon: Icon, children, onClick, primary = false, danger = false, disabled, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
          : danger
            ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
            : 'border-slate-200 bg-white text-[#06134a] hover:bg-slate-50'
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function Metric({ label, value, tone = 'blue', icon: Icon }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-amber-50 text-amber-600',
    purple: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <p className="mt-1 truncate text-lg font-black text-[#06134a]">{value}</p>
      </div>
    </div>
  );
}

function Loading({ label = 'Loading vendor...' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm font-black text-[#06134a]">
      <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-4 border-red-100 border-t-red-600" />
      {label}
    </div>
  );
}

function ErrorState({ message }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{message}</div>;
}

function Notice({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Close message"><X className="h-4 w-4" /></button>
    </div>
  );
}

function Menu({ open, children, width = 'w-52' }) {
  if (!open) return null;
  return <div className={`absolute right-0 top-11 z-40 ${width} overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl`}>{children}</div>;
}

function MenuLink({ to, icon: Icon, children, onClick }) {
  return (
    <Link to={to} onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#06134a] hover:bg-slate-50">
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

function MenuButton({ icon: Icon, children, onClick, danger = false }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold hover:bg-slate-50 ${danger ? 'text-red-600' : 'text-[#06134a]'}`}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

export function VendorViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = ['overview', 'transactions', 'statement'].includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';
  const [newMenu, setNewMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [message, setMessage] = useState(location.state?.message || '');

  const vendorQuery = useQuery({ queryKey: ['vendor', id], queryFn: () => vendorsApi.get(id) });
  const recentQuery = useQuery({
    queryKey: ['vendor-transactions-recent', id],
    queryFn: () => vendorsApi.transactions(id, { page: 0, size: 5, sort: 'recordDate,desc' }),
    enabled: Boolean(id),
  });

  const refreshVendor = () => {
    queryClient.invalidateQueries({ queryKey: ['vendor', id] });
    queryClient.invalidateQueries({ queryKey: ['vendors'] });
    queryClient.invalidateQueries({ queryKey: ['vendors-summary'] });
  };
  const statusMutation = useMutation({
    mutationFn: (status) => vendorsApi.updateStatus(id, status),
    onSuccess: (_, status) => {
      setMoreMenu(false);
      setMessage(`Vendor marked as ${status === 'ACTIVE' ? 'active' : 'inactive'}.`);
      refreshVendor();
    },
  });
  const cloneMutation = useMutation({
    mutationFn: () => vendorsApi.clone(id),
    onSuccess: (vendor) => {
      refreshVendor();
      navigate(`/purchases/vendors/${vendor.id}/edit`, { state: { message: 'Vendor cloned successfully.' } });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => vendorsApi.remove(id),
    onSuccess: () => {
      refreshVendor();
      navigate('/purchases/vendors', { replace: true, state: { message: 'Vendor deleted successfully.' } });
    },
  });

  const setTab = (tab) => setSearchParams(tab === 'overview' ? {} : { tab });
  if (vendorQuery.isPending) return <Loading />;
  if (vendorQuery.isError) return <ErrorState message={apiError(vendorQuery.error, 'Unable to load vendor.')} />;

  const vendor = vendorQuery.data;
  const summary = vendor.financialSummary || {};
  return (
    <section className="space-y-4">
      <div className="vendor-screen-only flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate('/purchases/vendors')} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-[#06134a] hover:bg-slate-50" aria-label="Back to vendors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-50 text-lg font-black text-red-600">{initials(vendor.vendorName)}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-black text-[#06134a]">{vendor.vendorName}</h1>
              <Badge value={vendor.status} />
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-slate-500">{vendor.companyName || vendor.displayName} · {vendor.vendorNumber}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/purchases/vendors/${id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#06134a] hover:bg-slate-50"><Edit3 className="h-4 w-4" /> Edit</Link>
          <div className="relative">
            <ActionButton icon={Plus} primary onClick={() => { setNewMenu((value) => !value); setMoreMenu(false); }}>New Transaction <ChevronDown className="h-4 w-4" /></ActionButton>
            <Menu open={newMenu}>
              <MenuLink to={`/purchases/orders/new?vendorId=${id}`} icon={ShoppingCart} onClick={() => setNewMenu(false)}>Purchase Order</MenuLink>
              <MenuLink to={`/purchases/bills/new?vendorId=${id}`} icon={ReceiptText} onClick={() => setNewMenu(false)}>Bill</MenuLink>
              <MenuLink to={`/purchases/expenses/new?vendorId=${id}`} icon={WalletCards} onClick={() => setNewMenu(false)}>Expense</MenuLink>
            </Menu>
          </div>
          <div className="relative">
            <ActionButton icon={MoreVertical} onClick={() => { setMoreMenu((value) => !value); setNewMenu(false); }}>More</ActionButton>
            <Menu open={moreMenu}>
              <MenuButton icon={CheckCircle2} onClick={() => statusMutation.mutate(vendor.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}>
                Mark as {vendor.status === 'ACTIVE' ? 'Inactive' : 'Active'}
              </MenuButton>
              <MenuButton icon={Copy} onClick={() => cloneMutation.mutate()}>Clone Vendor</MenuButton>
              <MenuButton icon={Trash2} danger onClick={() => { setMoreMenu(false); setDeleteOpen(true); }}>Delete Vendor</MenuButton>
            </Menu>
          </div>
        </div>
      </div>

      <Notice message={message} onClose={() => setMessage('')} />
      {(statusMutation.isError || cloneMutation.isError || deleteMutation.isError) && (
        <ErrorState message={apiError(statusMutation.error || cloneMutation.error || deleteMutation.error, 'Vendor action failed.')} />
      )}

      <div className="vendor-screen-only grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Outstanding Payables" value={currency(summary.outstandingPayables, vendor.currency)} icon={WalletCards} tone="red" />
        <Metric label="Overdue Amount" value={currency(summary.overdueAmount, vendor.currency)} icon={Clock3} tone="orange" />
        <Metric label="Unused Credits" value={currency(summary.unusedCredits, vendor.currency)} icon={CircleDollarSign} tone="green" />
        <Metric label="Total Purchases" value={currency(summary.totalPurchases, vendor.currency)} icon={ShoppingCart} tone="purple" />
        <Metric label="Total Paid" value={currency(summary.totalPaid, vendor.currency)} icon={Banknote} tone="blue" />
      </div>

      <div className="vendor-screen-only flex overflow-x-auto border-b border-slate-200 bg-white px-2">
        {[['overview', 'Overview'], ['transactions', 'Transactions'], ['statement', 'Statement']].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={`h-12 whitespace-nowrap border-b-2 px-5 text-sm font-black transition ${activeTab === value ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-[#06134a]'}`}>{label}</button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab vendor={vendor} recentQuery={recentQuery} />}
      {activeTab === 'transactions' && <TransactionsTab vendor={vendor} />}
      {activeTab === 'statement' && <StatementTab vendor={vendor} />}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete vendor?"
        message={`Are you sure you want to delete vendor '${vendor.vendorName}'? This action cannot be undone.`}
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </section>
  );
}

function OverviewTab({ vendor, recentQuery }) {
  const financial = vendor.financialSummary || {};
  const bank = vendor.bankDetails;
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <DetailCard title="Vendor Details" icon={Building2}>
          <DetailGrid items={[
            ['Vendor Name', vendor.vendorName],
            ['Display Name', vendor.displayName],
            ['Company Name', vendor.companyName],
            ['Vendor Type', vendor.vendorType],
            ['Source of Supply', vendor.sourceOfSupply],
            ['Currency', vendor.currency],
            ['Payment Terms', vendor.paymentTerms],
            ['Tax Treatment', vendor.taxTreatment],
            ['GSTIN', vendor.gstin],
            ['PAN', vendor.pan],
            ['Status', <Badge key="status" value={vendor.status} />],
            ['Created Date', formatDate(vendor.createdAt)],
            ['Updated Date', formatDate(vendor.updatedAt)],
          ]} />
        </DetailCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <DetailCard title="Contact Details" icon={UserRound}>
            <DetailGrid items={[
              ['Primary Contact', vendor.primaryContact],
              ['Email', vendor.email],
              ['Phone', vendor.phone],
              ['Mobile', vendor.mobile],
              ['Website', vendor.website],
            ]} />
          </DetailCard>
          <DetailCard title="Bank Details" icon={Landmark}>
            {bank ? <DetailGrid items={[
              ['Account Holder', bank.accountHolderName],
              ['Beneficiary', bank.beneficiaryName],
              ['Bank Name', bank.bankName],
              ['Account Number', bank.maskedAccountNumber],
              ['IFSC Code', bank.ifscCode],
              ['Branch', bank.branchName],
              ['Account Type', bank.accountType],
              ['SWIFT Code', bank.swiftCode],
              ['IBAN', bank.iban],
              ['Bank Country', bank.bankCountry],
              ['Bank Address', bank.bankAddress],
              ['UPI ID', bank.upiId],
              ['Notes', bank.notes],
            ]} /> : <EmptyInline text="No bank details have been added." />}
          </DetailCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AddressCard title="Billing Address" vendor={vendor} prefix="billing" />
          <AddressCard title="Shipping Address" vendor={vendor} prefix="shipping" />
        </div>
      </div>
      <div className="space-y-4">
        <DetailCard title="Financial Summary" icon={CircleDollarSign}>
          <div className="divide-y divide-slate-100">
            {[
              ['Total Purchases', financial.totalPurchases, 'text-[#06134a]'],
              ['Total Paid', financial.totalPaid, 'text-emerald-600'],
              ['Outstanding Payables', financial.outstandingPayables, 'text-red-600'],
              ['Overdue Amount', financial.overdueAmount, 'text-amber-600'],
              ['Unused Vendor Credits', financial.unusedCredits, 'text-blue-600'],
            ].map(([label, value, color]) => <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="font-bold text-slate-500">{label}</span><b className={color}>{currency(value, vendor.currency)}</b></div>)}
          </div>
        </DetailCard>
        <DetailCard title="Recent Transactions" icon={ReceiptText}>
          {recentQuery.isPending ? <Loading label="Loading transactions..." /> : recentQuery.isError ? <ErrorState message="Unable to load recent transactions." /> : recentQuery.data?.content?.length ? (
            <div className="divide-y divide-slate-100">
              {recentQuery.data.content.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    {transaction.viewPath ? <Link to={transaction.viewPath} className="truncate text-sm font-black text-blue-600 hover:underline">{transaction.transactionNumber}</Link> : <p className="truncate text-sm font-black text-[#06134a]">{transaction.transactionNumber}</p>}
                    <p className="mt-1 text-xs font-semibold text-slate-500">{transaction.transactionType} · {formatDate(transaction.date)}</p>
                  </div>
                  <div className="shrink-0 text-right"><p className="text-sm font-black text-[#06134a]">{currency(transaction.totalAmount, vendor.currency)}</p><Badge value={transaction.status} /></div>
                </div>
              ))}
            </div>
          ) : <EmptyInline text="No vendor transactions found." />}
        </DetailCard>
      </div>
    </div>
  );
}

function DetailCard({ title, icon: Icon, children }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[#06134a]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600"><Icon className="h-4 w-4" /></span>
        {title}
      </h2>
      {children}
    </article>
  );
}

function DetailGrid({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-bold text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-black text-[#06134a]">{value || '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

function AddressCard({ title, vendor, prefix }) {
  const address = [
    vendor[`${prefix}AddressLine1`],
    vendor[`${prefix}AddressLine2`],
    vendor[`${prefix}City`],
    vendor[`${prefix}State`],
    vendor[`${prefix}Pincode`],
    vendor[`${prefix}Country`],
  ].filter(Boolean);
  return (
    <DetailCard title={title} icon={MapPin}>
      {address.length ? <address className="text-sm font-semibold not-italic leading-7 text-[#06134a]">{address.map((line) => <div key={line}>{line}</div>)}</address> : <EmptyInline text={`No ${title.toLowerCase()} available.`} />}
    </DetailCard>
  );
}

function EmptyInline({ text }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">{text}</div>;
}

function TransactionsTab({ vendor }) {
  const { id } = vendor;
  const [search, setSearch] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('recordDate,desc');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const params = { search, transactionType, status, dateFrom, dateTo, sort, page, size };
  const query = useQuery({ queryKey: ['vendor-transactions', id, params], queryFn: () => vendorsApi.transactions(id, params), placeholderData: (previous) => previous });
  const rows = query.data?.content || [];
  const reset = () => { setSearch(''); setTransactionType(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(0); };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[1.5fr_0.8fr_0.7fr_0.7fr_0.7fr_0.8fr_auto]">
        <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search transaction or reference" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-red-300" /></label>
        <select value={transactionType} onChange={(event) => { setTransactionType(event.target.value); setPage(0); }} className="form-control">{transactionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="form-control"><option value="">All Status</option><option>Pending</option><option>Approved</option><option>Due</option><option>Overdue</option><option>Paid</option><option>Cancelled</option></select>
        <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(0); }} className="form-control" aria-label="From date" />
        <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(0); }} className="form-control" aria-label="To date" />
        <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }} className="form-control"><option value="recordDate,desc">Newest First</option><option value="recordDate,asc">Oldest First</option></select>
        <ActionButton onClick={reset}>Reset</ActionButton>
      </div>
      {query.isPending ? <Loading label="Loading transactions..." /> : query.isError ? <ErrorState message={apiError(query.error, 'Unable to load vendor transactions.')} /> : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Date', 'Type', 'Transaction Number', 'Reference', 'Due Date', 'Total Amount', 'Paid Amount', 'Balance', 'Status'].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-black">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 text-[#06134a]">
                {rows.map((transaction) => <tr key={transaction.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3">{formatDate(transaction.date)}</td><td className="whitespace-nowrap px-4 py-3 font-bold">{transaction.transactionType}</td><td className="whitespace-nowrap px-4 py-3">{transaction.viewPath ? <Link to={transaction.viewPath} className="font-black text-blue-600 hover:underline">{transaction.transactionNumber}</Link> : <b>{transaction.transactionNumber}</b>}</td><td className="whitespace-nowrap px-4 py-3">{transaction.referenceNumber || '-'}</td><td className="whitespace-nowrap px-4 py-3">{formatDate(transaction.dueDate)}</td><td className="whitespace-nowrap px-4 py-3 font-black">{currency(transaction.totalAmount, vendor.currency)}</td><td className="whitespace-nowrap px-4 py-3 text-emerald-600">{currency(transaction.paidAmount, vendor.currency)}</td><td className="whitespace-nowrap px-4 py-3 font-black text-red-600">{currency(transaction.balance, vendor.currency)}</td><td className="px-4 py-3"><Badge value={transaction.status} /></td></tr>)}
                {!rows.length && <tr><td colSpan="9" className="px-6 py-14 text-center text-sm font-semibold text-slate-500">No transactions found for the selected filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <TablePagination page={page} size={size} count={rows.length} totalPages={query.data?.totalPages || 1} totalElements={query.data?.totalElements || 0} onPage={setPage} onSize={(value) => { setSize(value); setPage(0); }} noun="transactions" />
        </div>
      )}
    </div>
  );
}

function StatementTab({ vendor }) {
  const { id } = vendor;
  const [preset, setPreset] = useState('thisMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [emailOpen, setEmailOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const range = useMemo(() => statementRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const params = { dateFrom: range.dateFrom, dateTo: range.dateTo, transactionType };
  const query = useQuery({
    queryKey: ['vendor-statement', id, params],
    queryFn: () => vendorsApi.statement(id, params),
    enabled: preset !== 'custom' || Boolean(customFrom && customTo),
  });
  const data = query.data;
  const download = async (format) => {
    setDownloadError('');
    try {
      const response = await vendorsApi.downloadStatement(id, format, params);
      saveBlob(response, `Vendor-Statement-${safeFilename(vendor.vendorName)}-${range.dateFrom}-to-${range.dateTo}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
    } catch (error) {
      setDownloadError(apiError(error, `Unable to export ${format === 'excel' ? 'Excel' : 'PDF'} statement.`));
    }
  };
  const print = () => {
    document.body.classList.add('vendor-statement-print');
    const cleanup = () => document.body.classList.remove('vendor-statement-print');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  };
  return (
    <div className="space-y-4">
      <div className="vendor-screen-only flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select value={preset} onChange={(event) => setPreset(event.target.value)} className="form-control w-auto min-w-48">{statementPresets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {preset === 'custom' && <><input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="form-control w-auto" aria-label="Statement from date" /><input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="form-control w-auto" aria-label="Statement to date" /></>}
          <select value={transactionType} onChange={(event) => setTransactionType(event.target.value)} className="form-control w-auto min-w-48"><option value="all">All Transactions</option>{transactionTypes.slice(1).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton icon={Printer} onClick={print} disabled={!data}>Print</ActionButton>
          <ActionButton icon={FileText} onClick={() => download('pdf')} disabled={!data}>Export PDF</ActionButton>
          <ActionButton icon={FileSpreadsheet} onClick={() => download('excel')} disabled={!data}>Export Excel</ActionButton>
          <ActionButton icon={Mail} primary onClick={() => setEmailOpen(true)} disabled={!data}>Send Email</ActionButton>
        </div>
      </div>
      <Notice message={notice} onClose={() => setNotice('')} />
      {downloadError && <ErrorState message={downloadError} />}
      {preset === 'custom' && (!customFrom || !customTo) ? <EmptyInline text="Select both From Date and To Date to generate the statement." /> : query.isPending ? <Loading label="Generating vendor statement..." /> : query.isError ? <ErrorState message={apiError(query.error, 'Unable to load vendor statement.')} /> : <StatementPreview data={data} />}
      <StatementEmailDialog open={emailOpen} vendor={vendor} statement={data} params={params} onClose={() => setEmailOpen(false)} onSent={(result) => { setEmailOpen(false); setNotice(result.message || 'Vendor statement email queued successfully.'); }} />
    </div>
  );
}

function StatementPreview({ data }) {
  const { company, vendor, summary, transactions } = data;
  const vendorAddress = [
    vendor.billingAddressLine1,
    vendor.billingAddressLine2,
    vendor.billingCity,
    [vendor.billingPincode, vendor.billingState].filter(Boolean).join(' '),
    vendor.billingCountry,
  ].filter(Boolean);
  const companyAddress = [
    company.address,
    [company.state, company.pincode].filter(Boolean).join(' '),
    company.country,
  ].filter(Boolean);
  const accountSummary = [
    ['Opening Balance', summary.openingBalance],
    ['Billed Amount', summary.totalDebit],
    ['Amount Paid', summary.totalCredit],
    ['Balance Due', summary.closingBalance],
  ];
  return (
    <article className="vendor-statement-preview mx-auto max-w-[1050px] overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="vendor-statement-sheet">
        <div className="vendor-statement-company">
          <div className="vendor-statement-logo-wrap">
            <img src={company.logoUrl || intelliatechLogo} alt={company.name} className="vendor-statement-logo" />
          </div>
          <div className="vendor-statement-company-details">
            <h2>{company.name}</h2>
            <AddressLines lines={companyAddress} />
            <ContactLines email={company.email} phone={company.phone} gstin={company.gstin} website={company.website} />
          </div>
        </div>

        <div className="vendor-statement-heading-grid">
          <section className="vendor-statement-recipient">
            <p className="vendor-statement-to">To</p>
            <h3>{vendor.vendorName}</h3>
            {vendor.companyName && vendor.companyName !== vendor.vendorName && <p>{vendor.companyName}</p>}
            <AddressLines lines={vendorAddress} />
            <ContactLines email={vendor.email} phone={vendor.phone} gstin={vendor.gstin} />
          </section>
          <section className="vendor-statement-summary">
            <h1>STATEMENT OF ACCOUNTS</h1>
            <p className="vendor-statement-period">{formatStatementDate(data.dateFrom)} To {formatStatementDate(data.dateTo)}</p>
            <div className="vendor-statement-summary-box">
              <h4>Account Summary</h4>
              {accountSummary.map(([label, value]) => (
                <div key={label} className={label === 'Balance Due' ? 'is-total' : ''}>
                  <span>{label}</span>
                  <b>{currency(value, vendor.currency)}</b>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="vendor-statement-table-wrap">
          <table className="vendor-statement-table">
            <thead><tr>{['Date', 'Transactions', 'Details', 'Amount', 'Payments', 'Balance'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {!transactions.length && <tr className="vendor-statement-opening-row">
                <td>{formatStatementDate(data.dateFrom)}</td>
                <td>***Opening Balance***</td>
                <td />
                <td>{currency(summary.openingBalance, vendor.currency)}</td>
                <td />
                <td>{currency(summary.openingBalance, vendor.currency)}</td>
              </tr>}
              {transactions.map((line, index) => (
                <tr key={`${line.transactionNumber}-${index}`}>
                  <td>{formatStatementDate(line.date)}</td>
                  <td><b>{line.transactionType}</b>{line.viewPath ? <Link to={line.viewPath}>{line.transactionNumber}</Link> : <span>{line.transactionNumber}</span>}</td>
                  <td>{line.description || line.referenceNumber || '-'}</td>
                  <td>{Number(line.debit || 0) ? currency(line.debit, vendor.currency) : ''}</td>
                  <td>{Number(line.credit || 0) ? currency(line.credit, vendor.currency) : ''}</td>
                  <td>{currency(line.balance, vendor.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="4" /><td>Balance Due</td><td>{currency(summary.closingBalance, vendor.currency)}</td></tr></tfoot>
          </table>
        </div>
      </div>
    </article>
  );
}

function formatStatementDate(value) {
  if (!value) return '-';
  const parsed = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

function AddressLines({ lines }) {
  const values = lines.filter(Boolean);
  return values.length ? <div className="mt-2 text-sm font-semibold leading-6 text-slate-600">{values.map((line) => <div key={line}>{line}</div>)}</div> : null;
}

function ContactLines({ email, phone, gstin, website }) {
  return <div className="mt-2 text-sm font-semibold leading-6 text-slate-600">{email && <div>{email}</div>}{phone && <div>{phone}</div>}{gstin && <div>GSTIN: {gstin}</div>}{website && <div>{website}</div>}</div>;
}

function StatementEmailDialog({ open, vendor, statement, params, onClose, onSent }) {
  const [form, setForm] = useState({ to: '', cc: '', bcc: '', subject: '', message: '', attachStatementPdf: true });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open || !statement) return;
    const period = `${formatDate(statement.dateFrom)} to ${formatDate(statement.dateTo)}`;
    setForm({
      to: vendor.email || '',
      cc: '',
      bcc: '',
      subject: `Vendor Statement - ${vendor.vendorName} - ${period}`,
      message: `Dear ${vendor.vendorName},\n\nPlease find attached your Vendor Statement for the period ${period}.\n\nKindly review the statement and let us know if you have any questions or require any clarification.\n\nRegards,\n${statement.company.name}`,
      attachStatementPdf: true,
    });
    setError('');
  }, [open, statement, vendor.email, vendor.vendorName]);
  const mutation = useMutation({ mutationFn: () => vendorsApi.emailStatement(vendor.id, params, form), onSuccess: onSent, onError: (requestError) => setError(apiError(requestError, 'Unable to send vendor statement.')) });
  if (!open) return null;
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (!form.to.trim()) return setError('To email address is required.');
    if (!/^\S+@\S+\.\S+$/.test(form.to)) return setError('Enter a valid To email address.');
    mutation.mutate();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 px-4 py-6">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-black text-[#06134a]">Send Vendor Statement</h2><p className="mt-1 text-xs font-semibold text-slate-500">The active statement period and transaction filter will be used.</p></div><button type="button" onClick={onClose} disabled={mutation.isPending} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-50"><X className="h-5 w-5" /></button></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <EmailField label="To" value={form.to} onChange={(value) => update('to', value)} required />
          <EmailField label="CC" value={form.cc} onChange={(value) => update('cc', value)} />
          <EmailField label="BCC" value={form.bcc} onChange={(value) => update('bcc', value)} />
          <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-black text-[#06134a]">Subject *</span><input value={form.subject} onChange={(event) => update('subject', event.target.value)} required className="form-control" /></label>
          <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-black text-[#06134a]">Message *</span><textarea value={form.message} onChange={(event) => update('message', event.target.value)} required rows="8" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-300" /></label>
          <label className="flex items-center gap-2 text-sm font-bold text-[#06134a] sm:col-span-2"><input type="checkbox" checked={form.attachStatementPdf} onChange={(event) => update('attachStatementPdf', event.target.checked)} /> Attach Statement PDF</label>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 sm:col-span-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4"><ActionButton onClick={onClose} disabled={mutation.isPending}>Cancel</ActionButton><ActionButton type="submit" icon={Send} primary disabled={mutation.isPending}>{mutation.isPending ? 'Sending...' : 'Send Email'}</ActionButton></div>
      </form>
    </div>
  );
}

function EmailField({ label, value, onChange, required }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black text-[#06134a]">{label}{required ? ' *' : ''}</span><input type="email" value={value} onChange={(event) => onChange(event.target.value)} required={required} className="form-control" /></label>;
}

function TablePagination({ page, size, count, totalPages, totalElements, onPage, onSize, noun }) {
  const start = totalElements ? page * size + 1 : 0;
  const end = totalElements ? Math.min(page * size + count, totalElements) : 0;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm font-bold text-[#06134a] sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {start} to {end} of {totalElements} {noun}</span>
      <div className="flex items-center gap-2"><select value={size} onChange={(event) => onSize(Number(event.target.value))} className="form-control w-auto"><option value="10">10 / page</option><option value="20">20 / page</option><option value="50">50 / page</option></select><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="page-button">‹</button><span className="grid h-9 min-w-9 place-items-center rounded-lg bg-red-600 px-2 text-white">{page + 1}</span><span className="text-slate-500">of {Math.max(totalPages, 1)}</span><button type="button" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} className="page-button">›</button></div>
    </div>
  );
}

function statementRange(preset, customFrom, customTo) {
  const today = startOfDay(new Date());
  const iso = (value) => value.toISOString().slice(0, 10);
  let from = today;
  let to = today;
  if (preset === 'thisWeek') {
    const day = today.getDay() || 7;
    from = addDays(today, 1 - day);
  } else if (preset === 'thisMonth') {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (preset === 'lastMonth') {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    to = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (preset === 'thisQuarter') {
    from = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  } else if (preset === 'lastQuarter') {
    const startMonth = Math.floor(today.getMonth() / 3) * 3 - 3;
    from = new Date(today.getFullYear(), startMonth, 1);
    to = new Date(today.getFullYear(), startMonth + 3, 0);
  } else if (preset === 'thisFinancialYear') {
    const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    from = new Date(year, 3, 1);
  } else if (preset === 'lastFinancialYear') {
    const currentStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    from = new Date(currentStart - 1, 3, 1);
    to = new Date(currentStart, 2, 31);
  } else if (preset === 'custom') {
    return { dateFrom: customFrom, dateTo: customTo };
  }
  return { dateFrom: iso(from), dateTo: iso(to) };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function safeFilename(value) {
  return String(value || 'Vendor').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function saveBlob(response, fallbackName) {
  const header = response.headers?.['content-disposition'] || '';
  const match = header.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
