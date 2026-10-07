import { useSyncExternalStore } from 'react';
import { api } from '../../api/client';
import { store } from '../../lib/env';

/**
 * The admin token lives in sessionStorage: it survives reloads in this tab and disappears when the tab closes.
 * The API is on another domain, so a bearer token is used instead of a cookie.
 */
const KEY = 'dk-admin-token';
const listeners = new Set<() => void>();

interface Saved {
  token: string;
  expiresAt: string;
}

function read(): string | null {
  const raw = store('session').get(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Saved;
    if (new Date(s.expiresAt).getTime() <= Date.now()) {
      store('session').remove(KEY);
      return null;
    }
    return s.token;
  } catch {
    return null;
  }
}

let current = typeof window !== 'undefined' ? read() : null;

function emit() {
  current = read();
  listeners.forEach((l) => l());
}

export function useAdminToken() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}

export async function login(email: string, password: string) {
  const res = await api<{ token: string; expiresAt: string }>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  store('session').set(KEY, JSON.stringify(res));
  emit();
}

export function logout() {
  store('session').remove(KEY);
  emit();
}

/** Changes the studio password. The API ends other sessions and returns a fresh token for this one. */
export async function changePassword(token: string, currentPassword: string, newPassword: string) {
  const res = await api<{ token: string; expiresAt: string }>('/api/auth/change-password', {
    method: 'POST',
    token,
    body: { currentPassword, newPassword },
  });
  store('session').set(KEY, JSON.stringify(res));
  emit();
}
