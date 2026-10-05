import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive, Boxes, Building2, CalendarDays, CheckCircle2, CircleDollarSign,
  ClipboardList, Edit3, Eye, FileDown, FolderTree, IndianRupee, Layers3,
  ListChecks, MapPin, PackagePlus, PackageX, Plus, Save, Tag, Trash2,
  UploadCloud, UserPlus, UserRound, Wrench, X,
} from 'lucide-react';
import { assetManagementApi } from '../../api/assetManagementApi.js';
import { recordsApi } from '../../api/recordsApi.js';
import { vendorsApi } from '../../api/vendorsApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import {
  ASSET_OWNER_OPTIONS, AssetFilterStrip, assetOwnerLabel, DefinitionList, EmptyState, ErrorState, Field, formatDate, formatMoney,
  inputClass, LoadingState, MetricCard, PageHeader, Pagination, PrimaryButton,
  SearchField, Section, SecondaryButton, StatusBadge, textareaClass, today,
} from './AssetUi.jsx';

const contentOf = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data?.content)) return data.data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};
const totalPagesOf = (data) => data?.totalPages ?? data?.data?.totalPages ?? 0;
const number = (value) => value === '' || value == null ? null : Number(value);
const primitiveOf = (value) => {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value.label ?? value.name ?? value.value ?? '';
  }
  return value;
};
const textOf = (value, fallback = '-') => {
  const primitive = primitiveOf(value);
  return primitive == null || primitive === '' ? fallback : String(primitive);
};
const numericOf = (value, fallback = 0) => {
  const parsed = Number(primitiveOf(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const chartRowsOf = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry, index) => ({
      key: `${textOf(entry?.label ?? entry?.name, 'row')}-${index}`,
      label: textOf(entry?.label ?? entry?.name, 'Unknown'),
      value: numericOf(entry?.value ?? entry?.count ?? entry?.assetCount),
    }));
  }
  return Object.entries(value || {}).map(([label, count], index) => ({
    key: `${textOf(label, 'row')}-${index}`,
    label: textOf(label, 'Unknown'),
    value: numericOf(count),
  }));
};
const errorText = (error) => error?.response?.data?.message || error?.message || 'The request could not be completed.';

const chartPalette = ['#16a34a', '#f59e0b', '#2563eb', '#ef4444', '#7c3aed', '#0891b2', '#f97316'];

function DonutChart({ rows, totalLabel = 'Total Assets', colors = chartPalette }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let cursor = 0;
  const stops = rows.map((row, index) => {
    const start = total ? (cursor / total) * 100 : 0;
    cursor += row.value;
    const end = total ? (cursor / total) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  const background = total ? `conic-gradient(${stops.join(', ')})` : '#e2e8f0';

  return <div className="grid items-center gap-5 sm:grid-cols-[150px_1fr]">
    <div className="relative mx-auto h-36 w-36 rounded-full" style={{ background }} role="img" aria-label={`${totalLabel}: ${total}`}>
      <div className="absolute inset-[22px] grid place-items-center rounded-full bg-white text-center shadow-inner">
        <span><b className="block text-2xl font-black text-[#07164d]">{total}</b><small className="font-bold text-slate-500">{totalLabel}</small></span>
      </div>
    </div>
    <div className="space-y-2.5">{rows.map((row, index) => <div key={row.key} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-xs">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} />
      <span className="truncate font-bold text-slate-600" title={row.label}>{row.label}</span>
      <span className="whitespace-nowrap font-black text-[#07164d]">{row.value} <small className="font-semibold text-slate-400">({total ? ((row.value / total) * 100).toFixed(1) : '0.0'}%)</small></span>
    </div>)}</div>
  </div>;
}

function AssetValueTrend({ rows }) {
  const points = chartRowsOf(rows);
  if (!points.length) return <EmptyState title="No value trend available" />;
  const width = 640; const height = 210; const left = 54; const right = 16; const top = 14; const bottom = 34;
  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values, 1);
  const x = (index) => left + (index * (width - left - right)) / Math.max(points.length - 1, 1);
  const y = (value) => top + (1 - value / maxValue) * (height - top - bottom);
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}`).join(' ');
  const area = `${line} L ${x(points.length - 1)} ${height - bottom} L ${x(0)} ${height - bottom} Z`;
  const compactMoney = (value) => value >= 10000000 ? `₹${(value / 10000000).toFixed(1)}Cr` : value >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : `₹${Math.round(value / 1000)}K`;

  return <div className="overflow-hidden">
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full" role="img" aria-label="Asset value trend">
      <defs><linearGradient id="assetValueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef4444" stopOpacity=".28" /><stop offset="1" stopColor="#ef4444" stopOpacity=".02" /></linearGradient></defs>
      {[0, .25, .5, .75, 1].map((ratio) => { const gridY = top + ratio * (height - top - bottom); const value = maxValue * (1 - ratio); return <g key={ratio}><line x1={left} x2={width - right} y1={gridY} y2={gridY} stroke="#e2e8f0" strokeDasharray="3 4" /><text x={left - 8} y={gridY + 4} textAnchor="end" fontSize="10" fill="#64748b">{compactMoney(value)}</text></g>; })}
      <path d={area} fill="url(#assetValueArea)" /><path d={line} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => <g key={point.key}><circle cx={x(index)} cy={y(point.value)} r="4" fill="white" stroke="#ef4444" strokeWidth="2.5"><title>{point.label}: {formatMoney(point.value)}</title></circle>{(points.length <= 12 || index % 2 === 0) && <text x={x(index)} y={height - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">{point.label}</text>}</g>)}
    </svg>
  </div>;
}

const invalidateAssetData = (queryClient) => Promise.all([
  queryClient.invalidateQueries({ queryKey: ['assets'] }),
  queryClient.invalidateQueries({ queryKey: ['asset-dashboard'] }),
  queryClient.invalidateQueries({ queryKey: ['asset-dashboard-summary'] }),
  queryClient.invalidateQueries({ queryKey: ['asset-options'] }),
  queryClient.invalidateQueries({ queryKey: ['asset-eligible-options'] }),
  queryClient.invalidateQueries({ queryKey: ['asset-depreciation'] }),
  queryClient.invalidateQueries({ queryKey: ['asset-depreciation-summary'] }),
]);

function Select({ value, onChange, children, disabled = false }) {
  return <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={inputClass}>{children}</select>;
}

function FormMessage({ error, success }) {
  if (!error && !success) return null;
  return <div className={`rounded-lg px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || success}</div>;
}

function useCategoryOptions() {
  return useQuery({ queryKey: ['asset-category-options'], queryFn: assetManagementApi.categoryOptions });
}

function useVendorOptions() {
  return useQuery({
    queryKey: ['asset-vendor-options'],
    queryFn: () => vendorsApi.list({ page: 0, size: 500, status: 'ACTIVE', sort: 'vendorName,asc' }),
  });
}

function useResourceOptions() {
  return useQuery({
    queryKey: ['asset-resource-options'],
    queryFn: () => recordsApi.list({ module: 'resources', type: 'resources', page: 0, size: 500, status: 'Active', sort: 'partyName,asc' }),
  });
}

export function AssetDashboardPage() {
  const navigate = useNavigate();
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [from, setFrom] = useState(`${fyStartYear}-04-01`);
  const [to, setTo] = useState(`${fyStartYear + 1}-03-31`);
  const query = useQuery({ queryKey: ['asset-dashboard', from, to], queryFn: () => assetManagementApi.dashboard({ from, to }) });
  const data = query.data || {};
  const statusRows = chartRowsOf(data.statusOverview);
  const categories = chartRowsOf(data.categoryOverview);

  return (
    <div>
      <PageHeader title="Asset Management Dashboard" description="Track, manage and maintain company assets in one place."
        actions={<><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} w-40`} /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-40`} /></>} />
      {query.isLoading ? <LoadingState label="Loading asset dashboard..." /> : query.isError ? <ErrorState message={errorText(query.error)} /> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={Boxes} label="Total Assets" value={numericOf(data.totalAssets)} hint="Active asset register" />
          <MetricCard icon={IndianRupee} label="Total Value" value={formatMoney(numericOf(data.totalValue))} hint="Current asset value" tone="green" />
          <MetricCard icon={CheckCircle2} label="In Use" value={numericOf(data.inUse)} hint="Assigned and operational" tone="blue" />
          <MetricCard icon={Wrench} label="Under Maintenance" value={numericOf(data.underMaintenance)} hint="Needs attention" tone="amber" />
          <MetricCard icon={Archive} label="Retired / Disposed" value={numericOf(data.retiredDisposed)} hint="Outside active inventory" tone="violet" />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section title="Asset Status Overview" icon={ClipboardList}>
            {statusRows.length ? <DonutChart rows={statusRows} /> : <EmptyState />}
          </Section>
          <Section title="Assets by Category" icon={Layers3}>
            {categories.length ? <DonutChart rows={categories.slice(0, 7)} totalLabel="Total" colors={['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ef4444', '#f97316', '#0891b2']} /> : <EmptyState />}
          </Section>
          <Section title="Asset Value Trend" icon={CircleDollarSign}>
            <AssetValueTrend rows={data.valueTrend || []} />
          </Section>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section title="Upcoming Maintenance" icon={CalendarDays} className="xl:col-span-2">
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="text-xs text-slate-500"><th className="pb-3">Asset</th><th>Work Order</th><th>Due Date</th><th>Priority</th><th>Technician</th></tr></thead><tbody>{(data.upcomingMaintenance || []).map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="py-3 font-black text-[#07164d]">{textOf(row.assetName)}</td><td>{textOf(row.workOrderNumber)}</td><td>{formatDate(primitiveOf(row.dueDate))}</td><td><StatusBadge value={textOf(row.priority, 'UNKNOWN')} /></td><td>{textOf(row.technicianResourceName)}</td></tr>)}</tbody></table></div>
          </Section>
          <Section title="Quick Actions" icon={PackagePlus}>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Add New Asset', '/asset-management/assets/new', PackagePlus], ['Assets List', '/asset-management/assets', ListChecks],
                ['Maintenance', '/asset-management/maintenance', Wrench], ['Assign Asset', '/asset-management/assign', UserPlus],
                ['Depreciation', '/asset-management/depreciation', CircleDollarSign], ['Disposals', '/asset-management/disposals', PackageX],
                ['Categories', '/asset-management/categories', FolderTree], ['Export Report', '/asset-management/assets', FileDown],
              ].map(([label, path, Icon]) => <button key={label} onClick={() => navigate(path)} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 p-3 text-xs font-black text-[#07164d] transition hover:border-red-300 hover:bg-red-50"><Icon className="h-5 w-5 text-red-600" aria-hidden="true" />{label}</button>)}
            </div>
          </Section>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section title="Recently Added Assets" icon={Boxes}><div className="space-y-2">{(data.recentAssets || []).map((row) => <Link key={row.id} to={`/asset-management/assets/${row.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50"><span><b className="block text-sm text-[#07164d]">{textOf(row.assetName)}</b><small className="font-bold text-slate-500">{textOf(row.assetNumber)}</small></span><StatusBadge value={textOf(row.status, 'UNKNOWN')} /></Link>)}</div></Section>
          <Section title="Asset Health" icon={CheckCircle2}>
            <p className="text-4xl font-black text-[#07164d]">{Math.round(numericOf(data.assetHealth))}%</p><p className="mt-2 text-sm font-bold text-slate-500">Assets in healthy operating states</p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, numericOf(data.assetHealth))}%` }} /></div>
            <DefinitionList items={[["Accumulated Depreciation", formatMoney(numericOf(data.accumulatedDepreciation))], ["Net Book Value", formatMoney(numericOf(data.netBookValue))]]} />
          </Section>
          <Section title="Asset Insights" icon={CircleDollarSign}><p className="text-sm font-semibold leading-6 text-slate-600">{textOf(data.insight, 'Asset insights will appear as records are created and maintained.')}</p></Section>
        </div>
      </>}
    </div>
  );
}

export function AssetListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(''); const [categoryId, setCategoryId] = useState(''); const [status, setStatus] = useState(''); const [assetOwner, setAssetOwner] = useState('');
  const [purchaseFrom, setPurchaseFrom] = useState(''); const [purchaseTo, setPurchaseTo] = useState('');
  const [page, setPage] = useState(0); const [size, setSize] = useState(10); const [deleteRow, setDeleteRow] = useState(null);
  const categories = useCategoryOptions();
  const query = useQuery({ queryKey: ['assets', search, categoryId, status, assetOwner, purchaseFrom, purchaseTo, page, size], queryFn: () => assetManagementApi.assets({ search, categoryId, status, assetOwner, purchaseFrom, purchaseTo, page, size, sort: 'createdAt,desc' }) });
  const dashboard = useQuery({ queryKey: ['asset-dashboard-summary'], queryFn: () => assetManagementApi.dashboard({}) });
  const remove = useMutation({ mutationFn: assetManagementApi.deleteAsset, onSuccess: () => { setDeleteRow(null); invalidateAssetData(queryClient); } });
  const rows = contentOf(query.data); const summary = dashboard.data || {};
  const resetPage = (setter) => (value) => { setter(value); setPage(0); };
  return <div>
    <PageHeader title="Assets List" description="View and manage all company assets." actions={<><Link to="/asset-management/assign"><SecondaryButton><UserRound className="h-4 w-4" />Assign Asset</SecondaryButton></Link><Link to="/asset-management/assets/new"><PrimaryButton><Plus className="h-4 w-4" />Add Asset</PrimaryButton></Link></>} crumbs={['Asset Management', 'Assets']} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard icon={Boxes} label="Total Assets" value={summary.totalAssets || 0} />
      <MetricCard icon={CheckCircle2} label="In Use" value={summary.inUse || 0} tone="green" />
      <MetricCard icon={Wrench} label="Under Maintenance" value={summary.underMaintenance || 0} tone="amber" />
      <MetricCard icon={Archive} label="Retired / Disposed" value={summary.retiredDisposed || 0} tone="blue" />
      <MetricCard icon={IndianRupee} label="Total Value" value={formatMoney(summary.totalValue)} tone="violet" />
    </div>
    <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <AssetFilterStrip template="minmax(230px,1fr) 150px 145px 145px 135px 135px auto" minWidth={1140}>
        <SearchField value={search} onChange={resetPage(setSearch)} placeholder="Search name, asset ID, serial or location..." />
        <Select value={categoryId} onChange={resetPage(setCategoryId)}><option value="">All Categories</option>{(categories.data || []).map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}</Select>
        <Select value={status} onChange={resetPage(setStatus)}><option value="">All Status</option>{['DRAFT','AVAILABLE','IN_USE','UNDER_MAINTENANCE','RETIRED','DISPOSED','LOST','WRITTEN_OFF'].map((v) => <option key={v}>{v}</option>)}</Select>
        <Select value={assetOwner} onChange={resetPage(setAssetOwner)} aria-label="Asset Owner"><option value="">All Asset Owners</option>{ASSET_OWNER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
        <Field label="Purchased From"><input type="date" value={purchaseFrom} onChange={(event) => resetPage(setPurchaseFrom)(event.target.value)} className={inputClass} /></Field>
        <Field label="Purchased To"><input type="date" value={purchaseTo} min={purchaseFrom || undefined} onChange={(event) => resetPage(setPurchaseTo)(event.target.value)} className={inputClass} /></Field>
        <SecondaryButton onClick={() => { setSearch(''); setCategoryId(''); setStatus(''); setAssetOwner(''); setPurchaseFrom(''); setPurchaseTo(''); setPage(0); }}>Clear</SecondaryButton>
      </AssetFilterStrip>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={errorText(query.error)} /> : rows.length === 0 ? <EmptyState /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Asset ID</th><th>Asset</th><th>Category</th><th>Status</th><th>Location</th><th>Purchase Date</th><th>Current Value</th><th>Assigned To</th><th className="pr-4 text-right">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 font-black text-blue-600"><Link to={`/asset-management/assets/${row.id}`}>{row.assetNumber}</Link></td><td><Link className="font-black text-[#07164d]" to={`/asset-management/assets/${row.id}`}>{row.assetName}</Link></td><td>{row.categoryName}</td><td><StatusBadge value={row.status} /></td><td>{row.locationName || '-'}</td><td>{formatDate(row.purchaseDate)}</td><td className="font-black">{formatMoney(row.currentValue)}</td><td>{row.assignedResourceName || '-'}</td><td className="pr-4"><div className="flex justify-end gap-1"><Link title="View" to={`/asset-management/assets/${row.id}`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200"><Eye className="h-4 w-4" /></Link><Link title="Edit" to={`/asset-management/assets/${row.id}/edit`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200"><Edit3 className="h-4 w-4" /></Link><button title="Delete" onClick={() => setDeleteRow(row)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-red-600"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>}
      <Pagination page={page} totalPages={totalPagesOf(query.data)} size={size} onPage={setPage} onSize={(v) => { setSize(v); setPage(0); }} />
    </section>
    <ConfirmDialog open={Boolean(deleteRow)} title="Delete asset" message={`Delete ${deleteRow?.assetNumber || 'this asset'}? This action cannot be undone.`} confirmLabel="Delete Asset" loading={remove.isPending} onCancel={() => setDeleteRow(null)} onConfirm={() => remove.mutate(deleteRow.id)} />
  </div>;
}

const emptyAsset = {
  assetName: '', categoryId: '', subCategory: '', assetType: 'TANGIBLE', assetOwner: '', brand: '', model: '', serialNumber: '', barcode: '', quantity: 1, unit: 'Nos', assetCondition: 'GOOD', status: 'AVAILABLE', vendorId: '', purchaseDate: today(), invoiceNumber: '', poNumber: '', purchaseValue: '', taxAmount: '', paymentMethod: '', warrantyExpiry: '', locationName: '', departmentName: '', floorRoom: '', costCenter: '', assignedResourceId: '', assignedResourceName: '', ownershipType: 'OWNED', leaseStartDate: '', leaseEndDate: '', manufacturer: '', manufactureYear: '', countryOfOrigin: 'India', hsnSacCode: '', usefulLifeMonths: 36, notes: '', depreciationMethod: 'STRAIGHT_LINE', depreciationStartDate: today(), depreciationFrequency: 'MONTHLY', residualValue: 0, scrapValue: 0, capitalizationDate: today(), imageUrl: '', draft: false,
};

const ASSET_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_ASSET_IMAGE_SIZE = 10 * 1024 * 1024;

function StoredAssetImage({ assetId, image, className = '' }) {
  const [source, setSource] = useState(image.fileUrl || '');
  useEffect(() => {
    let active = true; let objectUrl = '';
    assetManagementApi.assetImageContent(assetId, image.id).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => setSource(image.fileUrl || ''));
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId, image.id, image.fileUrl]);
  return source ? <img src={source} alt={image.fileName || 'Asset'} className={className} /> : <div className={`${className} animate-pulse bg-slate-100`} />;
}

function AssetImagePicker({ selected, setSelected, existing = [], assetId, onRemoveExisting, removingId }) {
  const [error, setError] = useState('');
  const choose = (event) => {
    setError('');
    const candidates = Array.from(event.target.files || []);
    const invalidType = candidates.find((file) => !ASSET_IMAGE_TYPES.includes(file.type));
    const oversized = candidates.find((file) => file.size > MAX_ASSET_IMAGE_SIZE);
    if (invalidType) { setError(`${invalidType.name}: only PNG, JPG, JPEG and WEBP images are supported.`); event.target.value = ''; return; }
    if (oversized) { setError(`${oversized.name}: image size must not exceed 10 MB.`); event.target.value = ''; return; }
    const additions = candidates.map((file) => ({ key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`, file, previewUrl: URL.createObjectURL(file) }));
    setSelected((current) => [...current, ...additions]);
    event.target.value = '';
  };
  const removeSelected = (key) => setSelected((current) => {
    const removed = current.find((item) => item.key === key);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    return current.filter((item) => item.key !== key);
  });
  return <div className="space-y-3">
    <label className="grid min-h-36 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-red-300 hover:bg-red-50/30">
      <span><UploadCloud className="mx-auto h-8 w-8 text-red-600" /><b className="mt-2 block text-sm text-[#07164d]">Choose multiple asset images</b><small className="mt-1 block font-semibold text-slate-500">PNG, JPG, JPEG or WEBP • Maximum 10 MB each</small></span>
      <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={choose} className="hidden" />
    </label>
    {error && <p className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
    {(existing.length > 0 || selected.length > 0) && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {existing.map((image) => <div key={`existing-${image.id}`} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white"><StoredAssetImage assetId={assetId} image={image} className="h-28 w-full object-cover" /><p className="truncate px-2 py-2 text-xs font-bold" title={image.fileName}>{image.fileName}</p><button type="button" disabled={removingId === image.id} onClick={() => onRemoveExisting?.(image)} title="Remove image" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-red-600 shadow"><X className="h-4 w-4" /></button></div>)}
      {selected.map((image) => <div key={image.key} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"><img src={image.previewUrl} alt={image.file.name} className="h-28 w-full object-cover" /><p className="truncate px-2 py-2 text-xs font-bold" title={image.file.name}>{image.file.name}</p><button type="button" onClick={() => removeSelected(image.key)} title="Remove selected image" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-red-600 shadow"><X className="h-4 w-4" /></button></div>)}
    </div>}
  </div>;
}

export function AssetFormPage() {
  const { id } = useParams(); const edit = Boolean(id); const navigate = useNavigate(); const location = useLocation(); const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyAsset); const [message, setMessage] = useState(location.state?.message || '');
  const [selectedImages, setSelectedImages] = useState([]);
  const categories = useCategoryOptions(); const vendors = useVendorOptions(); const resources = useResourceOptions();
  const existing = useQuery({ queryKey: ['asset', id], queryFn: () => assetManagementApi.asset(id), enabled: edit });
  const images = useQuery({ queryKey: ['asset-images', id], queryFn: () => assetManagementApi.assetImages(id), enabled: edit });
  useEffect(() => { if (existing.data) setForm({ ...emptyAsset, ...existing.data, categoryId: existing.data.categoryId || '', vendorId: existing.data.vendorId || '', assignedResourceId: existing.data.assignedResourceId || '' }); }, [existing.data]);
  const save = useMutation({
    mutationFn: async ({ payload, files }) => {
      const data = edit ? await assetManagementApi.updateAsset(id, payload) : await assetManagementApi.createAsset(payload);
      const results = await Promise.allSettled(files.map((item) => assetManagementApi.uploadAssetImage(data.id, item.file)));
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length) {
        const uploadError = new Error(`Asset saved, but ${failures.length} of ${files.length} image uploads failed. Open Edit Asset to retry.`);
        uploadError.savedAssetId = data.id;
        throw uploadError;
      }
      return data;
    },
    onSuccess: (data) => { invalidateAssetData(queryClient); queryClient.invalidateQueries({ queryKey: ['asset-images', data.id] }); },
    onError: (error) => setMessage(errorText(error)),
  });
  const removeImage = useMutation({
    mutationFn: (image) => assetManagementApi.deleteAssetImage(id, image.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asset-images', id] }),
    onError: (error) => setMessage(errorText(error)),
  });
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (draft = false, addAnother = false) => {
    setMessage('');
    if (!form.assetName.trim() || !form.categoryId) return setMessage('Asset name and category are required.');
    if (!form.assetOwner) return setMessage('Please select an Asset Owner.');
    if (!draft && (!form.purchaseDate || Number(form.purchaseValue || 0) < 0)) return setMessage('Enter valid purchase information.');
    const selectedResource = contentOf(resources.data).find((r) => String(r.id) === String(form.assignedResourceId));
    const payload = { ...form, categoryId: number(form.categoryId), vendorId: number(form.vendorId), assignedResourceId: number(form.assignedResourceId), assignedResourceName: selectedResource?.partyName || form.assignedResourceName || null, quantity: number(form.quantity), purchaseValue: number(form.purchaseValue) || 0, taxAmount: number(form.taxAmount) || 0, manufactureYear: number(form.manufactureYear), usefulLifeMonths: number(form.usefulLifeMonths), residualValue: number(form.residualValue) || 0, scrapValue: number(form.scrapValue) || 0, draft };
    save.mutate({ payload, files: selectedImages }, { onSuccess: (data) => { selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl)); setSelectedImages([]); if (addAnother) { setForm(emptyAsset); navigate('/asset-management/assets/new'); } else navigate(`/asset-management/assets/${data.id}`); }, onError: (error) => { if (error.savedAssetId) navigate(`/asset-management/assets/${error.savedAssetId}/edit`, { state: { message: error.message } }); } });
  };
  if (edit && existing.isLoading) return <LoadingState />;
  return <div>
    <PageHeader title={edit ? 'Edit Asset' : 'Add New Asset'} description="Enter asset, purchase, ownership and depreciation information." crumbs={['Asset Management','Assets',edit ? 'Edit Asset' : 'Add Asset']} actions={<Link to="/asset-management/assets"><SecondaryButton>Back to Assets</SecondaryButton></Link>} />
    <FormMessage error={message || (save.isError ? errorText(save.error) : '')} />
    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      <Section title="1. Asset Information" icon={Boxes}><div className="grid gap-3 sm:grid-cols-2"><Field label="Asset Name" required className="sm:col-span-2"><input value={form.assetName} onChange={(e) => change('assetName', e.target.value)} className={inputClass} /></Field><Field label="Category" required><Select value={form.categoryId} onChange={(v) => change('categoryId', v)}><option value="">Select category</option>{(categories.data || []).map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}</Select></Field><Field label="Subcategory"><input value={form.subCategory || ''} onChange={(e) => change('subCategory', e.target.value)} className={inputClass} /></Field><Field label="Asset Type"><Select value={form.assetType} onChange={(v) => change('assetType', v)}><option value="TANGIBLE">Tangible</option><option value="INTANGIBLE">Intangible</option></Select></Field><Field label="Asset Owner" required error={!form.assetOwner && message === 'Please select an Asset Owner.' ? message : ''}><Select value={form.assetOwner} onChange={(v) => change('assetOwner', v)}><option value="">Select asset owner</option>{ASSET_OWNER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field><Field label="Status"><Select value={form.status} onChange={(v) => change('status', v)}>{['DRAFT','AVAILABLE','IN_USE','UNDER_MAINTENANCE','RETIRED'].map((v) => <option key={v}>{v}</option>)}</Select></Field><Field label="Brand"><input value={form.brand || ''} onChange={(e) => change('brand', e.target.value)} className={inputClass} /></Field><Field label="Model"><input value={form.model || ''} onChange={(e) => change('model', e.target.value)} className={inputClass} /></Field><Field label="Serial Number"><input value={form.serialNumber || ''} onChange={(e) => change('serialNumber', e.target.value)} className={inputClass} /></Field><Field label="Tag / Barcode"><input value={form.barcode || ''} onChange={(e) => change('barcode', e.target.value)} className={inputClass} /></Field><Field label="Quantity"><input type="number" min="1" value={form.quantity} onChange={(e) => change('quantity', e.target.value)} className={inputClass} /></Field><Field label="Condition"><Select value={form.assetCondition} onChange={(v) => change('assetCondition', v)}>{['NEW','GOOD','FAIR','POOR','DAMAGED'].map((v) => <option key={v}>{v}</option>)}</Select></Field></div></Section>
      <Section title="2. Purchase Information" icon={IndianRupee}><div className="grid gap-3 sm:grid-cols-2"><Field label="Vendor / Supplier" className="sm:col-span-2"><Select value={form.vendorId} onChange={(v) => change('vendorId', v)}><option value="">Select vendor</option>{contentOf(vendors.data).map((v) => <option key={v.id} value={v.id}>{v.vendorName || v.partyName}</option>)}</Select></Field><Field label="Purchase Date"><input type="date" value={form.purchaseDate || ''} onChange={(e) => change('purchaseDate', e.target.value)} className={inputClass} /></Field><Field label="Warranty Expiry"><input type="date" value={form.warrantyExpiry || ''} onChange={(e) => change('warrantyExpiry', e.target.value)} className={inputClass} /></Field><Field label="Invoice Number"><input value={form.invoiceNumber || ''} onChange={(e) => change('invoiceNumber', e.target.value)} className={inputClass} /></Field><Field label="PO Number"><input value={form.poNumber || ''} onChange={(e) => change('poNumber', e.target.value)} className={inputClass} /></Field><Field label="Purchase Value"><input type="number" min="0" value={form.purchaseValue} onChange={(e) => change('purchaseValue', e.target.value)} className={inputClass} /></Field><Field label="Tax"><input type="number" min="0" value={form.taxAmount} onChange={(e) => change('taxAmount', e.target.value)} className={inputClass} /></Field><Field label="Total Amount" className="sm:col-span-2"><input readOnly value={Number(form.purchaseValue || 0) + Number(form.taxAmount || 0)} className={inputClass} /></Field><Field label="Payment Method" className="sm:col-span-2"><Select value={form.paymentMethod || ''} onChange={(v) => change('paymentMethod', v)}><option value="">Select payment method</option>{['BANK_TRANSFER','UPI','CASH','CHEQUE','CREDIT_CARD','OTHER'].map((v) => <option key={v}>{v}</option>)}</Select></Field></div></Section>
      <Section title="3. Location & Ownership" icon={MapPin}><div className="grid gap-3 sm:grid-cols-2"><Field label="Location" className="sm:col-span-2"><input value={form.locationName || ''} onChange={(e) => change('locationName', e.target.value)} className={inputClass} /></Field><Field label="Department"><input value={form.departmentName || ''} onChange={(e) => change('departmentName', e.target.value)} className={inputClass} /></Field><Field label="Floor / Room"><input value={form.floorRoom || ''} onChange={(e) => change('floorRoom', e.target.value)} className={inputClass} /></Field><Field label="Cost Center"><input value={form.costCenter || ''} onChange={(e) => change('costCenter', e.target.value)} className={inputClass} /></Field><Field label="Assigned To"><Select value={form.assignedResourceId} onChange={(v) => change('assignedResourceId', v)}><option value="">Select employee</option>{contentOf(resources.data).map((r) => <option key={r.id} value={r.id}>{r.partyName}</option>)}</Select></Field><Field label="Ownership"><Select value={form.ownershipType} onChange={(v) => change('ownershipType', v)}><option value="OWNED">Owned</option><option value="LEASED">Leased</option></Select></Field>{form.ownershipType === 'LEASED' && <><Field label="Lease Start"><input type="date" value={form.leaseStartDate || ''} onChange={(e) => change('leaseStartDate', e.target.value)} className={inputClass} /></Field><Field label="Lease End"><input type="date" value={form.leaseEndDate || ''} onChange={(e) => change('leaseEndDate', e.target.value)} className={inputClass} /></Field></>}</div></Section>
      <Section title="4. Asset Details" icon={Tag}><div className="grid gap-3 sm:grid-cols-2"><Field label="Manufacturer"><input value={form.manufacturer || ''} onChange={(e) => change('manufacturer', e.target.value)} className={inputClass} /></Field><Field label="Manufacture Year"><input type="number" value={form.manufactureYear || ''} onChange={(e) => change('manufactureYear', e.target.value)} className={inputClass} /></Field><Field label="Country of Origin"><input value={form.countryOfOrigin || ''} onChange={(e) => change('countryOfOrigin', e.target.value)} className={inputClass} /></Field><Field label="HSN / SAC"><input value={form.hsnSacCode || ''} onChange={(e) => change('hsnSacCode', e.target.value)} className={inputClass} /></Field><Field label="Useful Life (Months)"><input type="number" min="1" value={form.usefulLifeMonths || ''} onChange={(e) => change('usefulLifeMonths', e.target.value)} className={inputClass} /></Field><Field label="Notes" className="sm:col-span-2"><textarea value={form.notes || ''} onChange={(e) => change('notes', e.target.value)} className={textareaClass} /></Field></div></Section>
      <Section title="5. Financial Details" icon={CircleDollarSign}><div className="grid gap-3 sm:grid-cols-2"><Field label="Depreciation Method"><Select value={form.depreciationMethod || ''} onChange={(v) => change('depreciationMethod', v)}><option value="STRAIGHT_LINE">Straight Line</option><option value="WRITTEN_DOWN_VALUE">Written Down Value</option></Select></Field><Field label="Frequency"><Select value={form.depreciationFrequency || ''} onChange={(v) => change('depreciationFrequency', v)}>{['MONTHLY','QUARTERLY','HALF_YEARLY','YEARLY'].map((v) => <option key={v}>{v}</option>)}</Select></Field><Field label="Depreciation Start"><input type="date" value={form.depreciationStartDate || ''} onChange={(e) => change('depreciationStartDate', e.target.value)} className={inputClass} /></Field><Field label="Capitalization Date"><input type="date" value={form.capitalizationDate || ''} onChange={(e) => change('capitalizationDate', e.target.value)} className={inputClass} /></Field><Field label="Residual Value"><input type="number" min="0" value={form.residualValue || 0} onChange={(e) => change('residualValue', e.target.value)} className={inputClass} /></Field><Field label="Scrap Value"><input type="number" min="0" value={form.scrapValue || 0} onChange={(e) => change('scrapValue', e.target.value)} className={inputClass} /></Field></div></Section>
      <Section title="6. Attachments & Images" icon={Archive}><AssetImagePicker selected={selectedImages} setSelected={setSelectedImages} existing={images.data || []} assetId={id} removingId={removeImage.variables?.id} onRemoveExisting={(image) => { if (window.confirm(`Remove ${image.fileName} from this asset?`)) removeImage.mutate(image); }} /></Section>
    </div>
    <div className="mt-4 flex flex-wrap justify-end gap-2 rounded-lg border border-slate-200 bg-white p-4"><Link to="/asset-management/assets"><SecondaryButton>Cancel</SecondaryButton></Link><SecondaryButton disabled={save.isPending} onClick={() => submit(true)}>Save as Draft</SecondaryButton>{!edit && <SecondaryButton disabled={save.isPending} onClick={() => submit(false, true)}>Save & Add Another</SecondaryButton>}<PrimaryButton disabled={save.isPending} onClick={() => submit(false)}><Save className="h-4 w-4" />{save.isPending ? 'Saving...' : 'Save Asset'}</PrimaryButton></div>
  </div>;
}

export function AssetViewPage() {
  const { id } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [confirm, setConfirm] = useState(false);
  const query = useQuery({ queryKey: ['asset', id], queryFn: () => assetManagementApi.asset(id) });
  const images = useQuery({ queryKey: ['asset-images', id], queryFn: () => assetManagementApi.assetImages(id) });
  const remove = useMutation({ mutationFn: () => assetManagementApi.deleteAsset(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); navigate('/asset-management/assets'); } });
  if (query.isLoading) return <LoadingState />; if (query.isError) return <ErrorState message={errorText(query.error)} />;
  const a = query.data;
  return <div><PageHeader title="Asset Details" description="View and manage detailed information about this asset." crumbs={['Asset Management','Assets','Asset Details']} actions={<><Link to={`/asset-management/assets/${id}/edit`}><SecondaryButton><Edit3 className="h-4 w-4" />Edit</SecondaryButton></Link><Link to={`/asset-management/assign?assetId=${id}`}><SecondaryButton><UserRound className="h-4 w-4" />Assign</SecondaryButton></Link><Link to={`/asset-management/maintenance/new?assetId=${id}`}><SecondaryButton><Wrench className="h-4 w-4" />Maintenance</SecondaryButton></Link><button onClick={() => setConfirm(true)} className="grid h-10 w-10 place-items-center rounded-lg border border-red-200 text-red-600"><Trash2 className="h-4 w-4" /></button></>} />
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-5 lg:grid-cols-[180px_1fr_320px]"><div className="grid min-h-32 place-items-center overflow-hidden rounded-lg bg-slate-50">{(images.data || [])[0] ? <StoredAssetImage assetId={id} image={images.data[0]} className="h-36 w-full object-contain" /> : a.imageUrl ? <img src={a.imageUrl} alt="" className="max-h-36 object-contain" /> : <Boxes className="h-16 w-16 text-slate-300" />}</div><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-black text-[#07164d]">{a.assetName}</h2><StatusBadge value={a.status} /></div><div className="mt-5"><DefinitionList items={[["Asset ID",a.assetNumber],["Category",a.categoryName],["Serial Number",a.serialNumber],["Tag / Barcode",a.barcode],["Location",a.locationName],["Purchase Date",formatDate(a.purchaseDate)],["Purchase Value",formatMoney(a.purchaseValue)],["Useful Life",a.usefulLifeMonths ? `${a.usefulLifeMonths} months` : '-']]} /></div></div><div className="border-l border-slate-100 pl-5"><h3 className="font-black text-[#07164d]">Quick Overview</h3><div className="mt-4"><DefinitionList items={[["Current Value",formatMoney(a.currentValue)],["Accum. Depreciation",formatMoney(a.accumulatedDepreciation)],["Net Book Value",formatMoney(a.netBookValue)],["Condition",<StatusBadge value={a.assetCondition || a.condition} />]]} /></div></div></div></section>
    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      <Section title="Asset Information" icon={Boxes}><DefinitionList items={[["Asset Name",a.assetName],["Asset ID",a.assetNumber],["Category",a.categoryName],["Subcategory",a.subCategory],["Asset Owner",a.assetOwnerLabel || assetOwnerLabel(a.assetOwner)],["Brand",a.brand],["Model",a.model],["Serial Number",a.serialNumber],["Quantity",a.quantity],["Unit",a.unit],["Status",<StatusBadge value={a.status} />]]} /></Section>
      <Section title="Purchase Information" icon={IndianRupee}><DefinitionList items={[["Vendor",a.vendorName],["Purchase Date",formatDate(a.purchaseDate)],["Invoice No.",a.invoiceNumber],["PO No.",a.poNumber],["Purchase Value",formatMoney(a.purchaseValue)],["Tax",formatMoney(a.taxAmount)],["Total Amount",formatMoney(a.totalAmount)],["Payment Method",a.paymentMethod],["Warranty Expiry",formatDate(a.warrantyExpiry)]]} /></Section>
      <Section title="Location & Ownership" icon={MapPin}><DefinitionList items={[["Location",a.locationName],["Department",a.departmentName],["Floor / Room",a.floorRoom],["Assigned To",a.assignedResourceName],["Cost Center",a.costCenter],["Ownership",a.ownershipType],["Lease Start",formatDate(a.leaseStartDate)],["Lease End",formatDate(a.leaseEndDate)]]} /></Section>
      <Section title="Additional Information" icon={Tag}><DefinitionList items={[["Manufacturer",a.manufacturer],["Year",a.manufactureYear],["Country of Origin",a.countryOfOrigin],["HSN / SAC",a.hsnSacCode],["Notes",a.notes]]} /></Section>
      <Section title="Financial Summary" icon={CircleDollarSign}><DefinitionList items={[["Purchase Value",formatMoney(a.purchaseValue)],["Accumulated Depreciation",formatMoney(a.accumulatedDepreciation)],["Net Book Value",formatMoney(a.netBookValue)],["Residual Value",formatMoney(a.residualValue)],["Scrap Value",formatMoney(a.scrapValue)]]} /></Section>
      <Section title="Useful Life & Depreciation" icon={CalendarDays}><DefinitionList items={[["Useful Life",a.usefulLifeMonths ? `${a.usefulLifeMonths} months` : '-'],["Method",a.depreciationMethod],["Start Date",formatDate(a.depreciationStartDate)],["Frequency",a.depreciationFrequency],["Capitalization Date",formatDate(a.capitalizationDate)]]} /></Section>
      <Section title={`Asset Images${images.data?.length ? ` (${images.data.length})` : ''}`} icon={Archive} className="xl:col-span-3">{images.isLoading ? <LoadingState label="Loading asset images..." /> : images.isError ? <ErrorState message="Unable to load asset images." /> : images.data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{images.data.map((image) => <button key={image.id} type="button" onClick={() => window.open(image.fileUrl, '_blank', 'noopener,noreferrer')} className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:border-red-300 hover:shadow"><StoredAssetImage assetId={id} image={image} className="h-44 w-full object-cover" /><span className="block truncate p-3 text-sm font-black text-[#07164d]" title={image.fileName}>{image.fileName}</span></button>)}</div> : a.imageUrl ? <div className="max-w-sm overflow-hidden rounded-lg border"><img src={a.imageUrl} alt={a.assetName} className="h-44 w-full object-contain" /><p className="p-3 text-sm font-bold">Legacy asset image</p></div> : <EmptyState title="No images have been attached to this asset." />}</Section>
    </div><ConfirmDialog open={confirm} title="Delete asset" message={`Delete ${a.assetNumber}? This cannot be undone.`} confirmLabel="Delete Asset" loading={remove.isPending} onCancel={() => setConfirm(false)} onConfirm={() => remove.mutate()} />
  </div>;
}

export function AssetCategoryListPage() {
  const queryClient = useQueryClient(); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [page,setPage] = useState(0); const [size,setSize] = useState(10); const [deleteRow,setDeleteRow] = useState(null);
  const query = useQuery({ queryKey: ['asset-categories',search,status,page,size], queryFn: () => assetManagementApi.categories({search,status,page,size,sort:'categoryName,asc'}) });
  const all = useQuery({ queryKey: ['asset-categories-summary'], queryFn: () => assetManagementApi.categories({page:0,size:500,sort:'categoryName,asc'}) });
  const remove = useMutation({ mutationFn: assetManagementApi.deleteCategory, onSuccess: () => { setDeleteRow(null); queryClient.invalidateQueries({queryKey:['asset-categories']}); queryClient.invalidateQueries({queryKey:['asset-category-options']}); } });
  const rows = contentOf(query.data), allRows = contentOf(all.data); const totalAssets = allRows.reduce((sum,row) => sum + Number(row.assetCount || 0),0);
  return <div><PageHeader title="Asset Categories" description="Create, manage and organize categories for company assets." crumbs={['Asset Management','Categories']} actions={<Link to="/asset-management/categories/new"><PrimaryButton><Plus className="h-4 w-4" />Add New Category</PrimaryButton></Link>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard icon={Layers3} label="Total Categories" value={allRows.length} /><MetricCard icon={CheckCircle2} label="Active Categories" value={allRows.filter((r)=>r.status==='ACTIVE').length} tone="green" /><MetricCard icon={Archive} label="Inactive Categories" value={allRows.filter((r)=>r.status!=='ACTIVE').length} tone="amber" /><MetricCard icon={Boxes} label="Total Assets" value={totalAssets} tone="blue" /></div>
    <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="grid gap-2 border-b border-slate-100 p-4 md:grid-cols-[1fr_220px_auto]"><SearchField value={search} onChange={(v)=>{setSearch(v);setPage(0);}} placeholder="Search categories..."/><Select value={status} onChange={(v)=>{setStatus(v);setPage(0);}}><option value="">All Status</option><option>ACTIVE</option><option>INACTIVE</option></Select><SecondaryButton onClick={()=>{setSearch('');setStatus('');setPage(0);}}>Clear</SecondaryButton></div>
      {query.isLoading?<LoadingState/>:query.isError?<ErrorState message={errorText(query.error)}/>:rows.length===0?<EmptyState/>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Code</th><th>Category</th><th>Description</th><th>Depreciation Method</th><th>Useful Life</th><th>Status</th><th>Assets</th><th className="pr-4 text-right">Actions</th></tr></thead><tbody>{rows.map((row)=><tr key={row.id} className="border-t border-slate-100"><td className="px-4 py-3 font-black text-[#07164d]">{row.categoryCode}</td><td className="font-black text-[#07164d]">{row.categoryName}</td><td>{row.description||'-'}</td><td>{row.defaultDepreciationMethod}</td><td>{row.usefulLifeYears ? `${row.usefulLifeYears} years`:'-'}</td><td><StatusBadge value={row.status}/></td><td>{row.assetCount||0}</td><td className="pr-4"><div className="flex justify-end gap-1"><Link to={`/asset-management/categories/${row.id}/edit`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200"><Edit3 className="h-4 w-4"/></Link><button onClick={()=>setDeleteRow(row)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-red-600"><Trash2 className="h-4 w-4"/></button></div></td></tr>)}</tbody></table></div>}<Pagination page={page} totalPages={totalPagesOf(query.data)} size={size} onPage={setPage} onSize={(v)=>{setSize(v);setPage(0);}}/></section>
    <ConfirmDialog open={Boolean(deleteRow)} title="Delete category" message={`Delete ${deleteRow?.categoryName || 'this category'}? Categories linked to assets cannot be deleted.`} confirmLabel="Delete Category" loading={remove.isPending} onCancel={()=>setDeleteRow(null)} onConfirm={()=>remove.mutate(deleteRow.id)}/>
  </div>;
}

const emptyCategory = {categoryName:'',description:'',defaultDepreciationMethod:'STRAIGHT_LINE',usefulLifeYears:3,residualValuePercentage:0,depreciationFrequency:'MONTHLY',defaultAssetCondition:'GOOD',displayColor:'#dc2626',status:'ACTIVE',notes:''};
export function AssetCategoryFormPage(){
  const {id}=useParams(); const edit=Boolean(id); const navigate=useNavigate(); const queryClient=useQueryClient(); const [form,setForm]=useState(emptyCategory); const [message,setMessage]=useState('');
  const existing=useQuery({queryKey:['asset-category',id],queryFn:()=>assetManagementApi.category(id),enabled:edit});
  useEffect(()=>{if(existing.data)setForm({...emptyCategory,...existing.data});},[existing.data]);
  const mutation=useMutation({mutationFn:(payload)=>edit?assetManagementApi.updateCategory(id,payload):assetManagementApi.createCategory(payload),onSuccess:()=>{queryClient.invalidateQueries({queryKey:['asset-categories']});queryClient.invalidateQueries({queryKey:['asset-category-options']});navigate('/asset-management/categories');},onError:(e)=>setMessage(errorText(e))});
  const change=(key,value)=>setForm((current)=>({...current,[key]:value})); const submit=()=>{setMessage('');if(!form.categoryName.trim())return setMessage('Category name is required.');mutation.mutate({...form,usefulLifeYears:number(form.usefulLifeYears),residualValuePercentage:number(form.residualValuePercentage)||0});};
  if(edit&&existing.isLoading)return <LoadingState/>;
  return <div><PageHeader title={edit?'Edit Category':'Add Category'} description="Configure defaults used when assets are created." crumbs={['Asset Management','Categories',edit?'Edit':'Add Category']} actions={<Link to="/asset-management/categories"><SecondaryButton>Back to Categories</SecondaryButton></Link>}/><FormMessage error={message}/><div className="mt-4 space-y-4"><Section title="1. Category Information" icon={Layers3}><div className="grid gap-4 md:grid-cols-2"><Field label="Category Name" required><input value={form.categoryName} onChange={(e)=>change('categoryName',e.target.value)} className={inputClass}/></Field><Field label="Default Depreciation Method" required><Select value={form.defaultDepreciationMethod} onChange={(v)=>change('defaultDepreciationMethod',v)}><option value="STRAIGHT_LINE">Straight Line</option><option value="WRITTEN_DOWN_VALUE">Written Down Value</option></Select></Field><Field label="Description" className="md:col-span-2"><textarea value={form.description||''} onChange={(e)=>change('description',e.target.value)} className={textareaClass}/></Field></div></Section><Section title="2. Category Details" icon={CalendarDays}><div className="grid gap-4 md:grid-cols-3"><Field label="Useful Life (Years)" required><input type="number" min="1" value={form.usefulLifeYears} onChange={(e)=>change('usefulLifeYears',e.target.value)} className={inputClass}/></Field><Field label="Residual Value (%)"><input type="number" min="0" max="100" value={form.residualValuePercentage} onChange={(e)=>change('residualValuePercentage',e.target.value)} className={inputClass}/></Field><Field label="Depreciation Frequency"><Select value={form.depreciationFrequency} onChange={(v)=>change('depreciationFrequency',v)}>{['MONTHLY','QUARTERLY','HALF_YEARLY','YEARLY'].map((v)=><option key={v}>{v}</option>)}</Select></Field><Field label="Default Condition"><Select value={form.defaultAssetCondition} onChange={(v)=>change('defaultAssetCondition',v)}>{['NEW','GOOD','FAIR','POOR','DAMAGED'].map((v)=><option key={v}>{v}</option>)}</Select></Field><Field label="Status"><Select value={form.status} onChange={(v)=>change('status',v)}><option>ACTIVE</option><option>INACTIVE</option></Select></Field><Field label="Display Color"><input type="color" value={form.displayColor||'#dc2626'} onChange={(e)=>change('displayColor',e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 p-1"/></Field></div></Section><Section title="3. Additional Information" icon={ClipboardList}><Field label="Notes"><textarea value={form.notes||''} onChange={(e)=>change('notes',e.target.value)} className={textareaClass}/></Field></Section></div><div className="mt-4 flex justify-end gap-2"><Link to="/asset-management/categories"><SecondaryButton>Cancel</SecondaryButton></Link><PrimaryButton disabled={mutation.isPending} onClick={submit}><Save className="h-4 w-4"/>{mutation.isPending?'Saving...':'Save Category'}</PrimaryButton></div></div>;
}
