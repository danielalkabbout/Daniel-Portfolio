import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/client';
import { useStudio } from './studio-state';
import { Ic, useUi } from './ui';
import { Head } from './views';

interface Count {
  name: string;
  n: number;
}

interface VisitStats {
  days: number;
  today: number;
  views: number;
  visitors: number;
  cvDownloads: number;
  perDay: { date: string; views: number; visitors: number }[];
  pages: Count[];
  projects: Count[];
  sources: Count[];
  countries: Count[];
  devices: Count[];
}

const RANGES = [7, 30, 90] as const;

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
const countryName = (code: string) => regionNames?.of(code) ?? code;
const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '';
const fmtDay = (d: string, long = false) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(long ? { weekday: 'short' } : {}),
    timeZone: 'UTC',
  });

const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/about': 'About',
  '/experience': 'Experience',
  '/projects': 'Projects',
  '/services': 'Services',
  '/cv': 'CV',
};

/** Unique visitors per day, as thin bars with a tooltip on hover or tap. */
function DailyChart({ days }: { days: VisitStats['perDay'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.visitors));
  const tick = days.length > 31 ? 14 : days.length > 10 ? 7 : 1;
  const h = hover ?? days.length - 1;
  const cur = days[h];
  return (
    <div className="adm-vchart">
      <div className="adm-vchart-tip" aria-live="polite">
        <b>{cur ? `${cur.visitors} ${cur.visitors === 1 ? 'visitor' : 'visitors'}` : ''}</b>
        <span>{cur ? `${cur.views} page views · ${fmtDay(cur.date, true)}` : ''}</span>
      </div>
      <div
        className="adm-vchart-plot"
        role="img"
        aria-label={`Visitors per day over the last ${days.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        <div className="adm-vchart-grid" aria-hidden="true">
          <span data-v={max} />
          <span data-v={Math.round(max / 2)} />
          <span data-v={0} />
        </div>
        <div className="adm-vchart-bars" style={{ '--n': days.length } as React.CSSProperties}>
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              className={i === hover ? 'on' : undefined}
              aria-label={`${fmtDay(d.date, true)}: ${d.visitors} visitors, ${d.views} page views`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
            >
              <i style={{ height: `${(d.visitors / max) * 100}%` }} />
            </button>
          ))}
        </div>
      </div>
      <div className="adm-vchart-x" aria-hidden="true" style={{ '--n': days.length } as React.CSSProperties}>
        {days.map((d, i) => (
          <span key={d.date}>{(days.length - 1 - i) % tick === 0 ? fmtDay(d.date) : ''}</span>
        ))}
      </div>
    </div>
  );
}

/** A ranked list with a bar showing each share. */
function TopList({
  title,
  items,
  total,
  label = (s) => s,
  empty,
}: {
  title: string;
  items: Count[];
  total: number;
  label?: (name: string) => React.ReactNode;
  empty: string;
}) {
  const max = Math.max(1, ...items.map((x) => x.n));
  return (
    <section className="adm-card adm-vlist">
      <h3>{title}</h3>
      {items.length ? (
        <ol>
          {items.map((x) => (
            <li key={x.name} title={`${x.n} (${Math.round((x.n / Math.max(total, 1)) * 100)}%)`}>
              <span className="adm-vlist-bar" style={{ width: `${(x.n / max) * 100}%` }} aria-hidden="true" />
              <span className="adm-vlist-name">{label(x.name)}</span>
              <b>{x.n}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="adm-muted">{empty}</p>
      )}
    </section>
  );
}

interface LinkSession {
  at: string;
  lastAt: string;
  device: string;
  country: string;
  source: string;
  pages: string[];
  cv: boolean;
}

interface PersonalLink {
  id: number;
  code: string;
  label: string;
  note: string;
  createdAt: string;
  visits: number;
  sessions: number;
  cv: boolean;
  lastAt: string | null;
  history: LinkSession[];
}

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} minutes ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hours ago`;
  if (s < 172800) return 'yesterday';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Visitors today, for the badge next to the Visitors tab. */
export function useVisitorsToday() {
  const { data } = useQuery({
    queryKey: ['admin', 'visits', 1],
    queryFn: () => api<VisitStats>('/api/admin/visits?days=1'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return data ? data.today : null;
}

/**
 * Links made for one company or person. Send the link with an application; when they open it, you see
 * when, on which device and country, and what they looked at (and get an email if alerts are on).
 */
function PersonalLinks({ pageName }: { pageName: (p: string) => string }) {
  const { toast, ask } = useUi();
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'links'],
    queryFn: () => api<PersonalLink[]>('/api/admin/links'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const url = (code: string) => `${window.location.origin}/?r=${code}`;
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(url(code));
      toast('Link copied');
    } catch {
      toast(url(code));
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return toast('Write who the link is for', 'err');
    setBusy(true);
    try {
      const link = await api<PersonalLink>('/api/admin/links', {
        method: 'POST',
        body: { label: label.trim(), note: note.trim() },
      });
      setLabel('');
      setNote('');
      await qc.invalidateQueries({ queryKey: ['admin', 'links'] });
      await copy(link.code);
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (l: PersonalLink) => {
    if (
      !(await ask({
        title: `Delete the link for ${l.label}?`,
        text: 'The link stops being tracked. Visits it already brought stay in your totals.',
        ok: 'Delete',
        danger: true,
      }))
    )
      return;
    try {
      await api(`/api/admin/links/${l.id}`, { method: 'DELETE' });
      qc.setQueryData<PersonalLink[]>(['admin', 'links'], (list) => list?.filter((x) => x.id !== l.id));
      toast('Link deleted');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  return (
    <section className="adm-card adm-links">
      <div className="adm-links-h">
        <div>
          <h3>Personal links</h3>
          <p className="adm-muted">
            Make a link for each company or recruiter you contact. When they open it, you see when and what they looked
            at here, and get an email if alerts are on.
          </p>
        </div>
      </div>
      <form className="adm-links-new" onSubmit={(e) => void create(e)}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          placeholder="Who is it for? e.g. Tradias, backend role"
          aria-label="Who the link is for"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Note (optional), e.g. sent with my CV on LinkedIn"
          aria-label="Note"
        />
        <button type="submit" className="adm-btn primary" disabled={busy}>
          <Ic n="plus" />
          {busy ? 'Creating…' : 'Create and copy link'}
        </button>
      </form>

      {isLoading ? (
        <p className="adm-muted">Loading links…</p>
      ) : error ? (
        <p className="adm-warn">Could not load links: {(error as Error).message}</p>
      ) : !data?.length ? (
        <p className="adm-muted adm-links-empty">No links yet. Create one for the next application you send.</p>
      ) : (
        <ul className="adm-links-list">
          {data.map((l) => (
            <li key={l.id} className={l.lastAt ? 'opened' : undefined}>
              <div className="adm-link-row">
                <span className="adm-link-dot" aria-hidden="true" />
                <div className="adm-link-main">
                  <b>{l.label}</b>
                  <small>
                    {l.lastAt
                      ? `Opened ${l.sessions} ${l.sessions === 1 ? 'time' : 'times'} · ${l.visits} pages · last ${ago(l.lastAt)}`
                      : `Not opened yet · made ${ago(l.createdAt)}`}
                    {l.note && ` · ${l.note}`}
                  </small>
                </div>
                {l.cv && <span className="adm-link-cv">Downloaded your CV</span>}
                <button type="button" className="adm-btn ghost adm-link-copy" onClick={() => void copy(l.code)}>
                  <Ic n="copy" />
                  <code>?r={l.code}</code>
                </button>
                <button
                  type="button"
                  className="adm-ibtn"
                  aria-label={`Delete the link for ${l.label}`}
                  onClick={() => void remove(l)}
                >
                  <Ic n="del" />
                </button>
              </div>
              {l.history.length > 0 && (
                <details className="adm-link-hist">
                  <summary>What they looked at</summary>
                  <ol>
                    {l.history.map((h, i) => (
                      <li key={i}>
                        <span className="adm-link-when">
                          {when(h.at)}
                          <small>
                            {[
                              h.device,
                              h.country && `${flag(h.country)} ${countryName(h.country)}`,
                              h.source !== 'Direct' && h.source,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </small>
                        </span>
                        <span className="adm-link-path">
                          {h.pages.map((p, k) => (
                            <span key={k}>{pageName(p)}</span>
                          ))}
                          {h.cv && <span className="cv">Downloaded CV</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Anonymous visitor counts: how many people came, from where, and what they looked at. */
export function VisitorsView() {
  const { d } = useStudio();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'visits', days],
    queryFn: () => api<VisitStats>(`/api/admin/visits?days=${days}`),
    staleTime: 60_000,
  });
  const projectTitle = (id: string) => d.projects.find((p) => p.id === id)?.title ?? id;
  const topSource = data?.sources.find((s) => s.name !== 'Direct') ?? data?.sources[0];

  return (
    <>
      <Head
        title="Visitors"
        desc="Who came to your site, from where, and what they looked at. Anonymous: no cookies and no IP addresses are stored."
        actions={
          <button type="button" className="adm-btn ghost" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />
      <PersonalLinks pageName={(p) => PAGE_NAMES[p] ?? (p.startsWith('/projects/') ? projectTitle(p.slice(10)) : p)} />
      <div className="adm-seg" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r} type="button" role="tab" aria-selected={days === r} onClick={() => setDays(r)}>
            Last {r} days
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="adm-gate">
          <span className="adm-spin" />
          <p>Loading visits…</p>
        </div>
      ) : error ? (
        <p className="adm-warn">Could not load visits: {(error as Error).message}</p>
      ) : data ? (
        <>
          <div className="adm-stats adm-vstats">
            <div>
              <b>{data.visitors}</b>
              <span>Visitors</span>
              <small>unique per day</small>
            </div>
            <div>
              <b>{data.views}</b>
              <span>Page views</span>
              <small>{data.visitors ? `${(data.views / data.visitors).toFixed(1)} per visitor` : 'none yet'}</small>
            </div>
            <div>
              <b>{data.cvDownloads}</b>
              <span>CV downloads</span>
              <small>the PDF from your CV page</small>
            </div>
            <div>
              <b className="adm-vstats-word">{topSource?.name ?? '–'}</b>
              <span>Top source</span>
              <small>{topSource ? `${topSource.n} visits` : 'none yet'}</small>
            </div>
          </div>

          <section className="adm-card">
            <h3>Visitors per day</h3>
            {data.views ? (
              <DailyChart days={data.perDay} />
            ) : (
              <div className="adm-empty">
                <Ic n="chart" />
                <b>No visits in this period yet</b>
                <span>
                  Visits show up here a few seconds after someone opens your site. Your own visits while signed in to
                  the studio are not counted.
                </span>
              </div>
            )}
          </section>

          <div className="adm-vgrid">
            <TopList
              title="Pages"
              items={data.pages}
              total={data.views}
              label={(p) => PAGE_NAMES[p] ?? (p.startsWith('/projects/') ? `Project: ${projectTitle(p.slice(10))}` : p)}
              empty="No page views yet."
            />
            <TopList
              title="Projects opened"
              items={data.projects}
              total={data.views}
              label={projectTitle}
              empty="Nobody has opened a project page yet."
            />
            <TopList title="Where they came from" items={data.sources} total={data.views} empty="No visits yet." />
            <TopList
              title="Countries"
              items={data.countries}
              total={data.views}
              label={(c) => (
                <>
                  <span aria-hidden="true">{flag(c)}</span> {countryName(c)}
                </>
              )}
              empty="Countries appear once the site runs on Cloudflare."
            />
            <TopList title="Devices" items={data.devices} total={data.views} empty="No visits yet." />
          </div>

          <p className="adm-muted adm-vnote">
            <Ic n="lock" />
            Counted without cookies. Each visitor gets a code that changes every day, so a person is never followed from
            one day to the next; IP addresses are never saved, bots and your own signed-in visits are skipped, and
            browsers that ask not to be tracked are respected. Visits are kept for about 13 months.
          </p>
        </>
      ) : null}
    </>
  );
}
