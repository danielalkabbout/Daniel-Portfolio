import { useEffect, useMemo, useRef, useState } from 'react';
import { useSite } from '../../api/content';
import { coarsePointer, reduceMotion, store } from '../../lib/env';
import '../../styles/intro.css';

const SEEN = 'dk-intro';
const P =
  '<span class="t-pr">guest@daniel</span><span class="t-mu">:</span><span class="t-pa">~</span><span class="t-mu">$</span> ';
const CUR = '<span class="cur"></span>';

/** Terminal boot screen shown once per browser tab. Any key, click or tap skips it. */
export function Intro() {
  const site = useSite();
  const [show] = useState(
    () =>
      typeof window !== 'undefined' && store('session').get(SEEN) !== '1' && !location.pathname.startsWith('/admin'),
  );
  const [gone, setGone] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const stats = useMemo(
    () => ({
      p: site.projects.filter((x) => x.visible !== false).length,
      s: site.skills.reduce((a, g) => a + g.items.length, 0),
      e: site.experience.filter((x) => !x.milestone).length,
    }),
    [site],
  );
  const counts = useRef(stats);
  useEffect(() => {
    counts.current = stats;
  }, [stats]);

  useEffect(() => {
    if (!show) return;
    const el = elRef.current!;
    const body = bodyRef.current!;
    const de = document.documentElement;
    const reduce = reduceMotion();
    let done = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    const after: ReturnType<typeof setTimeout>[] = [];
    const T = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timers.push(t);
      return t;
    };
    const clearAll = () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
    de.classList.add('intro-lock', 'intro-on');
    body.innerHTML = '';

    const line = (html = '') => {
      const d = document.createElement('span');
      d.className = 't-line';
      d.innerHTML = html;
      body.appendChild(d);
      return d;
    };
    const type = (prefix: string, text: string, speed: number, cb?: () => void) => {
      const d = line(prefix + CUR);
      let i = 0;
      const step = () => {
        if (done) return;
        d.innerHTML = `${prefix}<span class="t-wh">${text.slice(0, i)}</span>${CUR}`;
        if (i++ < text.length) T(step, speed + Math.random() * speed * 0.5);
        else
          T(() => {
            d.innerHTML = `${prefix}<span class="t-wh">${text}</span>`;
            cb?.();
          }, 100);
      };
      step();
    };
    const pad = (label: string, w: number) =>
      `${label} <span class="t-mu">${'.'.repeat(Math.max(2, w - label.length) - 1)}</span> `;
    const task = (label: string, ms: number, cb: () => void) => {
      const d = line(`<span class="t-wa">[ ]</span> ${label} <span class="t-dots">⠋</span>`);
      const fr = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
      let k = 0;
      const iv = setInterval(() => {
        const dd = d.querySelector('.t-dots');
        if (dd) dd.textContent = fr[k++ % fr.length];
      }, 70);
      intervals.push(iv);
      T(
        () => {
          clearInterval(iv);
          d.innerHTML = `<span class="t-ok">[✓]</span> ${pad(label, 34)}<span class="t-mu">${ms}ms</span>`;
          cb();
        },
        Math.round(Math.min(ms, 420) * 0.45) + 70,
      );
    };
    const bar = (cb: () => void) => {
      const d = line();
      const w = 24;
      let v = 0;
      const step = () => {
        if (done) return;
        v = Math.min(100, v + 12 + Math.random() * 10);
        const f = Math.round((v / 100) * w);
        d.innerHTML = `<span class="t-pbar">[${'█'.repeat(f)}<span class="t-mu">${'░'.repeat(w - f)}</span>]</span> ${Math.floor(v)}%`;
        if (v < 100) T(step, 30);
        else T(cb, 100);
      };
      step();
    };

    const exit = () => {
      if (done) return;
      done = true;
      clearAll();
      store('session').set(SEEN, '1');
      el.classList.add('off');
      de.classList.remove('intro-lock');
      after.push(setTimeout(() => de.classList.add('intro-reveal'), reduce ? 0 : 380));
      after.push(
        setTimeout(() => {
          de.classList.remove('intro-on', 'intro-reveal');
          setGone(true);
        }, 1400),
      );
    };
    const showName = () => {
      if (done) return;
      el.classList.add('name');
      T(exit, 950);
    };
    const skip = () => {
      if (done) return;
      if (!el.classList.contains('name')) {
        clearAll();
        el.classList.add('name');
        after.push(setTimeout(exit, reduce ? 150 : 650));
      } else exit();
    };

    const seq = () => {
      const D = counts.current;
      el.classList.add('on');
      T(() => {
        type(P, 'ssh guest@daniel.dev', 22, () => {
          line('<span class="t-mu">Connecting to daniel.dev …</span>');
          T(() => {
            line('<span class="t-ok">✓</span> Connected. Welcome, <span class="t-wh">guest</span>.');
            line('');
            T(() => {
              type(P, 'npm run portfolio', 22, () => {
                line('<span class="t-mu">&gt; daniel-portfolio@2026 start</span>');
                const tasks: [string, number][] = [
                  ['Loading profile', 112],
                  [`Mounting ${D.p} projects`, 204],
                  [`Indexing ${D.s} skills`, 96],
                  [`Building ${D.e}-role timeline`, 151],
                  ['Waking up Echo AI', 238],
                  ['Applying signature', 64],
                ];
                let i = 0;
                const nx = () => {
                  if (done) return;
                  if (i < tasks.length) {
                    const t = tasks[i++];
                    task(t[0], t[1], nx);
                  } else
                    bar(() => {
                      line('');
                      line(`<span class="t-ok">✔ Build complete.</span> <span class="t-wh">Ready.</span>${CUR}`);
                      T(showName, 300);
                    });
                };
                nx();
              });
            }, 120);
          }, 220);
        });
      }, 150);
    };

    const onKey = () => skip();
    addEventListener('keydown', onKey);
    let raf = 0;
    if (reduce) {
      el.classList.add('on');
      body.innerHTML = `<span class="t-line">${P}<span class="t-wh">npm run portfolio</span></span><span class="t-line"><span class="t-ok">✔ Build complete.</span> Ready.</span>`;
      T(() => el.classList.add('name'), 900);
      T(exit, 2200);
    } else raf = requestAnimationFrame(seq);

    (el as HTMLDivElement & { __skip?: () => void }).__skip = skip;

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      clearAll();
      after.forEach(clearTimeout);
      removeEventListener('keydown', onKey);
      el.classList.remove('on', 'name', 'off');
      de.classList.remove('intro-lock', 'intro-on', 'intro-reveal');
    };
  }, [show]);

  if (!show || gone) return null;
  const touch = coarsePointer();
  const skip = (e: React.MouseEvent) => {
    e.stopPropagation();
    (elRef.current as (HTMLDivElement & { __skip?: () => void }) | null)?.__skip?.();
  };

  return (
    <div id="intro" ref={elRef} aria-hidden="true" onClick={skip}>
      <div className="t-glow" />
      <div className="t-win">
        <div className="t-bar">
          <i />
          <i />
          <i />
          <span>guest@daniel-portfolio: ~</span>
        </div>
        <div className="t-body" ref={bodyRef} />
      </div>
      <div className="t-name">
        <div>
          <h1 data-t="Daniel Al Kabbout">Daniel Al Kabbout</h1>
          <p>
            &gt; AI Software Engineer and Backend Developer<span>_</span>
          </p>
        </div>
      </div>
      <button type="button" className="t-skip" onClick={skip}>
        skip{!touch && <kbd>esc</kbd>}
      </button>
      <div className="t-foot">{touch ? 'tap anywhere to skip' : 'press any key to skip'}</div>
    </div>
  );
}
