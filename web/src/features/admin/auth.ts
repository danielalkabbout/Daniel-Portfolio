import { useSyncExternalStore } from 'react';
import { api, ApiError } from '../../api/client';
import { store } from '../../lib/env';
import { loginId, prove, register, type Challenge } from './srp';

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

const challenge = async (email: string) =>
  api<Challenge>('/api/auth/challenge', { method: 'POST', body: { id: await loginId(email) } });

/**
 * Signs in with SRP: the request carries a fingerprint of the email and a one-time proof, never the
 * email or the password. The server's own proof (m2) is checked too, so a fake server can't pretend.
 */
export async function login(email: string, password: string) {
  const c = await challenge(email);
  const p = await prove(email, password, c);
  const res = await api<Session & { m2: string }>('/api/auth/login', {
    method: 'POST',
    body: { challengeId: c.challengeId, a: p.a, m1: p.m1 },
  });
  if (res.m2 !== p.m2) throw new ApiError(0, 'The server could not prove who it is. Sign-in stopped.');
  save({ email: res.email, expiresAt: res.expiresAt });
}

/** Forgets the session here at once, and asks the API to delete the cookie. */
export function logout() {
  save(null);
  void api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
}

/**
 * Changes the studio password. The current one is proved with SRP and the new one becomes a salt and
 * verifier here in the browser, so neither password is sent. The API ends other sessions and gives this
 * one a fresh cookie.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  const email = current?.email ?? (await checkSession())?.email;
  if (!email) throw new ApiError(401, 'Your session ended. Sign in again.');
  const c = await challenge(email);
  const [p, next] = await Promise.all([prove(email, currentPassword, c), register(email, newPassword, c.iterations)]);
  save(
    await api<Session>('/api/auth/change-password', {
      method: 'POST',
      body: { challengeId: c.challengeId, a: p.a, m1: p.m1, salt: next.salt, verifier: next.verifier },
    }),
  );
}
