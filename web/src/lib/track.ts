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

const optedOut = (): boolean =>
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

type Kind = 'view' | 'cv' | 'time' | 'ping';

const counted = (path: string) =>
  API_ENABLED && !isPreview && !optedOut() && !isAutomated() && !path.startsWith('/admin');

/** Browsers driven by scripts (Selenium, Puppeteer, Playwright…) say so; they're not people. */
const isAutomated = () => typeof navigator !== 'undefined' && navigator.webdriver === true;

function send(kind: Kind, path: string, extra: { seconds?: number; leaving?: boolean } = {}) {
  if (!counted(path)) return;
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
      ...extra,
    },
    timeoutMs: 8000,
    keepalive: true,
  }).catch(() => {});
}

export function track(kind: 'view' | 'cv', path = window.location.pathname) {
  send(kind, path);
}

/**
 * The timer for each visit. It only runs while the tab is visible and the visitor is active (no input for
 * 3 minutes counts as away), so a tab left open overnight doesn't count as hours on the site. The time on
 * a page is sent when the visitor opens another page, switches away or closes the tab; a small heartbeat
 * every 30 seconds lets the studio show who is on the site right now.
 */
const IDLE_MS = 3 * 60_000;
const HEARTBEAT_MS = 30_000;
const timer = {
  path: '',
  ms: 0,
  since: null as number | null,
  lastInput: Date.now(),
  idle: false,
  started: false,
  /** Already told the server this visit ended (so closing after switching away doesn't say it twice). */
  ended: false,
};
const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

function pause(until = Date.now()) {
  if (timer.since !== null) timer.ms += Math.max(0, until - timer.since);
  timer.since = null;
}
function resume() {
  if (timer.since === null && timer.path && visible() && !timer.idle) timer.since = Date.now();
}
/** Sends the time spent on the current page so far and starts counting again from zero. */
function flush(leaving: boolean) {
  pause();
  const seconds = Math.round(timer.ms / 1000);
  timer.ms = 0;
  if (timer.path && (seconds >= 1 || (leaving && !timer.ended))) send('time', timer.path, { seconds, leaving });
  timer.ended = leaving;
  if (!leaving) resume();
}

function startTimer() {
  if (timer.started || typeof window === 'undefined') return;
  timer.started = true;
  const onInput = () => {
    timer.lastInput = Date.now();
    if (timer.idle) {
      timer.idle = false;
      resume();
      if (timer.path) send('ping', timer.path);
    }
  };
  for (const e of ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'])
    window.addEventListener(e, onInput, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (visible()) {
      timer.lastInput = Date.now();
      timer.idle = false;
      resume();
      if (timer.path) send('ping', timer.path);
    } else flush(true);
  });
  // Closing the tab or leaving the site (pagehide is the one mobile browsers fire reliably).
  window.addEventListener('pagehide', () => flush(true));
  window.setInterval(() => {
    if (!visible() || !timer.path) return;
    if (!timer.idle && Date.now() - timer.lastInput > IDLE_MS) {
      // Count up to the last sign of life plus a short grace, then stop: they've walked away.
      pause(timer.lastInput + 30_000);
      timer.idle = true;
      flush(true);
      return;
    }
    if (!timer.idle) send('ping', timer.path);
  }, HEARTBEAT_MS);
}

/** Counts a page view each time the route changes, and times how long each page is looked at. */
export function usePageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    startTimer();
    // Time on the page they're leaving, then the new page.
    flush(false);
    timer.path = counted(pathname) ? pathname : '';
    timer.lastInput = Date.now();
    timer.idle = false;
    track('view', pathname);
    resume();
  }, [pathname]);
}
