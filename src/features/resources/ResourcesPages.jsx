import {
  ArrowDownToLine,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Lock,
  MoreVertical,
  Plus,
  Search,
  Upload,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordsApi } from '../../api/recordsApi.js';
import { resourceUsersApi } from '../../api/authApi.js';
import { currencyApi } from '../../api/currencyApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';

const departments = [
  { value: 'SALES', label: 'Sales' },
  { value: 'DEVELOPMENT', label: 'Development' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'HR', label: 'HR' },
  { value: 'DELIVERY_TEAM', label: 'Delivery Team' },
];
const departmentLabel = (value) => departments.find((item) => item.value === value)?.label || '-';
const technologies = ['Java', 'Spring Boot', 'AWS', 'ReactJS', 'JavaScript', 'HTML', 'Manual Testing', 'Selenium', 'JIRA', 'Figma', 'Adobe XD', 'Docker', 'Jenkins', 'Python', 'SQL'];
const projectTypes = ['Fixed Cost', 'Staffing', 'Both'];
const availabilityOptions = ['Available', 'Full', 'Partially Available'];

function parseResource(record) {
  let details = {};
  try {
    details = JSON.parse(record.notes || '{}');
  } catch {
    details = {};
  }

  return {
    id: record.id,
    name: record.partyName,
    email: record.partyEmail || '',
    phone: record.partyPhone || '',
    employeeId: record.recordNumber,
    designation: record.designation || record.category || '',
    department: record.department || '',
    reportingManagerId: record.reportingManagerId || '',
    manager: record.reportingManagerName || '',
    skills: details.skills || [],
    projectType: record.paymentMode || details.projectType || '-',
    currentProject: details.currentProject || record.referenceNumber || '-',
    client: details.client || '-',
    utilization: Number(record.amount || 0),
    availability: record.secondaryStatus || 'Available',
    status: record.status || 'Active',
    location: record.partyCity || '',
    resourceType: details.resourceType || 'Full Time',
    experience: details.experience || '',
    dateOfBirth: record.dueDate || '',
    joiningDate: record.recordDate || '',
    gender: details.gender || '',
    noticePeriod: details.noticePeriod || '',
    address: details.address || '',
    relevantExperience: details.relevantExperience || '',
    monthlySalary: details.monthlySalary ?? '',
    salaryCurrency: details.salaryCurrency || 'INR',
    preferredDomain: details.preferredDomain || '',
    preferredLocation: details.preferredLocation || '',
  };
}

function resourcePayload(form) {
  return {
    recordNumber: form.employeeId || `EMP${Date.now().toString().slice(-4)}`,
    partyName: form.name,
    partyEmail: form.email,
    partyPhone: form.phone,
    partyCity: form.location || form.address,
    category: form.designation,
    status: form.status,
    secondaryStatus: form.availability,
    amount: Number(form.utilization || 0),
    balanceAmount: 0,
    recordDate: form.joiningDate || new Date().toISOString().slice(0, 10),
    dueDate: form.dateOfBirth || new Date().toISOString().slice(0, 10),
    referenceNumber: form.currentProject,
    paymentMode: form.projectType,
    ownerName: null,
    notes: JSON.stringify({
      skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      client: form.client,
      resourceType: form.resourceType,
      gender: form.gender,
      noticePeriod: form.noticePeriod,
      address: form.address,
      experience: form.experience,
      relevantExperience: form.relevantExperience,
      monthlySalary: Number(form.monthlySalary),
      salaryCurrency: form.salaryCurrency,
      preferredDomain: form.preferredDomain,
      preferredLocation: form.preferredLocation,
    }),
    department: form.department,
    designation: form.designation.trim(),
    reportingManagerId: form.reportingManagerId || null,
  };
}

function nextEmployeeId() {
  return `EMP${Date.now().toString().slice(-4)}`;
}

export function ResourcesListPage({ mode = 'list' }) {
  if (mode !== 'list') return <ResourcePlaceholderPage mode={mode} />;

  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [technology, setTechnology] = useState('');
  const [projectType, setProjectType] = useState('');
  const [status, setStatus] = useState('');
  const [availability, setAvailability] = useState('');
  const [department, setDepartment] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const queryParams = { module: 'resources', type: 'resources', page, size: pageSize, search, status, secondaryStatus: availability, department, sort: 'recordNumber,asc' };
  const listQuery = useQuery({
    queryKey: ['records', queryParams],
    queryFn: () => recordsApi.list(queryParams),
  });
  const resources = useMemo(() => (listQuery.data?.content || []).map(parseResource)
    .filter((resource) => !technology || resource.skills.includes(technology))
    .filter((resource) => !projectType || resource.projectType === projectType), [listQuery.data, technology, projectType]);
  useEffect(() => { setPage(0); }, [search, technology, projectType, status, availability, department]);
  const summary = useMemo(() => {
    const all = (listQuery.data?.content || []).map(parseResource);
    const total = listQuery.data?.totalElements || all.length;
    const staffing = all.filter((item) => item.projectType === 'Staffing' || item.projectType === 'Both').length;
    const fixed = all.filter((item) => item.projectType === 'Fixed Cost' || item.projectType === 'Both').length;
    const bench = all.filter((item) => item.availability === 'Available').length;
    const utilization = all.length ? Math.round(all.reduce((sum, item) => sum + item.utilization, 0) / all.length) : 0;
    return { total, staffing, fixed, bench, utilization };
  }, [listQuery.data]);
  const deleteMutation = useMutation({
    mutationFn: (id) => recordsApi.remove({ module: 'resources', type: 'resources', id }),
    onSuccess: () => {
      setDeleteTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  return (
    <section className="space-y-5 text-[#06134a]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-black">Resource List</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">Manage your team resources, skills, allocations and availability.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton icon={ArrowDownToLine}>Export</ActionButton>
          <ActionButton icon={ArrowDownToLine}>Import</ActionButton>
          <Link to="/resources/new" className="flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-5 text-sm font-black text-white shadow-sm shadow-violet-200 hover:bg-violet-700">
            <Plus className="h-4 w-4" /> Add Resource
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ResourceCard label="Total Resources" value={summary.total} accent="bg-violet-100 text-violet-700" icon={BriefcaseBusiness} />
        <ResourceCard label="On Staffing Projects" value={summary.staffing} meta={`${summary.total ? Math.round((summary.staffing / summary.total) * 100) : 0}%`} accent="bg-blue-100 text-blue-700" icon={UsersRound} />
        <ResourceCard label="On Fixed Cost Projects" value={summary.fixed} meta={`${summary.total ? Math.round((summary.fixed / summary.total) * 100) : 0}%`} accent="bg-emerald-100 text-emerald-700" icon={BriefcaseBusiness} />
        <ResourceCard label="Available (Bench)" value={summary.bench} meta={`${summary.total ? Math.round((summary.bench / summary.total) * 100) : 0}%`} accent="bg-orange-100 text-orange-700" icon={UsersRound} />
        <ResourceCard label="Utilization Rate" value={`${summary.utilization}%`} meta="This Month" accent="bg-blue-100 text-blue-700" icon={UserRound} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid items-end gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(280px,1.5fr)_repeat(5,minmax(140px,0.75fr))_auto]">
          <label className="block min-w-0">
            <span className="mb-2 block h-4 text-xs font-black text-transparent">Search</span>
            <span className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, skill, email or employee ID..." className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-semibold outline-none focus:border-violet-300" />
            </span>
          </label>
          <Select value={technology} onChange={setTechnology} label="Technology" options={technologies} />
          <Select value={projectType} onChange={setProjectType} label="Project Type" options={projectTypes} />
          <Select value={department} onChange={setDepartment} label="Department" options={departments} />
          <Select value={status} onChange={setStatus} label="Status" options={['Active', 'Inactive']} />
          <Select value={availability} onChange={setAvailability} label="Availability" options={availabilityOptions} />
          <button onClick={() => { setSearch(''); setTechnology(''); setProjectType(''); setDepartment(''); setStatus(''); setAvailability(''); setPage(0); }} className="h-11 whitespace-nowrap rounded-lg px-4 text-sm font-black">Reset</button>
        </div>
      </div>

      {location.state?.message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{location.state.message}</div>}
      {listQuery.isLoading && <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-bold">Loading resources...</div>}
      {listQuery.isError && <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-700">{listQuery.error?.response?.status === 403 ? 'You do not have permission to view Resources. Ask an administrator to enable Resources → View for your role.' : 'Resource data could not be loaded from the backend. Check the application logs and try again.'}</div>}
      {deleteMutation.isError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">Delete failed. Please try again.</div>}

      <ResourceTable resources={resources} onDelete={setDeleteTargetId} page={page} pageSize={pageSize} totalPages={listQuery.data?.totalPages || 1} totalElements={listQuery.data?.totalElements || 0} onPage={setPage} onPageSize={(value)=>{setPageSize(value);setPage(0);}} />
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title="Delete resource?"
        message="This resource will be permanently deleted from the database and removed from the resource list."
        loading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
      />
    </section>
  );
}

function ResourceCard({ label, value, meta, accent, icon: Icon }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className={`grid h-12 w-12 place-items-center rounded-lg ${accent}`}><Icon className="h-6 w-6" /></span>
        <div>
          <p className="text-xs font-black">{label}</p>
          <p className="mt-2 text-3xl font-black">{value} {meta && <span className="ml-2 align-middle text-xs font-black text-emerald-700">{meta}</span>}</p>
          <button className="mt-4 text-xs font-black text-blue-600">View Details →</button>
        </div>
      </div>
    </article>
  );
}

function ResourceTable({ resources, onDelete, page, pageSize, totalPages, totalElements, onPage, onPageSize }) {
  const start=totalElements?page*pageSize+1:0;
  const end=Math.min(totalElements,page*pageSize+resources.length);
  const pageNumbers=Array.from({length:Math.max(0,totalPages)},(_,index)=>index).filter((index)=>totalPages<=7||index===0||index===totalPages-1||Math.abs(index-page)<=1);
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1500px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{['#', 'Resource', 'Employee ID', 'Department', 'Designation', 'Reporting Manager', 'Primary Skills', 'Project Type', 'Current Project / Client', 'Utilization', 'Availability', 'Status', 'Action'].map((item) => <th key={item} className="px-4 py-4">{item}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resources.map((resource, index) => (
              <tr key={resource.id} className="hover:bg-slate-50">
                <td className="px-4 py-4 font-semibold">{page * pageSize + index + 1}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-violet-100 text-sm font-black text-violet-700">{initials(resource.name)}</span>
                    <div><p className="font-black">{resource.name}</p><p className="text-xs font-semibold text-slate-500">{resource.email}</p></div>
                  </div>
                </td>
                <td className="px-4 py-4 font-semibold">{resource.employeeId}</td>
                <td className="px-4 py-4 font-semibold">{departmentLabel(resource.department)}</td>
                <td className="px-4 py-4 font-semibold">{resource.designation || '-'}</td>
                <td className="px-4 py-4 font-semibold">{resource.manager || 'Not Assigned'}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {resource.skills.slice(0, 3).map((skill) => <span key={skill} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black">{skill}</span>)}
                    {resource.skills.length > 3 && <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black">+{resource.skills.length - 3}</span>}
                  </div>
                </td>
                <td className="px-4 py-4"><span className={`rounded-md px-2 py-1 text-xs font-black ${resource.projectType === 'Staffing' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{resource.projectType}</span></td>
                <td className="px-4 py-4"><p className="font-black">{resource.currentProject}</p><p className="text-xs font-semibold text-slate-500">{resource.client}</p></td>
                <td className="px-4 py-4"><p className="font-black">{resource.utilization}%</p><div className="mt-2 h-1.5 w-24 rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(100, resource.utilization)}%` }} /></div></td>
                <td className="px-4 py-4"><span className={`rounded-md px-2 py-1 text-xs font-black ${resource.availability === 'Available' ? 'bg-emerald-50 text-emerald-600' : resource.availability === 'Full' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-600'}`}>{resource.availability}</span></td>
                <td className="px-4 py-4"><span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-600">{resource.status}</span></td>
                <td className="px-4 py-4"><div className="flex items-center gap-2"><Link className="text-xs font-black text-blue-600" to={`/resources/${resource.id}`}>View</Link><Link className="text-xs font-black text-violet-600" to={`/resources/${resource.id}/edit`}>Edit</Link><button onClick={() => onDelete(resource.id)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm font-semibold md:flex-row md:items-center md:justify-between">
        <p>Showing {start} to {end} of {totalElements} resources</p>
        <div className="flex flex-wrap items-center gap-2"><select aria-label="Resources per page" value={pageSize} onChange={(event)=>onPageSize(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 font-bold"><option value="10">10 / page</option><option value="25">25 / page</option><option value="50">50 / page</option></select><button aria-label="Previous page" disabled={page===0} onClick={()=>onPage(page-1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40">‹</button>{pageNumbers.map((index,i)=><span key={index} className="contents">{i>0&&index-pageNumbers[i-1]>1&&<span className="px-1 text-slate-400">…</span>}<button onClick={()=>onPage(index)} className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 ${index===page?'border-violet-600 bg-violet-600 text-white':'border-slate-200 bg-white'}`}>{index+1}</button></span>)}<button aria-label="Next page" disabled={page+1>=totalPages} onClick={()=>onPage(page+1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40">›</button></div>
      </div>
    </article>
  );
}

export function AddResourcePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    employeeId: nextEmployeeId(),
    resourceType: 'Full Time',
    email: '',
    dateOfBirth: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    department: '',
    designation: '',
    reportingManagerId: '',
    phone: '',
    gender: '',
    noticePeriod: '',
    status: 'Active',
    role: '',
    skills: '',
    experience: '',
    relevantExperience: '',
    monthlySalary: '',
    salaryCurrency: 'INR',
    address: '',
    projectType: 'Both',
    preferredDomain: '',
    preferredLocation: '',
    availability: 'Available',
    utilization: 0,
    currentProject: '-',
    client: '-',
    location: '',
  });
  const [errors, setErrors] = useState({});
  const resourceQuery = useQuery({
    queryKey: ['resource', id],
    queryFn: () => recordsApi.get({ module: 'resources', type: 'resources', id }),
    enabled: editing,
  });
  useEffect(() => {
    if (!resourceQuery.data) return;
    const resource = parseResource(resourceQuery.data);
    setForm((current) => ({ ...current, ...resource, name: resource.name, designation: resource.designation,
      reportingManagerId: resource.reportingManagerId || '', skills: resource.skills.join(', ') }));
  }, [resourceQuery.data]);
  const managersQuery = useQuery({
    queryKey: ['reporting-managers', form.department, id],
    queryFn: () => resourceUsersApi.reportingManagers(form.department, id),
    enabled: Boolean(form.department),
  });
  const currenciesQuery = useQuery({ queryKey: ['currency-master'], queryFn: currencyApi.list });
  const saveMutation = useMutation({
    mutationFn: (payload) => editing
      ? recordsApi.update({ module: 'resources', type: 'resources', id, payload })
      : recordsApi.create({ module: 'resources', type: 'resources', payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      navigate('/resources/list', { replace: true, state: { message: 'Resource saved successfully.' } });
    },
  });
  const update = (field, value) => setForm((current) => ({
    ...current,
    [field]: value,
    ...(field === 'department' ? { reportingManagerId: '' } : {}),
  }));
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Full name is required';
    if (!form.email.trim()) nextErrors.email = 'Email is required';
    if (!form.phone.trim()) nextErrors.phone = 'Phone number is required';
    if (!form.department) nextErrors.department = 'Please select a Department.';
    if (form.designation.length > 150) nextErrors.designation = 'Designation must not exceed 150 characters';
    if (!form.skills.trim()) nextErrors.skills = 'Skills are required';
    if (!Number(form.monthlySalary) || Number(form.monthlySalary) <= 0) nextErrors.monthlySalary = 'Monthly Salary must be greater than zero';
    if (!form.salaryCurrency) nextErrors.salaryCurrency = 'Salary Currency is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    saveMutation.mutate(resourcePayload(form));
  };

  return (
    <form onSubmit={submit} className="space-y-5 pb-8 text-[#06134a]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-black">{editing ? 'Edit Resource' : 'Add Resource'}</h1>
          <p className="mt-2 text-base font-semibold text-slate-600">Add a new team member to manage allocations and track availability.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/resources/list" className="grid h-10 min-w-28 place-items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black">Cancel</Link>
          <button disabled={saveMutation.isPending} className="h-10 rounded-lg bg-violet-600 px-7 text-sm font-black text-white shadow-sm shadow-violet-200 disabled:opacity-60">{saveMutation.isPending ? 'Saving...' : editing ? 'Update Resource' : 'Save Resource'}</button>
        </div>
      </div>

      {saveMutation.isError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{saveMutation.error?.response?.data?.message || 'Unable to save resource. Please check backend API.'}</div>}

      <FormSection title="Basic Information" icon={UserRound}>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Full Name" required value={form.name} error={errors.name} onChange={(value) => update('name', value)} placeholder="Enter full name" />
          <Input label="Employee ID" required value={form.employeeId} onChange={(value) => update('employeeId', value)} disabled icon={Lock} />
          <RadioGroup label="Resource Type" required value={form.resourceType} options={['Full Time', 'Contract']} onChange={(value) => update('resourceType', value)} />
          <Input label="Email ID" required value={form.email} error={errors.email} onChange={(value) => update('email', value)} placeholder="Enter email address" />
          <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(value) => update('dateOfBirth', value)} icon={CalendarDays} />
          <Input label="Date of Joining" required type="date" value={form.joiningDate} onChange={(value) => update('joiningDate', value)} icon={CalendarDays} />
          <SelectField label="Department" required value={form.department} error={errors.department} onChange={(value) => update('department', value)} options={departments} />
          <SearchableManagerField value={form.reportingManagerId} onChange={(value) => update('reportingManagerId', value)}
            options={managersQuery.data || []} disabled={!form.department} loading={managersQuery.isLoading} />
          <Input label="Phone Number" required value={form.phone} error={errors.phone} onChange={(value) => update('phone', value)} prefix="+91" placeholder="Enter phone number" />
          <SelectField label="Gender" value={form.gender} onChange={(value) => update('gender', value)} options={['Male', 'Female', 'Other']} />
          <Input label="Notice Period (Days)" value={form.noticePeriod} onChange={(value) => update('noticePeriod', value)} placeholder="Enter notice period" />
          <RadioGroup label="Status" required value={form.status} options={['Active', 'Inactive']} onChange={(value) => update('status', value)} />
        </div>
      </FormSection>

      <FormSection title="Professional Details" icon={BriefcaseBusiness}>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Designation" value={form.designation} error={errors.designation} onChange={(value) => update('designation', value)} placeholder="Senior Java Developer" />
          <Input label="Technology / Skills" required value={form.skills} error={errors.skills} onChange={(value) => update('skills', value)} placeholder="Java, Spring Boot, AWS" />
          <Input label="Total Experience (Years)" value={form.experience} onChange={(value) => update('experience', value)} placeholder="Enter total experience" />
          <Input label="Relevant Experience (Years)" value={form.relevantExperience} onChange={(value) => update('relevantExperience', value)} placeholder="Enter relevant experience" />
          <Input label="Monthly Salary" type="number" required value={form.monthlySalary} error={errors.monthlySalary} onChange={(value) => update('monthlySalary', value)} placeholder="Enter monthly salary" />
          <SelectField label="Salary Currency" required value={form.salaryCurrency} error={errors.salaryCurrency} onChange={(value) => update('salaryCurrency', value)} options={(currenciesQuery.data||[]).map((currency)=>({value:currency.code,label:`${currency.code} – ${currency.name}`}))} />
          <UploadBox label="Profile Picture (Optional)" action="Upload Photo" />
          <TextArea label="Address (Optional)" value={form.address} onChange={(value) => update('address', value)} placeholder="Enter full address" />
        </div>
      </FormSection>

      <FormSection title="Project Preference" icon={BriefcaseBusiness}>
        <div className="grid gap-5 md:grid-cols-3">
          <CheckboxGroup label="Preferred Project Type" value={form.projectType} options={projectTypes} onChange={(value) => update('projectType', value)} />
          <SelectField label="Preferred Domain / Industry" value={form.preferredDomain} onChange={(value) => update('preferredDomain', value)} options={['Banking', 'Healthcare', 'E-Commerce', 'Education', 'Technology']} />
          <SelectField label="Preferred Location" value={form.preferredLocation} onChange={(value) => update('preferredLocation', value)} options={['Chennai', 'Bangalore', 'Pune', 'Remote', 'Hybrid']} />
        </div>
      </FormSection>

      <FormSection title="Documents (Optional)" icon={Upload}>
        <div className="grid gap-5 md:grid-cols-3">
          <UploadBox label="Resume / CV" action="Upload Resume" />
          <UploadBox label="Certificates" action="Upload Certificates" />
          <UploadBox label="Other Documents" action="Upload Documents" />
        </div>
      </FormSection>
    </form>
  );
}

export function ResourceDetailsPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['resource', id],
    queryFn: () => recordsApi.get({ module: 'resources', type: 'resources', id }),
  });
  if (query.isLoading) return <div className="rounded-xl border border-slate-200 bg-white p-6 font-bold">Loading resource...</div>;
  if (query.isError) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 font-bold text-red-600">Unable to load resource.</div>;
  const resource = parseResource(query.data);
  const basicFields = [
    ['Employee ID', resource.employeeId], ['Email', resource.email], ['Phone', resource.phone],
    ['Department', departmentLabel(resource.department)], ['Designation', resource.designation || '-'],
    ['Reporting Manager', resource.manager || 'Not Assigned'], ['Resource Type', resource.resourceType],
    ['Date of Birth', resource.dateOfBirth], ['Date of Joining', resource.joiningDate], ['Gender', resource.gender],
    ['Notice Period', resource.noticePeriod ? `${resource.noticePeriod} days` : '-'], ['Status', resource.status], ['Location', resource.location || '-'],
  ];
  const professionalFields=[['Monthly Salary',resource.monthlySalary!==''?formatCurrency(Number(resource.monthlySalary),resource.salaryCurrency||'INR'):'-'],['Salary Currency',resource.salaryCurrency||'INR'],['Total Experience',resource.experience||'-'],['Relevant Experience',resource.relevantExperience||'-'],['Technology / Skills',resource.skills.length?resource.skills.join(', '):'-'],['Address',resource.address||'-']];
  const assignmentFields=[['Preferred Project Type',resource.projectType],['Preferred Domain / Industry',resource.preferredDomain||'-'],['Preferred Location',resource.preferredLocation||'-'],['Current Project',resource.currentProject],['Client',resource.client],['Availability',resource.availability],['Utilization',`${resource.utilization}%`]];
  const details=(fields)=><dl className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">{fields.map(([label,value])=><div key={label}><dt className="text-xs font-black text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-black">{value||'-'}</dd></div>)}</dl>;
  return <section className="space-y-5 text-[#06134a]">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">Resources / Details</p><h1 className="mt-1 text-3xl font-black">{resource.name}</h1></div><Link to={`/resources/${id}/edit`} className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-black text-white">Edit Resource</Link></div>
    <FormSection title="Basic Information" icon={UserRound}>{details(basicFields)}</FormSection>
    <FormSection title="Professional Details" icon={BriefcaseBusiness}>{details(professionalFields)}</FormSection>
    <FormSection title="Project Preference & Allocation" icon={UsersRound}>{details(assignmentFields)}</FormSection>
  </section>;
}

function ResourcePlaceholderPage({ mode }) {
  return (
    <section className="space-y-5 text-[#06134a]">
      <h1 className="text-3xl font-black">{mode === 'allocation' ? 'Allocation' : 'Availability Calendar'}</h1>
      <p className="text-base font-semibold text-slate-600">Resource {mode === 'allocation' ? 'allocation' : 'availability'} planning will appear here.</p>
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm font-bold text-slate-600">Use Resource List to add and manage team members.</div>
    </section>
  );
}

function ActionButton({ children, icon: Icon }) {
  return <button className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black shadow-sm">{Icon && <Icon className="h-4 w-4" />}{children}</button>;
}

function Select({ label, value, onChange, options }) {
  return <label className="block min-w-0"><span className="mb-2 block h-4 text-xs font-black">{label}</span><span className="flex h-11 items-center rounded-lg border border-slate-200 bg-white"><select value={value} onChange={(event) => onChange(event.target.value)} className="h-full min-w-0 flex-1 appearance-none bg-transparent px-3 text-sm font-semibold outline-none"><option value="">All</option>{options.map((option) => { const item = typeof option === 'string' ? { value: option, label: option } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select><ChevronDown className="mr-3 h-4 w-4 shrink-0 text-slate-500" /></span></label>;
}

function FormSection({ title, icon: Icon, children }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-3 text-lg font-black"><span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-700"><Icon className="h-4 w-4" /></span>{title}</h2><div className="mt-5">{children}</div></section>;
}

function Input({ label, value, onChange, required, error, placeholder, type = 'text', disabled, prefix, icon: Icon }) {
  return <label className="block"><span className="text-sm font-black">{label}{required && <span className="text-red-600"> *</span>}</span><span className={`mt-2 flex h-11 items-center overflow-hidden rounded-lg border bg-white ${error ? 'border-red-300' : 'border-slate-200'}`}>{prefix && <span className="grid h-full min-w-14 place-items-center border-r border-slate-200 text-sm font-bold">{prefix}</span>}<input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-full min-w-0 flex-1 px-3 text-sm font-semibold outline-none placeholder:text-slate-400 disabled:bg-slate-50" />{Icon && <Icon className="mr-3 h-4 w-4 text-slate-400" />}</span>{error && <span className="mt-1 block text-xs font-bold text-red-600">{error}</span>}</label>;
}

function SelectField({ label, value, onChange, options, required, error }) {
  return <label className="block"><span className="text-sm font-black">{label}{required && <span className="text-red-600"> *</span>}</span><span className={`mt-2 flex h-11 items-center rounded-lg border bg-white ${error ? 'border-red-300' : 'border-slate-200'}`}><select value={value} onChange={(event) => onChange(event.target.value)} className="h-full min-w-0 flex-1 appearance-none bg-transparent px-3 text-sm font-semibold outline-none"><option value="">Select {label.toLowerCase()}</option>{options.map((option) => { const item = typeof option === 'string' ? { value: option, label: option } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select><ChevronDown className="mr-3 h-4 w-4" /></span>{error && <span className="mt-1 block text-xs font-bold text-red-600">{error}</span>}</label>;
}

function SearchableManagerField({ value, onChange, options, disabled, loading }) {
  const selected = options.find((option) => String(option.id) === String(value));
  const [text, setText] = useState('');
  useEffect(() => { setText(selected?.name || ''); }, [selected?.name]);
  const listId = 'reporting-manager-options';
  return <label className="block"><span className="text-sm font-black">Reporting Manager</span>
    <input list={listId} disabled={disabled} value={text} onChange={(event) => {
      const next = event.target.value; setText(next);
      const match = options.find((option) => option.name === next); onChange(match?.id || '');
    }} placeholder={disabled ? 'Select department first' : loading ? 'Loading managers...' : options.length ? 'Search and select manager' : 'No eligible managers'}
      className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none disabled:bg-slate-50" />
    <datalist id={listId}>{options.map((option) => <option key={option.id} value={option.name} />)}</datalist>
  </label>;
}

function RadioGroup({ label, value, options, onChange, required }) {
  return <div><p className="text-sm font-black">{label}{required && <span className="text-red-600"> *</span>}</p><div className="mt-4 flex gap-5">{options.map((option) => <label key={option} className="flex items-center gap-2 text-sm font-semibold"><input type="radio" name={label} value={option} checked={value === option} onChange={() => onChange(option)} className="accent-violet-600" />{option}</label>)}</div></div>;
}

function CheckboxGroup({ label, value, options, onChange }) {
  return <div><p className="text-sm font-black">{label}<span className="text-red-600"> *</span></p><div className="mt-4 flex flex-wrap gap-5">{options.map((option) => <label key={option} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={value === option || value === 'Both'} onChange={() => onChange(option)} className="accent-violet-600" />{option}</label>)}</div></div>;
}

function TextArea({ label, value, onChange, placeholder }) {
  return <label className="block xl:col-span-2"><span className="text-sm font-black">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-28 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm font-semibold outline-none placeholder:text-slate-400" /></label>;
}

function UploadBox({ label, action }) {
  return <div><p className="mb-2 text-sm font-black">{label}</p><div className="grid h-24 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center"><div><Upload className="mx-auto h-5 w-5" /><p className="mt-2 text-sm font-black">{action}</p><p className="text-xs text-slate-500">PDF, DOC, JPG, PNG (Max. 5MB)</p></div></div></div>;
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'RS';
}
