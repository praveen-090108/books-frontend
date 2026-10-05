import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { recordsApi } from '../../api/recordsApi.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function CustomerList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const queryParams = useMemo(() => ({
    module: 'sales',
    type: 'customers',
    page,
    size: pageSize,
    search,
    status,
    category,
    sort: 'recordDate,desc',
  }), [page, pageSize, search, status, category]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['records', queryParams],
    queryFn: () => recordsApi.list(queryParams),
    keepPreviousData: true,
  });

  const rows = data?.content || [];
  const totalElements = data?.totalElements || 0;
  const totalPages = data?.totalPages || 1;
  const start = totalElements === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(totalElements, page * pageSize + rows.length);

  return (
    <section className="space-y-6 text-[#06134a]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-red-600">Sales</p>
          <h1 className="mt-1 text-3xl font-black">Customers</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">Live customer records from the Sales customers database.</p>
        </div>
        <Link to="/sales/customers/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white shadow-sm shadow-red-200 hover:bg-red-700">
          <Plus className="h-4 w-4" />
          New Customer
        </Link>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_220px_220px]">
        <label className="flex h-11 max-w-xl items-center gap-3 rounded-lg border border-slate-200 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search customers by name, email, phone or code..."
            className="h-full min-w-0 flex-1 text-sm font-semibold outline-none placeholder:text-slate-400"
          />
        </label>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(0);
          }}
          className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold outline-none"
        >
          <option value="">All Customer Groups</option>
          {['Corporate Customers', 'Retail Customers', 'Individual Customers', 'General'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
          className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          {['Active', 'Inactive'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-[24%] px-5 py-4 font-black">Customer</th>
              <th className="w-[14%] px-5 py-4 font-black">Code</th>
              <th className="w-[22%] px-5 py-4 font-black">Email</th>
              <th className="w-[14%] px-5 py-4 font-black">Phone</th>
              <th className="w-[12%] px-5 py-4 font-black">Outstanding</th>
              <th className="w-[8%] px-5 py-4 font-black">Status</th>
              <th className="w-[6%] px-5 py-4 font-black">Group</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td className="px-5 py-8 text-sm font-bold text-slate-500" colSpan={7}>Loading customers...</td>
              </tr>
            )}
            {isError && (
              <tr>
                <td className="px-5 py-8 text-sm font-bold text-red-600" colSpan={7}>Unable to load customers. Please check backend API.</td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-sm font-bold text-slate-500" colSpan={7}>No customers found.</td>
              </tr>
            )}
            {rows.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50/70">
                <td className="px-5 py-4">
                  <p className="truncate font-black">{customer.partyName}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{customer.partyCity || '-'}</p>
                </td>
                <td className="px-5 py-4 font-bold">{customer.recordNumber}</td>
                <td className="truncate px-5 py-4 font-semibold text-slate-600">{customer.partyEmail || '-'}</td>
                <td className="px-5 py-4 font-semibold text-slate-600">{customer.partyPhone || '-'}</td>
                <td className="px-5 py-4 font-black text-red-600">{formatCurrency(customer.balanceAmount || 0)}</td>
                <td className="px-5 py-4"><StatusBadge status={customer.status} /></td>
                <td className="truncate px-5 py-4 font-semibold text-slate-600">{customer.category || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 text-sm md:flex-row md:items-center md:justify-between">
        <p className="font-semibold text-slate-700">Showing {start} to {end} of {totalElements} customers</p>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
          <button disabled={page <= 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="grid h-10 min-w-10 place-items-center rounded-lg border border-slate-200 bg-white px-3 font-bold disabled:opacity-50">‹</button>
          {[1, 2, 3].filter((item) => item <= totalPages).map((item) => (
            <button key={item} onClick={() => setPage(item - 1)} className={`grid h-10 min-w-10 place-items-center rounded-lg border px-3 font-bold ${page + 1 === item ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-white'}`}>{item}</button>
          ))}
          {totalPages > 3 && <span className="px-2 font-bold text-slate-400">...</span>}
          {totalPages > 3 && <button onClick={() => setPage(totalPages - 1)} className="grid h-10 min-w-10 place-items-center rounded-lg border border-slate-200 bg-white px-3 font-bold">{totalPages}</button>}
          <button disabled={page >= totalPages - 1} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} className="grid h-10 min-w-10 place-items-center rounded-lg border border-slate-200 bg-white px-3 font-bold disabled:opacity-50">›</button>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`rounded-md px-3 py-1 text-xs font-black ${status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
      {status || 'Active'}
    </span>
  );
}
