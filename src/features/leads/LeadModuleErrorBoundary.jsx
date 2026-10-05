import React from 'react';

export class LeadModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Lead Management] Rendering failed', error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-[70vh] place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">!</div>
          <h1 className="mt-5 text-xl font-black text-slate-950">IntelliaTech Books could not load this screen</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your data has not been changed. Reload this page, or return to the Dashboard.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white" href="/dashboard">
              Dashboard
            </a>
          </div>
        </section>
      </main>
    );
  }
}
