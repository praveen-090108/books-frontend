import {
  BadgeIndianRupee,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleAlert,
  CircleHelp,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  Upload,
  FileBox,
  Filter,
  Gauge,
  Globe2,
  LayoutGrid,
  Milestone,
  MoreVertical,
  Eye,
  Trash2,
  X,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  TimerReset,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordsApi } from '../../api/recordsApi.js';
import { currencyApi } from '../../api/currencyApi.js';
import { domainIndustriesApi } from '../../api/domainIndustriesApi.js';
import { fixedCostProjectsApi } from '../../api/fixedCostProjectsApi.js';
import { projectMilestonesApi } from '../../api/projectMilestonesApi.js';
import { fixedCostProjectTeamApi } from '../../api/fixedCostProjectTeamApi.js';
import { fixedCostProjectProfitabilityApi } from '../../api/fixedCostProjectProfitabilityApi.js';
import { projectDocumentsApi } from '../../api/projectDocumentsApi.js';
import { projectInvoicesApi } from '../../api/projectInvoicesApi.js';
import { staffingSowsApi } from '../../api/staffingSowsApi.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { hasPermission } from '../../utils/accessControl.js';
import { currentFinancialYearRange, OverviewDateFilter } from '../../components/OverviewDateFilter.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate } from '../../utils/records.js';

const PROJECT_MODULE = 'projects';
const FIXED_COST_TYPE = 'fixedCost';
const STAFFING_TYPE = 'staffing';

const projectTechnologies = ['Java', 'Spring Boot', 'ReactJS', 'PostgreSQL', 'Angular', 'React Native', 'AWS', 'Node.js'];
const projectStatuses = ['Planned', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
const staffingStatuses = ['Active', 'Hold', 'Close'];
const durationOptions = [
  ...Array.from({length:12},(_,i)=>({value:`${i+1}_MONTHS`,label:`${i+1} Month${i?'s':''}${i===11?' / 1 Year':''}`})),
  ...[15,18,21,24,27,30,33,36].map((month)=>({value:`${month}_MONTHS`,label:`${month} Months${month===18?' / 1.5 Years':month===24?' / 2 Years':month===30?' / 2.5 Years':month===36?' / 3 Years':''}`})),
  {value:'CUSTOM',label:'Custom'},
];

function uniqueOptions(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function optionWithCurrent(options, current) {
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

function parseJsonNotes(notes) {
  try {
    return notes ? JSON.parse(notes) : {};
  } catch {
    return {};
  }
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function localDateInput(value) {
  if (!value) return '';
  const date=value instanceof Date?value:new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function numberValue(value) {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '');
  return Number(cleaned || 0);
}

function customerGroupKey(value) {
  return String(value || 'Customer').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function money(value,currency='INR') {
  return formatCurrency(Number(value || 0),String(currency||'INR').slice(0,3).toUpperCase());
}

function currencyCode(value) {
  return String(value || 'INR').trim().slice(0, 3).toUpperCase();
}

function sowDateStatus(endDate) {
  if (!endDate) return { value: 'UNKNOWN', label: 'Not Set', tone: 'slate' };
  const end = new Date(`${endDate}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.ceil((end - today) / 86400000);
  if (days < 0) return { value: 'EXPIRED', label: 'Expired', tone: 'red' };
  if (days <= 30) return { value: 'EXPIRING_SOON', label: 'Expiring Soon', tone: 'amber' };
  return { value: 'ACTIVE', label: 'Normal', tone: 'green' };
}

function canEditStaffing(user) {
  return user?.role === 'admin' || user?.permissions?.includes('*') || hasPermission(user, 'PROJECT_STAFFING_EDIT');
}

function currencyTotals(items, amountOf, currencyOf) {
  const totals = new Map();
  items.forEach((item) => {
    const code = currencyCode(currencyOf(item));
    totals.set(code, (totals.get(code) || 0) + Number(amountOf(item) || 0));
  });
  return [...totals.entries()].map(([code, amount]) => money(amount, code)).join(' + ') || money(0);
}

function monthsBetween(start, end) {
  if (!start || !end) return 6;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1;
  return Math.max(1, months || 1);
}

function fixedProjectFromRecord(record, index = 0) {
  const notes = parseJsonNotes(record.notes);
  const amount = Number(record.amount || 0);
  const remaining = Number(record.balanceAmount || 0);
  const billed = Math.max(0, amount - remaining);
  const billedPercent = amount ? Math.round((billed / amount) * 100) : 0;
  const milestoneTotal = Number(notes.milestoneTotal || 6);
  const milestoneCompleted = Number(notes.milestoneCompleted || Math.max(1, Math.round((billedPercent / 100) * milestoneTotal)));
  const colors = ['violet', 'green', 'blue', 'orange', 'pink', 'cyan'];
  const icons = [Globe2, ShoppingCart, Smartphone, Gauge, FileBox, CircleAlert, ReceiptText];
  return {
    id: record.id,
    record,
    project: record.partyName || 'Untitled Project',
    code: record.recordNumber || `PRJ-${record.id}`,
    customer: record.partyCity || notes.customer || 'Customer',
    manager: record.ownerName || notes.manager || 'Project Manager',
    contract: money(amount,record.paymentMode),
    contractAmount: amount,
    billed: money(billed,record.paymentMode),
    billedAmount: billed,
    billedPercent,
    remaining: money(remaining,record.paymentMode),
    start: formatDate(record.recordDate),
    end: formatDate(record.dueDate),
    rawStart: toDateInput(record.recordDate),
    rawEnd: toDateInput(record.dueDate),
    status: record.status || 'Planned',
    projectType: record.category || 'Software Development',
    billingType: record.secondaryStatus || 'Fixed Cost',
    currency: record.paymentMode || 'INR - Indian Rupee',
    technology: record.referenceNumber || notes.technology || 'Java',
    technologies: notes.technologies || [record.referenceNumber || 'Java', 'Spring Boot', 'ReactJS', 'PostgreSQL'],
    milestones: `${Math.min(milestoneCompleted, milestoneTotal)} / ${milestoneTotal}`,
    milestonePercent: milestoneTotal ? Math.round((Math.min(milestoneCompleted, milestoneTotal) / milestoneTotal) * 100) : 0,
    margin: notes.margin || `${(28 + (index % 5) * 3.4).toFixed(2)}%`,
    priority: notes.priority || 'High Priority',
    description: record.notes && !record.notes.trim().startsWith('{') ? record.notes : notes.description || 'Project details are stored in the project record.',
    durationMonths: monthsBetween(record.recordDate, record.dueDate),
    color: colors[index % colors.length],
    icon: icons[index % icons.length],
  };
}

function fixedProjectPayload(form) {
  return {
    recordNumber: form.projectCode || `PRJ-${Date.now().toString().slice(-5)}`,
    partyName: form.projectName,
    partyEmail: '',
    partyPhone: '',
    partyCity: form.customer,
    category: form.projectType,
    status: form.status,
    secondaryStatus: form.billingType,
    amount: numberValue(form.contractValue),
    balanceAmount: Math.max(0, numberValue(form.contractValue) - numberValue(form.billedToDate)),
    recordDate: form.startDate || new Date().toISOString().slice(0, 10),
    dueDate: form.endDate || form.startDate || new Date().toISOString().slice(0, 10),
    referenceNumber: form.technology,
    paymentMode: form.currencyCode,
    ownerName: form.projectManager,
    notes: JSON.stringify({
      customer: form.customer,
      description: form.description,
      internalNotes: form.internalNotes,
      technologies: form.technologies.split(',').map((item) => item.trim()).filter(Boolean),
      domain: form.domain,
      domainIndustryId: form.domainIndustryId ? Number(form.domainIndustryId) : null,
      projectManagerId: Number(form.projectManagerId),
      currencyCode: form.currencyCode,
      estimatedDuration: form.estimatedDuration,
      customDurationValue: form.estimatedDuration === 'CUSTOM' ? Number(form.customDurationValue) : null,
      customDurationUnit: form.estimatedDuration === 'CUSTOM' ? form.customDurationUnit : null,
      teamMemberIds: form.teamMemberIds.map(Number),
      priority: form.priority,
      tags: form.tags,
      milestoneTotal: Number(form.milestoneTotal || 6),
      milestoneCompleted: Number(form.milestoneCompleted || 0),
      margin: form.margin || '32.45%',
      enableMilestones: form.enableMilestones,
      enableTimeTracking: form.enableTimeTracking,
      enableExpenses: form.enableExpenses,
      isActive: form.isActive,
    }),
  };
}

function fixedProjectFormFromRecord(record) {
  const notes = parseJsonNotes(record?.notes);
  const inferredMonths=monthsBetween(record?.recordDate,record?.dueDate);
  const predefinedMonths=new Set([...Array.from({length:12},(_,i)=>i+1),15,18,21,24,27,30,33,36]);
  const inferredDuration=predefinedMonths.has(inferredMonths)?`${inferredMonths}_MONTHS`:'CUSTOM';
  return {
    projectName: record?.partyName || '',
    projectCode: record?.recordNumber || `PRJ-${Date.now().toString().slice(-5)}`,
    projectType: record?.category || 'Software Development',
    billingType: record?.secondaryStatus || 'Fixed Cost',
    customer: record?.partyCity || notes.customer || '',
    projectManager: record?.ownerName || '',
    projectManagerId: String(notes.projectManagerId || ''),
    contractValue: String(record?.amount || ''),
    billedToDate: String(Math.max(0, Number(record?.amount || 0) - Number(record?.balanceAmount || 0))),
    currencyCode: String(notes.currencyCode || record?.paymentMode || 'INR').slice(0,3).toUpperCase(),
    startDate: toDateInput(record?.recordDate) || new Date().toISOString().slice(0, 10),
    endDate: toDateInput(record?.dueDate),
    estimatedDuration: notes.estimatedDuration || inferredDuration,
    customDurationValue: String(notes.customDurationValue || (inferredDuration==='CUSTOM'?inferredMonths:'')),
    customDurationUnit: notes.customDurationUnit || 'MONTHS',
    status: record?.status || 'Planned',
    description: notes.description || (!String(record?.notes || '').trim().startsWith('{') ? record?.notes || '' : ''),
    internalNotes: notes.internalNotes || '',
    technology: record?.referenceNumber || 'Java',
    technologies: (notes.technologies || [record?.referenceNumber || 'Java']).filter(Boolean).join(', '),
    domain: notes.domain || 'Technology',
    domainIndustryId: String(notes.domainIndustryId || ''),
    teamMemberIds: Array.isArray(notes.teamMemberIds) ? notes.teamMemberIds.map(String) : [],
    priority: notes.priority || 'High Priority',
    tags: notes.tags || '',
    milestoneTotal: String(notes.milestoneTotal || 6),
    milestoneCompleted: String(notes.milestoneCompleted || 0),
    margin: notes.margin || '32.45%',
    enableMilestones: notes.enableMilestones ?? true,
    enableTimeTracking: notes.enableTimeTracking ?? true,
    enableExpenses: notes.enableExpenses ?? true,
    isActive: notes.isActive ?? true,
  };
}

function staffingAssignmentFromRecord(record, index = 0) {
  const notes = parseJsonNotes(record.notes);
  const resourceName = record.ownerName || notes.selectedResource || 'Resource';
  const amount = Number(record.amount || 0);
  return {
    id: record.id,
    record,
    customer: record.partyName || 'Customer',
    resources: `${Number(notes.totalResources || 1)} Resource${Number(notes.totalResources || 1) > 1 ? 's' : ''}`,
    selected: Number(notes.totalResources || 1),
    billing: money(amount,record.paymentMode),
    billingAmount: amount,
    selectedResource: notes.selectedResource || resourceName,
    workingResource: notes.workingResource || resourceName,
    rate: notes.rate || String(Math.round(amount / Math.max(1, Number(notes.totalResources || 1)))),
    currency: currencyCode(record.paymentMode),
    billingType: record.secondaryStatus || 'T&M',
    monthlyBilling: formatCurrency(amount, String(record.paymentMode || 'INR').trim().slice(0, 3).toUpperCase()),
    startDate: formatDate(record.recordDate),
    sowEndDate: record.dueDate ? formatDate(record.dueDate) : '-',
    closeDate: record.closedDate ? formatDate(record.closedDate) : '-',
    closeDateValue: toDateInput(record.closedDate),
    sowStartDateValue: toDateInput(record.recordDate),
    sowEndDateValue: toDateInput(record.dueDate),
    technology: record.referenceNumber || record.category || 'Java',
    noticePeriod: notes.noticePeriod || '30 days',
    sowDuration: notes.sowDuration || '12 Months',
    experience: notes.experience || `${4 + (index % 4)}+ years`,
    status: record.status || 'Active',
    notes: notes.comments || '',
  };
}

function staffingPayload(form) {
  const totalResources = Math.max(1, Number(form.totalResources || 1));
  const monthlyBilling = numberValue(form.monthlyBilling) || numberValue(form.rate) * totalResources;
  const startDate = form.startDate || new Date().toISOString().slice(0, 10);
  const sowEndDate = form.closedDate;
  return {
    recordNumber: form.assignmentCode || `ASG-${Date.now().toString().slice(-5)}`,
    partyName: form.customer,
    partyEmail: '',
    partyPhone: '',
    partyCity: form.customer,
    category: form.technology,
    status: form.status,
    secondaryStatus: form.billingType,
    amount: monthlyBilling,
    balanceAmount: 0,
    recordDate: startDate,
    dueDate: sowEndDate,
    closedDate: form.status === 'Close' ? form.closeDate : null,
    referenceNumber: form.technology,
    paymentMode: form.currency,
    ownerName: form.workingResource,
    notes: JSON.stringify({
      totalResources,
      selectedResource: form.selectedResource,
      workingResource: form.workingResource,
      rate: form.rate,
      noticePeriod: form.noticePeriod,
      sowDuration: form.sowDuration,
      experience: form.experience,
      comments: form.comments,
    }),
  };
}

function staffingFormFromRecord(record) {
  const notes = parseJsonNotes(record?.notes);
  return {
    assignmentCode: record?.recordNumber || `ASG-${Date.now().toString().slice(-5)}`,
    customer: record?.partyName || '',
    totalResources: String(notes.totalResources || 1),
    totalBilling: String(record?.amount || 0),
    noticePeriod: notes.noticePeriod || '30 days',
    sowDuration: notes.sowDuration || '12 Months',
    startDate: toDateInput(record?.recordDate) || new Date().toISOString().slice(0, 10),
    closedDate: toDateInput(record?.dueDate),
    closeDate: toDateInput(record?.closedDate),
    selectedResource: notes.selectedResource || record?.ownerName || '',
    workingResource: notes.workingResource || record?.ownerName || '',
    technology: record?.referenceNumber || record?.category || 'Java',
    experience: notes.experience || '',
    rate: notes.rate || '',
    currency: record?.paymentMode || 'INR',
    billingType: record?.secondaryStatus || 'T&M',
    monthlyBilling: String(record?.amount || ''),
    status: record?.status || 'Active',
    comments: notes.comments || '',
  };
}

function projectResourceFromRecord(record) {
  const notes = parseJsonNotes(record.notes);
  return {
    projectType: record.paymentMode || notes.projectType || '',
    utilization: Number(record.amount || 0),
    availability: record.secondaryStatus || 'Available',
  };
}

function projectMonthBuckets(dateRange, fixedRecords, staffingRecords) {
  const start = new Date(`${dateRange.dateFrom}T00:00:00`);
  const end = new Date(`${dateRange.dateTo}T00:00:00`);
  const buckets = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end && buckets.length < 24) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      label: new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(cursor),
      fixed: 0,
      staffing: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  fixedRecords.forEach((record) => {
    const bucket = byKey.get(String(record.recordDate || '').slice(0, 7));
    if (bucket) bucket.fixed += Number(record.amount || 0);
  });
  staffingRecords.forEach((record) => {
    const bucket = byKey.get(String(record.recordDate || '').slice(0, 7));
    if (bucket) bucket.staffing += Number(record.amount || 0);
  });
  return buckets;
}

export function ProjectPage({ type = 'overview' }) {
  if (type === 'staffing') return <StaffingPage />;
  if (type === 'staffingNew') return <AddResourceAssignmentPage />;
  if (type === 'staffingEdit') return <AddResourceAssignmentPage mode="edit" />;
  if (type === 'staffingDetail') return <StaffingProjectDetailsPage />;
  if (type === 'fixedCost') return <FixedCostProjectsListPage />;
  if (type === 'fixedCostNew') return <AddFixedCostProjectPage />;
  if (type === 'fixedCostEdit') return <AddFixedCostProjectPage mode="edit" />;
  if (type === 'fixedCostDetail') return <FixedCostProjectPage />;
  if (type === 'milestones') return <ProjectMilestonesPage />;
  return <ProjectOverviewPage />;
}

function ProjectOverviewPage() {
  const [dateRange, setDateRange] = useState(currentFinancialYearRange);
  const fixedQueryParams = { module: PROJECT_MODULE, type: FIXED_COST_TYPE, page: 0, size: 500, sort: 'recordDate,asc', ...dateRange };
  const staffingQueryParams = { module: PROJECT_MODULE, type: STAFFING_TYPE, page: 0, size: 500, sort: 'recordDate,asc', ...dateRange };
  const resourceQueryParams = { module: 'resources', type: 'resources', page: 0, size: 500, status: 'Active', dateTo: dateRange.dateTo, sort: 'recordDate,asc' };
  const fixedQuery = useQuery({
    queryKey: ['project-overview', 'fixed-cost', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () => recordsApi.list(fixedQueryParams),
  });
  const staffingQuery = useQuery({
    queryKey: ['project-overview', 'staffing', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () => recordsApi.list(staffingQueryParams),
  });
  const resourcesQuery = useQuery({
    queryKey: ['project-overview', 'resources', dateRange.dateTo],
    queryFn: () => recordsApi.list(resourceQueryParams),
  });
  const fixedRecords = fixedQuery.data?.content || [];
  const staffingRecords = staffingQuery.data?.content || [];
  const fixed = fixedRecords.map(fixedProjectFromRecord);
  const staffing = staffingRecords.map(staffingAssignmentFromRecord);
  const resources = (resourcesQuery.data?.content || []).map(projectResourceFromRecord);
  const staffingResources = resources.filter((resource) => ['Staffing', 'Both'].includes(resource.projectType));
  const fixedResources = resources.filter((resource) => ['Fixed Cost', 'Both'].includes(resource.projectType));
  const averageUtilization = (rows) => rows.length ? Math.round(rows.reduce((sum, row) => sum + row.utilization, 0) / rows.length) : 0;
  const staffingUtilization = averageUtilization(staffingResources);
  const fixedUtilization = averageUtilization(fixedResources);
  const fixedRevenue = fixedRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const staffingRevenue = staffingRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const totalRevenue = fixedRevenue + staffingRevenue;
  const fixedInProgress = fixed.filter((project) => project.status === 'In Progress').length;
  const fixedCompleted = fixed.filter((project) => project.status === 'Completed').length;
  const staffingInProgress = staffing.filter((assignment) => assignment.status === 'Active').length;
  const staffingCompleted = staffing.filter((assignment) => assignment.status === 'Closed').length;
  const totalProjects = fixed.length + staffing.length;
  const percentage = (count) => totalProjects ? Math.round((count / totalProjects) * 100) : 0;
  const fixedShare = totalRevenue ? Math.round((fixedRevenue / totalRevenue) * 1000) / 10 : 0;
  const staffingShare = totalRevenue ? Math.round((staffingRevenue / totalRevenue) * 1000) / 10 : 0;
  const trend = projectMonthBuckets(dateRange, fixedRecords, staffingRecords);
  const topStaffingRows = [...staffing]
    .sort((left, right) => numberValue(right.record?.amount || right.billing) - numberValue(left.record?.amount || left.billing))
    .slice(0, 5)
    .map((assignment) => [assignment.record?.recordNumber || assignment.customer, assignment.customer, String(numberValue(parseJsonNotes(assignment.record?.notes).totalResources || 1)), `${staffingUtilization}%`, money(assignment.record?.amount,assignment.currency)]);
  const topFixedRows = [...fixed]
    .sort((left, right) => right.contractAmount - left.contractAmount)
    .slice(0, 5)
    .map((project) => [project.project, project.customer, `${project.billedPercent}%`, money(project.contractAmount,project.currency)]);
  const recentActivities = [...fixedRecords.map((record) => ({ ...record, kind: 'Fixed Cost Project' })), ...staffingRecords.map((record) => ({ ...record, kind: 'Staffing Assignment' }))]
    .sort((left, right) => String(right.recordDate || '').localeCompare(String(left.recordDate || '')))
    .slice(0, 4);
  const loading = fixedQuery.isLoading || staffingQuery.isLoading || resourcesQuery.isLoading;
  const fetching = fixedQuery.isFetching || staffingQuery.isFetching || resourcesQuery.isFetching;
  const hasError = fixedQuery.isError || staffingQuery.isError || resourcesQuery.isError;
  const refresh = () => Promise.all([fixedQuery.refetch(), staffingQuery.refetch(), resourcesQuery.refetch()]);

  return (
    <section className="space-y-5 text-[#06134a]">
      <PageTitle
        title="Project Overview"
        subtitle="Get a complete overview of your projects, resources and revenue."
        actions={<OverviewDateFilter value={dateRange} onChange={setDateRange} onRefresh={refresh} loading={fetching} />}
      />

      {loading && <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">Loading project overview...</div>}
      {hasError && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">Project overview data could not be loaded. Check the backend connection and try again.</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={FileBox} label="Fixed Cost Projects" value={fixed.length} meta={`${fixedInProgress} In Progress • ${fixedCompleted} Completed`} color="violet" />
        <MetricCard icon={UsersRound} label="Staffing Projects" value={staffing.length} meta={`${staffingInProgress} Active • ${staffingCompleted} Closed`} color="blue" />
        <MetricCard icon={Gauge} label="Resources on Staffing" value={staffingResources.length} meta={`Utilization ${staffingUtilization}%`} color="emerald" />
        <MetricCard icon={UsersRound} label="Resources on Fixed Cost" value={fixedResources.length} meta={`Utilization ${fixedUtilization}%`} color="orange" />
        <MetricCard icon={CircleDollarSign} label="Revenue - Fixed Cost" value={currencyTotals(fixed,(item)=>item.contractAmount,(item)=>item.currency)} meta="By project currency" color="green" />
        <MetricCard icon={ShieldCheck} label="Revenue - Staffing" value={currencyTotals(staffing,(item)=>item.billingAmount,(item)=>item.currency)} meta="By assignment currency" color="sky" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.95fr)_minmax(0,0.8fr)]">
        <Panel title="Revenue Trend" action={<span className="text-xs font-black text-slate-500">Monthly</span>}>
          <ProjectTrendChart buckets={trend} />
        </Panel>
        <Panel title="Projects Status">
          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
            <Donut center={String(totalProjects)} sub="Total Projects" segments={`conic-gradient(#7c3aed 0 ${percentage(fixedInProgress)}%, #22c55e ${percentage(fixedInProgress)}% ${percentage(fixedInProgress + fixedCompleted)}%, #1478ff ${percentage(fixedInProgress + fixedCompleted)}% ${percentage(fixedInProgress + fixedCompleted + staffingInProgress)}%, #f59e0b ${percentage(fixedInProgress + fixedCompleted + staffingInProgress)}% 100%)`} />
            <Legend items={[
              ['Fixed Cost - In Progress', `${fixedInProgress} (${percentage(fixedInProgress)}%)`, 'bg-violet-600'],
              ['Fixed Cost - Completed', `${fixedCompleted} (${percentage(fixedCompleted)}%)`, 'bg-emerald-500'],
              ['Staffing - Active', `${staffingInProgress} (${percentage(staffingInProgress)}%)`, 'bg-blue-600'],
              ['Staffing - Closed', `${staffingCompleted} (${percentage(staffingCompleted)}%)`, 'bg-orange-400'],
            ]} />
          </div>
        </Panel>
        <Panel title="Resource Utilization">
          <GaugeView value={`${averageUtilization(resources)}%`} subtitle="Overall Utilization" resourceLabel={`${resources.length} active resources`} />
          <ProgressLine label="Staffing Utilization" value={`${staffingUtilization}%`} color="bg-violet-600" />
          <ProgressLine label="Fixed Cost Utilization" value={`${fixedUtilization}%`} color="bg-blue-600" />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)]">
        <MiniTable title="Top Staffing Projects" columns={['Assignment', 'Client', 'Resources', 'Utilization', 'Revenue']} rows={topStaffingRows} emptyMessage="No staffing projects in this period." />
        <MiniTable title="Top Fixed Cost Projects" columns={['Project Name', 'Client', 'Progress', 'Revenue']} rows={topFixedRows} progressColumn={2} emptyMessage="No fixed cost projects in this period." />
        <Panel title="Revenue Summary" action={<span className="text-xs font-black text-slate-500">Selected period</span>}>
          <p className="text-sm font-bold text-slate-500">Total Revenue</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-xl font-black">{currencyTotals([...fixed,...staffing],(item)=>item.contractAmount??item.billingAmount,(item)=>item.currency)}</p>
          </div>
          <p className="mt-1 text-xs font-bold text-slate-500">{formatDate(dateRange.dateFrom)} - {formatDate(dateRange.dateTo)}</p>
          <div className="mt-6 space-y-5">
            <ProgressLine label="Fixed Cost Revenue" value={currencyTotals(fixed,(item)=>item.contractAmount,(item)=>item.currency)} meta={`${fixedShare}%`} color="bg-violet-600" />
            <ProgressLine label="Staffing Revenue" value={currencyTotals(staffing,(item)=>item.billingAmount,(item)=>item.currency)} meta={`${staffingShare}%`} color="bg-blue-600" />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,0.85fr)]">
        <Panel title="Resource Engagement Summary">
          <EngagementRows rows={[
            ['Staffing Projects', staffing.length, staffingResources.length, staffingResources.filter((resource) => resource.utilization > 0).length, `${staffingUtilization}%`, 'bg-blue-50 text-blue-600'],
            ['Fixed Cost Projects', fixed.length, fixedResources.length, fixedResources.filter((resource) => resource.utilization > 0).length, `${fixedUtilization}%`, 'bg-violet-50 text-violet-600'],
          ]} />
        </Panel>
        <Panel title="Recent Activities">
          <ActivityList records={recentActivities} />
        </Panel>
      </div>
    </section>
  );
}

function RenewSowModal({ assignment, onClose, onRenewed }) {
  const queryClient = useQueryClient();
  const currentQuery = useQuery({ queryKey:['staffing-sows',assignment?.id,'current'], queryFn:()=>staffingSowsApi.current(assignment.id), enabled:Boolean(assignment) });
  const [form,setForm]=useState({startDate:'',endDate:'',notes:'',document:null});
  const [error,setError]=useState('');
  useEffect(()=>{if(!assignment)return;const priorEnd=assignment.sowEndDateValue;const nextStart=priorEnd?new Date(`${priorEnd}T00:00:00`):new Date();nextStart.setDate(nextStart.getDate()+1);setForm({startDate:localDateInput(nextStart),endDate:'',notes:'',document:null});setError('');},[assignment]);
  const mutation=useMutation({mutationFn:()=>staffingSowsApi.renew(assignment.id,form),onSuccess:()=>{queryClient.invalidateQueries({queryKey:['staffing-sows',assignment.id]});onRenewed?.();},onError:(failure)=>setError(failure.response?.data?.message||'Unable to renew SOW.')});
  if(!assignment)return null;
  const submit=(event)=>{event.preventDefault();if(!form.startDate)return setError('New SOW Start Date is required.');if(!form.endDate)return setError('New SOW End Date is required.');if(form.endDate<form.startDate)return setError('New SOW End Date cannot be earlier than Start Date.');if(!form.document)return setError('Signed SOW Document is required.');setError('');mutation.mutate();};
  const current=currentQuery.data;
  return <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#06134a]/60 p-4"><form onSubmit={submit} className="my-6 w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b p-5"><div><h2 className="text-xl font-black">Renew SOW</h2><p className="mt-1 text-sm font-semibold text-slate-500">{assignment.customer} • {assignment.workingResource}</p></div><button type="button" onClick={onClose}><X className="h-5 w-5"/></button></header><div className="space-y-5 p-5">{error&&<p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Current SOW</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><InfoLine label="Start Date" value={current?.startDate?formatDate(current.startDate):assignment.startDate}/><InfoLine label="End Date" value={current?.endDate?formatDate(current.endDate):assignment.sowEndDate}/><InfoLine label="Document" value={current?.documentName||'Not attached'}/></div></div><div className="grid gap-4 sm:grid-cols-2"><ProjectDateInput label="New SOW Start Date" value={form.startDate} onChange={(value)=>setForm({...form,startDate:value})} required/><ProjectDateInput label="New SOW End Date" value={form.endDate} onChange={(value)=>setForm({...form,endDate:value})} required/><label className="block sm:col-span-2"><span className="mb-2 block text-sm font-black">Signed SOW Document <b className="text-red-600">*</b></span><input type="file" accept=".pdf,.doc,.docx" onChange={(event)=>setForm({...form,document:event.target.files?.[0]||null})} className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label><label className="block sm:col-span-2"><span className="mb-2 block text-sm font-black">Notes / Remarks</span><textarea rows="3" value={form.notes} onChange={(event)=>setForm({...form,notes:event.target.value})} className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-red-300"/></label></div></div><footer className="flex justify-end gap-3 border-t p-4"><button type="button" onClick={onClose} className="h-10 rounded-lg border px-5 text-sm font-black">Cancel</button><button disabled={mutation.isPending} className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white disabled:opacity-60">{mutation.isPending?'Renewing...':'Renew SOW'}</button></footer></form></div>;
}

function StaffingPage() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renewTarget, setRenewTarget] = useState(null);
  const [sowStatus, setSowStatus] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const today = new Date();
  const inThirtyDays = new Date(today); inThirtyDays.setDate(inThirtyDays.getDate() + 30);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const sowDates = sowStatus === 'EXPIRED' ? { dueDateTo: localDateInput(yesterday) }
    : sowStatus === 'EXPIRING_SOON' ? { dueDateFrom: localDateInput(today), dueDateTo: localDateInput(inThirtyDays) }
      : sowStatus === 'ACTIVE' ? { dueDateFrom: localDateInput(new Date(inThirtyDays.getTime() + 86400000)) } : {};
  const queryParams = { module: PROJECT_MODULE, type: STAFFING_TYPE, page, size: pageSize, search, status, sort: 'recordDate,desc', ...sowDates };
  const listQuery = useQuery({
    queryKey: ['records', queryParams],
    queryFn: () => recordsApi.list(queryParams),
  });
  const assignments = useMemo(() => (listQuery.data?.content || []).map(staffingAssignmentFromRecord), [listQuery.data]);
  useEffect(() => { setPage(0); }, [search, status, sowStatus]);
  useEffect(() => { if (page > 0 && Number(listQuery.data?.totalPages || 0) <= page) setPage(Math.max(0, Number(listQuery.data?.totalPages || 1) - 1)); }, [listQuery.data?.totalPages, page]);
  const summary = useMemo(() => {
    const customers = new Set(assignments.map((item) => customerGroupKey(item.customer)));
    const totalBilling = currencyTotals(assignments,(item)=>item.billingAmount,(item)=>item.currency);
    const oneCurrency = new Set(assignments.map((item)=>currencyCode(item.currency))).size <= 1;
    return {
      customers: customers.size,
      resources: assignments.reduce((sum, item) => sum + Number(item.selected || 0), 0),
      billing: totalBilling,
      averageBilling: oneCurrency ? money(assignments.reduce((sum,item)=>sum+item.billingAmount,0)/Math.max(1,assignments.reduce((sum,item)=>sum+item.selected,0)),assignments[0]?.currency) : 'Multiple currencies',
      active: assignments.filter((item) => item.status === 'Active').length,
      notice: assignments.filter((item) => String(item.noticePeriod).includes('60')).length || Math.min(8, assignments.length),
    };
  }, [assignments]);
  const deleteMutation = useMutation({
    mutationFn: (id) => recordsApi.remove({ module: PROJECT_MODULE, type: STAFFING_TYPE, id }),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  return (
    <section className="space-y-4 text-[#06134a]">
      <PageTitle
        title={<span className="inline-flex items-center gap-2">Resource Assignments <CircleHelp className="h-5 w-5 text-slate-400" /></span>}
        subtitle={<><span className="font-black text-red-600">Dashboard</span><span className="mx-2 text-slate-400">›</span>Resource Assignments</>}
        actions={<><Link to="/project/staffing/new" className="flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white shadow-sm shadow-red-200"><Plus className="h-4 w-4" />Add Resource</Link><DateButton>01 Apr 2024 - 30 Apr 2024</DateButton><button className="flex h-10 items-center gap-2 rounded-lg border border-red-200 px-5 text-sm font-black text-red-600"><Filter className="h-4 w-4" />Customize</button></>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AssignmentCard icon={Building2} label="Total Customers" value={String(summary.customers)} meta="Active Customers" footer={['Total Resources', String(summary.resources), 'Total Billing', summary.billing]} />
        <AssignmentCard icon={UsersRound} label="Total Resources" value={String(summary.resources)} meta="Working Resources" footer={['Billable Resources', String(Math.max(0, summary.resources - 2)), 'Non-Billable', '2']} />
        <AssignmentCard icon={CircleDollarSign} label="Total Monthly Billing" value={summary.billing} meta="Grouped by currency" footer={['Avg. Billing / Resource', summary.averageBilling]} />
        <AssignmentCard icon={CalendarDays} label="Active Assignments" value={String(summary.active)} meta="Ongoing Assignments" footer={['Ending This Month', '2']} />
        <AssignmentCard icon={TimerReset} label="Notice Period" value={String(summary.notice)} meta="Within Notice Period" footer={['Ending This Month', '2']} />
      </div>

      <Panel className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 min-w-[260px] rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none focus:border-red-200" placeholder="Search customers or resources..." />
          <ProjectFilterSelect value={status} onChange={setStatus} label="All Status" options={staffingStatuses} />
          <ProjectFilterSelect value={sowStatus} onChange={setSowStatus} label="All SOW Status" options={[{value:'ACTIVE',label:'Active'},{value:'EXPIRING_SOON',label:'Expiring Soon'},{value:'EXPIRED',label:'Expired'}]} />
          <FilterSelect>All Technologies</FilterSelect>
          <DateButton>01 Apr 2024 - 30 Apr 2024</DateButton>
          <button onClick={() => { setSearch(''); setStatus(''); setSowStatus(''); }} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-black">Reset</button>
          <div className="ml-auto flex gap-3">
            <ActionButton icon={Download}>Export</ActionButton>
            <button className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200"><LayoutGrid className="h-4 w-4" /></button>
          </div>
        </div>
        {location.state?.message && <div className="m-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{location.state.message}</div>}
        {listQuery.isLoading && <div className="m-4 rounded-lg border border-slate-200 bg-white p-5 text-sm font-bold">Loading staffing assignments...</div>}
        {listQuery.isError && <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-700">Unable to load project assignments from backend API.</div>}
        {deleteMutation.isError && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">Delete failed. Please try again.</div>}
        <StaffingTable assignments={assignments} pageData={listQuery.data} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value)=>{setPageSize(value);setPage(0);}} onDelete={setDeleteTarget} onRenew={setRenewTarget} canEdit={canEditStaffing(user)} />
      </Panel>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete staffing assignment?"
        message={deleteTarget ? `${deleteTarget.customer} assignment will be permanently deleted.` : 'This assignment will be permanently deleted.'}
        loading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
      <RenewSowModal assignment={renewTarget} onClose={()=>setRenewTarget(null)} onRenewed={()=>{setRenewTarget(null);queryClient.invalidateQueries({queryKey:['records']});}} />
    </section>
  );
}

function FixedCostProjectsListPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const queryParams = { module: PROJECT_MODULE, type: FIXED_COST_TYPE, page, size: pageSize, search, status, sort: 'recordDate,desc' };
  const listQuery = useQuery({
    queryKey: ['records', queryParams],
    queryFn: () => recordsApi.list(queryParams),
  });
  const rows = useMemo(() => (listQuery.data?.content || []).map(fixedProjectFromRecord), [listQuery.data]);
  useEffect(() => { setPage(0); }, [search, status]);
  useEffect(() => { if (page > 0 && Number(listQuery.data?.totalPages || 0) <= page) setPage(Math.max(0, Number(listQuery.data?.totalPages || 1) - 1)); }, [listQuery.data?.totalPages, page]);
  const summary = useMemo(() => {
    const totalContract = rows.reduce((sum, row) => sum + row.contractAmount, 0);
    const totalBilled = rows.reduce((sum, row) => sum + row.billedAmount, 0);
    const remaining = rows.reduce((sum, row) => sum + Math.max(0, row.contractAmount - row.billedAmount), 0);
    return {
      totalContract,
      totalBilled,
      remaining,
      completed: rows.filter((row) => row.status === 'Completed').length,
      onHold: rows.filter((row) => row.status === 'On Hold').length,
    };
  }, [rows]);
  const deleteMutation = useMutation({
    mutationFn: (id) => recordsApi.remove({ module: PROJECT_MODULE, type: FIXED_COST_TYPE, id }),
    onSuccess: () => {
      setDeleteTarget(null);
      setOpenMenuId(null);
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  return (
    <section className="space-y-4 text-[#06134a]">
      <PageTitle
        title={<span className="inline-flex items-center gap-2">Fixed Cost Projects <CircleHelp className="h-5 w-5 text-slate-400" /></span>}
        subtitle={<><span className="font-black text-red-600">Dashboard</span><span className="mx-2 text-slate-400">›</span>Fixed Cost Projects</>}
        actions={<><Link to="/project/fixed-cost/new" className="flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white shadow-sm shadow-red-200"><Plus className="h-4 w-4" />Add Fixed Cost</Link><DateButton>01 Apr 2024 - 30 Apr 2024</DateButton><button className="flex h-10 items-center gap-2 rounded-lg border border-red-200 px-5 text-sm font-black text-red-600"><Filter className="h-4 w-4" />Customize</button></>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <FixedCostSummaryCard icon={UsersRound} label="Total Projects" value={String(rows.length)} meta="Active Projects" footer={['Completed', String(summary.completed), 'On Hold', String(summary.onHold)]} tone="red" />
        <FixedCostSummaryCard icon={ReceiptText} label="Total Contract Value" value={currencyTotals(rows,(row)=>row.contractAmount,(row)=>row.currency)} meta="Grouped by currency" footer={['Billed to Date', currencyTotals(rows,(row)=>row.billedAmount,(row)=>row.currency), 'Remaining', currencyTotals(rows,(row)=>Math.max(0,row.contractAmount-row.billedAmount),(row)=>row.currency)]} tone="violet" />
        <FixedCostSummaryCard icon={FileBox} label="Total Invoices" value={String(Math.max(rows.length * 2, rows.length))} meta="All Projects" footer={['Paid Invoices', String(summary.completed + 8), 'Unpaid Invoices', String(Math.max(0, rows.length - summary.completed))]} tone="cyan" />
        <FixedCostSummaryCard icon={Gauge} label="Avg. Margin" value="32.45%" meta="Across Projects" footer={['Highest Margin', '45.80%', 'Lowest Margin', '18.25%']} tone="orange" />
        <FixedCostSummaryCard icon={Milestone} label="Upcoming Milestones" value="5" meta="Next 30 Days" footer={['Overdue Milestones', '2']} tone="blue" />
      </div>

      <Panel className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 min-w-[260px] rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none focus:border-red-200" placeholder="Search fixed cost projects..." />
          <ProjectFilterSelect value={status} onChange={setStatus} label="All Status" options={projectStatuses} />
          {['All Customers', 'All Project Managers', 'All Technologies'].map((item) => <FilterSelect key={item}>{item}</FilterSelect>)}
          <DateButton>01 Apr 2024 - 30 Apr 2024</DateButton>
          <button onClick={() => { setSearch(''); setStatus(''); }} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-black">Reset</button>
          <div className="ml-auto flex gap-3">
            <ActionButton icon={Download}>Export</ActionButton>
            <button className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200"><LayoutGrid className="h-4 w-4" /></button>
          </div>
        </div>
        {location.state?.message && <div className="m-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{location.state.message}</div>}
        {listQuery.isLoading && <div className="m-4 rounded-lg border border-slate-200 bg-white p-5 text-sm font-bold">Loading fixed cost projects...</div>}
        {listQuery.isError && <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-700">Unable to load fixed cost projects from backend API.</div>}
        {deleteMutation.isError && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">Delete failed. Please try again.</div>}

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-red-50/50 text-slate-600">
              <tr>
                {[
                  ['Project & Customer', 'Project Details'],
                  ['Project Manager'],
                  ['Contract Value', 'Fixed Price'],
                  ['Billed to Date', '% Billed'],
                  ['Start Date', 'End Date'],
                  ['Status'],
                  ['Milestones', 'Completed / Total'],
                  ['Margin', '%'],
                  ['Actions'],
                ].map((column) => (
                  <th key={column[0]} className="px-4 py-4 align-bottom">
                    <p className="text-[11px] font-black uppercase tracking-wide">{column[0]}</p>
                    {column[1] && <p className="mt-1 text-[10px] font-bold text-slate-500">{column[1]}</p>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-4">
                      <ProjectLogo project={row} />
                      <div className="min-w-0">
                        <p className="font-black">{row.project}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{row.customer}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.manager} />
                      <span className="font-semibold">{row.manager}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-black">{row.contract}</td>
                  <td className="px-4 py-4">
                    <p className="font-black">{row.billed}</p>
                    <ProgressBar value={row.billedPercent} color={row.billedPercent === 100 ? 'bg-emerald-600' : 'bg-red-600'} />
                    <p className="mt-1 text-right text-xs font-bold text-slate-500">{row.billedPercent}%</p>
                  </td>
                  <td className="px-4 py-4 font-semibold leading-7"><p>{row.start}</p><p>{row.end}</p></td>
                  <td className="px-4 py-4"><Badge tone={row.status === 'Completed' ? 'green' : 'blue'}>{row.status}</Badge></td>
                  <td className="px-4 py-4">
                    <p className="font-black">{row.milestones}</p>
                    <ProgressBar value={row.milestonePercent} color={row.milestonePercent === 100 ? 'bg-emerald-600' : 'bg-red-600'} />
                  </td>
                  <td className="px-4 py-4 font-black text-emerald-600">{row.margin}</td>
                  <td className="relative px-4 py-4">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId((currentId) => (currentId === row.id ? null : row.id))}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                      aria-label={`Actions for ${row.project}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMenuId === row.id && (
                      <div className="absolute right-4 top-14 z-20 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm font-black shadow-xl">
                        <Link to={`/project/fixed-cost/${row.id}`} className="block px-4 py-2 hover:bg-slate-50" onClick={() => setOpenMenuId(null)}>View</Link>
                        <button type="button" className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(row)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ProjectPagination data={listQuery.data} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value)=>{setPageSize(value);setPage(0);}} />
      </Panel>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete fixed cost project?"
        message={deleteTarget ? `${deleteTarget.project} will be permanently deleted from the database.` : 'This project will be permanently deleted.'}
        loading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </section>
  );
}

function FixedCostProjectPage() {
  const { id } = useParams();
  const queryClient=useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');
  const [milestoneModal,setMilestoneModal]=useState(null);
  const [milestoneMessage,setMilestoneMessage]=useState('');
  const [teamModal,setTeamModal]=useState(null);
  const [teamMessage,setTeamMessage]=useState('');
  const projectQuery = useQuery({
    queryKey: ['records', PROJECT_MODULE, FIXED_COST_TYPE, id],
    queryFn: () => recordsApi.get({ module: PROJECT_MODULE, type: FIXED_COST_TYPE, id }),
    enabled: Boolean(id),
  });
  const resourcesQuery=useQuery({queryKey:['fixed-cost-project-options'],queryFn:fixedCostProjectsApi.options});
  const milestoneQuery=useQuery({queryKey:['project-milestones',id],queryFn:()=>projectMilestonesApi.list(id),enabled:Boolean(id)});
  const teamQuery=useQuery({queryKey:['fixed-cost-project-team',id],queryFn:()=>fixedCostProjectTeamApi.list(id),enabled:Boolean(id)});
  const profitabilityQuery=useQuery({queryKey:['fixed-cost-project-profitability',id],queryFn:()=>fixedCostProjectProfitabilityApi.calculate(id),enabled:Boolean(id)});
  const projectInvoicesQuery=useQuery({queryKey:['project-invoices',FIXED_COST_TYPE,id],queryFn:()=>projectInvoicesApi.list(FIXED_COST_TYPE,id),enabled:Boolean(id)});
  const refreshMilestones=()=>{queryClient.invalidateQueries({queryKey:['project-milestones',id]});queryClient.invalidateQueries({queryKey:['records',PROJECT_MODULE,FIXED_COST_TYPE,id]});};
  const deleteMilestone=useMutation({mutationFn:(milestoneId)=>projectMilestonesApi.remove(id,milestoneId),onSuccess:()=>{refreshMilestones();setMilestoneMessage('Milestone deleted successfully.');},onError:(error)=>setMilestoneMessage(error.response?.data?.message||'Unable to delete milestone.')});
  const baseProject = projectQuery.data ? fixedProjectFromRecord(projectQuery.data) : fixedProjectFromRecord({
    id,
    recordNumber: 'PRJ-000',
    partyName: 'Loading Project',
    partyCity: 'Customer',
    category: 'Software Development',
    status: 'Planned',
    secondaryStatus: 'Fixed Cost',
    amount: 0,
    balanceAmount: 0,
    recordDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    referenceNumber: 'Java',
    paymentMode: 'INR - Indian Rupee',
    ownerName: 'Project Manager',
    notes: '{}',
  });
  const project = {...baseProject,billedAmount:Number(projectInvoicesQuery.data?.totalBilled??baseProject.billedAmount),paidAmount:Number(projectInvoicesQuery.data?.totalPaid||0)};
  project.billedPercent=project.contractAmount?Math.round((project.billedAmount/project.contractAmount)*100):0;
  const tabs = [
    ['Overview', CircleAlert],
    ['Milestones', Milestone],
    ['Team', UsersRound],
    ['Invoices', ReceiptText],
    ['Expenses', CircleDollarSign],
    ['Documents', FileBox],
    ['Notes', Pencil],
  ];
  const projectNotes=parseJsonNotes(project.record?.notes);
  const milestoneRows=milestoneQuery.data?.milestones||[];
  const completedMilestones=milestoneRows.filter((item)=>item.status==='COMPLETED').length;
  const inProgressMilestones=milestoneRows.filter((item)=>item.status==='IN_PROGRESS').length;
  const pendingMilestones=milestoneRows.filter((item)=>['PLANNED','PENDING','ON_HOLD'].includes(item.status)).length;
  const overdueMilestones=milestoneRows.filter((item)=>item.status!=='COMPLETED'&&item.status!=='CANCELLED'&&item.dueDate<new Date().toISOString().slice(0,10)).length;
  const milestoneProgress=Math.round(milestoneRows.reduce((sum,item)=>sum+(Number(item.weightage)*Number(item.progress)/100),0));
  const teamRows=teamQuery.data||[];
  const activeTeamCount=teamRows.filter((item)=>item.status==='ACTIVE').length;
  const durationLabel=projectNotes.estimatedDuration==='CUSTOM'?`${projectNotes.customDurationValue} ${String(projectNotes.customDurationUnit||'MONTHS').toLowerCase()}`:durationOptions.find((x)=>x.value===projectNotes.estimatedDuration)?.label||`${project.durationMonths} Months`;

  return (
    <section className="space-y-4 text-[#06134a]">
      <PageTitle
        title="Project Details"
        subtitle={<><span className="font-black text-red-600">Dashboard</span><span className="mx-2 text-slate-400">›</span><span className="font-black text-red-600">Fixed Cost Projects</span><span className="mx-2 text-slate-400">›</span>Project Details</>}
        actions={<><Link to={`/project/fixed-cost/${id}/edit`} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black shadow-sm"><Pencil className="h-4 w-4" />Edit Project</Link><button onClick={()=>{setActiveTab('Milestones');setMilestoneModal({mode:'add'});}} className="flex h-10 items-center gap-2 rounded-lg border border-violet-200 px-4 text-sm font-black text-violet-600"><Plus className="h-4 w-4" />Add Milestone</button><ActionButton>More</ActionButton></>}
      />
      {projectQuery.isLoading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold">Loading project details...</div>}
      {projectQuery.isError && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">Unable to load this project. Please check backend API.</div>}

      <Panel className="p-5">
        <div className="grid gap-5 xl:grid-cols-[2fr_repeat(6,1fr)]">
          <div className="flex items-center gap-4">
            <ProjectLogo project={project} />
            <div>
              <h2 className="text-2xl font-black">{project.project}</h2>
              <p className="mt-1 text-sm font-black">{project.customer}</p>
              <div className="mt-2 flex gap-2"><Badge tone={project.status === 'Completed' ? 'green' : 'blue'}>{project.status}</Badge><Badge tone="red">{project.priority}</Badge></div>
            </div>
          </div>
          {[
            ['Contract Value', money(project.contractAmount,project.currency)],
            ['Project Duration', durationLabel, `${project.start} - ${project.end}`],
            ['Total Billed', money(project.billedAmount,project.currency), `${project.billedPercent}%`],
            ['Remaining Amount', money(Math.max(0, project.contractAmount - project.billedAmount),project.currency)],
            ['Start Date', project.start],
            ['End Date', project.end],
          ].map(([label, value, meta]) => <StatBlock key={label} label={label} value={value} meta={meta} />)}
        </div>
      </Panel>

      <div className="flex flex-wrap gap-6 border-b border-slate-200">
        {tabs.map(([tab, Icon]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`inline-flex h-11 items-center gap-2 border-b-2 text-sm font-black ${activeTab === tab ? 'border-red-600 text-red-600' : 'border-transparent text-slate-600 hover:text-[#06134a]'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab}{tab==='Milestones'&&` (${milestoneQuery.data?.milestones?.length||0})`}{tab==='Team'&&` (${activeTeamCount})`}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
            <Panel title="Project Information">
              <InfoGrid project={project} />
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-black text-slate-500">Technologies</p>
                <div className="flex flex-wrap gap-2">{project.technologies.map((item) => <Tag key={item}>{item}</Tag>)}</div>
              </div>
            </Panel>
            <Panel title="Duration & Cost Breakdown">
              <div className="grid gap-4 md:grid-cols-[0.8fr_1fr]">
                <div className="space-y-4">
                  <InfoLine label={durationLabel} value={`${project.start} - ${project.end}`} />
                  <InfoLine label="Contract Value" value={money(project.contractAmount,project.currency)} />
                  <InfoLine label="Average Monthly Planned Value" value={money(project.contractAmount / Math.max(1,profitabilityQuery.data?.months?.length||project.durationMonths),project.currency)} sub="Actual monthly allocation is prorated by active project days" />
                </div>
                <SimpleTable rows={monthlyRows(project,profitabilityQuery.data)} />
              </div>
            </Panel>
            <Panel title="Project Progress">
              <div className="grid gap-5 md:grid-cols-[150px_1fr]">
                <Donut center={`${milestoneProgress}%`} sub="Overall Progress" segments={`conic-gradient(#7c3aed 0 ${milestoneProgress}%, #e8edf5 ${milestoneProgress}% 100%)`} />
                <Legend items={[
                  ['Milestones Completed', String(completedMilestones), 'bg-emerald-600'],
                  ['Milestones In Progress', String(inProgressMilestones), 'bg-blue-600'],
                  ['Milestones Pending', String(pendingMilestones), 'bg-slate-300'],
                  ['Milestones Overdue', String(overdueMilestones), 'bg-red-500'],
                ]} />
              </div>
              <ProgressBar value={milestoneProgress} color="bg-violet-600" />
              <p className="mt-2 text-center text-xs font-bold text-slate-500">{completedMilestones} / {milestoneRows.length} Milestones Completed</p>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <Panel title="Monthly Cost & Profit (Based on Duration)">
              <CostProfitTable project={project} data={profitabilityQuery.data} loading={profitabilityQuery.isLoading} error={profitabilityQuery.error} />
            </Panel>
            <Panel title="Project Financials">
              <FinanceRows project={project} />
              <button className="mt-5 h-11 w-full rounded-lg border border-red-200 text-sm font-black text-red-600">View Financial Summary →</button>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,0.7fr)]">
            <ProjectDescription description={project.description} />
            <Panel title="Quick Actions">
              <div className="grid grid-cols-2 gap-3">
                {['Add Milestone', 'Create Invoice', 'Upload Document', 'Add Note'].map((item) => <button key={item} onClick={()=>{if(item==='Add Milestone'){setActiveTab('Milestones');setMilestoneModal({mode:'add'});}if(item==='Upload Document')setActiveTab('Documents');}} className="grid h-20 place-items-center rounded-lg border border-slate-200 text-xs font-black hover:bg-slate-50">{item}</button>)}
              </div>
            </Panel>
          </div>
        </>
      )}

      {activeTab === 'Milestones' && (
        <MilestoneTable projectId={id} data={milestoneQuery.data} loading={milestoneQuery.isLoading} error={milestoneQuery.isError} message={milestoneMessage} onAdd={()=>setMilestoneModal({mode:'add'})} onView={(item)=>setMilestoneModal({mode:'view',item})} onEdit={(item)=>setMilestoneModal({mode:'edit',item})} onDelete={(item)=>{if(window.confirm(`Are you sure you want to delete ${item.name}?`))deleteMilestone.mutate(item.id);}} />
      )}

      {activeTab === 'Team' && (
        <ProjectTeamTable rows={teamRows} loading={teamQuery.isLoading} error={teamQuery.isError} message={teamMessage} onAdd={()=>setTeamModal({mode:'add'})} onView={(item)=>setTeamModal({mode:'view',item})} onRemove={(item)=>setTeamModal({mode:'remove',item})}/>
      )}

      {activeTab === 'Documents' && <ProjectDocumentsPanel projectType={FIXED_COST_TYPE} projectId={id} />}

      {activeTab === 'Invoices' && <ProjectInvoicesPanel projectType={FIXED_COST_TYPE} projectId={id} data={projectInvoicesQuery.data} loading={projectInvoicesQuery.isLoading} error={projectInvoicesQuery.isError} currency={project.currency} />}

      {['Expenses', 'Notes'].includes(activeTab) && (
        <Panel title={activeTab}>
          <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center">
            <div>
              <p className="text-base font-black">{activeTab} will appear here</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">Use this tab to manage project {activeTab.toLowerCase()}.</p>
            </div>
          </div>
        </Panel>
      )}
      {milestoneModal&&<MilestoneModal project={project} summary={milestoneQuery.data} modal={milestoneModal} onClose={()=>setMilestoneModal(null)} onSaved={(message)=>{setMilestoneModal(null);setMilestoneMessage(message);refreshMilestones();}}/>}
      {teamModal&&<ProjectTeamModal project={project} modal={teamModal} employees={resourcesQuery.data?.employees||[]} assignments={teamRows} onClose={()=>setTeamModal(null)} onSaved={(message)=>{setTeamModal(null);setTeamMessage(message);queryClient.invalidateQueries({queryKey:['fixed-cost-project-team',id]});queryClient.invalidateQueries({queryKey:['fixed-cost-project-profitability',id]});queryClient.invalidateQueries({queryKey:['records',PROJECT_MODULE,FIXED_COST_TYPE,id]});}}/>}
    </section>
  );
}

function ProjectTeamTable({rows,loading,error,message,onAdd,onView,onRemove}){
 const [filter,setFilter]=useState('ALL');const shown=filter==='ALL'?rows:rows.filter((x)=>x.status===filter);
  const activeSalaries=[...new Map(rows.filter((x)=>x.status==='ACTIVE').map((x)=>[x.employeeId,x])).values()];
  const activeSalaryTotals=currencyTotals(activeSalaries,(item)=>item.monthlySalary,(item)=>item.salaryCurrency||'INR');
 return <Panel title="Project Team & Assignment History" action={<div className="flex gap-2"><select value={filter} onChange={(e)=>setFilter(e.target.value)} className="h-9 rounded-lg border px-3 text-xs font-bold"><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><button onClick={onAdd} className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-black text-white"><Plus className="h-4 w-4"/>Add Team Member</button></div>}>
  {message&&<p className={`mb-4 rounded-lg p-3 text-sm font-bold ${message.includes('success')?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{message}</p>}
  {loading&&<p className="py-10 text-center font-bold text-slate-500">Loading Project Team...</p>}{error&&<p className="py-10 text-center font-bold text-red-600">Unable to load Project Team.</p>}
  {!loading&&!error&&!shown.length&&<div className="grid min-h-44 place-items-center rounded-xl border border-dashed bg-slate-50 text-center"><div><p className="font-black">No team members have been assigned to this project yet.</p><button onClick={onAdd} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white">+ Add Team Member</button></div></div>}
  {!!shown.length&&<><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Resource','Role / Designation','Monthly Salary','Added Date','Removed Date','Status','Actions'].map((x)=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{shown.map((item)=><tr key={item.id}><td className="px-4 py-4"><button onClick={()=>onView(item)} className="font-black text-blue-700">{item.employeeName}</button></td><td className="px-4 py-4">{item.designation||'-'}</td><td className="whitespace-nowrap px-4 py-4 font-bold">{money(item.monthlySalary,item.salaryCurrency||'INR')}</td><td className="px-4 py-4">{formatDate(item.addedDate)}</td><td className="px-4 py-4">{item.removedDate?formatDate(item.removedDate):'-'}</td><td className="px-4 py-4"><Badge tone={item.status==='ACTIVE'?'green':'red'}>{item.status==='ACTIVE'?'Active':'Inactive'}</Badge></td><td className="px-4 py-4"><div className="flex gap-3"><button onClick={()=>onView(item)} className="font-bold text-blue-600">View</button>{item.status==='ACTIVE'&&<button onClick={()=>onRemove(item)} className="font-bold text-red-600">Remove from Project</button>}</div></td></tr>)}</tbody></table></div><div className="mt-4 flex justify-end border-t pt-4"><div className="rounded-lg bg-slate-50 px-5 py-3 text-right"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total Active Employee Monthly Salary</p><p className="mt-1 text-lg font-black text-[#07164d]">{activeSalaryTotals}</p></div></div></>}
 </Panel>;
}

function ProjectTeamModal({project,modal,employees,assignments,onClose,onSaved}){
 const item=modal.item||{};const today=new Date().toISOString().slice(0,10);const [form,setForm]=useState({employeeId:'',addedDate:today,notes:'',removedDate:today,removalNote:''});const [error,setError]=useState('');
 const activeIds=new Set(assignments.filter((x)=>x.status==='ACTIVE').map((x)=>String(x.employeeId)));const available=employees.filter((x)=>!activeIds.has(String(x.id)));const selected=employees.find((x)=>String(x.id)===form.employeeId);
 const mutation=useMutation({mutationFn:()=>modal.mode==='remove'?fixedCostProjectTeamApi.remove(project.id,item.id,{removedDate:form.removedDate,removalNote:form.removalNote}):fixedCostProjectTeamApi.add(project.id,{employeeId:Number(form.employeeId),addedDate:form.addedDate,notes:form.notes}),onSuccess:()=>onSaved(`Team member ${modal.mode==='remove'?'removed from project':'added'} successfully.`),onError:(e)=>setError(e.response?.data?.message||'Unable to update Project Team.')});
 if(modal.mode==='view')return <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 p-4"><div className="w-full max-w-2xl rounded-xl bg-white"><div className="flex justify-between border-b p-5"><h2 className="text-xl font-black">Team Member Details</h2><button onClick={onClose}><X/></button></div><div className="grid gap-4 p-6 md:grid-cols-2">{[['Employee',item.employeeName],['Designation',item.designation||'-'],['Department',item.department||'-'],['Monthly Salary',money(item.monthlySalary,item.salaryCurrency||'INR')],['Salary Currency',item.salaryCurrency||'INR'],['Project',project.project],['Added Date',formatDate(item.addedDate)],['Added By',item.addedByName||'-'],['Removed Date',item.removedDate?formatDate(item.removedDate):'-'],['Removed By',item.removedByName||'-'],['Status',item.status==='ACTIVE'?'Active':'Inactive'],['Notes',item.notes||'-'],['Removal Reason',item.removalNote||'-']].map(([label,value])=><InfoLine key={label} label={label} value={value}/>)}</div><div className="flex justify-end border-t p-4"><button onClick={onClose} className="h-10 rounded-lg border px-5 font-black">Close</button></div></div></div>;
 return <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 p-4"><form onSubmit={(e)=>{e.preventDefault();if(modal.mode==='add'&&!form.employeeId)return setError('Employee is required.');mutation.mutate();}} className="w-full max-w-2xl rounded-xl bg-white"><div className="flex justify-between border-b p-5"><div><h2 className="text-xl font-black">{modal.mode==='remove'?'Remove Team Member':'Add Team Member'}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{modal.mode==='remove'?`You are removing ${item.employeeName} from ${project.project}.`:project.project}</p></div><button type="button" onClick={onClose}><X/></button></div><div className="space-y-5 p-6">{error&&<p className="rounded bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}{modal.mode==='add'?<><ProjectSelect label="Employee" value={form.employeeId} onChange={(value)=>setForm({...form,employeeId:value})} options={available.map((x)=>({value:String(x.id),label:x.designation?`${x.name} — ${x.designation}`:x.name}))} placeholder="Select Employee" required/><ProjectInput label="Role / Designation" value={selected?.designation||''} onChange={()=>{}} disabled/><ProjectDateInput label="Added Date" value={form.addedDate} onChange={(value)=>setForm({...form,addedDate:value})} required/><ProjectTextarea label="Notes" value={form.notes} onChange={(value)=>setForm({...form,notes:value})}/></>:<><ProjectDateInput label="Removal Date" value={form.removedDate} onChange={(value)=>setForm({...form,removedDate:value})} required/><ProjectTextarea label="Reason / Note" value={form.removalNote} onChange={(value)=>setForm({...form,removalNote:value})}/></>}</div><div className="flex justify-end gap-3 border-t p-4"><button type="button" onClick={onClose} className="h-10 rounded-lg border px-5 font-black">Cancel</button><button disabled={mutation.isPending} className="h-10 rounded-lg bg-red-600 px-5 font-black text-white">{mutation.isPending?'Saving...':modal.mode==='remove'?'Remove from Project':'Add Team Member'}</button></div></form></div>;
}

const milestoneStatuses=['PLANNED','PENDING','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED'];
const milestoneStatusLabel=(value)=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());

function MilestoneTable({projectId,data,loading,error,message,onAdd,onView,onEdit,onDelete}){
 const [menu,setMenu]=useState(null);const rows=data?.milestones||[],currency=data?.currencyCode||'INR';
 return <Panel title={`Milestones (${rows.length})`} action={<button onClick={onAdd} className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-black text-white"><Plus className="h-4 w-4"/>Add Milestone</button>}>
  {message&&<p className={`mb-4 rounded-lg p-3 text-sm font-bold ${message.toLowerCase().includes('success')?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{message}</p>}
  {loading&&<p className="py-10 text-center font-bold text-slate-500">Loading milestones...</p>}{error&&<p className="py-10 text-center font-bold text-red-600">Unable to load milestones.</p>}
  {!loading&&!error&&!rows.length&&<div className="grid min-h-52 place-items-center rounded-xl border border-dashed bg-slate-50 text-center"><div><p className="font-black">No milestones have been added for this project yet.</p><button onClick={onAdd} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white">+ Add Milestone</button></div></div>}
  {!!rows.length&&<div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['#','Milestone Name','Due Date',`Amount (${currency})`,'Weightage','Status','Progress','Invoice','Actions'].map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{rows.map((item,index)=><tr key={item.id}><td className="px-3 py-3">{index+1}</td><td className="px-3 py-3 font-black">{item.name}</td><td className="px-3 py-3">{formatDate(item.dueDate)}</td><td className="px-3 py-3 font-black">{money(item.amount,currency)}</td><td className="px-3 py-3">{Number(item.weightage)}%</td><td className="px-3 py-3"><Badge tone={item.status==='COMPLETED'?'green':item.status==='CANCELLED'?'red':'blue'}>{milestoneStatusLabel(item.status)}</Badge></td><td className="min-w-32 px-3 py-3"><ProgressCell value={`${Number(item.progress)}%`}/></td><td className="px-3 py-3">{item.invoiceId?<Link className="font-black text-blue-600" to={`/sales/invoices/${item.invoiceId}`}>{item.invoiceNumber}</Link>:'Not Invoiced'}</td><td className="relative px-3 py-3"><button onClick={()=>setMenu(menu===item.id?null:item.id)} className="grid h-8 w-8 place-items-center rounded border"><MoreVertical className="h-4 w-4"/></button>{menu===item.id&&<div className="absolute right-10 top-2 z-20 w-40 rounded-lg border bg-white py-1 shadow-xl"><button onClick={()=>{setMenu(null);onView(item);}} className="flex w-full gap-2 px-3 py-2 text-left font-bold hover:bg-slate-50"><Eye className="h-4 w-4"/>View</button><button onClick={()=>{setMenu(null);onEdit(item);}} className="flex w-full gap-2 px-3 py-2 text-left font-bold hover:bg-slate-50"><Pencil className="h-4 w-4"/>Edit / Status</button><button disabled={Boolean(item.invoiceId)} onClick={()=>{setMenu(null);onDelete(item);}} className="flex w-full gap-2 px-3 py-2 text-left font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 className="h-4 w-4"/>Delete</button></div>}</td></tr>)}</tbody></table></div>}
  {!!rows.length&&<div className="mt-4 flex flex-wrap justify-end gap-8 border-t pt-4 text-sm font-black"><span>Total {money(data.allocatedAmount,currency)}</span><span>Total Weightage: {Number(data.allocatedWeightage)}%</span><span className={Number(data.availableWeightage)===0?'text-emerald-600':'text-amber-600'}>Available: {Number(data.availableWeightage)}%</span></div>}
 </Panel>;
}

function MilestoneModal({project,summary,modal,onClose,onSaved}){
 const item=modal.item||{};const readOnly=modal.mode==='view';const currency=summary?.currencyCode||project.currency||'INR';
 const [form,setForm]=useState({name:item.name||'',description:item.description||'',startDate:toDateInput(item.startDate),dueDate:toDateInput(item.dueDate),amount:String(item.amount??''),weightage:String(item.weightage??''),status:item.status||'PLANNED',progress:String(item.progress??0),notes:item.notes||''});const [error,setError]=useState('');
 const availableWeight=Number(summary?.availableWeightage||100)+(modal.mode==='edit'?Number(item.weightage||0):0),remainingAmount=Number(summary?.remainingAmount??project.contractAmount)+(modal.mode==='edit'?Number(item.amount||0):0);
 const save=useMutation({mutationFn:()=>{const payload={...form,amount:Number(form.amount),weightage:Number(form.weightage),progress:form.status==='COMPLETED'?100:Number(form.progress)};return modal.mode==='edit'?projectMilestonesApi.update(project.id,item.id,payload):projectMilestonesApi.create(project.id,payload);},onSuccess:()=>onSaved(`Milestone ${modal.mode==='edit'?'updated':'created'} successfully.`),onError:(e)=>setError(e.response?.data?.message||'Unable to save milestone.')});
 const submit=(e)=>{e.preventDefault();if(!form.name.trim())return setError('Milestone Name is required.');if(!form.dueDate)return setError('Due Date is required.');if(Number(form.weightage)<=0||Number(form.weightage)>availableWeight)return setError(`Total milestone weightage cannot exceed 100%. Remaining weightage: ${availableWeight}%.`);if(Number(form.amount)<0||Number(form.amount)>remainingAmount)return setError(`Milestone amount cannot exceed the remaining contract amount ${money(remainingAmount,currency)}.`);save.mutate();};
 if(readOnly)return <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 p-4"><div className="w-full max-w-3xl rounded-xl bg-white"><div className="flex justify-between border-b p-5"><h2 className="text-xl font-black">Milestone Details</h2><button onClick={onClose}><X/></button></div><div className="grid gap-4 p-6 md:grid-cols-2">{[['Milestone Name',item.name],['Project',project.project],['Description',item.description||'-'],['Start Date',item.startDate?formatDate(item.startDate):'-'],['Due Date',formatDate(item.dueDate)],['Amount',money(item.amount,currency)],['Weightage',`${Number(item.weightage)}%`],['Status',milestoneStatusLabel(item.status)],['Progress',`${Number(item.progress)}%`],['Invoice',item.invoiceNumber||'Not Invoiced'],['Notes',item.notes||'-'],['Created',item.createdAt?new Date(item.createdAt).toLocaleString():'-'],['Updated',item.updatedAt?new Date(item.updatedAt).toLocaleString():'-']].map(([label,value])=><InfoLine key={label} label={label} value={value}/>)}</div><div className="flex justify-end border-t p-4"><button onClick={onClose} className="h-10 rounded-lg border px-5 font-black">Close</button></div></div></div>;
 return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#06134a]/60 p-4"><form onSubmit={submit} className="my-6 w-full max-w-4xl rounded-xl bg-white"><div className="flex justify-between border-b p-5"><div><h2 className="text-xl font-black">{modal.mode==='edit'?'Edit':'Add'} Milestone</h2><p className="mt-1 text-sm font-semibold text-slate-500">{project.project} • {currency}</p></div><button type="button" onClick={onClose}><X/></button></div><div className="p-6"><div className="mb-5 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-4"><InfoLine label="Allocated Weightage" value={`${100-availableWeight}%`}/><InfoLine label="Available Weightage" value={`${availableWeight}%`}/><InfoLine label="Allocated Amount" value={money(Number(project.contractAmount)-remainingAmount,currency)}/><InfoLine label="Remaining Amount" value={money(remainingAmount,currency)}/></div>{error&&<p className="mb-4 rounded bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<div className="grid gap-5 md:grid-cols-2"><ProjectInput label="Milestone Name" value={form.name} onChange={(value)=>setForm({...form,name:value})} required/><ProjectInput label={`Amount (${currency})`} type="number" value={form.amount} onChange={(value)=>setForm({...form,amount:value})} required/><ProjectDateInput label="Start Date" value={form.startDate} onChange={(value)=>setForm({...form,startDate:value})}/><ProjectDateInput label="Due Date" value={form.dueDate} onChange={(value)=>setForm({...form,dueDate:value})} required/><ProjectInput label="Weightage (%)" type="number" value={form.weightage} onChange={(value)=>setForm({...form,weightage:value})} required/><ProjectSelect label="Status" value={form.status} onChange={(value)=>setForm({...form,status:value,progress:value==='COMPLETED'?'100':form.progress})} options={milestoneStatuses.map(value=>({value,label:milestoneStatusLabel(value)}))} required/><ProjectInput label="Progress (%)" type="number" value={form.progress} onChange={(value)=>setForm({...form,progress:value})}/><div/><ProjectTextarea label="Description" value={form.description} onChange={(value)=>setForm({...form,description:value})}/><ProjectTextarea label="Notes" value={form.notes} onChange={(value)=>setForm({...form,notes:value})}/></div></div><div className="flex justify-end gap-3 border-t p-4"><button type="button" onClick={onClose} className="h-10 rounded-lg border px-5 font-black">Cancel</button><button disabled={save.isPending} className="h-10 rounded-lg bg-red-600 px-5 font-black text-white">{save.isPending?'Saving...':'Save Milestone'}</button></div></form></div>;
}

function AddFixedCostProjectPage({ mode = 'create' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit';
  const recordQuery = useQuery({
    queryKey: ['records', PROJECT_MODULE, FIXED_COST_TYPE, id],
    queryFn: () => recordsApi.get({ module: PROJECT_MODULE, type: FIXED_COST_TYPE, id }),
    enabled: isEdit && Boolean(id),
  });
  const customersQuery = useQuery({
    queryKey: ['records', 'sales', 'customers', 'active', 'project-dropdown'],
    queryFn: () => recordsApi.list({ module: 'sales', type: 'customers', page: 0, size: 500, status: 'Active', sort: 'partyName,asc' }),
  });
  const resourcesQuery = useQuery({
    queryKey: ['fixed-cost-project-options'],
    queryFn: fixedCostProjectsApi.options,
  });
  const currenciesQuery = useQuery({queryKey:['currency-master'],queryFn:currencyApi.list});
  const domainsQuery = useQuery({queryKey:['domain-industry-master','active'],queryFn:()=>domainIndustriesApi.list(false)});
  const [form, setForm] = useState(() => fixedProjectFormFromRecord());
  const [documentFiles, setDocumentFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const customerOptions = useMemo(() => optionWithCurrent(
    uniqueOptions((customersQuery.data?.content || []).map((customer) => customer.partyName)),
    form.customer,
  ), [customersQuery.data, form.customer]);
  const employees = useMemo(()=>(resourcesQuery.data?.employees||[]).map((resource)=>({...resource,partyName:resource.name,category:resource.designation,status:'Active'})),[resourcesQuery.data]);
  const projectManagerOptions = useMemo(() => employees.map((resource)=>({value:String(resource.id),label:resource.category?`${resource.partyName} — ${resource.category}`:resource.partyName})), [employees]);
  const currencyOptions = useMemo(()=>(currenciesQuery.data||[]).map((currency)=>({value:currency.code,label:`${currency.code} – ${currency.name}`})),[currenciesQuery.data]);
  const domainOptions = useMemo(()=>(domainsQuery.data||[]).map((domain)=>({value:String(domain.id),label:domain.name})),[domainsQuery.data]);

  useEffect(() => {
    if (recordQuery.data) setForm(fixedProjectFormFromRecord(recordQuery.data));
  }, [recordQuery.data]);
  useEffect(()=>{if(!form.projectManagerId&&form.projectManager&&employees.length){const found=employees.find((x)=>x.partyName===form.projectManager);if(found)update('projectManagerId',String(found.id));}},[employees,form.projectManager,form.projectManagerId]);
  useEffect(()=>{if(!form.domainIndustryId&&form.domain&&domainsQuery.data?.length){const found=domainsQuery.data.find((x)=>x.name===form.domain);if(found)update('domainIndustryId',String(found.id));}},[domainsQuery.data,form.domain,form.domainIndustryId]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const saved = isEdit
        ? await recordsApi.update({ module: PROJECT_MODULE, type: FIXED_COST_TYPE, id, payload })
        : await recordsApi.create({ module: PROJECT_MODULE, type: FIXED_COST_TYPE, payload });
      const projectId = saved.id || id;
      const results = await Promise.allSettled(documentFiles.map((file) => projectDocumentsApi.upload(FIXED_COST_TYPE, projectId, file)));
      return { saved, failed: results.filter((result) => result.status === 'rejected').length };
    },
    onSuccess: ({ saved, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      navigate(`/project/fixed-cost/${saved.id || id}`, {
        replace: true,
        state: { message: failed ? `Project saved, but ${failed} document${failed === 1 ? '' : 's'} could not be uploaded. You can retry from Documents.` : `Fixed cost project ${isEdit ? 'updated' : 'created'} successfully.` },
      });
    },
  });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.projectName.trim()) nextErrors.projectName = 'Project name is required';
    if (!form.projectCode.trim()) nextErrors.projectCode = 'Project code is required';
    if (!form.customer.trim()) nextErrors.customer = 'Customer is required';
    if (!form.projectManagerId) nextErrors.projectManager = 'Project manager is required';
    if (!numberValue(form.contractValue)) nextErrors.contractValue = 'Contract value is required';
    if (!form.startDate) nextErrors.startDate = 'Start date is required';
    if (!form.estimatedDuration) nextErrors.estimatedDuration = 'Estimated duration is required';
    if (form.estimatedDuration === 'CUSTOM' && (!Number(form.customDurationValue) || Number(form.customDurationValue) < 1)) nextErrors.customDurationValue = 'Custom duration must be greater than zero';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    saveMutation.mutate(fixedProjectPayload(form));
  };

  return (
    <form id="fixed-cost-project-form" onSubmit={submit} className="space-y-4 text-[#06134a]">
      <PageTitle
        title={isEdit ? 'Edit Project' : 'Add Project'}
        subtitle={<><span className="font-black text-red-600">Dashboard</span><span className="mx-2 text-slate-400">›</span><span className="font-black text-red-600">Fixed Cost Projects</span><span className="mx-2 text-slate-400">›</span>{isEdit ? 'Edit Project' : 'Add Project'}</>}
        actions={<><Link to={isEdit ? `/project/fixed-cost/${id}` : '/project/fixed-cost'} className="grid h-10 place-items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black">Cancel</Link><button disabled={saveMutation.isPending} type="submit" className="flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white shadow-sm shadow-red-200 disabled:opacity-60"><Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving...' : 'Save Project'}</button></>}
      />
      {recordQuery.isLoading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold">Loading project...</div>}
      {saveMutation.isError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">Unable to save project. Please check required data and backend API.</div>}

      <ProjectFormCard icon={BriefcaseBusiness} title="Project Information">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ProjectInput label="Project Name" value={form.projectName} onChange={(value) => update('projectName', value)} error={errors.projectName} placeholder="Enter Project Name" required />
          <ProjectInput label="Project Code" value={form.projectCode} onChange={(value) => update('projectCode', value)} error={errors.projectCode} placeholder="Enter Project Code" hint="Unique code for internal reference" required />
          <ProjectSelect label="Project Type" value={form.projectType} onChange={(value) => update('projectType', value)} options={['Software Development', 'Implementation', 'Migration', 'Support']} placeholder="Select Project Type" required />
          <ProjectSelect label="Billing Type" value={form.billingType} onChange={(value) => update('billingType', value)} options={['Fixed Cost']} placeholder="Fixed Cost" required />
          <ProjectSelect label="Customer" value={form.customer} onChange={(value) => update('customer', value)} error={errors.customer} options={customerOptions} placeholder={customersQuery.isLoading ? 'Loading customers...' : 'Select Customer'} required />
          <ProjectSelect label="Project Manager" value={form.projectManagerId} onChange={(value) => {const employee=employees.find((x)=>String(x.id)===value);setForm((current)=>({...current,projectManagerId:value,projectManager:employee?.partyName||''}));}} error={errors.projectManager} options={projectManagerOptions} placeholder={resourcesQuery.isLoading ? 'Loading resources...' : 'Select Project Manager'} required />
          <ProjectInput label={`Contract Value (${form.currencyCode||'Currency'})`} value={form.contractValue} onChange={(value) => update('contractValue', value)} error={errors.contractValue} placeholder="Enter Contract Value" required />
          <ProjectSelect label="Currency" value={form.currencyCode} onChange={(value) => update('currencyCode', value)} options={currencyOptions} placeholder={currenciesQuery.isLoading?'Loading currencies...':'Select Currency'} required />
          <ProjectDateInput label="Start Date" value={form.startDate} onChange={(value) => update('startDate', value)} error={errors.startDate} placeholder="Select Start Date" required />
          <ProjectDateInput label="End Date" value={form.endDate} onChange={(value) => update('endDate', value)} placeholder="Select End Date" />
          <ProjectSelect label="Estimated Duration" value={form.estimatedDuration} onChange={(value) => update('estimatedDuration', value)} options={durationOptions} error={errors.estimatedDuration} placeholder="Select Duration" required />
          {form.estimatedDuration==='CUSTOM'&&<div className="grid grid-cols-2 gap-2"><ProjectInput label="Custom Duration" type="number" value={form.customDurationValue} onChange={(value)=>update('customDurationValue',value)} error={errors.customDurationValue} required/><ProjectSelect label="Unit" value={form.customDurationUnit} onChange={(value)=>update('customDurationUnit',value)} options={[{value:'DAYS',label:'Days'},{value:'WEEKS',label:'Weeks'},{value:'MONTHS',label:'Months'},{value:'YEARS',label:'Years'}]} required/></div>}
          <ProjectSelect label="Status" value={form.status} onChange={(value) => update('status', value)} options={projectStatuses} placeholder="Planned" />
        </div>
      </ProjectFormCard>

      <ProjectFormCard icon={ReceiptText} title="Project Description">
        <div className="grid gap-5 xl:grid-cols-2">
          <ProjectTextarea label="Description" value={form.description} onChange={(value) => update('description', value)} placeholder="Enter project description, scope and objectives..." />
          <ProjectTextarea label="Internal Notes" value={form.internalNotes} onChange={(value) => update('internalNotes', value)} placeholder="Enter internal notes (optional)..." />
        </div>
      </ProjectFormCard>

      <ProjectFormCard icon={FileBox} title="Project Settings">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ProjectInput label="Technologies" value={form.technologies} onChange={(value) => update('technologies', value)} placeholder="Java, Spring Boot, ReactJS" hint="Add multiple technologies separated by comma" />
          <ProjectSelect label="Domain / Industry" value={form.domainIndustryId} onChange={(value) => {const domain=domainsQuery.data?.find((x)=>String(x.id)===value);setForm((current)=>({...current,domainIndustryId:value,domain:domain?.name||''}));}} options={domainOptions} placeholder={domainsQuery.isLoading?'Loading domains...':'Select Domain / Industry'} />
          <ProjectSelect label="Priority" value={form.priority} onChange={(value) => update('priority', value)} options={['Low Priority', 'Medium Priority', 'High Priority']} placeholder="Select Priority" />
          <ProjectInput label="Tags" value={form.tags} onChange={(value) => update('tags', value)} placeholder="Enter tags and press enter" hint="Add relevant tags" />
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ProjectToggle label="Enable Milestones" checked={form.enableMilestones} onChange={(value) => update('enableMilestones', value)} description="Break project into milestone & track progress" />
          <ProjectToggle label="Enable Time Tracking" checked={form.enableTimeTracking} onChange={(value) => update('enableTimeTracking', value)} description="Track time spent on this project" />
          <ProjectToggle label="Enable Expenses" checked={form.enableExpenses} onChange={(value) => update('enableExpenses', value)} description="Track expenses related to this project" />
          <ProjectToggle label="Is Active" checked={form.isActive} onChange={(value) => update('isActive', value)} description="Project will be active after creation" />
        </div>
      </ProjectFormCard>

      <ProjectFormCard icon={UsersRound} title="Initial Team Assignment (Optional)">
        <TeamMemberSelect employees={employees} value={form.teamMemberIds} onChange={(value)=>update('teamMemberIds',value)} loading={resourcesQuery.isLoading}/>
      </ProjectFormCard>

      <ProjectFormCard icon={FileBox} title="Project Documents">
        <ProjectDocumentPicker files={documentFiles} onChange={setDocumentFiles} projectType={FIXED_COST_TYPE} projectId={isEdit ? id : null} />
      </ProjectFormCard>
    </form>
  );
}

function AddResourceAssignmentPage({ mode = 'create' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit';
  const recordQuery = useQuery({
    queryKey: ['records', PROJECT_MODULE, STAFFING_TYPE, id],
    queryFn: () => recordsApi.get({ module: PROJECT_MODULE, type: STAFFING_TYPE, id }),
    enabled: isEdit && Boolean(id),
  });
  const currentSowQuery = useQuery({
    queryKey: ['staffing-sows', id, 'current'],
    queryFn: () => staffingSowsApi.current(id),
    enabled: isEdit && Boolean(id),
  });
  const customersQuery = useQuery({
    queryKey: ['records', 'sales', 'customers', 'active', 'staffing-dropdown'],
    queryFn: () => recordsApi.list({ module: 'sales', type: 'customers', page: 0, size: 500, status: 'Active', sort: 'partyName,asc' }),
  });
  const resourcesQuery = useQuery({
    queryKey: ['records', 'resources', 'resources', 'active', 'staffing-resource-dropdown'],
    queryFn: () => recordsApi.list({ module: 'resources', type: 'resources', page: 0, size: 500, status: 'Active', sort: 'partyName,asc' }),
  });
  const currenciesQuery = useQuery({queryKey:['currency-master'],queryFn:currencyApi.list});
  const [form, setForm] = useState(() => staffingFormFromRecord());
  const [documentFiles, setDocumentFiles] = useState([]);
  const [sowDocument, setSowDocument] = useState(null);
  const [errors, setErrors] = useState({});
  const customerOptions = useMemo(() => optionWithCurrent(
    uniqueOptions((customersQuery.data?.content || []).map((customer) => customer.partyName)),
    form.customer,
  ), [customersQuery.data, form.customer]);
  const resourceOptions = useMemo(() => {
    const options = uniqueOptions((resourcesQuery.data?.content || []).map((resource) => resource.partyName));
    return optionWithCurrent(optionWithCurrent(options, form.selectedResource), form.workingResource);
  }, [resourcesQuery.data, form.selectedResource, form.workingResource]);
  const staffingCurrencyOptions=useMemo(()=>(currenciesQuery.data||[]).map((currency)=>({value:currency.code,label:`${currency.code} – ${currency.name}`})),[currenciesQuery.data]);

  useEffect(() => {
    if (recordQuery.data) setForm(staffingFormFromRecord(recordQuery.data));
  }, [recordQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const saved = isEdit
        ? await recordsApi.update({ module: PROJECT_MODULE, type: STAFFING_TYPE, id, payload })
        : await recordsApi.create({ module: PROJECT_MODULE, type: STAFFING_TYPE, payload });
      const projectId = saved.id || id;
      if (isEdit) await staffingSowsApi.updateCurrent(projectId, { startDate: form.startDate, endDate: form.closedDate, document: sowDocument, notes: form.comments });
      else await staffingSowsApi.initialize(projectId, { startDate: form.startDate, endDate: form.closedDate, document: sowDocument, notes: form.comments });
      const results = await Promise.allSettled(documentFiles.map((file) => projectDocumentsApi.upload(STAFFING_TYPE, projectId, file)));
      return { saved, failed: results.filter((result) => result.status === 'rejected').length };
    },
    onSuccess: ({ saved, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      navigate(`/project/staffing/${saved.id || id}`, {
        replace: true,
        state: { message: failed ? `Assignment saved, but ${failed} document${failed === 1 ? '' : 's'} could not be uploaded. You can retry from Documents.` : `Resource assignment ${isEdit ? 'updated' : 'created'} successfully.` },
      });
    },
  });
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.customer.trim()) nextErrors.customer = 'Customer is required';
    if (!form.selectedResource.trim()) nextErrors.selectedResource = 'Selected resource is required';
    if (!form.workingResource.trim()) nextErrors.workingResource = 'Working resource is required';
    if (!form.technology.trim()) nextErrors.technology = 'Technology is required';
    if (!numberValue(form.rate)) nextErrors.rate = 'Rate is required';
    if (!form.startDate) nextErrors.startDate = 'SOW Start Date is required';
    if (!form.closedDate) nextErrors.closedDate = 'SOW End Date is required';
    if (form.startDate && form.closedDate && form.closedDate < form.startDate) nextErrors.closedDate = 'SOW End Date cannot be earlier than SOW Start Date';
    if (form.status === 'Close' && !form.closeDate) nextErrors.closeDate = 'Close Date is required when project status is Close';
    if (form.status === 'Close' && form.closeDate && form.startDate && form.closeDate < form.startDate) nextErrors.closeDate = 'Close Date cannot be earlier than the project Start Date';
    if ((!isEdit || !currentSowQuery.data) && !sowDocument) nextErrors.sowDocument = 'Signed SOW Document is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    saveMutation.mutate(staffingPayload(form));
  };

  return (
    <form id="staffing-assignment-form" onSubmit={submit} className="space-y-4 text-[#06134a]">
      <PageTitle
        title={isEdit ? 'Edit Resource Assignment' : 'Add Resource Assignment'}
        subtitle={<><span className="font-black text-red-600">Dashboard</span><span className="mx-2 text-slate-400">›</span>Resource Assignments<span className="mx-2 text-slate-400">›</span>{isEdit ? 'Edit Assignment' : 'Add Assignment'}</>}
        actions={<><Link to="/project/staffing" className="grid h-10 place-items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black">Cancel</Link><button disabled={saveMutation.isPending} type="submit" className="flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white shadow-sm shadow-red-200 disabled:opacity-60"><Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving...' : 'Save Assignment'}</button></>}
      />
      {recordQuery.isLoading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold">Loading assignment...</div>}
      {saveMutation.isError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">Unable to save assignment. Please check required data and backend API.</div>}

      <ProjectFormCard icon={Building2} title="Customer & Engagement Details">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ProjectSelect label="Customer" value={form.customer} onChange={(value) => update('customer', value)} error={errors.customer} options={customerOptions} placeholder={customersQuery.isLoading ? 'Loading customers...' : 'Select Customer'} required />
          <ProjectInput label="Total Resources (Auto)" value={form.totalResources} onChange={(value) => update('totalResources', value)} placeholder="0" />
          <ProjectInput label={`Total Billing (${currencyCode(form.currency)})`} value={form.totalBilling} onChange={(value) => update('totalBilling', value)} placeholder="0.00" />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ProjectSelect label="Notice Period" value={form.noticePeriod} onChange={(value) => update('noticePeriod', value)} options={['15 days', '30 days', '45 days', '60 days']} placeholder="Select Notice Period" required />
          <ProjectDateInput label="SOW Start Date" value={form.startDate} onChange={(value) => update('startDate', value)} error={errors.startDate} placeholder="Select SOW Start Date" required />
          <ProjectDateInput label="SOW End Date" value={form.closedDate} onChange={(value) => update('closedDate', value)} error={errors.closedDate} placeholder="Select SOW End Date" required />
          <label className="block md:col-span-2"><span className="mb-2 block text-sm font-black">Signed SOW Document{(!isEdit || (!currentSowQuery.isLoading && !currentSowQuery.data)) && <b className="text-red-600"> *</b>}</span><input type="file" accept=".pdf,.doc,.docx" onChange={(event)=>setSowDocument(event.target.files?.[0]||null)} className="block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" />{sowDocument&&<p className="mt-1 text-xs font-bold text-emerald-600">{sowDocument.name}</p>}{errors.sowDocument&&<p className="mt-1 text-xs font-bold text-red-600">{errors.sowDocument}</p>}{isEdit&&currentSowQuery.data&&<p className="mt-1 text-xs font-semibold text-slate-500">Leave blank to retain the current signed SOW.</p>}</label>
        </div>
      </ProjectFormCard>

      <ProjectFormCard icon={UsersRound} title="Resource Details">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ProjectSelect label="Selected Resource" value={form.selectedResource} onChange={(value) => update('selectedResource', value)} error={errors.selectedResource} options={resourceOptions} placeholder={resourcesQuery.isLoading ? 'Loading resources...' : 'Select Resource'} required />
          <ProjectSelect label="Working Resource" value={form.workingResource} onChange={(value) => update('workingResource', value)} error={errors.workingResource} options={resourceOptions} placeholder={resourcesQuery.isLoading ? 'Loading resources...' : 'Select Working Resource'} required />
          <ProjectSelect label="Technology" value={form.technology} onChange={(value) => update('technology', value)} error={errors.technology} options={projectTechnologies} placeholder="Select Technology" required />
          <ProjectInput label="Experience" value={form.experience} onChange={(value) => update('experience', value)} placeholder="e.g. 5+ years" />
        </div>
      </ProjectFormCard>

      <ProjectFormCard icon={CircleDollarSign} title="Commercial Details">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ProjectInput label="Rate" value={form.rate} onChange={(value) => update('rate', value)} error={errors.rate} placeholder="Enter Rate" required />
          <ProjectSelect label="Currency" value={currencyCode(form.currency)} onChange={(value) => update('currency', value)} options={staffingCurrencyOptions} placeholder={currenciesQuery.isLoading?'Loading currencies...':'Select Currency'} required />
          <ProjectSelect label="Billing Type" value={form.billingType} onChange={(value) => update('billingType', value)} options={['T&M', 'Fixed']} placeholder="Select Billing Type" required />
          <ProjectInput label={`Monthly Billing (${currencyCode(form.currency)})`} value={form.monthlyBilling} onChange={(value) => update('monthlyBilling', value)} placeholder="0.00" />
        </div>
      </ProjectFormCard>

      <ProjectFormCard icon={UsersRound} title="End Client Details">
        <div className="grid gap-5 md:grid-cols-3">
          <ProjectInput label="End Client-1" placeholder="Enter End Client 1" />
          <ProjectInput label="End Client-2" placeholder="Enter End Client 2" />
          <ProjectInput label="End Client-3" placeholder="Enter End Client 3" />
        </div>
      </ProjectFormCard>

      <ProjectFormCard icon={CalendarDays} title="Additional Information">
        <div className="grid gap-5 md:grid-cols-2">
          <ProjectSelect label="Status" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value, closeDate: value === 'Close' ? current.closeDate : '' }))} options={staffingStatuses} placeholder="Active" />
          {form.status === 'Close' && <ProjectDateInput label="Close Date" value={form.closeDate} onChange={(value) => update('closeDate', value)} error={errors.closeDate} required />}
        </div>
        <div className="mt-5">
          <ProjectTextarea label="Comments / Notes" value={form.comments} onChange={(value) => update('comments', value)} placeholder="Enter any additional comments..." />
        </div>
      </ProjectFormCard>

      <ProjectFormCard icon={FileBox} title="Project Documents">
        <ProjectDocumentPicker files={documentFiles} onChange={setDocumentFiles} projectType={STAFFING_TYPE} projectId={isEdit ? id : null} />
      </ProjectFormCard>
    </form>
  );
}

const PROJECT_DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.zip';
const PROJECT_DOCUMENT_EXTENSIONS = new Set(PROJECT_DOCUMENT_ACCEPT.split(',').map((item) => item.slice(1)));
const MAX_PROJECT_DOCUMENT_SIZE = 10 * 1024 * 1024;

function readableFileSize(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function projectDocumentTypeLabel(document) {
  if (document.documentType === 'SOW') return `SOW-${String(document.sowVersion || 1).padStart(2, '0')} • ${document.fileExtension || 'FILE'}`;
  return document.fileExtension || 'FILE';
}

function ProjectDocumentPicker({ files, onChange, projectType, projectId }) {
  const [error, setError] = useState('');
  const documentsQuery = useQuery({
    queryKey: ['project-documents', projectType, projectId],
    queryFn: () => projectDocumentsApi.list(projectType, projectId),
    enabled: Boolean(projectId),
  });
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: (documentId) => projectDocumentsApi.remove(projectType, projectId, documentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-documents', projectType, projectId] }),
  });
  const addFiles = (selected) => {
    const accepted = [];
    const errors = [];
    Array.from(selected || []).forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!PROJECT_DOCUMENT_EXTENSIONS.has(extension)) errors.push(`${file.name}: unsupported file type`);
      else if (file.size > MAX_PROJECT_DOCUMENT_SIZE) errors.push(`${file.name}: exceeds 10 MB`);
      else if (!files.some((existing) => existing.name === file.name && existing.size === file.size)) accepted.push(file);
    });
    onChange([...files, ...accepted]);
    setError(errors.join(' • '));
  };
  const existing = documentsQuery.data || [];
  return <div className="space-y-4">
    {!!existing.length && <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Existing Documents</p><div className="divide-y rounded-lg border border-slate-200">{existing.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-black">{document.originalFileName}</p><p className="mt-1 text-xs font-semibold text-slate-500">{projectDocumentTypeLabel(document)} • {readableFileSize(document.fileSize)} • Uploaded {new Date(document.uploadedAt).toLocaleDateString('en-IN')}</p></div><div className="flex gap-3 text-xs font-black"><button type="button" onClick={() => projectDocumentsApi.download(projectType, projectId, document)} className="text-blue-600">Download</button>{document.documentType !== 'SOW' && <button type="button" onClick={() => { if (window.confirm('Are you sure you want to remove this document from the project?')) removeMutation.mutate(document.id); }} className="text-red-600">Remove</button>}</div></div>)}</div></div>}
    <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} className="grid min-h-36 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center hover:border-blue-300 hover:bg-blue-50/40">
      <input type="file" multiple accept={PROJECT_DOCUMENT_ACCEPT} className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
      <div><Upload className="mx-auto h-7 w-7 text-blue-600"/><p className="mt-2 text-sm font-black">Drag & drop files here or <span className="text-blue-600">Browse Files</span></p><p className="mt-2 text-xs font-semibold text-slate-500">PDF, Office documents, CSV, TXT, images and ZIP • Maximum 10 MB per file</p></div>
    </label>
    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
    {!!files.length && <div className="divide-y rounded-lg border border-slate-200">{files.map((file, index) => <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-black">{file.name}</p><p className="text-xs font-semibold text-slate-500">{readableFileSize(file.size)} • Ready to upload</p></div><button type="button" onClick={() => onChange(files.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-black text-red-600">Remove</button></div>)}</div>}
  </div>;
}

function ProjectDocumentsPanel({ projectType, projectId }) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const documentsQuery = useQuery({ queryKey: ['project-documents', projectType, projectId], queryFn: () => projectDocumentsApi.list(projectType, projectId), enabled: Boolean(projectId) });
  const uploadMutation = useMutation({
    mutationFn: async () => Promise.allSettled(files.map((file) => projectDocumentsApi.upload(projectType, projectId, file))),
    onSuccess: (results) => {
      const failed = results.filter((result) => result.status === 'rejected').length;
      setMessage(failed ? `${failed} document${failed === 1 ? '' : 's'} failed to upload. Please retry.` : 'Project documents uploaded successfully.');
      if (!failed) setFiles([]);
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectType, projectId] });
    },
  });
  const removeMutation = useMutation({ mutationFn: (documentId) => projectDocumentsApi.remove(projectType, projectId, documentId), onSuccess: () => { setMessage('Project document removed successfully.'); queryClient.invalidateQueries({ queryKey: ['project-documents', projectType, projectId] }); } });
  const documents = documentsQuery.data || [];
  const canPreview = (document) => document.mimeType === 'application/pdf' || String(document.mimeType || '').startsWith('image/');
  return <Panel title="Project Documents" action={<label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-black text-white"><Plus className="h-4 w-4"/>Add Document<input type="file" multiple accept={PROJECT_DOCUMENT_ACCEPT} className="sr-only" onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files || [])])}/></label>}>
    {message && <p className={`mb-4 rounded-lg p-3 text-sm font-bold ${message.includes('success') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{message}</p>}
    {!!files.length && <div className="mb-5"><ProjectDocumentPicker files={files} onChange={setFiles} projectType={projectType}/><div className="mt-3 flex justify-end"><button type="button" disabled={uploadMutation.isPending} onClick={() => uploadMutation.mutate()} className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60">{uploadMutation.isPending ? 'Uploading...' : `Upload ${files.length} Document${files.length === 1 ? '' : 's'}`}</button></div></div>}
    {documentsQuery.isLoading && <p className="py-10 text-center font-bold text-slate-500">Loading project documents...</p>}
    {!documentsQuery.isLoading && !documents.length && !files.length && <div className="grid min-h-44 place-items-center rounded-xl border border-dashed bg-slate-50 text-center"><div><FileBox className="mx-auto h-8 w-8 text-slate-400"/><p className="mt-3 font-black">No documents have been added to this project yet.</p><p className="mt-1 text-sm font-semibold text-slate-500">Use Add Document to upload one or more project files.</p></div></div>}
    {!!documents.length && <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Document Name','Type','Size','Uploaded On','Uploaded By','Actions'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y">{documents.map((document) => <tr key={document.id}><td className="max-w-[320px] truncate px-4 py-4 font-black" title={document.originalFileName}>{document.originalFileName}</td><td className="px-4 py-4">{projectDocumentTypeLabel(document)}</td><td className="px-4 py-4">{readableFileSize(document.fileSize)}</td><td className="px-4 py-4">{new Date(document.uploadedAt).toLocaleDateString('en-IN')}</td><td className="px-4 py-4">{document.uploadedByName || '-'}</td><td className="px-4 py-4"><div className="flex gap-3 font-black">{canPreview(document) && <button type="button" onClick={() => projectDocumentsApi.preview(projectType, projectId, document)} className="text-blue-600">View</button>}<button type="button" onClick={() => projectDocumentsApi.download(projectType, projectId, document)} className="text-blue-600">Download</button>{document.documentType !== 'SOW' && <button type="button" onClick={() => { if (window.confirm('Are you sure you want to remove this document from the project?')) removeMutation.mutate(document.id); }} className="text-red-600">Remove</button>}</div></td></tr>)}</tbody></table></div>}
  </Panel>;
}

function SowHistoryPanel({ projectId, rows = [], loading }) {
  const openDocument=(sow,preview=false)=>{if(!sow.documentId)return;const document={id:sow.documentId,originalFileName:sow.documentName,mimeType:sow.documentMimeType};return preview?projectDocumentsApi.preview(STAFFING_TYPE,projectId,document):projectDocumentsApi.download(STAFFING_TYPE,projectId,document);};
  return <Panel title="SOW History">{loading?<p className="py-10 text-center font-bold text-slate-500">Loading SOW history...</p>:!rows.length?<p className="rounded-lg border border-dashed bg-slate-50 p-10 text-center font-bold">No SOW history is available.</p>:<div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Version','SOW Start Date','SOW End Date','Duration','Status','Signed SOW','Added By','Added Date','Notes','Actions'].map(label=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y">{rows.map(sow=><tr key={sow.id}><td className="px-4 py-4 font-black">{sow.versionLabel}{sow.current&&<span className="ml-2 text-xs text-red-600">CURRENT</span>}</td><td className="px-4 py-4">{formatDate(sow.startDate)}</td><td className="px-4 py-4">{formatDate(sow.endDate)}</td><td className="px-4 py-4">{sow.durationDays} days</td><td className="px-4 py-4"><Tag tone={sow.status==='EXPIRED'?'red':sow.status==='EXPIRING_SOON'?'amber':sow.status==='ACTIVE'?'green':'slate'}>{String(sow.status).replaceAll('_',' ')}</Tag></td><td className="max-w-48 truncate px-4 py-4 font-bold" title={sow.documentName||''}>{sow.documentName||'-'}</td><td className="px-4 py-4">{sow.addedByName||'System'}</td><td className="px-4 py-4">{sow.addedAt?new Date(sow.addedAt).toLocaleDateString('en-IN'):'-'}</td><td className="max-w-52 truncate px-4 py-4" title={sow.notes||''}>{sow.notes||'-'}</td><td className="px-4 py-4"><div className="flex gap-3 font-black">{sow.documentId&&<><button onClick={()=>openDocument(sow,true)} className="text-blue-600">View</button><button onClick={()=>openDocument(sow)} className="text-blue-600">Download</button></>}</div></td></tr>)}</tbody></table></div>}</Panel>;
}

function StaffingProjectDetailsPage() {
  const { id } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState('Overview');
  const [renewOpen, setRenewOpen] = useState(false);
  const recordQuery = useQuery({ queryKey: ['records', PROJECT_MODULE, STAFFING_TYPE, id], queryFn: () => recordsApi.get({ module: PROJECT_MODULE, type: STAFFING_TYPE, id }), enabled: Boolean(id) });
  const invoicesQuery = useQuery({ queryKey: ['project-invoices', STAFFING_TYPE, id], queryFn: () => projectInvoicesApi.list(STAFFING_TYPE, id), enabled: Boolean(id) });
  const sowsQuery = useQuery({ queryKey: ['staffing-sows', id], queryFn: () => staffingSowsApi.list(id), enabled: Boolean(id) });
  const assignment = recordQuery.data ? staffingAssignmentFromRecord(recordQuery.data) : null;
  const currentSow = (sowsQuery.data || []).find((sow) => sow.current);
  const refresh = () => { setRenewOpen(false); queryClient.invalidateQueries({ queryKey: ['records'] }); queryClient.invalidateQueries({ queryKey: ['staffing-sows', id] }); };
  return <section className="space-y-4 text-[#06134a]">
    <PageTitle title="Staffing Project Details" subtitle={<><span className="font-black text-red-600">Projects</span><span className="mx-2 text-slate-400">›</span>Staffing Projects<span className="mx-2 text-slate-400">›</span>Details</>} actions={<><Link to="/project/staffing" className="grid h-10 place-items-center rounded-lg border px-5 text-sm font-black">Back</Link>{assignment && canEditStaffing(user) && <button onClick={() => setRenewOpen(true)} className="flex h-10 items-center gap-2 rounded-lg border border-red-200 px-5 text-sm font-black text-red-600"><TimerReset className="h-4 w-4" />Renew SOW</button>}<Link to={`/project/staffing/${id}/edit`} className="flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white"><Pencil className="h-4 w-4" />Edit Assignment</Link></>} />
    {location.state?.message && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{location.state.message}</p>}
    {recordQuery.isLoading && <Panel><p className="py-10 text-center font-bold">Loading staffing project...</p></Panel>}
    {assignment && <>
      <Panel><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">{[['Customer', assignment.customer], ['Selected Resource', assignment.selectedResource], ['Working Resource', assignment.workingResource], ['Monthly Billing', money(assignment.billingAmount, assignment.currency)], ['Status', assignment.status], ['Close Date', assignment.closeDate]].map(([label, value]) => <StatBlock key={label} label={label} value={value} />)}</div></Panel>
      <Panel title="Current SOW" action={currentSow?.documentId && <button onClick={() => projectDocumentsApi.preview(STAFFING_TYPE, id, { id: currentSow.documentId, originalFileName: currentSow.documentName, mimeType: currentSow.documentMimeType })} className="text-sm font-black text-blue-600">View SOW</button>}><div className="grid gap-4 md:grid-cols-4"><InfoLine label="SOW Start Date" value={currentSow ? formatDate(currentSow.startDate) : assignment.startDate} /><InfoLine label="SOW End Date" value={currentSow ? formatDate(currentSow.endDate) : assignment.sowEndDate} /><InfoLine label="SOW Status" value={<Tag tone={currentSow?.status === 'EXPIRED' ? 'red' : currentSow?.status === 'EXPIRING_SOON' ? 'amber' : 'green'}>{String(currentSow?.status || sowDateStatus(assignment.sowEndDateValue).label).replaceAll('_', ' ')}</Tag>} /><InfoLine label="Signed SOW" value={currentSow?.documentName || 'Not attached'} /></div></Panel>
      <div className="flex gap-6 overflow-x-auto border-b">{['Overview', 'Invoices', 'Documents', 'SOW History'].map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`h-11 whitespace-nowrap border-b-2 text-sm font-black ${activeTab === tab ? 'border-red-600 text-red-600' : 'border-transparent text-slate-600'}`}>{tab}{tab === 'Invoices' ? ` (${invoicesQuery.data?.invoices?.length || 0})` : tab === 'SOW History' ? ` (${sowsQuery.data?.length || 0})` : ''}</button>)}</div>
      {activeTab === 'Overview' ? <Panel title="Assignment Information"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[['Technology', assignment.technology], ['Billing Type', assignment.billingType], ['Rate', assignment.rate], ['Status', assignment.status], ['SOW Start Date', assignment.startDate], ['SOW End Date', assignment.sowEndDate], ['Close Date', assignment.closeDate], ['Notice Period', assignment.noticePeriod], ['Comments', assignment.notes || '-']].map(([label, value]) => <InfoLine key={label} label={label} value={value} />)}</div></Panel> : activeTab === 'Invoices' ? <ProjectInvoicesPanel projectType={STAFFING_TYPE} projectId={id} data={invoicesQuery.data} loading={invoicesQuery.isLoading} error={invoicesQuery.isError} currency={assignment.currency} /> : activeTab === 'Documents' ? <ProjectDocumentsPanel projectType={STAFFING_TYPE} projectId={id} /> : <SowHistoryPanel projectId={id} rows={sowsQuery.data || []} loading={sowsQuery.isLoading} />}
      <RenewSowModal assignment={renewOpen ? assignment : null} onClose={() => setRenewOpen(false)} onRenewed={refresh} />
    </>}
  </section>;
}

function ProjectInvoicesPanel({ data, loading, error, currency = 'INR' }) {
  const rows = data?.invoices || [];
  return <Panel title="Project Invoices" action={<div className="flex gap-4 text-xs font-black"><span>Total Billed: {money(data?.totalBilled,currency)}</span><span className="text-emerald-600">Paid: {money(data?.totalPaid,currency)}</span><span className="text-red-600">Balance: {money(data?.totalBalance,currency)}</span></div>}>
    {loading && <p className="py-10 text-center font-bold text-slate-500">Loading project invoices...</p>}
    {error && <p className="py-10 text-center font-bold text-red-600">Unable to load project invoices.</p>}
    {!loading && !error && !rows.length && <div className="grid min-h-44 place-items-center rounded-xl border border-dashed bg-slate-50 text-center"><div><ReceiptText className="mx-auto h-8 w-8 text-slate-400"/><p className="mt-3 font-black">No invoices are linked to this project yet.</p><p className="mt-1 text-sm font-semibold text-slate-500">Create an invoice and select this project to see it here.</p></div></div>}
    {!!rows.length && <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Invoice #','Date','Due Date','Status','Amount','Paid','Balance'].map((label)=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y">{rows.map((invoice)=><tr key={invoice.id}><td className="px-4 py-4"><Link to={`/sales/invoices/${invoice.id}`} className="font-black text-blue-600 hover:underline">{invoice.invoiceNumber}</Link></td><td className="px-4 py-4">{formatDate(invoice.invoiceDate)}</td><td className="px-4 py-4">{formatDate(invoice.dueDate)}</td><td className="px-4 py-4"><Badge tone={invoice.status==='PAID'?'green':invoice.status==='VOID'?'red':'blue'}>{String(invoice.status||'').replaceAll('_',' ')}</Badge></td><td className="px-4 py-4 font-bold">{money(invoice.amount,invoice.currency)}</td><td className="px-4 py-4 font-bold text-emerald-600">{money(invoice.paid,invoice.currency)}</td><td className="px-4 py-4 font-bold text-red-600">{money(invoice.balance,invoice.currency)}</td></tr>)}</tbody></table></div>}
  </Panel>;
}

function ProjectMilestonesPage() {
  return (
    <section className="space-y-5 text-[#06134a]">
      <PageTitle
        title="Project Milestones"
        subtitle="Track upcoming, completed and billing-linked project milestones."
        actions={<><DateButton>01 Jun 2024 - 30 Jun 2024</DateButton><ActionButton icon={Filter}>Filter</ActionButton></>}
      />
      <Panel title="Project Milestones"><div className="grid min-h-52 place-items-center rounded-xl border border-dashed bg-slate-50 text-center"><div><p className="font-black">Milestones are managed project-wise.</p><p className="mt-2 text-sm font-semibold text-slate-500">Open a Fixed Cost Project to view, add, or update its milestones.</p><Link to="/project/fixed-cost" className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white">View Fixed Cost Projects</Link></div></div></Panel>
    </section>
  );
}

function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="text-2xl font-black leading-tight tracking-normal">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    </div>
  );
}

function Panel({ title, action, children, className = 'p-5' }) {
  return (
    <article className={`min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-black">{title}</h2>{action}</div>}
      {children}
    </article>
  );
}

function ProjectFormCard({ icon: Icon, title, children }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {children}
    </article>
  );
}

function ProjectLabel({ label, required, hint, error, children }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-black">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <span className="mt-2 block">{children}</span>
      {error && <span className="mt-2 block text-xs font-bold text-red-600">{error}</span>}
      {hint && <span className="mt-2 block text-xs font-semibold text-slate-500">{hint}</span>}
    </label>
  );
}

function ProjectInput({ label, placeholder, required = false, hint, value, onChange, error, type = 'text', disabled = false }) {
  const controlProps = value !== undefined ? { value, onChange: (event) => onChange?.(event.target.value) } : {};
  return (
    <ProjectLabel label={label} required={required} hint={hint} error={error}>
      <input {...controlProps} type={type} disabled={disabled} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-200 focus:ring-4 focus:ring-red-50 disabled:bg-slate-100 disabled:text-slate-500" placeholder={placeholder} />
    </ProjectLabel>
  );
}

function ProjectSelect({ label, placeholder, required = false, hint, value, onChange, options = [], error }) {
  const controlProps = value !== undefined ? { value, onChange: (event) => onChange?.(event.target.value) } : {};
  return (
    <ProjectLabel label={label} required={required} hint={hint} error={error}>
      <span className="relative block">
        <select {...controlProps} className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-[#06134a] outline-none transition focus:border-red-200 focus:ring-4 focus:ring-red-50">
          <option value="">{placeholder || 'Select'}</option>
          {options.map((option) => {const item=typeof option==='object'?option:{value:option,label:option};return <option key={item.value} value={item.value}>{item.label}</option>;})}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#06134a]" />
      </span>
    </ProjectLabel>
  );
}

function TeamMemberSelect({employees,value=[],onChange,loading}) {
  const selected=new Set(value.map(String));
  const add=(id)=>{if(id&&!selected.has(id))onChange([...value,id]);};
  return <ProjectLabel label="Team Members" hint="Select multiple active employees">
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap gap-2">{value.map((id)=>{const employee=employees.find((x)=>String(x.id)===String(id));return <span key={id} className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-black text-red-700">{employee?.partyName||`Employee ${id}`}<button type="button" aria-label="Remove team member" onClick={()=>onChange(value.filter((x)=>String(x)!==String(id)))}>×</button></span>;})}{!value.length&&<span className="text-xs font-semibold text-slate-400">No team members selected</span>}</div>
      <span className="relative block"><select value="" onChange={(e)=>add(e.target.value)} className="h-11 w-full appearance-none rounded-lg border border-slate-200 px-4 pr-10 text-sm font-semibold"><option value="">{loading?'Loading employees...':'Select Employee'}</option>{employees.filter((x)=>!selected.has(String(x.id))).map((employee)=><option key={employee.id} value={employee.id}>{employee.partyName}{employee.category?` — ${employee.category}`:''}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"/></span>
    </div>
  </ProjectLabel>;
}

function ProjectDateInput({ label, placeholder, required = false, value, onChange, error }) {
  const controlProps = value !== undefined ? { value, onChange: (event) => onChange?.(event.target.value) } : {};
  return (
    <ProjectLabel label={label} required={required} error={error}>
      <span className="relative block">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#06134a]" />
        <input {...controlProps} type="date" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 pl-10 text-sm font-semibold text-[#06134a] outline-none transition focus:border-red-200 focus:ring-4 focus:ring-red-50" placeholder={placeholder} />
      </span>
    </ProjectLabel>
  );
}

function ProjectTextarea({ label, placeholder, value, onChange }) {
  const controlProps = value !== undefined ? { value, onChange: (event) => onChange?.(event.target.value) } : {};
  return (
    <ProjectLabel label={label}>
      <textarea {...controlProps} className="min-h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-red-200 focus:ring-4 focus:ring-red-50" placeholder={placeholder} />
    </ProjectLabel>
  );
}

function ProjectToggle({ label, description, checked = false, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4">
      <div>
        <p className="text-sm font-black">{label}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
      </div>
      <button type="button" onClick={() => onChange?.(!checked)} className={`relative mt-1 h-5 w-10 shrink-0 rounded-full transition ${checked ? 'bg-red-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? 'right-0.5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, meta, color }) {
  const colors = {
    violet: 'border-violet-200 bg-violet-50/60 text-violet-700',
    blue: 'border-blue-200 bg-blue-50/60 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-700',
    orange: 'border-orange-200 bg-orange-50/60 text-orange-700',
    green: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
    sky: 'border-sky-200 bg-sky-50/60 text-sky-700',
  };
  return (
    <article className={`min-w-0 rounded-xl border p-3 shadow-sm ${colors[color]}`}>
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${colors[color]}`}><Icon className="h-4 w-4" /></span>
      <p className="mt-2 min-h-7 text-[12px] font-black leading-4 text-[#06134a]">{label}</p>
      <p className="mt-1 break-words text-[21px] font-black leading-none text-[#06134a]">{value}</p>
      <p className="mt-3 min-h-4 text-[11px] font-bold leading-4 text-slate-600">{meta}</p>
      <button className="mt-2 text-[11px] font-black text-blue-600">View Details →</button>
    </article>
  );
}

function AssignmentCard({ icon: Icon, label, value, meta, footer }) {
  const hasSecondFooter = Boolean(footer[2]);

  return (
    <article className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-[42px_1fr] items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="min-h-8 text-[12px] font-black leading-4">{label}</p>
          <p className="mt-1 text-[22px] font-black leading-none">{value}</p>
          <p className="mt-2 text-[12px] font-bold leading-4 text-slate-500">{meta}</p>
        </div>
      </div>
      <div className={`mt-4 grid gap-3 border-t border-slate-200 pt-3 ${hasSecondFooter ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <p className="text-[11px] font-bold leading-4 text-slate-500">{footer[0]}</p>
          <p className="mt-1 text-[15px] font-black leading-tight">{footer[1]}</p>
        </div>
        {hasSecondFooter && (
          <div className="border-l border-slate-200 pl-3">
            <p className="text-[11px] font-bold leading-4 text-slate-500">{footer[2]}</p>
            <p className="mt-1 text-[15px] font-black leading-tight">{footer[3]}</p>
          </div>
        )}
      </div>
    </article>
  );
}

function FixedCostSummaryCard({ icon: Icon, label, value, meta, footer, tone }) {
  const hasSecondFooter = Boolean(footer[2]);
  const tones = {
    red: 'border-red-200 bg-red-50/40 text-red-600',
    violet: 'border-violet-200 bg-violet-50/50 text-violet-600',
    cyan: 'border-cyan-200 bg-cyan-50/50 text-cyan-600',
    orange: 'border-orange-200 bg-orange-50/50 text-orange-600',
    blue: 'border-blue-200 bg-blue-50/50 text-blue-600',
  };

  return (
    <article className={`flex min-w-0 flex-col justify-between rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="grid grid-cols-[42px_1fr] items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="min-h-8 text-[12px] font-black leading-4 text-[#06134a]">{label}</p>
          <p className="mt-1 text-[22px] font-black leading-none text-[#06134a]">{value}</p>
          <p className="mt-2 text-[12px] font-bold leading-4 text-slate-600">{meta}</p>
        </div>
      </div>
      <div className={`mt-4 grid gap-3 border-t border-current/15 pt-3 ${hasSecondFooter ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <p className="text-[11px] font-bold leading-4 text-slate-600">{footer[0]}</p>
          <p className={`mt-1 text-[15px] font-black leading-tight ${!hasSecondFooter ? 'text-red-600' : 'text-[#06134a]'}`}>{footer[1]}</p>
        </div>
        {hasSecondFooter && (
          <div className="border-l border-current/15 pl-3">
            <p className="text-[11px] font-bold leading-4 text-slate-600">{footer[2]}</p>
            <p className="mt-1 text-[15px] font-black leading-tight text-[#06134a]">{footer[3]}</p>
          </div>
        )}
      </div>
    </article>
  );
}

function ProjectPagination({ data, page, pageSize, onPageChange, onPageSizeChange, noun = 'projects' }) {
  const totalElements = Number(data?.totalElements || 0);
  const totalPages = Math.max(1, Number(data?.totalPages || 0));
  const firstRecord = totalElements ? page * pageSize + 1 : 0;
  const lastRecord = Math.min(totalElements, (page + 1) * pageSize);
  const firstPage = Math.max(0, Math.min(page - 2, totalPages - 5));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPage + index);
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm font-bold">
    <p>Showing {firstRecord}–{lastRecord} of {totalElements} {noun}</p>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={page <= 0} onClick={() => onPageChange(0)} className="h-9 rounded-lg border px-3 disabled:opacity-40">First</button>
      <button type="button" disabled={page <= 0} onClick={() => onPageChange(page - 1)} className="h-9 rounded-lg border px-3 disabled:opacity-40">‹ Previous</button>
      {pages.map((pageNumber) => <button type="button" key={pageNumber} onClick={() => onPageChange(pageNumber)} className={`grid h-9 w-9 place-items-center rounded-lg border ${pageNumber === page ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200'}`}>{pageNumber + 1}</button>)}
      <button type="button" disabled={page >= totalPages - 1 || !totalElements} onClick={() => onPageChange(page + 1)} className="h-9 rounded-lg border px-3 disabled:opacity-40">Next ›</button>
      <button type="button" disabled={page >= totalPages - 1 || !totalElements} onClick={() => onPageChange(totalPages - 1)} className="h-9 rounded-lg border px-3 disabled:opacity-40">Last</button>
      <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3"><option value="10">10 / page</option><option value="20">20 / page</option><option value="50">50 / page</option></select>
    </div>
  </div>;
}

function StaffingTable({ assignments = [], pageData, page, pageSize, onPageChange, onPageSizeChange, onDelete, onRenew, canEdit = false }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const customerGroups = useMemo(() => {
    const groups = new Map();
    assignments.forEach((assignment) => {
      const key = customerGroupKey(assignment.customer);
      const group = groups.get(key) || { key, customer: assignment.customer.trim(), assignments: [], resources: 0, billing: 0, currencies: new Set() };
      group.assignments.push(assignment);
      group.resources += Number(assignment.selected || 1);
      group.billing += Number(assignment.billingAmount || 0);
      group.currencies.add(String(assignment.currency || 'INR').trim().slice(0, 3).toUpperCase());
      groups.set(key, group);
    });
    return [...groups.values()];
  }, [assignments]);
  const groupBilling = (group) => {
    if (group.currencies.size === 1) return formatCurrency(group.billing, [...group.currencies][0]);
    return [...group.currencies].map((currency) => {
      const total = group.assignments.filter((assignment) => String(assignment.currency || 'INR').startsWith(currency)).reduce((sum, assignment) => sum + Number(assignment.billingAmount || 0), 0);
      return formatCurrency(total, currency);
    }).join(' + ');
  };
  const columns = [
    ['Customer', 'Total Resources / Total Billing'],
    ['Selected Resource'],
    ['Working Resource'],
    ['Rate'],
    ['Currency'],
    ['Monthly Billing'],
    ['SOW Start Date'],
    ['SOW End Date'],
    ['Close Date'],
    ['Status'],
    ['SOW Status'],
    ['Technology'],
    ['Actions'],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full text-left text-sm">
        <thead className="bg-red-50/50 text-slate-600">
          <tr>
            {columns.map((column) => (
              <th key={column[0]} className="px-4 py-4 align-bottom">
                <p className="text-[11px] font-black uppercase tracking-wide">{column[0]}</p>
                {column[1] && <p className="mt-1 text-[10px] font-bold text-slate-500">{column[1]}</p>}
              </th>
            ))}
          </tr>
        </thead>
        {customerGroups.map((group) => (
          <tbody key={group.key} className="divide-y divide-slate-100">
            <tr className="bg-white">
              <td className="px-4 py-4 font-black">
                <div className="flex items-center gap-3">
                  <span className="text-red-600">⌄</span>
                  <CompanyMark name={group.customer} />
                  <div>
                    <p className="font-black">{group.customer}</p>
                    <p className="text-xs font-bold text-slate-500">{group.resources} Resource{group.resources === 1 ? '' : 's'}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 font-black text-red-600">{group.resources}</td>
              <td className="whitespace-nowrap px-4 py-4 font-black text-red-600">{groupBilling(group)}</td>
              <td colSpan={10} />
            </tr>
            {group.assignments.map((assignment) => <tr key={assignment.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={assignment.selectedResource} /><div><p className="font-black">{assignment.selectedResource}</p><p className="text-xs font-bold text-slate-500">{assignment.experience}</p></div></div></td>
              <td className="px-4 py-3 font-semibold">{assignment.selectedResource}</td><td className="px-4 py-3 font-semibold">{assignment.workingResource}</td><td className="px-4 py-3 font-semibold">{assignment.rate}</td><td className="px-4 py-3 font-semibold">{assignment.currency}</td><td className="px-4 py-3 font-semibold">{assignment.monthlyBilling}</td><td className="px-4 py-3 font-semibold">{assignment.startDate}</td><td className="px-4 py-3 font-semibold">{assignment.sowEndDate}</td><td className="px-4 py-3 font-semibold">{assignment.closeDate}</td><td className="px-4 py-3"><Tag tone={assignment.status === 'Active' ? 'green' : assignment.status === 'Hold' ? 'amber' : 'red'}>{assignment.status}</Tag></td><td className="px-4 py-3"><Tag tone={sowDateStatus(assignment.sowEndDateValue).tone}>{sowDateStatus(assignment.sowEndDateValue).label}</Tag></td><td className="px-4 py-3"><Tag tone="blue">{assignment.technology}</Tag></td>
              <td className="relative px-4 py-3">
                <button type="button" onClick={() => setOpenMenuId((current) => current === assignment.id ? null : assignment.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white"><MoreVertical className="h-4 w-4" /></button>
                {openMenuId === assignment.id && (
                  <div className="absolute right-4 top-12 z-20 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm font-black shadow-xl">
                    <Link to={`/project/staffing/${assignment.id}`} className="block px-4 py-2 hover:bg-slate-50" onClick={() => setOpenMenuId(null)}>View</Link>
                    <Link to={`/project/staffing/${assignment.id}/edit`} className="block px-4 py-2 hover:bg-slate-50" onClick={() => setOpenMenuId(null)}>Edit</Link>
                    {canEdit&&<button type="button" className="block w-full px-4 py-2 text-left text-blue-600 hover:bg-blue-50" onClick={()=>{setOpenMenuId(null);onRenew?.(assignment);}}>Renew SOW</button>}
                    <button type="button" className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50" onClick={() => { setOpenMenuId(null); onDelete?.(assignment); }}>Delete</button>
                  </div>
                )}
              </td>
            </tr>)}
          </tbody>
        ))}
      </table>
      <ProjectPagination data={pageData} page={page} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} noun="assignments" />
    </div>
  );
}

function MiniTable({ title, columns, rows, progressColumn, footer, emptyMessage = 'No records found.' }) {
  return (
    <Panel title={title} action={<button className="text-xs font-black text-blue-600">View All</button>}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{columns.map((column) => <th key={column} className="px-3 py-3">{column}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.join('-')}>{row.map((cell, index) => <td key={`${cell}-${index}`} className="px-3 py-3 font-semibold">{index === progressColumn ? <ProgressCell value={cell} /> : cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {!rows.length && <p className="py-8 text-center text-sm font-bold text-slate-500">{emptyMessage}</p>}
      {footer && <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-black">{footer}</p>}
    </Panel>
  );
}

function ProjectTrendChart({ buckets = [] }) {
  const max = Math.max(1, ...buckets.flatMap((bucket) => [bucket.fixed, bucket.staffing]));
  const points = (key) => buckets.map((bucket, index) => {
    const x = 22 + (index / Math.max(1, buckets.length - 1)) * 556;
    const y = 180 - (bucket[key] / max) * 140;
    return `${x},${y}`;
  }).join(' ');
  return (
    <div className="relative h-64 rounded-lg bg-slate-50 p-4">
      <div className="absolute inset-x-4 bottom-10 top-6 grid grid-rows-5">{Array.from({ length: 5 }).map((_, index) => <span key={index} className="border-t border-slate-200" />)}</div>
      <svg className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]" viewBox="0 0 600 210" preserveAspectRatio="none">
        <polyline points={points('fixed')} fill="none" stroke="#7c3aed" strokeWidth="3" />
        <polyline points={points('staffing')} fill="none" stroke="#1478ff" strokeWidth="3" />
      </svg>
      <div className="absolute left-6 top-3 flex gap-5 text-[11px] font-black"><span className="text-violet-600">● Fixed Cost</span><span className="text-blue-600">● Staffing</span></div>
      <div className="absolute bottom-3 left-6 right-6 flex justify-between overflow-hidden text-[10px] font-bold text-slate-500">{buckets.map((bucket) => <span key={bucket.key} className="min-w-0 truncate">{bucket.label}</span>)}</div>
      {!buckets.length && <p className="absolute inset-0 grid place-items-center text-sm font-bold text-slate-500">No project revenue in this period.</p>}
    </div>
  );
}

function Donut({ center, sub, segments }) {
  return <div className="mx-auto grid h-40 w-40 place-items-center rounded-full" style={{ background: segments }}><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><p className="text-2xl font-black">{center}</p><p className="text-xs font-bold text-slate-500">{sub}</p></div></div></div>;
}

function GaugeView({ value, subtitle, resourceLabel = '' }) {
  return <div className="mx-auto mb-5 grid h-32 w-52 place-items-center rounded-t-full border-[14px] border-b-0 border-violet-600 bg-white text-center"><div className="mt-12"><p className="text-3xl font-black">{value}</p><p className="text-xs font-bold text-slate-500">{subtitle}</p><p className="mt-1 text-xs font-bold">{resourceLabel}</p></div></div>;
}

function EngagementRows({ rows = [] }) {
  return <div className="space-y-3">{rows.map((row) => <div key={row[0]} className="grid items-center gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-[1.2fr_repeat(4,1fr)]"><p className={`rounded-lg px-4 py-3 text-sm font-black ${row[5]}`}>{row[0]}</p>{['Total Projects', 'Resources Engaged', 'Billable Resources', 'Utilization'].map((label, index) => <div key={label} className="text-center"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-lg font-black">{row[index + 1]}</p></div>)}</div>)}</div>;
}

function ActivityList({ records = [] }) {
  if (!records.length) return <p className="py-8 text-center text-sm font-bold text-slate-500">No project activity in this period.</p>;
  return <div className="space-y-4">{records.map((record) => <div key={`${record.kind}-${record.id}`} className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-600">{record.kind === 'Staffing Assignment' ? <UsersRound className="h-5 w-5" /> : <BriefcaseBusiness className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="font-black">{record.kind}</p><p className="text-xs font-semibold text-slate-500">{record.partyName || record.recordNumber} • {record.status || 'Active'}</p></div><span className="whitespace-nowrap text-xs font-bold text-slate-500">{formatDate(record.recordDate)}</span></div>)}</div>;
}

function InfoGrid({ project }) {
  const notes=parseJsonNotes(project.record?.notes);
  const duration=notes.estimatedDuration==='CUSTOM'?`${notes.customDurationValue} ${String(notes.customDurationUnit||'MONTHS').toLowerCase()}`:durationOptions.find((item)=>item.value===notes.estimatedDuration)?.label||`${project.durationMonths} Months`;
  const rows = [
    ['Customer', project.customer],
    ['Project Manager', project.manager],
    ['Project Type', project.projectType],
    ['Currency', project.currency],
    ['Domain / Industry', parseJsonNotes(project.record?.notes).domain || project.projectType],
    ['Estimated Duration',duration],
    ['Team Members',`${(notes.teamMemberIds||[]).length} selected`],
    ['Status', project.status],
  ];
  return <div className="grid gap-4 md:grid-cols-3">{rows.map(([label, value]) => <InfoLine key={label} label={label} value={value} />)}</div>;
}

function monthlyRows(project,profitability) {
  if(profitability?.months?.length)return profitability.months.map((row)=>[row.label,money(row.plannedValue,profitability.currencyCode)]).concat([['Total',money(profitability.totals.plannedValue,profitability.currencyCode)]]);
  const start = project.rawStart ? new Date(`${project.rawStart}T00:00:00`) : new Date();
  const amount = project.contractAmount / Math.max(1, project.durationMonths);
  const rows = Array.from({ length: Math.min(project.durationMonths, 12) }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const month = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date);
    return [month, money(amount,project.currency)];
  });
  return rows.concat([['Total', money(project.contractAmount,project.currency)]]);
}

function CostProfitTable({project,data,loading,error}) {
  const [breakdown,setBreakdown]=useState(null);
  const code=data?.currencyCode||currencyCode(project.currency);
  const columns = ['Month', `Planned Value (${code})`, 'Resource Cost (INR)', `Other Cost (${code})`, 'Total Cost (INR)', 'Profit (INR)', 'Profit %'];
  const rows=data?.months||[],total=data?.totals;

  if(loading)return <p className="py-10 text-center text-sm font-bold text-slate-500">Calculating project profitability...</p>;
  if(error)return <p className="rounded-lg bg-red-50 p-4 text-sm font-bold text-red-700">{error.response?.data?.message||'Unable to calculate project profitability.'}</p>;
  if(!data)return null;

  return (
    <div>
    <div className="overflow-x-auto">
      <table className="min-w-[620px] w-full text-left text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
          <tr>
            {columns.map((column, index) => (
              <th key={column} className={`px-3 py-3 font-black ${index > 0 ? 'text-right' : ''}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.month} className="hover:bg-slate-50">
              <td className="px-3 py-2.5 font-bold text-[#06134a]">{row.label}</td>
              <td className="px-3 py-2.5 text-right font-bold">{money(row.plannedValue,code)}</td>
              <td className="px-3 py-2.5 text-right"><button onClick={()=>setBreakdown(row)} className="font-black text-blue-700 underline decoration-dotted underline-offset-4" title="View resource cost breakdown">{money(row.resourceCostInInr,'INR')}</button></td>
              <td className="px-3 py-2.5 text-right font-bold">{money(row.otherCost,code)}</td>
              <td className="px-3 py-2.5 text-right font-bold">{money(row.totalCostInInr,'INR')}</td>
              <td className={`px-3 py-2.5 text-right font-black ${Number(row.profitInInr)<0?'text-red-600':'text-emerald-600'}`}>{money(row.profitInInr,'INR')}</td>
              <td className={`px-3 py-2.5 text-right font-black ${Number(row.profitPercentage)<0?'text-red-600':'text-emerald-600'}`}>{Number(row.profitPercentage).toFixed(2)}%</td>
            </tr>
          ))}
          <tr className="bg-slate-50/70">
            <td className="px-3 py-3 font-black">Total</td><td className="px-3 py-3 text-right font-black">{money(total.plannedValue,code)}</td><td className="px-3 py-3 text-right font-black">{money(total.resourceCostInInr,'INR')}</td><td className="px-3 py-3 text-right font-black">{money(total.otherCost,code)}</td><td className="px-3 py-3 text-right font-black">{money(total.totalCostInInr,'INR')}</td><td className={`px-3 py-3 text-right font-black ${Number(total.profitInInr)<0?'text-red-600':'text-emerald-600'}`}>{money(total.profitInInr,'INR')}</td><td className={`px-3 py-3 text-right font-black ${Number(total.profitPercentage)<0?'text-red-600':'text-emerald-600'}`}>{Number(total.profitPercentage).toFixed(2)}%</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
        <span>Expected Overall Profit</span>
        <span>{money(total.profitInInr,'INR')} <span className="ml-4">({Number(total.profitPercentage).toFixed(2)}%)</span></span>
      </div>
      </div>
      {breakdown&&<ResourceCostBreakdown month={breakdown} projectCurrency={code} onClose={()=>setBreakdown(null)}/>} 
    </div>
  );
}

function ProjectDescription({description}){
 const [expanded,setExpanded]=useState(false);
 const normalized=String(description||'').replace(/\r\n?/g,'\n').replace(/[\uF0B7\u2022\u25AA\u25CF]/g,'\n• ').replace(/\s*\n\s*/g,'\n').trim();
 const parts=normalized.split('\n').map((part)=>part.trim()).filter(Boolean);
 const intro=[];const bullets=[];
 parts.forEach((part)=>{if(part.startsWith('•'))bullets.push(part.replace(/^•\s*/,''));else if(bullets.length)bullets[bullets.length-1]=`${bullets[bullets.length-1]} ${part}`;else if(intro.length)intro[0]=`${intro[0]} ${part}`;else intro.push(part);});
 const isLong=normalized.length>360||parts.length>3;
 return <Panel title="Project Description"><div className="relative"><div className={`space-y-3 text-sm font-semibold leading-7 text-slate-600 ${!expanded&&isLong?'max-h-32 overflow-hidden':''}`}>{intro.map((paragraph,index)=><p key={`paragraph-${index}`}>{paragraph}</p>)}{!!bullets.length&&<ul className="space-y-2 pl-5">{bullets.map((item,index)=><li key={`bullet-${index}`} className="list-disc pl-1 marker:text-red-500">{item}</li>)}</ul>}</div>{!expanded&&isLong&&<div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent"/>}</div>{isLong&&<button type="button" onClick={()=>setExpanded((value)=>!value)} aria-expanded={expanded} className="mt-4 inline-flex items-center gap-1 rounded-md px-1 py-1 text-sm font-black text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200">{expanded?'Show Less':'Show More'}<ChevronDown className={`h-4 w-4 transition-transform ${expanded?'rotate-180':''}`}/></button>}</Panel>;
}

function ResourceCostBreakdown({month,projectCurrency,onClose}){
 return <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 p-4"><div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-xl font-black">Resource Cost Breakdown</h2><p className="mt-1 text-sm font-semibold text-slate-500">{month.label} • Costs reported in INR • Project currency {projectCurrency}</p></div><button onClick={onClose}><X/></button></div><div className="overflow-x-auto p-5"><table className="min-w-[1050px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr>{['Employee','Monthly Salary','Active From','Active To','Active Days','Proration','Original Cost','FX Rate to INR','Cost (INR)'].map((label)=><th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y">{month.resources.map((item)=><tr key={item.assignmentId}><td className="px-3 py-3 font-black">{item.employeeName}</td><td className="px-3 py-3 font-bold">{money(item.monthlySalary,item.salaryCurrency)}</td><td className="px-3 py-3">{formatDate(item.activeFrom)}</td><td className="px-3 py-3">{formatDate(item.activeTo)}</td><td className="px-3 py-3">{item.activeDays} / {item.daysInMonth}</td><td className="px-3 py-3">{(Number(item.proration)*100).toFixed(2)}%</td><td className="px-3 py-3 font-bold">{money(item.originalCost,item.salaryCurrency)}</td><td className="px-3 py-3">{Number(item.inrExchangeRate).toFixed(6)}</td><td className="px-3 py-3 font-black text-blue-700">{money(item.costInInr,'INR')}</td></tr>)}</tbody></table>{!month.resources.length&&<p className="py-10 text-center font-bold text-slate-500">No team assignments were active during this month.</p>}<div className="mt-4 flex justify-end border-t pt-4 text-base font-black">Total Resource Cost: <span className="ml-3 text-blue-700">{money(month.resourceCostInInr,'INR')}</span></div></div><div className="flex justify-end border-t p-4"><button onClick={onClose} className="h-10 rounded-lg border px-5 font-black">Close</button></div></div></div>;
}

function FinanceRows({ project }) {
  const remaining = Math.max(0, project.contractAmount - project.billedAmount);
  return <div className="space-y-4">{[
    ['Contract Value', money(project.contractAmount,project.currency)],
    ['Total Billed', money(project.billedAmount,project.currency)],
    ['Total Paid', money(project.paidAmount || 0,project.currency), 'text-emerald-600'],
    ['Remaining Amount', money(remaining,project.currency), 'text-red-600'],
    ['Unbilled Milestones', money(remaining,project.currency)],
  ].map(([label, value, color]) => <div key={label} className="flex justify-between border-b border-slate-100 pb-3 text-sm font-black"><span>{label}</span><span className={color}>{value}</span></div>)}</div>;
}

function SimpleTable({ rows }) {
  return <table className="w-full text-left text-xs"><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.join('-')}>{row.map((cell, index) => <td key={`${cell}-${index}`} className={`py-2 font-bold ${index > 0 ? 'text-right' : ''}`}>{cell}</td>)}</tr>)}</tbody></table>;
}

function Legend({ items }) {
  return <div className="space-y-4">{items.map(([label, value, color]) => <div key={label} className="flex items-center justify-between gap-3 text-sm font-bold"><span className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${color}`} />{label}</span><span>{value}</span></div>)}</div>;
}

function ProgressLine({ label, value, meta, color }) {
  return <div><div className="mb-2 flex justify-between text-sm font-black"><span>{label}</span><span>{value} {meta && <span className="ml-4 text-slate-500">{meta}</span>}</span></div><ProgressBar value={parseInt(meta || value, 10) || 63} color={color} /></div>;
}

function ProgressBar({ value, color = 'bg-blue-600' }) {
  return <div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

function ProgressCell({ value }) {
  const number = parseInt(value, 10) || 0;
  return <div className="flex items-center gap-3"><span>{value}</span><div className="h-1.5 w-20 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${number}%` }} /></div></div>;
}

function InfoLine({ label, value, sub }) {
  return <div><p className="text-xs font-black text-slate-500">{label}</p><p className="mt-2 text-sm font-black">{value}</p>{sub && <p className="mt-1 text-xs font-bold text-slate-500">{sub}</p>}</div>;
}

function StatBlock({ label, value, meta }) {
  return <div className="border-l border-slate-200 pl-5"><p className="text-xs font-black text-slate-500">{label}</p><p className="mt-3 text-lg font-black">{value}</p>{meta && <Badge tone="violet">{meta}</Badge>}</div>;
}

function ActionButton({ children, icon: Icon }) {
  return <button className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black shadow-sm">{Icon && <Icon className="h-4 w-4" />}{children}<ChevronDown className="h-4 w-4" /></button>;
}

function DateButton({ children }) {
  return <button className="flex h-10 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black"><CalendarDays className="h-4 w-4" />{children}<ChevronDown className="h-4 w-4" /></button>;
}

function FilterSelect({ children }) {
  return <button className="flex h-10 min-w-36 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black">{children}<ChevronDown className="h-4 w-4" /></button>;
}

function ProjectFilterSelect({ value, onChange, label, options = [] }) {
  return (
    <span className="relative block">
      <select value={value} onChange={(event) => onChange?.(event.target.value)} className="h-10 min-w-40 appearance-none rounded-lg border border-slate-200 bg-white px-4 pr-9 text-sm font-black outline-none focus:border-red-200">
        <option value="">{label}</option>
        {options.map((option) => { const item=typeof option==='string'?{value:option,label:option}:option; return <option key={item.value} value={item.value}>{item.label}</option>; })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
    </span>
  );
}

function SmallSelect({ children }) {
  return <button className="flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-black">{children}<ChevronDown className="h-3 w-3" /></button>;
}

function Badge({ children, tone = 'blue' }) {
  const tones = { blue: 'bg-blue-50 text-blue-600', red: 'bg-red-50 text-red-600', green: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600' };
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

function Tag({ children, tone = 'slate' }) {
  const tones = { slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-50 text-blue-600', green:'bg-emerald-50 text-emerald-700', amber:'bg-amber-50 text-amber-700', red:'bg-red-50 text-red-700' };
  return <span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-black ${tones[tone]||tones.slate}`}>{children}</span>;
}

function Avatar({ name }) {
  return <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 text-xs font-black text-violet-700">{name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>;
}

function CompanyMark({ name }) {
  const styles = {
    IntelliSwift: 'border-violet-200 bg-violet-50 text-violet-600',
    DataMatics: 'border-cyan-200 bg-cyan-50 text-cyan-600',
    'She Works': 'border-orange-200 bg-orange-50 text-orange-600',
    Webvillee: 'border-emerald-200 bg-emerald-50 text-emerald-600',
  };
  const logos = {
    IntelliSwift: 'IS',
    DataMatics: 'DM',
    'She Works': 'SW',
    Webvillee: 'W',
  };
  const tone = styles[name] || 'bg-slate-100 text-slate-600';
  const logo = logos[name] || name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-[10px] font-black shadow-sm ${tone}`}>
      {logo}
    </span>
  );
}

function ProjectLogo({ project }) {
  const Icon = project.icon || FileBox;
  const tones = {
    violet: 'bg-violet-600 text-white',
    green: 'bg-emerald-500 text-white',
    blue: 'bg-blue-500 text-white',
    orange: 'bg-orange-500 text-white',
    pink: 'bg-rose-500 text-white',
    cyan: 'bg-cyan-500 text-white',
  };

  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg shadow-sm ${tones[project.color] || tones.violet}`}>
      <Icon className="h-6 w-6" />
    </span>
  );
}

function IconButton() {
  return <button className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200"><MoreVertical className="h-4 w-4" /></button>;
}
