import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { itemCategoriesApi } from '../../api/itemCategoriesApi.js';

const EMPTY = { categoryName: '', description: '', active: true, displayOrder: 0 };

export function ItemCategoryMasterPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['item-category-master', 'all'], queryFn: () => itemCategoriesApi.list(true) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['item-category-master'] });
  const save = useMutation({
    mutationFn: () => editing ? itemCategoriesApi.update(editing.id, form) : itemCategoriesApi.create(form),
    onSuccess: () => { refresh(); setEditing(null); setModalOpen(false); setForm(EMPTY); },
    onError: (e) => setError(e.response?.data?.message || 'Unable to save Item Category.'),
  });
  const remove = useMutation({
    mutationFn: itemCategoriesApi.remove,
    onSuccess: refresh,
    onError: (e) => setError(e.response?.data?.message || 'Unable to remove Item Category.'),
  });
  const open = (category = null) => {
    setEditing(category);
    setModalOpen(true);
    setForm(category ? { categoryName: category.categoryName, description: category.description || '', active: category.active, displayOrder: category.displayOrder || 0 } : { ...EMPTY });
    setError('');
  };

  return <section className="space-y-5 text-[#06134a]">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link to="/settings" className="text-sm font-black">‹ Settings</Link><h1 className="mt-3 text-3xl font-black">Item Category Master</h1><p className="mt-1 text-sm font-semibold text-slate-500">Manage IT service categories used by Items.</p></div><button onClick={() => open()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white"><Plus className="h-4 w-4" /> Add Item Category</button></div>
    {error && !modalOpen && <p className="rounded-lg bg-red-50 p-4 font-bold text-red-700">{error}</p>}
    {query.isError && <p className="rounded-lg bg-red-50 p-4 font-bold text-red-700">Unable to load Item Categories.</p>}
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Category Name','Description','Order','Status','Used By','Actions'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{(query.data || []).map((category) => <tr key={category.id}><td className="px-4 py-3 font-black">{category.categoryName}</td><td className="px-4 py-3 text-slate-600">{category.description || '-'}</td><td className="px-4 py-3">{category.displayOrder || 0}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-black ${category.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{category.active ? 'Active' : 'Inactive'}</span></td><td className="px-4 py-3 font-bold">{category.usageCount} items</td><td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => open(category)} className="grid h-8 w-8 place-items-center rounded border"><Edit3 className="h-4 w-4" /></button><button onClick={() => remove.mutate(category.id)} title={category.usageCount ? 'Inactivate category' : 'Delete category'} className="grid h-8 w-8 place-items-center rounded border border-red-200 text-red-600"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>
    {modalOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 p-4"><form onSubmit={(e) => { e.preventDefault(); if (!form.categoryName.trim()) return setError('Category Name is required.'); save.mutate(); }} className="w-full max-w-lg rounded-xl bg-white shadow-2xl"><div className="flex justify-between border-b p-5"><h2 className="text-xl font-black">{editing ? 'Edit' : 'Add'} Item Category</h2><button type="button" onClick={() => setModalOpen(false)}><X /></button></div><div className="space-y-4 p-5">{error && <p className="rounded bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<label className="block text-sm font-bold">Category Name *<input value={form.categoryName} onChange={(e) => setForm({...form, categoryName:e.target.value})} className="mt-2 h-11 w-full rounded-lg border px-3" /></label><label className="block text-sm font-bold">Description<textarea value={form.description} onChange={(e) => setForm({...form, description:e.target.value})} className="mt-2 min-h-24 w-full rounded-lg border p-3" /></label><label className="block text-sm font-bold">Display Order<input type="number" min="0" value={form.displayOrder} onChange={(e) => setForm({...form, displayOrder:Number(e.target.value)})} className="mt-2 h-11 w-full rounded-lg border px-3" /></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm({...form, active:e.target.checked})} /> Active</label></div><div className="flex justify-end gap-3 border-t p-4"><button type="button" onClick={() => setModalOpen(false)} className="h-10 rounded-lg border px-5 font-black">Cancel</button><button disabled={save.isPending} className="h-10 rounded-lg bg-red-600 px-5 font-black text-white">{save.isPending ? 'Saving...' : 'Save'}</button></div></form></div>}
  </section>;
}
