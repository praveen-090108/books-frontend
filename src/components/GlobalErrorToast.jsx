import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function GlobalErrorToast() {
  const [error, setError] = useState(null);
  useEffect(() => {
    let timer;
    const show = (event) => {
      setError(event.detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setError(null), 9000);
    };
    window.addEventListener('app:api-error', show);
    return () => { window.clearTimeout(timer); window.removeEventListener('app:api-error', show); };
  }, []);
  if (!error) return null;
  return (
    <aside role="alert" aria-live="assertive" className="fixed right-5 top-5 z-[10000] w-[min(430px,calc(100vw-2.5rem))] rounded-xl border border-red-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-950">Request could not be completed</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{error.message}</p>
          {error.traceId && <p className="mt-2 text-xs text-slate-400">Reference: {error.traceId}</p>}
        </div>
        <button type="button" aria-label="Dismiss error" onClick={() => setError(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
      </div>
    </aside>
  );
}
