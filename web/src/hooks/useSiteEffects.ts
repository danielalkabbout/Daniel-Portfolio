import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { finePointer, reduceMotion } from '../lib/env';

const REVEAL = [
  '.head',
  '.proof',
  '.teaser article',
  '.grid .card',
  '.steps li',
  '.sk',
  '.facts > div',
  '.story',
  '.more',
];
const GLOW = '.teaser article, .sk:not(.lead), .facts > div, .choice:not(.primary), .direct a';
const TILT = '.teaser article, .choice';

/** Effects that span the whole site: progress bar, reveal-on-scroll, card spotlight and tilt, button ripple, link handling. */
export function useSiteEffects(contentKey: unknown) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Same-site links inside HTML strings (Echo's answers) navigate without a full reload.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.('a');
      const href = a?.getAttribute('href');
      if (!a || !href || !href.startsWith('/') || href.startsWith('//') || a.target) return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);

  // Scroll progress bar.
  useEffect(() => {
    const prog = document.getElementById('prog');
    if (!prog) return;
    const on = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      prog.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
    };
    on();
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => {
      removeEventListener('scroll', on);
      removeEventListener('resize', on);
    };
  }, [pathname]);

  // Reveal blocks as they scroll into view, and tag cards for the spotlight and tilt.
  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    if (finePointer()) {
      main.querySelectorAll(GLOW).forEach((el) => el.classList.add('glow'));
      main.querySelectorAll(TILT).forEach((el) => el.classList.add('tilt'));
    }
    if (reduceMotion() || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    REVEAL.forEach((sel) =>
      main.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        if (el.closest('.hero') || el.closest('.adm') || el.classList.contains('in')) return;
        const sib = Array.prototype.indexOf.call(el.parentNode!.children, el);
        el.classList.add('rv');
        el.style.setProperty('--d', `${Math.min(sib, 5) * 0.07}s`);
        io.observe(el);
      }),
    );
    return () => io.disconnect();
  }, [pathname, contentKey]);

  // Spotlight that follows the pointer, tilt on hover, ripple on press.
  useEffect(() => {
    const reduce = reduceMotion();
    const move = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.<HTMLElement>('.glow, .tilt');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
      if (el.classList.contains('tilt') && !reduce) {
        const rx = (y / r.height - 0.5) * -7;
        const ry = (x / r.width - 0.5) * 7;
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
        el.classList.add('hot');
      }
    };
    const out = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.<HTMLElement>('.glow, .tilt');
      if (!el || el.contains(e.relatedTarget as Node)) return;
      el.style.transform = '';
      el.classList.remove('hot');
      el.style.setProperty('--mx', '-999px');
    };
    const down = (e: PointerEvent) => {
      const b = (e.target as Element).closest?.<HTMLElement>('.btn, .choice');
      if (!b || reduce) return;
      const r = b.getBoundingClientRect();
      const s = Math.max(r.width, r.height);
      const d = document.createElement('span');
      d.className = 'rip';
      d.style.width = d.style.height = `${s}px`;
      d.style.left = `${e.clientX - r.left - s / 2}px`;
      d.style.top = `${e.clientY - r.top - s / 2}px`;
      b.appendChild(d);
      setTimeout(() => d.remove(), 650);
    };
    if (finePointer()) {
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerout', out);
    }
    document.addEventListener('pointerdown', down);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('pointerdown', down);
    };
  }, []);
}
