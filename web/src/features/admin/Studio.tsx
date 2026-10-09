import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import me from '../../assets/daniel-small.jpg';
import { api, ApiError } from '../../api/client';
import { PREVIEW_KEY } from '../../api/content';
import { store } from '../../lib/env';
import { siteContentSchema, type SiteContent } from '../../types/content';
import { logout } from './auth';
import { Drawer } from './Drawer';
import { ActivityView, RequestsView, useRequests } from './RequestsView';
import { AccountView } from './AccountView';
import { CvView } from './CvView';
import { PagesView } from './PagesView';
import { VisitorsView } from './VisitorsView';
import { withDefaults } from '../../content/defaults';
import { Ic, useUi } from './ui';
import { changedSections, clone, LABEL, StudioCtx, type DrawerSpec, type StudioApi, type Tab } from './studio-state';
import {
  AboutView,
  DataView,
  ExperienceView,
  OverviewView,
  ProfileView,
  ProjectsView,
  ServicesView,
  SkillsView,
  TABS,
} from './views';

const DRAFT_KEY = 'dk-admin-draft';

const strip = (o: SiteContent) => {
  const c = { ...o } as Partial<SiteContent>;
  delete c.updatedAt;
  delete c.version;
  return JSON.stringify(c);
};

/** Edits left over from an earlier visit, if they differ from what is published. */
function savedDraft(initial: SiteContent) {
  try {
    const saved = JSON.parse(store('local').get(DRAFT_KEY) ?? 'null') as { t: number; d: unknown } | null;
    const parsed = saved && siteContentSchema.safeParse(saved.d);
    if (saved && parsed?.success && strip(withDefaults(parsed.data)) !== strip(initial))
      return { t: saved.t, d: withDefaults(parsed.data) };
  } catch {
    /* ignore a broken draft */
  }
  return null;
}

/** The editor once signed in: tabs on the left, the current view, and the publish bar. */
export function Studio({ initial: raw }: { initial: SiteContent }) {
  const { toast, ask } = useUi();
  // Every CV and page-text field starts filled in, so you edit the real wording, not a blank box.
  const [initial] = useState(() => withDefaults(raw));
  const qc = useQueryClient();
  const [base, setBase] = useState(initial);
  const [d, setD] = useState(initial);
  const [tab, setTab] = useState<Tab>('overview');
  const [drawer, setDrawer] = useState<DrawerSpec | null>(null);
  const [restore, setRestore] = useState<{ t: number; d: SiteContent } | null>(() => savedDraft(initial));
  const [publishing, setPublishing] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const requests = useRequests();
  const newCount = requests.data ? requests.data.filter((r) => r.status === 'New').length : null;

  const ch = changedSections(d, base);
  const dirty = ch.length > 0;

  // Keep a local copy of unpublished edits so a closed tab doesn't lose them.
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) {
      touched.current = true;
      return;
    }
    const t = setTimeout(() => {
      if (strip(d) !== strip(base)) store('local').set(DRAFT_KEY, JSON.stringify({ t: Date.now(), d }));
      else store('local').remove(DRAFT_KEY);
    }, 400);
    return () => clearTimeout(t);
  }, [d, base]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && !publishing) e.preventDefault();
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty, publishing]);

  const update = useCallback((fn: (x: SiteContent) => void) => {
    setD((prev) => {
      const c = clone(prev);
      fn(c);
      return c;
    });
  }, []);

  const show = useCallback((t: Tab) => {
    setTab(t);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  const studio: StudioApi = { d, base, update, replace: setD, open: setDrawer, show };

  const discard = async () => {
    if (
      !(await ask({
        title: 'Discard all unpublished changes?',
        text: 'Everything you changed since the last publish will be lost. This cannot be undone.',
        ok: 'Discard changes',
        danger: true,
      }))
    )
      return;
    setD(clone(base));
    store('local').remove(DRAFT_KEY);
    store('session').remove(PREVIEW_KEY);
    toast('Changes discarded');
  };

  const preview = () => {
    if (!store('session').set(PREVIEW_KEY, JSON.stringify(d)))
      return toast('Preview needs browser storage, which is blocked here.', 'err');
    window.location.href = '/';
  };

  const publish = async () => {
    if (!ch.length) return toast('Nothing to publish');
    const probs: string[] = [];
    d.projects.forEach((p) => (!p.title || !p.summary) && probs.push('A project is missing its title or summary.'));
    d.experience.forEach(
      (e) =>
        (!e.title || !e.org || !e.start) &&
        probs.push(`"${e.title || 'A role'}" is missing a title, company or start date.`),
    );
    if (!d.profile.rotating.length) probs.push('Add at least one rotating word on the Profile tab.');
    if (probs.length) {
      await ask({
        title: 'Fix these first',
        ok: 'OK',
        cancel: 'Close',
        body: (
          <ul className="adm-chlist">
            {probs.slice(0, 6).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        ),
      });
      return;
    }
    const ok = await ask({
      title: 'Publish your changes?',
      ok: 'Publish now',
      body: (
        <>
          <p>These sections will update for everyone who visits your site:</p>
          <ul className="adm-chlist">
            {ch.map((k) => (
              <li key={k}>{LABEL[k]}</li>
            ))}
          </ul>
        </>
      ),
    });
    if (!ok) return;
    setPublishing(true);
    try {
      const res = await api<{ changed: string[]; content: unknown }>('/api/admin/content', {
        method: 'PUT',
        body: d,
        timeoutMs: 90000,
      });
      const saved = withDefaults(siteContentSchema.parse(res.content));
      setBase(saved);
      setD(saved);
      store('local').remove(DRAFT_KEY);
      store('session').remove(PREVIEW_KEY);
      qc.setQueryData(['content'], saved);
      // Rebuild the static site so its built-in snapshot matches too. Optional: the live API already serves the new content.
      try {
        await api('/api/admin/publish', { method: 'POST' });
        toast('Published. The site is rebuilding with your changes.');
      } catch {
        toast('Published. Your changes are live for everyone.');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        toast('Your session expired. Sign in again; your draft is saved.', 'err');
        logout();
      } else if (e instanceof ApiError && e.status === 400)
        await ask({
          title: 'Some content needs fixing',
          ok: 'OK',
          cancel: 'Close',
          body: (
            <ul className="adm-chlist">
              {e.messages.slice(0, 8).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ),
        });
      else
        await ask({
          title: 'Could not publish',
          text: `${(e as Error).message} Your draft is safe in this browser.`,
          ok: 'OK',
          cancel: 'Close',
        });
    } finally {
      setPublishing(false);
    }
  };

  const tabMap: Partial<Record<Tab, string[]>> = {
    projects: ['projects'],
    experience: ['experience'],
    skills: ['skills'],
    services: ['services'],
    profile: ['profile', 'highlights'],
    about: ['education', 'certifications', 'languages', 'volunteering', 'clients'],
    cv: ['cv'],
    pages: ['pages'],
  };
  const counts: Partial<Record<Tab, number | null>> = {
    projects: d.projects.length,
    experience: d.experience.length,
    skills: d.skills.reduce((a, g) => a + g.items.length, 0),
    services: d.services.length,
    requests: newCount,
  };

  const View = {
    overview: () => <OverviewView newRequests={newCount} />,
    requests: RequestsView,
    visitors: VisitorsView,
    projects: ProjectsView,
    experience: ExperienceView,
    skills: SkillsView,
    services: ServicesView,
    profile: ProfileView,
    about: AboutView,
    data: DataView,
    activity: ActivityView,
    account: AccountView,
    cv: CvView,
    pages: PagesView,
  }[tab];

  return (
    <StudioCtx.Provider value={studio}>
      <div className="adm">
        <aside className="adm-side">
          <div className="adm-me">
            <span className="adm-me-pic">
              <img src={me} alt="" width="44" height="44" />
              <i aria-hidden="true" />
            </span>
            <div>
              <b>Daniel Al Kabbout</b>
              <small>
                <Ic n="lock" />
                Content studio
              </small>
            </div>
          </div>
          <div className={dirty ? 'adm-state draft' : 'adm-state'} role="status">
            <span aria-hidden="true" />
            <div>
              <b>
                {dirty ? `${ch.length} unpublished ${ch.length === 1 ? 'change' : 'changes'}` : 'Everything is live'}
              </b>
              <small>
                {dirty
                  ? 'Publish when you are ready'
                  : base.updatedAt
                    ? `Published ${new Date(base.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'Your site matches the studio'}
              </small>
            </div>
          </div>
          <nav className="adm-tabs" aria-label="Studio sections">
            {TABS.map(([k, label, icon, group], i) => {
              const changed = tabMap[k]?.some((x) => (ch as readonly string[]).includes(x));
              const n = counts[k];
              return (
                <Fragment key={k}>
                  {(i === 0 || TABS[i - 1][3] !== group) && <span className="adm-tabgroup">{group}</span>}
                  <button
                    type="button"
                    className={k === tab ? 'on' : undefined}
                    aria-current={k === tab ? 'page' : undefined}
                    onClick={() => show(k)}
                  >
                    <span className="adm-tab-ic">
                      <Ic n={icon} />
                    </span>
                    <span className="adm-tab-label">{label}</span>
                    {changed && <i className="adm-chg" title="Unpublished changes" />}
                    {n != null && (k !== 'requests' || n > 0) && (
                      <em className={k === 'requests' ? 'hot' : undefined}>{n}</em>
                    )}
                  </button>
                </Fragment>
              );
            })}
          </nav>
          <div className="adm-side-foot">
            <Link to="/" className="adm-foot-btn">
              <Ic n="eye" />
              View live site
            </Link>
            <button type="button" className="adm-foot-btn" onClick={logout}>
              <Ic n="logout" />
              Sign out
            </button>
          </div>
        </aside>
        <section className="adm-main" ref={mainRef}>
          {restore && (
            <div className="adm-restore">
              <Ic n="copy" />
              <span>
                You have unpublished edits from {new Date(restore.t).toLocaleString()}. Pick up where you left off?
              </span>
              <button
                type="button"
                className="adm-btn primary"
                onClick={() => {
                  setD(restore.d);
                  setRestore(null);
                  toast('Draft restored');
                }}
              >
                Restore
              </button>
              <button
                type="button"
                className="adm-btn ghost"
                onClick={() => {
                  setRestore(null);
                  store('local').remove(DRAFT_KEY);
                }}
              >
                Dismiss
              </button>
            </div>
          )}
          <div className="adm-view" key={tab}>
            <View />
          </div>
        </section>
      </div>
      <div className="adm-bar" hidden={!dirty}>
        <span className="adm-dot" />
        <span>Unpublished changes in {ch.map((k) => LABEL[k]).join(', ')}</span>
        <button type="button" className="adm-btn ghost" onClick={() => void discard()}>
          Discard
        </button>
        <button type="button" className="adm-btn ghost" onClick={preview}>
          Preview
        </button>
        <button type="button" className="adm-btn primary" disabled={publishing} onClick={() => void publish()}>
          {publishing ? 'Publishing…' : 'Publish changes'}
        </button>
      </div>
      <Drawer spec={drawer} close={() => setDrawer(null)} />
    </StudioCtx.Provider>
  );
}
