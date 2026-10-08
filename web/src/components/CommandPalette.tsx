import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router';
import { useSite } from '../api/content';
import { copyText, smooth, store } from '../lib/env';
import { useToast } from './Toast';
import { toggleTheme } from './Header';

interface Cmd {
  t: string;
  s: string;
  run: () => void;
}

function scrollToId(navigate: NavigateFunction, path: string, id: string, focus?: string) {
  navigate(path);
  setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: smooth() });
    if (focus) (document.getElementById(focus) as HTMLInputElement | null)?.focus({ preventScroll: true });
  }, 150);
}

/** Ctrl/Cmd + K quick search over pages and actions. */
export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const site = useSite();
  const navigate = useNavigate();
  const say = useToast();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const p = site.profile;

  const cmds = useMemo<Cmd[]>(() => {
    const ext = (url: string) => () => {
      if (url.startsWith('mailto:')) window.location.href = url;
      else window.open(url, '_blank', 'noopener');
    };
    return [
      { t: 'Home', s: 'Page', run: () => navigate('/') },
      { t: 'About me', s: 'Page', run: () => navigate('/about') },
      { t: 'Experience', s: 'Page', run: () => navigate('/experience') },
      { t: 'Projects', s: 'Page', run: () => navigate('/projects') },
      { t: 'Services', s: 'Page', run: () => navigate('/services') },
      { t: 'Download my CV', s: 'Page', run: () => navigate('/cv') },
      { t: 'Request a service', s: 'Form', run: () => scrollToId(navigate, '/services', 'request') },
      { t: 'Search my skills', s: 'About', run: () => scrollToId(navigate, '/about', 'skills', 'skillQ') },
      {
        t: 'Copy email address',
        s: 'Action',
        run: () => void copyText(p.email).then((ok) => say(ok ? 'Email copied' : p.email)),
      },
      { t: 'Message me on WhatsApp', s: 'Link', run: ext(`https://wa.me/${p.whatsapp}`) },
      { t: 'Send an email', s: 'Link', run: ext(`mailto:${p.email}`) },
      { t: 'Open GitHub', s: 'Link', run: ext(p.github) },
      { t: 'Open LinkedIn', s: 'Link', run: ext(p.linkedin) },
      { t: 'Switch light or dark theme', s: 'Action', run: toggleTheme },
      {
        t: 'Replay the intro',
        s: 'Action',
        run: () => {
          store('session').remove('dk-intro');
          window.location.href = '/';
        },
      },
    ];
  }, [navigate, p, say]);

  const shown = cmds.filter((c) => !q.trim() || `${c.t} ${c.s}`.toLowerCase().includes(q.trim().toLowerCase()));
  const cur = sel < shown.length ? sel : 0;

  // Start fresh each time the palette opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQ('');
      setSel(0);
    }
  }

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (opener.current instanceof HTMLElement) {
      opener.current.focus();
      opener.current = null;
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  useEffect(() => {
    document.getElementById(`po${cur}`)?.scrollIntoView({ block: 'nearest' });
  }, [cur, open]);

  const run = (c: Cmd) => {
    setOpen(false);
    c.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = Math.max(shown.length, 1);
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((cur + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((cur - 1 + n) % n);
    } else if (e.key === 'Enter' && shown[cur]) {
      e.preventDefault();
      run(shown[cur]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="pal-back"
      hidden={!open}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      onKeyDown={onKeyDown}
    >
      <div className="pal" role="dialog" aria-modal="true" aria-label="Quick search">
        <div className="pal-in">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            placeholder="Go to a page or take an action"
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls="palList"
            aria-activedescendant={shown.length ? `po${cur}` : undefined}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="palList" role="listbox">
          {shown.length ? (
            shown.map((c, i) => (
              <li
                key={c.t}
                role="option"
                id={`po${i}`}
                aria-selected={i === cur}
                onClick={() => run(c)}
                onMouseMove={() => i !== cur && setSel(i)}
              >
                <span>{c.t}</span>
                <small>{c.s}</small>
              </li>
            ))
          ) : (
            <li className="empty">Nothing matches. Try "projects" or "email".</li>
          )}
        </ul>
      </div>
    </div>
  );
}
