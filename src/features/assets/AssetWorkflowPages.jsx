import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarCheck2, CheckCircle2, ClipboardCheck, Eye, FileText,
  IndianRupee, PackageCheck, Play, Plus, RotateCcw, Save, Trash2, UserRound,
  UsersRound, Wrench,
} from 'lucide-react';
import { assetManagementApi } from '../../api/assetManagementApi.js';
import { recordsApi } from '../../api/recordsApi.js';
import { vendorsApi } from '../../api/vendorsApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import {
  AssetFilterStrip, DefinitionList, EmptyState, ErrorState, Field, formatDate, formatMoney,
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

const depreciationEndDate = (startDate, periods, frequency) => {
  if (!startDate) return '';
  const [year, month, day] = startDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const monthsPerPeriod = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 }[frequency] || 1;
  date.setUTCMonth(date.getUTCMonth() + Math.max(1, Number(periods) || 1) * monthsPerPeriod);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};
const totalPagesOf = (data) => data?.totalPages ?? data?.data?.totalPages ?? 0;
const number = (value) => value === '' || value == null ? null : Number(value);
const errorText = (error) => error?.response?.data?.message || error?.message || 'The request could not be completed.';
const assetLabel = (asset) => `${asset?.assetName || 'Asset'} (${asset?.assetNumber || '-'})`;

function Select({ value, onChange, children, disabled = false }) {
  return <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={inputClass}>{children}</select>;
}

function Message({ error, success }) {
  if (!error && !success) return null;
  return <div className={`rounded-lg px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || success}</div>;
}

function RowActions({ children }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

function IconLink({ to, title, icon: Icon }) {
  return <Link to={to} title={title} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-[#07164d] hover:bg-slate-50"><Icon className="h-4 w-4" /></Link>;
}

function IconButton({ title, icon: Icon, danger = false, ...props }) {
  return <button type="button" title={title} className={`grid h-9 w-9 place-items-center rounded-lg border ${danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-200 text-[#07164d] hover:bg-slate-50'}`} {...props}><Icon className="h-4 w-4" /></button>;
}

function useAssets(eligible = false) {
  return useQuery({
    queryKey: eligible ? ['asset-eligible-options'] : ['asset-options'],
    queryFn: eligible ? async () => {
      let eligibleRows = [];
      try {
        const eligibleResponse = await assetManagementApi.eligibleAssets();
        eligibleRows = contentOf(eligibleResponse);
      } catch {
        // Older API deployments may not expose the eligibility endpoint.
      }

      const allResponse = await assetManagementApi.assets({ page: 0, size: 500, sort: 'assetName,asc' });
      const liveEligibleRows = contentOf(allResponse).filter((asset) => {
        const status = String(asset.status || '').toUpperCase();
        return status === 'AVAILABLE' || (status === 'IN_USE' && !asset.assignedResourceId);
      });
      return [...new Map([...eligibleRows, ...liveEligibleRows]
        .filter((asset) => asset?.id != null)
        .map((asset) => [String(asset.id), asset])).values()]
        .sort((left, right) => assetLabel(left).localeCompare(assetLabel(right)));
    } : () => assetManagementApi.assets({ page: 0, size: 500, sort: 'assetName,asc' }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: eligible,
  });
}

function useResources() {
  return useQuery({
    queryKey: ['asset-workflow-resources'],
    queryFn: () => recordsApi.list({ module: 'resources', type: 'resources', page: 0, size: 500, status: 'Active', sort: 'partyName,asc' }),
  });
}

function useVendors() {
  return useQuery({ queryKey: ['asset-workflow-vendors'], queryFn: () => vendorsApi.list({ page: 0, size: 500, status: 'ACTIVE', sort: 'vendorName,asc' }) });
}

export function AssetAssignmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { assetId: routeAssetId } = useParams();
  const [params] = useSearchParams();
  const assetsQuery = useAssets(true);
  const resourcesQuery = useResources();
  const assignmentsQuery = useQuery({ queryKey: ['asset-assignments'], queryFn: () => assetManagementApi.assignments({ page: 0, size: 100, sort: 'assignmentDate,desc' }) });
  const [form, setForm] = useState({ assetId: params.get('assetId') || routeAssetId || '', resourceId: '', assignmentDate: today(), expectedReturnDate: '', purpose: '', costCenter: '', projectName: '', referenceNumber: '', notes: '', draft: false });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [returning, setReturning] = useState(null);
  const assets = contentOf(assetsQuery.data);
  const resources = contentOf(resourcesQuery.data);
  const selectedAsset = assets.find((row) => String(row.id) === String(form.assetId));
  const selectedResource = resources.find((row) => String(row.id) === String(form.resourceId));
  const save = useMutation({
    mutationFn: (draft) => assetManagementApi.createAssignment({ ...form, draft, assetId: number(form.assetId), resourceId: number(form.resourceId), resourceName: selectedResource?.partyName, resourceEmail: selectedResource?.partyEmail }),
    onSuccess: async (_, draft) => { setError(''); setMessage(draft ? 'Assignment draft saved.' : 'Asset assigned successfully.'); await Promise.all([queryClient.invalidateQueries({ queryKey: ['asset-assignments'] }), queryClient.invalidateQueries({ queryKey: ['asset-eligible-options'] }), queryClient.invalidateQueries({ queryKey: ['asset-dashboard'] }), queryClient.invalidateQueries({ queryKey: ['assets'] })]); if (!draft) setForm((current) => ({ ...current, assetId: '', resourceId: '', purpose: '', referenceNumber: '', notes: '' })); },
    onError: (requestError) => setError(errorText(requestError)),
  });
  const returnMutation = useMutation({
    mutationFn: (row) => assetManagementApi.returnAssignment(row.id, { returnDate: today(), notes: 'Asset returned from assignment screen.' }),
    onSuccess: async () => { setReturning(null); await Promise.all([queryClient.invalidateQueries({ queryKey: ['asset-assignments'] }), queryClient.invalidateQueries({ queryKey: ['asset-eligible-options'] }), queryClient.invalidateQueries({ queryKey: ['assets'] })]); },
    onError: (requestError) => setError(errorText(requestError)),
  });
  const submit = (draft) => {
    setMessage(''); setError('');
    if (!form.assetId || !form.resourceId || !form.assignmentDate) return setError('Asset, employee and assignment date are required.');
    save.mutate(draft);
  };
  return <div>
    <PageHeader title="Assign Asset to Employee" description="Assign an eligible asset while preserving its complete assignment history." actions={<SecondaryButton onClick={() => navigate('/asset-management/assets')}><ArrowLeft className="h-4 w-4" />Back to Assets</SecondaryButton>} />
    <Message error={error} success={message} />
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Section title="1. Asset Information" icon={PackageCheck}>
        <Field label="Asset" required><Select value={form.assetId} onChange={(value) => setForm({ ...form, assetId: value })}><option value="">Select eligible asset</option>{assets.map((row) => <option key={row.id} value={row.id}>{assetLabel(row)}</option>)}</Select></Field>
        {selectedAsset && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"><b className="text-[#07164d]">{selectedAsset.assetName}</b><DefinitionList items={[["Asset ID", selectedAsset.assetNumber], ["Category", selectedAsset.categoryName], ["Location", selectedAsset.locationName], ["Condition", selectedAsset.assetCondition], ["Status", <StatusBadge value={selectedAsset.status} />]]} /></div>}
      </Section>
      <Section title="2. Employee Information" icon={UserRound}>
        <Field label="Employee" required><Select value={form.resourceId} onChange={(value) => setForm({ ...form, resourceId: value })}><option value="">Select employee</option>{resources.map((row) => <option key={row.id} value={row.id}>{row.partyName} {row.recordNumber ? `(${row.recordNumber})` : ''}</option>)}</Select></Field>
        {selectedResource && <div className="mt-4 rounded-lg bg-slate-50 p-4"><DefinitionList items={[["Employee", selectedResource.partyName], ["Email", selectedResource.partyEmail || '-'], ["Employee ID", selectedResource.recordNumber || '-']]} /></div>}
      </Section>
      <Section title="3. Assignment Details" icon={CalendarCheck2}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Assignment Date" required><input type="date" value={form.assignmentDate} onChange={(e) => setForm({ ...form, assignmentDate: e.target.value })} className={inputClass} /></Field><Field label="Expected Return Date"><input type="date" value={form.expectedReturnDate} onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })} className={inputClass} /></Field></div>
        <Field label="Purpose / Remarks" className="mt-3"><textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={textareaClass} /></Field>
      </Section>
      <Section title="4. Additional Information" icon={FileText}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Cost Centre"><input value={form.costCenter} onChange={(e) => setForm({ ...form, costCenter: e.target.value })} className={inputClass} /></Field><Field label="Project"><input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className={inputClass} /></Field></div>
        <Field label="Reference / Document No." className="mt-3"><input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} className={inputClass} /></Field>
        <Field label="Notes" className="mt-3"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={textareaClass} /></Field>
      </Section>
    </div>
    <div className="mt-4 flex justify-end gap-2"><SecondaryButton onClick={() => submit(true)} disabled={save.isPending}>Save as Draft</SecondaryButton><PrimaryButton onClick={() => submit(false)} disabled={save.isPending}><Save className="h-4 w-4" />Assign Asset</PrimaryButton></div>
    <Section title="Assignment History" icon={UsersRound} className="mt-5"><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="text-xs text-slate-500"><th className="pb-3">Asset</th><th>Employee</th><th>Assigned</th><th>Expected Return</th><th>Status</th><th>Actions</th></tr></thead><tbody>{contentOf(assignmentsQuery.data).map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="py-3 font-black text-[#07164d]">{row.assetName}<small className="block text-slate-500">{row.assetNumber}</small></td><td>{row.resourceName}</td><td>{formatDate(row.assignmentDate)}</td><td>{formatDate(row.expectedReturnDate)}</td><td><StatusBadge value={row.status} /></td><td>{row.status === 'ACTIVE' && <SecondaryButton onClick={() => setReturning(row)} className="h-8 px-3"><RotateCcw className="h-3.5 w-3.5" />Return</SecondaryButton>}</td></tr>)}</tbody></table></div>{!contentOf(assignmentsQuery.data).length && <EmptyState title="No assignments yet" />}</Section>
    <ConfirmDialog open={Boolean(returning)} title="Return this asset?" message="The active assignment will be closed and the asset will become available." confirmLabel="Return Asset" loading={returnMutation.isPending} onCancel={() => setReturning(null)} onConfirm={() => returnMutation.mutate(returning)} />
  </div>;
}

export function AssetMaintenanceListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [maintenanceType, setMaintenanceType] = useState(''); const [priority, setPriority] = useState(''); const [technician, setTechnician] = useState(''); const [scheduledFrom, setScheduledFrom] = useState(''); const [scheduledTo, setScheduledTo] = useState(''); const [page, setPage] = useState(0); const [size, setSize] = useState(10); const [deleting, setDeleting] = useState(null);
  const resourcesQuery = useResources();
  const resources = contentOf(resourcesQuery.data);
  const params = useMemo(() => ({ search, status: status || undefined, type: maintenanceType || undefined, priority: priority || undefined, technician: technician || undefined, scheduledFrom: scheduledFrom || undefined, scheduledTo: scheduledTo || undefined, page, size, sort: 'scheduledDate,desc' }), [search, status, maintenanceType, priority, technician, scheduledFrom, scheduledTo, page, size]);
  const query = useQuery({ queryKey: ['asset-maintenance', params], queryFn: () => assetManagementApi.maintenanceList(params), placeholderData: (previous) => previous });
  const summary = useQuery({ queryKey: ['asset-maintenance-summary'], queryFn: () => assetManagementApi.maintenanceList({ page: 0, size: 500 }) });
  const all = contentOf(summary.data); const rows = contentOf(query.data);
  const remove = useMutation({ mutationFn: (row) => assetManagementApi.deleteMaintenance(row.id), onSuccess: async () => { setDeleting(null); await queryClient.invalidateQueries({ queryKey: ['asset-maintenance'] }); } });
  useEffect(() => setPage(0), [search, status, maintenanceType, priority, technician, scheduledFrom, scheduledTo]);
  const clearFilters = () => { setSearch(''); setStatus(''); setMaintenanceType(''); setPriority(''); setTechnician(''); setScheduledFrom(''); setScheduledTo(''); };
  return <div><PageHeader title="Maintenance List" description="Track and manage every asset maintenance activity." actions={<Link to="/asset-management/maintenance/new"><PrimaryButton><Plus className="h-4 w-4" />Schedule Maintenance</PrimaryButton></Link>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard icon={Wrench} label="Total Maintenance" value={all.length} /><MetricCard icon={CalendarCheck2} label="Overdue" value={all.filter((r) => r.status === 'OVERDUE').length} tone="red" /><MetricCard icon={CalendarCheck2} label="Due Today" value={all.filter((r) => r.status === 'DUE_TODAY').length} tone="amber" /><MetricCard icon={Play} label="In Progress" value={all.filter((r) => r.status === 'IN_PROGRESS').length} tone="blue" /><MetricCard icon={CheckCircle2} label="Completed" value={all.filter((r) => r.status === 'COMPLETED').length} tone="green" /></div>
    <div className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm"><AssetFilterStrip template="minmax(220px,1fr) 120px 130px 110px 140px minmax(250px,1fr) auto" minWidth={1160}><SearchField value={search} onChange={setSearch} placeholder="Search work order, asset or technician..." /><Select value={status} onChange={setStatus}><option value="">All Statuses</option>{['DRAFT','SCHEDULED','DUE_TODAY','OVERDUE','IN_PROGRESS','COMPLETED','CANCELLED'].map((v) => <option key={v}>{v}</option>)}</Select><Select value={maintenanceType} onChange={setMaintenanceType}><option value="">All Types</option>{['PREVENTIVE','CORRECTIVE','INSPECTION','SERVICE','REPAIR','CLEANING'].map((v) => <option key={v}>{v.replaceAll('_', ' ')}</option>)}</Select><Select value={priority} onChange={setPriority}><option value="">All Priorities</option>{['LOW','MEDIUM','HIGH','CRITICAL'].map((v) => <option key={v}>{v}</option>)}</Select><Select value={technician} onChange={setTechnician}><option value="">All Technicians</option>{resources.map((r) => <option key={r.id} value={r.partyName || r.name || r.fullName}>{r.partyName || r.name || r.fullName}</option>)}</Select><div className="grid grid-cols-2 gap-2"><input type="date" value={scheduledFrom} onChange={(e) => setScheduledFrom(e.target.value)} className={inputClass} aria-label="Scheduled from" /><input type="date" value={scheduledTo} onChange={(e) => setScheduledTo(e.target.value)} className={inputClass} aria-label="Scheduled to" /></div><SecondaryButton onClick={clearFilters} className="whitespace-nowrap">Clear</SecondaryButton></AssetFilterStrip>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={errorText(query.error)} /> : rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="px-4 py-3">Work Order</th><th>Asset</th><th>Type</th><th>Scheduled</th><th>Due</th><th>Priority</th><th>Status</th><th>Technician</th><th className="pr-4 text-right">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3"><Link className="font-black text-blue-600" to={`/asset-management/maintenance/${row.id}`}>{row.workOrderNumber}</Link></td><td className="font-black text-[#07164d]">{row.assetName}<small className="block text-slate-500">{row.assetNumber}</small></td><td>{row.maintenanceType?.replaceAll('_',' ')}</td><td>{formatDate(row.scheduledDate)}</td><td>{formatDate(row.dueDate)}</td><td><StatusBadge value={row.priority} /></td><td><StatusBadge value={row.status} /></td><td>{row.technicianResourceName || '-'}</td><td className="pr-4"><RowActions><IconLink to={`/asset-management/maintenance/${row.id}`} title="View" icon={Eye} /><IconLink to={`/asset-management/maintenance/${row.id}/edit`} title="Edit" icon={FileText} /><IconButton title="Delete" icon={Trash2} danger onClick={() => setDeleting(row)} /></RowActions></td></tr>)}</tbody></table></div> : <EmptyState title="No maintenance records found" />}
      <Pagination page={page} totalPages={totalPagesOf(query.data)} size={size} onPage={setPage} onSize={(next) => { setSize(next); setPage(0); }} /></div>
    <ConfirmDialog open={Boolean(deleting)} title="Delete maintenance record?" message={`${deleting?.workOrderNumber || 'This work order'} will be permanently deleted.`} loading={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting)} />
  </div>;
}

const maintenanceDefaults = { assetId: '', maintenanceType: 'PREVENTIVE', description: '', checklistJson: '', technicianResourceId: '', assistantResourceId: '', scheduledDate: today(), dueDate: today(), estimatedDurationHours: '', estimatedCost: '', repeatFrequency: 'NONE', nextDueDate: '', priority: 'MEDIUM', status: 'SCHEDULED', notes: '', attachmentName: '', attachmentUrl: '' };

export function AssetMaintenanceFormPage() {
  const { id } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [params] = useSearchParams();
  const detail = useQuery({ queryKey: ['asset-maintenance-detail', id], queryFn: () => assetManagementApi.maintenance(id), enabled: Boolean(id) });
  const assetsQuery = useAssets(); const resourcesQuery = useResources(); const [form, setForm] = useState({ ...maintenanceDefaults, assetId: params.get('assetId') || '' }); const [error, setError] = useState('');
  useEffect(() => { if (detail.data) setForm({ ...maintenanceDefaults, ...detail.data, assetId: detail.data.assetId || '', technicianResourceId: detail.data.technicianResourceId || '', assistantResourceId: detail.data.assistantResourceId || '' }); }, [detail.data]);
  const assets = contentOf(assetsQuery.data); const resources = contentOf(resourcesQuery.data); const selectedAsset = assets.find((r) => String(r.id) === String(form.assetId));
  const mutation = useMutation({ mutationFn: (payload) => id ? assetManagementApi.updateMaintenance(id, payload) : assetManagementApi.createMaintenance(payload), onSuccess: async (saved) => { await queryClient.invalidateQueries({ queryKey: ['asset-maintenance'] }); navigate(`/asset-management/maintenance/${saved.id || id}`); }, onError: (e) => setError(errorText(e)) });
  const submit = (draft = false) => {
    setError('');
    if (!form.assetId || !form.scheduledDate || !form.dueDate || !form.maintenanceType || !form.description?.trim()) return setError('Asset, maintenance type, description, scheduled date and due date are required.');
    if (form.dueDate < form.scheduledDate) return setError('Due date cannot be before the scheduled date.');
    const technician = resources.find((r) => String(r.id) === String(form.technicianResourceId));
    const assistant = resources.find((r) => String(r.id) === String(form.assistantResourceId));
    mutation.mutate({ ...form, description: form.description.trim(), assetId: number(form.assetId), technicianResourceId: number(form.technicianResourceId), technicianResourceName: technician?.partyName || technician?.name || technician?.fullName || null, assistantResourceId: number(form.assistantResourceId), assistantResourceName: assistant?.partyName || assistant?.name || assistant?.fullName || null, estimatedDurationHours: number(form.estimatedDurationHours), estimatedCost: number(form.estimatedCost), nextDueDate: form.nextDueDate || null, attachmentName: form.attachmentName || null, attachmentUrl: form.attachmentUrl || null, status: draft ? 'DRAFT' : form.status });
  };
  if (id && detail.isLoading) return <LoadingState />;
  return <div><PageHeader title={id ? 'Edit Maintenance' : 'Schedule Maintenance'} description="Create and schedule an asset maintenance activity." actions={<SecondaryButton onClick={() => navigate('/asset-management/maintenance')}><ArrowLeft className="h-4 w-4" />Back to List</SecondaryButton>} /><Message error={error} />
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4"><Section title="Asset Information" icon={PackageCheck}><Field label="Asset" required><Select value={form.assetId} onChange={(v) => setForm({ ...form, assetId: v })}><option value="">Select asset</option>{assets.map((r) => <option key={r.id} value={r.id}>{assetLabel(r)}</option>)}</Select></Field>{selectedAsset && <DefinitionList items={[["Category",selectedAsset.categoryName],["Location",selectedAsset.locationName],["Serial Number",selectedAsset.serialNumber],["Status",selectedAsset.status]]} />}</Section>
        <Section title="Maintenance Details" icon={Wrench}><Field label="Maintenance Type" required><Select value={form.maintenanceType} onChange={(v) => setForm({ ...form, maintenanceType: v })}>{['PREVENTIVE','CORRECTIVE','INSPECTION','SERVICE','REPAIR','CLEANING'].map((v) => <option key={v}>{v}</option>)}</Select></Field><Field label="Description" required className="mt-3"><textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className={textareaClass} /></Field><Field label="Maintenance Checklist" className="mt-3"><textarea value={form.checklistJson || ''} onChange={(e) => setForm({ ...form, checklistJson: e.target.value })} className={textareaClass} placeholder="Checklist notes or JSON" /></Field></Section>
        <Section title="Technician Assignment" icon={UserRound}><Field label="Technician"><Select value={form.technicianResourceId} onChange={(v) => setForm({ ...form, technicianResourceId: v })}><option value="">Select technician</option>{resources.map((r) => <option key={r.id} value={r.id}>{r.partyName || r.name || r.fullName}</option>)}</Select></Field><Field label="Assistant Technician" className="mt-3"><Select value={form.assistantResourceId} onChange={(v) => setForm({ ...form, assistantResourceId: v })}><option value="">Select assistant</option>{resources.map((r) => <option key={r.id} value={r.id}>{r.partyName || r.name || r.fullName}</option>)}</Select></Field></Section></div>
      <div className="space-y-4"><Section title="Schedule Information" icon={CalendarCheck2}><div className="grid gap-3 sm:grid-cols-2"><Field label="Scheduled Date" required><input type="date" value={form.scheduledDate || ''} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className={inputClass} /></Field><Field label="Due Date" required><input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} /></Field><Field label="Estimated Duration (Hours)"><input type="number" step="0.25" value={form.estimatedDurationHours ?? ''} onChange={(e) => setForm({ ...form, estimatedDurationHours: e.target.value })} className={inputClass} /></Field><Field label="Estimated Cost"><input type="number" step="0.01" value={form.estimatedCost ?? ''} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} className={inputClass} /></Field><Field label="Repeat"><Select value={form.repeatFrequency} onChange={(v) => setForm({ ...form, repeatFrequency: v })}>{['NONE','MONTHLY','QUARTERLY','HALF_YEARLY','YEARLY'].map((v) => <option key={v}>{v}</option>)}</Select></Field><Field label="Next Due Date"><input type="date" value={form.nextDueDate || ''} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} className={inputClass} /></Field></div></Section>
        <Section title="Priority & Status" icon={ClipboardCheck}><div className="grid gap-3 sm:grid-cols-2"><Field label="Priority"><Select value={form.priority} onChange={(v) => setForm({ ...form, priority: v })}>{['LOW','MEDIUM','HIGH','CRITICAL'].map((v) => <option key={v}>{v}</option>)}</Select></Field><Field label="Status"><Select value={form.status} onChange={(v) => setForm({ ...form, status: v })}>{['DRAFT','SCHEDULED','DUE_TODAY','OVERDUE','IN_PROGRESS','COMPLETED','CANCELLED'].map((v) => <option key={v}>{v}</option>)}</Select></Field></div></Section>
        <Section title="Additional Information" icon={FileText}><Field label="Notes"><textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={textareaClass} /></Field></Section></div>
      <Section title="Checklist Preview" icon={ClipboardCheck}><p className="text-sm font-semibold leading-6 text-slate-600">Use the checklist field to store the maintenance procedure. Completion results remain linked to this work order.</p><div className="mt-4 space-y-2">{['System Check','Hardware Check','Cleaning','Performance Check'].map((item) => <label key={item} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm font-bold text-[#07164d]"><input type="checkbox" />{item}</label>)}</div></Section>
    </div><div className="mt-4 flex justify-end gap-2"><SecondaryButton onClick={() => submit(true)}>Save as Draft</SecondaryButton><PrimaryButton onClick={() => submit(false)} disabled={mutation.isPending}><Save className="h-4 w-4" />{id ? 'Update Maintenance' : 'Schedule Maintenance'}</PrimaryButton></div>
  </div>;
}

export function AssetMaintenanceViewPage() {
  const { id } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient(); const query = useQuery({ queryKey: ['asset-maintenance-detail', id], queryFn: () => assetManagementApi.maintenance(id) }); const [error, setError] = useState(''); const row = query.data;
  const statusMutation = useMutation({ mutationFn: (status) => assetManagementApi.updateMaintenanceStatus(id, { status, completedDate: status === 'COMPLETED' ? today() : null, notes: `Status updated to ${status}.` }), onSuccess: async () => { setError(''); await Promise.all([queryClient.invalidateQueries({ queryKey: ['asset-maintenance-detail', id] }), queryClient.invalidateQueries({ queryKey: ['asset-maintenance'] })]); }, onError: (e) => setError(errorText(e)) });
  if (query.isLoading) return <LoadingState />; if (query.isError) return <ErrorState message={errorText(query.error)} />;
  return <div><PageHeader title="Maintenance Details" description="View and manage detailed information about this maintenance activity." actions={<><SecondaryButton onClick={() => navigate(`/asset-management/maintenance/${id}/edit`)}>Edit</SecondaryButton>{row.status !== 'COMPLETED' && <PrimaryButton onClick={() => statusMutation.mutate(row.status === 'IN_PROGRESS' ? 'COMPLETED' : 'IN_PROGRESS')}>{row.status === 'IN_PROGRESS' ? 'Mark Completed' : 'Mark In Progress'}</PrimaryButton>}</>} /><Message error={error} />
    <Section title={row.asset?.assetName || row.assetName} icon={PackageCheck}><DefinitionList items={[["Asset ID",row.asset?.assetNumber || row.assetNumber],["Category",row.asset?.categoryName],["Location",row.asset?.locationName],["Serial Number",row.asset?.serialNumber],["Status",<StatusBadge value={row.status} />],["Work Order",row.workOrderNumber]]} /></Section>
    <div className="mt-4 grid gap-4 xl:grid-cols-3"><Section title="Maintenance Information" icon={Wrench}><DefinitionList items={[["Maintenance Type",row.maintenanceType],["Description",row.description],["Created On",formatDate(row.createdAt?.slice?.(0,10))],["Status",<StatusBadge value={row.status} />]]} /></Section><Section title="Schedule & Priority" icon={CalendarCheck2}><DefinitionList items={[["Scheduled Date",formatDate(row.scheduledDate)],["Due Date",formatDate(row.dueDate)],["Priority",<StatusBadge value={row.priority} />],["Repeat",row.repeatFrequency],["Next Maintenance",formatDate(row.nextDueDate)]]} /></Section><Section title="Maintenance Summary" icon={IndianRupee}><DefinitionList items={[["Estimated Cost",formatMoney(row.estimatedCost)],["Actual Cost",formatMoney(row.actualCost)],["Parts Cost",formatMoney(row.partsCost)],["Labour Cost",formatMoney(row.labourCost)],["Duration",`${row.actualDurationHours || row.estimatedDurationHours || 0} Hours`]]} /></Section><Section title="Technician Information" icon={UserRound}><DefinitionList items={[["Technician",row.technicianResourceName],["Assistant",row.assistantResourceName]]} /></Section><Section title="Notes" icon={FileText} className="xl:col-span-2"><p className="text-sm font-semibold leading-6 text-slate-600">{row.notes || 'No notes recorded.'}</p></Section></div>
  </div>;
}

export function AssetDepreciationListPage() {
  const [search, setSearch] = useState(''); const [year, setYear] = useState(''); const [method, setMethod] = useState(''); const [categoryId, setCategoryId] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(0); const [size, setSize] = useState(10);
  const categoriesQuery = useQuery({ queryKey: ['asset-workflow-categories'], queryFn: () => assetManagementApi.categories({ page: 0, size: 500, sort: 'categoryName,asc' }) });
  const params = useMemo(() => ({ search, financialYear: year || undefined, method: method || undefined, categoryId: categoryId || undefined, status: status || undefined, page, size, sort: 'createdAt,desc' }), [search, year, method, categoryId, status, page, size]); const query = useQuery({ queryKey: ['asset-depreciation', params], queryFn: () => assetManagementApi.depreciationList(params), placeholderData: (p) => p }); const summary = useQuery({ queryKey: ['asset-depreciation-summary'], queryFn: () => assetManagementApi.depreciationList({ page: 0, size: 500, sort: 'createdAt,desc' }) }); const rows = contentOf(query.data); const all = contentOf(summary.data); const categories = contentOf(categoriesQuery.data);
  useEffect(() => setPage(0), [search, year, method, categoryId, status]);
  return <div><PageHeader title="Asset Depreciation List" description="Track scheduled and accumulated depreciation for company assets." actions={<><Link to="/asset-management/depreciation/run"><SecondaryButton><Play className="h-4 w-4" />Run Depreciation</SecondaryButton></Link><Link to="/asset-management/depreciation/schedule"><PrimaryButton><Plus className="h-4 w-4" />Schedule Depreciation</PrimaryButton></Link></>} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard icon={PackageCheck} label="Total Schedules" value={all.length} /><MetricCard icon={CalendarCheck2} label="Active" value={all.filter((r) => r.status === 'ACTIVE' || r.status === 'SCHEDULED').length} tone="green" /><MetricCard icon={IndianRupee} label="Accumulated Depreciation" value={formatMoney(all.reduce((s,r) => s + Number(r.accumulatedDepreciation || 0),0))} tone="amber" /><MetricCard icon={IndianRupee} label="Net Book Value" value={formatMoney(all.reduce((s,r) => s + Number(r.netBookValue || 0),0))} tone="violet" /><MetricCard icon={CheckCircle2} label="Completed" value={all.filter((r) => r.status === 'COMPLETED').length} tone="blue" /></div>
    <div className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm"><AssetFilterStrip template="minmax(240px,1fr) 130px 145px 150px 130px auto" minWidth={980}><SearchField value={search} onChange={setSearch} placeholder="Search asset depreciation..." /><input value={year} onChange={(e) => setYear(e.target.value)} placeholder="All financial years" className={inputClass} /><Select value={method} onChange={setMethod}><option value="">All Methods</option><option value="STRAIGHT_LINE">Straight Line</option><option value="WRITTEN_DOWN_VALUE">Written Down Value</option></Select><Select value={categoryId} onChange={setCategoryId}><option value="">All Categories</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.categoryName}</option>)}</Select><Select value={status} onChange={setStatus}><option value="">All Statuses</option>{['DRAFT','ACTIVE','SCHEDULED','COMPLETED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</Select><SecondaryButton onClick={() => { setSearch(''); setYear(''); setMethod(''); setCategoryId(''); setStatus(''); }}>Clear</SecondaryButton></AssetFilterStrip>{query.isLoading ? <LoadingState /> : query.isError ? <EmptyState title="Unable to load depreciation schedules" /> : rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="px-4 py-3">Asset</th><th>Category</th><th>Purchase Value</th><th>Method</th><th>Financial Year</th><th>Accum. Depreciation</th><th>Net Book Value</th><th>Status</th><th className="pr-4 text-right">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t hover:bg-slate-50"><td className="px-4 py-3"><Link to={`/asset-management/depreciation/${row.id}`} className="font-black text-blue-600">{row.assetName}</Link><small className="block text-slate-500">{row.assetNumber}</small></td><td>{row.categoryName}</td><td>{formatMoney(row.purchaseValue)}</td><td>{row.method?.replaceAll('_',' ')}</td><td>{row.financialYear}</td><td>{formatMoney(row.accumulatedDepreciation)}</td><td>{formatMoney(row.netBookValue)}</td><td><StatusBadge value={row.status} /></td><td className="pr-4"><RowActions><IconLink to={`/asset-management/depreciation/${row.id}`} title="View" icon={Eye} /><IconLink to={`/asset-management/depreciation/${row.id}/edit`} title="Edit" icon={FileText} /></RowActions></td></tr>)}</tbody></table></div> : <EmptyState title="No depreciation schedules found" />}<Pagination page={page} totalPages={totalPagesOf(query.data)} size={size} onPage={setPage} onSize={(v) => { setSize(v); setPage(0); }} /></div>
  </div>;
}

export function AssetDepreciationRunPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [throughDate, setThroughDate] = useState(today());
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const query = useQuery({
    queryKey: ['asset-depreciation-run-options'],
    queryFn: () => assetManagementApi.depreciationList({ page: 0, size: 500, sort: 'createdAt,desc' }),
  });
  const schedules = contentOf(query.data).filter((row) => row.includeInRun !== false && !['DRAFT', 'COMPLETED'].includes(row.status));
  const mutation = useMutation({
    mutationFn: async () => Promise.all(selected.map((id) => assetManagementApi.runDepreciation(id, throughDate))),
    onSuccess: async () => {
      setError('');
      setSuccess(`Depreciation completed for ${selected.length} schedule${selected.length === 1 ? '' : 's'}.`);
      setSelected([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asset-depreciation'] }),
        queryClient.invalidateQueries({ queryKey: ['asset-depreciation-run-options'] }),
        queryClient.invalidateQueries({ queryKey: ['asset-dashboard'] }),
      ]);
    },
    onError: (requestError) => setError(errorText(requestError)),
  });
  const toggleAll = () => setSelected(selected.length === schedules.length ? [] : schedules.map((row) => row.id));
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const run = () => {
    setSuccess('');
    if (!throughDate) return setError('Run through date is required.');
    if (!selected.length) return setError('Select at least one depreciation schedule.');
    mutation.mutate();
  };
  return <div>
    <PageHeader title="Run Depreciation" description="Post depreciation for selected active schedules through a controlled date." actions={<SecondaryButton onClick={() => navigate('/asset-management/depreciation')}><ArrowLeft className="h-4 w-4" />Back to List</SecondaryButton>} />
    <Message error={error} success={success} />
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Section title="Eligible Depreciation Schedules" icon={PackageCheck}>
        {query.isLoading ? <LoadingState /> : schedules.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs text-slate-500"><th className="px-3 py-3"><input type="checkbox" checked={selected.length === schedules.length} onChange={toggleAll} aria-label="Select all schedules" /></th><th>Asset</th><th>Method</th><th>Frequency</th><th>Next Run</th><th>Net Book Value</th><th>Status</th></tr></thead><tbody>{schedules.map((row) => <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50"><td className="px-3 py-3"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.assetName}`} /></td><td><Link to={`/asset-management/depreciation/${row.id}`} className="font-black text-blue-600">{row.assetName}</Link><small className="block text-slate-500">{row.assetNumber}</small></td><td>{row.method?.replaceAll('_', ' ')}</td><td>{row.frequency}</td><td>{formatDate(row.nextRunDate)}</td><td>{formatMoney(row.netBookValue)}</td><td><StatusBadge value={row.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="No schedules are eligible for this run" />}
      </Section>
      <Section title="Run Summary" icon={Play}>
        <Field label="Run Through Date" required><input type="date" value={throughDate} onChange={(event) => setThroughDate(event.target.value)} className={inputClass} /></Field>
        <div className="mt-4 rounded-lg bg-slate-50 p-4"><DefinitionList items={[["Eligible Schedules", schedules.length], ["Selected", selected.length], ["Run Date", formatDate(throughDate)]]} /></div>
        <PrimaryButton className="mt-4 w-full justify-center" onClick={run} disabled={mutation.isPending || query.isLoading}><Play className="h-4 w-4" />{mutation.isPending ? 'Running...' : 'Run Selected Depreciation'}</PrimaryButton>
      </Section>
    </div>
  </div>;
}

const depreciationDefaults = { assetId: '', method: 'STRAIGHT_LINE', financialYear: `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(-2)}`, startDate: today(), endDate: '', frequency: 'MONTHLY', numberOfPeriods: 12, residualValueType: 'FIXED_AMOUNT', residualValue: 0, expenseAccount: 'Depreciation Expense', accumulatedAccount: 'Accumulated Depreciation', proRataConvention: 'FULL_MONTH', depreciateInPurchaseMonth: true, includeInRun: true, description: '', draft: false };

export function AssetDepreciationFormPage() {
  const { id } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [params] = useSearchParams(); const assetsQuery = useAssets(); const detail = useQuery({ queryKey: ['asset-depreciation-detail', id], queryFn: () => assetManagementApi.depreciation(id), enabled: Boolean(id) }); const [form,setForm] = useState({ ...depreciationDefaults, assetId: params.get('assetId') || '' }); const [error,setError] = useState('');
  useEffect(() => { if (detail.data) setForm({ ...depreciationDefaults, ...detail.data, assetId: detail.data.assetId || '' }); }, [detail.data]); const assets = contentOf(assetsQuery.data); const asset = assets.find((r) => String(r.id) === String(form.assetId)); const purchase = Number(asset?.purchaseValue || detail.data?.asset?.purchaseValue || 0); const residual = Number(form.residualValue || 0); const periods = Math.max(1, Number(form.numberOfPeriods || 1)); const depreciable = Math.max(0,purchase-residual); const perPeriod = depreciable/periods;
  const mutation = useMutation({ mutationFn: (payload) => id ? assetManagementApi.updateDepreciation(id,payload) : assetManagementApi.createDepreciation(payload), onSuccess: async (saved) => { await queryClient.invalidateQueries({ queryKey: ['asset-depreciation'] }); navigate(`/asset-management/depreciation/${saved.id || id}`); }, onError: (e) => setError(errorText(e)) });
  const submit = (draft) => {
    if (!form.assetId || !form.startDate || !form.method) {
      return setError('Asset, method and start date are required.');
    }
    const numberOfPeriods = Math.max(1, number(form.numberOfPeriods) || 1);
    const frequency = String(form.frequency || 'MONTHLY').toUpperCase();
    const startDate = form.startDate || today();
    mutation.mutate({
      ...form,
      assetId: number(form.assetId),
      method: String(form.method || 'STRAIGHT_LINE').toUpperCase(),
      financialYear: String(form.financialYear || depreciationDefaults.financialYear).trim(),
      startDate,
      frequency,
      numberOfPeriods,
      residualValueType: String(form.residualValueType || 'FIXED_AMOUNT').toUpperCase(),
      residualValue: Math.max(0, number(form.residualValue) || 0),
      expenseAccount: String(form.expenseAccount || 'Depreciation Expense').trim(),
      accumulatedAccount: String(form.accumulatedAccount || 'Accumulated Depreciation').trim(),
      proRataConvention: String(form.proRataConvention || 'FULL_MONTH').toUpperCase(),
      endDate: form.endDate || depreciationEndDate(startDate, numberOfPeriods, frequency),
      draft,
    });
  };
  return <div><PageHeader title={id ? 'Edit Depreciation Schedule' : 'Schedule Depreciation'} description="Create and schedule depreciation for an asset." actions={<SecondaryButton onClick={() => navigate('/asset-management/depreciation')}><ArrowLeft className="h-4 w-4" />Back to List</SecondaryButton>} /><Message error={error} /><div className="grid gap-4 xl:grid-cols-3"><Section title="1. Asset Information" icon={PackageCheck}><Field label="Asset" required><Select value={form.assetId} onChange={(v) => setForm({...form,assetId:v})}><option value="">Select asset</option>{assets.map((r) => <option key={r.id} value={r.id}>{assetLabel(r)}</option>)}</Select></Field>{asset && <DefinitionList items={[["Category",asset.categoryName],["Purchase Date",formatDate(asset.purchaseDate)],["Purchase Value",formatMoney(asset.purchaseValue)],["Useful Life",`${asset.usefulLifeMonths || 0} months`],["Status",asset.status]]} />}</Section><Section title="2. Depreciation Schedule" icon={CalendarCheck2}><Field label="Method" required><Select value={form.method} onChange={(v) => setForm({...form,method:v})}><option value="STRAIGHT_LINE">Straight Line</option><option value="WRITTEN_DOWN_VALUE">Written Down Value</option></Select></Field><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Financial Year"><input value={form.financialYear || ''} onChange={(e) => setForm({...form,financialYear:e.target.value})} className={inputClass} /></Field><Field label="Start Date"><input type="date" value={form.startDate || ''} onChange={(e) => setForm({...form,startDate:e.target.value})} className={inputClass} /></Field><Field label="Frequency"><Select value={form.frequency} onChange={(v) => setForm({...form,frequency:v})}>{['MONTHLY','QUARTERLY','HALF_YEARLY','YEARLY'].map((v) => <option key={v}>{v}</option>)}</Select></Field><Field label="End Date"><input type="date" value={form.endDate || ''} onChange={(e) => setForm({...form,endDate:e.target.value})} className={inputClass} /></Field><Field label="Number of Periods"><input type="number" min="1" value={form.numberOfPeriods || ''} onChange={(e) => setForm({...form,numberOfPeriods:e.target.value})} className={inputClass} /></Field></div></Section><Section title="3. Depreciation Summary" icon={IndianRupee}><DefinitionList items={[["Purchase Value",formatMoney(purchase)],["Residual Value",formatMoney(residual)],["Depreciable Amount",formatMoney(depreciable)],["Number of Periods",periods],["Depreciation Per Period",formatMoney(perPeriod)],["Total Depreciation",formatMoney(depreciable)]]} /></Section><Section title="4. Depreciation Settings" icon={Wrench}><Field label="Residual Value"><input type="number" step="0.01" value={form.residualValue ?? ''} onChange={(e) => setForm({...form,residualValue:e.target.value})} className={inputClass} /></Field><Field label="Expense Account" className="mt-3"><input value={form.expenseAccount || ''} onChange={(e) => setForm({...form,expenseAccount:e.target.value})} className={inputClass} /></Field><Field label="Accumulated Depreciation Account" className="mt-3"><input value={form.accumulatedAccount || ''} onChange={(e) => setForm({...form,accumulatedAccount:e.target.value})} className={inputClass} /></Field></Section><Section title="5. Advanced Options" icon={FileText}><Field label="Pro-rata Convention"><Select value={form.proRataConvention} onChange={(v) => setForm({...form,proRataConvention:v})}><option value="FULL_MONTH">Full Month</option><option value="DAILY">Daily</option></Select></Field><Field label="Description" className="mt-3"><textarea value={form.description || ''} onChange={(e) => setForm({...form,description:e.target.value})} className={textareaClass} /></Field><label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={Boolean(form.includeInRun)} onChange={(e) => setForm({...form,includeInRun:e.target.checked})} />Include in depreciation run</label></Section></div><div className="mt-4 flex justify-end gap-2"><SecondaryButton onClick={() => submit(true)}>Save as Draft</SecondaryButton><PrimaryButton onClick={() => submit(false)} disabled={mutation.isPending}><Save className="h-4 w-4" />Schedule Depreciation</PrimaryButton></div></div>;
}

export function AssetDepreciationViewPage() {
  const { id } = useParams(); const queryClient = useQueryClient(); const [throughDate,setThroughDate] = useState(today()); const [error,setError] = useState(''); const query = useQuery({ queryKey:['asset-depreciation-detail',id], queryFn:()=>assetManagementApi.depreciation(id) }); const run = useMutation({ mutationFn:()=>assetManagementApi.runDepreciation(id,throughDate), onSuccess:async()=>{ await Promise.all([queryClient.invalidateQueries({queryKey:['asset-depreciation-detail',id]}),queryClient.invalidateQueries({queryKey:['asset-depreciation']})]); }, onError:(e)=>setError(errorText(e)) }); if(query.isLoading)return <LoadingState/>; if(query.isError)return <ErrorState message={errorText(query.error)}/>; const row=query.data;
  return <div><PageHeader title="Depreciation Details" description="Review schedule values and run depreciation through a selected date." actions={<><input type="date" value={throughDate} onChange={(e)=>setThroughDate(e.target.value)} className={`${inputClass} w-40`}/><PrimaryButton onClick={()=>run.mutate()} disabled={run.isPending}><Play className="h-4 w-4"/>Run Depreciation</PrimaryButton></>} /><Message error={error}/><div className="grid gap-4 xl:grid-cols-3"><Section title="Asset Summary" icon={PackageCheck}><DefinitionList items={[["Asset",row.assetName],["Asset ID",row.assetNumber],["Category",row.categoryName],["Purchase Value",formatMoney(row.purchaseValue)],["Status",<StatusBadge value={row.status}/>]]}/></Section><Section title="Schedule" icon={CalendarCheck2}><DefinitionList items={[["Method",row.method?.replaceAll('_',' ')],["Financial Year",row.financialYear],["Start Date",formatDate(row.startDate)],["End Date",formatDate(row.endDate)],["Frequency",row.frequency],["Periods",row.numberOfPeriods]]}/></Section><Section title="Book Value" icon={IndianRupee}><DefinitionList items={[["Residual Value",formatMoney(row.residualValue)],["Depreciable Amount",formatMoney(row.depreciableAmount)],["Per Period",formatMoney(row.depreciationPerPeriod)],["Accumulated Depreciation",formatMoney(row.accumulatedDepreciation)],["Net Book Value",formatMoney(row.netBookValue)],["Next Run",formatDate(row.nextRunDate)]]}/></Section></div></div>;
}

export function AssetDisposalListPage() {
  const queryClient=useQueryClient(); const [search,setSearch]=useState(''); const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [method,setMethod]=useState(''); const [categoryId,setCategoryId]=useState(''); const [status,setStatus]=useState(''); const [page,setPage]=useState(0); const [size,setSize]=useState(10); const [deleting,setDeleting]=useState(null); const params=useMemo(()=>({search,from:from||undefined,to:to||undefined,method:method||undefined,categoryId:categoryId||undefined,status:status||undefined,page,size,sort:'disposalDate,desc'}),[search,from,to,method,categoryId,status,page,size]); const query=useQuery({queryKey:['asset-disposals',params],queryFn:()=>assetManagementApi.disposalList(params),placeholderData:(p)=>p}); const summary=useQuery({queryKey:['asset-disposal-summary'],queryFn:()=>assetManagementApi.disposalList({page:0,size:500})}); const categoriesQuery=useQuery({queryKey:['asset-workflow-categories'],queryFn:()=>assetManagementApi.categories({page:0,size:500,sort:'categoryName,asc'})}); const rows=contentOf(query.data),all=contentOf(summary.data),categories=contentOf(categoriesQuery.data); const remove=useMutation({mutationFn:(row)=>assetManagementApi.deleteDisposal(row.id),onSuccess:async()=>{setDeleting(null);await Promise.all([queryClient.invalidateQueries({queryKey:['asset-disposals']}),queryClient.invalidateQueries({queryKey:['asset-disposal-summary']}),queryClient.invalidateQueries({queryKey:['assets']}),queryClient.invalidateQueries({queryKey:['asset-dashboard']})]);}}); useEffect(()=>setPage(0),[search,from,to,method,categoryId,status]);
  return <div><PageHeader title="Asset Disposal List" description="Track and manage disposal of company assets." actions={<Link to="/asset-management/disposals/new"><PrimaryButton><Plus className="h-4 w-4"/>Add Disposal</PrimaryButton></Link>}/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard icon={PackageCheck} label="Total Disposals" value={all.length}/><MetricCard icon={CalendarCheck2} label="Pending" value={all.filter((r)=>r.status==='PENDING_APPROVAL').length} tone="amber"/><MetricCard icon={CheckCircle2} label="Completed" value={all.filter((r)=>r.status==='COMPLETED').length} tone="green"/><MetricCard icon={IndianRupee} label="Total Disposal Value" value={formatMoney(all.reduce((s,r)=>s+Number(r.disposalValue||0),0))} tone="blue"/><MetricCard icon={IndianRupee} label="Total Gain / Loss" value={formatMoney(all.reduce((s,r)=>s+Number(r.gainLossAmount||0),0))} tone="violet"/></div><div className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm">
<AssetFilterStrip template="minmax(220px,1fr) minmax(250px,1.1fr) 130px 150px 130px auto" minWidth={1080}><SearchField value={search} onChange={setSearch} placeholder="Search disposal, asset or category..."/><div className="grid grid-cols-2 gap-2"><input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className={inputClass} aria-label="Disposal date from"/><input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className={inputClass} aria-label="Disposal date to"/></div><Select value={method} onChange={setMethod}><option value="">All Methods</option>{['SOLD','SCRAPPED','DONATED','TRADED_IN','LOST','WRITTEN_OFF','RETURNED_TO_VENDOR'].map((v)=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</Select><Select value={categoryId} onChange={setCategoryId}><option value="">All Categories</option>{categories.map((row)=><option key={row.id} value={row.id}>{row.categoryName}</option>)}</Select><Select value={status} onChange={setStatus}><option value="">All Statuses</option>{['DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','COMPLETED','REVERSED'].map((v)=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</Select><SecondaryButton onClick={()=>{setSearch('');setFrom('');setTo('');setMethod('');setCategoryId('');setStatus('');}} className="whitespace-nowrap">Clear</SecondaryButton></AssetFilterStrip>
{query.isLoading?<LoadingState/>:rows.length?<div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="px-4 py-3">Disposal ID</th><th>Asset</th><th>Category</th><th>Date</th><th>Method</th><th>Value</th><th>Gain / Loss</th><th>Status</th><th>Approved By</th><th className="pr-4 text-right">Actions</th></tr></thead><tbody>{rows.map((row)=><tr key={row.id} className="border-t hover:bg-slate-50"><td className="px-4 py-3"><Link to={`/asset-management/disposals/${row.id}`} className="font-black text-blue-600">{row.disposalNumber}</Link></td><td className="font-black text-[#07164d]">{row.assetName}<small className="block text-slate-500">{row.assetNumber}</small></td><td>{row.categoryName}</td><td>{formatDate(row.disposalDate)}</td><td>{row.disposalMethod?.replaceAll('_',' ')}</td><td>{formatMoney(row.disposalValue)}</td><td className={Number(row.gainLossAmount)>=0?'text-emerald-600':'text-red-600'}>{formatMoney(row.gainLossAmount)}</td><td><StatusBadge value={row.status}/></td><td>{row.approvedBy||'-'}</td><td className="pr-4"><RowActions><IconLink to={`/asset-management/disposals/${row.id}`} title="View" icon={Eye}/><IconLink to={`/asset-management/disposals/${row.id}/edit`} title="Edit" icon={FileText}/><IconButton title="Delete" icon={Trash2} danger onClick={()=>setDeleting(row)}/></RowActions></td></tr>)}</tbody></table></div>:<EmptyState title="No disposal records found"/>}<Pagination page={page} totalPages={totalPagesOf(query.data)} size={size} onPage={setPage} onSize={(v)=>{setSize(v);setPage(0);}}/></div><ConfirmDialog open={Boolean(deleting)} title="Delete disposal record?" message={`${deleting?.disposalNumber||'This disposal'} will be permanently deleted.`} loading={remove.isPending} onCancel={()=>setDeleting(null)} onConfirm={()=>remove.mutate(deleting)}/></div>;
}

const disposalDefaults={assetId:'',disposalDate:today(),disposalMethod:'SOLD',buyerVendorId:'',buyerVendorName:'',referenceNumber:'',reason:'',gainLossAccount:'Asset Disposal Gain/Loss',disposalValue:'',remarks:'',draft:false};

export function AssetDisposalFormPage(){
  const {id}=useParams();const navigate=useNavigate();const queryClient=useQueryClient();const [params]=useSearchParams();const assetsQuery=useAssets();const vendorsQuery=useVendors();const detail=useQuery({queryKey:['asset-disposal-detail',id],queryFn:()=>assetManagementApi.disposal(id),enabled:Boolean(id)});const [form,setForm]=useState({...disposalDefaults,assetId:params.get('assetId')||''});const [error,setError]=useState('');useEffect(()=>{if(detail.data)setForm({...disposalDefaults,...detail.data,assetId:detail.data.assetId||'',buyerVendorId:detail.data.buyerVendorId||''});},[detail.data]);const assets=contentOf(assetsQuery.data),vendors=contentOf(vendorsQuery.data),asset=assets.find((r)=>String(r.id)===String(form.assetId))||detail.data?.asset;const book=Number(asset?.netBookValue||asset?.currentValue||0),value=Number(form.disposalValue||0),gain=value-book,percentage=book?gain/book*100:0;const mutation=useMutation({mutationFn:(payload)=>id?assetManagementApi.updateDisposal(id,payload):assetManagementApi.createDisposal(payload),onSuccess:async(saved)=>{await Promise.all([queryClient.invalidateQueries({queryKey:['asset-disposals']}),queryClient.invalidateQueries({queryKey:['asset-disposal-summary']}),queryClient.invalidateQueries({queryKey:['assets']}),queryClient.invalidateQueries({queryKey:['asset-options']}),queryClient.invalidateQueries({queryKey:['asset-eligible-options']}),queryClient.invalidateQueries({queryKey:['asset-depreciation']})]);navigate(`/asset-management/disposals/${saved.id||id}`);},onError:(e)=>setError(errorText(e))});const submit=(draft)=>{if(!form.assetId||!form.disposalDate||!form.disposalMethod)return setError('Asset, disposal date and method are required.');if(!draft&&!form.reason?.trim())return setError('Reason for disposal is required.');if(!draft&&form.disposalValue==='')return setError('Disposal value is required.');const vendor=vendors.find((r)=>String(r.id)===String(form.buyerVendorId));mutation.mutate({...form,assetId:number(form.assetId),disposalDate:form.disposalDate||today(),disposalMethod:String(form.disposalMethod||'SOLD').toUpperCase(),buyerVendorId:form.buyerVendorId?number(form.buyerVendorId):null,buyerVendorName:String(vendor?.vendorName||form.buyerVendorName||'').trim()||null,referenceNumber:String(form.referenceNumber||'').trim()||null,reason:String(form.reason||'').trim()||null,gainLossAccount:String(form.gainLossAccount||'').trim()||null,disposalValue:form.disposalValue===''?null:Math.max(0,number(form.disposalValue)||0),remarks:String(form.remarks||'').trim()||null,draft});};
  return <div><PageHeader title={id?'Edit Disposal':'Add New Disposal'} description="Record and manage an asset disposal." actions={<SecondaryButton onClick={()=>navigate('/asset-management/disposals')}><ArrowLeft className="h-4 w-4"/>Back to List</SecondaryButton>}/><Message error={error}/><div className="grid gap-4 xl:grid-cols-3"><div className="space-y-4"><Section title="Asset Information" icon={PackageCheck}><Field label="Asset" required><Select value={form.assetId} onChange={(v)=>setForm({...form,assetId:v})}><option value="">Select asset</option>{assets.filter((r)=>!['DISPOSED','RETIRED','LOST','WRITTEN_OFF'].includes(r.status)||String(r.id)===String(form.assetId)).map((r)=><option key={r.id} value={r.id}>{assetLabel(r)}</option>)}</Select></Field>{asset&&<DefinitionList items={[["Category",asset.categoryName],["Location",asset.locationName],["Purchase Date",formatDate(asset.purchaseDate)],["Purchase Value",formatMoney(asset.purchaseValue)],["Current Status",asset.status]]}/>}</Section><Section title="Depreciation Details" icon={IndianRupee}><DefinitionList items={[["Depreciation Method",asset?.depreciationMethod],["Accumulated Depreciation",formatMoney(asset?.accumulatedDepreciation)],["Net Book Value",formatMoney(book)]]}/></Section></div><div className="space-y-4"><Section title="Disposal Information" icon={Trash2}><div className="grid gap-3 sm:grid-cols-2"><Field label="Disposal Date" required><input type="date" value={form.disposalDate||''} onChange={(e)=>setForm({...form,disposalDate:e.target.value})} className={inputClass}/></Field><Field label="Method" required><Select value={form.disposalMethod} onChange={(v)=>setForm({...form,disposalMethod:v})}>{['SOLD','SCRAPPED','DONATED','TRADED_IN','LOST','WRITTEN_OFF','RETURNED_TO_VENDOR'].map((v)=><option key={v}>{v}</option>)}</Select></Field></div><Field label="Buyer / Vendor" className="mt-3"><Select value={form.buyerVendorId} onChange={(v)=>setForm({...form,buyerVendorId:v})}><option value="">Select vendor</option>{vendors.map((r)=><option key={r.id} value={r.id}>{r.vendorName}</option>)}</Select></Field><Field label="Reference / Invoice No." className="mt-3"><input value={form.referenceNumber||''} onChange={(e)=>setForm({...form,referenceNumber:e.target.value})} className={inputClass}/></Field><Field label="Reason" className="mt-3"><input value={form.reason||''} onChange={(e)=>setForm({...form,reason:e.target.value})} className={inputClass}/></Field></Section><Section title="Financial Impact" icon={IndianRupee}><Field label="Disposal Value" required><input type="number" step="0.01" value={form.disposalValue??''} onChange={(e)=>setForm({...form,disposalValue:e.target.value})} className={inputClass}/></Field><DefinitionList items={[["Net Book Value",formatMoney(book)],["Gain / (Loss)",formatMoney(gain)],["Gain / (Loss) %",`${percentage.toFixed(2)}%`]]}/></Section></div><Section title="Notes & Remarks" icon={FileText}><Field label="Remarks"><textarea value={form.remarks||''} onChange={(e)=>setForm({...form,remarks:e.target.value})} className={`${textareaClass} min-h-52`}/></Field></Section></div><div className="mt-4 flex justify-end gap-2"><SecondaryButton onClick={()=>submit(true)}>Save as Draft</SecondaryButton><PrimaryButton onClick={()=>submit(false)} disabled={mutation.isPending}><Save className="h-4 w-4"/>Save Disposal</PrimaryButton></div></div>;
}

export function AssetDisposalViewPage(){
  const {id}=useParams();const queryClient=useQueryClient();const [error,setError]=useState('');const query=useQuery({queryKey:['asset-disposal-detail',id],queryFn:()=>assetManagementApi.disposal(id)});const statusMutation=useMutation({mutationFn:(status)=>assetManagementApi.updateDisposalStatus(id,{status,notes:`Disposal ${status.toLowerCase().replaceAll('_',' ')}.`}),onSuccess:async()=>{await Promise.all([queryClient.invalidateQueries({queryKey:['asset-disposal-detail',id]}),queryClient.invalidateQueries({queryKey:['asset-disposals']}),queryClient.invalidateQueries({queryKey:['assets']})]);},onError:(e)=>setError(errorText(e))});if(query.isLoading)return <LoadingState/>;if(query.isError)return <ErrorState message={errorText(query.error)}/>;const row=query.data;
  return <div><PageHeader title="Disposal Details" description="View and manage detailed information about this asset disposal." actions={<><Link to={`/asset-management/disposals/${id}/edit`}><SecondaryButton>Edit</SecondaryButton></Link>{row.status==='PENDING_APPROVAL'&&<PrimaryButton onClick={()=>statusMutation.mutate('APPROVED')}>Approve</PrimaryButton>}{row.status==='APPROVED'&&<PrimaryButton onClick={()=>statusMutation.mutate('COMPLETED')}>Complete Disposal</PrimaryButton>}{row.status==='COMPLETED'&&<SecondaryButton onClick={()=>statusMutation.mutate('REVERSED')}><RotateCcw className="h-4 w-4"/>Reverse</SecondaryButton>}</>}/><Message error={error}/><Section title={row.assetName} icon={PackageCheck}><DefinitionList items={[["Asset ID",row.assetNumber],["Category",row.categoryName],["Disposal ID",row.disposalNumber],["Disposal Date",formatDate(row.disposalDate)],["Status",<StatusBadge value={row.status}/>],["Method",row.disposalMethod?.replaceAll('_',' ')]]}/></Section><div className="mt-4 grid gap-4 xl:grid-cols-3"><Section title="Asset Information" icon={PackageCheck}><DefinitionList items={[["Asset Name",row.assetName],["Asset ID",row.assetNumber],["Category",row.categoryName],["Location",row.asset?.locationName],["Purchase Date",formatDate(row.asset?.purchaseDate)],["Purchase Value",formatMoney(row.asset?.purchaseValue)]]}/></Section><Section title="Disposal Information" icon={Trash2}><DefinitionList items={[["Disposal Number",row.disposalNumber],["Date",formatDate(row.disposalDate)],["Method",row.disposalMethod],["Buyer / Vendor",row.buyerVendorName],["Reference",row.referenceNumber],["Reason",row.reason]]}/></Section><Section title="Financial Impact" icon={IndianRupee}><DefinitionList items={[["Net Book Value",formatMoney(row.netBookValue)],["Disposal Value",formatMoney(row.disposalValue)],["Gain / Loss",formatMoney(row.gainLossAmount)],["Gain / Loss %",`${Number(row.gainLossPercentage||0).toFixed(2)}%`]]}/></Section><Section title="Approval Information" icon={ClipboardCheck}><DefinitionList items={[["Approved By",row.approvedBy],["Approved On",row.approvedAt||'-'],["Notes",row.approvalNotes||'-']]}/></Section><Section title="Remarks" icon={FileText} className="xl:col-span-2"><p className="text-sm font-semibold leading-6 text-slate-600">{row.remarks||'No remarks recorded.'}</p></Section></div></div>;
}
