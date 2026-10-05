import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  Clock3,
  Home,
  ContactRound,
  LogOut,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  WalletCards,
} from 'lucide-react';
import intelliaTechLogo from '../assets/intelliatech-logo-black-tm.png';
import { useAuthStore } from '../store/authStore.js';
import { canAccessModule, canAccessSubmodule } from '../utils/accessControl.js';
import { leadApi } from '../api/leadManagementApi.js';

const navItems = [
  { to: '/taxes', label: 'Taxes', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const salesItems = [
  { to: '/sales/overview', label: 'Overview' },
  { to: '/sales/customers', label: 'Customers' },
  { to: '/sales/quotes', label: 'Quotes' },
  { to: '/sales/orders', label: 'Sales Orders' },
  { to: '/sales/invoices', label: 'Invoices' },
  { to: '/sales/credit-notes', label: 'Credit Notes' },
  { to: '/sales/payments-received', label: 'Payment Received' },
  { to: '/sales/delivery-challans', label: 'Delivery Challans' },
];

const purchaseItems = [
  { to: '/purchases/overview', label: 'Overview', permission: 'overview' },
  { to: '/purchases/bills', label: 'Bills', permission: 'bills' },
  { to: '/purchases/expenses', label: 'Expenses', permission: 'expenses' },
  { to: '/purchases/orders', label: 'Purchase Orders', permission: 'purchase_orders' },
  { to: '/purchases/vendors', label: 'Vendors', permission: 'vendors' },
  { to: '/purchases/items', label: 'Items', permission: 'items' },
];

const projectItems = [
  { to: '/project/overview', label: 'Project Overview' },
  { to: '/project/fixed-cost', label: 'Fixed Cost Projects' },
  { to: '/project/staffing', label: 'Staffing Projects' },
  { to: '/project/milestones', label: 'Milestones' },
];

const reportItems = [
  { to: '/reports/invoice', label: 'Invoice', permission: 'invoice_reports' },
  { to: '/reports/sales', label: 'Sales', permission: 'sales_reports' },
  { to: '/reports/expenses', label: 'Expenses', permission: 'expense_reports' },
  { to: '/reports/sales-expenses', label: 'Sales & Expenses', permission: 'sales_reports' },
  { to: '/reports/gst', label: 'GST Report', permission: 'sales_reports' },
  { to: '/reports/tds', label: 'TDS Report', permission: 'sales_reports' },
];

const assetItems = [
  { to: '/asset-management/dashboard', label: 'Dashboard' },
  { to: '/asset-management/assets', label: 'Assets' },
  { to: '/asset-management/categories', label: 'Categories' },
  { to: '/asset-management/maintenance', label: 'Maintenance' },
  { to: '/asset-management/depreciation', label: 'Depreciation' },
  { to: '/asset-management/disposals', label: 'Disposals' },
  { to: '/asset-management/assign', label: 'Assign Asset' },
];

const leadItems = [
  { to: '/lead-management/dashboard', label: 'Dashboard', permission: 'dashboard' },
  { to: '/lead-management/pipeline', label: 'Pipeline', permission: 'pipeline' },
  { to: '/lead-management/leads', label: 'Leads', permission: 'leads' },
  { to: '/lead-management/pipelines', label: 'Lead Pipelines', permission: 'pipelines' },
  { to: '/lead-management/contacts', label: 'Contacts', permission: 'contacts' },
  { to: '/lead-management/companies', label: 'Companies', permission: 'companies' },
  { to: '/lead-management/reports', label: 'Reports', permission: 'reports' },
];

const sidebarItemBase = 'flex h-11 items-center gap-4 rounded-lg px-3 text-[15px] font-semibold leading-none transition';
const sidebarItemActive = 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-950/30';
const sidebarItemInactive = 'text-slate-200 hover:bg-white/10 hover:text-white';
const sidebarSubItemBase = 'relative flex h-9 items-center rounded-md px-3 text-sm font-semibold leading-none transition before:absolute before:-left-3 before:h-px before:w-3 before:bg-white/10';
const sidebarSubItemActive = 'bg-red-600 text-white shadow-md shadow-red-950/20';
const sidebarSubItemInactive = 'text-slate-200 hover:bg-white/10 hover:text-white';

function sidebarItemClass(isActive) {
  return `${sidebarItemBase} ${isActive ? sidebarItemActive : sidebarItemInactive}`;
}

function sidebarSubItemClass(isActive) {
  return `${sidebarSubItemBase} ${isActive ? sidebarSubItemActive : sidebarSubItemInactive}`;
}

function SidebarNavItem({ to, label, icon: Icon, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => sidebarItemClass(isActive)}>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1">{label}</span>
      {children}
    </NavLink>
  );
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [leadNotifications, setLeadNotifications] = useState({ content: [], unreadCount: 0 });

  useEffect(() => {
    let active = true;
    const loadNotifications = () => leadApi.notifications()
      .then((data) => {
        if (active) setLeadNotifications({ content: data?.content || [], unreadCount: Number(data?.unreadCount || 0) });
      })
      .catch(() => {
        if (active) setLeadNotifications({ content: [], unreadCount: 0 });
      });
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 60000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const openNotification = async (notification) => {
    try {
      if (!notification.isRead) await leadApi.readNotification(notification.id);
    } finally {
      setLeadNotifications((current) => ({
        content: current.content.map((item) => item.id === notification.id ? { ...item, isRead: true } : item),
        unreadCount: Math.max(0, current.unreadCount - (notification.isRead ? 0 : 1)),
      }));
      setIsNotificationOpen(false);
      if (notification.targetPath) navigate(notification.targetPath);
    }
  };
  const isSalesActive = location.pathname.startsWith('/sales');
  const isPurchaseActive = location.pathname.startsWith('/purchases');
  const isProjectActive = location.pathname.startsWith('/project');
  const isResourcesActive = location.pathname.startsWith('/resources');
  const isReportsActive = location.pathname.startsWith('/reports');
  const isAssetActive = location.pathname.startsWith('/asset-management');
  const isLeadActive = location.pathname.startsWith('/lead-management');
  const canUse = (module) => canAccessModule(user, module);
  const visiblePurchaseItems = purchaseItems.filter((item) => canAccessSubmodule(user, 'purchase', item.permission));
  const purchaseLandingPath = visiblePurchaseItems[0]?.to || '/purchases/overview';
  const visibleLeadItems = leadItems.filter((item) => canAccessSubmodule(user, 'lead', item.permission));
  const leadLandingPath = visibleLeadItems[0]?.to || '/lead-management/dashboard';
  const visibleReportItems = reportItems.filter((item) => canAccessSubmodule(user, 'reports', item.permission));
  const reportLandingPath = visibleReportItems[0]?.to || '/reports/invoice';
  const canUseSettings = user?.role === 'admin';
  const visibleNavItems = navItems.filter((item) => {
    if (item.to === '/settings') return canUseSettings;
    return true;
  });
  const newMenuItems = isLeadActive
    ? [
      ['New Lead', '/lead-management/leads/new'],
      ['New Pipeline', '/lead-management/pipelines/new'],
      ['Add Contact', '/lead-management/contacts/new'],
      ['Add Company', '/lead-management/companies/new'],
    ]
    : isAssetActive
    ? [
      ['Add Asset', '/asset-management/assets/new'],
      ['Assign Asset', '/asset-management/assign'],
      ['Schedule Maintenance', '/asset-management/maintenance/new'],
      ['Schedule Depreciation', '/asset-management/depreciation/schedule'],
      ['Add Disposal', '/asset-management/disposals/new'],
    ]
    : isSalesActive
    ? [
      ['New Invoice', '/sales/invoices/new'],
      ['New Quote', '/sales/quotes/new'],
      ['New Sales Order', '/sales/orders/new'],
      ['Add Customer', '/sales/customers/new'],
      ['Record Payment', '/sales/payments-received/new'],
    ]
    : isPurchaseActive
      ? [
        ['New Bill', '/purchases/bills/new'],
        ['New Expense', '/purchases/expenses/new'],
        ['New Purchase Order', '/purchases/orders/new'],
        ['Add Vendor', '/purchases/vendors/new'],
        ['Add Item', '/purchases/items/new'],
      ]
      : [
        ['New Invoice', '/sales/invoices/new'],
        ['New Expense', '/purchases/expenses/new'],
        ['Add Customer', '/sales/customers/new'],
        ['Add Vendor', '/purchases/vendors/new'],
      ];

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col overflow-y-auto bg-[#071523] text-white shadow-2xl lg:flex">
        <div className="flex h-[70px] shrink-0 items-center border-b border-white/10 bg-white px-5">
          <img
            src={intelliaTechLogo}
            alt="IntelliaTech"
            className="h-auto w-[190px] object-contain"
          />
        </div>

        <nav className="grid shrink-0 gap-2 px-4 py-4">
          {canUse('dashboard') && <SidebarNavItem to="/dashboard" label="Dashboard" icon={Home} />}

          <div className={canUse('sales') ? '' : 'hidden'}>
            <NavLink
              to="/sales/overview"
              className={sidebarItemClass(isSalesActive)}
            >
              <ShoppingCart className="h-5 w-5 shrink-0" />
              <span className="flex-1">Sales</span>
              <ChevronDown className={`h-4 w-4 transition ${isSalesActive ? 'rotate-180' : ''}`} />
            </NavLink>

            {isSalesActive && (
              <div className="ml-4 mt-2 grid gap-1 border-l border-white/10 pl-3">
                {salesItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => sidebarSubItemClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <div className={canUse('purchases') ? '' : 'hidden'}>
            <NavLink
              to={purchaseLandingPath}
              className={sidebarItemClass(isPurchaseActive)}
            >
              <ReceiptText className="h-5 w-5 shrink-0" />
              <span className="flex-1">Purchases</span>
              <ChevronDown className={`h-4 w-4 transition ${isPurchaseActive ? 'rotate-180' : ''}`} />
            </NavLink>

            {isPurchaseActive && (
              <div className="ml-4 mt-2 grid gap-1 border-l border-white/10 pl-3">
                {visiblePurchaseItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => sidebarSubItemClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <div className={canUse('project') ? '' : 'hidden'}>
            <NavLink
              to="/project/overview"
              className={sidebarItemClass(isProjectActive)}
            >
              <Clock3 className="h-5 w-5 shrink-0" />
              <span className="flex-1">Projects</span>
              <ChevronDown className={`h-4 w-4 transition ${isProjectActive ? 'rotate-180' : ''}`} />
            </NavLink>

            {isProjectActive && (
              <div className="ml-4 mt-2 grid gap-1 border-l border-white/10 pl-3">
                {projectItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => sidebarSubItemClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <div className={canUse('resources') ? '' : 'hidden'}>
            <NavLink
              to="/resources/list"
              className={sidebarItemClass(isResourcesActive)}
            >
              <Package className="h-5 w-5 shrink-0" />
              <span className="flex-1">Resources</span>
            </NavLink>
          </div>

          <div className={canUse('asset') ? '' : 'hidden'}>
            <NavLink
              to="/asset-management/dashboard"
              className={sidebarItemClass(isAssetActive)}
            >
              <Boxes className="h-5 w-5 shrink-0" />
              <span className="flex-1">Asset</span>
              <ChevronDown className={`h-4 w-4 transition ${isAssetActive ? 'rotate-180' : ''}`} />
            </NavLink>

            {isAssetActive && (
              <div className="ml-4 mt-2 grid gap-1 border-l border-white/10 pl-3">
                {assetItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => sidebarSubItemClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <div className={canUse('lead') ? '' : 'hidden'}>
            <NavLink
              to={leadLandingPath}
              className={sidebarItemClass(isLeadActive)}
            >
              <ContactRound className="h-5 w-5 shrink-0" />
              <span className="flex-1">Lead</span>
              <ChevronDown className={`h-4 w-4 transition ${isLeadActive ? 'rotate-180' : ''}`} />
            </NavLink>
            {isLeadActive && (
              <div className="ml-4 mt-2 grid gap-1 border-l border-white/10 pl-3">
                {visibleLeadItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => sidebarSubItemClass(isActive)}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <div className={canUse('reports') ? '' : 'hidden'}>
            <NavLink
              to={reportLandingPath}
              className={sidebarItemClass(isReportsActive)}
            >
              <WalletCards className="h-5 w-5 shrink-0" />
              <span className="flex-1">Reports</span>
              <ChevronDown className={`h-4 w-4 transition ${isReportsActive ? 'rotate-180' : ''}`} />
            </NavLink>

            {isReportsActive && (
              <div className="ml-4 mt-2 grid gap-1 border-l border-white/10 pl-3">
                {visibleReportItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => sidebarSubItemClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {visibleNavItems.map((item) => (
            <SidebarNavItem key={item.to} to={item.to} label={item.label} icon={item.icon}>
              {item.expandable && <ChevronDown className="h-4 w-4" />}
            </SidebarNavItem>
          ))}
        </nav>

        <div className="mx-5 mb-5 mt-auto rounded-2xl border border-white/10 bg-white/10 p-4 shadow-xl">
          <img
            src={intelliaTechLogo}
            alt="IntelliaTech"
            className="mb-5 h-auto w-[150px] brightness-0 invert"
          />
          <p className="text-sm font-semibold">Growth. Insights. Success.</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">Powerful accounting made simple.</p>
          <button className="mt-4 flex h-10 w-full items-center justify-between rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700">
            Explore Premium
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </aside>

      <div className="lg:pl-[240px]">
        <header className="sticky top-0 z-20 flex h-[70px] items-center gap-5 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="relative max-w-[520px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-16 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-100"
                placeholder={isLeadActive ? 'Search in Leads, Contacts, Companies...' : 'Search in Customers, Invoices, Expenses...'}
              />
              <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 xl:block">
                ⌘ K
              </span>
            </div>
          </div>

          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setIsNewMenuOpen((value) => !value)}
              className="flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700"
              aria-expanded={isNewMenuOpen}
            >
              <span className="text-xl leading-none">+</span>
              {isLeadActive ? 'New Lead' : 'New'}
              <ChevronDown className={`h-4 w-4 transition ${isNewMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isNewMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-2xl">
                {newMenuItems.map(([label, to]) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setIsNewMenuOpen(false)}
                    className="flex h-10 items-center rounded-md px-3 text-sm font-bold text-[#06134a] hover:bg-red-50 hover:text-red-600"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <button className="hidden h-10 items-center gap-3 border-l border-slate-200 pl-6 text-sm font-bold text-slate-900 xl:flex">
            <Building2 className="h-5 w-5 text-slate-500" />
            IntelliaTech Pvt. Ltd.
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>

          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={isNotificationOpen}
              onClick={() => setIsNotificationOpen((value) => !value)}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700"
            >
              <Bell className="h-5 w-5" />
              {leadNotifications.unreadCount > 0 && (
                <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {leadNotifications.unreadCount > 99 ? '99+' : leadNotifications.unreadCount}
                </span>
              )}
            </button>
            {isNotificationOpen && (
              <div className="absolute right-0 top-12 z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-black text-[#06134a]">Notifications</h2>
                  <p className="mt-1 text-xs text-slate-500">{leadNotifications.unreadCount} unread</p>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-2">
                  {leadNotifications.content.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => openNotification(notification)}
                      className={`mb-1 block w-full rounded-lg p-3 text-left transition hover:bg-slate-50 ${notification.isRead ? 'bg-white' : 'bg-red-50/60'}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.isRead ? 'bg-slate-300' : 'bg-red-600'}`} />
                        <span className="min-w-0">
                          <b className="block text-xs text-[#06134a]">{notification.title}</b>
                          <span className="mt-1 block text-xs leading-5 text-slate-600">{notification.message}</span>
                          <span className="mt-2 block text-[10px] font-semibold text-slate-400">{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ''}</span>
                        </span>
                      </div>
                    </button>
                  ))}
                  {!leadNotifications.content.length && <p className="p-8 text-center text-xs text-slate-500">No notifications found.</p>}
                </div>
              </div>
            )}
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700">
            <Settings className="h-5 w-5" />
          </button>
          <div className="relative flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="hidden text-right lg:block">
              <p className="text-sm font-black text-[#06134a]">{user?.name || 'User'}</p>
              <p className="text-xs font-bold text-red-600">{user?.roleLabel || user?.role}</p>
            </div>
            <button
              onClick={() => setIsUserMenuOpen((value) => !value)}
              className="relative h-11 w-11 overflow-hidden rounded-full bg-gradient-to-br from-slate-200 to-slate-400 ring-offset-2 transition hover:ring-2 hover:ring-red-200"
              aria-label="User menu"
            >
              <div className="absolute inset-x-0 bottom-0 mx-auto h-7 w-8 rounded-t-full bg-slate-800" />
              <div className="absolute left-1/2 top-2 h-5 w-5 -translate-x-1/2 rounded-full bg-amber-200" />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 top-14 z-40 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-200">
                <div className="border-b border-slate-100 bg-red-50/60 p-4">
                  <p className="text-sm font-black text-[#06134a]">{user?.name || 'User'}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{user?.email}</p>
                  <span className="mt-3 inline-flex rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">{user?.roleLabel || user?.role}</span>
                </div>
                <div className="p-2">
                  <Link
                    to="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold text-[#06134a] hover:bg-red-50 hover:text-red-600"
                  >
                    <UserRound className="h-4 w-4" />
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-[#06134a] hover:bg-red-50 hover:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="px-4 py-4 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
