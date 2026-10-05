import {
  BadgeIndianRupee,
  ChartPie,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FileBarChart2,
  FilePlus2,
  Landmark,
  Receipt,
  TrendingUp,
  UserPlus,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboardApi.js';
import { currentFinancialYearRange, OverviewDateFilter } from '../../components/OverviewDateFilter.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate } from '../../utils/records.js';

const summaryCards = [
  {
    label: 'Total Receivables',
    icon: Receipt,
  },
  {
    label: 'Total Payables',
    icon: CreditCard,
  },
  {
    label: 'Cash Flow (Net)',
    icon: TrendingUp,
  },
  {
    label: 'Net Profit',
    icon: CircleDollarSign,
  },
];

const quickActions = [
  ['New Invoice', FilePlus2, '/sales/invoices/new'],
  ['New Expense', Receipt, '/purchases/expenses/new'],
  ['Add Customer', UserPlus, '/sales/customers/new'],
  ['Add Vendor', UsersRound, '/purchases/vendors/new'],
  ['Banking', Landmark, '/banking'],
  ['Sales Report', ChartPie, '/reports/sales'],
];

function Sparkline({ points }) {
  const values = (Array.isArray(points) ? points : [])
    .map((point) => Number(point))
    .filter(Number.isFinite);

  if (values.length === 0) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const coords = values
    .map((point, index) => {
      // A single data point has no horizontal interval. Centre it instead of
      // dividing by zero and emitting an invalid SVG coordinate (`NaN`).
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 50 - ((point - min) / (max - min || 1)) * 42;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="h-14 w-full" viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,56 ${coords} 100,56`} fill="url(#sparkFill)" />
      <polyline points={coords} fill="none" stroke="#dc2626" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

function LineChart({ months = [], inflow = [], outflow = [], netCash = [] }) {
  const finiteValue = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  };
  const max = Math.max(1, ...inflow.map(finiteValue), ...outflow.map(finiteValue), ...netCash.map((value) => Math.abs(finiteValue(value))));
  const makePoints = (series) =>
    series
      .map((value, index) => {
        const x = 18 + (index / Math.max(1, series.length - 1)) * 344;
        const y = 190 - (finiteValue(value) / max) * 150;
        return `${x},${y}`;
      })
      .join(' ');

  return (
    <div className="relative mt-5 overflow-hidden rounded-xl bg-white">
      <svg className="h-[250px] w-full" viewBox="0 0 390 230" preserveAspectRatio="none" aria-label="Cash flow chart">
        {[40, 80, 120, 160, 200].map((y) => (
          <line key={y} x1="18" x2="365" y1={y} y2={y} stroke="#e8edf5" strokeDasharray="4 4" />
        ))}
        <polyline points={makePoints(inflow)} fill="none" stroke="#16a34a" strokeWidth="2.4" />
        <polyline points={makePoints(outflow)} fill="none" stroke="#ef4444" strokeWidth="2.4" />
        <polyline points={makePoints(netCash)} fill="none" stroke="#111827" strokeWidth="2.4" />
        {inflow.map((value, index) => (
          <circle key={`in-${months[index]}`} cx={18 + (index / Math.max(1, months.length - 1)) * 344} cy={190 - (value / max) * 150} r="3" fill="white" stroke="#16a34a" strokeWidth="2" />
        ))}
        {outflow.map((value, index) => (
          <circle key={`out-${months[index]}`} cx={18 + (index / Math.max(1, months.length - 1)) * 344} cy={190 - (value / max) * 150} r="3" fill="white" stroke="#ef4444" strokeWidth="2" />
        ))}
        {netCash.map((value, index) => (
          <circle key={`net-${months[index]}`} cx={18 + (index / Math.max(1, months.length - 1)) * 344} cy={190 - (value / max) * 150} r="3" fill="#111827" />
        ))}
      </svg>
      <div className="grid grid-cols-12 px-3 pb-3 text-center text-xs text-slate-500">
        {months.map((month) => <span key={month}>{month}</span>)}
      </div>
    </div>
  );
}

export function DashboardSummary() {
  const [dateRange, setDateRange] = useState(currentFinancialYearRange);
  const dashboardQuery = useQuery({
    queryKey: ['dashboard-summary', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () => dashboardApi.summary(dateRange),
  });
  const dashboard = dashboardQuery.data;
  const monthlySales = dashboard?.monthlySales || [];
  const monthlyPurchases = dashboard?.monthlyPurchases || [];
  const months = monthlySales.length ? monthlySales.map((entry) => entry.month) : monthlyPurchases.map((entry) => entry.month);
  const inflow = months.map((month) => Number(monthlySales.find((entry) => entry.month === month)?.total || 0));
  const outflow = months.map((month) => Number(monthlyPurchases.find((entry) => entry.month === month)?.total || 0));
  const netCash = months.map((month, index) => inflow[index] - outflow[index]);
  const dynamicSummaryCards = summaryCards.map((card) => {
    const values = {
      'Total Receivables': dashboard?.totalReceivables,
      'Total Payables': dashboard?.totalPayables,
      'Cash Flow (Net)': dashboard?.cashFlowNet,
      'Net Profit': dashboard?.netProfit,
    };
    const value = Number(values[card.label] || 0);
    const points = card.label === 'Total Payables' ? outflow : card.label === 'Total Receivables' ? inflow : netCash;
    return { ...card, value: formatCurrency(value), points: points.length ? points : [0], helper: 'Selected period' };
  });
  const dashboardTransactions = dashboard?.recentTransactions?.length
    ? dashboard.recentTransactions.map((record) => [
      record.recordNumber,
      `${record.type} - ${record.partyName}`,
      formatCurrency(Number(record.amount || 0)),
      formatDate(record.recordDate),
      record.status || 'Draft',
    ])
    : [];
  const cashInflow = Number(dashboard?.totalReceivables || 0);
  const cashOutflow = Number(dashboard?.totalPayables || 0);
  const cashNet = Number(dashboard?.cashFlowNet || 0);
  const incomeTotal = Number(dashboard?.totalSales || 0);
  const expenseTotal = Number(dashboard?.totalPurchases || 0);
  const activityTotal = incomeTotal + expenseTotal;
  const incomePercentage = activityTotal > 0 ? Math.round((incomeTotal / activityTotal) * 100) : 0;
  const expensePercentage = activityTotal > 0 ? 100 - incomePercentage : 0;
  const insight = cashNet >= 0
    ? `Cash flow is positive by ${formatCurrency(cashNet)} for the selected period.`
    : `Cash outflow exceeds inflow by ${formatCurrency(Math.abs(cashNet))} for the selected period.`;

  return (
    <section className="space-y-4 text-sm text-[#06134a]">
      {dashboardQuery.isLoading && <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">Loading dashboard data...</div>}
      {dashboardQuery.isError && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">Live data could not be loaded. Start IntelliaTech Books and check the backend log if the problem continues.</div>}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black leading-tight text-[#06134a]">Welcome back, Praveen!</h1>
          <p className="mt-2 text-sm font-semibold text-[#06134a]">Here&apos;s what&apos;s happening with your business today.</p>
        </div>
        <OverviewDateFilter value={dateRange} onChange={setDateRange} onRefresh={() => dashboardQuery.refetch()} loading={dashboardQuery.isFetching} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dynamicSummaryCards.map((stat) => (
          <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-red-600 text-white shadow-lg shadow-red-100">
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#06134a]">{stat.label}</p>
                <p className="mt-2 text-xl font-black leading-none text-slate-950">{stat.value}</p>
                <p className="mt-2 text-xs text-slate-500">
                  <span className="font-bold text-emerald-600">Live</span> {stat.helper}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Sparkline points={stat.points} />
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_0.55fr_0.9fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-[#06134a]">Cash Flow Overview</h3>
            <span className="text-xs font-bold text-slate-500">Selected date range</span>
          </div>

          <div className="mt-5 grid rounded-xl border border-slate-200 bg-white py-4 text-sm md:grid-cols-3">
            <div className="px-6">
              <p className="text-slate-500">Cash Inflow</p>
              <p className="mt-2 text-base font-black text-emerald-600">{formatCurrency(cashInflow)}</p>
            </div>
            <div className="border-t border-slate-200 px-6 pt-4 md:border-l md:border-t-0 md:pt-0">
              <p className="text-slate-500">Cash Outflow</p>
              <p className="mt-2 text-base font-black text-red-600">{formatCurrency(cashOutflow)}</p>
            </div>
            <div className="border-t border-slate-200 px-6 pt-4 md:border-l md:border-t-0 md:pt-0">
              <p className="text-slate-500">Net Cash Flow</p>
              <p className="mt-2 text-base font-black text-slate-950">{formatCurrency(cashNet)}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-7 text-xs font-semibold">
            <span className="text-emerald-600">● Inflow</span>
            <span className="text-red-600">● Outflow</span>
            <span className="text-slate-950">● Net Cash Flow</span>
          </div>
          <LineChart months={months} inflow={inflow} outflow={outflow} netCash={netCash} />
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-black text-[#06134a]">Business Health</h3>
          <div className="mx-auto mt-8 h-32 w-52 overflow-hidden">
            <div className="relative h-52 w-52 rounded-full border-[22px] border-slate-100 border-b-transparent border-l-red-500 border-r-slate-100 border-t-red-500">
              <div className="absolute inset-0 grid place-items-center pt-12">
                <p className="text-2xl font-black">{Math.max(0, Math.min(100, 100 - Number(dashboard?.overdueInvoices || 0) * 5))}%</p>
                <p className="mt-1 text-sm font-bold">Business health</p>
              </div>
            </div>
          </div>
          <div className="mt-8 space-y-4 text-sm">
            {[
              ['Paid Invoices', String(dashboard?.paidInvoices || 0), CheckCircle2, 'text-emerald-600'],
              ['Total Invoices', String(dashboard?.totalInvoices || 0), CheckCircle2, 'text-emerald-600'],
              ['Cash Flow Positive', cashNet >= 0 ? 'Yes' : 'No', cashNet >= 0 ? CheckCircle2 : XCircle, cashNet >= 0 ? 'text-emerald-600' : 'text-red-600'],
              ['Overdue Invoices', String(dashboard?.overdueInvoices || 0), XCircle, 'text-red-600'],
            ].map(([label, value, Icon, color]) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${color}`} />
                <span className="flex-1 text-slate-600">{label}</span>
                <span className={label === 'Overdue Invoices' && Number(value) > 0 ? 'font-bold text-red-600' : 'font-semibold text-slate-800'}>{value}</span>
              </div>
            ))}
          </div>
          <Link to="/reports/sales" className="mt-6 grid h-11 w-full place-items-center rounded-lg border border-red-400 bg-white text-sm font-bold text-red-600 hover:bg-red-50">
            View Health Details
          </Link>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-[#06134a]">Business Snapshot</h3>
            <span className="text-xs font-bold text-slate-500">Live</span>
          </div>
          <div className="mt-5 rounded-xl bg-gradient-to-br from-red-600 to-red-700 p-5 text-white shadow-lg shadow-red-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/80">Net Profit</p>
                <p className="mt-2 text-xl font-black">{formatCurrency(Number(dashboard?.netProfit || 0))}</p>
              </div>
              <Landmark className="h-14 w-14 text-white/25" />
            </div>
            <p className="mt-4 text-xs font-semibold text-white/75">Calculated from sales and purchase records in this period</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ['Customers', dashboard?.totalCustomers || 0, '/sales/customers'],
              ['Vendors', dashboard?.totalVendors || 0, '/purchases/vendors'],
              ['Sales Records', dashboard?.totalSalesRecords || 0, '/sales/invoices'],
              ['Purchase Records', dashboard?.totalPurchaseRecords || 0, '/purchases/bills'],
            ].map(([name, value, to]) => (
              <Link key={name} to={to} className="rounded-lg border border-slate-200 p-3 hover:border-red-200 hover:bg-red-50">
                <p className="text-xs font-semibold text-slate-500">{name}</p>
                <p className="mt-1 text-lg font-black text-[#06134a]">{value}</p>
              </Link>
            ))}
          </div>
          <Link to="/banking" className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 text-sm font-bold text-red-600 hover:bg-red-50">
            <Landmark className="h-4 w-4" /> Banking
          </Link>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1fr_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black">Income vs Expense</h3>
            <span className="text-xs font-bold text-slate-500">Selected date range</span>
          </div>
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
            <div className="grid h-40 w-40 place-items-center rounded-full" style={{ background: `conic-gradient(#16a34a 0 ${incomePercentage}%, #e11d2e ${incomePercentage}% 100%)` }}>
              <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
                <p className="px-2 text-sm font-black">{formatCurrency(activityTotal)}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
            <div className="flex-1 space-y-5 text-sm">
              <div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-emerald-600" /><span className="flex-1">Income</span><b>{formatCurrency(incomeTotal)}</b><span>{incomePercentage}%</span></div>
              <div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-red-600" /><span className="flex-1">Expense</span><b>{formatCurrency(expenseTotal)}</b><span>{expensePercentage}%</span></div>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-100 px-5 py-3 text-sm">
            <span className="font-bold">Net Profit: {formatCurrency(Number(dashboard?.netProfit || 0))}</span>
            <span className={`font-bold ${Number(dashboard?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{Number(dashboard?.netProfit || 0) >= 0 ? 'Positive' : 'Negative'}</span>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black">Recent Transactions</h3>
            <button className="text-sm font-bold text-red-600">View All</button>
          </div>
          <div className="mt-4 space-y-4">
            {dashboardTransactions.map(([id, label, amount, date, status]) => (
              <div key={id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600">
                  <FileBarChart2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{label}</p>
                  <p className="text-xs text-slate-500">{id}</p>
                </div>
                <p className="hidden font-bold sm:block">{amount}</p>
                <div className="text-right">
                  <p className="text-xs text-slate-500">{date}</p>
                  <span className={`mt-1 inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${status === 'Overdue' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {status}
                  </span>
                </div>
              </div>
            ))}
            {!dashboardTransactions.length && !dashboardQuery.isLoading && (
              <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">No transactions found for this date range.</p>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-black">Quick Actions</h3>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            {quickActions.map(([label, Icon, to]) => (
              <Link key={label} to={to} className="grid h-24 place-items-center rounded-lg border border-slate-200 bg-white p-3 text-center text-sm font-bold hover:border-red-200 hover:bg-red-50">
                <Icon className="h-8 w-8 text-red-600" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><BadgeIndianRupee className="h-4 w-4 text-red-600" /> AI Business Insight</h3>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
            {insight}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black">Upcoming Reminders</h3>
          <div className="mt-3 divide-y divide-slate-200 text-sm">
            <Link to="/sales/invoices" className="flex justify-between py-3 hover:text-red-600"><span>Overdue invoice follow-up</span><span className="font-bold">{dashboard?.overdueInvoices || 0}</span></Link>
            <Link to="/purchases/bills" className="flex justify-between py-3 hover:text-red-600"><span>Outstanding payables</span><span className="font-bold">{formatCurrency(cashOutflow)}</span></Link>
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black">Shortcuts</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            {[
              ['Invoice Report', '/reports/invoice'],
              ['Expense Report', '/reports/expenses'],
              ['Sales Report', '/reports/sales'],
              ['Invoices', '/sales/invoices'],
              ['Bills', '/purchases/bills'],
              ['Cash Flow', '/dashboard'],
            ].map(([item, to]) => (
              <Link key={item} to={to} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center font-semibold text-slate-600 hover:bg-slate-50">
                {item}
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
