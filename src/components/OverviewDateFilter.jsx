import { CalendarDays, RefreshCw } from 'lucide-react';

export function currentFinancialYearRange(today = new Date()) {
  const startYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
  return {
    dateFrom: `${startYear}-04-01`,
    dateTo: `${startYear + 1}-03-31`,
  };
}

export function OverviewDateFilter({ value, onChange, onRefresh, loading = false }) {
  const applyCurrentFinancialYear = () => onChange(currentFinancialYearRange());

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-slate-500">From</span>
        <span className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
          <CalendarDays className="mr-2 h-4 w-4 text-slate-500" />
          <input
            type="date"
            value={value.dateFrom}
            max={value.dateTo}
            onChange={(event) => onChange({ ...value, dateFrom: event.target.value })}
            className="bg-transparent text-sm font-semibold text-slate-800 outline-none"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-slate-500">To</span>
        <span className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
          <CalendarDays className="mr-2 h-4 w-4 text-slate-500" />
          <input
            type="date"
            value={value.dateTo}
            min={value.dateFrom}
            onChange={(event) => onChange({ ...value, dateTo: event.target.value })}
            className="bg-transparent text-sm font-semibold text-slate-800 outline-none"
          />
        </span>
      </label>
      <button type="button" onClick={applyCurrentFinancialYear} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">
        Current FY
      </button>
      <button type="button" onClick={onRefresh} disabled={loading} title="Refresh overview" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
