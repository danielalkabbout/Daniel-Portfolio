import { useSyncExternalStore } from 'react';
import { api } from '../../api/client';
import { store } from '../../lib/env';

/**
 * The studio session is an HttpOnly cookie set by the API: page scripts can't read it, so it can't be
 * stolen by injected code. This file only remembers *that* someone is signed in (email and expiry),
 * which is not secret, so the header can show the Studio link without asking the server.
 */
const KEY = 'dk-admin-session';
const listeners = new Set<() => void>();

export interface Session {
  email: string;
  expiresAt: string;
}

function read(): Session | null {
  const raw = store('session').get(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (!s.email || new Date(s.expiresAt).getTime() <= Date.now()) {
      store('session').remove(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

let current = typeof window !== 'undefined' ? read() : null;

function save(s: Session | null) {
  if (s) store('session').set(KEY, JSON.stringify({ email: s.email, expiresAt: s.expiresAt }));
  else store('session').remove(KEY);
  current = read();
  listeners.forEach((l) => l());
}

/** The signed-in session as last confirmed by the API, or null. */
export function useAdminSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}

/** Asks the API whether the session cookie is still valid. */
export async function checkSession(): Promise<Session | null> {
  try {
    const s = await api<Session>('/api/auth/me');
    save(s);
    return s;
  } catch {
    save(null);
    return null;
  }
}

export async function login(email: string, password: string) {
  save(await api<Session>('/api/auth/login', { method: 'POST', body: { email, password } }));
}

/** Forgets the session here at once, and asks the API to delete the cookie. */
export function logout() {
  save(null);
  void api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
}

/** Changes the studio password. The API ends other sessions and gives this one a fresh cookie. */
export async function changePassword(currentPassword: string, newPassword: string) {
  save(
    await api<Session>('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
  );
}
