import React from 'react';

export class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) console.error('[UI rendering failed]', error, errorInfo);
    else console.error('[UI rendering failed]', { name: error?.name, message: error?.message });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl font-black text-red-600">!</div>
          <h1 className="mt-5 text-xl font-black text-slate-950">Something went wrong</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">We couldn't load this section. Your saved data has not been changed. Please try again.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold" onClick={() => window.location.reload()}>Try again</button>
            <a className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white" href="/dashboard">Go to Dashboard</a>
          </div>
        </section>
      </main>
    );
  }
}
