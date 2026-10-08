import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { smooth } from '../lib/env';

/** Floating button in the corner: appears once you scroll down, and its ring shows how far you are. */
export function BackToTop() {
  const ref = useRef<HTMLButtonElement>(null);
  const [show, setShow] = useState(false);
  const { pathname } = useLocation();
  const hidden = pathname.startsWith('/admin');

  useEffect(() => {
    if (hidden) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const h = document.documentElement.scrollHeight - innerHeight;
      ref.current?.style.setProperty('--sp2', h > 0 ? (scrollY / h).toFixed(3) : '0');
      setShow(scrollY > Math.min(600, innerHeight * 0.8));
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', on);
      removeEventListener('resize', on);
    };
  }, [hidden, pathname]);

  if (hidden) return null;
  return (
    <button
      ref={ref}
      className={show ? 'to-top on' : 'to-top'}
      type="button"
      aria-label="Back to top"
      title="Back to top"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      onClick={() => {
        window.scrollTo({ top: 0, behavior: smooth() });
        document.getElementById('main')?.focus({ preventScroll: true });
      }}
    >
      <svg className="ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="20" pathLength={100} />
        <circle className="pr" cx="22" cy="22" r="20" pathLength={100} />
      </svg>
      <svg
        className="ar"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
    </button>
  );
}
