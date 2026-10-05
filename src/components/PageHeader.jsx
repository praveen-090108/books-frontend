export function PageHeader({ eyebrow, title }) {
  return (
    <div>
      {eyebrow && <p className="text-sm font-medium uppercase tracking-wide text-cyan-700">{eyebrow}</p>}
      <h2 className="mt-1 text-3xl font-semibold text-slate-950">{title}</h2>
    </div>
  );
}
