import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export function MessageDialog({ open, title = 'Unable to complete action', message, tone = 'error', onClose }) {
  if (!open) return null;
  const success = tone === 'success';
  const Icon = success ? CheckCircle2 : AlertCircle;
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-[#06134a]/60 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="message-dialog-title">
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white text-[#06134a] shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}><Icon className="h-5 w-5" /></span>
          <div><h2 id="message-dialog-title" className="text-lg font-black">{title}</h2><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{message}</p></div>
        </div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex justify-end px-5 py-4"><button type="button" autoFocus onClick={onClose} className={`h-10 rounded-lg px-6 text-sm font-black text-white ${success ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>OK</button></div>
    </div>
  </div>;
}
