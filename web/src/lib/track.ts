import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { api, API_ENABLED } from '../api/client';
import { isPreview } from '../api/content';
import { store } from './env';

/**
 * Anonymous visit counting for the studio's Visitors tab. No cookies: the server only learns the page,
 * where the visit came from, the country, the kind of device and, when the visitor arrived through one of
 * Daniel's personal links (?r=code), that link's code, kept for the tab so later pages count too.
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

let firstView = true;

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

export function track(kind: 'view' | 'cv', path = window.location.pathname) {
  if (!API_ENABLED || isPreview || optedOut() || path.startsWith('/admin')) return;
  // The referrer only means something for the page the visitor landed on.
  const referrer = firstView ? document.referrer : '';
  if (kind === 'view') firstView = false;
  api('/api/track', {
    method: 'POST',
    body: { kind, path, referrer, ref: linkCode },
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
