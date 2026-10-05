import {
  ArrowDownToLine,
  CalendarDays,
  ChevronDown,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Filter,
  ListFilter,
  MoreVertical,
  Package,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  ShoppingCart,
  TimerReset,
  Truck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../../api/dashboardApi.js';
import { recordsApi } from '../../api/recordsApi.js';
import { itemCategoriesApi } from '../../api/itemCategoriesApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { currentFinancialYearRange, OverviewDateFilter } from '../../components/OverviewDateFilter.jsx';
import { RecordCrudForm } from '../../components/RecordCrudForm.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate, recordToPurchaseRow } from '../../utils/records.js';

const PurchaseFormValuesContext = createContext({});
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const vendors = [
  ['AS', 'ABC Supplies Pvt. Ltd.', 'Bangalore, India', '+91 98765 43210', 'info@abcsupplies.com', 'Suppliers', '₹85,250.00', 'Active'],
  ['GS', 'Global Solutions', 'Mumbai, India', '+91 91234 56789', 'contact@globalsol.com', 'IT Services', '₹0.00', 'Active'],
  ['MP', 'MP Power Corp.', 'Delhi, India', '+91 93456 78901', 'accounts@mppower.com', 'Utilities', '₹15,600.00', 'Active'],
  ['OM', 'Office Mart', 'Pune, India', '+91 99887 66554', 'sales@officemart.com', 'Suppliers', '₹7,800.00', 'Active'],
  ['TI', 'Techno Industries', 'Chennai, India', '+91 90123 45678', 'billing@techno.com', 'Manufacturers', '₹0.00', 'Active'],
  ['BC', 'Bharti Computers', 'Hyderabad, India', '+91 98765 11223', 'info@bharticomp.com', 'IT Services', '₹4,250.00', 'Inactive'],
  ['SG', 'Sharma & Gupta Co.', 'Kolkata, India', '+91 97531 24680', 'sharma.gupta@gmail.com', 'Consultants', '₹12,450.00', 'Active'],
  ['SP', 'Sai Packaging', 'Jaipur, India', '+91 90909 90909', 'orders@saipack.com', 'Suppliers', '₹0.00', 'Active'],
  ['YW', 'Yash Warehouse', 'Noida, India', '+91 88888 77777', 'warehouse@yash.com', 'Logistics', '₹3,600.00', 'Active'],
  ['RH', 'R K Hardware', 'Indore, India', '+91 77770 12345', 'rkhardware@gmail.com', 'Suppliers', '₹1,250.00', 'Inactive'],
];

const vendorRows = vendors.map((vendor, index) => ({
  initials: vendor[0],
  name: vendor[1],
  city: vendor[2],
  amount: ['₹2,45,000.00', '₹85,600.00', '₹1,15,000.00', '₹32,500.00', '₹4,75,000.00', '₹68,900.00', '₹28,750.00', '₹96,400.00', '₹1,85,600.00', '₹41,250.00'][index],
  date: ['30 May 2024', '29 May 2024', '28 May 2024', '27 May 2024', '25 May 2024', '24 May 2024', '23 May 2024', '22 May 2024', '21 May 2024', '20 May 2024'][index],
  person: ['Arun Kumar', 'Priya Sharma', 'Nisha Verma', 'Rohit Singh', 'Arun Kumar', 'Priya Sharma', 'Nisha Verma', 'Rohit Singh', 'Arun Kumar', 'Priya Sharma'][index],
}));

const itemRows = [
  ['L’Oréal Shampoo 200ml', 'Hair Care', 'SHMP-200', 'Hair Care', 'Pcs', '₹250.00', '32', 'In Stock', '24 May 2024'],
  ['VLCC Face Wash 150ml', 'Skin Care', 'FW-150', 'Skin Care', 'Pcs', '₹180.00', '18', 'Low Stock', '22 May 2024'],
  ['Parachute Hair Oil 300ml', 'Hair Care', 'OIL-300', 'Hair Care', 'Pcs', '₹160.00', '0', 'Out of Stock', '20 May 2024'],
  ['Nivea Moisturizer 100ml', 'Skin Care', 'NIV-100', 'Skin Care', 'Pcs', '₹120.00', '25', 'In Stock', '18 May 2024'],
  ['Salon Towel (Large)', 'Accessories', 'TWL-L', 'Accessories', 'Pcs', '₹300.00', '45', 'In Stock', '18 May 2024'],
  ['Professional Comb', 'Accessories', 'COMB-PR', 'Accessories', 'Pcs', '₹85.00', '12', 'Low Stock', '17 May 2024'],
  ['Streax Hair Color (Brown)', 'Hair Color', 'HC-BRN', 'Hair Color', 'Pcs', '₹210.00', '30', 'In Stock', '16 May 2024'],
  ['Aluminium Foil Roll', 'Accessories', 'AF-RL', 'Accessories', 'Roll', '₹150.00', '4', 'Low Stock', '15 May 2024'],
  ['Dettol Disinfectant 500ml', 'Sanitizer', 'DET-500', 'Sanitizer', 'Pcs', '₹180.00', '0', 'Out of Stock', '14 May 2024'],
  ['Disposable Gloves (Pair)', 'Accessories', 'GLV-PR', 'Accessories', 'Pair', '₹15.00', '60', 'In Stock', '13 May 2024'],
];

const purchaseConfigs = {
  bills: {
    title: 'Bills',
    subtitle: 'Track and manage all your vendor bills',
    search: 'Search bills by vendor, bill number...',
    primaryAction: 'New Bill',
    totalLabel: '12 entries',
    cards: [
      ['Total Bills', '₹14,25,000', '12 Bills', ReceiptText, 'red'],
      ['Due Bills', '₹6,75,000', '5 Bills', FileText, 'orange'],
      ['Paid Bills', '₹7,50,000', '7 Bills', ReceiptText, 'green'],
      ['Overdue Bills', '₹1,25,000', '2 Bills', Clock3, 'red'],
    ],
    columns: ['Bill No.', 'Vendor', 'Bill Date', 'Due Date', 'Amount', 'Status', 'Payment Terms'],
    rows: vendorRows.map((row, index) => [`BILL-0004${5 - index}`, row.name, row.date.replace('May', 'Apr'), row.date.replace('May', 'Apr'), ['₹12,500.00', '₹85,000.00', '₹65,000.00', '₹45,000.00', '₹30,000.00', '₹55,000.00', '₹18,750.00', '₹8,000.00', '₹22,500.00', '₹32,250.00'][index], ['Paid', 'Due', 'Overdue', 'Partial', 'Paid', 'Paid', 'Due', 'Paid', 'Overdue', 'Due'][index], ['Net 30', 'Net 30', 'Net 30', 'Net 30', 'Net 30', 'Net 30', 'Net 15', 'Net 30', 'Net 30', 'Net 30'][index], row.initials, row.city]),
  },
  expenses: {
    title: 'Expenses',
    subtitle: 'Track and manage all your business expenses',
    search: 'Search expenses by title, vendor, category...',
    primaryAction: 'Add Expense',
    totalLabel: '24 entries',
    cards: [
      ['Total Expenses', '₹4,85,250.00', '12.5% vs last month', WalletCards, 'red'],
      ['This Month', '₹4,85,250.00', 'May 2024', ReceiptText, 'orange'],
      ['This Year (YTD)', '₹48,65,000.00', '8.3% vs last year', ReceiptText, 'green'],
      ['This Month Budget', '₹6,00,000.00', 'Budget: ₹6,00,000', FileText, 'blue'],
    ],
    columns: ['Date', 'Expense Title', 'Category', 'Vendor', 'Payment Method', 'Amount', 'Status', 'Attachment'],
    rows: [
      ['30 May 2024', 'Office Rent', 'Rent', 'ABC Properties', 'Bank Transfer', '₹75,000.00', 'Paid', 'File'],
      ['29 May 2024', 'Electricity Bill', 'Utilities', 'MP Power Corp.', 'UPI', '₹8,450.00', 'Paid', 'File'],
      ['28 May 2024', 'Staff Salary', 'Salary', '-', 'Bank Transfer', '₹1,50,000.00', 'Paid', 'File'],
      ['27 May 2024', 'Office Supplies', 'Office Supplies', 'Office Mart', 'Card', '₹4,250.00', 'Paid', 'File'],
      ['25 May 2024', 'Internet Bill', 'Utilities', 'Airtel Business', 'UPI', '₹2,999.00', 'Paid', 'File'],
      ['24 May 2024', 'Marketing Campaign', 'Marketing', 'Digital Ads Co.', 'Card', '₹12,500.00', 'Pending', 'File'],
      ['22 May 2024', 'Vehicle Fuel', 'Transportation', 'IndianOil', 'Cash', '₹3,200.00', 'Paid', 'File'],
      ['20 May 2024', 'Software Subscription', 'Software', 'Zoho Corp.', 'Card', '₹2,400.00', 'Paid', 'File'],
      ['18 May 2024', 'Business Lunch', 'Meals', 'Hotel Grand', 'Cash', '₹1,850.00', 'Paid', 'File'],
      ['16 May 2024', 'Repair & Maintenance', 'Maintenance', 'Quick Fixers', 'Bank Transfer', '₹6,200.00', 'Paid', 'File'],
    ],
  },
  orders: {
    title: 'Purchase Orders',
    subtitle: 'View and manage all your purchase orders',
    search: 'Search by PO #, vendor, status...',
    primaryAction: 'New Purchase Order',
    totalLabel: '128 purchase orders',
    cards: [
      ['Total Orders', '128', 'All Time', ReceiptText, 'blue'],
      ['This Month', '₹18,45,600.00', '22 Orders', ReceiptText, 'green'],
      ['This Year', '₹1,56,78,900.00', '128 Orders', ShoppingBag, 'purple'],
      ['Pending', '₹9,76,400.00', '18 Orders', Clock3, 'orange'],
      ['Received', '₹1,32,02,500.00', '96 Orders', Truck, 'green'],
    ],
    columns: ['PO #', 'Vendor', 'PO Date', 'Expected Date', 'Amount (₹)', 'Status', 'Receipt Status', 'Created By'],
    rows: vendorRows.map((row, index) => [`PO-00012${8 - index}`, row.name, row.date, `${String(6 - Math.min(index, 5)).padStart(2, '0')} Jun 2024`, row.amount, ['Pending', 'Approved', 'Approved', 'Pending', 'Approved', 'Approved', 'Pending', 'Cancelled', 'Approved', 'Draft'][index], ['Pending', 'Partial', 'Received', 'Pending', 'Received', 'Received', 'Pending', 'Cancelled', 'Partial', 'Pending'][index], row.person, row.initials, row.city]),
  },
  vendors: {
    title: 'Vendors',
    subtitle: 'Manage your vendors and track their transactions',
    search: 'Search vendors by name, email, phone...',
    primaryAction: 'Add Vendor',
    totalLabel: '126 entries',
    cards: [
      ['Total Vendors', '126', 'All time', UsersRound, 'red'],
      ['Active Vendors', '98', 'Currently working', ReceiptText, 'orange'],
      ['Total Payable', '₹12,45,300.00', 'Across all vendors', WalletCards, 'green'],
      ['Overdue Payable', '₹2,35,600.00', 'From 18 vendors', TimerReset, 'purple'],
    ],
    columns: ['Vendor Name', 'Phone', 'Email', 'Group', 'Payment Terms', 'Outstanding', 'Status'],
    rows: vendors.map((row, index) => [row[1], row[3], row[4], row[5], ['Net 30', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 30', 'Net 15', 'Net 30', 'Net 30', 'Net 15'][index], row[6], row[7], row[0], row[2]]),
  },
  items: {
    title: 'Items',
    subtitle: 'Manage your inventory items and services',
    search: 'Search items by name, SKU or barcode...',
    primaryAction: 'Add Item',
    totalLabel: '156 items',
    cards: [
      ['Total Items', '156', 'All Items', Package, 'purple'],
      ['Active Items', '142', 'Currently Active', PackageCheck, 'green'],
      ['Low Stock Items', '8', 'Need Attention', TimerReset, 'orange'],
      ['Out of Stock', '6', 'Unavailable', Clock3, 'red'],
      ['Total Value (Stock)', '₹2,45,780.00', 'Current Stock Value', Package, 'blue'],
    ],
    columns: ['Item Name', 'SKU / Barcode', 'Category', 'Unit', 'Selling Price', 'Stock', 'Status', 'Last Updated'],
    rows: itemRows.map((row) => [row[0], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[1], '']),
  },
};

const purchaseNewRoutes = {
  bills: '/purchases/bills/new',
  expenses: '/purchases/expenses/new',
  orders: '/purchases/orders/new',
  vendors: '/purchases/vendors/new',
  items: '/purchases/items/new',
};

const purchaseEditRoutes = {
  bills: (id) => `/purchases/bills/${id}/edit`,
  expenses: (id) => `/purchases/expenses/${id}/edit`,
  orders: (id) => `/purchases/orders/${id}/edit`,
  vendors: (id) => `/purchases/vendors/${id}/edit`,
  items: (id) => `/purchases/items/${id}/edit`,
};

const purchaseFormConfigs = {
  bill: {
    title: 'Create Bill',
    subtitle: 'Add bill details and track your expenses',
    backLabel: 'Bills',
    backTo: '/purchases/bills',
    activeType: 'bills',
    summaryTitle: 'Bill Summary',
    primary: 'Review & Save',
  },
  expense: {
    title: 'Create Expense',
    subtitle: 'Add expense details and track your business spending',
    backLabel: 'Expenses',
    backTo: '/purchases/expenses',
    activeType: 'expenses',
    summaryTitle: 'Expense Summary',
    primary: 'Next: Review & Save',
  },
  order: {
    title: 'Create Purchase',
    subtitle: 'Add purchase details and track your expenses',
    backLabel: 'Purchase Orders',
    backTo: '/purchases/orders',
    activeType: 'orders',
    summaryTitle: 'Purchase Summary',
    primary: 'Next: Review & Save',
  },
  vendor: {
    title: 'Add Vendor',
    subtitle: 'Add vendor details to manage your business transactions',
    backLabel: 'Vendors',
    backTo: '/purchases/vendors',
    activeType: 'vendors',
    summaryTitle: 'Vendor Summary',
    primary: 'Save & Continue',
  },
  item: {
    title: 'Add Item',
    subtitle: 'Add a new item to your inventory',
    backLabel: 'Resources',
    backTo: '/purchases/items',
    activeType: 'items',
    summaryTitle: 'Item Preview',
    primary: 'Save Item',
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
  Paid: 'bg-emerald-50 text-emerald-700',
  Due: 'bg-orange-50 text-orange-700',
  Overdue: 'bg-red-50 text-red-700',
  Partial: 'bg-blue-50 text-blue-700',
  Pending: 'bg-orange-50 text-orange-700',
  Approved: 'bg-emerald-50 text-emerald-700',
  Received: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
  Draft: 'bg-slate-100 text-slate-700',
  'In Stock': 'bg-emerald-50 text-emerald-700',
  'Low Stock': 'bg-orange-50 text-orange-700',
  'Out of Stock': 'bg-red-50 text-red-700',
  Rent: 'bg-pink-50 text-pink-700',
  Utilities: 'bg-orange-50 text-orange-700',
  Salary: 'bg-blue-50 text-blue-700',
  'Office Supplies': 'bg-violet-50 text-violet-700',
  Marketing: 'bg-emerald-50 text-emerald-700',
  Transportation: 'bg-cyan-50 text-cyan-700',
  Software: 'bg-blue-50 text-blue-700',
  Meals: 'bg-pink-50 text-pink-700',
  Maintenance: 'bg-red-50 text-red-700',
};

function ActionButton({ children, primary = false, icon: Icon }) {
  return (
    <button className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold shadow-sm ${
      primary ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-900'
    }`}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
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

function StatCard({ card }) {
  const [label, value, helper, Icon, color] = card;

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="min-h-8 text-[12px] font-bold leading-4 text-[#06134a]">{label}</p>
          <p className="mt-1 break-words text-[20px] font-black leading-tight text-[#06134a]">{value}</p>
          <p className={`mt-1 text-[11px] leading-4 ${helper.includes('vs') ? 'text-slate-500' : 'text-[#17275a]'}`}>
            {helper.includes('vs') && <span className={helper.includes('12.5') ? 'font-bold text-red-600' : 'font-bold text-emerald-600'}>{helper.split(' ')[0]} </span>}
            {helper.includes('vs') ? helper.replace(helper.split(' ')[0], '') : helper}
          </p>
        </div>
      </div>
    </article>
  );
}

function StatGrid({ cards }) {
  const gridClass = cards.length === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';
  return <div className={`grid gap-3 ${gridClass}`}>{cards.map((card) => <StatCard key={card[0]} card={card} />)}</div>;
}

function FilterBar({
  search,
  vendorLabel = 'All Vendors',
  statusLabel = 'All Status',
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
    <div className="grid gap-4 xl:grid-cols-[1.5fr_0.75fr_0.75fr_0.75fr_auto_auto]">
      <label className="relative">
        <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 pr-12 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder={search} />
      </label>
      <select value={categoryValue} onChange={(event) => onCategoryChange?.(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none">
        <option value="">{vendorLabel}</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      <select value={statusValue} onChange={(event) => onStatusChange?.(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none">
        <option value="">{statusLabel}</option>
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
      <button className="grid h-11 w-12 place-items-center rounded-lg border border-slate-200 bg-white text-slate-800"><ListFilter className="h-5 w-5" /></button>
    </div>
  );
}

function Badge({ value }) {
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${badgeClasses[value] || 'bg-slate-100 text-slate-700'}`}>{value}</span>;
}

function DataTable({ columns, rows, type, onDelete }) {
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
          <tbody className="divide-y divide-slate-100 text-[#06134a]">
            {rows.map((row, rowIndex) => <DataRow key={`${row[0]}-${rowIndex}`} row={row} type={type} onDelete={onDelete} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataRow({ row, type, onDelete }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const rowId = typeof row[row.length - 1] === 'number' ? row[row.length - 1] : null;
  const rowData = rowId ? row.slice(0, -1) : row;
  const hasMeta = type !== 'expenses';
  const meta1 = hasMeta ? rowData[rowData.length - 2] : '';
  const meta2 = hasMeta ? rowData[rowData.length - 1] : '';
  const visible = hasMeta ? rowData.slice(0, -2) : rowData;

  return (
    <tr className="hover:bg-slate-50/80">
      <td className="px-4 py-4"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" /></td>
      {visible.map((cell, index) => {
        const nameColumn = (type === 'vendors' && index === 0) || (type !== 'vendors' && type !== 'items' && (index === 1 || (type === 'orders' && index === 1)));
        const itemName = type === 'items' && index === 0;
        const isBadge = badgeClasses[cell];
        const isId = String(cell).match(/^(PO|BILL)-/);
        const isAmount = String(cell).startsWith('₹');
        const isAttachment = type === 'expenses' && index === 7;

        return (
          <td key={`${cell}-${index}`} className="whitespace-nowrap px-4 py-4">
            {nameColumn ? (
              <div className="flex items-center gap-3">
                {type === 'vendors' && <span className="grid h-9 w-9 place-items-center rounded-full bg-red-50 text-sm font-bold text-red-700">{meta1}</span>}
                <div><p className="font-bold">{cell}</p><p className="mt-1 text-xs text-slate-600">{meta2}</p></div>
              </div>
            ) : itemName ? (
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-500"><Package className="h-5 w-5" /></span>
                <div><p className="font-bold">{cell}</p><p className="mt-1 text-xs text-slate-600">{meta1}</p></div>
              </div>
            ) : isBadge ? (
              <Badge value={cell} />
            ) : isAttachment ? (
              <span className="inline-flex items-center gap-2 font-semibold text-blue-600">
                <FileText className="h-4 w-4" />
                {cell}
              </span>
            ) : (
              <span className={`${isId ? 'font-bold text-blue-600' : isAmount ? 'font-black' : 'font-semibold'} ${isAmount && cell !== '₹0.00' && type === 'vendors' ? 'text-red-600' : ''}`}>{cell}</span>
            )}
          </td>
        );
      })}
      <td className="px-4 py-4">
        <div className="flex gap-2">
          {type === 'bills' && <button className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white"><Eye className="h-4 w-4" /></button>}
          <div className="relative">
            <button
              disabled={!rowId}
              onClick={() => rowId && setMenuOpen((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white disabled:cursor-not-allowed disabled:opacity-40"
              title={rowId ? 'Actions' : 'Static sample row'}
            ><MoreVertical className="h-4 w-4" /></button>
            {menuOpen && rowId && (
              <div className="absolute right-0 top-10 z-20 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl">
                <button onClick={() => navigate(purchaseEditRoutes[type](rowId))} className="block w-full px-4 py-2 text-left font-bold hover:bg-slate-50">View</button>
                <button onClick={() => navigate(purchaseEditRoutes[type](rowId))} className="block w-full px-4 py-2 text-left font-bold hover:bg-slate-50">Edit</button>
                <button onClick={() => { setMenuOpen(false); onDelete?.(rowId); }} className="block w-full px-4 py-2 text-left font-bold text-red-600 hover:bg-red-50">Delete</button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function Pagination({ totalLabel, red = false, page = 0, totalPages = 1, onPageChange, totalElements = 0, pageSize = 10, currentCount = 0, onPageSizeChange }) {
  const current = page + 1;
  const start = totalElements ? page * pageSize + 1 : 0;
  const end = totalElements ? Math.min(page * pageSize + currentCount, totalElements) : 0;
  const canPrevious = page > 0;
  const canNext = page + 1 < totalPages;
  return (
    <div className="flex flex-col gap-4 py-4 text-sm md:flex-row md:items-center md:justify-between">
      <p className="font-semibold text-[#06134a]">Showing {start} to {end} of {totalLabel}</p>
      <div className="flex items-center gap-3">
        <select value={pageSize} onChange={(event) => onPageSizeChange?.(Number(event.target.value))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none">
          {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / page</option>)}
        </select>
        <button disabled={!canPrevious} onClick={() => onPageChange?.(Math.max(0, page - 1))} className="grid h-10 min-w-10 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:opacity-45">‹</button>
        {[1, 2, 3].filter((item) => item <= totalPages).map((item) => (
          <button key={item} onClick={() => onPageChange?.(item - 1)} className={`grid h-10 min-w-10 place-items-center rounded-lg border px-3 text-sm font-bold ${item === current ? `${red ? 'border-red-600 bg-red-600' : 'border-blue-600 bg-blue-600'} text-white` : 'border-slate-200 bg-white text-slate-800'}`}>{item}</button>
        ))}
        {totalPages > 3 && <span className="font-bold text-slate-400">...</span>}
        {totalPages > 3 && <button onClick={() => onPageChange?.(totalPages - 1)} className="grid h-10 min-w-10 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">{totalPages}</button>}
        <button disabled={!canNext} onClick={() => onPageChange?.(Math.min(totalPages - 1, page + 1))} className="grid h-10 min-w-10 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:opacity-45">›</button>
      </div>
    </div>
  );
}

export function PurchaseListPage({ type }) {
  const config = purchaseConfigs[type];
  const location = useLocation();
  const isRedAction = type === 'vendors' || type === 'bills' || type === 'expenses';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const dateRange = useMemo(() => dateRangeFromPreset(datePreset), [datePreset]);
  const queryParams = { module: 'purchases', type, page, size: pageSize, search, status, category, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo, sort: 'recordDate,desc' };
  const listQuery = useQuery({
    queryKey: ['records', queryParams],
    queryFn: () => recordsApi.list(queryParams),
    keepPreviousData: true,
  });
  const summaryQuery = useQuery({
    queryKey: ['records-summary', 'purchases', type, search, status, category, datePreset],
    queryFn: () => recordsApi.summary({ module: 'purchases', type, search, status, category, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }),
  });
  const itemCategoriesQuery = useQuery({
    queryKey: ['item-category-master', 'active'],
    queryFn: () => itemCategoriesApi.list(false),
    enabled: type === 'items',
    staleTime: 60_000,
  });
  const rows = useMemo(() => listQuery.data?.content?.map((record) => recordToPurchaseRow(record, type)) ?? [], [listQuery.data, type]);
  const totalElements = listQuery.data?.totalElements ?? rows.length;
  const totalPages = listQuery.data?.totalPages || 1;
  const totalLabel = `${totalElements} ${config.totalLabel.replace(/^\d+\s*/, '')}`;
  const cards = useMemo(() => buildPurchaseCards(config.cards, summaryQuery.data), [config.cards, summaryQuery.data]);
  const statuses = useMemo(() => Object.keys(summaryQuery.data?.statusCounts || badgeClasses), [summaryQuery.data]);
  const categories = useMemo(() => type === 'items'
    ? (itemCategoriesQuery.data || []).map((item) => item.categoryName)
    : purchaseCategoryOptions(type), [type, itemCategoriesQuery.data]);
  const hasFilters = Boolean(search || status || category || datePreset);
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id) => recordsApi.remove({ module: 'purchases', type, id }),
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
          <ActionButton icon={ArrowDownToLine}>{type === 'items' ? 'Import Items' : type === 'bills' ? 'Import Bills' : type === 'vendors' ? 'Import Vendors' : 'Import'}</ActionButton>
          {type !== 'bills' && <ActionButton icon={ArrowDownToLine}>Export</ActionButton>}
          <Link to={purchaseNewRoutes[type]} className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold text-white shadow-sm ${isRedAction ? 'bg-red-600' : 'bg-blue-600'}`}>
            <Plus className="h-4 w-4" /> {config.primaryAction}
          </Link>
        </div>
      </div>

      <StatGrid cards={cards} />
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
          setPage(0);
        }}
        vendorLabel={type === 'items' || type === 'expenses' ? 'All Categories' : type === 'vendors' ? 'All Groups' : 'All Categories'}
        statusLabel={type === 'expenses' ? 'All Payment Methods' : type === 'items' ? 'All Status' : 'All Status'}
      />
      {listQuery.isLoading && <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-bold text-[#06134a]">Loading {config.title.toLowerCase()}...</div>}
      {listQuery.isError && <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-700">Purchase data could not be loaded from the backend. Check the application logs and try again.</div>}
      {deleteMutation.isError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">Delete failed. Please try again.</div>}
      <DataTable columns={config.columns} rows={rows} type={type} onDelete={deleteRecord} />
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
        red={isRedAction || type === 'items'}
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

function purchaseCategoryOptions(type) {
  if (type === 'vendors') return ['Suppliers', 'Manufacturers', 'IT Services', 'Consultants', 'Logistics', 'General'];
  if (type === 'items') return ['Hair Care', 'Skin Care', 'Accessories', 'Hair Color', 'Sanitizer', 'General'];
  if (type === 'expenses') return ['Rent', 'Utilities', 'Salary', 'Office Supplies', 'Marketing', 'Transportation', 'General'];
  if (type === 'bills' || type === 'orders') return ['Suppliers', 'Raw Materials', 'Office Supplies', 'Machinery', 'Utilities', 'General'];
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

function buildPurchaseCards(baseCards, summary) {
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

function TrendChart({ current = [], previous = [] }) {
  const currentValues = current.map((entry) => Number(entry.total || 0));
  const previousValues = previous.map((entry) => Number(entry.total || 0));
  const max = Math.max(1, ...currentValues, ...previousValues);
  const points = (series) => series.map((value, index) => `${18 + (index / Math.max(1, series.length - 1)) * 332},${180 - (value / max) * 145}`).join(' ');
  return (
    <svg className="h-[250px] w-full" viewBox="0 0 370 210" preserveAspectRatio="none">
      {[40, 80, 120, 160].map((y) => <line key={y} x1="18" x2="350" y1={y} y2={y} stroke="#e8edf5" />)}
      {currentValues.length > 0 && <polygon points={`18,180 ${points(currentValues)} 350,180`} fill="#ef4444" opacity="0.12" />}
      <polyline points={points(currentValues)} fill="none" stroke="#ef4444" strokeWidth="2.4" />
      <polyline points={points(previousValues)} fill="none" stroke="#94a3b8" strokeWidth="2" />
    </svg>
  );
}

export function PurchaseOverviewPage() {
  const [dateRange, setDateRange] = useState(currentFinancialYearRange);
  const overviewQuery = useQuery({
    queryKey: ['purchase-overview', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () => dashboardApi.purchaseOverview(dateRange),
  });
  const overview = overviewQuery.data;
  const topVendors = overview?.topVendors || [];
  const categories = overview?.purchaseByCategory || [];
  const categoryColors = ['#0b84f3', '#16a34a', '#a855f7', '#f97316', '#94a3b8'];
  const categoryTotal = categories.reduce((sum, item) => sum + Number(item.total || 0), 0);
  let categoryCursor = 0;
  const categoryGradient = categoryTotal > 0 ? `conic-gradient(${categories.map((item, index) => {
    const next = categoryCursor + (Number(item.total || 0) / categoryTotal) * 100;
    const stop = `${categoryColors[index % categoryColors.length]} ${categoryCursor}% ${next}%`;
    categoryCursor = next;
    return stop;
  }).join(', ')})` : '#e2e8f0';
  const cards = [
    ['Total Purchase', formatCurrency(Number(overview?.totalPurchases || 0)), `${overview?.totalPurchaseOrders || 0} purchase orders`, ShoppingCart, 'red'],
    ['Total Bills', formatCurrency(Number(overview?.totalBills || 0)), `${overview?.totalBillCount || 0} bills`, ReceiptText, 'red'],
    ['Total Expenses', formatCurrency(Number(overview?.totalExpenses || 0)), `${overview?.totalExpenseCount || 0} expenses`, WalletCards, 'red'],
    ['Total Vendors', String(overview?.totalVendors || 0), `${overview?.newVendors || 0} added in period`, UsersRound, 'green'],
    ['Pending Bills', formatCurrency(Number(overview?.pendingBillAmount || 0)), `${overview?.pendingBillCount || 0} bills`, TimerReset, 'orange'],
  ];

  return (
    <section className="space-y-6">
      {overviewQuery.isError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">Purchase overview could not be loaded. Please verify the backend connection.</div>}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#06134a]">Purchase Overview</h1>
          <p className="mt-2 text-base font-semibold text-[#06134a]">Track and manage all your purchase activities</p>
        </div>
        <OverviewDateFilter value={dateRange} onChange={setDateRange} onRefresh={() => overviewQuery.refetch()} loading={overviewQuery.isFetching} />
      </div>

      <StatGrid cards={cards} />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.85fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[#06134a]">Purchase Trend</h2><span className="text-xs font-bold text-slate-500">Selected period</span></div>
          <div className="mt-4 flex justify-center gap-10 text-xs font-semibold"><span className="text-red-600">● This Fiscal Year</span><span className="text-slate-500">● Last Fiscal Year</span></div>
          <TrendChart current={overview?.currentTrend} previous={overview?.previousTrend} />
          <div className="grid grid-cols-12 text-center text-xs text-slate-500">{(overview?.currentTrend || []).map((entry) => <span key={entry.month}>{entry.month}</span>)}</div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[#06134a]">Top Vendors</h2><Link to="/purchases/vendors" className="text-sm font-bold text-red-600">View All</Link></div>
          <div className="mt-5 divide-y divide-slate-100">
            {topVendors.map((row) => (
              <div key={row.name} className="flex items-center gap-3 py-4">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-red-50 text-sm font-bold text-red-700">{row.name?.split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase()}</span>
                <span className="flex-1 font-bold">{row.name}</span>
                <span className="font-black">{formatCurrency(Number(row.total || 0))}</span>
              </div>
            ))}
            {topVendors.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No vendor purchases in this period.</p>}
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[#06134a]">Recent Purchase Bills</h2><Link to="/purchases/bills" className="text-sm font-bold text-red-600">View All</Link></div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr>{['Bill No.', 'Vendor', 'Date', 'Due Date', 'Amount', 'Status'].map((item) => <th key={item} className="py-3 font-bold">{item}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(overview?.recentBills || []).map((row) => (
                  <tr key={row.id}><td className="py-4 font-bold"><Link to={`/purchases/bills/${row.id}`} className="text-blue-600">{row.number}</Link></td><td className="font-semibold">{row.partyName}</td><td>{formatDate(row.documentDate)}</td><td>{formatDate(row.dueDate)}</td><td className="font-bold">{formatCurrency(Number(row.amount || 0))}</td><td><Badge value={row.status} /></td></tr>
                ))}
              </tbody>
            </table>
            {(overview?.recentBills || []).length === 0 && <p className="py-8 text-center text-sm text-slate-500">No bills in this period.</p>}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#06134a]">Purchase by Category</h2>
          <div className="mt-8 flex items-center justify-center gap-10">
            <div className="grid h-48 w-48 place-items-center rounded-full" style={{ background: categoryGradient }}>
              <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center"><b>{formatCurrency(categoryTotal)}</b><span className="text-xs">Total</span></div>
            </div>
            <div className="space-y-5 text-sm font-bold">
              {categories.map((item, index) => <p key={item.label}><span style={{ color: categoryColors[index % categoryColors.length] }}>●</span> {item.label} {categoryTotal ? ((Number(item.total || 0) / categoryTotal) * 100).toFixed(1) : '0.0'}%</p>)}
              {categories.length === 0 && <p className="text-slate-500">No purchases in this period.</p>}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function PurchaseFormHeader({ config, steps = ['Details', 'Items', 'Review & Save'] }) {
  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <Link to={config.backTo} className="text-sm font-black text-[#06134a]">‹ {config.backLabel}</Link>
        <h1 className="mt-4 text-3xl font-black text-[#06134a]">{config.title}</h1>
        <p className="mt-2 text-base font-semibold text-[#06134a]">{config.subtitle}</p>
      </div>
      <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center">
        <StepBar steps={steps} />
        <div className="flex gap-3">
          <Link to={config.backTo} className="grid h-11 place-items-center rounded-lg border border-slate-200 bg-white px-6 text-sm font-bold text-[#06134a]">Cancel</Link>
          <button
            type="button"
            onClick={() => document.dispatchEvent(new CustomEvent('purchase-form-save', { detail: { draft: false } }))}
            className="flex h-11 items-center gap-2 rounded-lg bg-red-600 px-6 text-sm font-bold text-white shadow-sm"
          >
            {config.primary} <span className="text-lg">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function StepBar({ steps }) {
  return (
    <div className="hidden items-center gap-3 text-sm font-bold text-[#06134a] xl:flex">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-3">
          <span className={`grid h-8 w-8 place-items-center rounded-full border ${index === 0 ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 bg-white text-[#06134a]'}`}>{index + 1}</span>
          <span className={index === 0 ? 'text-red-600' : ''}>{step}</span>
          {index < steps.length - 1 && <span className="h-px w-16 bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

function FormCard({ title, icon: Icon = ReceiptText, children, className = '' }) {
  return (
    <article className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-5 flex items-center gap-3 text-lg font-black text-[#06134a]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-red-50 text-red-600"><Icon className="h-4 w-4" /></span>
        {title}
      </h2>
      {children}
    </article>
  );
}

function Field({ label, placeholder, required = false, select = false, value = '', prefix = '', onChange, options: suppliedOptions }) {
  const savedValues = useContext(PurchaseFormValuesContext);
  const fieldKey = label || placeholder || 'field';
  const text = `${label || ''} ${placeholder || ''}`.toLowerCase();
  const shouldLoadVendors = select && (text.includes('vendor') || text.includes('supplier'));
  const shouldLoadItems = select && text.includes('item');
  const vendorsQuery = useQuery({
    queryKey: ['records', 'purchases', 'vendors', 'active-options'],
    queryFn: () => recordsApi.list({ module: 'purchases', type: 'vendors', page: 0, size: 200, status: 'Active', sort: 'partyName,asc' }),
    enabled: shouldLoadVendors,
    staleTime: 60_000,
  });
  const itemsQuery = useQuery({
    queryKey: ['records', 'purchases', 'items', 'active-options'],
    queryFn: () => recordsApi.list({ module: 'purchases', type: 'items', page: 0, size: 200, sort: 'partyName,asc' }),
    enabled: shouldLoadItems,
    staleTime: 60_000,
  });
  const liveVendors = vendorsQuery.data?.content?.map((record) => record.partyName).filter(Boolean) || [];
  const liveItems = itemsQuery.data?.content?.map((record) => record.partyName).filter(Boolean) || [];
  const options = select ? (suppliedOptions || purchaseMasterOptions(label, placeholder, liveVendors, liveItems)) : [];
  const savedValue = savedValues[fieldKey] ?? savedValues[label] ?? savedValues[placeholder];
  const generatedValue = onChange !== undefined
    ? value
    : (savedValue || value || (String(placeholder || '').toLowerCase().includes('auto') ? generatedPurchaseValue(label, placeholder) : ''));
  const inputType = String(label || '').toLowerCase().includes('date') ? 'date' : 'text';
  const displayValue = inputType === 'date' && generatedValue ? normalizePurchaseDate(generatedValue) : generatedValue;

  return (
    <label className="block min-w-0">
      {label && <span className="mb-2 block text-xs font-black text-[#06134a]">{label}{required && <b className="text-red-600"> *</b>}</span>}
      <span className="flex h-11 w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {prefix && <span className="grid min-w-11 place-items-center border-r border-slate-200 bg-slate-50 text-sm font-bold text-[#06134a]">{prefix}</span>}
        {select ? (
          <select data-purchase-field={fieldKey} {...(onChange ? { value: displayValue, onChange: (event) => onChange(event.target.value) } : { defaultValue: displayValue })} className="h-full min-w-0 flex-1 appearance-none px-3 text-sm font-semibold text-[#06134a] outline-none">
            <option value="">{vendorsQuery.isLoading || itemsQuery.isLoading ? 'Loading...' : placeholder || 'Select'}</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : (
          <input
            data-purchase-field={fieldKey}
            type={inputType}
            className="h-full min-w-0 flex-1 px-3 text-sm font-semibold text-[#06134a] outline-none placeholder:text-slate-400"
            {...(onChange ? { value: displayValue, onChange: (event) => onChange(event.target.value) } : { defaultValue: displayValue })}
            placeholder={placeholder}
          />
        )}
        {select && <span className="grid w-8 shrink-0 place-items-center text-[#06134a]"><ChevronDown className="h-4 w-4" /></span>}
      </span>
    </label>
  );
}

function purchaseMasterOptions(label = '', placeholder = '', liveVendors = [], liveItems = []) {
  const text = `${label} ${placeholder}`.toLowerCase();
  const vendorNames = vendors.map((row) => row[1]);
  const itemNames = itemRows.map((row) => row[0]);
  if (text.includes('vendor') || text.includes('supplier')) return liveVendors.length ? liveVendors : vendorNames;
  if (text.includes('item')) return liveItems.length ? liveItems : itemNames;
  if (text.includes('business type')) return ['Proprietorship', 'Partnership', 'Private Limited', 'Public Limited', 'LLP'];
  if (text.includes('vendor group')) return ['Suppliers', 'Manufacturers', 'IT Services', 'Consultants', 'Logistics'];
  if (text.includes('category')) return ['Rent', 'Utilities', 'Salary', 'Office Supplies', 'Marketing', 'Transportation', 'Hair Care', 'Skin Care', 'Accessories'];
  if (text.includes('payment terms')) return ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
  if (text.includes('payment method')) return ['Bank Transfer', 'UPI', 'Cheque', 'Card', 'Cash', 'NEFT'];
  if (text.includes('currency')) return ['INR - Indian Rupee', 'USD - US Dollar', 'AUD - Australian Dollar'];
  if (text.includes('state') || text.includes('place of supply')) return ['Madhya Pradesh (23)', 'Tamil Nadu (33)', 'Maharashtra (27)', 'Karnataka (29)', 'Delhi (07)'];
  if (text.includes('unit')) return ['Pcs', 'Nos', 'Kg', 'Ltr', 'Pair', 'Roll', 'Month'];
  if (text.includes('warehouse') || text.includes('location')) return ['Main Warehouse', 'Retail Store', 'Indore Warehouse', 'Chennai Warehouse'];
  if (text.includes('project')) return ['Default Project', 'Office Setup', 'Inventory Purchase'];
  if (text.includes('department')) return ['Accounts', 'Sales', 'Operations', 'Administration'];
  if (text.includes('delivery method')) return ['Courier', 'Transport', 'Self Pickup', 'Hand Delivery'];
  if (text.includes('tax')) return ['GST 0%', 'GST 5%', 'GST 12%', 'GST 18%', 'GST 28%'];
  if (text.includes('address')) return ['Registered Office Address', 'Billing Address', 'Warehouse Address'];
  return ['Standard', 'Default', 'General'];
}

function generatedPurchaseValue(label = '', placeholder = '') {
  const text = `${label} ${placeholder}`.toLowerCase();
  const suffix = Date.now().toString().slice(-5);
  if (text.includes('bill')) return `BILL-${suffix}`;
  if (text.includes('purchase')) return `PO-${suffix}`;
  if (text.includes('sku')) return `SKU-${suffix}`;
  if (text.includes('barcode')) return `SKU-${suffix}`;
  return `AUTO-${suffix}`;
}

function TextArea({ label, placeholder, required = false, rows = 4 }) {
  const savedValues = useContext(PurchaseFormValuesContext);
  const fieldKey = label || placeholder || 'Notes';
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-[#06134a]">{label}{required && <b className="text-red-600"> *</b>}</span>
      <textarea
        data-purchase-field={fieldKey}
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none placeholder:text-slate-400"
        rows={rows}
        placeholder={placeholder}
        defaultValue={savedValues[fieldKey] || savedValues[label] || ''}
      />
      <span className="-mt-6 block pr-3 text-right text-xs font-bold text-slate-500">0 / 500</span>
    </label>
  );
}

function UploadBox({ compact = false }) {
  return (
    <div className={`grid place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50/40 text-center ${compact ? 'h-28' : 'h-36'}`}>
      <div>
        <ArrowDownToLine className="mx-auto h-8 w-8 text-[#06134a]" />
        <p className="mt-2 text-sm font-bold text-[#06134a]">Drag & drop files here or <span className="text-red-600">Browse</span></p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Supports: PDF, JPG, PNG (Max 10MB)</p>
      </div>
    </div>
  );
}

function FormFooter({ config }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const [validationError, setValidationError] = useState('');
  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit
      ? recordsApi.update({ module: 'purchases', type: config.activeType, id, payload })
      : recordsApi.create({ module: 'purchases', type: config.activeType, payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      navigate(config.backTo, {
        replace: true,
        state: { message: `${config.title.replace(/^Create |^Add /, '')} ${isEdit ? 'updated' : 'created'} successfully.` },
      });
    },
  });
  const save = (draft = false) => {
    try {
      setValidationError('');
      const payload = collectPurchasePayload(config, draft);
      saveMutation.mutate(draft ? { ...payload, status: 'Draft' } : payload);
    } catch (error) {
      setValidationError(error.message || 'Please check required fields.');
    }
  };
  useEffect(() => {
    const handler = (event) => save(Boolean(event.detail?.draft));
    document.addEventListener('purchase-form-save', handler);
    return () => document.removeEventListener('purchase-form-save', handler);
  });

  return (
    <div className="sticky bottom-0 z-10 mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <Link to={config.backTo} className="grid h-11 place-items-center rounded-lg border border-slate-200 bg-white px-8 text-sm font-bold text-[#06134a]">Cancel</Link>
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-3">
          <button disabled={saveMutation.isPending} onClick={() => save(true)} className="h-11 rounded-lg border border-red-200 bg-white px-6 text-sm font-bold text-red-600 disabled:opacity-60">{saveMutation.isPending ? 'Saving...' : 'Save as Draft'}</button>
          <button disabled={saveMutation.isPending} onClick={() => save(false)} className="h-11 rounded-lg bg-red-600 px-7 text-sm font-bold text-white disabled:opacity-60">{saveMutation.isPending ? 'Saving...' : config.primary}</button>
        </div>
        {saveMutation.isSuccess && <p className="text-xs font-bold text-emerald-600">Saved successfully in database.</p>}
        {validationError && <p className="text-xs font-bold text-red-600">{validationError}</p>}
        {saveMutation.isError && <p className="text-xs font-bold text-red-600">Save failed. Please check required data and backend connection.</p>}
      </div>
    </div>
  );
}

function collectPurchasePayload(config, draft = false) {
  const values = collectPurchaseFieldValues();
  if (config.activeType === 'items') {
    if (!values['Item Type']) throw new Error('Please select Product or Service.');
    if (values['Item Type'] === 'Product' && !values['HSN Code']) throw new Error('Please enter HSN Code for Product item.');
    if (values['Item Type'] === 'Service' && !values['SAC Code']) throw new Error('Please enter SAC Code for Service item.');
  }
  const amount = parsePurchaseMoney(
    values.Amount
    || values['Credit Limit']
    || values['Selling Price (₹)']
    || values['Cost Price (₹)']
    || values['Opening Balance']
    || '0',
  );
  const partyName = values['Vendor Name']
    || values.Vendor
    || values['Supplier / Vendor (Optional)']
    || values['Paid To']
    || values['Item Name']
    || values['Expense Title']
    || 'New Vendor';
  const status = draft ? 'Draft' : purchaseDefaultStatus(config.activeType, values);

  return {
    recordNumber: values['Bill Number']
      || values['PO #']
      || values['Purchase Number']
      || values['SKU / Barcode']
      || generatedPurchaseValue(config.activeType),
    partyName,
    partyEmail: values.Email || '',
    partyPhone: values.Phone || '',
    partyCity: values.City || values.State || values.Location || '',
    category: values.Category || values['Vendor Group'] || values['Business Type'] || values.Unit || 'General',
    status,
    secondaryStatus: values['Payment Method'] || values['Receipt Status'] || values['Item Type'] || values['Preferred Payment Method'] || '',
    amount,
    balanceAmount: ['Paid', 'Active', 'In Stock'].includes(status) ? 0 : amount,
    recordDate: normalizePurchaseDate(values['Bill Date'] || values['Expense Date'] || values['Purchase Date'] || values['Opening Balance Date']),
    dueDate: normalizePurchaseDate(values['Due Date'] || values['Delivery Date'], 15),
    referenceNumber: values['Reference / Bill No.'] || values['Reference (PO/DR No.)'] || values['SKU / Barcode'] || values['HSN Code'] || values['SAC Code'] || values.GSTIN || '',
    paymentMode: values['Payment Terms'] || values['Payment Method'] || '',
    ownerName: 'Praveen Admin',
    notes: JSON.stringify(values),
  };
}

function collectPurchaseFieldValues() {
  const values = {};
  document.querySelectorAll('[data-purchase-field]').forEach((field) => {
    const key = field.getAttribute('data-purchase-field');
    if (!key || key === 'field') return;
    const value = field.type === 'checkbox' ? field.checked : field.value;
    if (value !== undefined && value !== '' && values[key] === undefined) values[key] = value;
  });
  const itemType = document.querySelector('input[name="itemType"]:checked')?.value;
  if (itemType) values['Item Type'] = itemType;
  return values;
}

function parsePurchaseMoney(value) {
  return Number(String(value || '0').replace(/[^\d.]/g, '')) || 0;
}

function normalizePurchaseDate(value, offsetDays = 0) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value && /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

function purchaseDefaultStatus(type, values = {}) {
  if (type === 'vendors') return 'Active';
  if (type === 'items') return Number(values['Opening Stock'] || 0) > 0 ? 'In Stock' : 'Out of Stock';
  if (type === 'expenses') return 'Paid';
  if (type === 'bills') return 'Due';
  if (type === 'orders') return 'Pending';
  return 'Active';
}

function purchaseFormValuesFromRecord(record) {
  if (!record) return {};
  let notes = {};
  try {
    notes = record.notes ? JSON.parse(record.notes) : {};
  } catch {
    notes = {};
  }
  return {
    ...notes,
    'Vendor Name': record.partyName || notes['Vendor Name'],
    Vendor: record.partyName || notes.Vendor,
    'Supplier / Vendor (Optional)': record.partyName || notes['Supplier / Vendor (Optional)'],
    'Item Name': record.partyName || notes['Item Name'],
    'Expense Title': record.partyName || notes['Expense Title'],
    Email: record.partyEmail || notes.Email,
    Phone: record.partyPhone || notes.Phone,
    City: record.partyCity || notes.City,
    Category: record.category || notes.Category,
    Amount: record.amount ?? notes.Amount,
    'Bill Number': record.recordNumber || notes['Bill Number'],
    'SKU / Barcode': record.referenceNumber || notes['SKU / Barcode'],
    'Reference / Bill No.': record.referenceNumber || notes['Reference / Bill No.'],
    'Reference (PO/DR No.)': record.referenceNumber || notes['Reference (PO/DR No.)'],
    'Bill Date': record.recordDate || notes['Bill Date'],
    'Expense Date': record.recordDate || notes['Expense Date'],
    'Purchase Date': record.recordDate || notes['Purchase Date'],
    'Due Date': record.dueDate || notes['Due Date'],
    'Payment Terms': record.paymentMode || notes['Payment Terms'],
    'Payment Method': record.paymentMode || notes['Payment Method'],
  };
}

function SummaryPanel({ title, kind = 'bill', itemPreview = {}, itemImageUrl = '', onItemImageChange }) {
  const isExpense = kind === 'expense';
  const isVendor = kind === 'vendor';
  const isItem = kind === 'item';

  return (
    <aside className="space-y-4">
      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-red-700 to-red-600 px-5 py-4 text-lg font-black text-white">{title}</div>
        <div className="space-y-4 p-5 text-sm font-semibold text-[#06134a]">
          {isItem ? (
            <>
              <label className="grid h-44 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
                {itemImageUrl ? <img src={itemImageUrl} alt="Item preview" className="h-full w-full object-contain" /> : <div><Package className="mx-auto h-8 w-8 text-[#06134a]" /><p className="mt-2 font-black">Upload Image</p><p className="text-xs text-slate-500">JPG, PNG (Max 2MB)</p></div>}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => onItemImageChange?.(event.target.files?.[0] || null)} />
              </label>
              {[
                ['Item Name', itemPreview.itemName],
                ['SKU / Barcode', itemPreview.sku],
                ['Category', itemPreview.category],
                ['Unit', itemPreview.unit],
                ['Selling Price', itemPreview.sellingPrice ? formatCurrency(Number(itemPreview.sellingPrice) || 0, 'INR') : '-'],
                ['Stock', itemPreview.openingStock],
              ].map(([row, currentValue]) => <p key={row} className="flex justify-between gap-4"><span>{row}</span><span className="max-w-[180px] truncate text-right font-black" title={currentValue || '-'}>{currentValue || '-'}</span></p>)}
              <p className="flex justify-between"><span>Status</span><Badge value={itemPreview.active === false ? 'Inactive' : 'Active'} /></p>
            </>
          ) : isVendor ? (
            <>
              {['Vendor Name', 'Email', 'Phone', 'GSTIN', 'Payment Terms', 'Credit Limit'].map((row) => <p key={row} className="flex justify-between"><span>{row}</span><span>-</span></p>)}
              <div className="rounded-lg bg-red-50 p-4 text-red-600"><p className="flex justify-between text-base font-black"><span>Outstanding Payable</span><span>₹0.00</span></p></div>
            </>
          ) : (
            <>
              <p className="flex justify-between"><span>{isExpense ? 'Expense Title' : 'Vendor'}</span><span>{isExpense ? '-' : 'ABC Supplies Pvt. Ltd.'}</span></p>
              <p className="flex justify-between"><span>{isExpense ? 'Date' : 'Bill Number'}</span><span>{isExpense ? '30 May 2024' : 'BILL-00045'}</span></p>
              <p className="flex justify-between"><span>{isExpense ? 'Payment Method' : 'Due Date'}</span><span>{isExpense ? '-' : '30 May 2024'}</span></p>
              <hr />
              <p className="flex justify-between"><span>{isExpense ? 'Amount' : 'Items Total'}</span><span>{isExpense ? '₹0.00' : '₹26,500.00'}</span></p>
              <p className="flex justify-between"><span>Tax (18% GST)</span><span>{isExpense ? '₹0.00' : '₹4,590.00'}</span></p>
              <hr />
              <p className="flex justify-between text-xl font-black text-red-600"><span>Total Amount</span><span>{isExpense ? '₹0.00' : '₹30,090.00'}</span></p>
            </>
          )}
        </div>
      </article>
      {!isItem && (
        <article className="rounded-xl border border-red-100 bg-red-50 p-5">
          <h3 className="text-base font-black text-[#06134a]">Tip</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#06134a]">Complete information helps in smooth transactions and better financial tracking.</p>
        </article>
      )}
    </aside>
  );
}

function VendorBlock({ title = 'Vendor Information' }) {
  return (
    <FormCard title={title} icon={UsersRound}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Vendor Name" placeholder="Select or Add Vendor" required select />
        <Field label="Contact Person" placeholder="Enter contact person" />
        <Field label="Billing Address" placeholder="Select or Add Address" required select />
        <Field label="Email" placeholder="Enter email" />
        <Field label="Phone" placeholder="Enter phone number" />
        <button className="self-end justify-self-start text-sm font-bold text-red-600">+ Add New Address</button>
      </div>
    </FormCard>
  );
}

function PurchaseDetailsBlock({ mode }) {
  const isOrder = mode === 'order';
  return (
    <FormCard title={isOrder ? 'Purchase Details' : 'Bill Information'} icon={ReceiptText}>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label={isOrder ? 'Purchase Date' : 'Bill Number'} placeholder={isOrder ? '' : 'Auto Generate'} value={isOrder ? '30 Apr 2024' : ''} required />
        <Field label={isOrder ? 'Bill Number' : 'Bill Date'} placeholder={isOrder ? 'Enter bill number' : ''} value={isOrder ? '' : '30 Apr 2024'} required />
        <Field label="Reference (PO/DR No.)" placeholder="Enter reference" />
        <Field label="Currency" value="INR - Indian Rupee" required select />
        <Field label="Payment Terms" value="Net 30" select />
        <Field label="Due Date" value="30 May 2024" required />
        <Field label="Delivery Date" placeholder="Select delivery date" />
        <Field label="Place of Supply" value="Madhya Pradesh (23)" select />
      </div>
      <div className="mt-4">
        <TextArea label="Notes" placeholder="Enter notes (optional)" rows={2} />
      </div>
    </FormCard>
  );
}

function ItemsBlock({ rows = 3 }) {
  const columns = ['#', 'Item Details', 'HSN/SAC', 'Qty', 'Unit', 'Rate (₹)', 'Tax', 'Amount (₹)', 'Action'];

  return (
    <FormCard title="Items" icon={Package} className="min-w-0">
      <div className="mb-3 flex flex-wrap justify-end gap-3">
        <button className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-[#06134a]">+ Add Item</button>
        <button className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-[#06134a]">Import Items</button>
      </div>
      <div className="w-full min-w-0 overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[22%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[15%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{columns.map((head) => <th key={head} className="truncate px-2 py-3 text-left font-black">{head}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, index) => (
              <tr key={index}>
                <td className="px-2 py-3 font-bold">{index + 1}</td>
                <td className="px-2 py-3"><Field placeholder="Select item" select /></td>
                <td className="px-2 py-3"><Field placeholder="9988" /></td>
                <td className="px-2 py-3"><Field value={index === 0 ? '2' : '1'} /></td>
                <td className="px-2 py-3"><Field value="Nos" select /></td>
                <td className="px-2 py-3"><Field value={index === 0 ? '5,000' : '12,000'} /></td>
                <td className="px-2 py-3"><Field value="18%" select /></td>
                <td className="truncate px-2 py-3 font-black text-[#06134a]">{index === 0 ? '10,000.00' : index === 1 ? '12,000.00' : '4,500.00'}</td>
                <td className="px-2 py-3 text-center text-red-600">⌫</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="mt-3 h-9 w-full rounded-lg border border-dashed border-slate-300 text-sm font-bold text-[#06134a]">+ Add new row</button>
    </FormCard>
  );
}

function BillLikeForm({ config, mode }) {
  return (
    <section className="max-w-full space-y-6 overflow-x-hidden">
      <PurchaseFormHeader config={config} steps={[mode === 'order' ? 'Purchase Details' : 'Bill Details', 'Items', 'Review & Save']} />
      <div className="grid max-w-full gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
        <div className="min-w-0 space-y-4">
          <VendorBlock title={mode === 'order' ? 'Vendor Details' : 'Vendor Information'} />
          <PurchaseDetailsBlock mode={mode} />
          <ItemsBlock rows={mode === 'order' ? 2 : 3} />
          <FormCard title="Attachments" icon={FileText}><UploadBox compact /></FormCard>
        </div>
        <SummaryPanel title={config.summaryTitle} />
      </div>
      <FormFooter config={config} />
    </section>
  );
}

function ExpenseForm({ config }) {
  return (
    <section className="space-y-6">
      <PurchaseFormHeader config={config} steps={['Expense Details', 'Additional Details', 'Review & Save']} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <FormCard title="Basic Information" icon={ReceiptText}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Expense Date" value="30 May 2024" required />
              <Field label="Expense Title" placeholder="Enter expense title" required />
              <Field label="Category" placeholder="Select Category" required select />
              <Field label="Payment Method" placeholder="Select Payment Method" required select />
              <Field label="Amount" value="0.00" prefix="₹" required />
              <Field label="Currency" value="INR - Indian Rupee" required select />
            </div>
            <div className="mt-4"><TextArea label="Description / Notes" placeholder="Enter description or notes (optional)" /></div>
          </FormCard>
          <FormCard title="Additional Details" icon={FileText}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Vendor" placeholder="Select or Add Vendor" select />
              <Field label="Paid To" placeholder="Enter person or company name" />
              <Field label="Location" placeholder="Select Location" select />
              <Field label="Reference / Bill No." placeholder="Enter reference or bill number" />
              <Field label="Project (Optional)" placeholder="Select Project" select />
              <Field label="Department (Optional)" placeholder="Select Department" select />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-bold text-[#06134a]"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" /> This is a recurring expense</label>
          </FormCard>
          <FormCard title="Attachments" icon={FileText}>
            <UploadBox compact />
            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-[#06134a]">
              <span>Electricity_Bill_May2024.pdf <b className="ml-4 text-slate-500">1.2 MB</b></span>
              <span className="text-red-600">⌫</span>
            </div>
          </FormCard>
        </div>
        <SummaryPanel title={config.summaryTitle} kind="expense" />
      </div>
      <FormFooter config={config} />
    </section>
  );
}

function VendorForm({ config }) {
  return (
    <section className="space-y-6">
      <PurchaseFormHeader config={config} steps={['Basic Information', 'Additional Details', 'Review & Save']} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <FormCard title="Basic Information" icon={ReceiptText}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Vendor Name" placeholder="Enter vendor name" required />
              <Field label="Email" placeholder="Enter email address" />
              <Field label="Phone" placeholder="Enter phone number" required prefix="+91" />
              <Field label="Business Type" placeholder="Select Business Type" select />
              <Field label="GSTIN" placeholder="Enter GSTIN (Optional)" />
              <Field label="PAN" placeholder="Enter PAN (Optional)" />
              <Field label="Payment Terms" value="Net 30" required select />
              <Field label="Credit Limit" placeholder="Enter credit limit (Optional)" prefix="₹" />
              <Field label="Currency" value="INR - Indian Rupee" required select />
            </div>
            <div className="mt-4"><TextArea label="Address" placeholder="Enter complete address" required rows={2} /></div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="City" placeholder="Enter city" required />
              <Field label="State" placeholder="Select state" required select />
              <Field label="Pincode" placeholder="Enter pincode" required />
            </div>
          </FormCard>
          <FormCard title="Contact Person" icon={UsersRound}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Contact Person Name" placeholder="Enter contact person name" />
              <Field label="Designation" placeholder="Enter designation" />
              <Field label="Phone" placeholder="Enter phone number" prefix="+91" />
              <Field label="Email" placeholder="Enter email address" />
            </div>
          </FormCard>
          <FormCard title="Additional Details" icon={FileText}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Vendor Group" placeholder="Select Vendor Group" select />
              <Field label="Opening Balance" value="0.00" prefix="₹" />
              <Field label="Opening Balance Date" placeholder="Select date" />
              <Field label="Preferred Payment Method" placeholder="Select Payment Method" select />
              <Field label="Preferred Delivery Method" placeholder="Select Delivery Method" select />
              <Field label="Website" placeholder="Enter website (Optional)" />
            </div>
            <div className="mt-4"><TextArea label="Notes (Optional)" placeholder="Add any additional notes about this vendor" rows={2} /></div>
          </FormCard>
        </div>
        <div className="space-y-4">
          <SummaryPanel title={config.summaryTitle} kind="vendor" />
          <article className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-semibold text-[#06134a]">
            <h3 className="text-base font-black">Important Notes</h3>
            {['Ensure GSTIN and PAN are correct to avoid invoice errors.', 'Set appropriate payment terms and credit limit.', 'You can add multiple contact persons.'].map((note) => <p key={note} className="mt-3">✓ {note}</p>)}
          </article>
          <FormCard title="Attachments (Optional)" icon={FileText}><UploadBox compact /></FormCard>
        </div>
      </div>
      <FormFooter config={config} />
    </section>
  );
}

function ItemForm({ config }) {
  const savedValues = useContext(PurchaseFormValuesContext);
  const [itemType, setItemType] = useState(savedValues['Item Type'] || '');
  const [preview, setPreview] = useState({
    itemName: savedValues['Item Name'] || '',
    sku: savedValues['SKU / Barcode'] || '',
    category: savedValues.Category || '',
    unit: savedValues.Unit || '',
    sellingPrice: savedValues['Selling Price (₹)'] || '',
    openingStock: savedValues['Opening Stock'] ?? '0',
    active: savedValues.Status ? String(savedValues.Status).toLowerCase() === 'active' : true,
  });
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const categoriesQuery = useQuery({
    queryKey: ['item-category-master', 'form'],
    queryFn: () => itemCategoriesApi.list(true),
    staleTime: 60_000,
  });
  const categoryOptions = useMemo(() => {
    const options = (categoriesQuery.data || []).filter((category) => category.active || category.categoryName === preview.category).map((category) => category.categoryName);
    return preview.category && !options.includes(preview.category) ? [preview.category, ...options] : options;
  }, [categoriesQuery.data, preview.category]);
  useEffect(() => () => { if (itemImageUrl) URL.revokeObjectURL(itemImageUrl); }, [itemImageUrl]);
  const updatePreview = (key) => (value) => setPreview((current) => ({ ...current, [key]: value }));
  const changeItemImage = (file) => {
    setImageError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return setImageError('Item image must be a JPG or PNG file.');
    if (file.size > 2 * 1024 * 1024) return setImageError('Item image must not exceed 2 MB.');
    setItemImageUrl(URL.createObjectURL(file));
  };
  return (
    <section className="space-y-6">
      <PurchaseFormHeader config={config} steps={['Basic Information']} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <FormCard title="Basic Information" icon={Package}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Item Name" placeholder="Enter item name" required value={preview.itemName} onChange={updatePreview('itemName')} />
              <Field label="SKU / Barcode" placeholder="Enter SKU or scan barcode" required value={preview.sku} onChange={updatePreview('sku')} />
              <Field label="Category" placeholder={categoriesQuery.isLoading ? 'Loading categories...' : 'Select Category'} required select value={preview.category} onChange={updatePreview('category')} options={categoryOptions} />
              <Field label="Unit" placeholder="Select Unit" required select value={preview.unit} onChange={updatePreview('unit')} />
              <div>
                <span className="mb-2 block text-xs font-black text-[#06134a]">Item Type</span>
                <div className="flex h-11 items-center gap-4 rounded-lg border border-slate-200 px-3 text-sm font-bold">
                  <label><input type="radio" name="itemType" value="Product" checked={itemType === 'Product'} onChange={(event) => setItemType(event.target.value)} className="mr-2 accent-red-600" />Product</label>
                  <label><input type="radio" name="itemType" value="Service" checked={itemType === 'Service'} onChange={(event) => setItemType(event.target.value)} className="mr-2 accent-red-600" />Service</label>
                </div>
              </div>
              {itemType === 'Product' && <Field label="HSN Code" placeholder="Enter HSN code" required />}
              {itemType === 'Service' && <Field label="SAC Code" placeholder="Enter SAC code" required />}
            </div>
            <div className="mt-4"><TextArea label="Description (Optional)" placeholder="Enter item description" rows={3} /></div>
          </FormCard>
          <FormCard title="Pricing Information" icon={WalletCards}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Cost Price (₹)" placeholder="Enter cost price" required />
              <Field label="Selling Price (₹)" placeholder="Enter selling price" required value={preview.sellingPrice} onChange={updatePreview('sellingPrice')} />
              <Field label="MRP (₹) (Optional)" placeholder="Enter MRP" />
              <Field label="Tax (%)" value="18" suffix="%" />
              <Field label="Discount (%) (Optional)" placeholder="Enter discount" />
              <Field label="Profit Margin (%) (Auto)" value="0.00" />
            </div>
          </FormCard>
          <FormCard title="Inventory Information" icon={PackageCheck}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Opening Stock" value={preview.openingStock} onChange={updatePreview('openingStock')} required />
              <Field label="Reorder Level (Optional)" value="0" />
              <Field label="Maximum Stock (Optional)" placeholder="Enter maximum stock" />
              <Field label="Warehouse / Location (Optional)" placeholder="Select Warehouse" select />
              <Field label="Shelf / Bin (Optional)" placeholder="Enter shelf or bin location" />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-bold text-[#06134a]"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 accent-red-600" /> Track Inventory</label>
          </FormCard>
        </div>
        <div className="space-y-4">
          <SummaryPanel title={config.summaryTitle} kind="item" itemPreview={preview} itemImageUrl={itemImageUrl} onItemImageChange={changeItemImage} />
          {imageError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{imageError}</p>}
          <FormCard title="Additional Information" icon={FileText}>
            <div className="space-y-4">
              <Field label="Supplier / Vendor (Optional)" placeholder="Select Supplier / Vendor" select />
              <Field label="HSN / SAC Code (Optional)" placeholder="Enter HSN or SAC code" />
              <Field label="Warranty Period (Optional)" placeholder="Enter warranty period" />
            </div>
          </FormCard>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-[#06134a]">Status</h2>
            <label className="flex items-start gap-3 text-sm font-bold text-[#06134a]"><input type="checkbox" checked={preview.active} onChange={(event) => updatePreview('active')(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-600" /> <span>This item is active<br /><small className="font-semibold text-slate-500">Inactive items will not be available for transactions.</small></span></label>
          </article>
        </div>
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Note: Fields marked with * are mandatory. You can add more details later from item settings.</div>
      <FormFooter config={config} />
    </section>
  );
}

export function PurchaseFormPage({ type }) {
  const config = purchaseFormConfigs[type];

  if (type === 'expense') return <ExpenseForm config={config} />;
  if (type === 'vendor') return <VendorForm config={config} />;
  if (type === 'item') return <ItemForm config={config} />;
  return <BillLikeForm config={config} mode={type === 'order' ? 'order' : 'bill'} />;
}

export function PurchaseEditPage({ type }) {
  const config = purchaseFormConfigs[type];
  const { id } = useParams();
  const recordQuery = useQuery({
    queryKey: ['records', 'purchases', config.activeType, id],
    queryFn: () => recordsApi.get({ module: 'purchases', type: config.activeType, id }),
    enabled: Boolean(id),
  });

  const editConfig = { ...config, title: config.title.replace(/^Create |^Add /, 'Edit ') };
  const content = (() => {
    if (type === 'expense') return <ExpenseForm config={editConfig} />;
    if (type === 'vendor') return <VendorForm config={editConfig} />;
    if (type === 'item') return <ItemForm config={editConfig} />;
    return <BillLikeForm config={editConfig} mode={type === 'order' ? 'order' : 'bill'} />;
  })();

  if (recordQuery.isLoading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm font-bold text-[#06134a]">Loading record...</div>;
  }
  if (recordQuery.isError) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-600">Unable to load record for edit.</div>;
  }

  return (
    <PurchaseFormValuesContext.Provider value={purchaseFormValuesFromRecord(recordQuery.data)}>
      {content}
    </PurchaseFormValuesContext.Provider>
  );
}
