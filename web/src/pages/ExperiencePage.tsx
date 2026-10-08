import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Page } from '../components/Page';
import { useSite } from '../api/content';
import { clamp01, reduceMotion, smooth } from '../lib/env';
import { duration, fmtMonth, monthIndex, MONTHS, ym } from '../lib/dates';
import type { Experience } from '../types/content';
import { pageText } from '../content/defaults';

const ORG_COLORS = ['sky', 'sun', 'mint'];

interface Role extends Experience {
  color: string;
  letter: string;
}

function useTimeline(site: ReturnType<typeof useSite>) {
  return useMemo(() => {
    const sorted = [...site.experience].sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    const roles = sorted.filter((j) => !j.milestone);
    const orgs: string[] = [];
    [...roles].reverse().forEach((j) => !orgs.includes(j.org) && orgs.push(j.org));
    orgs.reverse();
    const color: Record<string, string> = {};
    orgs.forEach((o, i) => (color[o] = ORG_COLORS[i % 3]));
    const items = sorted.map((j) => ({
      ...j,
      color: color[j.org],
      letter: (j.org || '?').trim().charAt(0).toUpperCase(),
    })) as Role[];
    const groups = orgs.map((o) => ({
      org: o,
      color: color[o],
      roles: items.filter((j) => !j.milestone && j.org === o).reverse(),
    }));
    const first = roles.reduce((a, j) => (!a || j.start < a ? j.start : a), '');
    return { items, roles, orgs, groups, first };
  }, [site.experience]);
}

function Gantt({ items, groups, first }: ReturnType<typeof useTimeline>) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ html: { t: string; when: string }; x: number; y: number } | null>(null);
  const start = monthIndex(`${(first || '2024-01').slice(0, 4)}-01`);
  const end = monthIndex(null) + 1;
  const span = end - start;
  const pct = (v: number) => `${(((v - start) / span) * 100).toFixed(2)}%`;
  const years: number[] = [];
  for (let y = Math.floor(start / 12); y <= ym(null)[0]; y++) years.push(y);

  // On a phone the chart scrolls sideways; start where the newest role sits just right of the company names.
  useEffect(() => {
    const g = ref.current;
    if (!g || g.scrollWidth <= g.clientWidth) return;
    const bars = [...g.querySelectorAll<HTMLElement>('.g-bar')];
    const label = g.querySelector<HTMLElement>('.g-row p');
    if (!bars.length || !label) return;
    const gl = g.getBoundingClientRect().left;
    const newest = Math.max(...bars.map((b) => b.getBoundingClientRect().left - gl + g.scrollLeft));
    g.scrollLeft = Math.max(0, newest - label.offsetWidth - 24);
  }, []);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      g.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) {
          g.classList.add('in');
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(g);
    return () => io.disconnect();
  }, []);

  const showTip = (b: HTMLElement, j: Role) => {
    const g = ref.current!;
    const gr = g.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    setTip({
      html: { t: j.title, when: `${fmtMonth(j.start)} to ${fmtMonth(j.end)}` },
      x: br.left - gr.left + g.scrollLeft,
      y: br.bottom - gr.top + 10,
    });
  };

  // Keep the floating tooltip inside the chart once its width is known.
  const floatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fl = floatRef.current;
    const g = ref.current;
    if (!fl || !g || !tip) return;
    const max = g.scrollWidth - fl.offsetWidth - 8;
    fl.style.left = `${Math.max(8, Math.min(tip.x, max))}px`;
    fl.style.top = `${tip.y}px`;
  }, [tip]);

  return (
    <div className="gantt" id="gantt" ref={ref}>
      <div className="g-axis">
        {years.map((y) => (
          <span key={y} style={{ left: pct(y * 12) }}>
            {y}
          </span>
        ))}
      </div>
      <div className="g-rows">
        {items
          .filter((x) => x.milestone && x.start)
          .map((x) => (
            <div
              key={x.id}
              className="g-grad"
              style={{ '--gx': ((monthIndex(x.start) + 0.5 - start) / span).toFixed(4) } as React.CSSProperties}
            >
              <span>{(x.title || '').split(',')[0]}</span>
            </div>
          ))}
        {groups.map((r) => (
          <div key={r.org} className="g-row">
            <p>{r.org}</p>
            <div className="g-track">
              {r.roles.map((j, k) => {
                const s = monthIndex(j.start);
                const e = monthIndex(j.end) + 1;
                return (
                  <button
                    key={j.id}
                    type="button"
                    className={clsx('g-bar', `g-${r.color}`, !j.end && 'live')}
                    style={
                      {
                        left: pct(s),
                        width: `${(((e - s) / span) * 100).toFixed(2)}%`,
                        '--gd': `${k * 0.25}s`,
                      } as React.CSSProperties
                    }
                    aria-label={`${j.title}, ${fmtMonth(j.start)} to ${fmtMonth(j.end)}`}
                    onClick={() =>
                      document.getElementById(`xp-${j.id}`)?.scrollIntoView({ behavior: smooth(), block: 'center' })
                    }
                    onMouseEnter={(ev) => showTip(ev.currentTarget, j)}
                    onFocus={(ev) => showTip(ev.currentTarget, j)}
                    onMouseLeave={() => setTip(null)}
                    onBlur={() => setTip(null)}
                  >
                    <span>{j.short || j.title}</span>
                    <i className="g-tip">
                      {j.title}
                      <small>
                        {fmtMonth(j.start)} to {fmtMonth(j.end)}
                      </small>
                    </i>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className={tip ? 'g-float on' : 'g-float'} aria-hidden="true" ref={floatRef}>
        {tip && (
          <>
            {tip.html.t}
            <small>{tip.html.when}</small>
          </>
        )}
      </div>
    </div>
  );
}

function Timeline({ items }: { items: Role[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tl = ref.current;
    if (!tl) return;
    const els = Array.from(tl.querySelectorAll<HTMLElement>('.tl-item'));
    if (reduceMotion()) {
      els.forEach((t) => t.classList.add('in', 'lit'));
      tl.style.setProperty('--tp', '1');
      return;
    }
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = innerHeight;
      const r = tl.getBoundingClientRect();
      const mark = vh * 0.6;
      tl.style.setProperty('--tp', clamp01((mark - r.top) / r.height).toFixed(4));
      els.forEach((t) => {
        const tr = t.getBoundingClientRect();
        if (tr.top < vh * 0.85) t.classList.add('in');
        t.classList.toggle('lit', tr.top + 30 < mark);
      });
    };
    const req = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', req);
    update();
    return () => {
      removeEventListener('scroll', req);
      removeEventListener('resize', req);
    };
  }, [items]);

  let side = 0;
  return (
    <div className="tl" id="tl" ref={ref}>
      <div className="tl-line" aria-hidden="true">
        <i id="tlFill" />
      </div>
      {items.map((j) => {
        if (j.milestone)
          return (
            <article key={j.id} id={`xp-${j.id}`} className="tl-item milestone">
              <div className="tl-dot" aria-hidden="true" />
              <div className="ms">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 10L12 5 2 10l10 5 10-5z" />
                  <path d="M6 12v5c3 2 9 2 12 0v-5" />
                </svg>
                <div>
                  <b>{j.title}</b>
                  <span>
                    {j.org}, {fmtMonth(j.start)}
                  </span>
                </div>
              </div>
            </article>
          );
        const right = side++ % 2 === 1;
        const type = j.end ? j.type || '' : j.type || 'Current';
        const metrics = j.metrics.filter((m) => m && m[0]);
        return (
          <article key={j.id} id={`xp-${j.id}`} className={clsx('tl-item', right && 'r', !j.end && 'now')}>
            <div className="tl-dot" aria-hidden="true" />
            <div className="tl-card panel">
              <div className="tc-head">
                <span className={`co co-${j.color}`} aria-hidden="true">
                  {j.letter}
                </span>
                <div>
                  <p className="org">{j.org}</p>
                  <span className="when">
                    {fmtMonth(j.start)} to {fmtMonth(j.end)}
                    <em>{duration(j.start, j.end)}</em>
                  </span>
                </div>
                {type && <span className={clsx('badge', type === 'Current' && 'live')}>{type}</span>}
              </div>
              <h3>{j.title}</h3>
              {metrics.length > 0 && (
                <div className="tc-metrics">
                  {metrics.map((m, i) => (
                    <div key={i}>
                      <strong>{m[0]}</strong>
                      <span>{m[1]}</span>
                    </div>
                  ))}
                </div>
              )}
              <ul>
                {j.bullets.filter(Boolean).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <div className="tags">
                {j.tags.filter(Boolean).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function ExperiencePage() {
  const site = useSite();
  const text = pageText(site, 'experience');
  const tl = useTimeline(site);
  const months = tl.first ? monthIndex(null) - monthIndex(tl.first) + 1 : 0;
  const [fy, fm] = (tl.first || '2024-02').split('-');

  return (
    <Page name="experience" title="Experience, Daniel Al Kabbout">
      <div className="page-hero">
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="wrap">
          {text.kicker && <p className="title-line">{text.kicker}</p>}
          <h1 tabIndex={-1}>{text.title}</h1>
          <p>
            {tl.roles.length} roles at {tl.orgs.length} {tl.orgs.length === 1 ? 'company' : 'companies'} since{' '}
            {MONTHS[Number(fm) - 1]} {fy}.
          </p>
          <div className="xp-stats">
            <div>
              <strong>{Math.floor(months / 12)}+</strong>
              <span>years building software</span>
            </div>
            <div>
              <strong>{tl.roles.length}</strong>
              <span>roles</span>
            </div>
            <div>
              <strong>{tl.orgs.length}</strong>
              <span>companies</span>
            </div>
            <div>
              <strong>{site.profile.teamStat || '3'}</strong>
              <span>developers I lead today</span>
            </div>
          </div>
        </div>
      </div>

      <section className="xp-map-sec">
        <div className="wrap">
          <div className="head">
            <h2>My path at a glance</h2>
            <p>
              <span className="on-mouse">Each bar is a role. Hover for details, click to jump to it.</span>
              <span className="on-touch">
                Each bar is a role. Tap one to jump to it, and swipe the chart to see every year.
              </span>
            </p>
          </div>
          <Gantt {...tl} />
          {site.clients.length > 0 && (
            <div className="clients">
              <p>Clients I've delivered for at SoftFlow</p>
              <ul>
                {site.clients.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="xp-tl-sec">
        <div className="wrap">
          <div className="head">
            <h2>The full story</h2>
            <p>Scroll down the timeline, newest first.</p>
          </div>
          <Timeline items={tl.items} />
        </div>
      </section>
    </Page>
  );
}
