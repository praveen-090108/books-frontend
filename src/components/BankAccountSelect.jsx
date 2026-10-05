import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bankAccountsApi } from '../api/bankAccountsApi.js';

export function bankAccountLabel(account) {
  const suffix = account.maskedAccountNumber && account.maskedAccountNumber !== '-' ? ` – ${account.maskedAccountNumber}` : '';
  return `${account.accountName}${suffix}${account.currencyCode ? ` (${account.currencyCode})` : ''}`;
}

export function BankAccountSelect({ value, onChange, currency, required = false, error, label = 'Bank Account', includeInactive = false, className = '' }) {
  const query = useQuery({ queryKey: ['bank-account-master', includeInactive ? 'all' : 'active'], queryFn: () => bankAccountsApi.list(includeInactive), staleTime: 60_000 });
  const accounts = useMemo(() => {
    const rows = (query.data || []).filter((account) => account.active || String(account.id) === String(value));
    return [...rows].sort((left, right) => {
      const leftMatch = currency && left.currencyCode === currency ? 0 : 1;
      const rightMatch = currency && right.currencyCode === currency ? 0 : 1;
      return leftMatch - rightMatch || left.accountName.localeCompare(right.accountName);
    });
  }, [query.data, value, currency]);
  return <label className={`block min-w-0 ${className}`}><span className="mb-1.5 block text-xs font-black text-[#06134a]">{label}{required && <b className="ml-1 text-red-600">*</b>}</span><select value={value || ''} onChange={(event) => onChange(event.target.value)} className={`h-10 w-full rounded-lg border bg-white px-3 text-sm font-semibold outline-none ${error ? 'border-red-400' : 'border-slate-200'}`}><option value="">{query.isLoading ? 'Loading bank accounts...' : 'Select bank account'}</option>{accounts.map((account) => <option key={account.id} value={account.id} disabled={!account.active}>{bankAccountLabel(account)}{!account.active ? ' – Inactive' : ''}</option>)}</select>{error && <small className="mt-1 block font-bold text-red-600">{error}</small>}{query.isError && <small className="mt-1 block font-bold text-red-600">Unable to load Bank Account Master.</small>}</label>;
}
