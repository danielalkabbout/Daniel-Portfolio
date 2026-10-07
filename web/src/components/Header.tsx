import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { reduceMotion } from '../lib/env';
import { useAdminToken } from '../features/admin/auth';

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

export function Header({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const token = useAdminToken();
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

  // Close the mobile menu after navigating.
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
    <header className={scrolled ? 'bar scrolled' : 'bar'} id="bar">
      <div className="wrap">
        <SignatureLogo />
        <nav aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
          {token && (
            <NavLink to="/admin" className="nav-admin">
              <LockIcon />
              <span>Studio</span>
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
          <button className="theme" type="button" aria-label="Switch light or dark theme" onClick={toggleTheme}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
          <button
            className="menu-btn"
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mnav"
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </nav>
      </div>
      <div className="mobile-nav" id="mnav" hidden={!open}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            {n.label}
          </NavLink>
        ))}
        {token && <NavLink to="/admin">Studio</NavLink>}
      </div>
    </header>
  );
}
