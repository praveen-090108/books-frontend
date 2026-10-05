import { create } from 'zustand';

export function normalizeSession(value) {
  const session = value?.state?.user ? value.state : value;
  if (!session?.user || !session?.token) return null;
  // Legacy standalone builds issued unsigned demo tokens. They do not identify
  // a database user and must never be accepted by the secured API.
  if (String(session.token).startsWith('demo-token-')) return null;
  return session;
}
export const normalizeDemoSession = normalizeSession;

function readSavedSession() {
  try {
    const session = normalizeSession(JSON.parse(localStorage.getItem('intelliatech-session') || 'null'));
    if (!session) localStorage.removeItem('intelliatech-session');
    return session;
  }
  catch { localStorage.removeItem('intelliatech-session'); return null; }
}
const saved = readSavedSession();
export const useAuthStore = create((set) => ({
  token: saved?.token || null,
  user: saved?.user || null,
  setSession: (session) => {
    const normalized = normalizeSession(session);
    if (!normalized) { localStorage.removeItem('intelliatech-session'); set({ token: null, user: null }); return; }
    localStorage.setItem('intelliatech-session', JSON.stringify(normalized)); set(normalized);
  },
  repairSession: () => normalizeSession(useAuthStore.getState()),
  clearSession: () => { localStorage.removeItem('intelliatech-session'); set({ token: null, user: null }); },
}));
