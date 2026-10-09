import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { api, API_ENABLED } from '../api/client';
import { isPreview } from '../api/content';

/**
 * Anonymous visit counting for the studio's Visitors tab. No cookies and nothing stored in the browser:
 * the server only learns the page, where the visit came from, the country and the kind of device.
 * Skipped when the browser asks not to be tracked, in studio previews, and (server side) for the
 * signed-in studio owner.
 */
const optedOut = () =>
  typeof navigator !== 'undefined' &&
  (navigator.doNotTrack === '1' || (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

let firstView = true;

export function track(kind: 'view' | 'cv', path = window.location.pathname) {
  if (!API_ENABLED || isPreview || optedOut() || path.startsWith('/admin')) return;
  // The referrer only means something for the page the visitor landed on.
  const referrer = firstView ? document.referrer : '';
  if (kind === 'view') firstView = false;
  api('/api/track', { method: 'POST', body: { kind, path, referrer }, timeoutMs: 8000, keepalive: true }).catch(
    () => {},
  );
}

/** Counts a page view each time the route changes. */
export function usePageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    track('view', pathname);
  }, [pathname]);
}
