import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, Search } from 'lucide-react';

export const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value || 0));

export const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
  : '-';

export const today = () => new Date().toISOString().slice(0, 10);

export const ASSET_OWNER_OPTIONS = Object.freeze([
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'CLIENT', label: 'Client' },
]);

export const assetOwnerLabel = (value) => ASSET_OWNER_OPTIONS.find((option) => option.value === value)?.label || '-';

export function PageHeader({ title, description, actions, crumbs = ['Asset Management'] }) {
  return (
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
          {crumbs.map((crumb, index) => <span key={`${crumb}-${index}`}>{index ? '› ' : ''}{crumb}</span>)}
        </div>
        <h1 className="text-2xl font-black text-[#07164d]">{title}</h1>
        {description && <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PrimaryButton({ children, className = '', ...props }) {
  return <button className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`} {...props}>{children}</button>;
}

export function SecondaryButton({ children, className = '', ...props }) {
  return <button className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#07164d] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`} {...props}>{children}</button>;
}

export function MetricCard({ icon: Icon, label, value, hint, tone = 'red', onClick }) {
  const tones = {
    red: 'bg-red-50 text-red-600', green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600',
  };
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper type={onClick ? 'button' : undefined} onClick={onClick} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${tones[tone] || tones.red}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-slate-600">{label}</p>
          <p className="mt-1 truncate text-xl font-black text-[#07164d]">{value}</p>
          {hint && <p className="mt-2 truncate text-xs font-semibold text-slate-500">{hint}</p>}
        </div>
      </div>
    </Wrapper>
  );
}

export function Section({ title, icon: Icon, actions, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black text-[#07164d]">
          {Icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600"><Icon className="h-4 w-4" /></span>}
          {title}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({ label, required, error, children, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-black text-[#07164d]">{label}{required && <span className="text-red-600"> *</span>}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-bold text-red-600">{error}</span>}
    </label>
  );
}

export const inputClass = 'h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#07164d] outline-none transition placeholder:text-slate-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-slate-50 disabled:text-slate-500';
export const textareaClass = 'min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#07164d] outline-none placeholder:text-slate-400 focus:border-red-400 focus:ring-2 focus:ring-red-100';

export function SearchField({ value, onChange, placeholder = 'Search...' }) {
  return (
    <label className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${inputClass} pl-9`} />
    </label>
  );
}

export function AssetFilterStrip({ template, minWidth, children, className = '' }) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <div
        className="grid w-max min-w-full items-end gap-2 border-b border-slate-100 p-4 [&>*]:min-w-0"
        style={{ gridTemplateColumns: template, minWidth }}
      >
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ value }) {
  const normalized = String(value || 'UNKNOWN').toUpperCase();
  const styles = normalized.includes('COMPLETE') || normalized === 'ACTIVE' || normalized === 'AVAILABLE' || normalized === 'IN_USE' || normalized === 'APPROVED'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : normalized.includes('OVERDUE') || normalized.includes('CANCEL') || normalized.includes('REJECT') || normalized === 'DISPOSED' || normalized === 'LOST'
      ? 'bg-red-50 text-red-700 ring-red-200'
      : normalized.includes('PENDING') || normalized.includes('DUE') || normalized === 'UNDER_MAINTENANCE' || normalized === 'FAIR'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-blue-50 text-blue-700 ring-blue-200';
  return <span className={`inline-flex rounded px-2 py-1 text-[11px] font-black ring-1 ring-inset ${styles}`}>{normalized.replaceAll('_', ' ')}</span>;
}

export function LoadingState({ label = 'Loading records...' }) {
  return <div className="grid min-h-52 place-items-center"><div className="flex items-center gap-2 text-sm font-black text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />{label}</div></div>;
}

export function ErrorState({ message = 'Unable to load records.' }) {
  return <div className="flex min-h-40 items-center justify-center gap-2 rounded-lg bg-red-50 p-5 text-sm font-black text-red-700"><AlertCircle className="h-5 w-5" />{message}</div>;
}

export function EmptyState({ title = 'No records found', description = 'Try changing the filters or create a new record.' }) {
  return <div className="grid min-h-48 place-items-center text-center"><div><p className="font-black text-[#07164d]">{title}</p><p className="mt-1 text-sm font-semibold text-slate-500">{description}</p></div></div>;
}

export function Pagination({ page, totalPages, size, onPage, onSize }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
      <select value={size} onChange={(event) => onSize(Number(event.target.value))} className={`${inputClass} w-full sm:w-28`}>
        {[10, 20, 50].map((option) => <option key={option} value={option}>{option} / page</option>)}
      </select>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 0} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-20 text-center text-xs font-black text-[#07164d]">{page + 1} / {Math.max(totalPages, 1)}</span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page + 1 >= totalPages} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function DefinitionList({ items }) {
  return <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">{items.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-black text-[#07164d]">{value ?? '-'}</dd></div>)}</dl>;
}
