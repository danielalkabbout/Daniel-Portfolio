import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Link, NavLink, useLocation } from 'react-router';
import { reduceMotion } from '../lib/env';
import { useAdminSession } from '../features/admin/auth';
import { useSite } from '../api/content';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/experience', label: 'Experience' },
  { to: '/projects', label: 'Projects' },
  { to: '/services', label: 'Services' },
];

export function toggleTheme() {
  const root = document.documentElement;
  const cur =
    root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const next = cur === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* storage blocked */
  }
}

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/** The signature logo: written out once fonts load, and again on hover. */
function SignatureLogo() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const l = ref.current;
    if (!l || reduceMotion()) return;
    const play = () => {
      l.classList.remove('write');
      void l.offsetWidth;
      l.classList.add('write');
    };
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        play();
      }
    };
    document.fonts?.load('2rem "Herr Von Muellerhoff"').then(go, go);
    const fallback = setTimeout(go, 2500);
    let last = 0;
    const onEnter = () => {
      const n = Date.now();
      if (n - last > 2200) {
        last = n;
        play();
      }
    };
    l.addEventListener('mouseenter', onEnter);
    return () => {
      clearTimeout(fallback);
      l.removeEventListener('mouseenter', onEnter);
    };
  }, []);
  return (
    <Link ref={ref} className="logo sig" to="/" aria-label="Daniel Al Kabbout, home">
      <span className="sig-wrap">
        <span className="sig-text" aria-hidden="true">
          Daniel Al Kabbout
        </span>
        <svg className="sig-line" viewBox="0 0 220 20" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="sgl" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="220" y2="0">
              <stop offset="0" stopColor="var(--sky)" />
              <stop offset="1" stopColor="var(--mint)" />
            </linearGradient>
          </defs>
          <path d="M6 13C48 17 118 5 214 6C176 9 150 12 132 16" pathLength={100} />
        </svg>
      </span>
    </Link>
  );
}

const HINTS: Record<string, string> = {
  '/': 'Echo, highlights and what I build',
  '/about': 'Background, skills and education',
  '/experience': 'Every role, with what I delivered',
  '/projects': 'Live demos you can try',
  '/services': 'Hire me for a project',
  '/cv': 'Read it here or download the PDF',
};

/** Desktop links sit in a track; a pill glides to the link you point at, and rests on the current page. */
function NavTrack() {
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  const place = useCallback((el: HTMLElement | null) => {
    const nav = ref.current;
    if (!nav) return;
    if (!el) {
      nav.style.setProperty('--glide-o', '0');
      return;
    }
    nav.style.setProperty('--glide-x', `${el.offsetLeft}px`);
    nav.style.setProperty('--glide-w', `${el.offsetWidth}px`);
    nav.style.setProperty('--glide-o', '1');
  }, []);
  const rest = useCallback(
    () => place(ref.current?.querySelector<HTMLElement>('a[aria-current="page"]') ?? null),
    [place],
  );

  useEffect(() => {
    rest();
    // Re-measure once the web fonts have loaded, since link widths change.
    document.fonts?.ready.then(rest, () => undefined);
    addEventListener('resize', rest);
    return () => removeEventListener('resize', rest);
  }, [pathname, rest]);

  return (
    <nav className="nav-track" aria-label="Main" ref={ref} onMouseLeave={rest} onBlur={rest}>
      <span className="nav-glide" aria-hidden="true" />
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onMouseEnter={(e) => place(e.currentTarget)}
          onFocus={(e) => place(e.currentTarget)}
        >
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Full-screen menu for phones and tablets. */
function MobileMenu({ open, close }: { open: boolean; close: () => void }) {
  const site = useSite();
  const p = site.profile;
  const signedIn = Boolean(useAdminSession());
  const ref = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.dataset.theme : 'dark',
  );

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('menu-open');
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true }), 80);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      // Keep Tab inside the menu and its button.
      if (e.key === 'Tab' && ref.current) {
        const items = [
          document.querySelector<HTMLElement>('.menu-btn'),
          ...ref.current.querySelectorAll<HTMLElement>('a, button'),
        ].filter(Boolean) as HTMLElement[];
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (!e.shiftKey && i === items.length - 1) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    const wide = () => innerWidth > 1000 && close();
    addEventListener('keydown', key);
    addEventListener('resize', wide);
    return () => {
      clearTimeout(t);
      document.body.classList.remove('menu-open');
      removeEventListener('keydown', key);
      removeEventListener('resize', wide);
    };
  }, [open, close]);

  const links = [...NAV, { to: '/cv', label: 'CV', end: false }];
  return (
    <div className={open ? 'mnav on' : 'mnav'} id="mnav" ref={ref} aria-hidden={!open} inert={!open}>
      <nav aria-label="Menu" className="mnav-links">
        {links.map((n, i) => (
          <NavLink key={n.to} to={n.to} end={n.end} style={{ '--i': i } as React.CSSProperties} onClick={close}>
            <b>{n.label}</b>
            <span>{HINTS[n.to]}</span>
          </NavLink>
        ))}
        {signedIn && (
          <NavLink
            to="/admin"
            className="mnav-studio"
            style={{ '--i': links.length } as React.CSSProperties}
            onClick={close}
          >
            <b>
              <LockIcon /> Studio
            </b>
            <span>Edit your content</span>
          </NavLink>
        )}
      </nav>
      <div className="mnav-foot">
        <p className="mnav-status">
          <i aria-hidden="true" />
          {p.status}
        </p>
        <div className="mnav-actions">
          <a href={`mailto:${p.email}`}>Email me</a>
          <a href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noopener">
            WhatsApp
          </a>
          <button
            type="button"
            onClick={() => {
              toggleTheme();
              setTheme(document.documentElement.dataset.theme);
            }}
          >
            {theme === 'light' ? 'Dark theme' : 'Light theme'}
          </button>
        </div>
      </div>
    </div>
  );
}

const CvIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5" />
  </svg>
);

export function Header({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const signedIn = Boolean(useAdminSession());
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const close = useCallback(() => setOpen(false), []);

  // Close the menu after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <header className={clsx('bar', scrolled && 'scrolled', open && 'menu-on')} id="bar">
      <div className="wrap">
        <SignatureLogo />
        <NavTrack />
        <div className="bar-tools">
          {signedIn && (
            <NavLink to="/admin" className="bar-ico bar-studio" aria-label="Content studio" title="Content studio">
              <LockIcon />
            </NavLink>
          )}
          <button
            className="cmd-btn"
            type="button"
            aria-label="Open quick search"
            aria-haspopup="dialog"
            onClick={onOpenPalette}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <span>Search</span>
            <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <button className="theme bar-ico" type="button" aria-label="Switch light or dark theme" onClick={toggleTheme}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
          <NavLink to="/cv" className="bar-cv">
            <CvIcon />
            <span>CV</span>
          </NavLink>
          <button
            className="menu-btn"
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mnav"
            onClick={() => setOpen((o) => !o)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
      <MobileMenu open={open} close={close} />
    </header>
  );
}
