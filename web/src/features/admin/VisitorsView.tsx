import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useStudio } from './studio-state';
import { Ic, useUi } from './ui';
import { Head } from './views';
import { Switch } from './CvView';
import { isOwnDevice, setOwnDevice } from '../../lib/track';

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
  /** Visits (browser tabs), and how many of them came through a personal link. */
  visits?: number;
  linkVisits?: number;
  channels?: Count[];
  /** Average active seconds per visit, and per page view of each page. */
  avgSeconds?: number;
  pageTime?: Count[];
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

/** The kind of place a source is, matching the API's grouping. */
const CHANNEL_OF: Record<string, string> = {
  LinkedIn: 'Social',
  Instagram: 'Social',
  Facebook: 'Social',
  Threads: 'Social',
  X: 'Social',
  TikTok: 'Social',
  Snapchat: 'Social',
  YouTube: 'Social',
  Reddit: 'Social',
  Pinterest: 'Social',
  WhatsApp: 'Messaging',
  Messenger: 'Messaging',
  Telegram: 'Messaging',
  Slack: 'Messaging',
  Teams: 'Messaging',
  Discord: 'Messaging',
  WeChat: 'Messaging',
  LINE: 'Messaging',
  Gmail: 'Email',
  Outlook: 'Email',
  'Yahoo Mail': 'Email',
  Email: 'Email',
  Google: 'Search',
  Bing: 'Search',
  DuckDuckGo: 'Search',
  Yahoo: 'Search',
  Yandex: 'Search',
  Ecosia: 'Search',
  'Brave Search': 'Search',
  ChatGPT: 'AI',
  Claude: 'AI',
  Gemini: 'AI',
  Perplexity: 'AI',
  Copilot: 'AI',
};
const channelOf = (name: string) => CHANNEL_OF[name] ?? 'Website';

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
  value = (n) => n,
  empty,
}: {
  title: string;
  items: Count[];
  total: number;
  label?: (name: string) => React.ReactNode;
  value?: (n: number) => React.ReactNode;
  empty: string;
}) {
  const max = Math.max(1, ...items.map((x) => x.n));
  return (
    <section className="adm-card adm-vlist">
      <h3>{title}</h3>
      {items.length ? (
        <ol>
          {items.map((x) => (
            <li key={x.name} title={total ? `${x.n} (${Math.round((x.n / total) * 100)}%)` : undefined}>
              <span className="adm-vlist-bar" style={{ width: `${(x.n / max) * 100}%` }} aria-hidden="true" />
              <span className="adm-vlist-name">{label(x.name)}</span>
              <b>{value(x.n)}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="adm-muted">{empty}</p>
      )}
    </section>
  );
}

interface Step {
  at: string;
  kind: 'view' | 'cv';
  path: string;
  /** Active seconds on this page (visits since the timer was added). */
  seconds?: number;
}

interface LinkSession {
  at: string;
  lastAt: string;
  device: string;
  country: string;
  /** The network's own country, when it differs from the device's (a VPN or relay). */
  networkCountry?: string;
  timeZone?: string;
  source: string;
  channel?: string;
  /** Active time on the site, in seconds. */
  seconds?: number;
  steps?: Step[];
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
  seconds?: number;
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

/** 75 → "1m 15s". */
const fmtTime = (s: number) => {
  s = Math.max(0, Math.round(s));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
};
/** A running clock for the live view: 1:05, 12:40, 1:02:09. */
const clock = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/** The country, with the network's country when a VPN or relay put the address somewhere else. */
const place = (v: { country: string; networkCountry?: string; timeZone?: string }) =>
  v.country
    ? `${flag(v.country)} ${countryName(v.country)}` +
      (v.networkCountry ? ` (network in ${countryName(v.networkCountry)})` : '')
    : '';

const CHANNEL_HINT: Record<string, string> = {
  Direct: 'typed the address, a bookmark, or an app that hides where the link was',
  Social: 'a social network',
  Messaging: 'a chat app',
  Email: 'an email',
  Search: 'a search engine',
  AI: 'an AI assistant',
  Website: 'another website',
};

/** Where a visit came from, as a small tag: the source, coloured by its kind. */
function SourceTag({ source, channel }: { source: string; channel?: string }) {
  const c = channel || (source === 'Direct' ? 'Direct' : '');
  return (
    <span className={`adm-src ${c.toLowerCase()}`} title={c ? `${c}: ${CHANNEL_HINT[c] ?? ''}` : undefined}>
      {source === 'Direct' ? 'Direct' : source}
    </span>
  );
}

/** One visit, in order: each page they opened and when, and whether they downloaded the CV. */
function Journey({ v, pageName }: { v: LinkSession; pageName: (p: string) => string }) {
  const steps: Step[] = v.steps ?? [
    ...v.pages.map((path) => ({ at: v.at, kind: 'view' as const, path })),
    ...(v.cv ? [{ at: v.lastAt, kind: 'cv' as const, path: '/cv' }] : []),
  ];
  const secs = v.seconds ?? Math.round((new Date(v.lastAt).getTime() - new Date(v.at).getTime()) / 1000);
  const long = secs >= 1 ? fmtTime(secs) : '';
  return (
    <li>
      <span className="adm-link-when">
        {when(v.at)}
        <small>
          <SourceTag source={v.source} channel={v.channel} />
          {[v.device, place(v), long && `on the site ${long}`].filter(Boolean).map((x) => ` · ${x}`)}
        </small>
      </span>
      <span className="adm-link-path">
        {steps.map((st, k) => (
          <span
            key={k}
            className={st.kind === 'cv' ? 'cv' : undefined}
            title={v.steps ? `Opened at ${new Date(st.at).toLocaleTimeString('en-GB')}` : undefined}
          >
            {st.kind === 'cv' ? 'Downloaded CV' : pageName(st.path)}
            {st.kind === 'view' && !!st.seconds && <em>{fmtTime(st.seconds)}</em>}
          </span>
        ))}
      </span>
    </li>
  );
}

interface LiveVisitor {
  startedAt: string;
  lastSeen: string;
  path: string;
  source: string;
  channel: string;
  country: string;
  device: string;
  link: string | null;
}

/** Ticks every second, so live timers move. */
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * Who is on the site right now: a timer starts when someone opens it and stops when they close the tab,
 * switch away, or stop interacting for a few minutes. Refreshed every 10 seconds.
 */
function LiveNow({ pageName }: { pageName: (p: string) => string }) {
  const { data, error } = useQuery({
    queryKey: ['admin', 'visits-live'],
    queryFn: async () => {
      const r = await api<{ serverTime: string; visitors: LiveVisitor[] }>('/api/admin/visits/live');
      // The studio's clock and the server's can differ; line the timers up with the server.
      return { ...r, skew: Date.now() - new Date(r.serverTime).getTime() };
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
  const now = useNow();
  const list = data?.visitors ?? [];
  return (
    <section className={list.length ? 'adm-card adm-live on' : 'adm-card adm-live'} aria-live="polite">
      <div className="adm-live-h">
        <span className="adm-live-dot" aria-hidden="true" />
        <h3>
          {list.length
            ? `${list.length} ${list.length === 1 ? 'person' : 'people'} on your site now`
            : 'Nobody on your site right now'}
        </h3>
        <small className="adm-muted">updates every 10 seconds</small>
      </div>
      {error ? (
        <p className="adm-warn">Could not load: {(error as Error).message}</p>
      ) : list.length ? (
        <ul className="adm-live-list">
          {list.map((v, i) => (
            <li key={`${v.startedAt}-${i}`}>
              <b className="adm-live-clock" title={`Started at ${new Date(v.startedAt).toLocaleTimeString('en-GB')}`}>
                {clock((now - (data?.skew ?? 0) - new Date(v.startedAt).getTime()) / 1000)}
              </b>
              <span className="adm-live-main">
                <span>
                  {v.link ? <strong>{v.link}</strong> : null}
                  {v.link ? ' · ' : ''}on <strong>{pageName(v.path)}</strong>
                </span>
                <small>
                  <SourceTag source={v.source} channel={v.channel} />
                  {[v.device, place(v)].filter(Boolean).map((x) => ` · ${x}`)}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-muted adm-live-empty">
          When someone opens your site, they appear here with a timer that runs until they leave.
        </p>
      )}
    </section>
  );
}

interface SessionList {
  total: number;
  sessions: { visit: LinkSession; link: string | null }[];
}

/**
 * Everyone who came without one of your personal links (typed the address, a LinkedIn or Instagram post, a
 * search…): each visit on its own, with what they did, filterable by where they came from.
 */
function OtherVisits({ days, pageName }: { days: number; pageName: (p: string) => string }) {
  const [filter, setFilter] = useState('');
  const [more, setMore] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'visit-sessions', days],
    queryFn: () => api<SessionList>(`/api/admin/visits/sessions?days=${days}&kind=other&take=300`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const all = data?.sessions.map((s) => s.visit) ?? [];
  const sources = [...new Set(all.map((v) => v.source))].map((name) => ({
    name,
    n: all.filter((v) => v.source === name).length,
  }));
  sources.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const shown = filter ? all.filter((v) => v.source === filter) : all;
  const list = more ? shown : shown.slice(0, 15);

  return (
    <section className="adm-card adm-links adm-other">
      <div className="adm-links-h">
        <div>
          <h3>Visits without a personal link</h3>
          <p className="adm-muted">
            People who opened your site from its plain address: typed it, tapped it in a post or a chat, or found it in
            a search. Each visit shows where it came from and every page they opened, in order.
          </p>
        </div>
        {data && <span className="adm-other-n">{data.total}</span>}
      </div>
      {isLoading ? (
        <p className="adm-muted">Loading visits…</p>
      ) : error ? (
        <p className="adm-warn">Could not load visits: {(error as Error).message}</p>
      ) : !all.length ? (
        <p className="adm-muted adm-links-empty">No visits without a personal link in this period.</p>
      ) : (
        <>
          <div className="adm-chips" role="group" aria-label="Filter by source">
            <button type="button" aria-pressed={!filter} onClick={() => setFilter('')}>
              All <b>{all.length}</b>
            </button>
            {sources.map((x) => (
              <button
                key={x.name}
                type="button"
                aria-pressed={filter === x.name}
                onClick={() => setFilter(filter === x.name ? '' : x.name)}
              >
                {x.name} <b>{x.n}</b>
              </button>
            ))}
          </div>
          <ol className="adm-link-hist adm-journeys">
            {list.map((v, i) => (
              <Journey key={`${v.at}-${i}`} v={v} pageName={pageName} />
            ))}
          </ol>
          {shown.length > list.length && (
            <button type="button" className="adm-btn ghost adm-other-more" onClick={() => setMore(true)}>
              Show all {shown.length}
            </button>
          )}
        </>
      )}
    </section>
  );
}

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
                      ? `Opened ${l.sessions} ${l.sessions === 1 ? 'time' : 'times'} · ${l.visits} pages${l.seconds ? ` · ${fmtTime(l.seconds)} on the site` : ''} · last ${ago(l.lastAt)}`
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
                      <Journey key={i} v={h} pageName={pageName} />
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

/** Keeps Daniel's own phone and computer out of the counts. */
function OwnDevice() {
  const [on, setOn] = useState(isOwnDevice);
  return (
    <div className={on ? 'adm-owndev on' : 'adm-owndev'}>
      <div>
        <b>{on ? 'Your visits on this device are not counted' : 'Your visits on this device are counted'}</b>
        <small>
          Turned on automatically when you sign in to the studio. Sign in once on your phone too, or open the studio
          there and switch this on.
        </small>
      </div>
      <Switch
        on={on}
        label="Don't count my visits on this device"
        set={(v) => {
          setOwnDevice(v);
          setOn(v);
        }}
      />
    </div>
  );
}

/** Anonymous visitor counts: how many people came, from where, and what they looked at. */
export function VisitorsView() {
  const { d } = useStudio();
  const { ask, toast } = useUi();
  const qc = useQueryClient();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'visits', days],
    queryFn: () => api<VisitStats>(`/api/admin/visits?days=${days}`),
    staleTime: 60_000,
  });
  const projectTitle = (id: string) => d.projects.find((p) => p.id === id)?.title ?? id;
  const pageName = (p: string) => PAGE_NAMES[p] ?? (p.startsWith('/projects/') ? projectTitle(p.slice(10)) : p);
  const visitTotal = data?.visits ?? data?.views ?? 0;
  const topSource = data?.sources.find((s) => s.name !== 'Direct') ?? data?.sources[0];

  return (
    <>
      <Head
        title="Visitors"
        desc="Who came to your site, from where, and what they looked at. Anonymous: no cookies and no IP addresses are stored."
        actions={
          <>
            <button
              type="button"
              className="adm-btn ghost"
              onClick={() =>
                void (async () => {
                  if (
                    !(await ask({
                      title: 'Clear all visitor data?',
                      text: 'Every recorded visit is deleted, so the counts start again from zero. Your personal links stay. This cannot be undone.',
                      ok: 'Clear visits',
                      danger: true,
                    }))
                  )
                    return;
                  try {
                    const r = await api<{ deleted: number }>('/api/admin/visits', { method: 'DELETE' });
                    await qc.invalidateQueries({ queryKey: ['admin'] });
                    toast(`Cleared ${r.deleted} visits`);
                  } catch (err) {
                    toast((err as Error).message, 'err');
                  }
                })()
              }
            >
              Clear visits
            </button>
            <button type="button" className="adm-btn ghost" disabled={isFetching} onClick={() => void refetch()}>
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        }
      />
      <OwnDevice />
      <LiveNow pageName={pageName} />
      <PersonalLinks pageName={pageName} />
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
              <b className="adm-vstats-word">{data.avgSeconds ? fmtTime(data.avgSeconds) : '–'}</b>
              <span>Time on site</span>
              <small>average per visit, while active</small>
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
          {data.visits !== undefined && data.visits > 0 && (
            <p className="adm-muted adm-vsplit">
              {data.visits} {data.visits === 1 ? 'visit' : 'visits'}: <b>{data.linkVisits ?? 0}</b> through your
              personal links, <b>{data.visits - (data.linkVisits ?? 0)}</b> without one.
            </p>
          )}

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
            {data.pageTime && (
              <TopList
                title="Time per page"
                items={data.pageTime}
                total={0}
                label={(p) =>
                  PAGE_NAMES[p] ?? (p.startsWith('/projects/') ? `Project: ${projectTitle(p.slice(10))}` : p)
                }
                value={fmtTime}
                empty="Shows once visitors spend time on your pages."
              />
            )}
            <TopList
              title="Projects opened"
              items={data.projects}
              total={data.views}
              label={projectTitle}
              empty="Nobody has opened a project page yet."
            />
            <TopList
              title="Where they came from"
              items={data.sources}
              total={visitTotal}
              label={(name) => (
                <>
                  {name}
                  {name !== 'Direct' && data.channels && <small className="adm-vlist-sub"> {channelOf(name)}</small>}
                </>
              )}
              empty="No visits yet."
            />
            {data.channels && (
              <TopList title="Kind of source" items={data.channels} total={visitTotal} empty="No visits yet." />
            )}
            <TopList
              title="Countries"
              items={data.countries}
              total={visitTotal}
              label={(c) => (
                <>
                  <span aria-hidden="true">{flag(c)}</span> {countryName(c)}
                </>
              )}
              empty="Countries appear once the site runs on Cloudflare."
            />
            <TopList title="Devices" items={data.devices} total={visitTotal} empty="No visits yet." />
          </div>

          <OtherVisits days={days} pageName={pageName} />

          <p className="adm-muted adm-vnote">
            <Ic n="lock" />
            Counted without cookies. A visit is one browser tab; each visitor also gets a code that changes every day,
            so a person is never followed from one day to the next. IP addresses are never saved, the country comes from
            the device's time zone (so VPNs and carriers routing abroad don't skew it), bots and your own devices are
            skipped, and browsers that ask not to be tracked are respected. Visits are kept for about 13 months.
          </p>
        </>
      ) : null}
    </>
  );
}
