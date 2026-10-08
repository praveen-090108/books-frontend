import {
  ArrowLeft,
  ArrowDownToLine,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  CheckSquare,
  Copy,
  ChevronDown,
  Edit3,
  Eye,
  FileCheck2,
  FilePlus2,
  Filter,
  HandCoins,
  ListFilter,
  Mail,
  MoreVertical,
  PackageCheck,
  Paperclip,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  Truck,
  UserPlus,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentNumberApi, generateDocumentNumber } from '../../api/documentNumberApi.js';
import { API_COMPATIBILITY_VERSION, healthApi } from '../../api/healthApi.js';
import { invoiceLifecycleApi } from '../../api/invoiceLifecycleApi.js';
import { dashboardApi } from '../../api/dashboardApi.js';
import { recordsApi } from '../../api/recordsApi.js';
import { storageApi } from '../../api/storageApi.js';
import { resourceUsersApi } from '../../api/authApi.js';
import { currencyApi } from '../../api/currencyApi.js';
import { projectInvoicesApi } from '../../api/projectInvoicesApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { BankAccountSelect } from '../../components/BankAccountSelect.jsx';
import { currentFinancialYearRange, OverviewDateFilter } from '../../components/OverviewDateFilter.jsx';
import { RecordCrudForm } from '../../components/RecordCrudForm.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate, makeRecordPayload, recordToSalesRow } from '../../utils/records.js';

const SalesFormValuesContext = createContext({});
const FALLBACK_CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' }, { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' }, { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' }, { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' }, { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' }, { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
];
function normalizeCurrencyCode(value) { const code = String(value || 'INR').trim().slice(0, 3).toUpperCase(); return /^[A-Z]{3}$/.test(code) ? code : 'INR'; }
function currencySymbol(code) { try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: normalizeCurrencyCode(code), currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((part) => part.type === 'currency')?.value || code; } catch { return code || '₹'; } }
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const COUNTRY_STATES = Object.freeze({
  India: ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'],
  'United States': ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'],
  Australia: ['Australian Capital Territory','New South Wales','Northern Territory','Queensland','South Australia','Tasmania','Victoria','Western Australia'],
  Canada: ['Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon'],
});
const GST_TREATMENTS = ['Registered Business - Regular','Registered Business - Composition','Unregistered Business','Consumer','Overseas','Special Economic Zone (SEZ)','Deemed Export'];
const GST_CATEGORY_BY_TREATMENT = Object.freeze({'Registered Business - Regular':'Regular','Registered Business - Composition':'Composition','Unregistered Business':'Unregistered',Consumer:'Consumer',Overseas:'Overseas','Special Economic Zone (SEZ)':'SEZ','Deemed Export':'Deemed Export'});
const GST_CATEGORIES = [...new Set(Object.values(GST_CATEGORY_BY_TREATMENT))];
const COUNTRY_CODES = Object.freeze([
  { country:'India',code:'+91' },{ country:'United States / Canada',code:'+1' },{ country:'Australia',code:'+61' },
  { country:'United Kingdom',code:'+44' },{ country:'United Arab Emirates',code:'+971' },{ country:'Singapore',code:'+65' },
  { country:'New Zealand',code:'+64' },{ country:'Germany',code:'+49' },{ country:'France',code:'+33' },{ country:'Japan',code:'+81' },
]);
const COUNTRY_DEFAULT_CODE = Object.freeze({India:'+91','United States':'+1',Canada:'+1',Australia:'+61'});
function splitCustomerPhone(value,fallbackCode='+91'){const text=String(value||'').trim();const match=COUNTRY_CODES.map(item=>item.code).sort((a,b)=>b.length-a.length).find(code=>text.startsWith(code));return {code:match||fallbackCode,number:match?text.slice(match.length).trim():text};}
function joinedCustomerPhone(code,number){return number?`${code||''} ${String(number).trim()}`.trim():'';}

const customers = [
  ['AC', 'ABC Corporation', 'Chennai, India', 'CUS-0001', 'contact@abccorp.com', '+91 98765 43210', '₹1,25,000', 'Active', 'Corporate Customers'],
  ['GS', 'Global Solutions', 'Mumbai, India', 'CUS-0002', 'info@globalsolutions.com', '+91 87654 32109', '₹85,000', 'Active', 'Corporate Customers'],
  ['TP', 'Techno Power Pvt. Ltd.', 'Bangalore, India', 'CUS-0003', 'accounts@technopower.com', '+91 76543 21098', '₹65,000', 'Active', 'Corporate Customers'],
  ['OW', 'Office World', 'Delhi, India', 'CUS-0004', 'sales@officeworld.com', '+91 66431 09876', '₹60,000', 'Active', 'Retail Customers'],
  ['IH', 'Industrial Hub', 'Pune, India', 'CUS-0005', 'info@industrialhub.com', '+91 54230 19876', '₹30,000', 'Active', 'Corporate Customers'],
  ['RS', 'Retail Store Pvt. Ltd.', 'Hyderabad, India', 'CUS-0006', 'hello@retailstore.com', '+91 99887 66554', '₹0', 'Inactive', 'Retail Customers'],
  ['BF', 'Bright Future Enterprises', 'Kolkata, India', 'CUS-0007', 'contact@brightfuture.com', '+91 98300 11223', '₹0', 'Inactive', 'Corporate Customers'],
  ['SV', 'Skyline Ventures', 'Ahmedabad, India', 'CUS-0008', 'admin@skylineventures.com', '+91 90990 88776', '₹0', 'Inactive', 'Corporate Customers'],
];

const baseRows = customers.map((customer, index) => ({
  initials: customer[0],
  name: customer[1],
  city: customer[2],
  amount: ['₹1,25,000.00', '₹85,000.00', '₹65,000.00', '₹60,000.00', '₹30,000.00', '₹75,000.00', '₹55,000.00', '₹45,000.00'][index],
  date: ['30 May 2024', '29 May 2024', '28 May 2024', '27 May 2024', '25 May 2024', '24 May 2024', '23 May 2024', '22 May 2024'][index],
  person: ['Rahul Sharma', 'Neha Verma', 'Amit Patel', 'Sanjay Patel', 'Vikram Singh', 'Pooja Mehta', 'Rahul Sharma', 'Neha Verma'][index],
}));

const listConfigs = {
  customers: {
    title: 'Customers',
    subtitle: 'Manage your customers and track your transactions',
    search: 'Search customers by name, email, phone or code...',
    primaryAction: 'New Customer',
    totalLabel: '245 customers',
    cards: [
      ['Total Customers', '245', '12.4% vs last month', UsersRound, 'blue'],
      ['Active Customers', '210', '9.8% vs last month', UserPlus, 'green'],
      ['Inactive Customers', '35', '4.2% vs last month', UsersRound, 'orange'],
      ['Total Receivables', '₹2,45,000', '8.6% vs last month', WalletCards, 'purple'],
    ],
    columns: ['Customer Name', 'Customer Code', 'Email', 'Phone', 'Outstanding', 'Status', 'Customer Group'],
    rows: customers.map((row) => [row[1], row[3], row[4], row[5], row[6], row[7], row[8], row[0], row[2]]),
  },
  quotes: {
    title: 'Proforma Invoices',
    subtitle: 'Create, manage and track all your proforma invoices',
    search: 'Search proforma invoices by number, customer or email...',
    primaryAction: 'New Proforma Invoice',
    totalLabel: '125 proforma invoices',
    cards: [
      ['Total Proformas', '125', 'All Time', UsersRound, 'blue'],
      ['Open', '58', '₹18,75,000', ShoppingBag, 'green'],
      ['Accepted', '32', '₹9,80,000', Send, 'orange'],
      ['Expired', '18', '₹2,95,000', HandCoins, 'purple'],
      ['Declined', '17', '₹1,20,000', ReceiptText, 'red'],
    ],
    columns: ['Proforma Number', 'Customer', 'Valid Till', 'Amount', 'Status', 'Sales Person', 'Created On'],
    rows: baseRows.map((row, index) => [`QUO-00012${5 - index}`, row.name, `${31 - index} May 2024`, row.amount, ['Open', 'Accepted', 'Open', 'Accepted', 'Expired', 'Declined', 'Open', 'Expired'][index], row.person, `${String(2 + index).padStart(2, '0')} May 2024`, row.initials, row.city]),
  },
  orders: {
    title: 'Sales Orders',
    subtitle: 'Create, manage and track all your sales orders',
    search: 'Search by order #, customer, status...',
    primaryAction: 'New Sales Order',
    totalLabel: '152 orders',
    cards: [
      ['Total Orders', '152', 'All Time', ReceiptText, 'blue'],
      ['This Month', '₹8,76,500.00', '18 Orders', ShoppingBag, 'green'],
      ['This Year', '₹1,23,4600.00', '152 Orders', ShoppingBag, 'purple'],
      ['Pending', '₹24,85,600.00', '23 Orders', CalendarDays, 'orange'],
      ['Delivered', '₹98,59,400.00', '96 Orders', Truck, 'red'],
    ],
    columns: ['Order #', 'Customer', 'Order Date', 'Valid Until', 'Amount (₹)', 'Status', 'Delivery Status', 'Sales Person'],
    rows: baseRows.concat(baseRows.slice(0, 2)).map((row, index) => [`SO-00015${2 - index}`, row.name, row.date, `${29 - index} Jun 2024`, row.amount.replace('.00', ''), ['Confirmed', 'Confirmed', 'Pending Approval', 'Confirmed', 'Shipped', 'Confirmed', 'Delivered', 'Confirmed', 'Shipped', 'Cancelled'][index], ['To be Delivered', 'To be Delivered', 'To be Delivered', 'To be Delivered', 'Partially Delivered', 'To be Delivered', 'Delivered', 'To be Delivered', 'To be Delivered', 'N/A'][index], row.person, row.initials, row.city]),
  },
  invoices: {
    title: 'Invoices',
    subtitle: 'Create, manage and track all your invoices',
    search: 'Search invoices by number, customer or email...',
    primaryAction: 'New Invoice',
    totalLabel: '250 invoices',
    cards: [
      ['Total Invoices', '250', 'All Time', ReceiptText, 'blue'],
      ['Unpaid', '₹12,45,000.00', '48 Invoices', ReceiptText, 'orange'],
      ['Partially Paid', '₹2,35,000.00', '12 Invoices', ReceiptText, 'purple'],
      ['Paid', '₹25,80,000.00', '165 Invoices', ReceiptText, 'green'],
      ['Overdue', '₹8,75,000.00', '32 Invoices', ReceiptText, 'red'],
    ],
    columns: ['Invoice#', 'Customer', 'Invoice Date', 'Due Date', 'Total', 'Amount Paid', 'TDS', 'Credits', 'Balance Due', 'Status', 'Overdue Days', 'Invoice Type'],
    rows: baseRows.map((row, index) => [`INV-00025${index}`, row.name, row.date, `${29 - index} Jun 2024`, row.amount, ['Overdue', 'Overdue', 'Overdue', 'Due Soon', 'Due Soon', 'Due Soon', 'Paid', 'Paid'][index], ['Unpaid', 'Partially Paid', 'Unpaid', 'Unpaid', 'Partially Paid', 'Unpaid', 'Paid', 'Paid'][index], ['₹1,25,000.00', '₹35,000.00', '₹65,000.00', '₹60,000.00', '₹10,000.00', '₹75,000.00', '₹0.00', '₹0.00'][index], row.initials, row.city]),
  },
  creditNotes: {
    title: 'Credit Notes',
    subtitle: 'Create, manage and track all your credit notes',
    search: 'Search credit notes by number, customer or email...',
    primaryAction: 'New Credit Note',
    totalLabel: '120 credit notes',
    cards: [
      ['Total Credit Notes', '120', 'All Time', CheckSquare, 'blue'],
      ['Unused', '₹4,60,000.00', '32 Credit Notes', ReceiptText, 'orange'],
      ['Used', '₹2,85,000.00', '18 Credit Notes', CheckSquare, 'purple'],
      ['Refunded', '₹1,25,000.00', '10 Credit Notes', CheckSquare, 'green'],
      ['Expired', '₹35,000.00', '6 Credit Notes', CalendarDays, 'red'],
    ],
    columns: ['Credit Note#', 'Customer', 'Credit Note Date', 'Invoice#', 'Amount (₹)', 'Status', 'Balance (₹)', 'Expiry Date'],
    rows: baseRows.map((row, index) => [`CN-0003${2 - index}`, row.name, row.date, `INV-00024${9 - index}`, ['₹15,000.00', '₹10,000.00', '₹7,500.00', '₹12,000.00', '₹8,000.00', '₹6,500.00', '₹5,000.00', '₹9,000.00'][index], ['Unused', 'Used', 'Used', 'Refunded', 'Unused', 'Expired', 'Refunded', 'Unused'][index], ['₹15,000.00', '₹0.00', '₹0.00', '₹0.00', '₹8,000.00', '₹0.00', '₹0.00', '₹9,000.00'][index], `${29 - index} Aug 2024`, row.initials, row.city]),
  },
  payments: {
    title: 'Payments Received',
    subtitle: 'Track all customer payments in one place',
    search: 'Search by payment #, customer, invoice #...',
    primaryAction: 'Record Payment',
    totalLabel: '154 payments',
    cards: [
      ['Total Received', '₹18,45,250.00', 'All Time', HandCoins, 'blue'],
      ['This Month', '₹4,25,000.00', 'May 2024', HandCoins, 'green'],
      ['This Year', '₹18,45,250.00', '2024', HandCoins, 'purple'],
      ['Overdue', '₹1,12,500.00', 'From 15 Invoices', ReceiptText, 'orange'],
    ],
    columns: ['Payment #', 'Customer', 'Invoice #', 'Payment Date', 'Payment Mode', 'Amount (₹)', 'Unallocated (₹)', 'Status'],
    rows: baseRows.concat(baseRows.slice(0, 2)).map((row, index) => [`PAY-0007${8 - index}`, row.name, `INV-00025${index}`, row.date, ['Bank Transfer', 'UPI', 'Cheque', 'Bank Transfer', 'NEFT', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Bank Transfer'][index], row.amount.replace('.00', ''), '₹0.00', 'Deposited', row.initials, row.city]),
  },
  challans: {
    title: 'Delivery Challans',
    subtitle: 'View and manage all your delivery challans',
    search: 'Search by challan #, customer, order #...',
    primaryAction: 'New Delivery Challan',
    totalLabel: '156 challans',
    cards: [
      ['Total Challans', '156', 'All Time', Truck, 'blue'],
      ['This Month', '₹5,42,300.00', '28 Challans', ShoppingBag, 'green'],
      ['This Year', '₹72,85,600.00', '156 Challans', ShoppingBag, 'purple'],
      ['Pending', '₹3,21,500.00', '12 Challans', CalendarDays, 'orange'],
      ['Delivered', '₹69,64,100.00', '144 Challans', Truck, 'red'],
    ],
    columns: ['Challan #', 'Order #', 'Customer', 'Challan Date', 'Order Date', 'Amount (₹)', 'Status', 'Delivery Status', 'Delivered To'],
    rows: baseRows.concat(baseRows.slice(0, 2)).map((row, index) => [`DC-00015${6 - index}`, `SO-00015${2 - index}`, row.name, row.date, row.date, row.amount.replace('.00', ''), ['Delivered', 'Delivered', 'Dispatched', 'Pending', 'Delivered', 'Delivered', 'Delivered', 'Dispatched', 'Delivered', 'Cancelled'][index], ['Delivered', 'Delivered', 'In Transit', 'Pending', 'Delivered', 'Delivered', 'Delivered', 'In Transit', 'Delivered', 'Cancelled'][index], ['Arun Kumar', 'Priya Sharma', 'Arun Kumar', 'Nisha Verma', 'Rohit Singh', 'Priya Sharma', 'Arun Kumar', 'Nisha Verma', 'Rohit Singh', '-'][index], row.initials, row.city]),
  },
};

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-violet-50 text-violet-600',
  red: 'bg-red-50 text-red-600',
};

const badgeClasses = {
  Active: 'bg-emerald-50 text-emerald-700',
  Inactive: 'bg-slate-100 text-slate-700',
  Open: 'bg-blue-50 text-blue-700',
  Sent: 'bg-blue-50 text-blue-700',
  Closed: 'bg-emerald-50 text-emerald-700',
  Void: 'bg-slate-100 text-slate-700',
  Accepted: 'bg-emerald-50 text-emerald-700',
  Invoiced: 'bg-emerald-50 text-emerald-700',
  Expired: 'bg-orange-50 text-orange-700',
  Declined: 'bg-red-50 text-red-700',
  Confirmed: 'bg-emerald-50 text-emerald-700',
  'Pending Approval': 'bg-orange-50 text-orange-700',
  Shipped: 'bg-blue-50 text-blue-700',
  Delivered: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
  Overdue: 'bg-red-50 text-red-700',
  'Due Soon': 'bg-orange-50 text-orange-700',
  Paid: 'bg-emerald-50 text-emerald-700',
  Reversed: 'bg-slate-100 text-slate-600',
  Unpaid: 'bg-red-50 text-red-700',
  'Partially Paid': 'bg-violet-50 text-violet-700',
  Draft: 'bg-slate-100 text-slate-700',
  Viewed: 'bg-cyan-50 text-cyan-700',
  Unused: 'bg-orange-50 text-orange-700',
  Used: 'bg-violet-50 text-violet-700',
  Refunded: 'bg-emerald-50 text-emerald-700',
  Deposited: 'bg-emerald-50 text-emerald-700',
  Dispatched: 'bg-blue-50 text-blue-700',
  Pending: 'bg-orange-50 text-orange-700',
  'In Transit': 'bg-blue-50 text-blue-700',
  'To be Delivered': 'bg-blue-50 text-blue-700',
  'Partially Delivered': 'bg-orange-50 text-orange-700',
  'N/A': 'bg-slate-100 text-slate-700',
};

const newRouteByType = {
  customers: '/sales/customers/new',
  quotes: '/sales/quotes/new',
  orders: '/sales/orders/new',
  invoices: '/sales/invoices/new',
  creditNotes: '/sales/credit-notes/new',
  payments: '/sales/payments-received/new',
  challans: '/sales/delivery-challans/new',
};

const editRouteByType = {
  customers: (id) => `/sales/customers/${id}/edit`,
  quotes: (id) => `/sales/quotes/${id}/edit`,
  orders: (id) => `/sales/orders/${id}/edit`,
  invoices: (id) => `/sales/invoices/${id}/edit`,
  creditNotes: (id) => `/sales/credit-notes/${id}/edit`,
  payments: (id) => `/sales/payments-received/${id}/edit`,
  challans: (id) => `/sales/delivery-challans/${id}/edit`,
};

const viewRouteByType = {
  quotes: (id) => `/sales/quotes/${id}`,
  orders: (id) => `/sales/orders/${id}`,
  invoices: (id) => `/sales/invoices/${id}`,
  creditNotes: (id) => `/sales/credit-notes/${id}`,
};

function ActionButton({ children, primary = false, icon: Icon, to }) {
  const className = `flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold shadow-sm ${
      primary ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-900'
    }`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {Icon && <Icon className="h-4 w-4" />}
        {children}
      </Link>
    );
  }

  return (
    <button className={className}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function StatCards({ cards }) {
  const gridClass = cards.length === 4
    ? 'sm:grid-cols-2 xl:grid-cols-4'
    : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {cards.map((card) => <StatCard key={card[0]} card={card} />)}
    </div>
  );
}

function StatCard({ card }) {
  const [label, value, helper, Icon, color] = card;

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="min-h-8 text-[12px] font-bold leading-4 text-slate-700">{label}</p>
          <p className="mt-1 break-words text-[20px] font-black leading-tight text-slate-950">{value}</p>
          <p className={`mt-1 text-[11px] leading-4 ${helper.includes('vs') ? 'text-slate-500' : 'text-slate-700'}`}>
            {helper.includes('vs') && <span className={helper.includes('4.2') ? 'font-bold text-red-600' : 'font-bold text-emerald-600'}>{helper.split(' ')[0]} </span>}
            {helper.includes('vs') ? helper.replace(helper.split(' ')[0], '') : helper}
          </p>
        </div>
      </div>
    </article>
  );
}

function FilterBar({
  search,
  customerLabel = 'All Customers',
  modeLabel = 'All Status',
  searchValue = '',
  onSearchChange,
  statusValue = '',
  onStatusChange,
  statuses = [],
  categoryValue = '',
  onCategoryChange,
  categories = [],
  datePreset = '',
  onDatePresetChange,
  onReset,
  hasFilters = false,
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_0.85fr_0.85fr_0.8fr_auto_auto]">
      <label className="relative">
        <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 pr-12 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder={search} />
      </label>
      <select value={categoryValue} onChange={(event) => onCategoryChange?.(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none">
        <option value="">{customerLabel}</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      <select value={statusValue} onChange={(event) => onStatusChange?.(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none">
        <option value="">{modeLabel}</option>
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <select value={datePreset} onChange={(event) => onDatePresetChange?.(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none">
        <option value="">All Dates</option>
        <option value="thisMonth">This Month</option>
        <option value="last30">Last 30 Days</option>
        <option value="thisYear">This Year</option>
      </select>
      <button type="button" disabled={!hasFilters} onClick={onReset} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
        <Filter className="h-4 w-4" /> Reset
      </button>
      <button className="grid h-11 w-12 place-items-center rounded-lg border border-slate-200 bg-white text-slate-800">
        <ListFilter className="h-5 w-5" />
      </button>
    </div>
  );
}

function SelectLike({ label, icon: Icon }) {
  return (
    <button className="flex h-11 items-center justify-between rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900">
      <span className="flex items-center gap-2">{Icon && <Icon className="h-4 w-4" />}{label}</span>
      <ChevronDown className="h-4 w-4" />
    </button>
  );
}

function StatusBadge({ value }) {
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${badgeClasses[value] || 'bg-slate-100 text-slate-700'}`}>{value}</span>;
}

function SalesTable({ columns, rows, pageType, onDelete, actionPermissionsById = {} }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-12 px-4 py-4"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" /></th>
              {columns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-4 font-bold">{column}</th>)}
              <th className="px-4 py-4 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-950">
            {rows.map((row, index) => <SalesRow key={`${row[0]}-${index}`} row={row} pageType={pageType} onDelete={onDelete} actionPermissionsById={actionPermissionsById} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesRow({ row, pageType, onDelete, actionPermissionsById }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isCustomer = pageType === 'customers';
  const rawRowId = row[row.length - 1];
  const rowId = rawRowId !== undefined && rawRowId !== null && String(rawRowId).trim() !== '' ? rawRowId : null;
  const metaOffset = rowId ? 3 : 2;
  const initials = row[row.length - metaOffset];
  const city = row[row.length - (rowId ? 2 : 1)];
  const visible = row.slice(0, -metaOffset);
  const invoicePermissions = rowId ? actionPermissionsById?.[rowId] || actionPermissionsById?.[String(rowId)] : null;
  const canEdit = pageType !== 'invoices' || Boolean(invoicePermissions?.edit);
  const canDelete = pageType !== 'invoices' || Boolean(invoicePermissions?.deleteInvoice);

  return (
    <tr className="hover:bg-slate-50/80">
      <td className="px-4 py-4"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" /></td>
      {visible.map((cell, index) => {
        const isName = (isCustomer && index === 0) || (!isCustomer && (index === 1 || (pageType === 'challans' && index === 2)));
        const isStatus = badgeClasses[cell];
        const viewRoute = rowId && viewRouteByType[pageType] ? viewRouteByType[pageType](rowId) : '';
        // The first column is the document number. Link it by the persisted
        // record ID instead of inferring linkability from a generated prefix,
        // because users may enter any valid custom invoice/document number.
        const isDocumentLink = index === 0 && Boolean(viewRoute);
        const isRedMoney = String(cell).startsWith('₹') && ['₹1,25,000', '₹85,000', '₹65,000', '₹60,000', '₹30,000'].includes(cell);

        return (
          <td key={`${cell}-${index}`} className="whitespace-nowrap px-4 py-4">
            {isName ? (
              <div className="flex items-center gap-3">
                {isCustomer && <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-50 text-sm font-bold text-violet-700">{initials}</span>}
                <div>
                  {isCustomer&&rowId?<Link to={`/sales/customers/${rowId}`} className="font-bold text-blue-600 hover:underline">{cell}</Link>:<p className="font-bold text-slate-950">{cell}</p>}
                  <p className="mt-1 text-xs text-slate-600">{city}</p>
                </div>
              </div>
            ) : isStatus ? (
              <StatusBadge value={cell} />
            ) : isDocumentLink ? (
              <Link to={viewRoute} className="font-bold text-blue-600 hover:underline">{cell}</Link>
            ) : (
              <span className={`font-semibold ${isRedMoney ? 'text-red-600' : ''}`}>{cell}</span>
            )}
          </td>
        );
      })}
      <td className="px-4 py-4">
        <div className="relative">
        <button
          disabled={!rowId}
          onClick={() => rowId && setMenuOpen((open) => !open)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          title={rowId ? 'Actions' : 'Static sample row'}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && rowId && (
          <div className="absolute right-0 top-10 z-20 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl">
            <button onClick={() => navigate(viewRouteByType[pageType]?.(rowId) || editRouteByType[pageType](rowId))} className="block w-full px-4 py-2 text-left font-bold hover:bg-slate-50">View</button>
            {canEdit && <button onClick={() => navigate(editRouteByType[pageType](rowId))} className="block w-full px-4 py-2 text-left font-bold hover:bg-slate-50">Edit</button>}
            {canDelete && <button onClick={() => { setMenuOpen(false); onDelete?.(rowId); }} className="block w-full px-4 py-2 text-left font-bold text-red-600 hover:bg-red-50">Delete</button>}
          </div>
        )}
        </div>
      </td>
    </tr>
  );
}

function Pagination({ totalLabel, page = 0, totalPages = 1, onPageChange, totalElements = 0, pageSize = 10, currentCount = 0, onPageSizeChange }) {
  const current = page + 1;
  const start = totalElements === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(totalElements, page * pageSize + currentCount);
  const pageTokens = paginationTokens(page, totalPages);
  return (
    <div className="flex flex-col gap-4 py-4 text-sm md:flex-row md:items-center md:justify-between">
      <p className="font-semibold text-slate-700">Showing {start} to {end} of {totalLabel}</p>
      <div className="flex items-center gap-3">
        <select value={pageSize} onChange={(event) => onPageSizeChange?.(Number(event.target.value))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none">
          {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / page</option>)}
        </select>
        <button disabled={page <= 0} onClick={() => onPageChange?.(Math.max(0, page - 1))} className="grid h-10 min-w-10 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 disabled:opacity-50">‹</button>
        {pageTokens.map((item, index) => item === 'gap'
          ? <span key={`gap-${index}`} className="px-1 font-bold text-slate-400">...</span>
          : <button key={item} onClick={() => onPageChange?.(item)} className={`grid h-10 min-w-10 place-items-center rounded-lg border px-3 text-sm font-bold ${item + 1 === current ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-800'}`}>{item + 1}</button>)}
        <button disabled={page >= totalPages - 1} onClick={() => onPageChange?.(Math.min(totalPages - 1, page + 1))} className="grid h-10 min-w-10 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 disabled:opacity-50">›</button>
      </div>
    </div>
  );
}

function paginationTokens(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: Math.max(0, totalPages) }, (_, index) => index);
  const pages = new Set([0, totalPages - 1, page - 1, page, page + 1].filter((value) => value >= 0 && value < totalPages));
  const sorted = [...pages].sort((left, right) => left - right);
  return sorted.flatMap((value, index) => index > 0 && value - sorted[index - 1] > 1 ? ['gap', value] : [value]);
}

export function SalesListPage({ type }) {
  const config = listConfigs[type];
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [paymentState, setPaymentState] = useState('');
  const [dueDatePreset, setDueDatePreset] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(() => type === 'invoices' && new URLSearchParams(location.search).get('overdue') === 'true');
  const [page, setPage] = useState(0);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const dateRange = useMemo(() => dateRangeFromPreset(datePreset), [datePreset]);
  const dueDateRange = useMemo(() => dateRangeFromPreset(dueDatePreset), [dueDatePreset]);
  const queryParams = { module: 'sales', type, page, size: pageSize, search, status, category, partyName: customerFilter, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo, dueDateFrom: dueDateRange.dateFrom, dueDateTo: dueDateRange.dateTo, paymentState, overdue: overdueOnly || '', sort: 'recordDate,desc' };
  const listQuery = useQuery({
    queryKey: ['records', queryParams],
    queryFn: () => recordsApi.list(queryParams),
    keepPreviousData: true,
  });
  const summaryQuery = useQuery({
    queryKey: ['records-summary', 'sales', type, search, status, category, customerFilter, datePreset, dueDatePreset, paymentState, overdueOnly],
    queryFn: () => recordsApi.summary({ module: 'sales', type, search, status, category, partyName: customerFilter, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo, dueDateFrom: dueDateRange.dateFrom, dueDateTo: dueDateRange.dateTo, paymentState, overdue: overdueOnly || '' }),
  });
  const invoiceCustomersQuery = useQuery({
    queryKey: ['records', 'sales', 'customers', 'invoice-filter'],
    queryFn: () => recordsApi.list({ module: 'sales', type: 'customers', page: 0, size: 500, status: 'Active', sort: 'partyName,asc' }),
    enabled: type === 'invoices',
    staleTime: 60_000,
  });
  const invoiceIds = useMemo(
    () => type === 'invoices' ? (listQuery.data?.content || []).map((record) => record.id) : [],
    [listQuery.data, type],
  );
  const invoiceLifecycleQuery = useQuery({
    queryKey: ['invoice-lifecycle-list', invoiceIds.join(',')],
    queryFn: () => invoiceLifecycleApi.list(invoiceIds),
    enabled: type === 'invoices' && invoiceIds.length > 0,
  });
  const rows = useMemo(() => listQuery.data?.content?.map((record) => {
    if (type !== 'invoices') return recordToSalesRow(record, type);
    const lifecycle = invoiceLifecycleQuery.data?.[record.id] || invoiceLifecycleQuery.data?.[String(record.id)];
    return invoiceLifecycleRow(record, lifecycle);
  }) ?? [], [invoiceLifecycleQuery.data, listQuery.data, type]);
  const actionPermissionsById = useMemo(() => {
    if (type !== 'invoices') return {};
    return Object.fromEntries((listQuery.data?.content || []).map((record) => {
      const lifecycle = invoiceLifecycleQuery.data?.[record.id] || invoiceLifecycleQuery.data?.[String(record.id)];
      return [record.id, lifecycle?.actions || {}];
    }));
  }, [invoiceLifecycleQuery.data, listQuery.data, type]);
  const totalElements = listQuery.data?.totalElements ?? rows.length;
  const totalPages = listQuery.data?.totalPages || 1;
  const totalLabel = `${totalElements} ${config.totalLabel.replace(/^\d+\s*/, '')}`;
  const cards = useMemo(() => buildSalesCards(config.cards, summaryQuery.data), [config.cards, summaryQuery.data]);
  const statuses = useMemo(() => Object.keys(summaryQuery.data?.statusCounts || badgeClasses), [summaryQuery.data]);
  const categories = useMemo(() => salesCategoryOptions(type), [type]);
  const hasFilters = Boolean(search || status || category || datePreset || customerFilter || paymentState || dueDatePreset || overdueOnly);
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id) => recordsApi.remove({ module: 'sales', type, id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setDeleteTargetId(null);
    },
  });
  const deleteRecord = (id) => {
    setDeleteTargetId(id);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#06134a]">{config.title}</h1>
          <p className="mt-2 text-base font-semibold text-[#06134a]">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton icon={ArrowDownToLine}>Import</ActionButton>
          <ActionButton icon={ArrowDownToLine}>Export</ActionButton>
          <ActionButton primary icon={Plus} to={newRouteByType[type]}>{config.primaryAction}</ActionButton>
        </div>
      </div>
      <StatCards cards={cards} />
      {location.state?.message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{location.state.message}</div>}
      <FilterBar
        search={config.search}
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(0); }}
        statusValue={status}
        onStatusChange={(value) => { setStatus(value); setPage(0); }}
        statuses={statuses}
        categoryValue={category}
        onCategoryChange={(value) => { setCategory(value); setPage(0); }}
        categories={categories}
        datePreset={datePreset}
        onDatePresetChange={(value) => { setDatePreset(value); setPage(0); }}
        hasFilters={hasFilters}
        onReset={() => {
          setSearch('');
          setStatus('');
          setCategory('');
          setDatePreset('');
          setCustomerFilter('');
          setPaymentState('');
          setDueDatePreset('');
          setOverdueOnly(false);
          setPage(0);
        }}
        customerLabel={type === 'customers' ? 'All Customer Groups' : 'All Categories'}
        modeLabel={type === 'payments' ? 'All Payment Modes' : 'All Status'}
      />
      {type === 'invoices' && (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1fr_0.8fr_0.8fr_auto]">
          <select value={customerFilter} onChange={(event) => { setCustomerFilter(event.target.value); setPage(0); }} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none">
            <option value="">All Customers</option>
            {(invoiceCustomersQuery.data?.content || []).map((customer) => <option key={customer.id} value={customer.partyName}>{customer.partyName}</option>)}
          </select>
          <select value={paymentState} onChange={(event) => { setPaymentState(event.target.value); setPage(0); }} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none">
            <option value="">Paid / Unpaid</option><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option>
          </select>
          <select value={dueDatePreset} onChange={(event) => { setDueDatePreset(event.target.value); setPage(0); }} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none">
            <option value="">All Due Dates</option><option value="thisMonth">Due This Month</option><option value="last30">Due in Last 30 Days</option><option value="thisYear">Due This Year</option>
          </select>
          <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold"><input type="checkbox" checked={overdueOnly} onChange={(event) => { setOverdueOnly(event.target.checked); setPage(0); }} /> Overdue only</label>
        </div>
      )}
      {listQuery.isLoading && <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-bold text-[#06134a]">Loading {config.title.toLowerCase()}...</div>}
      {listQuery.isError && <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-700">Sales data could not be loaded from the backend. Check the application logs and try again.</div>}
      {deleteMutation.isError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{apiErrorMessage(deleteMutation.error, 'Delete failed. Please try again.')}</div>}
      <SalesTable columns={config.columns} rows={rows} pageType={type} onDelete={deleteRecord} actionPermissionsById={actionPermissionsById} />
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title={`Delete ${config.title.slice(0, -1) || 'record'}?`}
        message="This record will be permanently deleted from the database and removed from the list."
        loading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
      />
      <Pagination
        totalLabel={totalLabel}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalElements={totalElements}
        pageSize={pageSize}
        currentCount={rows.length}
        onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
      />
    </section>
  );
}

function invoiceLifecycleRow(record, lifecycle) {
  const notes = parseJsonObject(record.notes);
  const currency = normalizeCurrencyCode(notes.Currency);
  const credits = Number(lifecycle?.creditApplied || 0) + Number(lifecycle?.creditNoteApplied || 0);
  return [
    record.recordNumber,
    record.partyName,
    formatDate(record.recordDate),
    formatDate(record.dueDate),
    formatCurrency(Number(lifecycle?.invoiceTotal ?? record.amount ?? 0), currency),
    formatCurrency(Number(lifecycle?.cashAmountPaid || 0), currency),
    formatCurrency(Number(lifecycle?.tdsSettled || 0), currency),
    formatCurrency(credits, currency),
    formatCurrency(Number(lifecycle?.balanceDue ?? record.balanceAmount ?? 0), currency),
    lifecycle?.status || record.status,
    String(lifecycle?.overdueDays || 0),
    notes.invoiceType || record.category || '-',
    initialsForName(record.partyName),
    record.partyCity || '-',
    record.id,
  ];
}

function initialsForName(name = '') {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IT';
}

function salesCategoryOptions(type) {
  if (type === 'customers') return ['Corporate Customers', 'Retail Customers', 'Individual Customers', 'General'];
  if (type === 'invoices') return ['Fixed Cost', 'Staffing'];
  if (type === 'quotes' || type === 'orders') return ['Direct Sales', 'Online Store', 'Retail Outlets', 'Distributors', 'General'];
  if (type === 'creditNotes') return ['Sales Return', 'Discount', 'Adjustment', 'General'];
  if (type === 'payments') return ['Bank Transfer', 'UPI', 'Cheque', 'Card', 'Cash', 'General'];
  if (type === 'challans') return ['Delivered', 'Pending', 'General'];
  return ['General'];
}

function dateRangeFromPreset(preset) {
  const today = new Date();
  const toIso = (date) => date.toISOString().slice(0, 10);
  if (preset === 'thisMonth') {
    return { dateFrom: toIso(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: toIso(today) };
  }
  if (preset === 'last30') {
    return { dateFrom: toIso(new Date(today.getTime() - 30 * 86400000)), dateTo: toIso(today) };
  }
  if (preset === 'thisYear') {
    return { dateFrom: toIso(new Date(today.getFullYear(), 0, 1)), dateTo: toIso(today) };
  }
  return { dateFrom: '', dateTo: '' };
}

export function SalesInvoiceViewPage() {
  return <SalesDocumentViewPage documentType="invoices" />;
}

export function SalesQuoteViewPage() {
  return <SalesDocumentViewPage documentType="quotes" />;
}

export function SalesOrderViewPage() {
  return <SalesDocumentViewPage documentType="orders" />;
}

export function SalesCreditNoteViewPage() {
  return <SalesDocumentViewPage documentType="creditNotes" />;
}

export function SalesCustomerViewPage(){
  const{id}=useParams();const query=useQuery({queryKey:['records','sales','customers',id],queryFn:()=>recordsApi.get({module:'sales',type:'customers',id}),enabled:Boolean(id)});
  if(query.isLoading)return <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm font-bold">Loading customer details…</div>;
  if(query.isError||!query.data)return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-600">Customer could not be found or you do not have access.</div>;
  const customer=query.data,notes=parseSalesNotes(customer.notes),attachments=Array.isArray(notes.attachments)?notes.attachments:[];
  const Detail=({label,value})=><div><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-bold text-[#06134a]">{value||'—'}</p></div>;
  const details=(items)=><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map(([label,value])=><Detail key={label} label={label} value={value}/>)}</div>;
  return <section className="space-y-5 pb-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><Link to="/sales/customers" className="text-sm font-bold text-slate-600">← Customers</Link><h1 className="mt-3 text-3xl font-black text-[#06134a]">{customer.partyName}</h1><p className="mt-1 text-sm font-semibold text-slate-500">{customer.recordNumber}</p></div><Link to={`/sales/customers/${id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white"><Edit3 className="h-4 w-4"/>Edit Customer</Link></div>
    <div className="grid gap-5 xl:grid-cols-2"><FormCard title="Basic Information">{details([['Customer Type',notes.customerType],['Display Name',notes.displayName||customer.partyName],['Customer Name',customer.partyName],['Email',customer.partyEmail],['Phone',customer.partyPhone],['Mobile',joinedCustomerPhone(notes.mobileCountryCode||COUNTRY_DEFAULT_CODE[notes.country]||'+91',notes.mobile)],['Website',notes.website],['PAN / VAT',notes.pan],['Payment Terms',customer.paymentMode],['Status',customer.status]])}</FormCard><FormCard title="GST Information">{details([['GST Treatment',notes.gstTreatment],['GST Category',notes.gstCategory],['GSTIN / UIN',notes.gstin],['Place of Supply',notes.placeOfSupply],['Country',notes.country],['State',notes.state]])}</FormCard><FormCard title="Billing Address">{details([['Address',notes.billingAddress],['City',customer.partyCity],['State',notes.state],['Country',notes.country],['PIN Code',notes.pinCode]])}</FormCard><FormCard title="Shipping Address">{details([['Address',notes.shippingAddress],['City',notes.shippingCity],['State',notes.shippingState],['Country',notes.shippingCountry],['PIN Code',notes.shippingPinCode]])}</FormCard></div>
    <FormCard title="Attachments">{attachments.length?<div className="divide-y divide-slate-100">{attachments.map((file,index)=><div key={file.key||index} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-bold text-[#06134a]">{file.fileName}</p><p className="text-xs text-slate-500">{file.contentType||'File'} · {file.size?`${(Number(file.size)/1024).toFixed(1)} KB`:'Size unavailable'} · {file.uploadedAt?new Date(file.uploadedAt).toLocaleString('en-IN'):'—'}</p></div><a href={file.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-blue-600"><Paperclip className="h-4 w-4"/>View / Download</a></div>)}</div>:<p className="text-sm font-semibold text-slate-500">No attachments uploaded.</p>}</FormCard>
    <FormCard title="Created / Updated Information">{details([['Created By',customer.createdBy],['Created Date',customer.createdAt?new Date(customer.createdAt).toLocaleString('en-IN'):''],['Updated By',customer.updatedBy],['Updated Date',customer.updatedAt?new Date(customer.updatedAt).toLocaleString('en-IN'):'']])}</FormCard></section>;
}

function SalesDocumentViewPage({ documentType = 'invoices' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const documentConfig = documentViewConfig(documentType);
  const documentQuery = useQuery({
    queryKey: ['record', 'sales', documentType, id],
    queryFn: () => recordsApi.get({ module: 'sales', type: documentType, id }),
  });
  const lifecycleQuery = useQuery({
    queryKey: ['invoice-lifecycle', id],
    queryFn: () => invoiceLifecycleApi.get(id),
    enabled: documentType === 'invoices' && Boolean(id),
  });
  const eInvoiceQuery = useQuery({
    queryKey: ['e-invoice', documentType, id],
    queryFn: () => documentType === 'creditNotes'
      ? invoiceLifecycleApi.getCreditNoteEInvoice(id)
      : invoiceLifecycleApi.getEInvoice(id),
    enabled: ['invoices', 'creditNotes'].includes(documentType) && Boolean(id),
  });
  const documentsQuery = useQuery({
    queryKey: ['records', 'sales', documentType, 'viewer-list'],
    queryFn: () => recordsApi.list({ module: 'sales', type: documentType, page: 0, size: 10, sort: 'recordDate,desc' }),
  });
  const organizationQuery = useQuery({
    queryKey: ['records', 'settings', 'organization', `${documentType}-view`],
    queryFn: () => recordsApi.list({ module: 'settings', type: 'organization', page: 0, size: 1, sort: 'recordDate,desc' }),
    staleTime: 60_000,
  });
  const salesDocument = documentQuery.data;
  const storedDocumentNotes = parseJsonObject(salesDocument?.notes);
  const sourceInvoiceId = documentType === 'creditNotes'
    ? Number(storedDocumentNotes['Source Invoice ID'] || storedDocumentNotes.convertedFromId || 0)
    : 0;
  const sourceInvoiceLifecycleQuery = useQuery({
    queryKey: ['invoice-lifecycle', 'credit-note-source', sourceInvoiceId],
    queryFn: () => invoiceLifecycleApi.get(sourceInvoiceId),
    enabled: documentType === 'creditNotes' && sourceInvoiceId > 0,
  });
  const customerQuery = useQuery({
    queryKey: ['records', 'sales', 'customers', `${documentType}-view`, salesDocument?.partyName],
    queryFn: () => recordsApi.list({ module: 'sales', type: 'customers', page: 0, size: 10, search: salesDocument?.partyName || '', sort: 'partyName,asc' }),
    enabled: Boolean(salesDocument?.partyName),
    staleTime: 60_000,
  });
  const convertedInvoicesQuery = useQuery({
    queryKey: ['records', 'sales', 'invoices', 'converted-from-quote', salesDocument?.id, salesDocument?.recordNumber],
    queryFn: () => recordsApi.list({ module: 'sales', type: 'invoices', page: 0, size: 200, sort: 'recordDate,desc' }),
    enabled: documentType === 'quotes' && Boolean(salesDocument?.recordNumber),
    staleTime: 30_000,
  });
  const documents = documentsQuery.data?.content || [];
  const companyProfile = {
    ...organizationFromSettingsRecord(organizationQuery.data?.content?.[0]),
    logoUrl: '/branding-assets/current',
  };
  const [openMenu, setOpenMenu] = useState('');
  const [sendDialog, setSendDialog] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [reversePayment, setReversePayment] = useState(null);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [creditAllocationDeleteOpen, setCreditAllocationDeleteOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [generateIrnOpen, setGenerateIrnOpen] = useState(false);
  const [cancelIrnOpen, setCancelIrnOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [quoteTab, setQuoteTab] = useState('details');
  const updateStatusMutation = useMutation({
    mutationFn: (status) => documentType === 'invoices' && status === 'Sent'
      ? invoiceLifecycleApi.markSent({ invoiceId: id, recipient: salesDocument?.partyEmail || '' })
      : recordsApi.update({ module: 'sales', type: documentType, id, payload: { ...salesDocument, status } }),
    onSuccess: (updated) => {
      if (documentType === 'invoices') queryClient.setQueryData(['invoice-lifecycle', id], updated);
      else queryClient.setQueryData(['record', 'sales', documentType, id], updated);
      queryClient.invalidateQueries({ queryKey: ['record', 'sales', documentType, id] });
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', documentType] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lifecycle-list'] });
      setActionMessage('Status updated successfully.');
      setOpenMenu('');
    },
    onError: () => setActionMessage('Unable to update status. Please try again.'),
  });
  const deleteMutation = useMutation({
    mutationFn: () => recordsApi.remove({ module: 'sales', type: documentType, id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', documentType] });
      navigate(documentConfig.listRoute);
    },
    onError: () => setActionMessage(`Unable to delete ${documentConfig.lowerLabel}. Please try again.`),
  });
  const convertMutation = useMutation({
    mutationFn: async (targetType) => {
      const created = await recordsApi.create({
        module: 'sales',
        type: targetType,
        payload: convertedSalesDocumentPayload(salesDocument, targetType, companyProfile),
      });
      if (documentType === 'quotes' || documentType === 'orders') {
        const currentNotes = parseJsonObject(salesDocument?.notes);
        const convertedKey = targetType === 'invoices' ? 'convertedInvoice' : 'convertedSalesOrder';
        await recordsApi.update({
          module: 'sales',
          type: documentType,
          id,
          payload: {
            ...salesDocument,
            status: targetType === 'invoices' ? 'Invoiced' : 'Accepted',
            notes: JSON.stringify({
              ...currentNotes,
              [convertedKey]: {
                id: created.id,
                recordNumber: created.recordNumber,
                date: created.recordDate,
                dueDate: created.dueDate,
                status: created.status,
                amount: created.amount,
                balanceAmount: created.balanceAmount,
              },
              conversionActivity: [
                ...(Array.isArray(currentNotes.conversionActivity) ? currentNotes.conversionActivity : []),
                {
                  type: targetType === 'invoices' ? 'invoice' : 'salesOrder',
                  id: created.id,
                  recordNumber: created.recordNumber,
                  createdAt: new Date().toISOString(),
                  actor: 'Praveen Raghuvanshi',
                },
              ],
            }),
          },
        });
      }
      return created;
    },
    onSuccess: (created, targetType) => {
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', targetType] });
      queryClient.invalidateQueries({ queryKey: ['record', 'sales', documentType, id] });
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', documentType] });
      setOpenMenu('');
      if (targetType === 'invoices') navigate(`/sales/invoices/${created.id}`);
      else navigate(`/sales/orders/${created.id}/edit`);
    },
    onError: (error) => setActionMessage(error?.message || `Unable to convert ${documentConfig.lowerLabel}. Please try again.`),
  });
  const creditNoteMutation = useMutation({
    mutationFn: () => recordsApi.create({
      module: 'sales',
      type: 'creditNotes',
      payload: creditNoteFromInvoicePayload(salesDocument, companyProfile),
    }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', 'creditNotes'] });
      setOpenMenu('');
      navigate(`/sales/credit-notes/${created.id}/edit`);
    },
    onError: (error) => setActionMessage(error?.message || 'Unable to create credit note. Please try again.'),
  });
  const cloneMutation = useMutation({
    mutationFn: () => recordsApi.create({
      module: 'sales',
      type: 'invoices',
      payload: clonedInvoicePayload(salesDocument, companyProfile),
    }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', 'invoices'] });
      setOpenMenu('');
      navigate(`/sales/invoices/${created.id}/edit`);
    },
    onError: (error) => setActionMessage(error?.message || 'Unable to clone invoice. Please try again.'),
  });
  const generateIrnMutation = useMutation({
    mutationFn: () => documentType === 'creditNotes'
      ? invoiceLifecycleApi.generateCreditNoteIrn(id)
      : invoiceLifecycleApi.generateIrn(id),
    onSuccess: (generated) => {
      queryClient.setQueryData(['e-invoice', documentType, id], generated);
      setGenerateIrnOpen(false);
      setActionMessage(`IRN generated successfully: ${generated.irn}`);
    },
    onError: (error) => {
      setGenerateIrnOpen(false);
      setActionMessage(apiErrorMessage(error, 'Unable to generate IRN.'));
      queryClient.invalidateQueries({ queryKey: ['e-invoice', documentType, id] });
    },
  });
  const refreshIrnMutation = useMutation({
    mutationFn: () => documentType === 'creditNotes'
      ? invoiceLifecycleApi.refreshCreditNoteIrn(id)
      : invoiceLifecycleApi.refreshIrn(id),
    onSuccess: (refreshed) => {
      queryClient.setQueryData(['e-invoice', documentType, id], refreshed);
      setActionMessage('IRN details refreshed from IRP successfully.');
    },
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Unable to retrieve IRN details.')),
  });
  const cancelIrnMutation = useMutation({
    mutationFn: (payload) => documentType === 'creditNotes'
      ? invoiceLifecycleApi.cancelCreditNoteIrn({ creditNoteId: id, ...payload })
      : invoiceLifecycleApi.cancelIrn({ invoiceId: id, ...payload }),
    onSuccess: (cancelled) => {
      queryClient.setQueryData(['e-invoice', documentType, id], cancelled);
      setCancelIrnOpen(false);
      setActionMessage('IRN cancelled successfully.');
    },
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Unable to cancel IRN.')),
  });
  const paymentMutation = useMutation({
    mutationFn: (paymentValues) => editingPayment
      ? invoiceLifecycleApi.updatePayment({ invoiceId: id, paymentId: editingPayment.id, payload: paymentValues })
      : invoiceLifecycleApi.recordPayment({ invoiceId: id, payload: paymentValues }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice-lifecycle', id], updated);
      queryClient.invalidateQueries({ queryKey: ['record', 'sales', 'invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lifecycle-list'] });
      setPaymentDialogOpen(false);
      setEditingPayment(null);
      setActionMessage(editingPayment ? 'Payment updated successfully.' : 'Payment recorded successfully.');
    },
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Unable to record payment. Please try again.')),
  });
  const reversePaymentMutation = useMutation({
    mutationFn: ({ paymentId, reason }) => invoiceLifecycleApi.reversePayment({ invoiceId: id, paymentId, reason }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice-lifecycle', id], updated);
      queryClient.invalidateQueries({ queryKey: ['record', 'sales', 'invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lifecycle-list'] });
      setReversePayment(null);
      setActionMessage('Payment reversed and invoice balance recalculated.');
    },
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Unable to reverse payment.')),
  });
  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId) => invoiceLifecycleApi.deletePayment({ invoiceId: id, paymentId }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice-lifecycle', id], updated);
      queryClient.invalidateQueries({ queryKey: ['record', 'sales', 'invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lifecycle-list'] });
      setPaymentToDelete(null);
      setActionMessage('Payment deleted and invoice balance recalculated.');
    },
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Unable to delete payment.')),
  });
  const communicationMutation = useMutation({
    mutationFn: (payload) => invoiceLifecycleApi.communicate({ invoiceId: id, payload }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice-lifecycle', id], updated);
      queryClient.invalidateQueries({ queryKey: ['record', 'sales', 'invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', 'invoices'] });
      setSendDialog('');
      setActionMessage('Communication saved successfully.');
    },
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Unable to send this invoice.')),
  });
  const reminderMutation = useMutation({
    mutationFn: (payload) => invoiceLifecycleApi.reminder({ invoiceId: id, payload }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice-lifecycle', id], updated);
      setReminderDialogOpen(false);
      setActionMessage('Reminder saved successfully.');
    },
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Unable to send reminder.')),
  });
  const voidMutation = useMutation({
    mutationFn: () => invoiceLifecycleApi.voidInvoice({ invoiceId: id, reason: voidReason }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice-lifecycle', id], updated);
      queryClient.invalidateQueries({ queryKey: ['record', 'sales', 'invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lifecycle-list'] });
      setVoidOpen(false);
      setVoidReason('');
      setActionMessage('Invoice voided successfully.');
    },
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Unable to void invoice.')),
  });
  const removeCreditNoteMutation = useMutation({
    mutationFn: () => invoiceLifecycleApi.removeCreditNote({ invoiceId: sourceInvoiceId, creditNoteId: id }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice-lifecycle', 'credit-note-source', sourceInvoiceId], updated);
      queryClient.setQueryData(['invoice-lifecycle', sourceInvoiceId], updated);
      queryClient.invalidateQueries({ queryKey: ['record', 'sales', 'creditNotes', id] });
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', 'creditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['record', 'sales', 'invoices', String(sourceInvoiceId)] });
      queryClient.invalidateQueries({ queryKey: ['records', 'sales', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lifecycle-list'] });
      setActionMessage('Credit allocation removed and the invoice balance was recalculated.');
    },
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Unable to remove the credit allocation.')),
  });

  if (documentQuery.isLoading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-bold text-[#06134a]">Loading {documentConfig.lowerLabel}...</div>;
  }

  if (documentQuery.isError || !salesDocument) {
    return (
      <section className="space-y-4 text-[#06134a]">
        <Link to={documentConfig.listRoute} className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft className="h-4 w-4" /> Back to {documentConfig.pluralLabel}</Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-600">{documentConfig.label} not found.</div>
      </section>
    );
  }

  const breakdown = invoiceBreakdown(salesDocument, documentType);
  const { items, totals } = breakdown;
  const subtotal = Number(totals.subtotal || salesDocument.amount || 0);
  const tax = Number(totals.taxAmount || 0);
  const total = Number(totals.grandTotal || salesDocument.amount || 0);
  const lifecycle = documentType === 'invoices' ? lifecycleQuery.data : null;
  const eInvoice = ['invoices', 'creditNotes'].includes(documentType) ? eInvoiceQuery.data : null;
  const sourceInvoiceLifecycle = documentType === 'creditNotes' ? sourceInvoiceLifecycleQuery.data : null;
  const creditNoteLink = sourceInvoiceLifecycle?.creditNotes?.find((link) => Number(link.creditNoteId) === Number(id));
  const creditsUsed = documentType === 'creditNotes'
    ? Number(creditNoteLink?.amountApplied ?? Math.max(0, total - Number(salesDocument.balanceAmount ?? total)))
    : 0;
  const creditsRemaining = documentType === 'creditNotes' ? Math.max(0, total - creditsUsed) : 0;
  const creditsApplied = documentType === 'invoices'
    ? Number(lifecycle?.creditApplied || 0) + Number(lifecycle?.creditNoteApplied || 0)
    : 0;
  const creditNotesApplied = documentType === 'invoices'
    ? Number(lifecycle?.creditNoteApplied || 0)
    : 0;
  const paymentsReceived = documentType === 'invoices'
    ? Number(lifecycle?.cashAmountPaid || 0) + Number(lifecycle?.tdsSettled || 0)
    : 0;
  const currentStatus = documentType === 'creditNotes' && creditsUsed > 0 && creditsRemaining <= 0.005
    ? 'Closed'
    : lifecycle?.status || salesDocument.status || 'Draft';
  const balanceDue = documentType === 'creditNotes'
    ? creditsRemaining
    : Number(lifecycle?.balanceDue ?? salesDocument.balanceAmount ?? total);
  const invoiceActions = lifecycle?.actions || fallbackInvoiceActions(currentStatus);
  const customerRecord = customerQuery.data?.content?.find((customer) => customer.partyName === salesDocument.partyName) || customerQuery.data?.content?.[0];
  const billTo = invoiceBillTo(salesDocument, customerRecord);
  const convertedInvoices = documentType === 'quotes'
    ? convertedInvoicesForQuote(salesDocument, convertedInvoicesQuery.data?.content || [])
    : [];
  const isQuoteInvoiced = documentType === 'quotes' && (convertedInvoices.length > 0 || salesDocument.status === 'Invoiced');
  const openPdfOrPrint = (mode) => {
    setOpenMenu('');
    openInvoicePrintWindow({
      invoice: { ...salesDocument, status: currentStatus },
      items,
      totals,
      subtotal,
      tax,
      total,
      balanceDue,
      creditsApplied: creditNotesApplied,
      paymentsReceived,
      creditsUsed,
      creditsRemaining,
      mode,
      companyProfile,
      billTo,
      documentType,
      eInvoice,
    });
  };
  const sendDocument = (mode) => {
    setOpenMenu('');
    setSendDialog(mode);
  };
  const shareDocument = () => {
    setOpenMenu('');
    setShareDialogOpen(true);
  };
  const isLockedInvoice = documentType === 'invoices' && currentStatus === 'Void';
  const isEInvoiceDocument = documentType === 'invoices' || documentType === 'creditNotes';
  const creditNoteIrnEligible = documentType !== 'creditNotes'
    || (sourceInvoiceId > 0 && currentStatus !== 'Draft' && Number(total || 0) > 0);
  const displayedDocument = documentType === 'invoices' || documentType === 'creditNotes'
    ? { ...salesDocument, status: currentStatus, balanceAmount: balanceDue }
    : salesDocument;

  return (
    <section className="min-h-[calc(100vh-96px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-sm">
      <div className="grid min-h-[calc(100vh-96px)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-white">
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
            <Link to={documentConfig.listRoute} className="text-sm font-black text-[#06134a]">All {documentConfig.pluralLabel}</Link>
            <div className="flex gap-2">
              <Link to={documentConfig.newRoute} className="grid h-9 w-10 place-items-center rounded-lg bg-emerald-600 text-white"><Plus className="h-4 w-4" /></Link>
              <button className="grid h-9 w-10 place-items-center rounded-lg border border-slate-200"><MoreVertical className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="max-h-[calc(100vh-160px)] overflow-y-auto">
            {documents.map((item) => (
              <Link
                key={item.id}
                to={`${documentConfig.listRoute}/${item.id}`}
                className={`block border-b border-slate-100 px-5 py-4 hover:bg-blue-50/70 ${Number(item.id) === Number(id) ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" readOnly />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-black text-[#06134a]">{item.partyName}</p>
                      <p className="shrink-0 text-sm font-black">{formatCurrency(Number(item.amount || 0), normalizeCurrencyCode(parseJsonObject(item.notes).Currency))}</p>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{item.recordNumber} <span className="px-2">•</span> {formatDate(item.recordDate)}</p>
                    <span className={`mt-3 inline-flex rounded-md px-2 py-1 text-[11px] font-black uppercase ${badgeClasses[item.status] || 'bg-slate-100 text-slate-700'}`}>{item.status}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </aside>

        <main className="min-w-0 bg-slate-50">
          <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
            <div className="flex items-center gap-4">
              <Link to={documentConfig.listRoute} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link>
              <h1 className="text-2xl font-black text-slate-950">{salesDocument.recordNumber}</h1>
              <StatusBadge value={currentStatus} />
            </div>
            <div className="flex items-center gap-2">
              <button className="grid h-9 min-w-12 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold"><Paperclip className="h-4 w-4" /></button>
              <button className="grid h-9 min-w-12 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">0</button>
              <Link to={documentConfig.listRoute} className="grid h-9 w-9 place-items-center rounded-lg text-red-600 hover:bg-red-50"><X className="h-5 w-5" /></Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-5 py-3 text-sm font-bold">
            <Link to={editRouteByType[documentType]?.(salesDocument.id) || documentConfig.listRoute} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 hover:bg-slate-100 ${(documentType === 'invoices' ? !invoiceActions.edit : ['quotes', 'orders'].includes(documentType) && salesDocument.status === 'Closed') || isLockedInvoice ? 'pointer-events-none opacity-50' : ''}`}><Edit3 className="h-4 w-4" /> Edit</Link>
            <ToolbarDropdown
              id="send"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              label="Send"
              icon={Mail}
              disabled={documentType === 'invoices' && !invoiceActions.send}
              items={[
                ['Send Email', () => sendDocument('email')],
                ['Send SMS', () => sendDocument('sms')],
                ...(documentType === 'invoices' || documentType === 'orders' ? [['Schedule Email', () => sendDocument('schedule')]] : []),
              ]}
            />
            <button onClick={shareDocument} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 hover:bg-slate-100"><Share2 className="h-4 w-4" /> Share</button>
            <ToolbarDropdown
              id="pdf"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              label="PDF / Print"
              icon={Printer}
              items={[
                ['Download PDF', () => openPdfOrPrint('pdf')],
                [`Print ${documentConfig.label}`, () => openPdfOrPrint('print')],
              ]}
            />
            {documentType === 'quotes' && (
              <ToolbarDropdown
                id="convert"
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                label="Convert"
                icon={RefreshCw}
                items={[
                  ['Convert to Invoice', () => convertMutation.mutate('invoices')],
                  ['Convert to Sales Order', () => convertMutation.mutate('orders')],
                ]}
              />
            )}
            {documentType === 'orders' && (
              <ToolbarDropdown
                id="convert"
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                label="Convert"
                icon={RefreshCw}
                items={[
                  ['Convert to Invoice', () => convertMutation.mutate('invoices')],
                ]}
              />
            )}
            {documentType === 'invoices' && (
              <button
                disabled={!invoiceActions.recordPayment || Number(balanceDue || 0) <= 0}
                onClick={() => { setEditingPayment(null); setPaymentDialogOpen(true); }}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
              >
                <ReceiptText className="h-4 w-4" /> Record Payment
              </button>
            )}
            {isEInvoiceDocument && eInvoice?.status === 'GENERATED' && (
              <button
                disabled={refreshIrnMutation.isPending}
                onClick={() => refreshIrnMutation.mutate()}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 hover:bg-slate-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshIrnMutation.isPending ? 'animate-spin' : ''}`} /> Get IRN Details
              </button>
            )}
            {isEInvoiceDocument && (
              <button
                disabled={generateIrnMutation.isPending || ['GENERATED', 'CANCELLED'].includes(eInvoice?.status) || isLockedInvoice || !creditNoteIrnEligible}
                onClick={() => setGenerateIrnOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
              >
                <ReceiptText className="h-4 w-4" /> {eInvoice?.status === 'GENERATED' ? 'IRN Generated' : documentType === 'creditNotes' ? 'Push to IRP' : 'Generate IRN'}
              </button>
            )}
            {documentType === 'invoices' && invoiceActions.reminder && (
              <button onClick={() => setReminderDialogOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 hover:bg-slate-100">
                <Send className="h-4 w-4" /> Send Reminder
              </button>
            )}
            <ToolbarDropdown
              id="more"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              label=""
              icon={MoreVertical}
              iconOnly
              items={documentType === 'invoices' ? [
                ...(currentStatus === 'Draft' && invoiceActions.send ? [['Mark As Sent', () => updateStatusMutation.mutate('Sent')]] : []),
                ...(invoiceActions.createCreditNote ? [['Create Credit Note', () => creditNoteMutation.mutate()]] : []),
                ...(invoiceActions.cloneInvoice ? [['Clone', () => cloneMutation.mutate()]] : []),
                ...(invoiceActions.voidInvoice ? [['Void', () => { setOpenMenu(''); setVoidOpen(true); }]] : []),
                ...(eInvoice?.status === 'GENERATED' ? [['Cancel IRN', () => { setOpenMenu(''); setCancelIrnOpen(true); }, 'danger']] : []),
                ...(invoiceActions.deleteInvoice ? [['Delete', () => { setOpenMenu(''); setDeleteOpen(true); }, 'danger']] : []),
              ] : [
                ['Mark As Sent', () => updateStatusMutation.mutate('Sent')],
                ['Close', () => updateStatusMutation.mutate('Closed')],
                ...(documentType === 'creditNotes' && eInvoice?.status === 'GENERATED' ? [['Cancel IRN', () => { setOpenMenu(''); setCancelIrnOpen(true); }, 'danger']] : []),
                ['Delete', () => { setOpenMenu(''); setDeleteOpen(true); }, 'danger'],
              ]}
            />
          </div>
          {(actionMessage || generateIrnMutation.isPending || refreshIrnMutation.isPending || cancelIrnMutation.isPending || updateStatusMutation.isPending || convertMutation.isPending || creditNoteMutation.isPending || cloneMutation.isPending || paymentMutation.isPending || lifecycleQuery.isLoading || sourceInvoiceLifecycleQuery.isLoading || communicationMutation.isPending || reminderMutation.isPending || reversePaymentMutation.isPending || deletePaymentMutation.isPending || voidMutation.isPending || removeCreditNoteMutation.isPending) && (
            <div className="border-b border-slate-200 bg-blue-50 px-5 py-2 text-xs font-bold text-blue-700">
              {generateIrnMutation.isPending ? 'Submitting encrypted invoice data to IRP...' : refreshIrnMutation.isPending ? 'Retrieving encrypted IRN details from IRP...' : cancelIrnMutation.isPending ? 'Cancelling IRN with IRP...' : lifecycleQuery.isLoading || sourceInvoiceLifecycleQuery.isLoading ? 'Loading document settlement...' : updateStatusMutation.isPending ? 'Updating status...' : convertMutation.isPending ? `Converting ${documentConfig.lowerLabel}...` : creditNoteMutation.isPending ? 'Creating credit note...' : cloneMutation.isPending ? 'Cloning invoice...' : paymentMutation.isPending ? 'Saving payment...' : communicationMutation.isPending ? 'Saving communication...' : reminderMutation.isPending ? 'Saving reminder...' : reversePaymentMutation.isPending ? 'Reversing payment...' : deletePaymentMutation.isPending ? 'Deleting payment...' : voidMutation.isPending ? 'Voiding invoice...' : removeCreditNoteMutation.isPending ? 'Removing credit allocation...' : actionMessage}
            </div>
          )}

          <div className="max-h-[calc(100vh-225px)] overflow-auto p-6">
            {documentType === 'quotes' ? (
              <QuoteViewTabs
                activeTab={quoteTab}
                onTabChange={setQuoteTab}
                invoice={salesDocument}
                items={items}
                totals={totals}
                subtotal={subtotal}
                tax={tax}
                total={total}
                balanceDue={balanceDue}
                companyProfile={companyProfile}
                billTo={billTo}
                convertedInvoices={convertedInvoices}
                convertedLoading={convertedInvoicesQuery.isLoading}
                showInvoicedTag={isQuoteInvoiced}
              />
            ) : documentType === 'creditNotes' ? (
              <>
                {eInvoice && (
                  <EInvoiceStatusPanel
                    eInvoice={eInvoice}
                    cancelling={cancelIrnMutation.isPending}
                    onCancel={() => setCancelIrnOpen(true)}
                    onMessage={setActionMessage}
                    onDownload={() => openPdfOrPrint('pdf')}
                  />
                )}
                <CreditNoteAppliedInvoicesPanel
                  lifecycle={sourceInvoiceLifecycle}
                  link={creditNoteLink}
                  loading={sourceInvoiceLifecycleQuery.isLoading}
                  removing={removeCreditNoteMutation.isPending}
                  onRemove={() => setCreditAllocationDeleteOpen(true)}
                />
                <InvoiceDocument invoice={displayedDocument} items={items} totals={totals} subtotal={subtotal} tax={tax} total={total} balanceDue={balanceDue} creditsUsed={creditsUsed} creditsRemaining={creditsRemaining} companyProfile={companyProfile} billTo={billTo} documentType={documentType} eInvoice={eInvoice} />
                <CreditNoteInformationPanel invoice={salesDocument} lifecycle={sourceInvoiceLifecycle} totals={totals} subtotal={subtotal} total={total} />
              </>
            ) : (
              <>
                {documentType === 'invoices' && storedDocumentNotes.projectId && (
                  <div className="mx-auto mb-4 flex max-w-[940px] flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm">
                    <div><span className="font-bold text-slate-500">Internal Project</span><p className="mt-1 font-black text-[#06134a]">{storedDocumentNotes.projectName || `Project #${storedDocumentNotes.projectId}`} <span className="ml-2 font-semibold text-slate-500">• {storedDocumentNotes.invoiceType || salesDocument.category}</span></p></div>
                    <Link to={`/project/${(storedDocumentNotes.invoiceType || salesDocument.category) === 'Staffing' ? 'staffing' : 'fixed-cost'}/${storedDocumentNotes.projectId}`} className="font-black text-blue-600">View Project →</Link>
                  </div>
                )}
                {(documentType === 'invoices' || documentType === 'creditNotes') && eInvoice && eInvoice.status !== 'NOT_GENERATED' && (
                  <EInvoiceStatusPanel
                    eInvoice={eInvoice}
                    cancelling={cancelIrnMutation.isPending}
                    onCancel={() => setCancelIrnOpen(true)}
                    onMessage={setActionMessage}
                    onDownload={() => openPdfOrPrint('pdf')}
                  />
                )}
                <InvoiceDocument invoice={displayedDocument} items={items} totals={totals} subtotal={subtotal} tax={tax} total={total} balanceDue={balanceDue} creditsApplied={creditsApplied} companyProfile={companyProfile} billTo={billTo} documentType={documentType} eInvoice={eInvoice} />
                {documentType === 'invoices' && lifecycle && (
                  <InvoiceLifecyclePanels
                    lifecycle={lifecycle}
                    onEditPayment={(payment) => { setEditingPayment(payment); setPaymentDialogOpen(true); }}
                    onReversePayment={setReversePayment}
                    onDeletePayment={setPaymentToDelete}
                    onDownloadReceipt={(payment) => openPaymentReceiptWindow({ lifecycle, payment, companyProfile, mode: 'pdf' })}
                    onViewReceipt={(payment) => openPaymentReceiptWindow({ lifecycle, payment, companyProfile, mode: 'print' })}
                    onEmailReceipt={(payment) => sharePaymentReceipt({ lifecycle, payment, invoice: salesDocument, channel: 'email' })}
                    onWhatsAppReceipt={(payment) => sharePaymentReceipt({ lifecycle, payment, invoice: salesDocument, channel: 'whatsapp' })}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
      <SendDocumentDialog
        mode={sendDialog}
        documentConfig={documentConfig}
        salesDocument={salesDocument}
        onClose={() => setSendDialog('')}
        onDownload={() => openPdfOrPrint('pdf')}
        loading={communicationMutation.isPending}
        onSubmit={documentType === 'invoices' ? (payload) => communicationMutation.mutate(payload) : null}
      />
      <ShareDocumentDialog
        open={shareDialogOpen}
        documentConfig={documentConfig}
        salesDocument={salesDocument}
        onClose={() => setShareDialogOpen(false)}
        onDownload={() => openPdfOrPrint('pdf')}
        onMessage={setActionMessage}
      />
      <RecordPaymentDialog
        open={paymentDialogOpen}
        invoice={displayedDocument}
        lifecycle={lifecycle}
        payment={editingPayment}
        balanceDue={balanceDue}
        taxableAmount={Number(totals.taxableAmount || total)}
        tdsBaseType={companyProfile.tdsBaseType || 'TAXABLE_VALUE'}
        loading={paymentMutation.isPending}
        onClose={() => {
          if (paymentMutation.isPending) return;
          setPaymentDialogOpen(false);
          setEditingPayment(null);
        }}
        onSubmit={(values) => paymentMutation.mutate(values)}
      />
      <ReminderDialog
        open={reminderDialogOpen}
        invoice={displayedDocument}
        loading={reminderMutation.isPending}
        onClose={() => !reminderMutation.isPending && setReminderDialogOpen(false)}
        onSubmit={(values) => reminderMutation.mutate(values)}
      />
      <ConfirmDialog
        open={generateIrnOpen}
        title={documentType === 'creditNotes' ? 'Push Credit Note to IRP?' : 'Generate GST e-invoice IRN?'}
        message={documentType === 'creditNotes'
          ? 'This submits this Credit Note as document type CRN to IRP. Its IRN and QR code will remain separate from the original invoice.'
          : 'This submits the finalized invoice to IRP. After a successful IRN generation, the invoice tax identity cannot be edited locally.'}
        confirmLabel={documentType === 'creditNotes' ? 'Push to IRP' : 'Generate IRN'}
        loadingLabel="Generating IRN..."
        loading={generateIrnMutation.isPending}
        onCancel={() => !generateIrnMutation.isPending && setGenerateIrnOpen(false)}
        onConfirm={() => generateIrnMutation.mutate()}
      />
      <CancelIrnDialog
        open={cancelIrnOpen}
        loading={cancelIrnMutation.isPending}
        onCancel={() => !cancelIrnMutation.isPending && setCancelIrnOpen(false)}
        onConfirm={(payload) => cancelIrnMutation.mutate(payload)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${documentConfig.label}?`}
        message={`This will permanently delete ${salesDocument.recordNumber}.`}
        loading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
      <ConfirmDialog
        open={creditAllocationDeleteOpen}
        title="Remove invoice credit?"
        message={`This will remove ${salesDocument.recordNumber} from ${sourceInvoiceLifecycle?.invoiceNumber || 'the linked invoice'} and recalculate both remaining balances.`}
        loading={removeCreditNoteMutation.isPending}
        onCancel={() => !removeCreditNoteMutation.isPending && setCreditAllocationDeleteOpen(false)}
        onConfirm={() => removeCreditNoteMutation.mutate(undefined, { onSuccess: () => setCreditAllocationDeleteOpen(false) })}
      />
      <ReasonDialog
        open={voidOpen}
        title="Void invoice?"
        message={`This will mark ${salesDocument.recordNumber} as Void and prevent further payment, reminders, or editing.`}
        reason={voidReason}
        onReasonChange={setVoidReason}
        confirmLabel="Void Invoice"
        loading={voidMutation.isPending}
        onCancel={() => !voidMutation.isPending && setVoidOpen(false)}
        onConfirm={() => voidMutation.mutate()}
      />
      <ReasonDialog
        open={Boolean(reversePayment)}
        title="Reverse payment?"
        message={reversePayment ? `This will reverse receipt ${reversePayment.receiptNumber || reversePayment.paymentNumber} and recalculate the invoice balance.` : ''}
        reason={reversePayment?.reason || ''}
        onReasonChange={(reason) => setReversePayment((current) => current ? { ...current, reason } : current)}
        confirmLabel="Reverse Payment"
        loading={reversePaymentMutation.isPending}
        onCancel={() => !reversePaymentMutation.isPending && setReversePayment(null)}
        onConfirm={() => reversePayment && reversePaymentMutation.mutate({ paymentId: reversePayment.id, reason: reversePayment.reason || '' })}
      />
      <ConfirmDialog
        open={Boolean(paymentToDelete)}
        title="Delete payment?"
        message={paymentToDelete ? `This will permanently delete payment ${paymentToDelete.paymentNumber} and recalculate the invoice balance and status.` : ''}
        loading={deletePaymentMutation.isPending}
        onCancel={() => !deletePaymentMutation.isPending && setPaymentToDelete(null)}
        onConfirm={() => paymentToDelete && deletePaymentMutation.mutate(paymentToDelete.id)}
      />
    </section>
  );
}

function CreditNoteAppliedInvoicesPanel({ lifecycle, link, loading, removing, onRemove }) {
  return (
    <section className="mx-auto mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ maxWidth: 940 }}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
          Credit Applied Invoices
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-blue-50 px-1.5 text-xs text-blue-600">{link ? 1 : 0}</span>
        </h2>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </div>
      <div className="overflow-x-auto px-5 pb-4">
        <table className="w-full min-w-[620px] table-fixed text-left">
          <thead className="text-xs font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[24%] px-3 py-3">Date</th>
              <th className="w-[36%] px-3 py-3">Invoice Number</th>
              <th className="w-[30%] px-3 py-3 text-right">Amount Credited</th>
              <th className="w-[10%] px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="border-t border-slate-200 text-sm font-bold text-slate-950">
            {loading && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Loading applied invoice...</td></tr>}
            {!loading && !link && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No invoice credit has been applied.</td></tr>}
            {!loading && link && (
              <tr>
                <td className="px-3 py-4">{formatDate(link.createdAt || lifecycle?.invoiceDate)}</td>
                <td className="px-3 py-4">
                  <Link to={`/sales/invoices/${lifecycle?.invoiceId}`} className="font-black text-blue-600 hover:underline">{lifecycle?.invoiceNumber || '-'}</Link>
                </td>
                <td className="px-3 py-4 text-right">{formatCurrency(Number(link.amountApplied || 0))}</td>
                <td className="px-3 py-4 text-right">
                  <button type="button" disabled={removing} onClick={onRemove} className="inline-grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50" title="Remove invoice credit">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreditNoteInformationPanel({ invoice, lifecycle, totals = {}, subtotal = 0, total = 0 }) {
  const notes = parseJsonObject(invoice?.notes);
  const taxableAmount = Number(totals.taxableAmount ?? subtotal ?? 0);
  const taxRows = [
    ['Output CGST', Number(totals.cgst || 0)],
    ['Output SGST', Number(totals.sgst || 0)],
    ['Output IGST', Number(totals.igst || 0)],
  ].filter(([, value]) => Math.abs(value) > 0.005);
  const debitTotal = taxableAmount + taxRows.reduce((sum, [, value]) => sum + value, 0);
  const associatedInvoice = lifecycle?.invoiceNumber || notes['Reference Invoice'] || '';

  return (
    <section className="mx-auto mt-6 rounded-xl border border-slate-200 bg-white p-6 text-[#06134a] shadow-sm" style={{ maxWidth: 940 }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-950">More Information</h2>
        {associatedInvoice && (
          <p className="text-sm font-bold text-slate-600">
            Associated Invoice <span className="px-2">:</span>
            {lifecycle?.invoiceId ? <Link to={`/sales/invoices/${lifecycle.invoiceId}`} className="text-blue-600 hover:underline">{associatedInvoice}</Link> : associatedInvoice}
          </p>
        )}
      </div>
      <div className="mt-6 border-b border-slate-200">
        <span className="inline-block border-b-3 border-blue-500 px-2 pb-3 text-sm font-black">Journal</span>
      </div>
      <p className="mt-4 text-xs font-semibold text-slate-500">Amount is displayed in your base currency <span className="rounded bg-emerald-600 px-1.5 py-0.5 font-black text-white">INR</span></p>
      <h3 className="mt-4 text-base font-black text-slate-950">Credit Note</h3>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-500">
          <tr><th className="px-3 py-3">Account</th><th className="px-3 py-3 text-right">Debit</th><th className="px-3 py-3 text-right">Credit</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-semibold text-slate-950">
          <tr><td className="px-3 py-3">Sales</td><td className="px-3 py-3 text-right">{formatNumber(taxableAmount)}</td><td className="px-3 py-3 text-right">0.00</td></tr>
          {taxRows.map(([account, value]) => <tr key={account}><td className="px-3 py-3">{account}</td><td className="px-3 py-3 text-right">{formatNumber(value)}</td><td className="px-3 py-3 text-right">0.00</td></tr>)}
          <tr><td className="px-3 py-3">Accounts Receivable</td><td className="px-3 py-3 text-right">0.00</td><td className="px-3 py-3 text-right">{formatNumber(total)}</td></tr>
          <tr className="border-t-2 border-slate-200 font-black"><td className="px-3 py-3">Total</td><td className="px-3 py-3 text-right">{formatNumber(debitTotal)}</td><td className="px-3 py-3 text-right">{formatNumber(total)}</td></tr>
        </tbody>
      </table>
    </section>
  );
}

function convertedInvoicesForQuote(quote, invoices = []) {
  const quoteNotes = parseJsonObject(quote?.notes);
  const convertedInvoice = quoteNotes.convertedInvoice || {};
  const matches = invoices.filter((invoice) => {
    const notes = parseJsonObject(invoice.notes);
    return String(notes.convertedFrom || '') === String(quote?.recordNumber || '')
      || String(notes.convertedFromId || '') === String(quote?.id || '')
      || String(invoice.id || '') === String(convertedInvoice.id || '');
  });

  if (convertedInvoice.id && !matches.some((invoice) => String(invoice.id) === String(convertedInvoice.id))) {
    matches.unshift({
      id: convertedInvoice.id,
      recordNumber: convertedInvoice.recordNumber,
      recordDate: convertedInvoice.date,
      dueDate: convertedInvoice.dueDate,
      status: convertedInvoice.status || 'Draft',
      amount: convertedInvoice.amount || quote?.amount || 0,
      balanceAmount: convertedInvoice.balanceAmount ?? convertedInvoice.amount ?? quote?.balanceAmount ?? quote?.amount ?? 0,
    });
  }

  return matches;
}

function QuoteViewTabs({
  activeTab,
  onTabChange,
  invoice,
  items,
  totals,
  subtotal,
  tax,
  total,
  balanceDue,
  companyProfile,
  billTo,
  convertedInvoices,
  convertedLoading,
  showInvoicedTag,
}) {
  const tabs = [
    ['details', 'Quote Details'],
    ['invoices', 'Invoices'],
    ['activity', 'Activity'],
  ];

  return (
    <div
      className="mx-auto rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-sm"
      style={{ maxWidth: 1040, padding: '22px 26px 28px' }}
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 sm:flex-row sm:items-start">
        <div className="flex flex-wrap" style={{ gap: 30 }}>
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={`relative px-0 ${activeTab === key ? 'text-slate-950' : 'text-slate-700 hover:text-slate-950'}`}
              style={{ paddingBottom: 16, fontSize: 16, lineHeight: '22px', fontWeight: activeTab === key ? 800 : 600 }}
            >
              {label}
              {activeTab === key && <span className="absolute bottom-0 left-0 rounded-t-full bg-blue-500" style={{ width: 105, height: 3 }} />}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'details' && (
          <div
            className="relative mx-auto"
            style={{
              marginTop: 26,
              maxWidth: 940,
              overflow: 'visible',
            }}
          >
            {showInvoicedTag && <InvoicedRibbon />}
            <InvoiceDocument invoice={invoice} items={items} totals={totals} subtotal={subtotal} tax={tax} total={total} balanceDue={balanceDue} companyProfile={companyProfile} billTo={billTo} documentType="quotes" />
          </div>
        )}
        {activeTab === 'invoices' && <ConvertedInvoicesPanel invoices={convertedInvoices} loading={convertedLoading} />}
        {activeTab === 'activity' && <QuoteActivityPanel quote={invoice} convertedInvoices={convertedInvoices} />}
      </div>
    </div>
  );
}

function InvoicedRibbon() {
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: -1,
        top: -1,
        width: 138,
        height: 138,
        overflow: 'hidden',
      }}
    >
      <div
        className="bg-emerald-500 text-center font-black text-white shadow-md"
        style={{
          position: 'absolute',
          left: -44,
          top: 39,
          width: 184,
          padding: '6px 0',
          transform: 'rotate(-45deg)',
          transformOrigin: 'center',
          fontSize: 14,
          lineHeight: '18px',
          letterSpacing: 0,
        }}
      >
        Invoiced
      </div>
    </div>
  );
}

function InvoiceStatusRibbon({ status }) {
  const colors = {
    Paid: 'bg-emerald-500',
    'Partially Paid': 'bg-violet-600',
    Overdue: 'bg-red-600',
    Sent: 'bg-blue-600',
    Viewed: 'bg-cyan-600',
    Closed: 'bg-emerald-500',
    Void: 'bg-slate-500',
    Draft: 'bg-slate-400',
  };
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 h-36 w-36 overflow-hidden">
      <div className={`${colors[status] || 'bg-slate-500'} absolute -left-11 top-9 w-48 -rotate-45 py-1.5 text-center font-sans text-xs font-black uppercase tracking-wide text-white shadow-md`}>
        {status}
      </div>
    </div>
  );
}

function ConvertedInvoicesPanel({ invoices = [], loading = false }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-black text-slate-950">Invoices</h2>
      <div className="overflow-hidden border-y border-slate-200">
        <table className="w-full table-fixed text-left">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[18%] px-3 py-4">Date</th>
              <th className="w-[22%] px-3 py-4">Invoice#</th>
              <th className="w-[16%] px-3 py-4">Status</th>
              <th className="w-[18%] px-3 py-4">Due Date</th>
              <th className="w-[14%] px-3 py-4 text-right">Amount</th>
              <th className="w-[12%] px-3 py-4 text-right">Balance Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm font-semibold text-slate-950">
            {loading && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm font-bold text-slate-500">Loading converted invoices...</td></tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm font-bold text-slate-500">No invoice converted from this quote yet.</td></tr>
            )}
            {!loading && invoices.map((item) => (
              <tr key={item.id || item.recordNumber}>
                <td className="px-3 py-4">{formatDate(item.recordDate)}</td>
                <td className="px-3 py-4">
                  {item.id ? (
                    <Link to={`/sales/invoices/${item.id}`} className="font-black text-blue-600 hover:underline">{item.recordNumber}</Link>
                  ) : (
                    <span className="font-black text-slate-700">{item.recordNumber || '-'}</span>
                  )}
                </td>
                <td className="px-3 py-4 uppercase text-slate-500">{item.status || 'Draft'}</td>
                <td className="px-3 py-4">{formatDate(item.dueDate)}</td>
                <td className="px-3 py-4 text-right">{formatCurrency(Number(item.amount || 0))}</td>
                <td className="px-3 py-4 text-right">{formatCurrency(Number(item.balanceAmount || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QuoteActivityPanel({ quote, convertedInvoices = [] }) {
  const notes = parseJsonObject(quote?.notes);
  const activities = [
    ...convertedInvoices.map((invoice) => ({
      key: `invoice-${invoice.id || invoice.recordNumber}`,
      date: invoice.createdAt || invoice.recordDate,
      title: `Quote converted to Invoice ${invoice.recordNumber}`,
      actor: 'Praveen Raghuvanshi',
      link: invoice.id ? `/sales/invoices/${invoice.id}` : '',
      linkLabel: 'View the invoice',
    })),
    ...(Array.isArray(notes.conversionActivity) ? notes.conversionActivity.filter((activity) => activity.type !== 'invoice').map((activity) => ({
      key: `${activity.type}-${activity.id || activity.recordNumber}`,
      date: activity.createdAt,
      title: `Quote converted to Sales Order ${activity.recordNumber}`,
      actor: activity.actor || 'Praveen Raghuvanshi',
      link: activity.id ? `/sales/orders/${activity.id}/edit` : '',
      linkLabel: 'View the sales order',
    })) : []),
    {
      key: 'created',
      date: quote?.createdAt || quote?.recordDate,
      title: `Quote created for ${formatCurrency(Number(quote?.amount || 0))}`,
      actor: quote?.ownerName || 'Praveen Raghuvanshi',
    },
  ];

  return (
    <section className="divide-y divide-slate-200">
      {activities.map((activity) => (
        <div key={activity.key} className="grid gap-4 py-5 md:grid-cols-[180px_34px_1fr]">
          <p className="text-sm font-semibold text-slate-500">{formatActivityDate(activity.date)}</p>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <Plus className="h-4 w-4" />
          </span>
          <div className="space-y-1.5 text-sm text-slate-950">
            <p>{activity.title}</p>
            <p>by <span className="font-black">{activity.actor}</span></p>
            {activity.link && (
              <Link to={activity.link} className="inline-flex items-center gap-2 text-blue-600 hover:underline">
                <Eye className="h-4 w-4" /> {activity.linkLabel}
              </Link>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function formatActivityDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function documentViewConfig(documentType = 'invoices') {
  if (documentType === 'creditNotes') {
    return {
      label: 'Credit Note',
      lowerLabel: 'credit note',
      pluralLabel: 'Credit Notes',
      listRoute: '/sales/credit-notes',
      newRoute: '/sales/credit-notes/new',
      title: 'CREDIT NOTE',
      numberLabel: '#',
      dateLabel: 'Credit Date',
      dueDateLabel: 'Invoice Date',
      subjectFallback: '',
    };
  }
  if (documentType === 'quotes') {
    return {
      label: 'Proforma Invoice',
      lowerLabel: 'proforma invoice',
      pluralLabel: 'Proforma Invoices',
      listRoute: '/sales/quotes',
      newRoute: '/sales/quotes/new',
      title: 'Proforma Invoice',
      numberLabel: 'Proforma Number',
      dateLabel: 'Proforma Date',
      dueDateLabel: 'Expiry Date',
      subjectFallback: 'Proforma invoice for requested services',
    };
  }
  if (documentType === 'orders') {
    return {
      label: 'Sales Order',
      lowerLabel: 'sales order',
      pluralLabel: 'Sales Orders',
      listRoute: '/sales/orders',
      newRoute: '/sales/orders/new',
      title: 'SALES ORDER',
      numberLabel: 'Sales Order Number',
      dateLabel: 'Sales Order Date',
      dueDateLabel: 'Valid Until',
      subjectFallback: '',
    };
  }
  return {
    label: 'Invoice',
    lowerLabel: 'invoice',
    pluralLabel: 'Invoices',
    listRoute: '/sales/invoices',
    newRoute: '/sales/invoices/new',
    title: 'TAX INVOICE',
    numberLabel: '#',
    dateLabel: 'Invoice Date',
    dueDateLabel: 'Due Date',
    subjectFallback: 'Invoice for services',
  };
}

function ToolbarDropdown({ id, openMenu, setOpenMenu, label, icon: Icon, items = [], iconOnly = false, disabled = false }) {
  const isOpen = openMenu === id;
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || items.length === 0}
        onClick={() => setOpenMenu(isOpen ? '' : id)}
        className={`${iconOnly ? 'grid h-9 w-10 place-items-center' : 'inline-flex h-9 items-center gap-2 px-3'} rounded-lg hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40`}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {!iconOnly && <span>{label}</span>}
        {!iconOnly && <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div
          className="absolute left-0 top-10 z-30 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl"
          style={{ minWidth: 190 }}
        >
          {items.map(([itemLabel, onClick, tone]) => (
            <button
              key={itemLabel}
              type="button"
              onClick={onClick}
              className={`block w-full px-4 py-2.5 text-left font-bold hover:bg-slate-50 ${tone === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-[#06134a]'}`}
              style={{ whiteSpace: 'nowrap' }}
            >
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SendDocumentDialog({ mode, documentConfig, salesDocument, onClose, onDownload, onSubmit, loading = false }) {
  const isEmail = mode === 'email';
  const isSms = mode === 'sms';
  const isSchedule = mode === 'schedule';
  const [to, setTo] = useState(salesDocument?.partyEmail || '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [mobile, setMobile] = useState(salesDocument?.partyPhone || '');
  const [subject, setSubject] = useState(`${documentConfig.label} ${salesDocument?.recordNumber || ''}`);
  const [body, setBody] = useState(`Dear ${salesDocument?.partyName || 'Customer'},\n\nPlease find ${documentConfig.label.toLowerCase()} ${salesDocument?.recordNumber || ''} attached as PDF.\n\nRegards,\nIntelliaTech`);
  const [smsBody, setSmsBody] = useState(`${documentConfig.label} ${salesDocument?.recordNumber || ''} for ${formatCurrency(Number(salesDocument?.amount || 0))} is ready from IntelliaTech.`);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [message, setMessage] = useState('');
  if (!mode) return null;

  const submitCommunication = () => {
    if (isEmail || isSchedule) {
      if (!to.trim()) {
        setMessage('Recipient email is required.');
        return;
      }
      const payload = {
        type: 'EMAIL',
        recipient: to.trim(),
        cc,
        bcc,
        subject,
        body,
        scheduledAt: isSchedule ? `${scheduleDate}T${scheduleTime}:00` : null,
        deliverySuccessful: !isSchedule,
      };
      if (onSubmit) onSubmit(payload);
      else if (isSchedule) setMessage(`Email scheduled for ${formatDate(scheduleDate)} at ${scheduleTime}.`);
      else window.location.href = `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc)}&bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      return;
    }
    if (!mobile.trim()) {
      setMessage('Mobile number is required.');
      return;
    }
    if (onSubmit) onSubmit({ type: 'SMS', recipient: mobile.trim(), body: smsBody, deliverySuccessful: true });
    else setMessage('SMS queued placeholder saved. Configure SMS gateway to send automatically.');
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black">{isSchedule ? 'Schedule Email' : isEmail ? 'Send Email' : 'Send SMS'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{documentConfig.label} {salesDocument?.recordNumber}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {(isEmail || isSchedule) && (
            <>
              <DialogInput label="To" value={to} onChange={setTo} placeholder="customer@example.com" />
              <div className="grid gap-4 sm:grid-cols-2">
                <DialogInput label="CC" value={cc} onChange={setCc} placeholder="Optional" />
                <DialogInput label="BCC" value={bcc} onChange={setBcc} placeholder="Optional" />
              </div>
              <DialogInput label="Subject" value={subject} onChange={setSubject} />
              <DialogTextarea label="Email Body" value={body} onChange={setBody} />
              {isSchedule && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <DialogInput label="Date" type="date" value={scheduleDate} onChange={setScheduleDate} />
                  <DialogInput label="Time" type="time" value={scheduleTime} onChange={setScheduleTime} />
                </div>
              )}
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
                The latest invoice PDF will be attached. Use Download PDF to review the attachment before sending.
              </div>
            </>
          )}
          {isSms && (
            <>
              <DialogInput label="Mobile Number" value={mobile} onChange={setMobile} placeholder="+91 98765 43210" />
              <DialogTextarea label="SMS Content" value={smsBody} onChange={setSmsBody} />
            <div className="rounded-lg border border-orange-100 bg-orange-50 p-4 text-sm font-semibold text-orange-800">
              SMS gateway is not integrated yet. This placeholder is ready for SMS service integration.
            </div>
            </>
          )}
          {message && <p className="text-sm font-bold text-emerald-600">{message}</p>}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button onClick={onClose} disabled={loading} className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          {(isEmail || isSchedule) && <button onClick={onDownload} className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black hover:bg-slate-50">Download PDF</button>}
          <button disabled={loading} onClick={submitCommunication} className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Saving...' : isEmail ? 'Send Email' : isSchedule ? 'Schedule Email' : 'Send SMS'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareDocumentDialog({ open, documentConfig, salesDocument, onClose, onDownload, onMessage }) {
  if (!open) return null;
  const shareUrl = window.location.href;
  const whatsappText = `${documentConfig.label} ${salesDocument.recordNumber}: ${shareUrl}`;
  async function copy(text, label) {
    try {
      await navigator.clipboard?.writeText(text);
      onMessage(`${label} copied successfully.`);
    } catch {
      onMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 px-4 py-6">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black">Share {documentConfig.label}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{salesDocument.recordNumber}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 p-5">
          <button onClick={() => copy(shareUrl, 'Share link')} className="h-11 rounded-lg border border-slate-200 px-4 text-left text-sm font-black hover:bg-slate-50">Copy Share Link</button>
          <a href={`mailto:?subject=${encodeURIComponent(`${documentConfig.label} ${salesDocument.recordNumber}`)}&body=${encodeURIComponent(shareUrl)}`} className="grid h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-black hover:bg-slate-50">Share via Email</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noreferrer" className="grid h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-black hover:bg-slate-50">Share via WhatsApp</a>
          <button onClick={onDownload} className="h-11 rounded-lg border border-slate-200 px-4 text-left text-sm font-black hover:bg-slate-50">Download PDF</button>
          <button onClick={() => copy(shareUrl, 'Public link')} className="h-11 rounded-lg border border-slate-200 px-4 text-left text-sm font-black hover:bg-slate-50">Copy Public Link</button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentDialog({ open, invoice, lifecycle, payment, balanceDue, taxableAmount, tdsBaseType, loading, onClose, onSubmit }) {
  const today = new Date().toISOString().slice(0, 10);
  const paymentModes = ['Cash', 'Bank Transfer', 'UPI', 'Credit Card', 'Debit Card', 'Cheque', 'PayPal', 'Wise', 'NEFT', 'RTGS', 'IMPS', 'Other'];
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [depositAccount, setDepositAccount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [amountReceived, setAmountReceived] = useState('0');
  const [bankCharges, setBankCharges] = useState('0');
  const [creditApplied, setCreditApplied] = useState('0');
  const [tdsDeducted, setTdsDeducted] = useState(false);
  const [tdsPercentage, setTdsPercentage] = useState('0');
  const [tdsAmount, setTdsAmount] = useState('0');
  const [tdsSectionCode, setTdsSectionCode] = useState('');
  const [tdsCertificateNumber, setTdsCertificateNumber] = useState('');
  const [tdsCertificateDate, setTdsCertificateDate] = useState('');
  const [tdsRemarks, setTdsRemarks] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [sendThankYouEmail, setSendThankYouEmail] = useState(true);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const paymentCurrency = normalizeCurrencyCode(payment?.currencyCode || lifecycle?.currency || parseJsonObject(invoice?.notes).Currency);

  const configuredBase = roundCurrency(tdsBaseType === 'TAXABLE_VALUE' ? Number(taxableAmount || 0) : Number(lifecycle?.invoiceTotal || invoice?.amount || 0));
  const priorSettlement = roundCurrency(payment ? Number(payment.grossAmountReceived || 0) + Number(payment.tdsAmount || 0) + Number(payment.creditApplied || 0) : 0);
  const eligibleOutstanding = roundCurrency(Number(balanceDue || 0) + priorSettlement);
  const gross = roundCurrency(Number(amountReceived || 0));
  const tds = roundCurrency(tdsDeducted ? Number(tdsAmount || 0) : 0);
  const credit = roundCurrency(Number(creditApplied || 0));
  const charges = roundCurrency(Number(bankCharges || 0));
  const totalSettled = roundCurrency(gross + tds + credit);
  const netBankCredit = roundCurrency(Math.max(0, gross - charges));
  const remaining = roundCurrency(Math.max(0, eligibleOutstanding - totalSettled));

  useEffect(() => {
    if (!open) return;
    setPaymentDate(payment?.paymentDate || today);
    setPaymentMode(payment?.paymentMode || 'Bank Transfer');
    setReferenceNumber(payment?.referenceNumber || '');
    setDepositAccount(payment?.depositAccount || '');
    setBankAccountId(payment?.bankAccountId ? String(payment.bankAccountId) : '');
    setAmountReceived(String(payment?.grossAmountReceived ?? roundCurrency(balanceDue || 0)));
    setBankCharges(String(payment?.bankCharges ?? 0));
    setCreditApplied(String(payment?.creditApplied ?? 0));
    setTdsDeducted(Number(payment?.tdsAmount || 0) > 0);
    setTdsPercentage(String(payment?.tdsPercentage ?? 0));
    setTdsAmount(String(payment?.tdsAmount ?? 0));
    setTdsSectionCode(payment?.tdsSectionCode || '');
    setTdsCertificateNumber(payment?.tdsCertificateNumber || '');
    setTdsCertificateDate(payment?.tdsCertificateDate || '');
    setTdsRemarks(payment?.tdsRemarks || '');
    setNotes(payment?.notes || '');
    setAttachmentUrl(payment?.attachmentUrl || '');
    setAttachmentFile(null);
    setSendThankYouEmail(payment?.sendThankYouEmail ?? true);
    setIdempotencyKey(globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}-${Math.random()}`);
    setValidationMessage('');
  }, [balanceDue, open, payment, today]);

  const updateTdsRate = (value) => {
    setTdsPercentage(value);
    const rate = Number(value || 0);
    if (rate >= 0 && rate <= 100) {
      const nextTds = roundCurrency(configuredBase * rate / 100);
      if (!payment && Math.abs(totalSettled - eligibleOutstanding) < 0.01) {
        setAmountReceived(String(roundCurrency(Math.max(0, eligibleOutstanding - nextTds - credit))));
      }
      setTdsAmount(String(nextTds));
    }
  };

  const updateTdsAmount = (value) => {
    const nextTds = roundCurrency(Number(value || 0));
    if (!payment && Math.abs(totalSettled - eligibleOutstanding) < 0.01) {
      setAmountReceived(String(roundCurrency(Math.max(0, eligibleOutstanding - nextTds - credit))));
    }
    setTdsAmount(value);
  };

  const clearTds = () => {
    if (!payment && Math.abs(totalSettled - eligibleOutstanding) < 0.01) {
      setAmountReceived(String(roundCurrency(Math.max(0, eligibleOutstanding - credit))));
    }
    setTdsDeducted(false);
    setTdsAmount('0');
    setTdsPercentage('0');
  };

  const submit = async () => {
    setValidationMessage('');
    if (!paymentDate) return setValidationMessage('Payment Date is required.');
    if (gross < 0 || tds < 0 || credit < 0) return setValidationMessage('Payment, TDS, and credit amounts cannot be negative.');
    if (gross <= 0 && tds <= 0 && credit <= 0) return setValidationMessage('Enter an amount received, TDS amount, or credit applied.');
    if (gross > 0 && !paymentMode) return setValidationMessage('Payment Mode is required.');
    if (gross > 0 && !['Cash', 'Other'].includes(paymentMode) && !bankAccountId) return setValidationMessage('Deposit To / Bank Account is required for this payment mode.');
    if (charges < 0 || charges > gross) return setValidationMessage('Bank Charges must be between zero and Amount Received.');
    if (Number(tdsPercentage || 0) < 0 || Number(tdsPercentage || 0) > 100) return setValidationMessage('TDS Percentage must be between 0 and 100.');
    if (tds > configuredBase) return setValidationMessage('TDS Amount cannot exceed the configured TDS base.');
    if (totalSettled > eligibleOutstanding) return setValidationMessage('Total settlement cannot exceed the outstanding amount.');
    let uploadedAttachmentUrl = attachmentUrl;
    if (attachmentFile) {
      if (!['application/pdf', 'image/png', 'image/jpeg'].includes(attachmentFile.type)) return setValidationMessage('Only PDF, PNG, and JPG attachments are supported.');
      if (attachmentFile.size > 10 * 1024 * 1024) return setValidationMessage('Payment attachment size must be 10 MB or less.');
      try {
        setUploadingAttachment(true);
        const uploaded = await storageApi.uploadPaymentAttachment(attachmentFile);
        uploadedAttachmentUrl = uploaded.url;
      } catch (error) {
        setUploadingAttachment(false);
        return setValidationMessage(apiErrorMessage(error, 'Unable to upload the payment attachment.'));
      }
      setUploadingAttachment(false);
    }
    onSubmit({
      amountReceived: gross,
      paymentDate,
      paymentMode: gross > 0 ? paymentMode : null,
      depositAccount: gross > 0 ? depositAccount : null,
      bankAccountId: gross > 0 && bankAccountId ? Number(bankAccountId) : null,
      referenceNumber,
      tdsDeducted,
      tdsPercentage: tdsDeducted ? Number(tdsPercentage || 0) : 0,
      tdsAmount: tdsDeducted ? tds : 0,
      tdsBaseType,
      tdsSectionCode,
      tdsCertificateNumber,
      tdsCertificateDate: tdsCertificateDate || null,
      tdsRemarks,
      bankCharges: charges,
      creditApplied: credit,
      notes,
      attachmentUrl: uploadedAttachmentUrl,
      sendThankYouEmail,
      idempotencyKey,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#06134a]/60 px-4 py-6">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-black">{payment ? 'Edit Payment' : 'Record Payment'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Settle {invoice?.recordNumber} without changing the invoice itself.</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-50"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <PaymentSummaryValue label="Customer" value={invoice?.partyName || '-'} />
          <PaymentSummaryValue label="Invoice Number" value={invoice?.recordNumber || '-'} />
          <PaymentSummaryValue label="Invoice Date" value={formatDate(invoice?.recordDate)} />
          <PaymentSummaryValue label="Due Date" value={formatDate(invoice?.dueDate)} />
          <PaymentSummaryValue label="Invoice Total" value={formatCurrency(Number(lifecycle?.invoiceTotal || invoice?.amount || 0), paymentCurrency)} />
          <PaymentSummaryValue label="Amount Already Paid" value={formatCurrency(Number(lifecycle?.cashAmountPaid || 0), paymentCurrency)} />
          <PaymentSummaryValue label="Credits Applied" value={formatCurrency(Number(lifecycle?.creditApplied || 0) + Number(lifecycle?.creditNoteApplied || 0), paymentCurrency)} />
          <PaymentSummaryValue label="Outstanding Amount" value={formatCurrency(Number(balanceDue || 0), paymentCurrency)} strong />
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <DialogInput label="Amount Received" type="number" value={amountReceived} onChange={setAmountReceived} />
              <DialogInput label="Payment Date" type="date" value={paymentDate} onChange={setPaymentDate} />
              <DialogSelect label="Payment Mode" value={paymentMode} onChange={setPaymentMode} options={paymentModes} />
              <BankAccountSelect label="Deposit To / Bank Account" value={bankAccountId} onChange={setBankAccountId} currency={paymentCurrency} required={gross > 0 && !['Cash','Other'].includes(paymentMode)} includeInactive={Boolean(payment)} />
              <DialogInput label="Reference Number" value={referenceNumber} onChange={setReferenceNumber} placeholder="Transaction, cheque, or gateway reference" />
              <DialogInput label="Bank Charges" type="number" value={bankCharges} onChange={setBankCharges} />
              <DialogInput label="Credit Applied" type="number" value={creditApplied} onChange={setCreditApplied} />
              <label className="block">
                <span className="text-sm font-bold">Attachment</span>
                <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)} className="mt-2 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-black" />
                <span className="mt-1 block text-xs font-semibold text-slate-500">PDF, PNG, or JPG up to 10 MB{attachmentUrl && !attachmentFile ? ' • Existing attachment retained' : ''}</span>
              </label>
            </div>

            <fieldset className="rounded-lg border border-slate-200 p-4">
              <legend className="px-2 text-sm font-black">TDS Deducted</legend>
              <div className="flex flex-wrap gap-6">
                <label className="inline-flex items-center gap-2 text-sm font-bold"><input type="radio" name="tds-choice" checked={!tdsDeducted} onChange={clearTds} /> No TDS</label>
                <label className="inline-flex items-center gap-2 text-sm font-bold"><input type="radio" name="tds-choice" checked={tdsDeducted} onChange={() => setTdsDeducted(true)} /> TDS Deducted</label>
              </div>
              {tdsDeducted && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <PaymentSummaryValue label={`Configured Base (${tdsBaseType === 'TAXABLE_VALUE' ? 'Taxable Value' : 'Invoice Total'})`} value={formatCurrency(configuredBase, paymentCurrency)} />
                  <DialogInput label="TDS Percentage" type="number" value={tdsPercentage} onChange={updateTdsRate} />
                  <DialogInput label="TDS Amount" type="number" value={tdsAmount} onChange={updateTdsAmount} />
                  <DialogInput label="TDS Section / Code" value={tdsSectionCode} onChange={setTdsSectionCode} placeholder="Optional" />
                  <DialogInput label="Certificate Number" value={tdsCertificateNumber} onChange={setTdsCertificateNumber} placeholder="Optional" />
                  <DialogInput label="Certificate Date" type="date" value={tdsCertificateDate} onChange={setTdsCertificateDate} />
                  <div className="sm:col-span-2"><DialogTextarea label="TDS Remarks" value={tdsRemarks} onChange={setTdsRemarks} /></div>
                </div>
              )}
            </fieldset>

            <DialogTextarea label="Notes" value={notes} onChange={setNotes} />
            <label className="inline-flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={sendThankYouEmail} onChange={(event) => setSendThankYouEmail(event.target.checked)} />
              Send payment thank-you email
            </label>
          </div>

          <aside className="h-fit rounded-lg border border-slate-200 bg-slate-50 p-5">
            <h3 className="flex items-center gap-2 text-base font-black"><CircleDollarSign className="h-5 w-5 text-red-600" /> Payment Summary</h3>
            <div className="mt-5 space-y-3 text-sm font-semibold">
              <SummaryLine label="Eligible Outstanding" value={formatCurrency(eligibleOutstanding, paymentCurrency)} />
              <SummaryLine label="Gross Amount Received" value={formatCurrency(gross, paymentCurrency)} />
              <SummaryLine label="TDS Settled" value={formatCurrency(tds, paymentCurrency)} />
              <SummaryLine label="Credits Applied" value={formatCurrency(credit, paymentCurrency)} />
              <SummaryLine label="Bank Charges" value={formatCurrency(charges, paymentCurrency)} />
              <SummaryLine label="Net Bank Credit" value={formatCurrency(netBankCredit, paymentCurrency)} />
              <div className="border-t border-slate-200 pt-3"><SummaryLine label="Total Settled" value={formatCurrency(totalSettled, paymentCurrency)} strong /></div>
              <SummaryLine label="Balance After Payment" value={formatCurrency(remaining, paymentCurrency)} strong tone={remaining <= 0 ? 'green' : 'red'} />
            </div>
            <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-700">Invoice settlement uses gross receipt + TDS + credits. Bank charges reduce the bank credit, not the customer settlement.</p>
          </aside>
        </div>

        {validationMessage && <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{validationMessage}</div>}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
          <button onClick={onClose} disabled={loading || uploadingAttachment} className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black hover:bg-slate-50 disabled:opacity-60">Cancel</button>
          <button disabled={loading || uploadingAttachment} onClick={submit} className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60">
            {uploadingAttachment ? 'Uploading...' : loading ? 'Saving...' : payment ? 'Update Payment' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentSummaryValue({ label, value, strong = false }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm ${strong ? 'font-black text-red-600' : 'font-bold text-[#06134a]'}`}>{value}</p>
    </div>
  );
}

function SummaryLine({ label, value, strong = false, tone = '' }) {
  const color = tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-600' : 'text-[#06134a]';
  return <p className={`flex items-center justify-between gap-4 ${strong ? 'text-base font-black' : ''}`}><span>{label}</span><span className={color}>{value}</span></p>;
}

function ReminderDialog({ open, invoice, loading, onClose, onSubmit }) {
  const [channel, setChannel] = useState('EMAIL');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduleTime, setScheduleTime] = useState('10:00');

  useEffect(() => {
    if (!open) return;
    setChannel('EMAIL');
    setRecipient(invoice?.partyEmail || '');
    const invoiceCurrency = normalizeCurrencyCode(parseJsonObject(invoice?.notes).Currency);
    setMessage(`Reminder: ${invoice?.recordNumber || 'your invoice'} has an outstanding balance of ${formatCurrency(Number(invoice?.balanceAmount || 0), invoiceCurrency)}.`);
    setScheduled(false);
  }, [invoice, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 px-4 py-6">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div><h2 className="text-lg font-black">Send Reminder</h2><p className="mt-1 text-sm font-semibold text-slate-500">{invoice?.recordNumber}</p></div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <DialogSelect label="Channel" value={channel} onChange={(value) => { setChannel(value); setRecipient(value === 'EMAIL' ? invoice?.partyEmail || '' : invoice?.partyPhone || ''); }} options={['EMAIL', 'SMS']} />
          <DialogInput label={channel === 'EMAIL' ? 'Email Address' : 'Mobile Number'} value={recipient} onChange={setRecipient} />
          <DialogTextarea label="Reminder Message" value={message} onChange={setMessage} />
          <label className="inline-flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={scheduled} onChange={(event) => setScheduled(event.target.checked)} /> Schedule reminder</label>
          {scheduled && <div className="grid gap-4 sm:grid-cols-2"><DialogInput label="Date" type="date" value={scheduleDate} onChange={setScheduleDate} /><DialogInput label="Time" type="time" value={scheduleTime} onChange={setScheduleTime} /></div>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-4">
          <button disabled={loading} onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-5 text-sm font-black disabled:opacity-50">Cancel</button>
          <button disabled={loading || !recipient.trim()} onClick={() => onSubmit({ channel, recipient, message, scheduledAt: scheduled ? `${scheduleDate}T${scheduleTime}:00` : null, deliverySuccessful: !scheduled })} className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white disabled:opacity-50">{loading ? 'Saving...' : scheduled ? 'Schedule Reminder' : 'Send Reminder'}</button>
        </div>
      </div>
    </div>
  );
}

function ReasonDialog({ open, title, message, reason, onReasonChange, confirmLabel, loading, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 px-4 py-6">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-black">{title}</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{message}</p></div>
        <div className="p-5"><DialogTextarea label="Reason (Optional)" value={reason} onChange={onReasonChange} /></div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-4">
          <button disabled={loading} onClick={onCancel} className="h-10 rounded-lg border border-slate-200 px-5 text-sm font-black disabled:opacity-50">Cancel</button>
          <button disabled={loading} onClick={onConfirm} className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white disabled:opacity-50">{loading ? 'Working...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function CancelIrnDialog({ open, loading, onCancel, onConfirm }) {
  const [reasonCode, setReasonCode] = useState('2');
  const [remarks, setRemarks] = useState('');
  const reasons = [
    { value: '1', label: 'Duplicate' },
    { value: '2', label: 'Data entry mistake' },
    { value: '3', label: 'Order cancelled' },
    { value: '4', label: 'Other' },
  ];
  useEffect(() => {
    if (!open) return;
    setReasonCode('2');
    setRemarks('');
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 px-4 py-6">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-black">Cancel GST e-invoice IRN</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">IRP allows cancellation only within 24 hours. An active E-Way Bill can prevent cancellation.</p>
        </div>
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="text-sm font-bold">Cancellation Reason</span>
            <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100">
              {reasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.value} — {reason.label}</option>)}
            </select>
          </label>
          <DialogTextarea label="Cancellation Remarks" value={remarks} onChange={(value) => setRemarks(value.slice(0, 100))} />
          <p className="text-right text-xs font-bold text-slate-500">{remarks.length} / 100</p>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-4">
          <button disabled={loading} onClick={onCancel} className="h-10 rounded-lg border border-slate-200 px-5 text-sm font-black disabled:opacity-50">Close</button>
          <button disabled={loading || !reasonCode} onClick={() => onConfirm({ reasonCode, remarks: remarks.trim() })} className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white disabled:opacity-50">{loading ? 'Cancelling...' : 'Cancel IRN'}</button>
        </div>
      </div>
    </div>
  );
}

function InvoiceLifecyclePanels({ lifecycle, onEditPayment, onReversePayment, onDeletePayment, onDownloadReceipt, onViewReceipt, onEmailReceipt, onWhatsAppReceipt }) {
  const activePayments = (lifecycle.payments || []).filter((payment) => !payment.reversed);
  const lifecycleCurrency = normalizeCurrencyCode(lifecycle.currency);
  const [paymentMenuId, setPaymentMenuId] = useState(null);
  return (
    <div className="mx-auto mt-6 max-w-[930px] space-y-5 text-[#06134a]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4"><h2 className="text-base font-black">Settlement Summary</h2><StatusBadge value={lifecycle.status} /></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <PaymentSummaryValue label="Invoice Total" value={formatCurrency(Number(lifecycle.invoiceTotal || 0), lifecycleCurrency)} />
          <PaymentSummaryValue label="Cash / Bank Paid" value={formatCurrency(Number(lifecycle.cashAmountPaid || 0), lifecycleCurrency)} />
          <PaymentSummaryValue label="TDS Deducted" value={formatCurrency(Number(lifecycle.tdsSettled || 0), lifecycleCurrency)} />
          <PaymentSummaryValue label="Credits Applied" value={formatCurrency(Number(lifecycle.creditApplied || 0) + Number(lifecycle.creditNoteApplied || 0), lifecycleCurrency)} />
          <PaymentSummaryValue label="Balance Due" value={formatCurrency(Number(lifecycle.balanceDue || 0), lifecycleCurrency)} strong />
        </div>
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
          <p><span className="font-bold text-slate-500">Sent:</span> {formatDateTime(lifecycle.sentAt)}</p>
          <p><span className="font-bold text-slate-500">Viewed:</span> {formatDateTime(lifecycle.lastViewedAt)}</p>
          <p><span className="font-bold text-slate-500">Paid:</span> {formatDateTime(lifecycle.paidAt)}</p>
          <p><span className="font-bold text-slate-500">Overdue:</span> {lifecycle.overdueDays || 0} days</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black">Payments Received</h2>
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-blue-50 px-1.5 text-xs font-black text-blue-600">{activePayments.length}</span>
          </div>
          <span className="text-xs font-bold text-slate-500">{activePayments.length} active payment{activePayments.length === 1 ? '' : 's'}</span>
        </div>
        {(lifecycle.payments || []).length === 0 ? <p className="p-5 text-sm font-semibold text-slate-500">No payments have been recorded.</p> : (
          <div>
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-[16%] px-5 py-3 font-black uppercase">Date</th>
                  <th className="w-[18%] px-4 py-3 font-black uppercase">Payment #</th>
                  <th className="w-[18%] px-4 py-3 font-black uppercase">Reference #</th>
                  <th className="w-[14%] px-4 py-3 font-black uppercase">Status</th>
                  <th className="w-[17%] px-4 py-3 font-black uppercase">Payment Mode</th>
                  <th className="w-[13%] px-4 py-3 text-right font-black uppercase">Amount</th>
                  <th className="w-[4%] px-3 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(lifecycle.payments || []).map((payment) => (
                  <tr key={payment.id} className={payment.reversed ? 'bg-slate-50 text-slate-400' : ''}>
                    <td className="whitespace-nowrap px-5 py-4 font-bold">{formatDate(payment.paymentDate)}</td>
                    <td className="truncate px-4 py-4">
                      <button type="button" onClick={() => onViewReceipt(payment)} className="max-w-full truncate font-black text-blue-600 hover:underline">{payment.paymentNumber}</button>
                    </td>
                    <td className="truncate px-4 py-4" title={payment.referenceNumber || ''}>{payment.referenceNumber || '-'}</td>
                    <td className="px-4 py-4"><StatusBadge value={payment.status || (payment.reversed ? 'Reversed' : 'Paid')} /></td>
                    <td className="truncate px-4 py-4" title={payment.paymentMode || ''}>{payment.paymentMode || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-black">{formatCurrency(Number(payment.grossAmountReceived || 0), payment.currencyCode || lifecycleCurrency)}</td>
                    <td className="relative px-3 py-4 text-right">
                      <button type="button" title="Payment actions" onClick={() => setPaymentMenuId((current) => current === payment.id ? null : payment.id)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button>
                      {paymentMenuId === payment.id && (
                        <div className="absolute right-3 top-12 z-30 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left text-sm font-bold text-[#06134a] shadow-xl">
                          <button type="button" onClick={() => { setPaymentMenuId(null); onViewReceipt(payment); }} className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-blue-50"><Eye className="h-4 w-4" /> View Payment</button>
                          <button type="button" onClick={() => { setPaymentMenuId(null); onDownloadReceipt(payment); }} className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-blue-50"><ArrowDownToLine className="h-4 w-4" /> Download Receipt</button>
                          <button type="button" disabled={payment.reversed || payment.reconciled} onClick={() => { setPaymentMenuId(null); onEditPayment(payment); }} className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-blue-50 disabled:opacity-40"><Edit3 className="h-4 w-4" /> Edit</button>
                          <button type="button" disabled={payment.reversed || payment.reconciled} onClick={() => { setPaymentMenuId(null); onReversePayment(payment); }} className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-blue-50 disabled:opacity-40"><RotateCcw className="h-4 w-4" /> Reverse</button>
                          <button type="button" disabled={payment.reconciled} onClick={() => { setPaymentMenuId(null); onDeletePayment(payment); }} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 className="h-4 w-4" /> Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <HistoryPanel title="Reminder History" empty="No reminders sent." rows={(lifecycle.reminders || []).map((reminder) => ({ key: reminder.id, title: `${reminder.channel} • ${reminder.deliveryStatus}`, detail: reminder.recipient || '-', date: reminder.sentAt || reminder.scheduledAt || reminder.createdAt }))} />
        <HistoryPanel title="Communication History" empty="No invoice communications." rows={(lifecycle.communications || []).map((communication) => ({ key: communication.id, title: `${communication.communicationType} • ${communication.deliveryStatus}`, detail: communication.recipient || '-', date: communication.sentAt || communication.scheduledAt || communication.createdAt }))} />
      </div>
      <LinkedCreditNotesPanel creditNotes={lifecycle.creditNotes || []} currency={lifecycleCurrency} invoiceTotal={Number(lifecycle.invoiceTotal || 0)} />
    </div>
  );
}

function LinkedCreditNotesPanel({ creditNotes, currency, invoiceTotal }) {
  const creditedTotal = creditNotes.reduce((sum, credit) => sum + Number(credit.amountApplied || 0), 0);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-black">Linked Credit Notes</h2>
        <span className="text-xs font-bold text-slate-500">Remaining invoice value: {formatCurrency(Math.max(0, invoiceTotal - creditedTotal), currency)}</span>
      </div>
      {!creditNotes.length ? <p className="p-5 text-sm font-semibold text-slate-500">No credit notes linked.</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
              {['Credit Note', 'Date', 'Amount', 'IRN Status', 'Credited Amount', 'Credit Remaining'].map((heading) => <th key={heading} className="px-4 py-3 font-black">{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{creditNotes.map((credit) => (
              <tr key={credit.id}>
                <td className="px-4 py-4"><Link to={`/sales/credit-notes/${credit.creditNoteId}`} className="font-black text-blue-600 hover:underline">{credit.creditNoteNumber}</Link></td>
                <td className="whitespace-nowrap px-4 py-4">{formatDate(credit.creditNoteDate)}</td>
                <td className="whitespace-nowrap px-4 py-4 font-bold">{formatCurrency(Number(credit.creditNoteAmount || 0), currency)}</td>
                <td className="px-4 py-4"><StatusBadge value={String(credit.eInvoiceStatus || 'NOT_GENERATED').replaceAll('_', ' ')} /></td>
                <td className="whitespace-nowrap px-4 py-4 font-bold">{formatCurrency(Number(credit.amountApplied || 0), currency)}</td>
                <td className="whitespace-nowrap px-4 py-4 font-bold">{formatCurrency(Number(credit.remainingBalance || 0), currency)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HistoryPanel({ title, empty, rows }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black">{title}</h2>
      {rows.length === 0 ? <p className="mt-4 text-sm font-semibold text-slate-500">{empty}</p> : <div className="mt-3 divide-y divide-slate-100">{rows.map((row) => <div key={row.key} className="flex items-start justify-between gap-4 py-3 text-sm"><div><p className="font-black">{row.title}</p><p className="mt-1 font-semibold text-slate-500">{row.detail}</p></div><span className="shrink-0 text-xs font-semibold text-slate-500">{formatDateTime(row.date)}</span></div>)}</div>}
    </section>
  );
}

function fallbackInvoiceActions(status) {
  if (status === 'Draft') return { edit: true, send: true, recordPayment: false, reminder: false, createCreditNote: false, voidInvoice: false, deleteInvoice: true, cloneInvoice: true };
  if (status === 'Paid') return { edit: false, send: false, recordPayment: false, reminder: false, createCreditNote: true, voidInvoice: false, deleteInvoice: false, cloneInvoice: true };
  if (status === 'Void') return { edit: false, send: false, recordPayment: false, reminder: false, createCreditNote: false, voidInvoice: false, deleteInvoice: false, cloneInvoice: false };
  return { edit: true, send: true, recordPayment: true, reminder: true, createCreditNote: true, voidInvoice: status !== 'Partially Paid', deleteInvoice: false, cloneInvoice: true };
}

function apiErrorMessage(error, fallback) {
  const response = error?.response?.data;
  const validationDetails = Object.entries(response?.validationErrors || {})
    .map(([field, message]) => `${field}: ${message}`)
    .join('; ');
  if (validationDetails) return `${response?.message || 'Validation failed'}: ${validationDetails}`;
  if (error?.code === 'ERR_NETWORK') return 'Backend API is not reachable. Restart IntelliaTech Books and try again.';
  return response?.message || error?.message || fallback;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function DialogInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100" />
    </label>
  );
}

function DialogSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DialogTextarea({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100" />
    </label>
  );
}

function convertedSalesDocumentPayload(source, targetType, companyProfile) {
  requireCompanyState(companyProfile);
  const notes = parseJsonObject(source?.notes);
  const calculated = recalculateStoredSalesDocument(source, notes, companyProfile);
  const sourceItems = calculated.items;
  const sourceTotals = targetType === 'invoices'
    ? invoiceTotalsWithoutRoundOff(calculated.totals)
    : calculated.totals;
  const targetName = targetType === 'invoices' ? 'Invoice' : 'Sales Order';
  const targetNumberLabel = targetType === 'invoices' ? 'Invoice#' : 'Order #';
  const targetDateLabel = targetType === 'invoices' ? 'Invoice Date' : 'Order Date';
  const targetItemsField = targetType === 'invoices' ? 'Invoice Items' : 'Sales Order Items';
  const targetTotalsField = targetType === 'invoices' ? 'Invoice Totals' : 'Sales Order Totals';
  const today = new Date().toISOString().slice(0, 10);
  const recordNumber = targetType === 'invoices' ? 'AUTO-INVOICE' : generatedSalesValue('order');
  const targetNotes = {
    ...notes,
    convertedFrom: source?.recordNumber || '',
    convertedFromId: source?.id || '',
    convertedFromType: source?.type === 'orders' ? 'Sales Order' : 'Proforma Invoice',
    [targetNumberLabel]: recordNumber,
    [targetDateLabel]: today,
    [targetItemsField]: sourceItems,
    [targetTotalsField]: sourceTotals,
    'Place Of Supply': companyProfile.state,
    'Company Country': companyProfile.country || '',
    'Company State': companyProfile.state,
    'Company GSTIN': companyProfile.gstin || '',
    items: sourceItems,
    totals: sourceTotals,
  };

  return {
    ...makeRecordPayload({ module: 'sales', type: targetType, titlePrefix: targetName }),
    recordNumber,
    partyName: source?.partyName || '',
    partyEmail: source?.partyEmail || '',
    partyPhone: source?.partyPhone || '',
    partyCity: source?.partyCity || '',
    category: targetType === 'invoices' ? notes.invoiceType || source?.category || 'Fixed Cost' : source?.category || 'General',
    status: targetType === 'invoices' ? 'Draft' : 'Confirmed',
    secondaryStatus: targetType === 'invoices' ? 'Unpaid' : 'To be Delivered',
    amount: sourceTotals.grandTotal,
    balanceAmount: sourceTotals.grandTotal,
    recordDate: today,
    dueDate: normalizeInputDate(notes['Due Date'] || notes['Valid Till'] || source?.dueDate, 15),
    referenceNumber: notes['PO Number'] || source?.referenceNumber || '',
    paymentMode: source?.paymentMode || notes['Payment Terms'] || '',
    ownerName: source?.ownerName || notes['Sales Person'] || 'Praveen Admin',
    notes: JSON.stringify(targetNotes),
  };
}

function creditNoteFromInvoicePayload(invoice, companyProfile) {
  requireCompanyState(companyProfile);
  const notes = parseJsonObject(invoice?.notes);
  const calculated = recalculateStoredSalesDocument(invoice, notes, companyProfile);
  const items = calculated.items;
  const totals = calculated.totals;
  const today = new Date().toISOString().slice(0, 10);
  const recordNumber = generatedSalesValue('credit note');
  const creditNotes = {
    ...notes,
    convertedFrom: invoice?.recordNumber || '',
    convertedFromId: invoice?.id || '',
    convertedFromType: 'Invoice',
    'Customer ID': notes['Customer ID'] || notes.customerId || '',
    'Source Invoice ID': invoice?.id || '',
    'Source Invoice Customer ID': notes['Customer ID'] || notes.customerId || '',
    'Credit Note#': recordNumber,
    'Credit Note Date': today,
    'Reference Invoice': invoice?.recordNumber || '',
    'Credit Note Items': items,
    'Credit Note Totals': totals,
    'Place Of Supply': companyProfile.state,
    'Company Country': companyProfile.country || '',
    'Company State': companyProfile.state,
    'Company GSTIN': companyProfile.gstin || '',
    items,
    totals,
  };

  return {
    ...makeRecordPayload({ module: 'sales', type: 'creditNotes', titlePrefix: 'Credit Note' }),
    recordNumber,
    partyName: invoice?.partyName || '',
    partyEmail: invoice?.partyEmail || '',
    partyPhone: invoice?.partyPhone || '',
    partyCity: invoice?.partyCity || '',
    category: 'Invoice Credit',
    status: 'Unused',
    secondaryStatus: '',
    amount: calculated.amount,
    balanceAmount: calculated.amount,
    recordDate: today,
    dueDate: normalizeInputDate(invoice?.dueDate, 90),
    referenceNumber: invoice?.recordNumber || '',
    paymentMode: invoice?.paymentMode || '',
    ownerName: invoice?.ownerName || 'Praveen Admin',
    notes: JSON.stringify(creditNotes),
  };
}

function clonedInvoicePayload(invoice, companyProfile) {
  requireCompanyState(companyProfile);
  const notes = parseJsonObject(invoice?.notes);
  const calculated = recalculateStoredSalesDocument(invoice, notes, companyProfile);
  const today = new Date().toISOString().slice(0, 10);
  const recordNumber = 'AUTO-INVOICE';
  const clonedNotes = {
    ...notes,
    'Invoice#': recordNumber,
    InvoiceNumber: recordNumber,
    'Invoice Date': today,
    'Place Of Supply': companyProfile.state,
    'Company Country': companyProfile.country || '',
    'Company State': companyProfile.state,
    'Company GSTIN': companyProfile.gstin || '',
    'Invoice Items': calculated.items,
    'Invoice Totals': calculated.totals,
    items: calculated.items,
    totals: calculated.totals,
    clonedFrom: invoice?.recordNumber || '',
    clonedFromId: invoice?.id || '',
  };

  return {
    ...makeRecordPayload({ module: 'sales', type: 'invoices', titlePrefix: 'Invoice' }),
    ...invoice,
    id: undefined,
    recordNumber,
    status: 'Draft',
    secondaryStatus: 'Unpaid',
    recordDate: today,
    dueDate: normalizeInputDate('', 15),
    amount: calculated.amount,
    balanceAmount: calculated.amount,
    referenceNumber: invoice?.referenceNumber || '',
    notes: JSON.stringify(clonedNotes),
  };
}

function recalculateStoredSalesDocument(source, notes, companyProfile) {
  const items = firstStoredArray(notes, [
    'items',
    'Invoice Items',
    'Quote Items',
    'Proforma Items',
    'Sales Order Items',
    'Credit Note Items',
  ]).map(normalizeInvoiceItem);
  const previousTotals = firstStoredObject(notes, [
    'totals',
    'Invoice Totals',
    'Quote Totals',
    'Proforma Totals',
    'Sales Order Totals',
    'Credit Note Totals',
  ]);
  const customerCountry = notes['Customer Country'] || notes.customerCountry || inferCountry(source?.partyCity || '');
  const customerState = notes['Customer Billing State'] || notes.customerBillingState || inferIndianState(source?.partyCity || '');
  const gstMode = determineGstMode({
    companyCountry: companyProfile.country,
    companyState: companyProfile.state,
    customerCountry,
    customerState,
  });
  const calculatedItems = items.map((item) => calculateInvoiceItem(item, gstMode));
  const subtotal = calculatedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const discount = Math.max(0, Number(previousTotals.discount ?? notes.Discount ?? 0));
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxRatio = subtotal > 0 ? taxableAmount / subtotal : 1;
  const cgst = gstMode === 'CGST_SGST'
    ? calculatedItems.reduce((sum, item) => sum + Number(item.cgstAmount || 0) * taxRatio, 0)
    : 0;
  const sgst = gstMode === 'CGST_SGST'
    ? calculatedItems.reduce((sum, item) => sum + Number(item.sgstAmount || 0) * taxRatio, 0)
    : 0;
  const igst = gstMode === 'IGST'
    ? calculatedItems.reduce((sum, item) => sum + Number(item.igstAmount || 0) * taxRatio, 0)
    : 0;
  const taxAmount = cgst + sgst + igst;
  const rawGrandTotal = taxableAmount + taxAmount;
  const storedDocumentType = String(source?.type || '').toLowerCase();
  const usesExactCurrencyTotal = storedDocumentType === 'invoices' || storedDocumentType === 'creditnotes';
  const grandTotal = usesExactCurrencyTotal ? roundCurrency(rawGrandTotal) : Math.round(rawGrandTotal);
  const taxRate = calculatedItems.find((item) => Number(item.taxRate) > 0)?.taxRate || 18;
  const totals = {
    ...previousTotals,
    subtotal: roundCurrency(subtotal),
    discount: roundCurrency(discount),
    taxableAmount: roundCurrency(taxableAmount),
    cgst: roundCurrency(cgst),
    sgst: roundCurrency(sgst),
    igst: roundCurrency(igst),
    taxAmount: roundCurrency(taxAmount),
    grandTotal: roundCurrency(grandTotal),
    roundOff: usesExactCurrencyTotal ? 0 : roundCurrency(grandTotal - rawGrandTotal),
    taxMode: gstMode,
    cgstRate: gstMode === 'CGST_SGST' ? Number(taxRate) / 2 : 0,
    sgstRate: gstMode === 'CGST_SGST' ? Number(taxRate) / 2 : 0,
    igstRate: gstMode === 'IGST' ? Number(taxRate) : 0,
    companyCountry: companyProfile.country || '',
    companyState: companyProfile.state,
    companyGstin: companyProfile.gstin || '',
    customerCountry,
    customerState,
  };
  return { items: calculatedItems, totals, amount: totals.grandTotal };
}

function invoiceTotalsWithoutRoundOff(totals = {}) {
  const exactGrandTotal = roundCurrency(
    Number(totals.taxableAmount || 0) + Number(totals.taxAmount || 0),
  );
  return {
    ...totals,
    grandTotal: exactGrandTotal,
    roundOff: 0,
  };
}

function firstStoredArray(notes, keys) {
  for (const key of keys) {
    const value = parseJsonArray(notes[key]);
    if (value.length) return value;
  }
  return [];
}

function firstStoredObject(notes, keys) {
  for (const key of keys) {
    const value = parseJsonObject(notes[key]);
    if (Object.keys(value).length) return value;
  }
  return {};
}

function requireCompanyState(companyProfile) {
  if (!companyProfile?.state) {
    throw new Error('Please configure the company state in Settings before creating this document.');
  }
}

function paymentFromInvoicePayload(invoice, values, amountReceived) {
  const today = values.paymentDate || new Date().toISOString().slice(0, 10);
  const notes = {
    'Invoice #': invoice?.recordNumber || '',
    'Payment Date': today,
    'Payment Mode': values.paymentMode,
    'Reference Number': values.referenceNumber,
    'Deposit To': values.depositTo,
    Notes: values.notes,
  };

  return {
    ...makeRecordPayload({ module: 'sales', type: 'payments', titlePrefix: 'Payment' }),
    recordNumber: generatedSalesValue('payment'),
    partyName: invoice?.partyName || '',
    partyEmail: invoice?.partyEmail || '',
    partyPhone: invoice?.partyPhone || '',
    partyCity: invoice?.partyCity || '',
    category: values.paymentMode || 'Payment',
    status: 'Deposited',
    secondaryStatus: '',
    amount: amountReceived,
    balanceAmount: 0,
    recordDate: today,
    dueDate: today,
    referenceNumber: values.referenceNumber || invoice?.recordNumber || '',
    paymentMode: values.paymentMode || '',
    ownerName: invoice?.ownerName || 'Praveen Admin',
    notes: JSON.stringify(notes),
  };
}

function openPaymentReceiptWindow({ lifecycle, payment, companyProfile, mode }) {
  const receiptWindow = window.open('', '_blank', 'width=850,height=900');
  if (!receiptWindow) return;
  const company = companyProfile || organizationFromSettingsRecord();
  const paymentCurrency = normalizeCurrencyCode(payment?.currencyCode || lifecycle?.currency);
  const remaining = Math.max(0, Number(payment.receiptRemainingBalance ?? lifecycle.balanceDue ?? 0));
  const rows = [
    ['Gross Amount Received', formatCurrency(Number(payment.grossAmountReceived || 0), paymentCurrency)],
    ['TDS Deducted', formatCurrency(Number(payment.tdsAmount || 0), paymentCurrency)],
    ['Credits Applied', formatCurrency(Number(payment.creditApplied || 0), paymentCurrency)],
    ['Bank Charges', formatCurrency(Number(payment.bankCharges || 0), paymentCurrency)],
    ['Net Bank Credit', formatCurrency(Number(payment.netBankCredit || 0), paymentCurrency)],
    ['Payment Mode', payment.paymentMode || '-'],
    ['Reference Number', payment.referenceNumber || '-'],
    ['Remaining Balance', formatCurrency(remaining, paymentCurrency)],
  ].map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  receiptWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(payment.receiptNumber || payment.paymentNumber)}</title><style>body{font-family:Arial,sans-serif;color:#06134a;margin:0;padding:36px;background:#f8fafc}.sheet{max-width:720px;margin:auto;background:white;border:1px solid #dbe3ef;padding:36px}h1{font-size:26px;margin:0}h2{font-size:18px;margin:6px 0 28px;color:#dc2626}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}.meta p{margin:0;font-size:13px}table{width:100%;border-collapse:collapse}th,td{padding:12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:left}td{text-align:right;font-weight:700}.actions{max-width:720px;margin:0 auto 16px;text-align:right}.actions button{background:#dc2626;color:white;border:0;padding:10px 18px;font-weight:700;border-radius:6px}@media print{body{background:white;padding:0}.actions{display:none}.sheet{border:0}}</style></head><body><div class="actions"><button onclick="window.print()">${mode === 'pdf' ? 'Save as PDF' : 'Print Receipt'}</button></div><main class="sheet"><h1>${escapeHtml(company.name || 'IntelliaTech')}</h1><h2>PAYMENT RECEIPT</h2><div class="meta"><p><b>Receipt Number</b><br>${escapeHtml(payment.receiptNumber || payment.paymentNumber)}</p><p><b>Payment Date</b><br>${escapeHtml(formatDate(payment.paymentDate))}</p><p><b>Customer</b><br>${escapeHtml(lifecycle.customerName)}</p><p><b>Invoice</b><br>${escapeHtml(lifecycle.invoiceNumber)}</p></div><table>${rows}</table>${payment.notes ? `<p style="margin-top:24px;font-size:13px"><b>Notes</b><br>${escapeHtml(payment.notes)}</p>` : ''}</main></body></html>`);
  receiptWindow.document.close();
  receiptWindow.focus();
  if (mode === 'pdf') window.setTimeout(() => receiptWindow.print(), 350);
}

function sharePaymentReceipt({ lifecycle, payment, invoice, channel }) {
  const receiptNumber = payment.receiptNumber || payment.paymentNumber || 'Payment Receipt';
  const subject = `Payment Receipt ${receiptNumber}`;
  const paymentCurrency = normalizeCurrencyCode(payment?.currencyCode || lifecycle?.currency || parseJsonObject(invoice?.notes).Currency);
  const body = [
    `Payment receipt: ${receiptNumber}`,
    `Invoice: ${lifecycle.invoiceNumber}`,
    `Customer: ${lifecycle.customerName}`,
    `Payment date: ${formatDate(payment.paymentDate)}`,
    `Amount received: ${formatCurrency(Number(payment.grossAmountReceived || 0), paymentCurrency)}`,
    `TDS deducted: ${formatCurrency(Number(payment.tdsAmount || 0), paymentCurrency)}`,
    `Credits applied: ${formatCurrency(Number(payment.creditApplied || 0), paymentCurrency)}`,
    `Remaining balance: ${formatCurrency(Number(payment.receiptRemainingBalance ?? lifecycle.balanceDue ?? 0), paymentCurrency)}`,
  ].join('\n');
  if (channel === 'email') {
    window.location.href = `mailto:${invoice?.partyEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return;
  }
  const phone = String(invoice?.partyPhone || '').replace(/[^0-9]/g, '');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`${subject}\n\n${body}`)}`, '_blank', 'noopener,noreferrer');
}

function openInvoicePrintWindow({ invoice, items, totals, subtotal, tax, total, balanceDue, creditsApplied = 0, paymentsReceived = 0, mode, companyProfile, billTo, documentType = 'invoices', eInvoice = null }) {
  const printWindow = window.open('', '_blank', 'width=1000,height=900');
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(buildInvoicePrintHtml({ invoice, items, totals, subtotal, tax, total, balanceDue, creditsApplied, paymentsReceived, mode, companyProfile, billTo, documentType, eInvoice }));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 400);
}

function buildInvoicePrintHtml({ invoice, items, totals, subtotal, tax, total, balanceDue, creditsApplied = 0, paymentsReceived = 0, mode, companyProfile, billTo, documentType = 'invoices', eInvoice = null }) {
  const config = documentViewConfig(documentType);
  const filenamePrefix = documentType === 'quotes' ? 'Proforma' : config.label.replace(/\s+/g, '_');
  const title = mode === 'pdf'
    ? `${filenamePrefix}_${String(invoice.recordNumber || '').replace(/[^A-Za-z0-9]+/g, '_')}.pdf`
    : `${filenamePrefix}_${String(invoice.recordNumber || '').replace(/[^A-Za-z0-9]+/g, '_')}_print`;
  const notes = parseJsonObject(invoice.notes);
  const documentCurrency = normalizeCurrencyCode(notes.Currency || totals.currencyCode);
  const company = companyProfile || organizationFromSettingsRecord();
  const terms = invoicePaymentTerms(invoice, notes);
  const billToDetails = billTo || invoiceBillTo(invoice);
  const placeOfSupply = notes['Place Of Supply'] || notes['Company State'] || company.state || '';
  const subject = notes.Subject || (config.subjectFallback ? `${config.subjectFallback} - ${formatDate(invoice.recordDate)}` : '');
  const billToLines = billToAddressLines(billToDetails).map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  const amountInWords = totalInWords(total, documentCurrency);
  const poNumber = notes['PO Number'] || invoice.referenceNumber || '';
  const poDate = notes['PO Date'] || '';
  const shippingAddress = notes['Shipping Address'] || '';
  const itemFallbackLabel = `${config.label} Item`;
  const termsAndConditions = notes['Terms & Conditions'] || '';
  const invoiceNotes = notes.Notes || '';
  const textBlockHtml = (label, value) => value ? `<p><b>${escapeHtml(label)}</b></p><p>${escapeHtml(value).replace(/\n/g, '<br />')}</p><br />` : '';
  const hasTax = totals.taxMode !== 'NONE' && Number(totals.taxAmount || 0) > 0;
  const taxHeader = !hasTax ? '' : totals.taxMode === 'CGST_SGST' ? '<th>CGST</th><th>SGST</th>' : '<th>IGST %</th><th>IGST Amt</th>';
  const itemRows = items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><b>${escapeHtml(item.itemName || itemFallbackLabel)}</b><br />${escapeHtml(item.description || '')}</td>
          <td>${escapeHtml(item.hsnSac || '')}</td>
          <td class="right">${escapeHtml(formatNumber(item.quantity))}</td>
          <td class="right">${escapeHtml(formatCurrency(item.rate, documentCurrency))}</td>
          ${!hasTax ? '' : totals.taxMode === 'CGST_SGST'
            ? `<td class="right">${escapeHtml(formatNumber(item.cgstAmount || 0))}</td><td class="right">${escapeHtml(formatNumber(item.sgstAmount || 0))}</td>`
            : `<td class="right">${escapeHtml(formatNumber(item.taxRate || 0))}%</td><td class="right">${escapeHtml(formatNumber(item.igstAmount || 0))}</td>`}
          <td class="right">${escapeHtml(formatCurrency(item.amount, documentCurrency))}</td>
        </tr>`).join('');
  const taxLines = !hasTax
    ? ''
    : totals.taxMode === 'CGST_SGST'
      ? `<p class="line"><span>CGST (${escapeHtml(formatDecimal(totals.cgstRate || 9))}%)</span><b>${escapeHtml(formatCurrency(totals.cgst || 0, documentCurrency))}</b></p><p class="line"><span>SGST (${escapeHtml(formatDecimal(totals.sgstRate || 9))}%)</span><b>${escapeHtml(formatCurrency(totals.sgst || 0, documentCurrency))}</b></p>`
      : `<p class="line"><span>IGST (${escapeHtml(formatDecimal(totals.igstRate || 18))}%)</span><b>${escapeHtml(formatCurrency(totals.igst || tax || 0, documentCurrency))}</b></p>`;
  const creditsAppliedLine = documentType === 'invoices' && Number(creditsApplied) > 0.005
    ? `<p class="line"><span>Credits Applied</span><span class="deduction">(-) ${escapeHtml(formatCurrency(creditsApplied, documentCurrency))}</span></p>`
    : '';
  const paymentsReceivedLine = documentType === 'invoices' && Number(paymentsReceived) > 0.005
    ? `<p class="line"><span>Payments Received</span><b>(-) ${escapeHtml(formatCurrency(paymentsReceived, documentCurrency))}</b></p>`
    : '';
  const balanceLine = documentType === 'invoices'
    ? `<p class="line total"><span>Balance Due</span><span>${escapeHtml(formatCurrency(balanceDue, documentCurrency))}</span></p>`
    : '';
  const eInvoiceBlock = (documentType === 'invoices' || documentType === 'creditNotes') && eInvoice?.status === 'GENERATED' && eInvoice.irn ? `
    <section class="einvoice-block">
      ${eInvoice.qrCodeDataUrl ? `<img src="${escapeHtml(eInvoice.qrCodeDataUrl)}" alt="Government signed e-Invoice QR code" />` : '<div class="qr-empty">Signed QR code unavailable</div>'}
      <div class="einvoice-details">
        <p><span>IRN :</span><b>${escapeHtml(eInvoice.irn)}</b></p>
        <p><span>Ack No. :</span><b>${escapeHtml(eInvoice.acknowledgementNumber || '-')}</b></p>
        <p><span>Ack Date :</span><b>${escapeHtml(formatDateTime(eInvoice.acknowledgementDate))}</b></p>
        <small>e-Invoicing detail(s) generated from the Government's e-Invoicing system.</small>
      </div>
    </section>` : '';
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: 210mm; margin: 0; padding: 0; }
    body { background: #f1f5f9; color: #000; font-family: "Times New Roman", Times, serif; font-size: 12px; line-height: 1.3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .screen-actions { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px; background: #fff; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; }
    .screen-actions button { height: 36px; border: 1px solid #d8e0ec; border-radius: 8px; background: #fff; padding: 0 14px; font-weight: 700; cursor: pointer; }
    .screen-actions .primary { border-color: #dc2626; background: #dc2626; color: #fff; }
    .page { position: relative; overflow: hidden; width: 210mm; min-height: 297mm; margin: 18px auto; background: #fff; padding: 16mm; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16); }
    .top { display: grid; grid-template-columns: 165px minmax(0, 1fr) 150px; gap: 18px; align-items: center; min-height: 92px; }
    .company-details { min-width: 0; font-size: 12px; line-height: 1.3; }
    .brand-logo { width: 165px; height: 76px; object-fit: contain; object-position: left center; align-self: center; }
    .mark { margin-top: 28px; font: 900 27px Arial, sans-serif; letter-spacing: 0.03em; color: #020617; white-space: nowrap; }
    .mark b { color: #dc2626; font-size: 36px; }
    .mark span { display: block; text-align: center; color: #dc2626; font-size: 10px; letter-spacing: 0.55em; margin-top: 2px; }
    h1 { align-self: center; font-size: 24px; line-height: 1.08; letter-spacing: 0.02em; margin: 0; text-align: right; white-space: normal; }
    h2 { margin: 0 0 5px; font-size: 17px; line-height: 1.15; }
    p { margin: 0 0 4px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #94a3b8; margin-top: 20px; }
    .cell { padding: 10px; }
    .border-r { border-right: 1px solid #94a3b8; }
    .box { border-left: 1px solid #94a3b8; border-right: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; }
    .box-title { background: #f1f5f9; border-bottom: 1px solid #94a3b8; padding: 4px 10px; font-weight: 700; }
    .pad { padding: 10px; }
    .blue { color: #075bd8; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #94a3b8; padding: 7px; vertical-align: top; }
    th { background: #f1f5f9; text-align: center; font-weight: 700; }
    th:nth-child(2) { text-align: left; }
    .right { text-align: right; }
    .summary { display: grid; grid-template-columns: 1.1fr 0.9fr; border-left: 1px solid #94a3b8; border-right: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; }
    .summary-left { min-height: 280px; border-right: 1px solid #94a3b8; padding: 12px; }
    .summary-right { min-height: 280px; display: grid; grid-template-rows: minmax(0, 1fr) 150px; }
    .summary-totals { padding: 14px; }
    .line { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 12px; }
    .deduction { color: #dc2626; font-weight: 700; }
    .total { font-size: 18px; font-weight: 900; }
    .signature { height: 150px; border-top: 1px solid #94a3b8; display: flex; align-items: flex-end; justify-content: center; padding: 0 0 4px; text-align: center; }
    .einvoice-block { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 20px; align-items: center; border: 1px solid #94a3b8; border-top: 0; padding: 16px; }
    .einvoice-block img, .qr-empty { width: 175px; height: 175px; object-fit: contain; }
    .qr-empty { display: grid; place-items: center; border: 1px dashed #cbd5e1; color: #64748b; font: 12px Arial, sans-serif; text-align: center; }
    .einvoice-details p { display: grid; grid-template-columns: 95px minmax(0, 1fr); gap: 10px; margin-bottom: 8px; }
    .einvoice-details b { overflow-wrap: anywhere; }
    .einvoice-details small { display: block; margin-top: 18px; color: #64748b; }
    @media print {
      body { background: #fff; }
      .screen-actions { display: none; }
      .page { width: 210mm; min-height: 297mm; margin: 0; padding: 12mm; box-shadow: none; }
      .top { grid-template-columns: 155px minmax(0, 1fr) 140px; gap: 16px; }
      .brand-logo { width: 155px; height: 70px; }
    }
  </style>
</head>
<body>
  <div class="screen-actions">
    <button onclick="window.close()">Close</button>
    <button class="primary" onclick="window.print()">${mode === 'pdf' ? 'Save as PDF' : `Print ${escapeHtml(config.label)}`}</button>
  </div>
  <main class="page">
    <header class="top">
      <div>
        <img class="brand-logo" src="${escapeHtml(absoluteBrandLogoUrl(company.logoUrl))}" alt="${escapeHtml(company.name || 'Company')} logo" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
        <div class="mark" style="display:none"><b>C</b> INTELLIATECH<span>SOLUTIONS</span></div>
      </div>
      <div class="company-details">
        <h2>${escapeHtml(company.name)}</h2>
        <p>${escapeHtml(company.address)}</p>
        <p>${escapeHtml(company.state)}</p>
        <p>${escapeHtml(company.country)}</p>
        <p>GSTIN ${escapeHtml(company.gstin)}</p>
        <p>${escapeHtml(company.email)}</p>
        <p>https://intelliatech.com/</p>
      </div>
      <h1>${escapeHtml(config.title)}</h1>
    </header>
    <section class="grid2">
      <div class="cell border-r">
        <p><b style="display:inline-block;width:150px">${escapeHtml(config.numberLabel)}</b>: ${escapeHtml(invoice.recordNumber)}</p>
        <p><b style="display:inline-block;width:150px">${escapeHtml(config.dateLabel)}</b>: ${escapeHtml(formatDate(invoice.recordDate))}</p>
        <p><b style="display:inline-block;width:150px">Terms</b>: ${escapeHtml(terms)}</p>
        <p><b style="display:inline-block;width:150px">${escapeHtml(config.dueDateLabel)}</b>: ${escapeHtml(formatDate(invoice.dueDate))}</p>
        ${(documentType === 'quotes' || documentType === 'orders' || poNumber) ? `<p><b style="display:inline-block;width:150px">PO Number</b>: ${escapeHtml(poNumber)}</p>` : ''}
        ${(documentType === 'quotes' || documentType === 'orders' || poDate) ? `<p><b style="display:inline-block;width:150px">PO Date</b>: ${poDate ? escapeHtml(formatDate(poDate)) : ''}</p>` : ''}
      </div>
      <div class="cell"><p><b style="display:inline-block;width:150px">Place Of Supply</b>: ${escapeHtml(placeOfSupply)}</p></div>
    </section>
    <section class="box">
      <div class="box-title">Bill To</div>
      <div class="pad">
        <p class="blue">${escapeHtml(billToDetails.name || invoice.partyName || '')}</p>
        ${billToLines}
      </div>
    </section>
    ${documentType === 'orders' && shippingAddress ? `
    <section class="box">
      <div class="box-title">Ship To</div>
      <div class="pad">${escapeHtml(shippingAddress).replace(/\n/g, '<br />')}</div>
    </section>` : ''}
    <section class="box pad">
      <p>Subject :</p>
      <p>${escapeHtml(subject)}</p>
    </section>
    <table>
      <thead><tr><th>#</th><th>Item & Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th>${taxHeader}<th>Amount</th></tr></thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
    <section class="summary">
      <div class="summary-left">
        <p>Total In Words</p>
        <p><b><i>${escapeHtml(amountInWords)}</i></b></p>
        <br />
        ${textBlockHtml('Terms & Conditions', termsAndConditions)}
        ${textBlockHtml('Notes', invoiceNotes)}
      </div>
      <div class="summary-right">
        <div class="summary-totals">
          <p class="line"><span>Sub Total</span><b>${escapeHtml(formatCurrency(subtotal, documentCurrency))}</b></p>
          <p class="line"><span>Discount</span><b>${escapeHtml(formatCurrency(totals.discount || 0, documentCurrency))}</b></p>
          ${taxLines}
          ${Math.abs(Number(totals.roundOff || 0)) < 0.005 ? '' : `<p class="line"><span>Round Off</span><b>${escapeHtml(formatCurrency(totals.roundOff || 0, documentCurrency))}</b></p>`}
          <p class="line total"><span>Total</span><span>${escapeHtml(formatCurrency(total, documentCurrency))}</span></p>
          ${creditsAppliedLine}
          ${paymentsReceivedLine}
          ${balanceLine}
        </div>
        <div class="signature">Authorized Signature</div>
      </div>
    </section>
    ${eInvoiceBlock}
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function invoicePaymentTerms(invoice, notes = parseJsonObject(invoice?.notes)) {
  return notes.Terms || notes['Payment Terms'] || invoice?.paymentMode || '';
}

function invoiceBillTo(invoice, customerRecord) {
  const invoiceNotes = parseJsonObject(invoice?.notes);
  const customerNotes = parseJsonObject(customerRecord?.notes);
  const billingAddress = invoiceNotes['Customer Billing Address']
    || customerNotes.billingAddress
    || customerNotes.addressLine1
    || customerNotes['Address Line 1']
    || '';

  return {
    name: invoice?.partyName || customerRecord?.partyName || '',
    addressLine1: billingAddress,
    addressLine2: customerNotes.addressLine2 || customerNotes['Address Line 2'] || '',
    city: customerNotes.city || invoiceNotes.City || customerRecord?.partyCity || '',
    state: invoiceNotes['Customer Billing State'] || customerNotes.state || customerNotes.placeOfSupply || invoice?.partyCity || '',
    country: invoiceNotes['Customer Country'] || customerNotes.country || '',
    pinCode: customerNotes.pinCode || customerNotes.pincode || customerNotes.zipCode || customerNotes['PIN Code'] || '',
    gstin: invoiceNotes['Customer GSTIN'] || customerNotes.gstin || customerRecord?.referenceNumber || '',
  };
}

function billToAddressLines(billTo = {}) {
  return [
    billTo.addressLine1,
    billTo.addressLine2,
    [billTo.city, billTo.state].filter(Boolean).join(', '),
    [billTo.country, billTo.pinCode].filter(Boolean).join(' - '),
    billTo.gstin ? `GSTIN: ${billTo.gstin}` : '',
  ].map((line) => String(line || '').trim()).filter(Boolean);
}

const WORD_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const WORD_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(number) {
  const value = Number(number || 0);
  if (value < 20) return WORD_ONES[value];
  return [WORD_TENS[Math.floor(value / 10)], WORD_ONES[value % 10]].filter(Boolean).join(' ');
}

function threeDigitWords(number) {
  const value = Number(number || 0);
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  return [
    hundred ? `${WORD_ONES[hundred]} Hundred` : '',
    rest ? twoDigitWords(rest) : '',
  ].filter(Boolean).join(' ');
}

function indianNumberToWords(number) {
  let value = Math.floor(Math.abs(Number(number || 0)));
  if (!value) return 'Zero';
  const parts = [];
  const crore = Math.floor(value / 10000000);
  value %= 10000000;
  const lakh = Math.floor(value / 100000);
  value %= 100000;
  const thousand = Math.floor(value / 1000);
  value %= 1000;
  if (crore) parts.push(`${threeDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitWords(thousand)} Thousand`);
  if (value) parts.push(threeDigitWords(value));
  return parts.join(' ');
}

function totalInWords(amount, currency = 'INR') {
  const code = normalizeCurrencyCode(currency);
  const units = {
    INR: ['Indian Rupee', 'Indian Rupees', 'Paisa', 'Paise'], AUD: ['Australian Dollar', 'Australian Dollars', 'Cent', 'Cents'],
    USD: ['US Dollar', 'US Dollars', 'Cent', 'Cents'], CAD: ['Canadian Dollar', 'Canadian Dollars', 'Cent', 'Cents'],
    GBP: ['British Pound', 'British Pounds', 'Penny', 'Pence'], EUR: ['Euro', 'Euros', 'Cent', 'Cents'],
    AED: ['UAE Dirham', 'UAE Dirhams', 'Fils', 'Fils'], SGD: ['Singapore Dollar', 'Singapore Dollars', 'Cent', 'Cents'],
    NZD: ['New Zealand Dollar', 'New Zealand Dollars', 'Cent', 'Cents'], JPY: ['Japanese Yen', 'Japanese Yen', '', ''],
  }[code] || [code, code, 'Minor Unit', 'Minor Units'];
  const major = Math.floor(Math.abs(Number(amount || 0)));
  const minor = Math.round((Math.abs(Number(amount || 0)) - major) * 100);
  const majorWords = `${indianNumberToWords(major)} ${major === 1 ? units[0] : units[1]}`;
  const minorWords = minor && units[2] ? ` and ${indianNumberToWords(minor)} ${minor === 1 ? units[2] : units[3]}` : '';
  return `${majorWords}${minorWords} Only`;
}

function invoiceBreakdown(invoice, documentType = 'invoices') {
  const notes = parseJsonObject(invoice?.notes);
  const storageDocumentName = documentType === 'quotes'
    ? 'Quote'
    : documentType === 'orders'
      ? 'Sales Order'
      : documentType === 'creditNotes'
        ? 'Credit Note'
        : 'Invoice';
  const displayDocumentName = documentType === 'quotes' ? 'Proforma Invoice' : storageDocumentName;
  const storedItems = parseJsonArray(notes.items || notes[`${storageDocumentName} Items`]);
  const baseAmount = Number(invoice?.amount || 0);
  const fallbackItems = [{
    id: 'fallback-item',
    itemName: 'Professional Services',
    description: `${displayDocumentName} services for ${invoice?.partyName || ''}`,
    hsnSac: '998313',
    quantity: 1,
    rate: baseAmount,
    taxRate: 18,
    amount: baseAmount,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
  }];
  const fallbackTotals = {
    subtotal: baseAmount,
    discount: 0,
    taxableAmount: baseAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    taxAmount: 0,
    grandTotal: baseAmount,
    roundOff: 0,
    taxMode: 'IGST',
  };

  return {
    items: storedItems.length ? storedItems.map(normalizeInvoiceItem) : fallbackItems,
    totals: { ...fallbackTotals, ...parseJsonObject(notes.totals || notes[`${storageDocumentName} Totals`]) },
  };
}

function EInvoiceStatusPanel({ eInvoice, cancelling, onCancel, onMessage, onDownload }) {
  if (eInvoice.status === 'GENERATED') {
    const copyIrn = async () => {
      try {
        await navigator.clipboard.writeText(eInvoice.irn || '');
        onMessage?.('IRN copied to clipboard.');
      } catch {
        onMessage?.('Unable to copy IRN. Please select and copy it manually.');
      }
    };
    return (
      <section className="mx-auto mb-4 max-w-[940px] rounded-xl border border-emerald-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileCheck2 className="h-7 w-7 text-emerald-600" />
            <h2 className="text-lg font-black text-[#06134a]">e-Invoice</h2>
            <span className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-white">Pushed</span>
          </div>
          <button disabled={cancelling} onClick={onCancel} className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 hover:bg-slate-50 disabled:opacity-50">
            {cancelling ? 'Cancelling...' : 'Mark As Cancelled'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-700">
          <span>An IRN and a QR code have been generated.</span>
          <button onClick={copyIrn} className="inline-flex items-center gap-1.5 font-black text-blue-600 hover:underline"><Copy className="h-4 w-4" />Copy IRN</button>
          {eInvoice.acknowledgementNumber && <span className="text-slate-500">Ack No: {eInvoice.acknowledgementNumber}</span>}
          {eInvoice.acknowledgementDate && <span className="text-slate-500">Ack Date: {new Date(eInvoice.acknowledgementDate).toLocaleString('en-IN')}</span>}
        </div>
        <p className="mt-3 break-all text-xs font-semibold text-slate-500">IRN: {eInvoice.irn}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {eInvoice.qrCodeDataUrl && <button onClick={() => window.open(eInvoice.qrCodeDataUrl, '_blank', 'noopener,noreferrer')} className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-black text-slate-700">View QR Code</button>}
          {onDownload && <button onClick={onDownload} className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-black text-slate-700">Download PDF</button>}
        </div>
      </section>
    );
  }
  return (
    <div className={`mx-auto mb-4 max-w-[940px] rounded-xl border px-5 py-4 text-sm ${eInvoice.status === 'FAILED' ? 'border-red-200 bg-red-50' : eInvoice.status === 'CANCELLED' ? 'border-slate-300 bg-slate-100' : 'border-blue-200 bg-blue-50'}`}>
      <p className="font-black text-[#06134a]">GST E-Invoice</p>
      <p className="mt-1 font-semibold text-slate-600">Status: {String(eInvoice.status || '').replaceAll('_', ' ')}</p>
      {eInvoice.errorMessage && <p className="mt-3 font-bold text-red-700">{eInvoice.errorMessage}</p>}
    </div>
  );
}

function InvoiceDocument({ invoice, items = [], totals = {}, subtotal, tax, total, balanceDue, creditsApplied = 0, creditsUsed = 0, creditsRemaining = 0, companyProfile, billTo, documentType = 'invoices', eInvoice = null }) {
  const config = documentViewConfig(documentType);
  const notes = parseJsonObject(invoice.notes);
  const documentCurrency = normalizeCurrencyCode(notes.Currency || totals.currencyCode);
  const company = companyProfile || organizationFromSettingsRecord();
  const terms = invoicePaymentTerms(invoice, notes);
  const billToDetails = billTo || invoiceBillTo(invoice);
  const placeOfSupply = notes['Place Of Supply'] || notes['Company State'] || company.state || '';
  const subject = notes.Subject || (config.subjectFallback ? `${config.subjectFallback} - ${formatDate(invoice.recordDate)}` : '');
  const billToLines = billToAddressLines(billToDetails);
  const amountInWords = totalInWords(total, documentCurrency);
  const poNumber = notes['PO Number'] || invoice.referenceNumber || '';
  const poDate = notes['PO Date'] || '';
  const shippingAddress = notes['Shipping Address'] || '';
  const itemFallbackLabel = `${config.label} Item`;
  const termsAndConditions = notes['Terms & Conditions'] || '';
  const invoiceNotes = notes.Notes || '';
  const sourceInvoiceNumber = notes['Reference Invoice'] || '';
  const sourceInvoiceDate = notes['Source Invoice Date'] || '';
  const hasTax = totals.taxMode !== 'NONE' && Number(totals.taxAmount || 0) > 0;
  const sameStateTax = hasTax && totals.taxMode === 'CGST_SGST';
  const taxHeadings = !hasTax ? [] : sameStateTax ? ['CGST', 'SGST'] : ['IGST %', 'IGST Amt'];
  const taxLines = !hasTax
    ? []
    : sameStateTax
      ? [[`CGST (${formatDecimal(totals.cgstRate || 9)}%)`, totals.cgst || 0], [`SGST (${formatDecimal(totals.sgstRate || 9)}%)`, totals.sgst || 0]]
      : [[`IGST (${formatDecimal(totals.igstRate || 18)}%)`, totals.igst || tax || 0]];

  return (
    <article
      className="relative mx-auto overflow-hidden bg-white font-serif text-black shadow-xl shadow-slate-200"
      style={{
        maxWidth: 940,
        minHeight: 980,
        padding: 32,
        fontSize: 15,
        lineHeight: 1.62,
      }}
    >
      {(documentType === 'invoices' || documentType === 'creditNotes') && invoice.status && <InvoiceStatusRibbon status={invoice.status} />}
      <header className="grid min-h-[92px] items-center" style={{ gridTemplateColumns: '180px minmax(0,1fr) 165px', gap: 20 }}>
        <CompanyBrandMark company={company} />
        <div className="min-w-0" style={{ fontSize: 14, lineHeight: 1.42 }}>
          <h2 className="font-bold" style={{ fontSize: 19, lineHeight: 1.16, marginBottom: 5 }}>{company.name}</h2>
          <p>{company.address}</p>
          <p>{company.state}</p>
          <p>{company.country}</p>
          <p>GSTIN {company.gstin}</p>
          <p>{company.email}</p>
          <p>https://intelliatech.com/</p>
        </div>
        <h1 className="self-center font-black tracking-wide" style={{ fontSize: 27, lineHeight: 1.08, textAlign: 'right' }}>{config.title}</h1>
      </header>

      <section className="grid grid-cols-2 border border-slate-400" style={{ marginTop: 24 }}>
        <div className="space-y-1 border-r border-slate-400 p-3">
          {documentType === 'creditNotes' ? (
            <>
              <p><b className="inline-block w-40">{config.numberLabel}</b>: {invoice.recordNumber}</p>
              <p><b className="inline-block w-40">{config.dateLabel}</b>: {formatDate(invoice.recordDate)}</p>
              <p><b className="inline-block w-40">Invoice#</b>: {sourceInvoiceNumber}</p>
              <p><b className="inline-block w-40">Invoice Date</b>: {sourceInvoiceDate ? formatDate(sourceInvoiceDate) : ''}</p>
            </>
          ) : (
            <>
              <p><b className="inline-block w-40">{config.numberLabel}</b>: {invoice.recordNumber}</p>
              <p><b className="inline-block w-40">{config.dateLabel}</b>: {formatDate(invoice.recordDate)}</p>
              {documentType === 'invoices' && <p><b className="inline-block w-40">Invoice Type</b>: {invoice.category || '-'}</p>}
              <p><b className="inline-block w-40">Terms</b>: {terms}</p>
              <p><b className="inline-block w-40">{config.dueDateLabel}</b>: {formatDate(invoice.dueDate)}</p>
              {(documentType === 'quotes' || documentType === 'orders' || poNumber) && <p><b className="inline-block w-40">PO Number</b>: {poNumber}</p>}
              {(documentType === 'quotes' || documentType === 'orders' || poDate) && <p><b className="inline-block w-40">PO Date</b>: {poDate ? formatDate(poDate) : ''}</p>}
            </>
          )}
        </div>
        <div className="p-3">
          <p><b className="inline-block w-40">Place Of Supply</b>: {placeOfSupply}</p>
        </div>
      </section>

      <section className="border-x border-b border-slate-400">
        <div className="border-b border-slate-400 bg-slate-100 px-3 py-1 font-bold">Bill To</div>
        <div className="p-3">
          <p className="font-bold text-blue-700">{billToDetails.name || invoice.partyName}</p>
          {billToLines.map((line) => <p key={line}>{line}</p>)}
        </div>
      </section>

      {documentType === 'orders' && shippingAddress && (
        <section className="border-x border-b border-slate-400">
          <div className="border-b border-slate-400 bg-slate-100 px-3 py-1 font-bold">Ship To</div>
          <div className="whitespace-pre-line p-3">{shippingAddress}</div>
        </section>
      )}

      <section className="border-x border-b border-slate-400 p-3">
        <p>Subject :</p>
        <p>{subject}</p>
      </section>

      <table className="w-full border-collapse border-x border-b border-slate-400 text-sm">
        <thead>
          <tr className="bg-slate-100">
            {['#', 'Item & Description', 'HSN/SAC', 'Qty', 'Rate', ...taxHeadings, 'Amount'].map((head) => (
              <th key={head} className="border border-slate-400 px-2 py-2 text-left">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id || `${item.itemName}-${index}`}>
              <td className="border border-slate-400 px-2 py-3">{index + 1}</td>
              <td className="border border-slate-400 px-2 py-3"><b>{item.itemName || itemFallbackLabel}</b><br />{item.description || ''}</td>
              <td className="border border-slate-400 px-2 py-3">{item.hsnSac || '-'}</td>
              <td className="border border-slate-400 px-2 py-3 text-right">{formatDecimal(item.quantity)}</td>
              <td className="border border-slate-400 px-2 py-3 text-right">{formatCurrency(item.rate, documentCurrency)}</td>
              {hasTax && (sameStateTax ? (
                <>
                  <td className="border border-slate-400 px-2 py-3 text-right">{formatNumber(item.cgstAmount || 0)}</td>
                  <td className="border border-slate-400 px-2 py-3 text-right">{formatNumber(item.sgstAmount || 0)}</td>
                </>
              ) : (
                <>
                  <td className="border border-slate-400 px-2 py-3 text-right">{formatDecimal(item.taxRate || 0)}%</td>
                  <td className="border border-slate-400 px-2 py-3 text-right">{formatNumber(item.igstAmount || 0)}</td>
                </>
              ))}
              <td className="border border-slate-400 px-2 py-3 text-right">{formatCurrency(item.amount, documentCurrency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="grid grid-cols-[1.1fr_0.9fr] border-x border-b border-slate-400">
        <div className="min-h-72 border-r border-slate-400 p-4">
          <p>Total In Words</p>
          <p className="mt-1 font-bold italic">{amountInWords}</p>
          {(termsAndConditions || invoiceNotes) && (
            <div className="mt-8 space-y-5">
              {termsAndConditions && (
                <div>
                  <p className="font-bold">Terms & Conditions</p>
                  <p className="whitespace-pre-line">{termsAndConditions}</p>
                </div>
              )}
              {invoiceNotes && (
                <div>
                  <p className="font-bold">Notes</p>
                  <p className="whitespace-pre-line">{invoiceNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid min-h-72 grid-rows-[minmax(0,1fr)_150px]">
          <div className="p-4">
            <p className="flex justify-between"><span>Sub Total</span><b>{formatCurrency(subtotal, documentCurrency)}</b></p>
            <p className="mt-3 flex justify-between"><span>Discount</span><b>{formatCurrency(totals.discount || 0, documentCurrency)}</b></p>
            {taxLines.map(([label, value]) => (
              <p key={label} className="mt-3 flex justify-between"><span>{label}</span><b>{formatCurrency(value, documentCurrency)}</b></p>
            ))}
            {Math.abs(Number(totals.roundOff || 0)) >= 0.005 && <p className="mt-3 flex justify-between"><span>Round Off</span><b>{formatCurrency(totals.roundOff || 0, documentCurrency)}</b></p>}
            <p className="mt-4 flex justify-between text-lg font-black"><span>Total</span><span>{formatCurrency(total, documentCurrency)}</span></p>
            {documentType === 'invoices' && creditsApplied > 0.005 && <p className="mt-3 flex justify-between"><span>Credits Applied</span><span className="font-bold text-red-600">(-) {formatCurrency(creditsApplied, documentCurrency)}</span></p>}
            {documentType === 'invoices' && <p className="mt-4 flex justify-between text-lg font-black"><span>Balance Due</span><span>{formatCurrency(balanceDue, documentCurrency)}</span></p>}
            {documentType === 'creditNotes' && <p className="mt-3 flex justify-between"><span>Credits Used</span><span className="font-bold text-red-600">(-) {formatCurrency(creditsUsed, documentCurrency)}</span></p>}
            {documentType === 'creditNotes' && <p className="mt-4 flex justify-between text-lg font-black"><span>Credits Remaining</span><span>{formatCurrency(creditsRemaining, documentCurrency)}</span></p>}
          </div>
          <div className="flex h-[150px] items-end justify-center border-t border-slate-400 pb-1 text-center">Authorized Signature</div>
        </div>
      </section>
      {(documentType === 'invoices' || documentType === 'creditNotes') && eInvoice?.status === 'GENERATED' && eInvoice.irn && (
        <section className="grid grid-cols-[210px_minmax(0,1fr)] items-center gap-5 border-x border-b border-slate-400 p-5">
          {eInvoice.qrCodeDataUrl ? <img src={eInvoice.qrCodeDataUrl} alt="Government signed e-Invoice QR code" className="h-48 w-48 object-contain" /> : <div className="grid h-48 w-48 place-items-center border border-dashed border-slate-300 text-center text-xs text-slate-500">Signed QR code unavailable</div>}
          <div className="min-w-0 space-y-2 text-sm">
            <p className="grid grid-cols-[110px_minmax(0,1fr)] gap-3"><span>IRN :</span><b className="break-all">{eInvoice.irn}</b></p>
            <p className="grid grid-cols-[110px_minmax(0,1fr)] gap-3"><span>Ack No. :</span><b>{eInvoice.acknowledgementNumber || '-'}</b></p>
            <p className="grid grid-cols-[110px_minmax(0,1fr)] gap-3"><span>Ack Date :</span><b>{formatDateTime(eInvoice.acknowledgementDate)}</b></p>
            <p className="pt-3 text-slate-500">e-Invoicing detail(s) generated from the Government&apos;s e-Invoicing system.</p>
          </div>
        </section>
      )}
    </article>
  );
}

function buildSalesCards(baseCards, summary) {
  if (!summary) return baseCards;
  return baseCards.map((card, index) => {
    if (index === 0) return [card[0], String(summary.totalRecords), 'From database', card[3], card[4]];
    if (index === 1) return [card[0], formatCurrency(Number(summary.totalAmount || 0)), 'Live total', card[3], card[4]];
    if (index === 2) return [card[0], formatCurrency(Number(summary.totalBalance || 0)), 'Outstanding', card[3], card[4]];
    const statusName = Object.keys(summary.statusCounts || {})[index - 3];
    if (statusName) return [statusName, String(summary.statusCounts[statusName]), formatCurrency(Number(summary.statusAmounts?.[statusName] || 0)), card[3], card[4]];
    return card;
  });
}

function MiniLineChart({ current = [], previous = [] }) {
  const currentValues = current.map((entry) => Number(entry.total || 0));
  const previousValues = previous.map((entry) => Number(entry.total || 0));
  const max = Math.max(1, ...currentValues, ...previousValues);
  const xFor = (index, length) => 18 + (index / Math.max(1, length - 1)) * 332;
  const points = (series) => series.map((value, index) => `${xFor(index, series.length)},${180 - (value / max) * 145}`).join(' ');

  return (
    <svg className="h-[240px] w-full" viewBox="0 0 370 210" preserveAspectRatio="none">
      {[40, 80, 120, 160].map((y) => <line key={y} x1="18" x2="350" y1={y} y2={y} stroke="#e8edf5" />)}
      {currentValues.length > 0 && <polygon points={`18,180 ${points(currentValues)} 350,180`} fill="#ef4444" opacity="0.12" />}
      <polyline points={points(currentValues)} fill="none" stroke="#ef4444" strokeWidth="2.4" />
      <polyline points={points(previousValues)} fill="none" stroke="#94a3b8" strokeWidth="2" />
    </svg>
  );
}

export function SalesOverviewPage() {
  const [dateRange, setDateRange] = useState(currentFinancialYearRange);
  const overviewQuery = useQuery({
    queryKey: ['sales-overview', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () => dashboardApi.salesOverview(dateRange),
  });
  const overview = overviewQuery.data;
  const topCustomers = overview?.topCustomers || [];
  const channels = overview?.salesByChannel || [];
  const aging = overview?.agingSummary || [];
  const channelColors = ['#0b84f3', '#16a34a', '#a855f7', '#f97316', '#94a3b8'];
  const agingColors = ['#16a34a', '#facc15', '#f97316', '#ef4444'];
  const conicGradient = (values, colors) => {
    const total = values.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
    if (total <= 0) return '#e2e8f0';
    let cursor = 0;
    const stops = values.map((entry, index) => {
      const next = cursor + (Number(entry.total || 0) / total) * 100;
      const segment = `${colors[index % colors.length]} ${cursor}% ${next}%`;
      cursor = next;
      return segment;
    });
    return `conic-gradient(${stops.join(', ')})`;
  };
  const overviewCards = [
    ['Total Sales', formatCurrency(Number(overview?.totalSales || 0)), `${overview?.totalCustomers || 0} customers`, UsersRound, 'blue'],
    ['Total Invoices', String(overview?.totalInvoices || 0), 'Selected period', ReceiptText, 'green'],
    ['Avg. Invoice Value', formatCurrency(Number(overview?.averageInvoiceValue || 0)), 'Selected period', WalletCards, 'orange'],
    ['Paid Invoices', String(overview?.paidInvoices || 0), formatCurrency(Number(overview?.paidAmount || 0)), ReceiptText, 'purple'],
    ['Outstanding Receivables', formatCurrency(Number(overview?.outstandingReceivables || 0)), 'Live balance', CalendarDays, 'red'],
    ['Overdue Amount', formatCurrency(Number(overview?.overdueAmount || 0)), `${overview?.overdueInvoices || 0} invoices`, HandCoins, 'orange'],
  ];

  return (
    <section className="space-y-5">
      {overviewQuery.isError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">Sales overview could not be loaded. Please verify the backend connection.</div>}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#06134a]">Sales Overview</h1>
          <p className="mt-2 text-base font-semibold text-[#06134a]">Track your sales performance and key metrics</p>
        </div>
        <OverviewDateFilter value={dateRange} onChange={setDateRange} onRefresh={() => overviewQuery.refetch()} loading={overviewQuery.isFetching} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {overviewCards.map((card) => <StatCard key={card[0]} card={card} />)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.85fr)]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#06134a]">Sales Trend</h2>
            <span className="text-xs font-bold text-slate-500">Selected period</span>
          </div>
          <div className="mt-4 flex justify-center gap-10 text-xs font-semibold text-slate-600">
            <span className="text-red-600">● This Fiscal Year</span><span>● Last Fiscal Year</span>
          </div>
          <MiniLineChart current={overview?.currentTrend} previous={overview?.previousTrend} />
          <div className="grid grid-cols-12 text-center text-xs text-slate-500">
            {(overview?.currentTrend || []).map((entry) => <span key={entry.month}>{entry.month}</span>)}
          </div>
        </article>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#06134a]">Sales by Channel</h2>
            <span className="text-xs font-bold text-slate-500">Live data</span>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <div className="grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: conicGradient(channels, channelColors) }}>
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center">
                <p className="font-black">{formatCurrency(Number(overview?.totalSales || 0))}</p>
                <p className="text-xs">Total Sales</p>
              </div>
            </div>
            <div className="min-w-0 space-y-3 text-sm font-semibold">
              {channels.map((item, index) => (
                <p key={item.label} className="flex gap-3"><span style={{ color: channelColors[index % channelColors.length] }}>●</span>{item.label} {overview?.totalSales ? ((Number(item.total || 0) / Number(overview.totalSales)) * 100).toFixed(1) : '0.0'}%</p>
              ))}
              {channels.length === 0 && <p className="text-slate-500">No sales in this period.</p>}
            </div>
          </div>
        </article>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#06134a]">Top Customers</h2>
            <Link to="/sales/customers" className="text-sm font-bold text-red-600">View All</Link>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {topCustomers.map((row) => (
              <div key={row.name} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-50 text-sm font-bold text-violet-700">{row.name?.split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{row.name}</span>
                <span className="font-black">{formatCurrency(Number(row.total || 0))}</span>
              </div>
            ))}
            {topCustomers.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No customer sales in this period.</p>}
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,0.75fr)]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[#06134a]">Recent Invoices</h2><Link to="/sales/invoices" className="text-sm font-bold text-red-600">View All</Link></div>
          <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Invoice No.', 'Customer', 'Date', 'Due Date', 'Amount', 'Status'].map((item) => <th key={item} className="py-3 pr-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{(overview?.recentInvoices || []).map((row) => <tr key={row.id}><td className="py-3 pr-3"><Link to={`/sales/invoices/${row.id}`} className="font-bold text-blue-600">{row.number}</Link></td><td className="pr-3 font-semibold">{row.partyName}</td><td className="pr-3">{formatDate(row.documentDate)}</td><td className="pr-3">{formatDate(row.dueDate)}</td><td className="pr-3 font-bold">{formatCurrency(Number(row.amount || 0))}</td><td><StatusBadge value={row.status} /></td></tr>)}</tbody></table>{(overview?.recentInvoices || []).length === 0 && <p className="py-8 text-center text-sm text-slate-500">No invoices in this period.</p>}</div>
        </article>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[#06134a]">Sales by Customer</h2><span className="text-xs font-bold text-slate-500">Selected period</span></div>
          <div className="mt-8 space-y-5">
            {topCustomers.map((row) => (
              <div key={row.name} className="grid grid-cols-[minmax(0,1fr)_minmax(32px,0.7fr)_auto] items-center gap-3 text-sm">
                <span className="truncate font-semibold">{row.name}</span>
                <span className="h-4 rounded bg-blue-600" style={{ width: `${Math.max(4, Number(row.total || 0) / Math.max(1, Number(topCustomers[0]?.total || 0)) * 100)}%` }} />
                <span className="font-bold">{formatCurrency(Number(row.total || 0))}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#06134a]">Aging Summary</h2>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <div className="grid h-32 w-32 shrink-0 place-items-center rounded-full" style={{ background: conicGradient(aging, agingColors) }}>
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center"><b>{formatCurrency(Number(overview?.outstandingReceivables || 0))}</b><span className="text-xs">Total</span></div>
            </div>
            <div className="min-w-0 space-y-3 text-sm font-bold">
              {aging.map((item, index) => <p key={item.label}><span style={{ color: agingColors[index % agingColors.length] }}>●</span> {item.label} {formatCurrency(Number(item.total || 0))}</p>)}
              {aging.length === 0 && <p className="text-slate-500">No outstanding invoices.</p>}
            </div>
          </div>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Create Invoice', 'Create and send professional invoices', FilePlus2, 'Create New', '/sales/invoices/new'],
          ['Create Proforma', 'Create proforma invoices and convert to invoice', ReceiptText, 'Create New', '/sales/quotes/new'],
          ['Register Payment', 'Record customer payments received', HandCoins, 'Add Payment', '/sales/payments-received/new'],
          ['New Customer', 'Add new customer to your list', UserPlus, 'Add Customer', '/sales/customers/new'],
          ['Sales Report', 'View detailed sales reports', BarChart3, 'View Reports', '/reports/sales'],
        ].map(([title, text, Icon, action, to]) => (
          <article key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-600"><Icon className="h-6 w-6" /></span>
              <div><h3 className="font-black">{title}</h3><p className="mt-2 text-xs text-slate-600">{text}</p><Link to={to} className="mt-4 inline-flex text-sm font-bold text-blue-600">{action} →</Link></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const formConfigs = {
  customer: {
    backTo: '/sales/customers',
    backLabel: 'Back to Customers',
    title: 'Add New Customer',
    subtitle: 'Add customer details and manage their information',
    primary: 'Save Customer',
    secondary: 'Save & New',
    layout: 'customer',
    activeType: 'customers',
  },
  quote: {
    backTo: '/sales/quotes',
    backLabel: 'Back to Proforma Invoices',
    title: 'Create Proforma Invoice',
    subtitle: 'Add proforma invoice details and send to your customer',
    primary: 'Save & Send',
    layout: 'document',
    document: 'quote',
    activeType: 'quotes',
  },
  order: {
    backTo: '/sales/orders',
    backLabel: 'Back to Sales Orders',
    title: 'Create Sales Order',
    subtitle: 'Create a new sales order for your customer',
    primary: 'Save & Send',
    layout: 'document',
    document: 'order',
    activeType: 'orders',
  },
  invoice: {
    backTo: '/sales/invoices',
    backLabel: 'Back to Invoices',
    title: 'Create New Invoice',
    subtitle: 'Add invoice details and send it to your customer',
    primary: 'Save & Send',
    layout: 'document',
    document: 'invoice',
    activeType: 'invoices',
  },
  creditNote: {
    backTo: '/sales/credit-notes',
    backLabel: 'Back to Credit Notes',
    title: 'Create Credit Note',
    subtitle: 'Issue a credit note to your customer',
    primary: 'Save & Send',
    layout: 'document',
    document: 'creditNote',
    activeType: 'creditNotes',
  },
  payment: {
    backTo: '/sales/payments-received',
    backLabel: 'Back to Payments Received',
    title: 'Record Payment Received',
    subtitle: 'Record a payment received from your customer',
    primary: 'Save & Send',
    layout: 'payment',
    activeType: 'payments',
  },
  challan: {
    backTo: '/sales/delivery-challans',
    backLabel: 'Back to Delivery Challans',
    title: 'Create Delivery Challan',
    subtitle: 'Create a new delivery challan against a sales order',
    primary: 'Save & Send',
    layout: 'challan',
    activeType: 'challans',
  },
};

const defaultCustomerForm = {
  customerName: '',
  customerCode: '',
  customerGroup: 'Corporate Customers',
  displayName: '',
  customerType: 'Business',
  email: '',
  phone: '',
  phoneCountryCode: '+91',
  mobile: '',
  mobileCountryCode: '+91',
  website: '',
  billingAddress: '',
  city: '',
  state: '',
  pinCode: '',
  country: 'India',
  shippingAddress: '',
  shippingCity: '',
  shippingState: '',
  shippingPinCode: '',
  shippingCountry: 'India',
  pan: '',
  tdsTreatment: 'Not Applicable',
  placeOfSupply: '',
  paymentTerms: 'Net 30',
  notes: '',
  registeredGst: true,
  gstTreatment: 'Registered Business - Regular',
  gstin: '',
  gstCategory: 'Regular',
  attachments: [],
  legacyAmount: 0,
  welcomeEmail: true,
  portalAccess: true,
};

function customerFormFromRecord(record) {
  const notes = parseSalesNotes(record.notes);
  const fallbackCode=COUNTRY_DEFAULT_CODE[notes.country||defaultCustomerForm.country]||'+91';
  const savedPhone=splitCustomerPhone(notes.phoneNumber||record.partyPhone,fallbackCode);
  const savedMobile=splitCustomerPhone(notes.mobile,fallbackCode);
  return {
    ...defaultCustomerForm,
    customerName: record.partyName || '',
    customerCode: record.recordNumber || defaultCustomerForm.customerCode,
    customerGroup: record.category || defaultCustomerForm.customerGroup,
    displayName: notes.displayName || record.partyName || '',
    customerType: notes.customerType || defaultCustomerForm.customerType,
    email: record.partyEmail || '',
    phone: savedPhone.number,
    phoneCountryCode: notes.phoneCountryCode||savedPhone.code,
    mobile: savedMobile.number,
    mobileCountryCode: notes.mobileCountryCode||savedMobile.code,
    website: notes.website || '',
    billingAddress: notes.billingAddress || '',
    city: record.partyCity || '',
    state: notes.state || defaultCustomerForm.state,
    pinCode: notes.pinCode || '',
    country: notes.country || defaultCustomerForm.country,
    shippingAddress: notes.shippingAddress || '',
    shippingCity: notes.shippingCity || '',
    shippingState: notes.shippingState || '',
    shippingPinCode: notes.shippingPinCode || '',
    shippingCountry: notes.shippingCountry || notes.country || defaultCustomerForm.shippingCountry,
    pan: notes.pan || '',
    tdsTreatment: notes.tdsTreatment || defaultCustomerForm.tdsTreatment,
    placeOfSupply: notes.placeOfSupply || defaultCustomerForm.placeOfSupply,
    paymentTerms: record.paymentMode || defaultCustomerForm.paymentTerms,
    notes: notes.notes || '',
    registeredGst: notes.registeredGst ?? defaultCustomerForm.registeredGst,
    gstTreatment: notes.gstTreatment || defaultCustomerForm.gstTreatment,
    gstin: notes.gstin || '',
    gstCategory: GST_CATEGORIES.includes(notes.gstCategory) ? notes.gstCategory : (GST_CATEGORY_BY_TREATMENT[notes.gstTreatment] || defaultCustomerForm.gstCategory),
    attachments: Array.isArray(notes.attachments) ? notes.attachments : [],
    legacyAmount: Number(record.amount||0),
    welcomeEmail: notes.welcomeEmail ?? defaultCustomerForm.welcomeEmail,
    portalAccess: notes.portalAccess ?? defaultCustomerForm.portalAccess,
  };
}

function customerPayloadFromForm(form, draft = false) {
  return {
    recordNumber: form.customerCode || generatedSalesValue('customer code'),
    partyName: form.customerName || form.displayName || 'New Customer',
    partyEmail: form.email,
    partyPhone: joinedCustomerPhone(form.phoneCountryCode,form.phone)||joinedCustomerPhone(form.mobileCountryCode,form.mobile),
    partyCity: form.city,
    category: form.customerGroup || 'General',
    status: draft ? 'Inactive' : 'Active',
    secondaryStatus: form.customerType,
    amount: Number(form.legacyAmount||0),
    balanceAmount: Number(form.legacyAmount||0),
    recordDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    referenceNumber: form.gstin || form.pan,
    paymentMode: form.paymentTerms,
    ownerName: 'Praveen Admin',
    notes: JSON.stringify({
      displayName: form.displayName,
      customerType: form.customerType,
      mobile: form.mobile,
      phoneNumber: form.phone,
      phoneCountryCode: form.phoneCountryCode,
      mobileCountryCode: form.mobileCountryCode,
      website: form.website,
      billingAddress: form.billingAddress,
      state: form.state,
      pinCode: form.pinCode,
      country: form.country,
      shippingAddress: form.shippingAddress,
      shippingCity: form.shippingCity,
      shippingState: form.shippingState,
      shippingPinCode: form.shippingPinCode,
      shippingCountry: form.shippingCountry,
      pan: form.pan,
      tdsTreatment: form.tdsTreatment,
      placeOfSupply: form.placeOfSupply,
      notes: form.notes,
      registeredGst: form.registeredGst,
      gstTreatment: form.gstTreatment,
      gstin: form.gstin,
      gstCategory: form.gstCategory,
      attachments: form.attachments || [],
      welcomeEmail: form.welcomeEmail,
      portalAccess: form.portalAccess,
    }),
  };
}

function parseSalesNotes(notes) {
  if (!notes) return {};
  try {
    return JSON.parse(notes);
  } catch {
    return {};
  }
}

export function SalesFormPage({ type }) {
  const config = formConfigs[type];
  const [customerForm, setCustomerForm] = useState(defaultCustomerForm);
  const customerPayloadFactory = config.layout === 'customer' ? (draft) => customerPayloadFromForm(customerForm, draft) : null;
  const updateCustomerForm = (field, value) => setCustomerForm((current) => ({ ...current, [field]: value }));

  return (
    <section className="space-y-5 pb-8 text-[#06134a]">
      <FormHeader config={config} payloadFactory={customerPayloadFactory} />
      {config.layout === 'customer' && <CustomerForm form={customerForm} onChange={updateCustomerForm} />}
      {config.layout === 'document' && <DocumentForm document={config.document} />}
      {config.layout === 'payment' && <PaymentForm />}
      {config.layout === 'challan' && <ChallanForm />}
      <BottomActions config={config} payloadFactory={customerPayloadFactory} />
    </section>
  );
}

export function SalesEditPage({ type }) {
  const config = formConfigs[type];
  const { id } = useParams();
  const [customerForm, setCustomerForm] = useState(defaultCustomerForm);
  const recordQuery = useQuery({
    queryKey: ['records', 'sales', config.activeType, id],
    queryFn: () => recordsApi.get({ module: 'sales', type: config.activeType, id }),
    enabled: Boolean(id),
  });
  const customerPayloadFactory = config.layout === 'customer' ? (draft) => customerPayloadFromForm(customerForm, draft) : null;
  const updateCustomerForm = (field, value) => setCustomerForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (config.layout === 'customer' && recordQuery.data) {
      setCustomerForm(customerFormFromRecord(recordQuery.data));
    }
  }, [config.layout, recordQuery.data]);

  if (recordQuery.isLoading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm font-bold text-[#06134a]">Loading record...</div>;
  }
  if (recordQuery.isError) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-600">Unable to load record for edit.</div>;
  }

  const content = (
    <section className="space-y-5 pb-8 text-[#06134a]">
      <FormHeader config={{ ...config, title: config.title.replace(/^Create |^Add |^Record /, 'Edit ') }} payloadFactory={customerPayloadFactory} />
      {config.layout === 'customer' && <CustomerForm form={customerForm} onChange={updateCustomerForm} isEdit />}
      {config.layout === 'document' && <DocumentForm document={config.document} />}
      {config.layout === 'payment' && <PaymentForm />}
      {config.layout === 'challan' && <ChallanForm />}
      <BottomActions config={config} payloadFactory={customerPayloadFactory} />
    </section>
  );

  if (config.layout !== 'customer') {
    return (
      <SalesFormValuesContext.Provider value={salesFormValuesFromRecord(recordQuery.data, config)}>
        {content}
      </SalesFormValuesContext.Provider>
    );
  }

  return content;
}

function salesFormValuesFromRecord(record, config) {
  if (!record) return {};
  let notes = {};
  try {
    notes = record.notes ? JSON.parse(record.notes) : {};
  } catch {
    notes = {};
  }
  const numberLabels = {
    quotes: 'Proforma#',
    orders: 'Order #',
    invoices: 'Invoice#',
    creditNotes: 'Credit Note#',
    payments: 'Payment #',
    challans: 'Challan #',
  };
  const dateLabels = {
    quotes: 'Proforma Date',
    orders: 'Order Date',
    invoices: 'Invoice Date',
    creditNotes: 'Credit Note Date',
    payments: 'Payment Date',
    challans: 'Challan Date',
  };
  return {
    ...notes,
    [numberLabels[config.activeType] || `${config.activeType}#`]: record.recordNumber || notes[numberLabels[config.activeType]],
    'Quote#': record.recordNumber || notes['Quote#'],
    [dateLabels[config.activeType] || 'Record Date']: record.recordDate || notes[dateLabels[config.activeType]],
    'Quote Date': record.recordDate || notes['Quote Date'],
    'Customer Name': record.partyName || notes['Customer Name'],
    Customer: record.partyName || notes.Customer,
    Email: record.partyEmail || notes.Email,
    Phone: record.partyPhone || notes.Phone,
    City: record.partyCity || notes.City,
    Amount: record.amount ?? notes.Amount,
    'Amount Received': record.amount ?? notes['Amount Received'],
    'Due Date': record.dueDate || notes['Due Date'],
    'Valid Till': record.dueDate || notes['Valid Till'],
    'Valid Until': record.dueDate || notes['Valid Until'],
    'Delivery Date': record.dueDate || notes['Delivery Date'],
    'Expiry Date': record.dueDate || notes['Expiry Date'],
    'Reference#': record.referenceNumber || notes['Reference#'],
    'Reference / Notes': record.referenceNumber || notes['Reference / Notes'],
    'Reference Invoice': record.referenceNumber || notes['Reference Invoice'],
    'Payment Mode': record.paymentMode || notes['Payment Mode'],
    'Payment Terms': record.paymentMode || notes['Payment Terms'],
    'Sales Person': record.ownerName || notes['Sales Person'],
    'Customer Group': record.category || notes['Customer Group'],
    'Sales Channel': record.category || notes['Sales Channel'],
    'Credit Note Type': record.category || notes['Credit Note Type'],
    'Payment Status': record.secondaryStatus || notes['Payment Status'],
    'Delivery Status': record.secondaryStatus || notes['Delivery Status'],
  };
}

function FormHeader({ config, payloadFactory }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <Link to={config.backTo} className="text-sm font-bold text-[#06134a]">← {config.backLabel}</Link>
        <h1 className="mt-4 text-3xl font-black">{config.title}</h1>
        <p className="mt-2 text-base font-semibold">{config.subtitle}</p>
      </div>
      <SaveButtons config={config} includeCancel payloadFactory={payloadFactory} />
    </div>
  );
}

function FormCard({ title, children, className = '' }) {
  return (
    <article className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
    </article>
  );
}

function Field({ label, placeholder, required = false, value, select = false, prefix, options: providedOptions, onChange, name, disabled = false }) {
  const savedValues = useContext(SalesFormValuesContext);
  const fieldKey = label || placeholder || name || 'field';
  const shouldLoadCustomers = select && isCustomerPartyField(label, placeholder);
  const customersQuery = useQuery({
    queryKey: ['records', 'sales', 'customers', 'active-options'],
    queryFn: () => recordsApi.list({ module: 'sales', type: 'customers', page: 0, size: 200, status: 'Active', sort: 'partyName,asc' }),
    enabled: shouldLoadCustomers,
    staleTime: 60_000,
  });
  const activeCustomers = customersQuery.data?.content?.map((customer) => customer.partyName).filter(Boolean) || [];
  const options = select ? providedOptions || salesMasterOptions(label, placeholder, activeCustomers) : [];
  const savedValue = savedValues[fieldKey] ?? savedValues[label] ?? savedValues[placeholder] ?? savedValues[name];
  const generatedValue = savedValue || value || (String(placeholder || '').toLowerCase().includes('auto') ? generatedSalesValue(label) : '');
  const inputType = String(label || '').toLowerCase().includes('date') ? 'date' : 'text';
  const displayValue = inputType === 'date' && generatedValue ? normalizeInputDate(generatedValue) : generatedValue;

  return (
    <label className="block">
      <span className="text-sm font-bold">{label}{required && <span className="text-red-600"> *</span>}</span>
      <span className="mt-2 flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        {prefix && <span className="grid h-full min-w-12 place-items-center border-r border-slate-200 text-sm font-bold">{prefix}</span>}
        {select ? (
          <select
            data-sales-field={fieldKey}
            {...(onChange ? { value: displayValue } : { defaultValue: displayValue })}
            onChange={(event) => onChange?.(event.target.value)}
            disabled={disabled}
            className="h-full min-w-0 flex-1 appearance-none px-3 text-sm font-semibold outline-none"
          >
            <option value="">{customersQuery.isLoading ? 'Loading active customers...' : placeholder || 'Select'}</option>
            {options.map((option) => {
              const optionValue = typeof option === 'object' ? option.value : option;
              const optionLabel = typeof option === 'object' ? option.label : option;
              return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
            })}
          </select>
        ) : (
          <input
            name={name}
            data-sales-field={fieldKey}
            type={inputType}
            className="h-full min-w-0 flex-1 px-3 text-sm font-semibold outline-none placeholder:text-slate-400"
            {...(onChange ? { value: displayValue } : { defaultValue: displayValue })}
            onChange={(event) => onChange?.(event.target.value)}
            disabled={disabled}
            placeholder={placeholder}
          />
        )}
        {select && <ChevronDown className="mr-3 h-4 w-4 text-slate-500" />}
        {label.toLowerCase().includes('date') && <CalendarDays className="mr-3 h-4 w-4 text-slate-500" />}
      </span>
    </label>
  );
}

const INVOICE_PAYMENT_TERMS = ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45'];

function paymentTermDays(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'due on receipt') return 0;
  const match = normalized.match(/(?:net\s*)?(\d+)/);
  return match ? Number(match[1]) : null;
}

function datePlusDays(value, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) || !Number.isFinite(days)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

function InvoiceDateField({ fallback }) {
  const savedValues = useContext(SalesFormValuesContext);
  const savedDate = savedValues['Invoice Date'];
  const [value, setValue] = useState(normalizeInputDate(savedDate || fallback));

  useEffect(() => {
    if (savedDate) setValue(normalizeInputDate(savedDate));
  }, [savedDate]);

  const change = (nextValue) => {
    setValue(nextValue);
    document.dispatchEvent(new CustomEvent('invoice-date-change', { detail: { value: nextValue } }));
  };

  return <InvoiceScheduleDateField label="Invoice Date" value={value} onChange={change} />;
}

function InvoiceDueDateField({ fallbackInvoiceDate }) {
  const savedValues = useContext(SalesFormValuesContext);
  const savedInvoiceDate = normalizeInputDate(savedValues['Invoice Date'] || fallbackInvoiceDate);
  const savedTerms = savedValues['Payment Terms'] || 'Net 15';
  const savedDueDate = savedValues['Due Date'];
  const invoiceDateRef = useRef(savedInvoiceDate);
  const paymentTermsRef = useRef(savedTerms);
  const [value, setValue] = useState(
    savedDueDate || datePlusDays(savedInvoiceDate, paymentTermDays(savedTerms)) || savedInvoiceDate,
  );

  useEffect(() => {
    invoiceDateRef.current = savedInvoiceDate;
    paymentTermsRef.current = savedTerms;
    setValue(savedDueDate || datePlusDays(savedInvoiceDate, paymentTermDays(savedTerms)) || savedInvoiceDate);
  }, [savedDueDate, savedInvoiceDate, savedTerms]);

  useEffect(() => {
    const onInvoiceDateChange = (event) => {
      invoiceDateRef.current = event.detail?.value || invoiceDateRef.current;
      const days = paymentTermDays(paymentTermsRef.current);
      if (days !== null) setValue(datePlusDays(invoiceDateRef.current, days));
    };
    const onPaymentTermsChange = (event) => {
      paymentTermsRef.current = event.detail?.value || paymentTermsRef.current;
      const days = paymentTermDays(paymentTermsRef.current);
      if (days !== null) setValue(datePlusDays(invoiceDateRef.current, days));
    };
    document.addEventListener('invoice-date-change', onInvoiceDateChange);
    document.addEventListener('invoice-payment-terms-change', onPaymentTermsChange);
    return () => {
      document.removeEventListener('invoice-date-change', onInvoiceDateChange);
      document.removeEventListener('invoice-payment-terms-change', onPaymentTermsChange);
    };
  }, []);

  return <InvoiceScheduleDateField label="Due Date" value={value} onChange={setValue} />;
}

function InvoicePaymentTermsField() {
  const savedValues = useContext(SalesFormValuesContext);
  const savedTerms = savedValues['Payment Terms'];
  const [value, setValue] = useState(savedTerms || 'Net 15');

  useEffect(() => {
    if (savedTerms) setValue(savedTerms);
  }, [savedTerms]);

  const change = (nextValue) => {
    setValue(nextValue);
    document.dispatchEvent(new CustomEvent('invoice-payment-terms-change', { detail: { value: nextValue } }));
  };

  return (
    <label className="block">
      <span className="text-sm font-bold">Payment Terms</span>
      <span className="mt-2 flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        <select data-sales-field="Payment Terms" value={value} onChange={(event) => change(event.target.value)} className="h-full min-w-0 flex-1 appearance-none px-3 text-sm font-semibold outline-none">
          {INVOICE_PAYMENT_TERMS.map((term) => <option key={term} value={term}>{term}</option>)}
        </select>
        <ChevronDown className="mr-3 h-4 w-4 text-slate-500" />
      </span>
    </label>
  );
}

function InvoiceScheduleDateField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}<span className="text-red-600"> *</span></span>
      <span className="mt-2 flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        <input
          data-sales-field={label}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-full min-w-0 flex-1 px-3 text-sm font-semibold outline-none"
        />
        <CalendarDays className="pointer-events-none mr-3 h-4 w-4 text-slate-500" />
      </span>
    </label>
  );
}

function isCustomerPartyField(label = '', placeholder = '') {
  const text = `${label} ${placeholder}`.toLowerCase();
  return text.includes('customer') && !text.includes('group') && !text.includes('portal');
}

function salesMasterOptions(label = '', placeholder = '', activeCustomers = []) {
  const text = `${label} ${placeholder}`.toLowerCase();
  const customerNames = customers.map((row) => row[1]);
  const invoices = listConfigs.invoices.rows.map((row) => row[0]);
  const orders = listConfigs.orders.rows.map((row) => row[0]);
  if (isCustomerPartyField(label, placeholder)) return activeCustomers.length ? activeCustomers : customerNames;
  if (text.includes('customer group')) return ['Corporate Customers', 'Retail Customers', 'Individual Customers'];
  if (text.includes('state') || text.includes('place of supply')) return ['Tamil Nadu (33)', 'Madhya Pradesh (23)', 'Maharashtra (27)', 'Karnataka (29)', 'Delhi (07)', 'Other Country (96)'];
  if (text.includes('country')) return ['India', 'Australia', 'United States', 'United Kingdom'];
  if (text.includes('tds')) return ['Not Applicable', '194C - Contractor', '194J - Professional Fees', '194Q - Purchase of Goods'];
  if (text.includes('currency')) return ['INR - Indian Rupee', 'USD - US Dollar', 'AUD - Australian Dollar'];
  if (text.includes('payment terms')) return ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45'];
  if (text.includes('payment mode')) return ['Bank Transfer', 'UPI', 'Cheque', 'Credit Card', 'Cash'];
  if (text.includes('sales person') || text.includes('delivered by')) return ['Arun Kumar', 'Priya Sharma', 'Nisha Verma', 'Rohit Singh'];
  if (text.includes('invoice')) return invoices;
  if (text.includes('sales order')) return orders;
  if (text.includes('price list')) return ['Standard Price List', 'Wholesale Price List', 'Retail Price List'];
  if (text.includes('channel')) return ['Direct Sales', 'Online Store', 'Retail Outlets', 'Distributors'];
  if (text.includes('project')) return ['Default Project', 'Website Project', 'Support Project'];
  if (text.includes('template')) return ['Standard Template', 'Professional Template', 'GST Template'];
  if (text.includes('tax')) return ['GST 0%', 'GST 5%', 'GST 12%', 'GST 18%', 'GST 28%'];
  if (text.includes('item') || text.includes('service')) return ['Web Development Service', 'UI/UX Design', 'Hosting (1 Year)', 'Consulting Service'];
  if (text.includes('delivery status')) return ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];
  if (text.includes('address')) return ['Billing Address - Chennai', 'Shipping Address - Chennai', 'S61 Stirling Highway'];
  if (text.includes('reason')) return ['Sales Return', 'Invoice Correction', 'Discount Adjustment', 'Service Issue'];
  if (text.includes('credit note type')) return ['Item Credit', 'Service Credit', 'Refund Credit'];
  return ['Standard', 'Default', 'General'];
}

function generatedSalesValue(label = '') {
  const text = label.toLowerCase();
  const suffix = Date.now().toString().slice(-5);
  if (text.includes('customer code')) return `CUS-${suffix}`;
  if (text.includes('quote')) return `QUO-${suffix}`;
  if (text.includes('order')) return `SO-${suffix}`;
  if (text.includes('invoice')) return `INV-${suffix}`;
  if (text.includes('credit note')) return `CN-${suffix}`;
  if (text.includes('payment')) return `PAY-${suffix}`;
  if (text.includes('challan')) return `DC-${suffix}`;
  return `AUTO-${suffix}`;
}

function TextArea({ label, placeholder, count = '0 / 500', value = '', onChange }) {
  const savedValues = useContext(SalesFormValuesContext);
  const fieldKey = label || placeholder || 'notes';
  const savedValue = savedValues[fieldKey] ?? savedValues[label] ?? savedValues[placeholder];
  const displayValue = savedValue || value;
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <textarea
        data-sales-field={fieldKey}
        {...(onChange ? { value: displayValue } : { defaultValue: displayValue })}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-2 h-28 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm font-semibold outline-none placeholder:text-slate-400"
        placeholder={placeholder}
      />
      <span className="mt-1 block text-right text-xs font-semibold text-slate-500">{count}</span>
    </label>
  );
}

function CustomerDetailsContent({ compact = false, showBillingAddress = false, showShippingAddress = false, showContact = false, showBillingText = false }) {
  const savedValues = useContext(SalesFormValuesContext);
  const customersQuery = useQuery({
    queryKey: ['records', 'sales', 'customers', 'active-options'],
    queryFn: () => recordsApi.list({ module: 'sales', type: 'customers', page: 0, size: 200, status: 'Active', sort: 'partyName,asc' }),
    staleTime: 60_000,
  });
  const customerOptions = useMemo(() => {
    const apiCustomers = customersQuery.data?.content?.map(toCustomerOption).filter(Boolean) || [];
    return apiCustomers;
  }, [customersQuery.data]);
  const [selectedCustomerName, setSelectedCustomerName] = useState(savedValues['Customer Name'] || savedValues.Customer || '');
  const selectedName = selectedCustomerName || '';
  const selectedCustomer = customerOptions.find((customer) => customer.partyName === selectedName);
  const customerNames = customerOptions.map((customer) => customer.partyName);
  const billingAddress = selectedCustomer ? customerAddress(selectedCustomer) : '';
  const billingState = selectedCustomer?.state || selectedCustomer?.placeOfSupply || savedValues['Customer Billing State'] || '';
  const customerCountry = selectedCustomer?.country || savedValues['Customer Country'] || '';

  useEffect(() => {
    if (typeof document === 'undefined' || customersQuery.isLoading) return undefined;
    const timer = window.setTimeout(() => {
      document.dispatchEvent(new Event('invoice-tax-profile-change'));
      document.dispatchEvent(new CustomEvent('sales-customer-change', {
        detail: selectedCustomer || null,
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [billingState, customerCountry, customersQuery.isLoading, selectedCustomer]);

  return (
    <>
      <input type="hidden" data-sales-field="Customer ID" value={selectedCustomer?.id || ''} readOnly />
      <input type="hidden" data-sales-field="Customer Country" value={customerCountry} readOnly />
      <input type="hidden" data-sales-field="Customer Billing State" value={billingState} readOnly />
      <input type="hidden" data-sales-field="Customer GSTIN" value={selectedCustomer?.gstin || ''} readOnly />
      <input type="hidden" data-sales-field="Customer Billing Address" value={billingAddress} readOnly />
      <input type="hidden" data-sales-field="Email" value={selectedCustomer?.partyEmail || ''} readOnly />
      <input type="hidden" data-sales-field="Phone" value={selectedCustomer?.partyPhone || ''} readOnly />
      <input type="hidden" data-sales-field="City" value={selectedCustomer?.partyCity || ''} readOnly />
      <Field
        label="Customer Name"
        required
        select
        placeholder={customersQuery.isLoading ? 'Loading active customers...' : 'Select or search customer'}
        value={selectedName}
        options={customerNames}
        onChange={setSelectedCustomerName}
      />
      {showBillingAddress && <Field label="Billing Address" required select placeholder="Select billing address" value={billingAddress} options={[billingAddress].filter(Boolean)} onChange={() => {}} />}
      {showShippingAddress && <Field label="Shipping Address" select placeholder="Select shipping address" value={billingAddress} options={[billingAddress].filter(Boolean)} onChange={() => {}} />}
      {selectedCustomer && <CustomerPanel customer={selectedCustomer} compact={compact} />}
      {showContact && selectedCustomer && (
        <>
          <p className="text-sm font-semibold">Email<br />{selectedCustomer.partyEmail || '-'}</p>
          <p className="text-sm font-semibold">Phone<br />{selectedCustomer.partyPhone || '-'}</p>
        </>
      )}
      {showBillingText && selectedCustomer && (
        <p className="text-sm font-semibold">Billing Address<br />{billingAddress}</p>
      )}
    </>
  );
}

function CustomerPanel({ customer, compact = false }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-100 text-xl font-black text-violet-700">{customer.initials}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black">{customer.partyName}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">{customer.partyCity || '-'}</p>
          <p className="mt-2 break-words text-sm font-semibold">GSTIN: {customer.gstin}</p>
          {!compact && <p className="mt-2 text-sm font-bold">Balance Due: <span className="text-red-600">{formatCurrency(customer.balanceAmount || customer.amount || 0)}</span></p>}
        </div>
      </div>
    </div>
  );
}

function toCustomerOption(customer) {
  if (!customer?.partyName) return null;
  const notes = parseJsonObject(customer.notes);
  const inferredState = inferIndianState(`${customer.partyCity || ''} ${notes.billingAddress || ''}`);
  return {
    id: customer.id,
    initials: initialsFromName(customer.partyName),
    partyName: customer.partyName,
    partyEmail: customer.partyEmail,
    partyPhone: customer.partyPhone,
    partyCity: customer.partyCity,
    category: customer.category,
    amount: customer.amount,
    balanceAmount: customer.balanceAmount,
    recordNumber: customer.recordNumber,
    billingAddress: notes.billingAddress || '',
    state: notes.state || inferredState || customer.partyCity || '',
    country: notes.country || inferCountry(customer.partyCity),
    placeOfSupply: notes.placeOfSupply || notes.state || inferredState || customer.partyCity || '',
    gstin: notes.gstin || customer.referenceNumber || customer.notes?.match(/GSTIN:\s*([A-Z0-9]+)/i)?.[1] || gstinFromCustomer(customer.recordNumber),
  };
}

function initialsFromName(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CU';
}

function gstinFromCustomer(recordNumber = '') {
  const digits = String(recordNumber).replace(/\D/g, '').padStart(4, '0').slice(-4);
  return `33AABC${digits}R1ZP`;
}

function customerAddress(customer) {
  return customer.billingAddress || customer.partyCity || '';
}

function CustomerAttachments({ files = [], onChange }) {
  const [uploading,setUploading]=useState(false); const [error,setError]=useState('');
  const upload=async(event)=>{const selected=[...(event.target.files||[])];event.target.value='';if(!selected.length)return;setUploading(true);setError('');try{const uploaded=[];for(const file of selected){if(file.size>10*1024*1024)throw new Error(`${file.name} must be 10 MB or smaller.`);const result=await storageApi.uploadCustomerAttachment(file);uploaded.push({key:result.key,url:result.url,fileName:result.fileName||file.name,contentType:result.contentType||file.type,size:result.size||file.size,uploadedAt:new Date().toISOString()});}onChange([...files,...uploaded]);}catch(failure){setError(apiErrorMessage(failure,failure.message||'Attachment upload failed.'));}finally{setUploading(false)}};
  return <div className="space-y-3"><label className="grid min-h-28 cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center"><div><FilePlus2 className="mx-auto h-8 w-8 text-[#06134a]"/><p className="mt-2 text-sm font-bold">{uploading?'Uploading…':'Choose one or more files'}</p><p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG, DOC, DOCX, XLS, XLSX (Max 10MB each)</p></div><input className="hidden" type="file" multiple disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={upload}/></label>{error&&<p className="text-xs font-bold text-red-600">{error}</p>}{files.map((file,index)=><div key={file.key||`${file.fileName}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"><a className="min-w-0 truncate font-bold text-blue-600" href={file.url} target="_blank" rel="noreferrer"><Paperclip className="mr-2 inline h-4 w-4"/>{file.fileName}</a><button type="button" aria-label={`Remove ${file.fileName}`} onClick={()=>onChange(files.filter((_,itemIndex)=>itemIndex!==index))} className="text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}</div>;
}

function UploadBox() {
  return (
    <div className="grid h-28 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center">
      <div>
        <FilePlus2 className="mx-auto h-8 w-8 text-[#06134a]" />
        <p className="mt-2 text-sm font-bold">Drag & drop files here or <span className="text-blue-600">Browse</span></p>
        <p className="mt-1 text-xs text-slate-500">Supported formats: PDF, JPG, PNG (Max 5MB)</p>
      </div>
    </div>
  );
}

function CustomerPhoneField({label,value,code,onValueChange,onCodeChange,optional=false}){
  return <label className="block"><span className="text-sm font-bold">{label}{optional&&<span className="font-semibold text-slate-500"> (Optional)</span>}</span><span className="mt-2 flex h-11 overflow-hidden rounded-lg border border-slate-200 bg-white"><select aria-label={`${label} country code`} value={code} onChange={(event)=>onCodeChange(event.target.value)} className="w-[118px] border-r border-slate-200 bg-white px-2 text-sm font-bold outline-none">{COUNTRY_CODES.map(item=><option key={`${item.country}-${item.code}`} value={item.code}>{item.code} {item.country}</option>)}</select><input type="tel" inputMode="tel" value={value} onChange={(event)=>onValueChange(event.target.value.replace(/[^0-9 ()-]/g,''))} placeholder="Enter phone number" className="min-w-0 flex-1 px-3 text-sm font-semibold outline-none"/></span></label>;
}

function CustomerForm({ form, onChange, isEdit = false }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [numberSettingsOpen, setNumberSettingsOpen] = useState(false);
  const numberPreferenceQuery = useQuery({
    queryKey: ['document-number-preference', 'customers'],
    queryFn: () => documentNumberApi.get('customers'),
    enabled: !isEdit,
    staleTime: 60_000,
  });
  const customerCode = isEdit ? form.customerCode : generateDocumentNumber(numberPreferenceQuery.data);
  const canConfigureNumber = String(user?.role || '').toLowerCase() === 'admin';
  const changeCountry=(prefix,country)=>{const countryKey=prefix?`${prefix}Country`:'country';const stateKey=prefix?`${prefix}State`:'state';onChange(countryKey,country);if(!(COUNTRY_STATES[country]||[]).includes(form[stateKey]))onChange(stateKey,'');if(!prefix&&COUNTRY_DEFAULT_CODE[country]){onChange('phoneCountryCode',COUNTRY_DEFAULT_CODE[country]);onChange('mobileCountryCode',COUNTRY_DEFAULT_CODE[country]);}};
  const changeGstTreatment=(value)=>{onChange('gstTreatment',value);onChange('gstCategory',GST_CATEGORY_BY_TREATMENT[value]||'');onChange('registeredGst',value.startsWith('Registered Business')||value.includes('SEZ'));if(value==='Overseas')onChange('placeOfSupply','');};
  const billingStates=COUNTRY_STATES[form.country]||[]; const shippingStates=COUNTRY_STATES[form.shippingCountry]||[];
  return (
    <>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <div className="space-y-5">
        <FormCard title="Primary Information">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Customer Name" required placeholder="Enter customer name" value={form.customerName} onChange={(value) => onChange('customerName', value)} />
            <label className="block">
              <span className="text-sm font-bold">Customer Code<span className="text-red-600"> *</span></span>
              <span className="mt-2 flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                <input className="h-full min-w-0 flex-1 bg-slate-50 px-3 text-sm font-semibold outline-none" value={customerCode} readOnly placeholder={numberPreferenceQuery.isLoading ? 'Loading next code...' : 'Auto generated'} />
                {!isEdit && canConfigureNumber && <button type="button" onClick={() => setNumberSettingsOpen(true)} className="grid h-full w-12 place-items-center border-l border-slate-200 text-blue-600 hover:bg-blue-50" title="Configure Customer Code preferences"><Settings className="h-5 w-5" /></button>}
              </span>
            </label>
            <Field label="Customer Group" select placeholder="Select customer group" value={form.customerGroup} onChange={(value) => onChange('customerGroup', value)} />
            <Field label="Display Name" placeholder="Enter display name" value={form.displayName} onChange={(value) => onChange('displayName', value)} />
          </div>
          <div className="flex gap-8 text-sm font-bold">
            <label><input type="radio" name="customerType" value="Business" checked={form.customerType === 'Business'} onChange={(event) => onChange('customerType', event.target.value)} /> Business</label>
            <label><input type="radio" name="customerType" value="Individual" checked={form.customerType === 'Individual'} onChange={(event) => onChange('customerType', event.target.value)} /> Individual</label>
          </div>
        </FormCard>
        <FormCard title="Contact Information">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Email" placeholder="Enter email address" value={form.email} onChange={(value) => onChange('email', value)} />
            <CustomerPhoneField label="Phone" code={form.phoneCountryCode} value={form.phone} onCodeChange={(value)=>onChange('phoneCountryCode',value)} onValueChange={(value)=>onChange('phone',value)}/>
            <CustomerPhoneField label="Mobile" optional code={form.mobileCountryCode} value={form.mobile} onCodeChange={(value)=>onChange('mobileCountryCode',value)} onValueChange={(value)=>onChange('mobile',value)}/>
            <Field label="Website (Optional)" placeholder="Enter website" value={form.website} onChange={(value) => onChange('website', value)} />
          </div>
        </FormCard>
        <FormCard title="Billing Address">
          <TextArea label="Billing Address" placeholder="Enter billing address" value={form.billingAddress} onChange={(value) => onChange('billingAddress', value)} />
          <div className="grid gap-5 md:grid-cols-4">
            <Field label="City" required placeholder="Enter city" value={form.city} onChange={(value) => onChange('city', value)} />
            <Field label="State" required select disabled={!form.country} placeholder={form.country?'Select state':'Select country first'} options={billingStates} value={form.state} onChange={(value) => onChange('state', value)} />
            <Field label="PIN Code" required placeholder="Enter PIN code" value={form.pinCode} onChange={(value) => onChange('pinCode', value)} />
            <Field label="Country" required select options={Object.keys(COUNTRY_STATES)} value={form.country} onChange={(value) => changeCountry('',value)} />
          </div>
        </FormCard>
        <FormCard title="Shipping Address">
          <TextArea label="Shipping Address" placeholder="Enter shipping address" value={form.shippingAddress} onChange={(value)=>onChange('shippingAddress',value)}/>
          <div className="grid gap-5 md:grid-cols-4"><Field label="Shipping City" value={form.shippingCity} onChange={(value)=>onChange('shippingCity',value)}/><Field label="Shipping State" select disabled={!form.shippingCountry} options={shippingStates} value={form.shippingState} onChange={(value)=>onChange('shippingState',value)}/><Field label="Shipping PIN Code" value={form.shippingPinCode} onChange={(value)=>onChange('shippingPinCode',value)}/><Field label="Shipping Country" select options={Object.keys(COUNTRY_STATES)} value={form.shippingCountry} onChange={(value)=>changeCountry('shipping',value)}/></div>
        </FormCard>
        <FormCard title="Other Information">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="PAN / VAT Number (Optional)" placeholder="Enter PAN / VAT number" value={form.pan} onChange={(value) => onChange('pan', value)} />
            <Field label="TDS Treatment" select placeholder="Select TDS treatment" value={form.tdsTreatment} onChange={(value) => onChange('tdsTreatment', value)} />
            <Field label="Place Of Supply" select placeholder="Select place of supply" value={form.placeOfSupply} onChange={(value) => onChange('placeOfSupply', value)} />
          </div>
        </FormCard>
      </div>
      <div className="space-y-5">
        <FormCard title="Payment Details">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Payment Terms" select value={form.paymentTerms} onChange={(value) => onChange('paymentTerms', value)} />
          </div>
          <TextArea label="Notes" placeholder="Enter notes (optional)" value={form.notes} onChange={(value) => onChange('notes', value)} />
        </FormCard>
        <FormCard title="GST Details">
          <label className="flex gap-2 text-sm font-bold"><input type="checkbox" checked={form.registeredGst} onChange={(event) => changeGstTreatment(event.target.checked?'Registered Business - Regular':'Unregistered Business')} /> Registered under GST</label>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="GST Treatment" select options={GST_TREATMENTS} value={form.gstTreatment} onChange={changeGstTreatment} />
            <Field label="GSTIN" required={form.registeredGst} disabled={!form.registeredGst} placeholder="Enter GSTIN" value={form.gstin} onChange={(value) => onChange('gstin', value.toUpperCase())} />
            <Field label="Place of Supply" required={form.country==='India'&&form.gstTreatment!=='Overseas'} select disabled={form.country!=='India'||form.gstTreatment==='Overseas'} options={billingStates} placeholder="Select state" value={form.placeOfSupply} onChange={(value) => onChange('placeOfSupply', value)} />
            <Field label="GST Category" select options={GST_CATEGORIES} value={form.gstCategory} onChange={(value) => onChange('gstCategory', value)} />
          </div>
        </FormCard>
        <FormCard title="Preferences">
          <label className="block text-sm font-bold"><input type="checkbox" checked={form.welcomeEmail} onChange={(event) => onChange('welcomeEmail', event.target.checked)} /> Send welcome email to customer</label>
          <label className="block text-sm font-bold"><input type="checkbox" checked={form.portalAccess} onChange={(event) => onChange('portalAccess', event.target.checked)} /> Enable customer portal access</label>
        </FormCard>
        <FormCard title="Attachments"><CustomerAttachments files={form.attachments||[]} onChange={(value)=>onChange('attachments',value)}/></FormCard>
      </div>
    </div>
    {numberSettingsOpen && <DocumentNumberSettingsModal documentType="customers" title="Configure Customer Code Preferences" documentLabel="customer code" prefs={numberPreferenceQuery.data} forceAutoGenerate onClose={() => setNumberSettingsOpen(false)} onSaved={(nextPrefs) => { queryClient.setQueryData(['document-number-preference', 'customers'], nextPrefs); setNumberSettingsOpen(false); }} />}
    </>
  );
}

function DocumentForm({ document }) {
  const labels = {
    quote: ['Proforma Details', 'Proforma#', 'QUO-000126', 'Valid Till'],
    order: ['Order Details', 'Order #', 'Auto generated', 'Valid Until'],
    invoice: ['Invoice Details', 'Invoice#', 'Auto generated', 'Due Date'],
    creditNote: ['Credit Note Details', 'Credit Note#', 'Auto generated', 'Reference Invoice'],
  }[document];
  const customerTitle = document === 'quote' ? 'Customer Details' : 'Customer Details';
  const documentType = document === 'quote' ? 'quotes' : document === 'order' ? 'orders' : document === 'invoice' ? 'invoices' : document === 'creditNote' ? 'creditNotes' : null;
  const today = new Date().toISOString().slice(0, 10);
  const defaultDueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const queryClient = useQueryClient();
  const numberPreferenceQuery = useQuery({
    queryKey: ['document-number-preference', documentType],
    queryFn: () => documentNumberApi.get(documentType),
    enabled: Boolean(documentType),
    staleTime: 60_000,
  });
  const numberPreference = numberPreferenceQuery.data;
  const organizationQuery = useQuery({
    queryKey: ['records', 'settings', 'organization', 'tax-profile'],
    queryFn: () => recordsApi.list({ module: 'settings', type: 'organization', page: 0, size: 1, sort: 'recordDate,desc' }),
    staleTime: 60_000,
  });
  const companyProfile = organizationFromSettingsRecord(organizationQuery.data?.content?.[0]);

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-3">
        <FormCard title={customerTitle}>
          <CustomerDetailsContent
            compact={document === 'quote'}
            showBillingAddress
            showShippingAddress={document === 'order'}
          />
        </FormCard>
        <FormCard title={labels[0]}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
            {documentType ? (
              <DocumentNumberField
                label={labels[1]}
                prefs={numberPreference}
                loading={numberPreferenceQuery.isLoading}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            ) : (
              <Field label={labels[1]} required value={labels[2]} />
            )}
            {document === 'invoice' ? (
              <InvoiceDateField fallback={today} />
            ) : (
              <Field label={document === 'creditNote' ? 'Credit Note Date' : document === 'order' ? 'Order Date' : 'Proforma Date'} required value={today} />
            )}
            {document === 'creditNote' ? (
              <CreditNoteInvoiceField />
            ) : document === 'invoice' ? (
              <InvoiceDueDateField fallbackInvoiceDate={today} />
            ) : (
              <Field label={labels[3]} required={document !== 'quote'} value={defaultDueDate} />
            )}
            {(document === 'quote' || document === 'invoice' || document === 'order') && <Field label="Subject" required={document === 'invoice'} placeholder={`Enter ${document === 'quote' ? 'proforma invoice' : document === 'order' ? 'sales order' : document} subject`} />}
            {(document === 'quote' || document === 'invoice' || document === 'order') && <Field label="PO Number" placeholder="Enter PO number" />}
            {(document === 'quote' || document === 'invoice' || document === 'order' || document === 'creditNote') && <Field label="PO Date" placeholder="Select PO date" />}
            <Field label={document === 'creditNote' ? 'Reason' : 'Reference#'} select={document === 'creditNote'} placeholder={document === 'creditNote' ? 'Select or enter reason' : 'Enter reference (optional)'} />
            <Field label="Template" select value="Standard Template" />
          </div>
        </FormCard>
        <FormCard title="Other Details">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
            {document === 'invoice' && <InvoiceProjectFields />}
            <CurrencyField />
            <CompanyPlaceOfSupplyField companyProfile={companyProfile} loading={organizationQuery.isLoading} />
            {document === 'invoice' ? <InvoicePaymentTermsField /> : <Field label="Payment Terms" select value="Net 30" />}
            <Field label="Delivery Date" placeholder="Select delivery date" />
            <SalesPersonField />
            {document === 'creditNote' && <Field label="Credit Note Type" select placeholder="Select type" />}
          </div>
        </FormCard>
      </div>
      {['quote', 'order', 'invoice', 'creditNote'].includes(document) ? (
        <SalesDocumentCalculatorSection document={document} companyProfile={companyProfile} />
      ) : (
        <LineItems title="Line Items" populated={document === 'challan'} />
      )}
      <div className="grid gap-5 xl:grid-cols-3">
        {!['quote', 'order', 'invoice', 'creditNote'].includes(document) && <TaxesCard />}
        <FormCard title="Terms & Conditions"><TextArea label="Terms & Conditions" placeholder="Enter terms and conditions" count="0 / 1000" /><UploadBox /></FormCard>
        {!['quote', 'order', 'invoice', 'creditNote'].includes(document) && <SummaryCard note={document === 'creditNote' ? 'This is a credit note and will be saved as draft.' : 'This is an invoice and will be saved as draft.'} />}
        <FormCard title="Notes"><TextArea label="Notes" placeholder={`Add notes to be displayed in the ${document === 'creditNote' ? 'credit note' : document}`} /></FormCard>
        <FormCard title={document === 'creditNote' ? 'Refund Options (for customer)' : 'Payment Options (for customer)'}>
          {['Bank Transfer', 'UPI', 'Cheque', 'Credit Card'].map((item, index) => <label key={item} className="block text-sm font-bold"><input type="checkbox" defaultChecked={index < 2} /> {item}</label>)}
        </FormCard>
        <FormCard title="Default Bank Account"><DocumentBankAccountField /><TextArea label="Message to Customer" placeholder={`Add a message to show in the ${document} email`} count="0 / 300" /></FormCard>
      </div>
      {settingsOpen && (
        <DocumentNumberSettingsModal
          documentType={documentType}
          title={`Configure ${document === 'creditNote' ? 'Credit Note' : document === 'quote' ? 'Proforma Invoice' : document === 'order' ? 'Sales Order' : 'Invoice'} Number Preferences`}
          documentLabel={document === 'creditNote' ? 'credit note' : document === 'quote' ? 'proforma invoice' : document === 'order' ? 'sales order' : 'invoice'}
          prefs={numberPreference}
          onClose={() => setSettingsOpen(false)}
          onSaved={(nextPrefs) => {
            queryClient.setQueryData(['document-number-preference', documentType], nextPrefs);
            setSettingsOpen(false);
          }}
        />
      )}
    </>
  );
}

function CreditNoteInvoiceField() {
  const savedValues = useContext(SalesFormValuesContext);
  const { id: creditNoteId } = useParams();
  const initialInvoiceId = String(savedValues['Source Invoice ID'] || savedValues.convertedFromId || '');
  const [customerId, setCustomerId] = useState(String(savedValues['Customer ID'] || savedValues.customerId || ''));
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);
  const [initialSelectionHydrated, setInitialSelectionHydrated] = useState(false);
  const eligibleQuery = useQuery({
    queryKey: ['invoices', 'eligible-for-credit-note', customerId, creditNoteId || 'new'],
    queryFn: () => invoiceLifecycleApi.eligibleForCreditNote({ customerId, creditNoteId }),
    enabled: Boolean(customerId),
    staleTime: 30_000,
  });
  const invoices = eligibleQuery.data || [];
  const selectedInvoice = invoices.find((invoice) => String(invoice.id) === String(invoiceId));

  const publishInvoice = (invoice, preserveExistingItems = false) => {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent('credit-note-invoice-change', {
      detail: invoice ? { invoice, preserveExistingItems } : null,
    }));
    if (!preserveExistingItems) populateCreditNoteLinkedFields(invoice);
  };

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleCustomerChange = (event) => {
      const nextCustomerId = String(event.detail?.id || '');
      setCustomerId((currentCustomerId) => {
        if (currentCustomerId !== nextCustomerId) {
          setInvoiceId('');
          setInitialSelectionHydrated(true);
          publishInvoice(null);
        }
        return nextCustomerId;
      });
    };
    document.addEventListener('sales-customer-change', handleCustomerChange);
    return () => document.removeEventListener('sales-customer-change', handleCustomerChange);
  }, []);
  useEffect(() => {
    if (!selectedInvoice || initialSelectionHydrated) return;
    publishInvoice(selectedInvoice, true);
    setInitialSelectionHydrated(true);
  }, [initialSelectionHydrated, selectedInvoice]);

  const selectInvoice = (nextInvoiceId) => {
    setInvoiceId(String(nextInvoiceId));
    const invoice = invoices.find((candidate) => String(candidate.id) === String(nextInvoiceId));
    publishInvoice(invoice || null, false);
  };

  const selectMessage = !customerId
    ? 'Select a customer first'
    : eligibleQuery.isLoading
      ? 'Loading eligible invoices...'
      : invoices.length
        ? 'Select invoice'
        : 'No eligible invoices for this customer';

  return (
    <label className="block">
      <span className="text-sm font-bold">Reference Invoice<span className="text-red-600"> *</span></span>
      <span className="mt-2 flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        <select
          value={invoiceId}
          disabled={!customerId || eligibleQuery.isLoading || !invoices.length}
          onChange={(event) => selectInvoice(event.target.value)}
          className="h-full min-w-0 flex-1 appearance-none px-3 text-sm font-semibold outline-none disabled:bg-slate-100 disabled:text-slate-500"
        >
          <option value="">{selectMessage}</option>
          {invoices.map((invoice) => (
            <option key={invoice.id} value={String(invoice.id)}>{eligibleInvoiceLabel(invoice)}</option>
          ))}
        </select>
        <ChevronDown className="mr-3 h-4 w-4 text-slate-500" />
      </span>
      {!customerId && <span className="mt-1 block text-xs font-semibold text-slate-500">Please select a customer before selecting an invoice.</span>}
      {eligibleQuery.isError && <span className="mt-1 block text-xs font-bold text-red-600">Unable to load eligible invoices for this customer.</span>}
      <input type="hidden" data-sales-field="Reference Invoice" value={selectedInvoice?.invoiceNumber || savedValues['Reference Invoice'] || ''} readOnly />
      <input type="hidden" data-sales-field="Source Invoice ID" value={selectedInvoice?.id || invoiceId || ''} readOnly />
      <input type="hidden" data-sales-field="convertedFromId" value={selectedInvoice?.id || invoiceId || ''} readOnly />
      <input type="hidden" data-sales-field="Source Invoice Customer ID" value={selectedInvoice?.customerId || customerId || ''} readOnly />
      <input type="hidden" data-sales-field="Source Invoice Date" value={selectedInvoice?.invoiceDate || ''} readOnly />
      <input type="hidden" data-sales-field="Previously Credited Amount" value={selectedInvoice?.previouslyCreditedAmount || 0} readOnly />
      <input type="hidden" data-sales-field="Remaining Eligible Credit Amount" value={selectedInvoice?.remainingEligibleAmount || ''} readOnly />
    </label>
  );
}

function eligibleInvoiceLabel(invoice) {
  return `${invoice.invoiceNumber} | ${formatDate(invoice.invoiceDate)} | Total ${formatCurrency(invoice.totalAmount || 0)} | Balance ${formatCurrency(invoice.balanceDue || 0)}`;
}

function populateCreditNoteLinkedFields(invoice) {
  const notes = parseJsonObject(invoice?.notes);
  const fieldValues = {
    'Terms & Conditions': notes['Terms & Conditions'] || notes.Terms || '',
    Notes: notes.Notes || notes.notes || '',
  };
  Object.entries(fieldValues).forEach(([fieldName, value]) => {
    const field = document.querySelector(`[data-sales-field="${fieldName}"]`);
    if (!field) return;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function CompanyPlaceOfSupplyField({ companyProfile, loading }) {
  const companyState = companyProfile?.state || '';
  return (
    <div>
      <input type="hidden" data-sales-field="Company Country" value={companyProfile?.country || ''} readOnly />
      <input type="hidden" data-sales-field="Company State" value={companyState} readOnly />
      <input type="hidden" data-sales-field="Company GSTIN" value={companyProfile?.gstin || ''} readOnly />
      <Field
        label="Place Of Supply"
        required
        select
        value={companyState}
        options={companyState ? [companyState] : []}
        placeholder={loading ? 'Loading company state...' : 'Company state not configured'}
        onChange={() => {}}
      />
      {!loading && !companyState && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Please configure the company state in Settings before creating this document.
        </p>
      )}
    </div>
  );
}

function DocumentNumberField({ label, prefs, loading, onOpenSettings }) {
  const savedValues = useContext(SalesFormValuesContext);
  const savedNumber = savedValues[label] || '';
  const mustAutoGenerate = label === 'Invoice#';
  const number = savedNumber || ((prefs?.autoGenerate || mustAutoGenerate) ? generateDocumentNumber(prefs) : '');
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}<span className="text-red-600"> *</span></span>
      <span className="mt-2 flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        <input
          data-sales-field={label}
          className="h-full min-w-0 flex-1 px-3 text-sm font-semibold outline-none placeholder:text-slate-400"
          value={number}
          readOnly
          placeholder={loading ? 'Loading number...' : prefs?.autoGenerate ? '' : `Enter ${label.toLowerCase()}`}
        />
        <button type="button" onClick={onOpenSettings} className="grid h-full w-12 place-items-center border-l border-slate-200 text-blue-600 hover:bg-blue-50" title={`Configure ${label} preferences`}>
          <Settings className="h-5 w-5" />
        </button>
      </span>
    </label>
  );
}

function DocumentNumberSettingsModal({ documentType, title, documentLabel, prefs, onClose, onSaved, forceAutoGenerate = false }) {
  const initial = prefs || {
    autoGenerate: true,
    prefix: documentType === 'customers' ? 'CUST' : documentType === 'creditNotes' ? 'CN' : documentType === 'quotes' ? 'QUO' : documentType === 'orders' ? 'SO' : 'INT-2026',
    suffix: '',
    separator: '-',
    numberFormat: documentType === 'customers' ? '0000' : documentType === 'quotes' || documentType === 'orders' ? '000000' : '000',
    startingNumber: documentType === 'customers' ? 1 : documentType === 'creditNotes' ? 33 : documentType === 'quotes' ? 126 : documentType === 'orders' ? 153 : 88,
    nextNumber: documentType === 'customers' ? 1 : documentType === 'creditNotes' ? 33 : documentType === 'quotes' ? 126 : documentType === 'orders' ? 153 : 88,
  };
  const [autoGenerate, setAutoGenerate] = useState(forceAutoGenerate ? true : initial.autoGenerate);
  const [prefix, setPrefix] = useState(initial.prefix || '');
  const [suffix, setSuffix] = useState(initial.suffix || '');
  const [separator, setSeparator] = useState(initial.separator || '-');
  const [numberFormat, setNumberFormat] = useState(initial.numberFormat || '000');
  const [startingNumber, setStartingNumber] = useState(String(initial.startingNumber || 1));
  const [nextNumber, setNextNumber] = useState(String(initial.nextNumber || 1));
  const savePreference = useMutation({
    mutationFn: (payload) => documentNumberApi.save(documentType, payload),
    onSuccess: onSaved,
  });
  const preview = generateDocumentNumber({
    autoGenerate,
    prefix,
    suffix,
    separator,
    numberFormat,
    nextNumber: Number(nextNumber || 1),
  });
  const save = () => {
    const start = Math.max(1, Number(startingNumber || 1));
    const next = Math.max(start, Number(nextNumber || start));
    savePreference.mutate({
      autoGenerate,
      prefix,
      suffix,
      separator,
      numberFormat,
      startingNumber: start,
      nextNumber: next,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#06134a]/60 px-4 py-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-5 md:px-6">
          <div>
            <h2 className="text-2xl font-black">{title}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">Set how the next {documentLabel} number should be generated.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-red-600 hover:bg-red-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 px-5 py-5 md:px-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center gap-3 text-sm font-black">
              <input type="radio" name={`${documentType}NumberMode`} checked={autoGenerate} onChange={() => setAutoGenerate(true)} className="h-4 w-4 accent-blue-600" />
              Continue auto-generating {documentLabel} numbers
            </label>
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <ModalField label="Prefix" value={prefix} onChange={(value) => setPrefix(documentType === 'customers' ? value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) : value)} disabled={!autoGenerate} placeholder={documentType === 'customers' ? 'CUST' : 'INT-2026'} />
              {documentType !== 'customers' && <ModalField label="Suffix" value={suffix} onChange={setSuffix} disabled={!autoGenerate} placeholder="Optional" />}
              <ModalField label="Separator" value={separator} onChange={setSeparator} disabled={!autoGenerate} placeholder="-" maxLength={3} />
              <ModalField label="Starting Number" value={startingNumber} onChange={(value) => setStartingNumber(value.replace(/\D/g, '').slice(0, 12))} disabled={!autoGenerate} />
              <ModalField label="Next Number" value={nextNumber} onChange={(value) => setNextNumber(value.replace(/\D/g, '').slice(0, 12))} disabled={!autoGenerate} />
              <label className="block">
                <span className="text-sm font-bold">Number Format<span className="text-red-600"> *</span></span>
                <select value={numberFormat} onChange={(event) => setNumberFormat(event.target.value)} disabled={!autoGenerate} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none disabled:bg-slate-100">
                  {documentType !== 'customers' && <option value="0">0</option>}
                  {documentType !== 'customers' && <option value="00">00</option>}
                  <option value="000">000</option>
                  <option value="0000">0000</option>
                  <option value="00000">00000</option>
                  <option value="000000">000000</option>
                </select>
              </label>
            </div>
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase text-blue-700">Next generated number</p>
              <p className="mt-1 text-xl font-black text-[#06134a]">{autoGenerate ? preview : 'Manual entry enabled'}</p>
            </div>
          </div>
          {!forceAutoGenerate && <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-black">
            <input type="radio" name={`${documentType}NumberMode`} checked={!autoGenerate} onChange={() => setAutoGenerate(false)} className="h-4 w-4 accent-blue-600" />
            Enter {documentLabel} numbers manually
          </label>}
          {savePreference.isError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-600">Unable to save number configuration. Please check backend API.</p>}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 md:flex-row md:justify-end md:px-6">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 bg-white px-6 text-sm font-black hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={savePreference.isPending} onClick={save} className="h-10 rounded-lg bg-blue-600 px-6 text-sm font-black text-white shadow-sm shadow-blue-200 hover:bg-blue-700 disabled:opacity-60">
            {savePreference.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, value, onChange, disabled, placeholder, maxLength }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none placeholder:text-slate-400 disabled:bg-slate-100"
      />
    </label>
  );
}

function InvoiceProjectFields() {
  const savedValues = useContext(SalesFormValuesContext);
  const [invoiceType, setInvoiceType] = useState(savedValues['Invoice Type'] || savedValues.invoiceType || 'Fixed Cost');
  const [customer, setCustomer] = useState(savedValues['Customer Name'] || savedValues.Customer || '');
  const [projectId, setProjectId] = useState(String(savedValues['Project ID'] || savedValues.projectId || ''));
  const projectType = invoiceType === 'Staffing' ? 'staffing' : 'fixedCost';
  const projectsQuery = useQuery({
    queryKey: ['invoice-project-options', projectType, customer],
    queryFn: () => projectInvoicesApi.lookup({ projectType, customer }),
    enabled: Boolean(invoiceType),
    staleTime: 30_000,
  });
  const projects = projectsQuery.data || [];
  const selectedProject = projects.find((project) => String(project.id) === projectId);
  const savedProject = projectId && !selectedProject ? {
    id: projectId,
    name: savedValues['Project Name'] || savedValues.projectName || 'Linked Project',
    code: savedValues['Project Code'] || savedValues.projectCode || '',
    customer: savedValues['Project Customer'] || customer,
    currency: savedValues['Project Currency'] || savedValues.projectCurrency || normalizeCurrencyCode(savedValues.Currency),
  } : null;
  const options = savedProject ? [savedProject, ...projects] : projects;

  useEffect(() => {
    const customerChanged = (event) => setCustomer(event.detail?.partyName || '');
    document.addEventListener('sales-customer-change', customerChanged);
    return () => document.removeEventListener('sales-customer-change', customerChanged);
  }, []);
  useEffect(() => {
    if (!projectId) return;
    const current = options.find((project) => String(project.id) === projectId);
    if (current && customer && current.customer && current.customer.trim().toLowerCase() !== customer.trim().toLowerCase()) setProjectId('');
  }, [customer, projectsQuery.data]);
  const changeType = (nextType) => { setInvoiceType(nextType); setProjectId(''); };
  const changeProject = (value) => {
    setProjectId(value);
    const project = options.find((item) => String(item.id) === value);
    if (project?.currency) document.dispatchEvent(new CustomEvent('invoice-project-currency-change', { detail: { currency: project.currency } }));
  };
  const chosen = options.find((project) => String(project.id) === projectId);

  return (
    <div className="space-y-5">
      <span className="text-sm font-bold">Invoice Type<span className="text-red-600"> *</span></span>
      <div className="mt-2 flex h-11 items-center gap-5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
        {['Fixed Cost', 'Staffing'].map((type) => (
          <label key={type} className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="invoiceType"
              value={type}
              checked={invoiceType === type}
              onChange={(event) => changeType(event.target.value)}
              className="accent-blue-600"
            />
            {type}
          </label>
        ))}
      </div>
      <input type="hidden" data-sales-field="Invoice Type" value={invoiceType} readOnly />
      <label className="block">
        <span className="text-sm font-bold">Project<span className="text-red-600"> *</span></span>
        <span className="mt-2 flex h-11 items-center rounded-lg border border-slate-200 bg-white">
          <select data-sales-field="Project ID" value={projectId} onChange={(event) => changeProject(event.target.value)} disabled={!customer || projectsQuery.isLoading} className="h-full min-w-0 flex-1 appearance-none px-3 text-sm font-semibold outline-none">
            <option value="">{!customer ? 'Select customer first' : projectsQuery.isLoading ? 'Loading projects...' : `Select ${invoiceType} Project`}</option>
            {options.map((project) => <option key={project.id} value={project.id}>{projectType === 'staffing' ? `${project.customer} – ${project.name === project.customer ? project.code : project.name}` : `${project.name} – ${project.customer}`}{project.code ? ` (${project.code})` : ''}</option>)}
          </select>
          <ChevronDown className="mr-3 h-4 w-4 text-slate-500" />
        </span>
        {!projectsQuery.isLoading && customer && !options.length && <span className="mt-1 block text-xs font-semibold text-amber-600">No eligible {invoiceType.toLowerCase()} projects found for this customer.</span>}
      </label>
      <input type="hidden" data-sales-field="Project Name" value={chosen?.name || ''} readOnly />
      <input type="hidden" data-sales-field="Project Code" value={chosen?.code || ''} readOnly />
      <input type="hidden" data-sales-field="Project Customer" value={chosen?.customer || ''} readOnly />
      <input type="hidden" data-sales-field="Project Currency" value={chosen?.currency || ''} readOnly />
    </div>
  );
}

function SalesPersonField(){
  const savedValues=useContext(SalesFormValuesContext);const [value,setValue]=useState(savedValues['Sales Person']||'');
  const query=useQuery({queryKey:['resources','sales-persons'],queryFn:resourceUsersApi.salesPersons,staleTime:60_000});
  useEffect(()=>{if(savedValues['Sales Person'])setValue(savedValues['Sales Person']);},[savedValues]);
  return <Field label="Sales Person" required select placeholder={query.isLoading?'Loading sales employees…':query.isError?'Unable to load sales employees':'Select sales person'} value={value} options={(query.data||[]).map(employee=>employee.name)} onChange={setValue}/>;
}

function CurrencyField() {
  const savedValues = useContext(SalesFormValuesContext);
  const [value, setValue] = useState(normalizeCurrencyCode(savedValues.Currency));
  const query = useQuery({ queryKey: ['masters', 'currencies'], queryFn: currencyApi.list, staleTime: 300_000 });
  const currencies = query.data?.length ? query.data : FALLBACK_CURRENCIES;
  useEffect(() => setValue(normalizeCurrencyCode(savedValues.Currency)), [savedValues.Currency]);
  useEffect(() => {
    const handleProjectCurrency = (event) => change(event.detail?.currency || 'INR');
    document.addEventListener('invoice-project-currency-change', handleProjectCurrency);
    return () => document.removeEventListener('invoice-project-currency-change', handleProjectCurrency);
  }, []);
  const change = (next) => {
    const code = normalizeCurrencyCode(next);
    setValue(code);
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('invoice-currency-change', { detail: { currency: code } }));
  };
  return <Field label="Currency" required select value={value} options={currencies.map((currency) => ({ value: currency.code, label: `${currency.code} - ${currency.name}` }))} onChange={change} />;
}

function DocumentBankAccountField() {
  const savedValues = useContext(SalesFormValuesContext);
  const [value, setValue] = useState(savedValues['Bank Account ID'] || '');
  const [currency, setCurrency] = useState(normalizeCurrencyCode(savedValues.Currency));
  useEffect(() => setValue(savedValues['Bank Account ID'] || ''), [savedValues['Bank Account ID']]);
  useEffect(() => {
    const handleCurrency = (event) => setCurrency(normalizeCurrencyCode(event.detail?.currency));
    document.addEventListener('invoice-currency-change', handleCurrency);
    return () => document.removeEventListener('invoice-currency-change', handleCurrency);
  }, []);
  return <><BankAccountSelect label="Default Bank Account" value={value} onChange={setValue} currency={currency} includeInactive={Boolean(savedValues['Bank Account ID'])} /><input type="hidden" data-sales-field="Bank Account ID" value={value} readOnly /></>;
}

function SalesDocumentCalculatorSection({ document: documentKind = 'invoice', companyProfile }) {
  const savedValues = useContext(SalesFormValuesContext);
  const documentMeta = salesDocumentCalculatorMeta(documentKind);
  const savedItems = useMemo(() => {
    const directItems = parseJsonArray(savedValues[documentMeta.itemsField]);
    const legacyItems = parseJsonArray(savedValues.items);
    const invoiceItems = documentKind === 'invoice' ? parseJsonArray(savedValues['Invoice Items']) : [];
    return directItems.length ? directItems : legacyItems.length ? legacyItems : invoiceItems;
  }, [documentKind, documentMeta.itemsField, savedValues]);
  const [items, setItems] = useState(() => savedItems.length ? savedItems.map(normalizeInvoiceItem) : [newInvoiceItem()]);
  const [discount, setDiscount] = useState(Number(savedValues.Discount || 0));
  const [documentCurrency, setDocumentCurrency] = useState(normalizeCurrencyCode(savedValues.Currency));
  const selectedCurrencySymbol = currencySymbol(documentCurrency);
  const [customerTaxProfile, setCustomerTaxProfile] = useState({
    country: savedValues['Customer Country'] || '',
    state: savedValues['Customer Billing State'] || '',
  });
  const itemQuery = useQuery({
    queryKey: ['records', 'purchases', 'items', 'invoice-options'],
    queryFn: () => recordsApi.list({ module: 'purchases', type: 'items', page: 0, size: 500, sort: 'partyName,asc' }),
    staleTime: 60_000,
  });
  const dbItems = itemQuery.data?.content || [];
  const itemOptions = useMemo(
    () => dedupeInvoiceItemOptions(dbItems.map(toInvoiceItemOption).filter((option) => option.id && option.value && option.name)),
    [dbItems],
  );
  const gstMode = determineGstMode({
    companyCountry: companyProfile.country,
    companyState: companyProfile.state,
    customerCountry: customerTaxProfile.country,
    customerState: customerTaxProfile.state,
    currencyCode: documentCurrency,
  });
  const displayItems = items.map((item) => reconcileInvoiceItemSelection(item, itemOptions));
  const calculatedItems = displayItems.map((item) => calculateInvoiceItem(item, gstMode));
  const subtotal = calculatedItems.reduce((sum, item) => sum + item.amount, 0);
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxRatio = subtotal > 0 ? taxableAmount / subtotal : 1;
  const cgst = gstMode === 'CGST_SGST' ? calculatedItems.reduce((sum, item) => sum + item.cgstAmount * taxRatio, 0) : 0;
  const sgst = gstMode === 'CGST_SGST' ? calculatedItems.reduce((sum, item) => sum + item.sgstAmount * taxRatio, 0) : 0;
  const igst = gstMode === 'IGST' ? calculatedItems.reduce((sum, item) => sum + item.igstAmount * taxRatio, 0) : 0;
  const taxAmount = cgst + sgst + igst;
  const grandTotal = taxableAmount + taxAmount;
  // Credit notes must retain the invoice's exact paise amount. Rounding an
  // ₹11.80 invoice credit to ₹12.00 makes it exceed the eligible balance.
  const shouldRoundToWholeRupee = documentKind !== 'invoice' && documentKind !== 'creditNote';
  const finalGrandTotal = shouldRoundToWholeRupee ? Math.round(grandTotal) : roundCurrency(grandTotal);
  const roundOff = shouldRoundToWholeRupee ? finalGrandTotal - grandTotal : 0;
  const taxRate = calculatedItems.find((item) => Number(item.taxRate) > 0)?.taxRate || 18;
  const totals = {
    subtotal,
    discount,
    taxableAmount,
    cgst,
    sgst,
    igst,
    taxAmount,
    grandTotal: finalGrandTotal,
    roundOff,
    taxMode: gstMode,
    cgstRate: gstMode === 'CGST_SGST' ? taxRate / 2 : 0,
    sgstRate: gstMode === 'CGST_SGST' ? taxRate / 2 : 0,
    igstRate: gstMode === 'IGST' ? taxRate : 0,
    companyCountry: companyProfile.country,
    companyState: companyProfile.state,
    companyGstin: companyProfile.gstin,
    customerCountry: customerTaxProfile.country,
    customerState: customerTaxProfile.state,
  };

  const updateItem = (id, patch) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  useEffect(() => {
    if (!itemOptions.length) return;
    setItems((current) => {
      let changed = false;
      const reconciled = current.map((item) => {
        const next = reconcileInvoiceItemSelection(item, itemOptions);
        if (next !== item && (
          next.itemKey !== item.itemKey
          || next.itemId !== item.itemId
          || next.itemMasterId !== item.itemMasterId
          || next.itemName !== item.itemName
          || next.description !== item.description
          || next.hsnSac !== item.hsnSac
          || next.unit !== item.unit
          || String(next.rate) !== String(item.rate)
          || String(next.taxRate) !== String(item.taxRate)
        )) {
          changed = true;
        }
        return next;
      });
      return changed ? reconciled : current;
    });
  }, [itemOptions]);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.document) return undefined;
    const domDocument = window.document;
    const syncCustomerTaxProfile = () => setCustomerTaxProfile({
      country: domDocument.querySelector('[data-sales-field="Customer Country"]')?.value
        || domDocument.querySelector('[data-sales-field="Country"]')?.value
        || '',
      state: domDocument.querySelector('[data-sales-field="Customer Billing State"]')?.value
        || '',
    });
    syncCustomerTaxProfile();
    domDocument.addEventListener('change', syncCustomerTaxProfile);
    domDocument.addEventListener('input', syncCustomerTaxProfile);
    domDocument.addEventListener('invoice-tax-profile-change', syncCustomerTaxProfile);
    return () => {
      domDocument.removeEventListener('change', syncCustomerTaxProfile);
      domDocument.removeEventListener('input', syncCustomerTaxProfile);
      domDocument.removeEventListener('invoice-tax-profile-change', syncCustomerTaxProfile);
    };
  }, []);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const syncCurrency = (event) => setDocumentCurrency(normalizeCurrencyCode(event?.detail?.currency || document.querySelector('[data-sales-field="Currency"]')?.value));
    syncCurrency();
    document.addEventListener('invoice-currency-change', syncCurrency);
    return () => document.removeEventListener('invoice-currency-change', syncCurrency);
  }, []);
  useEffect(() => {
    if (documentKind !== 'creditNote' || typeof document === 'undefined') return undefined;
    const handleInvoiceChange = (event) => {
      const invoice = event.detail?.invoice;
      if (!invoice) {
        setItems([newInvoiceItem()]);
        setDiscount(0);
        return;
      }
      const sourceItems = creditNoteItemsFromEligibleInvoice(invoice);
      if (event.detail?.preserveExistingItems && savedItems.length) {
        const creditedQuantities = invoice.previouslyCreditedQuantities || {};
        setItems((current) => current.map((item) => annotateCreditNoteItem(item, creditedQuantities)));
        return;
      }
      setItems(sourceItems.length ? sourceItems : [newInvoiceItem()]);
      const sourceNotes = parseJsonObject(invoice.notes);
      const sourceTotals = parseJsonObject(sourceNotes['Invoice Totals'] || sourceNotes.totals);
      setDiscount(Number(sourceTotals.discount || sourceNotes.Discount || 0));
    };
    document.addEventListener('credit-note-invoice-change', handleInvoiceChange);
    return () => document.removeEventListener('credit-note-invoice-change', handleInvoiceChange);
  }, [documentKind, savedItems.length]);
  const selectItem = (rowIndex, optionValue, optionLabel = '') => {
    const selected = findInvoiceItemOption(itemOptions, optionValue, optionLabel);
    setItems((current) => current.map((row, index) => {
      if (index !== rowIndex) return row;
      return applyInvoiceItemOption(row, selected);
    }));
  };
  const addItem = () => setItems((current) => [...current, newInvoiceItem()]);
  const removeItem = (id) => setItems((current) => current.length > 1 ? current.filter((item) => item.id !== id) : [newInvoiceItem()]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <input type="hidden" data-sales-field={documentMeta.itemsField} value={JSON.stringify(calculatedItems)} readOnly />
      <input type="hidden" data-sales-field={documentMeta.totalsField} value={JSON.stringify(totals)} readOnly />
      <input type="hidden" data-sales-field="Amount" value={roundCurrency(finalGrandTotal)} readOnly />
      <input type="hidden" data-sales-field="Discount" value={roundCurrency(discount)} readOnly />
      <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-black">Line Items</h2>
        <div className="text-sm font-bold text-slate-600">Tax mode: {taxModeLabel(gstMode)}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{['#', 'Item / Service', 'Description', 'HSN / SAC', 'Unit', 'Qty', `Rate (${selectedCurrencySymbol})`, 'Tax', `Amount (${selectedCurrencySymbol})`, ''].map((head) => <th key={head} className="px-4 py-4">{head}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayItems.map((item, index) => {
              const calculatedItem = calculatedItems[index] || calculateInvoiceItem(item, gstMode);
              const selectedValue = String(item.itemKey || item.itemMasterId || item.itemId || '');
              const handleSelectChange = (event) => {
                const option = event.currentTarget.selectedOptions?.[0];
                selectItem(index, event.currentTarget.value, option?.textContent || '');
              };
              return (
              <tr key={item.id}>
                <td className="px-4 py-4 font-bold">{index + 1}</td>
                <td className="min-w-56 px-4 py-4">
                  <select
                    value={selectedValue}
                    onChange={handleSelectChange}
                    onInput={handleSelectChange}
                    data-sales-item-select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none"
                  >
                    <option value="">{itemQuery.isLoading ? 'Loading items...' : 'Select item'}</option>
                    {itemOptions.map((option) => <option key={option.value} value={option.value}>{option.name}</option>)}
                  </select>
                </td>
                <td className="min-w-52 px-4 py-4">
                  <input value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none" placeholder="Enter description" />
                </td>
                <td className="min-w-32 px-4 py-4">
                  <input value={item.hsnSac} onChange={(event) => updateItem(item.id, { hsnSac: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none" placeholder="HSN / SAC" />
                </td>
                <td className="min-w-24 px-4 py-4">
                  <input value={item.unit || ''} onChange={(event) => updateItem(item.id, { unit: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none" placeholder="Unit" />
                </td>
                <td className="min-w-28 px-4 py-4">
                  <input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none" />
                  {documentKind === 'creditNote' && item.remainingEligibleQuantity !== undefined && (
                    <span className="mt-1 block whitespace-nowrap text-[11px] font-semibold text-slate-500">
                      Credited {formatDecimal(item.previouslyCreditedQuantity || 0)} · Remaining {formatDecimal(item.remainingEligibleQuantity || 0)}
                    </span>
                  )}
                </td>
                <td className="min-w-32 px-4 py-4">
                  <input type="number" min="0" step="0.01" value={item.rate} onChange={(event) => updateItem(item.id, { rate: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none" />
                </td>
                <td className="min-w-32 px-4 py-4">
                  <input type="number" min="0" step="0.01" value={gstMode==='NONE'?0:item.taxRate} disabled={gstMode==='NONE'} onChange={(event) => updateItem(item.id, { taxRate: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none disabled:bg-slate-100 disabled:text-slate-500" />
                </td>
                <td className="px-4 py-4">
                  <input value={formatDecimal(calculatedItem.amount)} readOnly className="h-10 w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-sm font-black outline-none" />
                </td>
                <td className="px-4 py-4">
                  <button type="button" onClick={() => removeItem(item.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50" title="Delete item">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
              );
            })}
            {!itemQuery.isLoading && itemOptions.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-5 text-sm font-bold text-amber-600">No item master records found. Please create items in Purchases → Items first.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-slate-100 p-5">
        <button type="button" onClick={addItem} className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-bold text-blue-600">+ Add Item</button>
      </div>
      <div className="grid gap-5 border-t border-slate-100 p-5 xl:grid-cols-[0.9fr_1.1fr]">
        <FormCard title="Taxes">
          <div className="space-y-3 text-sm font-bold">
            <p className="flex justify-between"><span>Taxable Amount</span><span>{formatCurrency(taxableAmount, documentCurrency)}</span></p>
            {gstMode === 'CGST_SGST' && (
              <>
                <p className="flex justify-between"><span>CGST ({formatDecimal(totals.cgstRate)}%)</span><span>{formatCurrency(cgst, documentCurrency)}</span></p>
                <p className="flex justify-between"><span>SGST ({formatDecimal(totals.sgstRate)}%)</span><span>{formatCurrency(sgst, documentCurrency)}</span></p>
              </>
            )}
            {gstMode === 'IGST' && <p className="flex justify-between"><span>IGST ({formatDecimal(totals.igstRate)}%)</span><span>{formatCurrency(igst, documentCurrency)}</span></p>}
            {gstMode === 'NONE' && <p className="rounded-lg bg-slate-50 p-3 text-slate-600">No GST applicable for overseas customer.</p>}
          </div>
        </FormCard>
        <FormCard title={documentMeta.summaryTitle}>
          <div className="space-y-3 text-sm font-bold">
            <p className="flex justify-between"><span>Sub Total</span><span>{formatCurrency(subtotal, documentCurrency)}</span></p>
            <label className="flex items-center justify-between gap-4">
              <span>Discount</span>
              <input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value || 0))} className="h-9 w-32 rounded-lg border border-slate-200 px-3 text-right text-sm font-bold outline-none" />
            </label>
            <p className="flex justify-between"><span>Total Tax</span><span>{formatCurrency(taxAmount, documentCurrency)}</span></p>
            {Math.abs(Number(roundOff || 0)) >= 0.005 && <p className="flex justify-between"><span>Round Off</span><span>{formatCurrency(roundOff, documentCurrency)}</span></p>}
            <div className="border-t border-slate-200 pt-4 text-2xl font-black"><p className="flex justify-between"><span>Total ({selectedCurrencySymbol})</span><span>{formatCurrency(finalGrandTotal, documentCurrency)}</span></p></div>
            <p className="rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-700">{documentMeta.note}</p>
          </div>
        </FormCard>
      </div>
    </section>
  );
}

function salesDocumentCalculatorMeta(document) {
  if (document === 'quote') {
    return {
      itemsField: 'Quote Items',
      totalsField: 'Quote Totals',
      summaryTitle: 'Proforma Summary',
      note: 'This is a proforma invoice and not a final tax invoice.',
    };
  }
  if (document === 'creditNote') {
    return {
      itemsField: 'Credit Note Items',
      totalsField: 'Credit Note Totals',
      summaryTitle: 'Credit Note Summary',
      note: 'This is a credit note and will be saved with calculated item and tax details.',
    };
  }
  if (document === 'order') {
    return {
      itemsField: 'Sales Order Items',
      totalsField: 'Sales Order Totals',
      summaryTitle: 'Sales Order Summary',
      note: 'This sales order will be saved with calculated item and tax details.',
    };
  }
  return {
    itemsField: 'Invoice Items',
    totalsField: 'Invoice Totals',
    summaryTitle: 'Invoice Summary',
    note: 'This is an invoice and will be saved with calculated item and tax details.',
  };
}

function newInvoiceItem() {
  return { id: `${Date.now()}-${Math.random()}`, itemKey: '', itemId: '', itemMasterId: '', itemNumber: '', itemName: '', itemType: '', description: '', hsnSac: '', unit: '', quantity: '1', rate: '0', taxRate: '18' };
}

function normalizeInvoiceItem(item) {
  return {
    ...newInvoiceItem(),
    ...item,
    id: item.id || `${Date.now()}-${Math.random()}`,
    itemKey: String(item.itemKey || item.itemMasterId || item.itemId || item.itemNumber || item.itemName || ''),
    itemId: item.itemId || item.itemMasterId || '',
    itemMasterId: item.itemMasterId || item.itemId || '',
  };
}

function creditNoteItemKey(item = {}) {
  return String(item.itemMasterId || item.itemId || item.itemKey || item.itemNumber || item.itemName || '').trim().toLowerCase();
}

function annotateCreditNoteItem(item, previouslyCreditedQuantities = {}) {
  const normalized = normalizeInvoiceItem(item);
  const originalQuantity = Number(normalized.originalInvoiceQuantity || normalized.quantity || 0);
  const previouslyCreditedQuantity = Number(previouslyCreditedQuantities[creditNoteItemKey(normalized)] || 0);
  return {
    ...normalized,
    originalInvoiceQuantity: originalQuantity,
    previouslyCreditedQuantity,
    remainingEligibleQuantity: Math.max(0, originalQuantity - previouslyCreditedQuantity),
  };
}

function creditNoteItemsFromEligibleInvoice(invoice) {
  const notes = parseJsonObject(invoice?.notes);
  const invoiceItems = parseJsonArray(notes['Invoice Items']);
  const sourceItems = invoiceItems.length ? invoiceItems : parseJsonArray(notes.items);
  const previouslyCreditedQuantities = invoice?.previouslyCreditedQuantities || {};
  return sourceItems
    .map((item) => annotateCreditNoteItem(item, previouslyCreditedQuantities))
    .map((item) => ({ ...item, quantity: item.remainingEligibleQuantity }))
    .filter((item) => Number(item.remainingEligibleQuantity || 0) > 0);
}

function toInvoiceItemOption(record, index = 0) {
  const notes = parseJsonObject(record.notes);
  const id = String(record.id || record.recordNumber || record.referenceNumber || record.partyName || `item-${index}`);
  const recordNumber = record.recordNumber || '';
  const name = record.partyName || notes['Item Name'] || notes.Name || `Item ${index + 1}`;
  return {
    id,
    value: id,
    recordNumber,
    name,
    itemType: notes['Item Type'] || notes.itemType || '',
    description: notes['Description (Optional)'] || notes.Description || name,
    hsnSac: notes['HSN Code'] || notes['SAC Code'] || record.referenceNumber || '',
    unit: notes.Unit || notes['Unit'] || 'Pcs',
    rate: Number(record.amount || notes['Selling Price (₹)'] || 0),
    taxRate: Number(notes['Tax (%)'] || 18),
  };
}

function dedupeInvoiceItemOptions(options) {
  const seen = new Set();
  return options.filter((option) => {
    const key = String(option.id || option.value || option.recordNumber || option.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findInvoiceItemOption(options, value, label = '') {
  const selectedValue = String(value || '').trim();
  const selectedLabel = String(label || '').trim();
  if (!selectedValue && !selectedLabel) return null;
  return options.find((option) => (
    String(option.value || '') === selectedValue
    || String(option.id || '') === selectedValue
    || String(option.recordNumber || '') === selectedValue
    || String(option.name || '') === selectedValue
    || (selectedLabel && String(option.name || '') === selectedLabel)
  )) || null;
}

function applyInvoiceItemOption(row, selected) {
  if (!selected) {
    return {
      ...row,
      itemKey: '',
      itemId: '',
      itemMasterId: '',
      itemNumber: '',
      itemName: '',
      itemType: '',
      description: '',
      hsnSac: '',
      unit: '',
      rate: '0',
      taxRate: '18',
    };
  }
  return {
    ...row,
    itemKey: selected.value,
    itemId: selected.id,
    itemMasterId: selected.id,
    itemNumber: selected.recordNumber,
    itemName: selected.name,
    itemType: selected.itemType || '',
    description: selected.description || selected.name,
    hsnSac: selected.hsnSac || '',
    unit: selected.unit || '',
    rate: selected.rate ?? 0,
    taxRate: selected.taxRate ?? 18,
  };
}

function reconcileInvoiceItemSelection(item, options) {
  if (!item || !options.length) return item;
  const selected = options.find((option) => (
    option.value === item.itemKey
    || String(option.id || '') === String(item.itemId || '')
    || String(option.id || '') === String(item.itemMasterId || '')
    || (option.recordNumber && option.recordNumber === item.itemKey)
    || (option.recordNumber && option.recordNumber === item.itemNumber)
    || (option.name && option.name === item.itemKey)
    || (option.name && option.name === item.itemName)
  ));
  if (!selected) return item;
  return {
    ...item,
    itemKey: selected.value,
    itemId: selected.id,
    itemMasterId: selected.id,
    itemNumber: selected.recordNumber,
    itemName: selected.name,
    itemType: item.itemType || selected.itemType || '',
    description: item.description || selected.description || selected.name,
    hsnSac: item.hsnSac || selected.hsnSac || '',
    unit: item.unit || selected.unit || '',
    rate: Number(item.rate || 0) > 0 ? item.rate : selected.rate,
    taxRate: Number(item.taxRate || 0) > 0 ? item.taxRate : selected.taxRate,
  };
}

function calculateInvoiceItem(item, gstMode) {
  const quantity = Number(item.quantity || 0);
  const rate = Number(item.rate || 0);
  const taxRate = gstMode === 'NONE' ? 0 : Number(item.taxRate || 0);
  const amount = quantity * rate;
  const totalTax = gstMode === 'NONE' ? 0 : amount * taxRate / 100;
  return {
    ...item,
    quantity,
    rate,
    taxRate,
    amount,
    cgstAmount: gstMode === 'CGST_SGST' ? totalTax / 2 : 0,
    sgstAmount: gstMode === 'CGST_SGST' ? totalTax / 2 : 0,
    igstAmount: gstMode === 'IGST' ? totalTax : 0,
  };
}

function organizationFromSettingsRecord(record) {
  const notes = parseJsonObject(record?.notes);
  const state = notes.state || inferIndianState(record?.partyCity || notes.address) || '';
  return {
    name: record?.partyName || 'IntelliaTech Pvt. Ltd.',
    email: record?.partyEmail || '',
    phone: record?.partyPhone || '',
    address: notes.address || record?.partyCity || '',
    country: notes.country || inferCountry(record?.partyCity || notes.address || state) || '',
    state,
    gstin: record?.referenceNumber || '',
    pan: notes.pan || '',
    tdsBaseType: notes.tdsBaseType || 'TAXABLE_VALUE',
  };
}

function normalizeBrandLogoUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  const marker = '/branding/logo/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return url;
  const fileName = url.slice(markerIndex + marker.length).split(/[?#]/, 1)[0];
  return fileName ? `/branding-assets/${encodeURIComponent(decodeURIComponent(fileName))}` : url;
}

function CompanyBrandMark({ company }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = absoluteBrandLogoUrl(company?.logoUrl);

  useEffect(() => setLogoFailed(false), [logoUrl]);

  if (logoUrl && !logoFailed) {
    return (
      <img
        src={logoUrl}
        alt={`${company?.name || 'Company'} logo`}
        className="h-[78px] w-[180px] shrink-0 self-center object-contain object-left"
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return (
    <div className="self-center font-black tracking-wide text-slate-950" style={{ fontSize: 30, whiteSpace: 'nowrap' }}>
      <span className="text-red-600" style={{ fontSize: 36 }}>C</span> INTELLIATECH
      <p className="mt-1 text-center text-red-600" style={{ fontSize: 10, letterSpacing: '0.55em' }}>SOLUTIONS</p>
    </div>
  );
}

function absoluteBrandLogoUrl(value) {
  const normalized = normalizeBrandLogoUrl(value);
  if (!normalized || typeof window === 'undefined') return normalized;
  try {
    return new URL(normalized, window.location.origin).href;
  } catch {
    return normalized;
  }
}

function determineGstMode({ companyCountry, companyState, customerCountry, customerState }) {
  const company = normalizeCountry(companyCountry);
  const customer = normalizeCountry(customerCountry);
  if (!company || !customer) return 'NONE';
  if (company !== 'india' || customer !== 'india') return 'NONE';
  if (!normalizeState(companyState) || !normalizeState(customerState)) return 'NONE';
  return normalizeState(companyState) === normalizeState(customerState) ? 'CGST_SGST' : 'IGST';
}

function taxModeLabel(mode) {
  if (mode === 'CGST_SGST') return 'CGST + SGST';
  if (mode === 'IGST') return 'IGST';
  return 'No GST';
}

function normalizeCountry(value = '') {
  const text = String(value).trim().toLowerCase();
  if (['in', 'ind', 'india'].includes(text)) return 'india';
  return text;
}

function inferCountry(value = '') {
  const text = String(value).toLowerCase();
  if (text.includes('australia')) return 'Australia';
  if (text.includes('usa') || text.includes('united states')) return 'United States';
  if (text.includes('uk') || text.includes('united kingdom')) return 'United Kingdom';
  if (text.includes('uae')) return 'UAE';
  if (text.includes('canada')) return 'Canada';
  return text.trim() ? 'India' : '';
}

function inferIndianState(value = '') {
  const text = String(value).toLowerCase();
  if (text.includes('tamil nadu') || text.includes('chennai')) return 'Tamil Nadu (33)';
  if (text.includes('madhya pradesh') || text.includes('indore')) return 'Madhya Pradesh (23)';
  if (text.includes('maharashtra') || text.includes('mumbai')) return 'Maharashtra (27)';
  if (text.includes('karnataka') || text.includes('bangalore') || text.includes('bengaluru')) return 'Karnataka (29)';
  if (text.includes('delhi')) return 'Delhi (07)';
  return '';
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeState(value = '') {
  const inferred = inferIndianState(value);
  return String(inferred || value).replace(/\([^)]*\)/g, '').trim().toLowerCase();
}

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function formatDecimal(value) {
  return roundCurrency(value).toFixed(2);
}

function LineItems({ title = 'Line Items', delivered = false }) {
  const rows = delivered ? ['Web Development Serv', 'UI/UX Design', 'Hosting (1 Year)'] : ['Select item or service', 'Select item or service'];
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between p-5">
        <h2 className="text-lg font-black">{title}</h2>
        <div className="flex gap-4 text-sm font-bold"><label><input type="checkbox" /> Inclusive of Tax</label><button className="text-blue-600">Bulk Update</button></div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{['#', 'Item / Service', 'Description', 'HSN / SAC', 'Qty', 'Rate (₹)', 'Discount', 'Tax', 'Amount (₹)', ''].map((h) => <th key={h} className="px-4 py-4">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((item, index) => (
              <tr key={item}>
                <td className="px-4 py-4 font-bold">{index + 1}</td>
                <td className="px-4 py-4"><Field label="" select value={item} placeholder="Select item or service" /></td>
                <td className="px-4 py-4"><Field label="" placeholder="Enter description" value={delivered ? ['Website development', 'UI/UX design and prototype', 'Web hosting - 1 year'][index] : ''} /></td>
                <td className="px-4 py-4"><Field label="" placeholder="Enter HSN / SAC" /></td>
                <td className="px-4 py-4"><Field label="" value="1.00" /></td>
                <td className="px-4 py-4"><Field label="" value={delivered ? ['15,000.00', '10,000.00', '2,000.00'][index] : '0.00'} /></td>
                <td className="px-4 py-4"><Field label="" prefix="%" value="0" /></td>
                <td className="px-4 py-4"><Field label="" select value={delivered ? 'GST 18%' : 'Select Tax'} /></td>
                <td className="px-4 py-4"><Field label="" value={delivered ? ['15,000.00', '10,000.00', '2,000.00'][index] : '0.00'} /></td>
                <td className="px-4 py-4 text-red-600">⌫</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 p-5"><button className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-bold text-blue-600">+ Add Line</button><button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold">+ Add Description</button></div>
    </section>
  );
}

function TaxesCard() {
  return (
    <FormCard title="Taxes">
      <div className="grid grid-cols-4 gap-3 text-xs font-bold uppercase text-slate-500"><span>Tax Name</span><span>Rate</span><span>Taxable Amount</span><span>Tax Amount</span></div>
      {['CGST', 'SGST'].map((tax) => <div key={tax} className="grid grid-cols-4 items-center gap-3 text-sm font-bold"><span>{tax}</span><Field label="" select value="9%" /><span>0.00</span><span>0.00</span></div>)}
      <button className="text-left text-sm font-bold text-blue-600">+ Add Tax</button>
    </FormCard>
  );
}

function SummaryCard({ total = '₹0.00', note }) {
  return (
    <FormCard title="Sub Total">
      {['Sub Total', 'Discount', 'Taxable Amount', 'Total Tax', 'Round Off'].map((row) => <p key={row} className="flex justify-between text-sm font-bold"><span>{row}</span><span>₹0.00</span></p>)}
      <div className="border-t border-slate-200 pt-5 text-2xl font-black"><p className="flex justify-between"><span>Total (₹)</span><span>{total}</span></p></div>
      {note && <p className="rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-700">{note}</p>}
    </FormCard>
  );
}

function PaymentForm() {
  const [bankAccountId, setBankAccountId] = useState('');
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-3">
        <FormCard title="Customer Details"><CustomerDetailsContent showContact /></FormCard>
        <FormCard title="Payment Details"><Field label="Payment Date" required value="30 May 2024" /><Field label="Payment #" value="Auto generated" /><Field label="Payment Mode" required select placeholder="Select payment mode" /><TextArea label="Notes" placeholder="Enter notes (optional)" /></FormCard>
        <FormCard title="Amount Details"><Field label="Amount Received" required prefix="₹" value="0.00" /><p className="font-bold">Unallocated Amount<br />₹0.00</p><Field label="Exchange Rate" value="1" /><div className="rounded-lg bg-blue-50 p-4 text-sm font-semibold">Amounts will be allocated below. You can adjust the allocation manually.</div></FormCard>
      </div>
      <AllocatePayment />
      <div className="grid gap-5 xl:grid-cols-3">
        <FormCard title="Payment Summary"><p className="flex justify-between font-bold"><span>Amount Received</span><span>₹35,000.00</span></p><p className="flex justify-between font-bold"><span>(-) Allocated Amount</span><span>₹35,000.00</span></p><p className="rounded-lg bg-emerald-50 p-3 font-bold text-emerald-700">Balance (₹) ₹0.00</p></FormCard>
        <FormCard title="Bank Details (for this payment)"><BankAccountSelect value={bankAccountId} onChange={setBankAccountId} currency="INR" required /><input type="hidden" data-sales-field="Bank Account ID" value={bankAccountId} readOnly /><Field label="Transaction Date" value="30 May 2024" /></FormCard>
        <FormCard title="Attachment"><UploadBox /></FormCard>
        <FormCard title="Terms & Conditions"><TextArea label="" placeholder="Enter terms and conditions (optional)" count="0 / 1000" /></FormCard>
        <FormCard title="Internal Notes"><TextArea label="" placeholder="Enter internal notes (optional)" /></FormCard>
        <FormCard title="Send Receipt To">{['Email to customer', 'WhatsApp to customer', 'Add message'].map((item, i) => <label key={item} className="block text-sm font-bold"><input type="checkbox" defaultChecked={i === 0} /> {item}</label>)}</FormCard>
      </div>
    </>
  );
}

function AllocatePayment() {
  const invoices = ['INV-000250', 'INV-000249', 'INV-000248', 'INV-000247', 'INV-000246'];
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between p-5"><h2 className="text-lg font-black">Allocate Payment</h2><div className="flex gap-3"><SelectLike label="Oldest Due First" /><button className="rounded-lg border border-slate-200 px-4 text-sm font-bold text-blue-600">+ Add Adjustment</button></div></div>
      <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['', 'Invoice #', 'Invoice Date', 'Due Date', 'Invoice Amount (₹)', 'Paid (₹)', 'Balance Due (₹)', 'Payment (₹)'].map((h) => <th key={h} className="px-4 py-4">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{invoices.map((invoice, index) => <tr key={invoice}><td className="px-4 py-4"><input type="checkbox" /></td><td className="px-4 py-4 font-bold text-blue-600">{invoice}</td><td>30 May 2024</td><td className="text-red-600">14 Jun 2024</td><td className="font-bold">₹{['15,000.00', '25,000.00', '7,500.00', '12,000.00', '8,000.00'][index]}</td><td>₹0.00</td><td className="font-bold">₹{['15,000.00', '20,000.00', '7,500.00', '12,000.00', '8,000.00'][index]}</td><td className="px-4 py-3"><Field label="" prefix="₹" value={index < 2 ? ['15,000.00', '20,000.00'][index] : '0.00'} /></td></tr>)}</tbody></table>
      <div className="p-5 text-right text-lg font-black text-emerald-600">Total Allocated: ₹35,000.00</div>
    </section>
  );
}

function ChallanForm() {
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-3">
        <FormCard title="Customer Details"><CustomerDetailsContent compact showBillingText /></FormCard>
        <FormCard title="Challan Details"><Field label="Challan #" required value="Auto generated" /><Field label="Challan Date" required value="30 May 2024" /><Field label="Sales Order" required select placeholder="Select sales order" /><Field label="Order Date" placeholder="Select order date" /><TextArea label="Reference / Notes" placeholder="Enter reference or notes (optional)" /></FormCard>
        <FormCard title="Shipping & Delivery Details"><Field label="Delivery To" required select placeholder="Select delivery address" /><p className="text-sm font-semibold">Shipping Address<br />S61 Stirling Highway<br />Cottesloe<br />6011 Western Australia<br />Australia</p><Field label="Place of Supply" required select value="Tamil Nadu (33)" /><Field label="Transporter" placeholder="Enter transporter name" /><Field label="Vehicle No." placeholder="Enter vehicle number" /><Field label="Delivery Date" value="30 May 2024" /></FormCard>
      </div>
      <LineItems title="Items to Deliver" delivered />
      <div className="grid gap-5 xl:grid-cols-3">
        <FormCard title="Terms & Conditions"><TextArea label="Terms & Conditions" placeholder="Enter terms and conditions (optional)" count="0 / 1000" /><UploadBox /></FormCard>
        <SummaryCard total="₹31,860.00" />
        <FormCard title="Other Information"><Field label="Delivery Status" required select value="Delivered" /><Field label="Delivered By" select placeholder="Select delivered by" /><TextArea label="Remarks" placeholder="Enter remarks (optional)" count="0 / 300" /></FormCard>
        <FormCard title="Internal Notes"><TextArea label="" placeholder="Enter internal notes (optional)" /></FormCard>
        <FormCard title="Send Challan To">{['Email to customer', 'WhatsApp to customer', 'Add message'].map((item, i) => <label key={item} className="block text-sm font-bold"><input type="checkbox" defaultChecked={i === 0} /> {item}</label>)}</FormCard>
        <FormCard title="More Options"><label className="text-sm font-bold"><input type="checkbox" /> Print delivery challan after saving</label></FormCard>
      </div>
    </>
  );
}

function BottomActions({ config, payloadFactory }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-7 md:flex-row md:items-center md:justify-between md:px-7">
      <label className="text-sm font-semibold"><input type="checkbox" /> Save and create another {config.title.toLowerCase().replace('create ', '').replace('add ', '').replace('record ', '')}</label>
      <SaveButtons config={config} includeCancel payloadFactory={payloadFactory} />
    </div>
  );
}

function SaveButtons({ config, includeCancel = false, payloadFactory }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const [validationError, setValidationError] = useState('');
  const numberDocumentType = ['quotes', 'orders', 'invoices', 'creditNotes'].includes(config.activeType) ? config.activeType : '';
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const saved = isEdit
        ? await recordsApi.update({ module: 'sales', type: config.activeType, id, payload })
        : await recordsApi.create({ module: 'sales', type: config.activeType, payload });
      if (config.activeType === 'creditNotes' && payload.status !== 'Draft') {
        const notes = parseJsonObject(payload.notes);
        const sourceInvoiceId = Number(notes.convertedFromId || 0);
        if (sourceInvoiceId > 0) {
          await invoiceLifecycleApi.applyCreditNote({ invoiceId: sourceInvoiceId, creditNoteId: saved.id, amount: payload.amount });
        }
      }
      return saved;
    },
    onSuccess: async (saved, payload) => {
      if (!isEdit && numberDocumentType && numberDocumentType !== 'invoices' && payload?.recordNumber) {
        try {
          const nextPreference = await documentNumberApi.consume(numberDocumentType);
          queryClient.setQueryData(['document-number-preference', numberDocumentType], nextPreference);
        } catch {
          queryClient.invalidateQueries({ queryKey: ['document-number-preference', numberDocumentType] });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'eligible-for-credit-note'] });
      queryClient.invalidateQueries({ queryKey: ['document-number-preference', numberDocumentType] });
      navigate(config.activeType==='customers'?`/sales/customers/${saved.id}`:config.backTo, {
        replace: true,
        state: { message: `${config.title.replace(/^Create |^Add |^Record /, '')} ${isEdit ? 'updated' : 'created'} successfully.` },
      });
    },
  });
  const save = async (draft = false) => {
    try {
      setValidationError('');
      if (config.activeType === 'invoices') {
        const health = await healthApi.get();
        if (health?.apiCompatibility !== API_COMPATIBILITY_VERSION) {
          throw new Error('The backend is outdated. Close the running IntelliaTech Terminal window and start the application again before saving this invoice.');
        }
      }
      const numberPreference = numberDocumentType ? await documentNumberApi.get(numberDocumentType) : null;
      const generatedNumber = !isEdit && (numberPreference?.autoGenerate || numberDocumentType === 'invoices')
        ? generateDocumentNumber(numberPreference)
        : '';
      const payload = payloadFactory
        ? payloadFactory(draft)
        : collectSalesPayload(config, draft, generatedNumber);
      saveMutation.mutate(draft ? { ...payload, status: 'Draft' } : payload);
    } catch (error) {
      setValidationError(error.message || 'Please check required invoice data.');
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-3">
        {includeCancel && <Link to={config.backTo} className="grid h-10 min-w-28 place-items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold">Cancel</Link>}
        <button disabled={saveMutation.isPending} onClick={() => save(true)} className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold disabled:opacity-60">{saveMutation.isPending ? 'Saving...' : config.secondary || 'Save as Draft'}</button>
        <button disabled={saveMutation.isPending} onClick={() => save(false)} className="flex h-10 items-center gap-3 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-60">{saveMutation.isPending ? 'Saving...' : config.primary}<ChevronDown className="h-4 w-4" /></button>
      </div>
      {saveMutation.isSuccess && <p className="text-xs font-bold text-emerald-600">Saved successfully in database.</p>}
      {validationError && <p className="max-w-md text-right text-xs font-bold text-red-600">{validationError}</p>}
      {saveMutation.isError && <p className="max-w-md text-right text-xs font-bold text-red-600">{apiErrorMessage(saveMutation.error, 'Save failed. Please check required data and backend connection.')}</p>}
    </div>
  );
}

function collectSalesPayload(config, draft = false, generatedNumber = '') {
  const values = collectFieldValues('sales');
  if (['quotes', 'orders', 'invoices', 'creditNotes'].includes(config.activeType)) {
    return collectSalesDocumentPayload(config, values, draft, generatedNumber);
  }
  const recordNumber = generatedNumber
    || values[`${config.document || config.activeType}#`]
    || values['Proforma#']
    || values['Quote#']
    || values['Order #']
    || values['Invoice#']
    || values['Credit Note#']
    || values['Payment #']
    || values['Challan #']
    || generatedSalesValue(config.activeType);
  const partyName = values['Customer Name'] || values.Customer || values['Customer'] || 'New Customer';
  const amount = parseMoney(values['Amount Received'] || values.Amount || values.Total || values['Credit Limit'] || '0');

  return {
    ...makeRecordPayload({ module: 'sales', type: config.activeType, titlePrefix: config.title }),
    recordNumber,
    partyName,
    partyEmail: values.Email || values['Email ID'] || '',
    partyPhone: values.Phone || values['Mobile (Optional)'] || '',
    partyCity: values.City || values['Place of Supply'] || '',
    category: values['Customer Group'] || values['Sales Channel'] || values['Credit Note Type'] || 'General',
    status: draft ? 'Draft' : defaultSalesStatus(config.activeType),
    secondaryStatus: values['Payment Status'] || values['Delivery Status'] || values['Billing Type'] || '',
    amount,
    balanceAmount: config.activeType === 'payments' ? 0 : amount,
    recordDate: normalizeInputDate(values['Invoice Date'] || values['Proforma Date'] || values['Quote Date'] || values['Order Date'] || values['Credit Note Date'] || values['Payment Date'] || values['Challan Date']),
    dueDate: normalizeInputDate(values['Due Date'] || values['Valid Till'] || values['Valid Until'] || values['Delivery Date'] || values['Expiry Date'], 15),
    referenceNumber: values['Reference#'] || values['Reference / Notes'] || values['Reference Invoice'] || values['Sales Order'] || '',
    paymentMode: values['Payment Mode'] || values['Payment Terms'] || '',
    ownerName: values['Sales Person'] || 'Praveen Admin',
    notes: JSON.stringify(values),
  };
}

function collectSalesDocumentPayload(config, values, draft = false, generatedNumber = '') {
  const documentName = config.activeType === 'quotes'
    ? 'Quote'
    : config.activeType === 'orders'
      ? 'Sales Order'
      : config.activeType === 'creditNotes'
        ? 'Credit Note'
        : 'Invoice';
  const displayDocumentName = config.activeType === 'quotes' ? 'Proforma Invoice' : documentName;
  const itemsField = `${documentName} Items`;
  const totalsField = `${documentName} Totals`;
  const items = parseJsonArray(values[itemsField]);
  const totals = parseJsonObject(values[totalsField]);
  const customer = values['Customer Name'] || values.Customer || '';
  const invoiceType = values['Invoice Type'] || '';
  const projectId = Number(values['Project ID'] || 0);
  const subject = values.Subject || '';
  const customerCountry = values['Customer Country'] || '';
  const customerBillingState = values['Customer Billing State'] || '';
  const companyCountry = values['Company Country'] || '';
  const companyState = values['Company State'] || '';
  const companyGstin = values['Company GSTIN'] || '';
  const placeOfSupply = values['Place Of Supply'] || companyState;
  const documentDateField = config.activeType === 'quotes'
    ? (values['Proforma Date'] !== undefined ? 'Proforma Date' : 'Quote Date')
    : config.activeType === 'orders'
      ? 'Order Date'
      : config.activeType === 'creditNotes'
        ? 'Credit Note Date'
        : 'Invoice Date';
  const documentDate = normalizeInputDate(values[documentDateField]);
  const sourceInvoiceId = String(values['Source Invoice ID'] || values.convertedFromId || '');
  const sourceInvoiceCustomerId = String(values['Source Invoice Customer ID'] || '');
  const customerId = String(values['Customer ID'] || '');

  if (!customer) throw new Error('Customer is required.');
  if (!companyState) throw new Error('Please configure the company state in Settings before creating this document.');
  if (!customerCountry) throw new Error('Customer Country is required.');
  if (normalizeCountry(customerCountry) === 'india' && !customerBillingState) throw new Error('Customer Billing State is required for Indian customers.');
  if (!values[documentDateField]) throw new Error(`${displayDocumentName} Date is required.`);
  if (config.activeType === 'invoices' && !invoiceType) throw new Error('Invoice Type is required.');
  if (config.activeType === 'invoices' && !projectId) throw new Error('Project is required.');
  if ((config.activeType === 'invoices' || config.activeType === 'quotes') && !subject.trim()) throw new Error('Subject is required.');
  if (config.activeType === 'creditNotes') {
    if (!sourceInvoiceId) throw new Error('Please select an invoice for this credit note.');
    if (sourceInvoiceCustomerId && customerId && sourceInvoiceCustomerId !== customerId) {
      throw new Error('The selected invoice does not belong to this customer.');
    }
  }
  if (!items.length) throw new Error(`At least one ${displayDocumentName.toLowerCase()} item is required.`);
  items.forEach((item, index) => {
    if (!item.itemId && !item.itemName) throw new Error(`Item is required on row ${index + 1}.`);
    if (Number(item.quantity || 0) <= 0) throw new Error(`Quantity must be greater than 0 on row ${index + 1}.`);
    if (Number(item.rate || 0) <= 0) throw new Error(`Rate must be greater than 0 on row ${index + 1}.`);
  });

  const grandTotal = roundCurrency(totals.grandTotal || values.Amount || 0);
  if (config.activeType === 'creditNotes') {
    const remainingEligibleAmount = Number(values['Remaining Eligible Credit Amount'] || 0);
    if (remainingEligibleAmount > 0 && grandTotal > remainingEligibleAmount + 0.01) {
      throw new Error('The credit note amount exceeds the remaining eligible invoice amount.');
    }
    items.forEach((item, index) => {
      if (item.remainingEligibleQuantity !== undefined
        && Number(item.quantity || 0) > Number(item.remainingEligibleQuantity || 0) + 0.0001) {
        throw new Error(`The credit quantity exceeds the remaining invoice-item quantity on row ${index + 1}.`);
      }
    });
  }
  const recordNumber = generatedNumber
    || values[`${documentName}#`]
    || values['Order #']
    || values.InvoiceNumber
    || values['Invoice#']
    || values['Proforma#']
    || values['Quote#']
    || values['Credit Note#']
    || generatedSalesValue(documentName);
  return {
    ...makeRecordPayload({ module: 'sales', type: config.activeType, titlePrefix: config.title }),
    recordNumber,
    partyName: customer,
    partyEmail: values.Email || '',
    partyPhone: values.Phone || '',
    partyCity: customerBillingState || values.City || '',
    category: config.activeType === 'invoices' ? invoiceType : values['Credit Note Type'] || values['Sales Channel'] || 'General',
    status: draft ? 'Draft' : defaultSalesStatus(config.activeType),
    secondaryStatus: config.activeType === 'invoices' ? 'Unpaid' : config.activeType === 'orders' ? 'To be Delivered' : '',
    amount: grandTotal,
    balanceAmount: grandTotal,
    recordDate: documentDate,
    dueDate: normalizeInputDate(values['Due Date'] || values['Valid Till'] || values['Valid Until'] || values['Expiry Date'], 15),
    referenceNumber: config.activeType === 'creditNotes'
      ? values['Reference Invoice'] || ''
      : values['Reference#'] || values['PO Number'] || '',
    paymentMode: values['Payment Terms'] || '',
    ownerName: values['Sales Person'] || 'Praveen Admin',
    notes: JSON.stringify({
      ...values,
      'Quote#': values['Quote#'] || values['Proforma#'],
      'Quote Date': values['Quote Date'] || values['Proforma Date'],
      invoiceType,
      projectId,
      projectName: values['Project Name'] || '',
      projectCode: values['Project Code'] || '',
      projectCustomer: values['Project Customer'] || customer,
      projectCurrency: values['Project Currency'] || values.Currency || '',
      Subject: subject,
      'Place Of Supply': placeOfSupply,
      'Company Country': companyCountry,
      'Company State': companyState,
      'Company GSTIN': companyGstin,
      'Customer ID': customerId,
      'Source Invoice ID': sourceInvoiceId,
      'Source Invoice Customer ID': sourceInvoiceCustomerId,
      convertedFromId: sourceInvoiceId,
      customerCountry,
      customerBillingState,
      items,
      totals,
      taxMode: totals.taxMode,
    }),
  };
}

function collectFieldValues(scope) {
  const selector = scope === 'sales' ? '[data-sales-field]' : '[data-purchase-field]';
  const values = {};
  document.querySelectorAll(selector).forEach((field) => {
    const key = field.getAttribute(scope === 'sales' ? 'data-sales-field' : 'data-purchase-field');
    if (!key || key === 'field') return;
    const value = field.type === 'checkbox' ? field.checked : field.value;
    if (value !== undefined && value !== '' && values[key] === undefined) values[key] = value;
  });
  return values;
}

function parseMoney(value) {
  return Number(String(value || '0').replace(/[^\d.]/g, '')) || 0;
}

function normalizeInputDate(value, offsetDays = 0) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

function defaultSalesStatus(type) {
  if (type === 'customers') return 'Active';
  if (type === 'quotes') return 'Open';
  if (type === 'orders') return 'Confirmed';
  if (type === 'invoices') return 'Due Soon';
  if (type === 'creditNotes') return 'Unused';
  if (type === 'payments') return 'Deposited';
  if (type === 'challans') return 'Delivered';
  return 'Active';
}
