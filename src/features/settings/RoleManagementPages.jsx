import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Copy, MoreVertical, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound, X } from 'lucide-react';
import { recordsApi } from '../../api/recordsApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { PERMISSION_ACTIONS, permissionCode, permissionRegistry } from '../../config/permissionRegistry.js';

const MODULE = 'settings';
const TYPE = 'roles';

function parseNotes(value) {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
}

function fromRecord(record) {
  const notes = parseNotes(record?.notes);
  return {
    id: record?.id,
    name: record?.partyName || '',
    description: notes.description || '',
    status: record?.status || 'Active',
    roleType: notes.roleType || 'Custom Role',
    isDefault: Boolean(notes.isDefault),
    isSystemRole: Boolean(notes.isSystemRole),
    assignedUsers: Number(notes.assignedUsers || 0),
    permissions: Array.isArray(notes.permissions) ? notes.permissions : [],
    createdAt: record?.recordDate || '',
    updatedAt: notes.updatedAt || record?.recordDate || '',
  };
}

function payload(form) {
  const date = new Date().toISOString().slice(0, 10);
  return {
    recordNumber: form.id ? `ROLE-${form.id}` : `ROLE-${String(Date.now()).slice(-8)}`,
    partyName: form.name.trim(), category: form.roleType, status: form.status,
    amount: 0, balanceAmount: 0, recordDate: form.createdAt || date, dueDate: date,
    ownerName: 'Admin',
    notes: JSON.stringify({
      description: form.description.trim(), roleType: form.roleType,
      isDefault: form.isDefault, isSystemRole: form.isSystemRole,
      assignedUsers: form.assignedUsers || 0, permissions: [...form.permissions], updatedAt: date,
    }),
  };
}

function TriCheckbox({ checked, indeterminate = false, disabled = false, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return <input ref={ref} aria-label={label} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange?.(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-red-600 disabled:opacity-30" />;
}

function Notice({ children, error = false }) {
  if (!children) return null;
  return <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</div>;
}

export function RolesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [assigned, setAssigned] = useState('All');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const query = useQuery({ queryKey: [MODULE, TYPE, 'role-list'], queryFn: () => recordsApi.list({ module: MODULE, type: TYPE, page: 0, size: 200, sort: 'partyName,asc' }) });
  const roles = useMemo(() => (query.data?.content || []).map(fromRecord).filter((role) => {
    const text = `${role.name} ${role.description}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (status === 'All' || role.status === status) && (assigned === 'All' || (assigned === 'Assigned' ? role.assignedUsers > 0 : role.assignedUsers === 0));
  }), [query.data, search, status, assigned]);
  const remove = useMutation({ mutationFn: (id) => recordsApi.remove({ module: MODULE, type: TYPE, id }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: [MODULE, TYPE] }); setDeleteTarget(null); } });

  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-black text-[#07152c]">Roles</h1><p className="mt-1 text-sm font-medium text-slate-500">Manage database-driven roles and module permissions.</p></div>
      <Link to="/settings/roles/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-red-700"><Plus className="h-4 w-4" /> Create Role</Link>
    </div>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roles..." className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-[13px] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
      <select aria-label="Role status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 min-w-[145px] rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium outline-none focus:border-red-400"><option>All</option><option>Active</option><option>Inactive</option></select>
      <select aria-label="Role assignment" value={assigned} onChange={(e) => setAssigned(e.target.value)} className="h-10 min-w-[155px] rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium outline-none focus:border-red-400"><option>All</option><option>Assigned</option><option>Unassigned</option></select>
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-[13px]"><thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr>{['Role Name','Description','Assigned Users','Status','Created On','Updated On','Actions'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{roles.map((role) => <tr key={role.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><Link className="font-black text-[#07152c] hover:text-red-600" to={`/settings/roles/${role.id}`}>{role.name}</Link>{role.isSystemRole && <span className="ml-2 rounded bg-red-50 px-2 py-1 text-[10px] font-black text-red-600">SYSTEM</span>}</td><td className="max-w-[300px] px-4 py-3 text-slate-500">{role.description || '—'}</td><td className="px-4 py-3 font-bold">{role.assignedUsers}</td><td className="px-4 py-3"><span className={`rounded-md px-2.5 py-1 text-[11px] font-black ${role.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{role.status}</span></td><td className="px-4 py-3 text-slate-500">{role.createdAt || '—'}</td><td className="px-4 py-3 text-slate-500">{role.updatedAt || '—'}</td><td className="px-4 py-3"><div className="flex gap-2"><Link title="View" to={`/settings/roles/${role.id}`} className="grid h-8 w-8 place-items-center rounded border border-slate-200"><MoreVertical className="h-4 w-4" /></Link><Link title="Edit" to={`/settings/roles/${role.id}/edit`} className="grid h-8 w-8 place-items-center rounded border border-slate-200"><Pencil className="h-4 w-4" /></Link><button title="Delete" disabled={role.isSystemRole || role.assignedUsers > 0} onClick={() => setDeleteTarget(role)} className="grid h-8 w-8 place-items-center rounded border border-red-100 text-red-600 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>{!roles.length && <div className="p-12 text-center text-[13px] font-bold text-slate-400">No roles found.</div>}</div>
    <ConfirmDialog open={Boolean(deleteTarget)} title="Delete role?" message={deleteTarget?.assignedUsers ? 'This role cannot be deleted because users are assigned to it.' : `Delete ${deleteTarget?.name || 'this role'}?`} loading={remove.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => remove.mutate(deleteTarget.id)} />
  </section>;
}

function MorePermissionsModal({ item, selected, onClose, onSave }) {
  const [values, setValues] = useState(() => new Set(item.extras.filter((action) => selected.has(permissionCode(item.moduleCode, item.code, action)))));
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4"><form onSubmit={(e) => { e.preventDefault(); onSave(values); }} className="w-full max-w-xl rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-6 py-4"><div><h2 className="text-lg font-black text-[#07152c]">More Permissions</h2><p className="text-sm text-slate-500">{item.name}</p></div><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div><div className="grid gap-3 p-6 sm:grid-cols-2">{item.extras.map((action) => <label key={action} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold"><TriCheckbox checked={values.has(action)} onChange={(checked) => setValues((current) => { const next = new Set(current); checked ? next.add(action) : next.delete(action); return next; })} /><span>{action.replaceAll('_', ' ')}</span></label>)}</div><div className="flex justify-end gap-3 border-t px-6 py-4"><button type="button" onClick={onClose} className="h-10 rounded-lg border px-5 text-sm font-bold">Cancel</button><button className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white">Apply</button></div></form></div>;
}

export function RoleFormPage() {
  const { id } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', status: 'Active', roleType: 'Custom Role', isDefault: false, isSystemRole: false, assignedUsers: 0, permissions: new Set() });
  const [expanded, setExpanded] = useState(() => new Set(['SALES'])); const [search, setSearch] = useState(''); const [error, setError] = useState(''); const [moreItem, setMoreItem] = useState(null);
  const roleQuery = useQuery({ queryKey: [MODULE, TYPE, id], enabled: Boolean(id), queryFn: () => recordsApi.get({ module: MODULE, type: TYPE, id }) });
  const rolesQuery = useQuery({ queryKey: [MODULE, TYPE, 'copy-options'], queryFn: () => recordsApi.list({ module: MODULE, type: TYPE, page: 0, size: 200, sort: 'partyName,asc' }) });
  useEffect(() => { if (roleQuery.data) { const role = fromRecord(roleQuery.data); setForm({ ...role, permissions: new Set(role.permissions) }); } }, [roleQuery.data]);
  const save = useMutation({ mutationFn: () => { const body = payload({ ...form, permissions: [...form.permissions] }); return id ? recordsApi.update({ module: MODULE, type: TYPE, id, payload: body }) : recordsApi.create({ module: MODULE, type: TYPE, payload: body }); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: [MODULE, TYPE] }); navigate('/settings/roles'); }, onError: (e) => setError(e.response?.data?.message || 'Unable to save role.') });
  const setPermissions = (updater) => setForm((current) => ({ ...current, permissions: typeof updater === 'function' ? updater(current.permissions) : updater }));
  const itemCodes = (module, item) => [...item.actions, ...item.extras].map((a) => permissionCode(module.code, item.code, a));
  const toggleItemAction = (module, item, action, checked) => setPermissions((current) => { const next = new Set(current); const code = permissionCode(module.code, item.code, action); if (checked) { next.add(code); if (action !== 'VIEW') next.add(permissionCode(module.code, item.code, 'VIEW')); } else { next.delete(code); if (action === 'VIEW') itemCodes(module, item).forEach((entry) => next.delete(entry)); } return next; });
  const toggleFull = (module, item, checked) => setPermissions((current) => { const next = new Set(current); itemCodes(module, item).forEach((code) => checked ? next.add(code) : next.delete(code)); return next; });
  const toggleModule = (module, checked) => setPermissions((current) => { const next = new Set(current); module.items.flatMap((i) => itemCodes(module, i)).forEach((code) => checked ? next.add(code) : next.delete(code)); return next; });
  const allCodes = permissionRegistry.flatMap((m) => m.items.flatMap((i) => itemCodes(m, i)));
  const visibleModules = permissionRegistry.map((module) => ({ ...module, items: module.items.filter((item) => !search || `${module.name} ${item.name} ${item.actions.join(' ')} ${item.extras.join(' ')}`.toLowerCase().includes(search.toLowerCase())) })).filter((module) => module.items.length);

  const submit = () => { if (!form.name.trim()) return setError('Role name is required.'); if (!form.permissions.size) return setError('Please select at least one permission.'); setError(''); save.mutate(); };
  return <section className="space-y-3 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-xs font-bold text-slate-500">Settings <span className="mx-2">›</span> Roles <span className="mx-2">›</span> {id ? 'Edit Role' : 'Create Role'}</div><h1 className="mt-2 text-2xl font-black text-[#07152c]">{id ? 'Edit Role' : 'Create Role'}</h1></div><div className="role-form-actions"><button onClick={() => navigate('/settings/roles')} className="role-form-action role-form-action-secondary">Cancel</button><button onClick={submit} disabled={save.isPending || form.isSystemRole} className="role-form-action role-form-action-primary">{save.isPending ? 'Saving...' : 'Save Role'}</button></div></div>
    <Notice error>{error}</Notice>
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-4 text-base font-black text-red-600">Role Information</h2><div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-12"><label className="xl:col-span-3"><span className="mb-1.5 block text-xs font-bold">Role Name <b className="text-red-600">*</b></span><input value={form.name} disabled={form.isSystemRole} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter role name" className="h-10 w-full rounded-md border border-slate-200 px-3 text-[13px] outline-none focus:border-red-400" /></label><label className="sm:col-span-2 xl:col-span-4"><span className="mb-1.5 block text-xs font-bold">Description</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Enter role description" className="h-10 w-full rounded-md border border-slate-200 px-3 text-[13px] outline-none focus:border-red-400" /></label><label className="xl:col-span-2"><span className="mb-1.5 block text-xs font-bold">Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium outline-none focus:border-red-400"><option>Active</option><option>Inactive</option></select></label><label className="xl:col-span-3"><span className="mb-1.5 block text-xs font-bold">Role Type</span><select value={form.roleType} onChange={(e) => setForm({ ...form, roleType: e.target.value })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium outline-none focus:border-red-400"><option>Custom Role</option><option>Standard Role</option></select></label><label className="sm:col-span-1 xl:col-span-4"><span className="mb-1.5 block text-xs font-bold">Copy Permissions From</span><select defaultValue="" onChange={(e) => { const source = (rolesQuery.data?.content || []).map(fromRecord).find((r) => String(r.id) === e.target.value); if (source) setPermissions(new Set(source.permissions)); }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium outline-none focus:border-red-400"><option value="">Select Role (Optional)</option>{(rolesQuery.data?.content || []).map(fromRecord).filter((r) => String(r.id) !== String(id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label className="flex min-h-10 items-center gap-2 pt-5 sm:col-span-1 xl:col-span-3"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="h-4 w-4 accent-red-600" /><span className="text-[13px] font-bold">Set as Default Role</span></label></div></article>
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="text-base font-black text-red-600">Permissions</h2><p className="text-xs font-medium text-slate-500">Set permissions for modules and submodules</p></div><div className="flex w-full flex-wrap gap-2 lg:w-auto"><label className="relative w-full sm:w-52"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search permissions..." className="h-9 w-full rounded-md border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-red-400" /></label>{[['Select All', () => setPermissions(new Set(allCodes))], ['Clear All', () => setPermissions(new Set())], ['Expand All', () => setExpanded(new Set(permissionRegistry.map((m) => m.code)))], ['Collapse All', () => setExpanded(new Set())]].map(([label, fn]) => <button key={label} onClick={fn} className="h-9 rounded-md border border-red-200 px-3 text-xs font-bold text-red-600">{label}</button>)}</div></div><div className="overflow-x-auto"><table className="role-permission-table w-full min-w-[920px] table-fixed text-[13px]"><thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-black"><tr><th className="w-[30%] px-4 py-3 text-left">Particulars</th>{['Full','View','Create','Edit','Delete','Download'].map((h) => <th key={h} className="w-[9%] px-2 py-3 text-center">{h}</th>)}<th className="px-3 py-3 text-left">Others</th></tr></thead><tbody>{visibleModules.map((module) => { const codes = module.items.flatMap((item) => itemCodes(module, item)); const count = codes.filter((c) => form.permissions.has(c)).length; const open = expanded.has(module.code) || Boolean(search); return <FragmentRow key={module.code}><tr className="role-permission-module-row border-t bg-slate-50/60"><td className="px-4 py-3"><div className="flex items-center gap-3"><button onClick={() => setExpanded((current) => { const next = new Set(current); next.has(module.code) ? next.delete(module.code) : next.add(module.code); return next; })}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button><TriCheckbox checked={count === codes.length && codes.length > 0} indeterminate={count > 0 && count < codes.length} onChange={(checked) => toggleModule(module, checked)} label={`${module.name} full`} /><span className="font-black text-[#07152c]">{module.name}</span></div></td><td colSpan="7" /></tr>{open && module.items.map((item) => { const codesForItem = itemCodes(module, item); const selectedCount = codesForItem.filter((c) => form.permissions.has(c)).length; const full = selectedCount === codesForItem.length && codesForItem.length > 0; return <tr key={item.code} className="role-permission-child-row border-t border-slate-100"><td className="role-permission-child-cell py-3 pr-3 font-semibold text-slate-700"><span className="role-permission-child-name">{item.name}</span></td><td className="text-center"><TriCheckbox checked={full} indeterminate={selectedCount > 0 && !full} onChange={(checked) => toggleFull(module, item, checked)} label={`${item.name} full`} /></td>{PERMISSION_ACTIONS.map((action) => { const supported = item.actions.includes(action); return <td key={action} className="text-center"><TriCheckbox disabled={!supported} checked={supported && form.permissions.has(permissionCode(module.code, item.code, action))} onChange={(checked) => toggleItemAction(module, item, action, checked)} label={`${item.name} ${action}`} /></td>; })}<td className="px-3">{item.extras.length ? <button onClick={() => setMoreItem(item)} className="text-xs font-black text-red-600">More Permissions {item.extras.some((a) => form.permissions.has(permissionCode(module.code, item.code, a))) && '●'}</button> : '—'}</td></tr>; })}</FragmentRow>; })}</tbody></table></div><div className="m-4 rounded-lg border border-red-100 bg-red-50/60 px-4 py-3 text-xs font-semibold text-slate-600"><b className="text-red-600">Note:</b> Create, Edit, Delete and Download require View permission. Clearing View automatically clears dependent permissions.</div></article>
    {moreItem && <MorePermissionsModal item={moreItem} selected={form.permissions} onClose={() => setMoreItem(null)} onSave={(values) => { setPermissions((current) => { const next = new Set(current); moreItem.extras.forEach((a) => next.delete(permissionCode(moreItem.moduleCode, moreItem.code, a))); values.forEach((a) => { next.add(permissionCode(moreItem.moduleCode, moreItem.code, a)); next.add(permissionCode(moreItem.moduleCode, moreItem.code, 'VIEW')); }); return next; }); setMoreItem(null); }} />}
  </section>;
}

function FragmentRow({ children }) { return children; }

export function RoleDetailsPage() {
  const { id } = useParams(); const query = useQuery({ queryKey: [MODULE, TYPE, id], queryFn: () => recordsApi.get({ module: MODULE, type: TYPE, id }) }); const role = query.data ? fromRecord(query.data) : null;
  if (!role) return <div className="rounded-xl border bg-white p-10 text-center font-bold text-slate-400">Loading role...</div>;
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-xl bg-red-50 text-red-600"><ShieldCheck className="h-7 w-7" /></span><div><h1 className="text-2xl font-black text-[#07152c]">{role.name}</h1><p className="text-sm text-slate-500">{role.description || 'No description'}</p></div></div><div className="flex gap-3"><Link to={`/settings/roles/${id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white"><Pencil className="h-4 w-4" /> Edit Role</Link></div></div><div className="grid gap-4 md:grid-cols-4">{[['Status',role.status],['Role Type',role.roleType],['Assigned Users',role.assignedUsers],['Permissions',role.permissions.length]].map(([label,value]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-bold uppercase text-slate-400">{label}</div><div className="mt-2 text-xl font-black text-[#07152c]">{value}</div></article>)}</div><article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-red-600">Permissions</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{permissionRegistry.map((module) => { const items = module.items.map((item) => ({ ...item, selected: [...item.actions, ...item.extras].filter((action) => role.permissions.includes(permissionCode(module.code, item.code, action))) })).filter((item) => item.selected.length); if (!items.length) return null; return <div key={module.code} className="rounded-lg border border-slate-200 p-4"><h3 className="font-black text-[#07152c]">{module.name}</h3>{items.map((item) => <div key={item.code} className="mt-3"><div className="text-sm font-bold">{item.name}</div><div className="mt-1 text-xs text-slate-500">{item.selected.join(', ').replaceAll('_', ' ')}</div></div>)}</div>; })}</div></article></section>;
}
