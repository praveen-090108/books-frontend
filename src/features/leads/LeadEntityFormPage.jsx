import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { companyApi, contactApi, leadApi } from '../../api/leadManagementApi.js';

const inputClass = 'lead-field h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100';
const buttonClass = 'lead-button inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-800 hover:bg-slate-50';
const primaryClass = `${buttonClass} border-red-600 bg-red-600 text-white hover:bg-red-700`;

function Section({ title, children }) {
  return <section className="lead-card rounded-[10px] border border-slate-200 bg-white p-4"><h2 className="mb-5 border-l-2 border-red-500 pl-3 text-[14px] font-extrabold text-[#07152b]">{title}</h2>{children}</section>;
}

function Field({ label, name, form, setForm, type = 'text', required = false }) {
  return <label className="block text-[11px] font-bold text-[#14213b]">{label}{required && <span className="text-red-500"> *</span>}<input className={`${inputClass} mt-2`} type={type} value={form[name] ?? ''} onChange={(event) => setForm({ ...form, [name]: event.target.value })} /></label>;
}

function SelectField({ label, name, form, setForm, items = [], required = false, valueKey, labelKey }) {
  return <label className="block text-[11px] font-bold text-[#14213b]">{label}{required && <span className="text-red-500"> *</span>}<select className={`${inputClass} mt-2`} value={form[name] ?? ''} onChange={(event) => setForm({ ...form, [name]: event.target.value })}><option value="">Select {label.toLowerCase()}</option>{items.map((item) => { const value = typeof item === 'object' ? item[valueKey] : item; const text = typeof item === 'object' ? item[labelKey] : item; return <option key={value} value={value}>{text}</option>; })}</select></label>;
}

function Area({ label, name, form, setForm, height = 'h-24' }) {
  return <label className="block text-[11px] font-bold text-[#14213b]">{label}<textarea className={`${inputClass} ${height} mt-2 py-3`} value={form[name] ?? ''} onChange={(event) => setForm({ ...form, [name]: event.target.value })} /></label>;
}

function UploadPanel() {
  return <div className="grid h-36 place-items-center rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500"><div><Download className="mx-auto mb-2 h-7 w-7 text-slate-700"/><b className="block text-slate-800">Drag & drop files here</b><span>Upload files after saving this record</span></div></div>;
}

export function LeadEntityFormPage({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = kind === 'company' ? companyApi : contactApi;
  const [form, setForm] = useState(null);
  const [options, setOptions] = useState({ companies: [], contacts: [], owners: [], sources: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      leadApi.options(),
      id ? api.get(id) : Promise.resolve(kind === 'company' ? { currencyCode: 'INR', status: 'ACTIVE', ownerId: 'admin' } : { contactType: 'PRIMARY', ownerId: 'admin', status: 'ACTIVE' }),
    ]).then(([loadedOptions, record]) => { if (active) { setOptions(loadedOptions); setForm(record); } }).catch((caught) => active && setError(caught.response?.data?.message || caught.message));
    return () => { active = false; };
  }, [api, id, kind]);

  if (!form) return <div className="lead-card rounded-lg border bg-white p-10 text-center text-sm text-slate-500">{error || 'Loading…'}</div>;
  const title = kind === 'company' ? 'Company' : 'Contact';
  const save = async () => { setSaving(true); setError(''); try { const saved = await api.save(id, form); navigate(`/lead-management/${kind === 'company' ? 'companies' : 'contacts'}/${saved.id}`); } catch (caught) { setError(caught.response?.data?.message || caught.message); setSaving(false); } };

  return <div className="lead-module space-y-4">
    <div className="lead-page-header flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-[22px] font-extrabold text-[#07152b]">{id ? 'Edit' : 'Create'} {title}</h1><p className="mt-1 text-[13px] text-slate-600">Add a {kind} to manage your leads, contacts and deals.</p></div><div className="flex gap-2"><button className={buttonClass} onClick={() => navigate(-1)}>Cancel</button><button className={primaryClass} disabled={saving} onClick={save}>{saving ? 'Saving…' : `Save ${title}`}</button></div></div>
    {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {kind === 'company' ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.75fr)]"><div className="space-y-4">
      <Section title="Company Information"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"><Field label="Company Name" name="companyName" required form={form} setForm={setForm}/><Field label="Website" name="website" form={form} setForm={setForm}/><Field label="Industry" name="industry" form={form} setForm={setForm}/><Field label="Type" name="companyType" form={form} setForm={setForm}/><Field label="Company Email" name="email" type="email" form={form} setForm={setForm}/><Field label="Phone" name="phone" form={form} setForm={setForm}/><Field label="Other Phone" name="otherPhone" form={form} setForm={setForm}/><Field label="Fax" name="fax" form={form} setForm={setForm}/><Field label="GSTIN" name="gstin" form={form} setForm={setForm}/><Field label="PAN" name="pan" form={form} setForm={setForm}/><SelectField label="Currency" name="currencyCode" items={['INR','USD','EUR']} form={form} setForm={setForm}/><Field label="Ownership" name="ownership" form={form} setForm={setForm}/><Field label="Employee Range" name="employeeRange" form={form} setForm={setForm}/><Field label="Annual Revenue" name="annualRevenue" type="number" form={form} setForm={setForm}/><SelectField label="Lead Source" name="leadSource" items={options.sources} form={form} setForm={setForm}/><SelectField label="Status" name="status" items={['ACTIVE','INACTIVE']} form={form} setForm={setForm}/><div className="md:col-span-2 xl:col-span-4"><Area label="Description" name="description" form={form} setForm={setForm}/></div></div></Section>
      <Section title="Primary Contact Information"><div className="flex items-end gap-3"><div className="flex-1"><SelectField label="Primary Contact" name="primaryContactId" items={options.contacts} valueKey="id" labelKey="contactName" form={form} setForm={setForm}/></div><button className={buttonClass} onClick={() => navigate('/lead-management/contacts/new')}><Plus className="h-4 w-4"/>New Contact</button></div></Section>
      <Section title="Additional Information"><div className="grid gap-5 md:grid-cols-3"><Field label="LinkedIn" name="linkedinUrl" form={form} setForm={setForm}/><Field label="Facebook" name="facebookUrl" form={form} setForm={setForm}/><Field label="Twitter / X" name="twitterUrl" form={form} setForm={setForm}/><div className="md:col-span-3"><Field label="Tags" name="tags" form={form} setForm={setForm}/></div></div></Section>
    </div><div className="space-y-4"><Section title="Address Information"><div className="space-y-5"><Field label="Street Address" name="streetAddress" required form={form} setForm={setForm}/><Field label="Address Line 2" name="addressLine2" form={form} setForm={setForm}/><div className="grid grid-cols-2 gap-4"><Field label="City" name="city" form={form} setForm={setForm}/><Field label="State" name="state" form={form} setForm={setForm}/><Field label="Country" name="country" form={form} setForm={setForm}/><Field label="Zip / Postal Code" name="postalCode" form={form} setForm={setForm}/></div></div></Section><Section title="Attachments"><UploadPanel/></Section><Section title="Notes"><Area label="" name="notes" height="h-36" form={form} setForm={setForm}/></Section></div></div>
    : <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.8fr)]"><div className="space-y-4"><Section title="Contact Information"><div className="grid gap-5 md:grid-cols-3"><Field label="First Name" name="firstName" required form={form} setForm={setForm}/><Field label="Last Name" name="lastName" required form={form} setForm={setForm}/><Field label="Job Title" name="jobTitle" form={form} setForm={setForm}/><Field label="Email" name="email" type="email" required form={form} setForm={setForm}/><Field label="Phone" name="phone" required form={form} setForm={setForm}/><Field label="Other Phone" name="otherPhone" form={form} setForm={setForm}/><Field label="Department" name="department" form={form} setForm={setForm}/><Field label="Date of Birth" name="dateOfBirth" type="date" form={form} setForm={setForm}/><Field label="Assistant / Secretary" name="assistantName" form={form} setForm={setForm}/><Field label="Reports To" name="reportsTo" form={form} setForm={setForm}/><SelectField label="Contact Owner" name="ownerId" items={options.owners} form={form} setForm={setForm}/><SelectField label="Lead Source" name="leadSource" items={options.sources} form={form} setForm={setForm}/><SelectField label="Contact Type" name="contactType" items={['PRIMARY','OTHER']} form={form} setForm={setForm}/></div></Section><Section title="Additional Information"><div className="grid gap-5 md:grid-cols-3"><Field label="Skype ID" name="skypeId" form={form} setForm={setForm}/><Field label="LinkedIn Profile" name="linkedinUrl" form={form} setForm={setForm}/><Field label="Twitter / X Profile" name="twitterUrl" form={form} setForm={setForm}/></div></Section><Section title="Description"><Area label="" name="description" form={form} setForm={setForm}/></Section></div><div className="space-y-4"><Section title="Company Information"><SelectField label="Company" name="companyId" items={options.companies} valueKey="id" labelKey="companyName" form={form} setForm={setForm}/></Section><Section title="Tags"><Field label="Select Tags" name="tags" form={form} setForm={setForm}/></Section><Section title="Contact Address"><div className="space-y-5"><Field label="Street Address" name="streetAddress" form={form} setForm={setForm}/><Field label="Address Line 2" name="addressLine2" form={form} setForm={setForm}/><div className="grid grid-cols-2 gap-4"><Field label="City" name="city" form={form} setForm={setForm}/><Field label="State" name="state" form={form} setForm={setForm}/><Field label="Country" name="country" form={form} setForm={setForm}/><Field label="Zip / Postal Code" name="postalCode" form={form} setForm={setForm}/></div></div></Section><Section title="Notes"><Area label="" name="notes" height="h-28" form={form} setForm={setForm}/></Section></div></div>}
  </div>;
}
