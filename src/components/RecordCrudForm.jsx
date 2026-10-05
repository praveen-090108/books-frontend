import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, Save } from 'lucide-react';
import { recordsApi } from '../api/recordsApi.js';
import { makeRecordPayload } from '../utils/records.js';

const statusOptions = {
  customers: ['Active', 'Inactive'],
  vendors: ['Active', 'Inactive'],
  quotes: ['Open', 'Accepted', 'Expired', 'Declined'],
  orders: ['Draft', 'Confirmed', 'Pending Approval', 'Shipped', 'Delivered', 'Cancelled'],
  invoices: ['Draft', 'Due Soon', 'Overdue', 'Paid'],
  creditNotes: ['Unused', 'Used', 'Refunded', 'Expired'],
  payments: ['Deposited', 'Success', 'Pending'],
  challans: ['Pending', 'Dispatched', 'Delivered', 'Cancelled'],
  bills: ['Due', 'Paid', 'Overdue', 'Partial'],
  expenses: ['Paid', 'Pending'],
  items: ['In Stock', 'Low Stock', 'Out of Stock'],
};

const paymentModes = ['', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Cash', 'NEFT'];

export function RecordCrudForm({ module, type, title, subtitle, backTo, mode = 'create' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(() => makeRecordPayload({ module, type, titlePrefix: title }));
  const [errors, setErrors] = useState({});

  const recordQuery = useQuery({
    queryKey: ['record', module, type, id],
    queryFn: () => recordsApi.get({ module, type, id }),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    if (recordQuery.data) {
      setForm(toForm(recordQuery.data));
    }
  }, [recordQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit
      ? recordsApi.update({ module, type, id, payload })
      : recordsApi.create({ module, type, payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      navigate(backTo, {
        replace: true,
        state: { message: `${title.replace(/^Create |^Add |^Edit /, '')} ${isEdit ? 'updated' : 'created'} successfully.` },
      });
    },
  });

  const statuses = useMemo(() => statusOptions[type] || ['Draft', 'Active', 'Inactive'], [type]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    saveMutation.mutate({
      ...form,
      amount: Number(form.amount || 0),
      balanceAmount: Number(form.balanceAmount || 0),
    });
  };

  if (recordQuery.isLoading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-bold text-[#06134a]">Loading record...</div>;
  }

  return (
    <form onSubmit={submit} className="space-y-6 pb-8 text-[#06134a]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link to={backTo} className="text-sm font-black text-[#06134a]">← Back</Link>
          <h1 className="mt-4 text-3xl font-black">{isEdit ? title.replace(/^Create |^Add /, 'Edit ') : title}</h1>
          <p className="mt-2 text-base font-semibold">{subtitle}</p>
        </div>
        <div className="flex gap-3">
          <Link to={backTo} className="grid h-11 min-w-28 place-items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold">Cancel</Link>
          <button disabled={saveMutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-red-600 px-6 text-sm font-black text-white disabled:opacity-60">
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {saveMutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
          Unable to save. Please check required values and backend connection.
        </div>
      )}
      {recordQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
          Unable to load existing record.
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Primary Details</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CrudInput label="Record Number" value={form.recordNumber} error={errors.recordNumber} onChange={(value) => update('recordNumber', value)} required />
          <CrudInput label={module === 'sales' ? 'Customer / Party Name' : 'Vendor / Party Name'} value={form.partyName} error={errors.partyName} onChange={(value) => update('partyName', value)} required />
          <CrudInput label="Email" type="email" value={form.partyEmail} onChange={(value) => update('partyEmail', value)} />
          <CrudInput label="Phone" value={form.partyPhone} onChange={(value) => update('partyPhone', value)} />
          <CrudInput label="City / Location" value={form.partyCity} onChange={(value) => update('partyCity', value)} />
          <CrudInput label="Category / Group" value={form.category} onChange={(value) => update('category', value)} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Transaction Details</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CrudSelect label="Status" value={form.status} options={statuses} onChange={(value) => update('status', value)} required />
          <CrudInput label="Secondary Status" value={form.secondaryStatus} onChange={(value) => update('secondaryStatus', value)} />
          <CrudInput label="Amount" type="number" value={form.amount} error={errors.amount} onChange={(value) => update('amount', value)} required />
          <CrudInput label="Balance Amount" type="number" value={form.balanceAmount} onChange={(value) => update('balanceAmount', value)} />
          <CrudInput label="Record Date" type="date" value={form.recordDate} error={errors.recordDate} onChange={(value) => update('recordDate', value)} required icon={CalendarDays} />
          <CrudInput label="Due Date" type="date" value={form.dueDate} onChange={(value) => update('dueDate', value)} icon={CalendarDays} />
          <CrudInput label="Reference Number" value={form.referenceNumber} onChange={(value) => update('referenceNumber', value)} />
          <CrudSelect label="Payment Mode" value={form.paymentMode} options={paymentModes} onChange={(value) => update('paymentMode', value)} />
          <CrudInput label="Owner / Sales Person" value={form.ownerName} onChange={(value) => update('ownerName', value)} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Notes</h2>
        <textarea
          value={form.notes || ''}
          onChange={(event) => update('notes', event.target.value)}
          className="mt-4 h-32 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-red-300"
          placeholder="Enter notes"
        />
      </section>

      <div className="sticky bottom-0 z-10 flex justify-end gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <Link to={backTo} className="grid h-11 min-w-28 place-items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold">Cancel</Link>
        <button disabled={saveMutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-red-600 px-7 text-sm font-black text-white disabled:opacity-60">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Record' : 'Save Record'}
        </button>
      </div>
    </form>
  );
}

function CrudInput({ label, value, onChange, error, required = false, type = 'text', icon: Icon }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-[#06134a]">{label}{required && <b className="text-red-600"> *</b>}</span>
      <span className={`flex h-11 items-center rounded-lg border bg-white ${error ? 'border-red-300' : 'border-slate-200 focus-within:border-red-300'}`}>
        <input
          type={type}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          className="h-full min-w-0 flex-1 rounded-lg px-3 text-sm font-semibold outline-none placeholder:text-slate-400"
        />
        {Icon && <Icon className="mr-3 h-4 w-4 text-slate-500" />}
      </span>
      {error && <span className="mt-1 block text-xs font-bold text-red-600">{error}</span>}
    </label>
  );
}

function CrudSelect({ label, value, options, onChange, required = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-[#06134a]">{label}{required && <b className="text-red-600"> *</b>}</span>
      <span className="flex h-11 items-center rounded-lg border border-slate-200 bg-white focus-within:border-red-300">
        <select value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-full min-w-0 flex-1 appearance-none rounded-lg px-3 text-sm font-semibold outline-none">
          {options.map((option) => <option key={option || 'blank'} value={option}>{option || 'Select'}</option>)}
        </select>
        <ChevronDown className="mr-3 h-4 w-4 text-slate-500" />
      </span>
    </label>
  );
}

function validate(form) {
  const errors = {};
  if (!String(form.recordNumber || '').trim()) errors.recordNumber = 'Record number is required.';
  if (!String(form.partyName || '').trim()) errors.partyName = 'Name is required.';
  if (!String(form.recordDate || '').trim()) errors.recordDate = 'Record date is required.';
  if (Number.isNaN(Number(form.amount)) || Number(form.amount) < 0) errors.amount = 'Amount must be zero or more.';
  return errors;
}

function toForm(record) {
  return {
    recordNumber: record.recordNumber || '',
    partyName: record.partyName || '',
    partyEmail: record.partyEmail || '',
    partyPhone: record.partyPhone || '',
    partyCity: record.partyCity || '',
    category: record.category || '',
    status: record.status || '',
    secondaryStatus: record.secondaryStatus || '',
    amount: record.amount ?? 0,
    balanceAmount: record.balanceAmount ?? 0,
    recordDate: record.recordDate || '',
    dueDate: record.dueDate || '',
    referenceNumber: record.referenceNumber || '',
    paymentMode: record.paymentMode || '',
    ownerName: record.ownerName || '',
    notes: record.notes || '',
  };
}
