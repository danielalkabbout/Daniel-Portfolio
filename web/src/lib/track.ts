import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { api, API_ENABLED } from '../api/client';
import { isPreview } from '../api/content';
import { store } from './env';

/**
 * Anonymous visit counting for the studio's Visitors tab. No cookies: the server only learns the page,
 * where the visit came from, the country, the kind of device and, when the visitor arrived through one of
 * Daniel's personal links (?r=code), that link's code, kept for the tab so later pages count too. A random
 * id that lives only as long as the tab groups one visit's pages, and the time zone gives the country.
 * Skipped when the browser asks not to be tracked, in studio previews, and (server side) for the
 * signed-in studio owner.
 */
/** Set on Daniel's own devices (on studio sign-in, or with the switch in the Visitors tab), so they're never counted. */
export const OWN_DEVICE_KEY = 'dk-own-device';
export const isOwnDevice = () => store('local').get(OWN_DEVICE_KEY) === '1';
export const setOwnDevice = (on: boolean) =>
  on ? store('local').set(OWN_DEVICE_KEY, '1') : store('local').remove(OWN_DEVICE_KEY);

const optedOut = () =>
  isOwnDevice() ||
  (typeof navigator !== 'undefined' &&
    (navigator.doNotTrack === '1' || (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true));

const REF_KEY = 'dk-ref';
/** The personal-link code from the landing address, kept for this tab, and removed from the address bar. */
const linkCode = (() => {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  const r = url.searchParams.get('r');
  if (r && /^[a-z0-9]{4,12}$/i.test(r)) {
    store('session').set(REF_KEY, r.toLowerCase());
    url.searchParams.delete('r');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  return store('session').get(REF_KEY) ?? '';
})();

const LANDING_KEY = 'dk-landing';
interface Landing {
  /** Random id for this tab, so one visit's pages are grouped together. Never kept beyond the tab. */
  session: string;
  /** Where the visitor came from when they landed, reused for every page they open in this tab. */
  referrer: string;
  utm: string;
}

/** Read once per tab, on the page the visitor landed on. */
const landing: Landing = (() => {
  const empty = { session: '', referrer: '', utm: '' };
  if (typeof window === 'undefined') return empty;
  try {
    const saved = store('session').get(LANDING_KEY);
    if (saved) {
      const v = JSON.parse(saved) as Landing;
      if (typeof v.session === 'string' && typeof v.referrer === 'string' && typeof v.utm === 'string') return v;
    }
  } catch {
    /* start a new one */
  }
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const url = new URL(window.location.href);
  const v: Landing = {
    session: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
    referrer: document.referrer.slice(0, 500),
    utm: (url.searchParams.get('utm_source') ?? '').slice(0, 40),
  };
  store('session').set(LANDING_KEY, JSON.stringify(v));
  return v;
})();

/** The device's time zone (e.g. Asia/Beirut). It gives the real country even behind a VPN or Private Relay. */
const timeZone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
})();

export function track(kind: 'view' | 'cv', path = window.location.pathname) {
  if (!API_ENABLED || isPreview || optedOut() || path.startsWith('/admin')) return;
  api('/api/track', {
    method: 'POST',
    body: {
      kind,
      path,
      referrer: landing.referrer,
      ref: linkCode,
      utm: landing.utm,
      tz: timeZone,
      session: landing.session,
    },
    timeoutMs: 8000,
    keepalive: true,
  }).catch(() => {});
}

/** Counts a page view each time the route changes. */
export function usePageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    track('view', pathname);
  }, [pathname]);
}
