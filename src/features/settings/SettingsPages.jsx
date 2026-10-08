import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Mail,
  Palette,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-react';
import { recordsApi } from '../../api/recordsApi.js';
import { storageApi } from '../../api/storageApi.js';
import { resourceUsersApi, usersApi } from '../../api/authApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { useAuthStore } from '../../store/authStore.js';

const MODULE = 'settings';
const today = () => new Date().toISOString().slice(0, 10);

const organizationLinks = [
  { to: '/settings/organization/profile', label: 'Profile', description: 'Company details, tax profile, address and contact information.' },
  { to: '/settings/organization/branding', label: 'Branding', description: 'Logo, theme color, invoice styling and document identity.' },
];

const accessLinks = [
  { to: '/settings/users', label: 'Users', description: 'Invite, activate and manage team members.' },
  { to: '/settings/roles', label: 'Roles', description: 'Control permissions by module and responsibility.' },
];
const masterLinks = [
  { to: '/settings/masters/item-categories', label: 'Item Categories', description: 'Manage IT service categories used by Items.' },
  { to: '/settings/masters/bank-accounts', label: 'Bank Accounts', description: 'Manage centralized bank accounts used across financial transactions.' },
  { to: '/settings/masters/expense-accounts', label: 'Expense Accounts', description: 'Manage active Expense Account dropdown values and historical usage.' },
  { to: '/settings/masters/domain-industries', label: 'Domains / Industries', description: 'Manage domains available for Fixed Cost Projects.' },
];
const integrationLinks = [
  { to: '/settings/irp', label: 'IRN / E-Invoice Settings', description: 'Manage encrypted EY IRP 5 Sandbox and Production credentials.' },
];

const defaultOrganization = {
  organizationName: 'IntelliaTech Pvt. Ltd.',
  gstin: '33AABCU9603R1ZP',
  pan: 'AABCU9603R',
  email: 'accounts@intelliatech.com',
  phone: '+91 98765 43210',
  currency: 'INR - Indian Rupee',
  country: 'India',
  state: 'Tamil Nadu (33)',
  city: '',
  pinCode: '',
  address: 'S61 Stirling Highway, Cottesloe, Tamil Nadu',
  tdsBaseType: 'TAXABLE_VALUE',
};

const defaultBranding = {
  brandName: 'IntelliaTech Books',
  primaryColor: '#dc2626',
  documentFooter: 'Growth. Insights. Success.',
  logoUrl: '',
};

const emptyUser = {
  resourceId: '',
  resourceName: '',
  email: '',
  role: '',
  status: 'Active',
  password: '',
  confirmPassword: '',
};

const emptyRole = {
  name: '',
  description: '',
  scope: '',
  permissions: '',
  status: 'Active',
};

function parseNotes(notes) {
  if (!notes) return {};
  try {
    return JSON.parse(notes);
  } catch {
    return {};
  }
}

function organizationFromRecord(record) {
  if (!record) return defaultOrganization;
  const notes = parseNotes(record.notes);
  return {
    organizationName: record.partyName || defaultOrganization.organizationName,
    gstin: record.referenceNumber || defaultOrganization.gstin,
    pan: notes.pan || defaultOrganization.pan,
    email: record.partyEmail || defaultOrganization.email,
    phone: record.partyPhone || defaultOrganization.phone,
    currency: record.paymentMode || defaultOrganization.currency,
    country: notes.country || defaultOrganization.country,
    state: notes.state || defaultOrganization.state,
    city: notes.city || defaultOrganization.city,
    pinCode: notes.pinCode || notes.pincode || notes.postalCode || defaultOrganization.pinCode,
    address: notes.address || record.partyCity || defaultOrganization.address,
    tdsBaseType: notes.tdsBaseType || defaultOrganization.tdsBaseType,
  };
}

function brandingFromRecord(record) {
  if (!record) return defaultBranding;
  const notes = parseNotes(record.notes);
  return {
    brandName: record.partyName || defaultBranding.brandName,
    primaryColor: record.referenceNumber || defaultBranding.primaryColor,
    documentFooter: notes.documentFooter || defaultBranding.documentFooter,
    logoUrl: notes.logoUrl || defaultBranding.logoUrl,
  };
}

function resolveBrandLogoUrl(url) {
  if (!url) return '';
  const marker = '/branding/logo/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0 || !url.includes('.amazonaws.com/')) return url;
  const fileName = url.slice(markerIndex + marker.length).split(/[?#]/)[0];
  return fileName ? `/branding-assets/${encodeURIComponent(fileName)}` : url;
}

function userFromRecord(record) {
  return {
    id: record.id,
    resourceId: record.resourceId || '',
    resourceName: record.name || '',
    name: record.name || '',
    email: record.email || '',
    managerUserId: record.managerUserId || '',
    managerName: record.managerName || '',
    role: record.roleLabel || record.role || '',
    designation: record.designation || '',
    access: Array.isArray(record.access) ? record.access.join(', ') : record.access || '',
    status: record.status || 'Active',
    password: '', confirmPassword: '', passwordConfigured: record.passwordConfigured,
  };
}

function roleFromRecord(record) {
  const notes = parseNotes(record.notes);
  return {
    id: record.id,
    name: record.partyName || '',
    description: notes.description || record.notes || '',
    scope: record.category || '',
    permissions: Array.isArray(notes.permissions) ? notes.permissions.join(', ') : notes.permissions || '',
    status: record.status || 'Active',
  };
}

function basePayload(recordNumber) {
  return {
    recordNumber,
    amount: 0,
    balanceAmount: 0,
    recordDate: today(),
    dueDate: today(),
    ownerName: 'Admin',
  };
}

function organizationPayload(form) {
  return {
    ...basePayload('ORG-001'),
    partyName: form.organizationName,
    partyEmail: form.email,
    partyPhone: form.phone,
    partyCity: form.city,
    category: 'Organization',
    status: 'Active',
    referenceNumber: form.gstin,
    paymentMode: form.currency,
    notes: JSON.stringify({ pan: form.pan, country: form.country, state: form.state, city: form.city, pinCode: form.pinCode, address: form.address, tdsBaseType: form.tdsBaseType }),
  };
}

function brandingPayload(form) {
  return {
    ...basePayload('BRAND-001'),
    partyName: form.brandName,
    category: 'Branding',
    status: 'Active',
    referenceNumber: form.primaryColor,
    notes: JSON.stringify({ documentFooter: form.documentFooter, logoUrl: form.logoUrl }),
  };
}

function userPayload(form) {
  return {
    resourceId: Number(form.resourceId),
    role: form.role,
    status: form.status,
    password: form.password || null,
  };
}

function rolePayload(form) {
  return {
    ...basePayload(`ROLE-${String(Date.now()).slice(-6)}`),
    partyName: form.name,
    category: form.scope,
    status: form.status,
    notes: JSON.stringify({
      description: form.description,
      permissions: form.permissions.split(',').map((item) => item.trim()).filter(Boolean),
    }),
  };
}

function SettingsCard({ title, icon: Icon, tone, links, locked = false, meta }) {
  const accent = tone === 'green' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600';

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-center gap-4 px-6 py-5 ${tone === 'green' ? 'bg-emerald-50/70' : 'bg-red-50/80'}`}>
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${accent}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-2xl font-black text-[#06134a]">{title}</h2>
          {meta && <p className="mt-1 text-sm font-bold text-slate-500">{meta}</p>}
          {locked && <p className="mt-1 text-sm font-bold text-red-600">Admin access required</p>}
        </div>
      </div>
      <div className="divide-y divide-slate-100 px-6 py-2">
        {links.map((item) => (
          <Link key={item.to} to={locked ? '/settings/access-denied' : item.to} className="block py-4 transition hover:translate-x-1">
            <span className="text-xl font-black text-slate-900">{item.label}</span>
            <span className="mt-1 block text-sm font-semibold leading-6 text-slate-500">{item.description}</span>
          </Link>
        ))}
      </div>
    </article>
  );
}

function PageTitle({ back = true, title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        {back && <Link to="/settings" className="text-sm font-black text-[#06134a]">‹ Settings</Link>}
        <h1 className={`${back ? 'mt-4' : ''} text-3xl font-black text-[#06134a]`}>{title}</h1>
        <p className="mt-2 text-base font-semibold text-[#06134a]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, required = false, wide = false, type = 'text', disabled = false }) {
  return (
    <label className={wide ? 'md:col-span-2 xl:col-span-3' : ''}>
      <span className="mb-2 block text-xs font-black text-[#06134a]">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-[#06134a] outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50 disabled:bg-slate-50"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, required = false }) {
  return (
    <label>
      <span className="mb-2 block text-xs font-black text-[#06134a]">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-[#06134a] outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option || `Select ${label}`}</option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, wide = false, rows = 4 }) {
  return (
    <label className={wide ? 'md:col-span-2 xl:col-span-3' : ''}>
      <span className="mb-2 block text-xs font-black text-[#06134a]">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#06134a] outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
      />
    </label>
  );
}

function Notice({ type = 'success', children }) {
  if (!children) return null;
  const classes = type === 'error'
    ? 'border-red-100 bg-red-50 text-red-700'
    : 'border-emerald-100 bg-emerald-50 text-emerald-700';
  return <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${classes}`}>{children}</div>;
}

function SettingsModal({ title, children, onClose, onSubmit, loading, submitLabel }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#06134a]/60 px-4 py-6">
      <form onSubmit={onSubmit} className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-xl font-black text-[#06134a]">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-[#06134a] hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white shadow-sm shadow-red-200 hover:bg-red-700 disabled:opacity-60">
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function useSingleSetting(type) {
  return useQuery({
    queryKey: [MODULE, type],
    queryFn: () => recordsApi.list({ module: MODULE, type, page: 0, size: 1, sort: 'updatedAt,desc' }),
  });
}

export function SettingsHomePage() {
  const { user } = useAuthStore();
  const canManageRoles = user?.role === 'admin';
  const usersQuery = useQuery({
    queryKey: [MODULE, 'users', 'summary'],
    queryFn: () => recordsApi.summary({ module: MODULE, type: 'users' }),
  });
  const rolesQuery = useQuery({
    queryKey: [MODULE, 'roles', 'summary'],
    queryFn: () => recordsApi.summary({ module: MODULE, type: 'roles' }),
  });
  return (
    <section className="space-y-6">
      <PageTitle
        back={false}
        title="Settings"
        subtitle="Manage organization setup, users, roles and access permissions."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard title="Organization" icon={Building2} tone="green" links={organizationLinks} meta="Editable profile and branding" />
        <SettingsCard
          title="Users & Roles"
          icon={UsersRound}
          tone="red"
          links={accessLinks}
          locked={!canManageRoles}
          meta={`${usersQuery.data?.totalRecords || 0} users / ${rolesQuery.data?.totalRecords || 0} roles`}
        />
        {canManageRoles && <SettingsCard title="Master Data" icon={BadgeCheck} tone="green" links={masterLinks} meta="Database-driven application values" />}
        {canManageRoles && <SettingsCard title="Integrations" icon={ShieldCheck} tone="red" links={integrationLinks} meta="Secure external service configuration" />}
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-[#06134a]">Current Access</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {user?.access?.map((item) => (
            <span key={item} className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-600">
              <CheckCircle2 className="h-4 w-4" />
              {item}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}

export function OrganizationProfilePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultOrganization);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const query = useSingleSetting('organization');
  const record = query.data?.content?.[0];

  useEffect(() => {
    setForm(organizationFromRecord(record));
  }, [record]);

  const mutation = useMutation({
    mutationFn: (payload) => record
      ? recordsApi.update({ module: MODULE, type: 'organization', id: record.id, payload })
      : recordsApi.create({ module: MODULE, type: 'organization', payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODULE, 'organization'] });
      setError('');
      setMessage('Organization profile saved successfully.');
    },
    onError: () => {
      setMessage('');
      setError('Unable to save organization profile. Please check the API and try again.');
    },
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.organizationName.trim() || !form.email.trim()) {
      setError('Organization name and email are required.');
      return;
    }
    if (form.country === 'India' && !/^\d{6}$/.test(form.pinCode.trim())) {
      setError('PIN Code must contain exactly 6 digits for an Indian organization.');
      return;
    }
    mutation.mutate(organizationPayload(form));
  }

  return (
    <section className="space-y-6">
      <PageTitle title="Organization Profile" subtitle="Maintain your company identity and statutory details." />
      <Notice>{message}</Notice>
      <Notice type="error">{error}</Notice>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 flex items-center gap-3 text-lg font-black text-[#06134a]">
          <Building2 className="h-5 w-5 text-red-600" />
          Company Details
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TextField label="Organization Name" value={form.organizationName} onChange={(value) => updateField('organizationName', value)} required />
          <TextField label="GSTIN" value={form.gstin} onChange={(value) => updateField('gstin', value)} />
          <TextField label="PAN" value={form.pan} onChange={(value) => updateField('pan', value)} />
          <TextField label="Email" value={form.email} onChange={(value) => updateField('email', value)} required />
          <TextField label="Phone" value={form.phone} onChange={(value) => updateField('phone', value)} />
          <SelectField label="Base Currency" value={form.currency} onChange={(value) => updateField('currency', value)} options={['INR - Indian Rupee', 'USD - US Dollar', 'AUD - Australian Dollar']} />
          <SelectField label="Country" value={form.country} onChange={(value) => updateField('country', value)} options={['India', 'Australia', 'United States', 'United Kingdom', 'UAE', 'Canada']} />
          <SelectField label="State" value={form.state} onChange={(value) => updateField('state', value)} options={['Tamil Nadu (33)', 'Madhya Pradesh (23)', 'Maharashtra (27)', 'Karnataka (29)', 'Delhi (07)']} />
          <TextField label="City" value={form.city} onChange={(value) => updateField('city', value)} required />
          <TextField label="PIN Code" value={form.pinCode} onChange={(value) => updateField('pinCode', value.replace(/\D/g, '').slice(0, 6))} required />
          <SelectField label="TDS Calculation Base" value={form.tdsBaseType} onChange={(value) => updateField('tdsBaseType', value)} options={['INVOICE_TOTAL', 'TAXABLE_VALUE']} />
          <TextField label="Billing Address" value={form.address} onChange={(value) => updateField('address', value)} wide />
        </div>
        <button type="submit" disabled={mutation.isPending} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-red-600 px-6 text-sm font-black text-white disabled:opacity-60">
          <Save className="h-4 w-4" />
          {mutation.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </section>
  );
}

export function OrganizationBrandingPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultBranding);
  const [logoFile, setLogoFile] = useState(null);
  const successMessageRef = useRef('Branding saved successfully.');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const query = useSingleSetting('branding');
  const record = query.data?.content?.[0];

  useEffect(() => {
    setForm(brandingFromRecord(record));
  }, [record]);

  const mutation = useMutation({
    mutationFn: (payload) => record
      ? recordsApi.update({ module: MODULE, type: 'branding', id: record.id, payload })
      : recordsApi.create({ module: MODULE, type: 'branding', payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODULE, 'branding'] });
      setError('');
      setMessage(successMessageRef.current);
      successMessageRef.current = 'Branding saved successfully.';
    },
    onError: () => {
      setMessage('');
      setError('Unable to save branding. Please check the API and try again.');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file) => storageApi.uploadBrandingLogo(file),
    onSuccess: (data) => {
      const nextForm = { ...form, logoUrl: data.url };
      setForm(nextForm);
      setLogoFile(null);
      successMessageRef.current = 'Logo uploaded and branding saved successfully.';
      mutation.mutate(brandingPayload(nextForm));
    },
    onError: (uploadError) => {
      setMessage('');
      setError(uploadError?.response?.data?.message || 'Unable to upload the logo. Please try again.');
    },
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.brandName.trim()) {
      setError('Brand name is required.');
      return;
    }
    successMessageRef.current = 'Branding saved successfully.';
    mutation.mutate(brandingPayload(form));
  }

  function handleLogoFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      setError('Only PNG, JPG, SVG, and WEBP logo files are supported.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo file size must be 2 MB or less.');
      return;
    }
    setError('');
    setLogoFile(file);
  }

  function handleUploadLogo() {
    if (!logoFile) {
      setError('Please choose a logo file before uploading.');
      return;
    }
    uploadMutation.mutate(logoFile);
  }

  return (
    <section className="space-y-6">
      <PageTitle title="Branding" subtitle="Customize how your brand appears across invoices and reports." />
      <Notice>{message}</Notice>
      <Notice type="error">{error}</Notice>

      <div>
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-3 text-lg font-black text-[#06134a]">
            <Palette className="h-5 w-5 text-red-600" />
            Brand Theme
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Brand Name" value={form.brandName} onChange={(value) => updateField('brandName', value)} required />
            <TextField label="Primary Color" value={form.primaryColor} onChange={(value) => updateField('primaryColor', value)} type="color" />
            <TextField label="Document Footer" value={form.documentFooter} onChange={(value) => updateField('documentFooter', value)} wide />
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <div className="grid gap-4 lg:grid-cols-[180px_1fr] lg:items-center">
              <div className="grid min-h-32 place-items-center rounded-lg border border-slate-200 bg-white p-4 text-center">
                {form.logoUrl ? (
                  <img src={resolveBrandLogoUrl(form.logoUrl)} alt="Brand logo preview" className="max-h-24 max-w-full object-contain" />
                ) : (
                  <div>
                    <Palette className="mx-auto h-8 w-8 text-red-600" />
                    <p className="mt-2 text-xs font-bold text-slate-500">No logo uploaded</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-black text-[#06134a]">Upload brand logo</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Supported formats: PNG, JPG, SVG, WEBP. Max size 2 MB.</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#06134a] hover:bg-slate-50">
                    <UploadCloud className="h-4 w-4" />
                    Choose Logo
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoFileChange} />
                  </label>
                  <button
                    type="button"
                    onClick={handleUploadLogo}
                    disabled={!logoFile || uploadMutation.isPending || mutation.isPending}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white shadow-sm shadow-red-200 hover:bg-red-700 disabled:opacity-60"
                  >
                    <UploadCloud className="h-4 w-4" />
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload Logo'}
                  </button>
                </div>
                {logoFile && <p className="mt-3 text-xs font-bold text-[#06134a]">Selected: {logoFile.name}</p>}
              </div>
            </div>
          </div>
          <button type="submit" disabled={mutation.isPending || uploadMutation.isPending} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-red-600 px-6 text-sm font-black text-white disabled:opacity-60">
            <Save className="h-4 w-4" />
            {mutation.isPending ? 'Saving...' : 'Save Branding'}
          </button>
        </form>

      </div>
    </section>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const usersQuery = useQuery({
    queryKey: [MODULE, 'users', search],
    queryFn: () => usersApi.list({ page: 0, size: 200, search }),
  });
  const rolesQuery = useQuery({
    queryKey: [MODULE, 'roles', 'options'],
    queryFn: () => recordsApi.list({ module: MODULE, type: 'roles', page: 0, size: 200, status: 'Active', sort: 'partyName,asc' }),
  });
  const resourcesQuery = useQuery({
    queryKey: ['resources', 'user-dropdown'],
    queryFn: resourceUsersApi.dropdown,
  });
  const selectedResourceQuery = useQuery({
    queryKey: ['resources', 'login-profile', form.resourceId],
    queryFn: () => resourceUsersApi.loginProfile(form.resourceId),
    enabled: Boolean(form.resourceId),
  });

  useEffect(() => {
    if (!selectedResourceQuery.data) return;
    setForm((current) => ({
      ...current,
      resourceName: selectedResourceQuery.data.name || '',
      email: selectedResourceQuery.data.email || '',
    }));
  }, [selectedResourceQuery.data]);

  const roleOptions = useMemo(() => {
    const dynamicRoles = (rolesQuery.data?.content || []).map((item) => item.partyName).filter(Boolean);
    return ['', ...new Set(dynamicRoles.length ? dynamicRoles : ['Admin', 'Accountant', 'Sales', 'Purchase'])];
  }, [rolesQuery.data]);

  const rows = useMemo(() => (usersQuery.data?.content || []).map(userFromRecord), [usersQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload) => editingUser
      ? editingUser.id ? usersApi.update(editingUser.id, payload) : usersApi.create(payload)
      : usersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODULE, 'users'] });
      setEditingUser(null);
      setForm(emptyUser);
      setMessage(editingUser?.id ? 'User updated successfully.' : 'User created successfully.');
      setError('');
    },
    onError: (mutationError) => {
      setMessage('');
      setError(mutationError?.response?.data?.message || 'Unable to save user. Please check the API and try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODULE, 'users'] });
      setDeleteTarget(null);
      setMessage('User deleted successfully.');
      setError('');
    },
    onError: () => {
      setMessage('');
      setError('Unable to delete user. Please try again.');
    },
  });

  function openCreate() {
    setEditingUser({ isNew: true });
    setForm({ ...emptyUser, role: roleOptions[1] || '' });
    setError('');
  }

  function openEdit(row) {
    setEditingUser(row);
    setForm(row);
    setError('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.resourceId || !form.role.trim() || (editingUser.isNew && !form.password)) {
      setError('Employee, role and password are required.');
      return;
    }
    if (form.password && form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirmPassword) {
      setError('Password and confirm password must match.');
      return;
    }
    saveMutation.mutate(userPayload(form));
  }

  return (
    <section className="space-y-6">
      <PageTitle
        title="Users"
        subtitle="Invite, edit and manage organization users from live data."
        action={(
          <button onClick={openCreate} className="flex h-11 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white">
            <Plus className="h-4 w-4" /> Add User
          </button>
        )}
      />
      <Notice>{message}</Notice>
      <Notice type="error">{error}</Notice>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users by name, email or role..."
          className="h-11 w-full max-w-xl rounded-lg border border-slate-200 px-4 text-sm font-semibold text-[#06134a] outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
        />
      </article>

      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{['User', 'Email', 'Role', 'Access', 'Status', 'Actions'].map((item) => <th key={item} className="px-5 py-4 font-black">{item}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-4">
                  <p className="font-black text-[#06134a]">{row.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{row.designation || 'Team Member'}</p>
                </td>
                <td className="px-5 py-4 font-semibold text-slate-600"><Mail className="mr-2 inline h-4 w-4" />{row.email}</td>
                <td className="px-5 py-4"><span className="rounded-md bg-red-50 px-3 py-1 text-xs font-black text-red-600">{row.role}</span></td>
                <td className="px-5 py-4 font-semibold text-slate-600">{row.access || '-'}</td>
                <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(row)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-[#06134a] hover:bg-slate-50" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(row)} className="grid h-9 w-9 place-items-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm font-bold text-slate-500">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>

      {editingUser && (
        <SettingsModal title={editingUser.isNew ? 'Add User' : 'Edit User'} onClose={() => setEditingUser(null)} onSubmit={handleSubmit} loading={saveMutation.isPending} submitLabel={editingUser.isNew ? 'Create User' : 'Update User'}>
          <div className="grid gap-4 md:grid-cols-2">
            <SearchableEmployeeField
              value={form.resourceId}
              displayValue={form.resourceName}
              options={resourcesQuery.data || []}
              loading={resourcesQuery.isLoading}
              onChange={(resource) => setForm((current) => ({ ...current, resourceId: resource?.id || '', resourceName: resource?.name || '', email: '' }))}
            />
            <TextField label="Login Email" value={form.email} placeholder="Select an employee" disabled />
            <SelectField label="Role" value={form.role} onChange={(value) => setForm((current) => ({ ...current, role: value }))} options={roleOptions} required />
            <SelectField label="Status" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={['Active', 'Inactive']} />
            <TextField label={editingUser.isNew ? 'Password' : 'New Password'} type="password" value={form.password} onChange={(value) => setForm((current) => ({ ...current, password: value }))} placeholder={editingUser.isNew ? 'Minimum 8 characters' : 'Leave blank to keep current password'} required={editingUser.isNew} />
            <TextField label="Confirm Password" type="password" value={form.confirmPassword} onChange={(value) => setForm((current) => ({ ...current, confirmPassword: value }))} required={editingUser.isNew || Boolean(form.password)} />
          </div>
        </SettingsModal>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete user?"
        message={`Delete ${deleteTarget?.name || 'this user'} from settings?`}
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
      />
    </section>
  );
}

function EntitySelectField({ label, value, onChange, options, required = false }) {
  return (
    <label>
      <span className="mb-2 block text-xs font-black text-[#06134a]">{label} {required && <span className="text-red-600">*</span>}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-[#06134a] outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50">
        <option value="">Select {label}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function SearchableEmployeeField({ value, displayValue, options, loading, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(displayValue || '');
  useEffect(() => setSearch(displayValue || ''), [displayValue]);
  const matches = options.filter((option) => option.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <label className="relative">
      <span className="mb-2 block text-xs font-black text-[#06134a]">Employee <span className="text-red-600">*</span></span>
      <input
        value={search}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setSearch(event.target.value); setOpen(true); if (value) onChange(null); }}
        placeholder={loading ? 'Loading employees...' : 'Search and select employee'}
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-[#06134a] outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {matches.map((option) => (
            <button key={option.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option); setSearch(option.name); setOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-red-50">
              {option.name}
            </button>
          ))}
          {!matches.length && <p className="px-3 py-3 text-sm font-semibold text-slate-500">No employees found.</p>}
        </div>
      )}
    </label>
  );
}

export function RolesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState(emptyRole);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const rolesQuery = useQuery({
    queryKey: [MODULE, 'roles', search],
    queryFn: () => recordsApi.list({ module: MODULE, type: 'roles', page: 0, size: 200, search, sort: 'partyName,asc' }),
  });
  const roles = useMemo(() => (rolesQuery.data?.content || []).map(roleFromRecord), [rolesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload) => editingRole
      ? editingRole.id
        ? recordsApi.update({ module: MODULE, type: 'roles', id: editingRole.id, payload })
        : recordsApi.create({ module: MODULE, type: 'roles', payload })
      : recordsApi.create({ module: MODULE, type: 'roles', payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODULE, 'roles'] });
      setEditingRole(null);
      setForm(emptyRole);
      setMessage(editingRole?.id ? 'Role updated successfully.' : 'Role created successfully.');
      setError('');
    },
    onError: () => {
      setMessage('');
      setError('Unable to save role. Please check the API and try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => recordsApi.remove({ module: MODULE, type: 'roles', id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODULE, 'roles'] });
      setDeleteTarget(null);
      setMessage('Role deleted successfully.');
      setError('');
    },
    onError: () => {
      setMessage('');
      setError('Unable to delete role. Please try again.');
    },
  });

  function openCreate() {
    setEditingRole({ isNew: true });
    setForm(emptyRole);
    setError('');
  }

  function openEdit(role) {
    setEditingRole(role);
    setForm(role);
    setError('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.scope.trim()) {
      setError('Role name and scope are required.');
      return;
    }
    saveMutation.mutate(rolePayload(form));
  }

  return (
    <section className="space-y-6">
      <PageTitle
        title="Roles"
        subtitle="Create, edit and delete access roles from live settings data."
        action={(
          <button onClick={openCreate} className="flex h-11 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white">
            <Plus className="h-4 w-4" /> Add Role
          </button>
        )}
      />
      <Notice>{message}</Notice>
      <Notice type="error">{error}</Notice>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search roles by name, scope or permission..."
          className="h-11 w-full max-w-xl rounded-lg border border-slate-200 px-4 text-sm font-semibold text-[#06134a] outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
        />
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        {roles.map((role) => (
          <article key={role.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#06134a]">{role.name}</h2>
                    <StatusBadge status={role.status} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(role)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-[#06134a] hover:bg-slate-50" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(role)} className="grid h-9 w-9 place-items-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{role.description || 'No description added.'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600">
                    <BadgeCheck className="h-4 w-4" /> {role.scope || 'Custom scope'}
                  </span>
                  {role.permissions.split(',').map((permission) => permission.trim()).filter(Boolean).slice(0, 5).map((permission) => (
                    <span key={permission} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{permission}</span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
        {!roles.length && <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500 shadow-sm xl:col-span-2">No roles found.</div>}
      </div>

      {editingRole && (
        <SettingsModal title={editingRole.isNew ? 'Add Role' : 'Edit Role'} onClose={() => setEditingRole(null)} onSubmit={handleSubmit} loading={saveMutation.isPending} submitLabel={editingRole.isNew ? 'Create Role' : 'Update Role'}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Role Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} required />
            <SelectField label="Status" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={['Active', 'Inactive']} />
            <TextField label="Scope" value={form.scope} onChange={(value) => setForm((current) => ({ ...current, scope: value }))} placeholder="All modules" required />
            <TextField label="Permissions" value={form.permissions} onChange={(value) => setForm((current) => ({ ...current, permissions: value }))} placeholder="Dashboard, Sales, Reports" />
            <TextArea label="Description" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} wide />
          </div>
        </SettingsModal>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete role?"
        message={`Delete ${deleteTarget?.name || 'this role'} from settings? Users with this role will keep their label until updated.`}
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
      />
    </section>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
      {status || 'Active'}
    </span>
  );
}

export function SettingsAccessDeniedPage() {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <article className="max-w-xl rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-12 w-12 text-red-600" />
        <h1 className="mt-5 text-3xl font-black text-[#06134a]">Access Restricted</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
          Users & Roles is available only for Admin users. Please login as Admin to manage team access.
        </p>
        <Link to="/settings" className="mt-6 inline-grid h-11 place-items-center rounded-lg bg-red-600 px-6 text-sm font-black text-white">Back to Settings</Link>
      </article>
    </section>
  );
}

export function UserProfilePage() {
  const { user } = useAuthStore();

  return (
    <section className="space-y-6">
      <PageTitle back={false} title="Profile" subtitle="View your login profile, role and module access." />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full bg-gradient-to-br from-slate-200 to-slate-400">
            <div className="absolute inset-x-0 bottom-0 mx-auto h-16 w-20 rounded-t-full bg-slate-800" />
            <div className="absolute left-1/2 top-5 h-10 w-10 -translate-x-1/2 rounded-full bg-amber-200" />
            <span className="absolute bottom-1 right-2 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-[#06134a]">{user?.name}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{user?.email}</p>
          <span className="mt-4 inline-flex rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white">{user?.roleLabel || user?.role}</span>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-black text-[#06134a]">Account Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Full Name" value={user?.name || ''} disabled />
            <TextField label="Email" value={user?.email || ''} disabled />
            <TextField label="Role" value={user?.roleLabel || user?.role || ''} disabled />
            <TextField label="Organization" value="IntelliaTech Pvt. Ltd." disabled />
          </div>
          <h3 className="mt-8 text-lg font-black text-[#06134a]">Access Permissions</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {user?.access?.map((item) => (
              <span key={item} className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-600">
                <CheckCircle2 className="h-4 w-4" />
                {item}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
