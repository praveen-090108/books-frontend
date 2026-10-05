import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({
  open,
  title = 'Delete record?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#06134a]/60 px-4 py-6">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">{title}</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{message}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={loading} className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black hover:bg-slate-50 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white shadow-sm shadow-red-200 hover:bg-red-700 disabled:opacity-60">
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
