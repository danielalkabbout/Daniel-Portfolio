import { useState, type ReactNode } from 'react';
import { ICON_CHOICES, Icon, SERVICE_VISUALS, VISUAL_CHOICES, visualKey } from '../../lib/icons';
import { copyText } from '../../lib/env';
import {
  siteContentSchema,
  type Experience,
  type Project,
  type Service,
  type SiteContent,
  type SkillCategory,
} from '../../types/content';
import { ChipsField, FieldView, validateField, type Field } from './fields';
import { DEMO_LABELS } from '../projects/demoLabels';
import { Ic, useUi, type IconName } from './ui';
import { changedSections, clone, fmtM, LABEL, slug, useStudio, type Obj } from './studio-state';

export function Head({ title, desc, actions }: { title: string; desc: ReactNode; actions?: ReactNode }) {
  return (
    <header className="adm-head">
      <div>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      <div className="adm-hact">{actions}</div>
    </header>
  );
}

const AddBtn = ({ label, onClick, ghost }: { label: string; onClick: () => void; ghost?: boolean }) => (
  <button type="button" className={ghost ? 'adm-btn ghost' : 'adm-btn primary'} onClick={onClick}>
    <Ic n="plus" />
    {label}
  </button>
);

function FilterBar({ ph, q, setQ }: { ph: string; q: string; setQ: (s: string) => void }) {
  return (
    <div className="adm-filter">
      <Ic n="search" />
      <input type="search" placeholder={ph} aria-label={ph} value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
  );
}

interface RowsCfg<T> {
  items: T[];
  title: (it: T) => string;
  sub: (it: T) => ReactNode;
  icon?: (it: T) => ReactNode;
  edit: (it: T) => void;
  remove: (it: T) => void;
  /** Reorder: move item from index to index. */
  move?: (from: number, to: number) => void;
  toggle?: (it: T) => void;
  hidden?: (it: T) => boolean;
  emptyTitle: string;
  emptyText: string;
  q?: string;
}

/** List of items with edit, delete, show/hide and drag or arrow reordering. */
function Rows<T>(cfg: RowsCfg<T>) {
  const { ask, toast } = useUi();
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  if (!cfg.items.length)
    return (
      <div className="adm-list">
        <div className="adm-empty">
          <Ic n="plus" />
          <b>{cfg.emptyTitle}</b>
          <span>{cfg.emptyText}</span>
        </div>
      </div>
    );
  const q = (cfg.q ?? '').toLowerCase();
  return (
    <div className="adm-list">
      {cfg.items.map((it, i) => {
        const title = cfg.title(it);
        const off = cfg.hidden?.(it);
        const del = async () => {
          if (
            await ask({
              title: `Delete "${title}"?`,
              text: 'It will be removed from your site when you publish. You can still discard changes before publishing.',
              ok: 'Delete',
              danger: true,
            })
          ) {
            cfg.remove(it);
            toast('Deleted');
          }
        };
        return (
          <div
            key={i}
            className={`adm-row${off ? ' off' : ''}${drag === i ? ' drag' : ''}${over === i ? ' over' : ''}`}
            hidden={!!q && !title.toLowerCase().includes(q)}
            draggable={!!cfg.move}
            onDragStart={(e) => {
              setDrag(i);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(i));
            }}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const from = Number(e.dataTransfer.getData('text/plain'));
              if (from !== i && cfg.move) {
                cfg.move(from, i);
                toast('Order updated');
              }
            }}
            onClick={(e) => {
              if (!(e.target as Element).closest('button, .adm-grip')) cfg.edit(it);
            }}
          >
            {cfg.move && (
              <span className="adm-grip" title="Drag to reorder">
                <Ic n="grip" />
              </span>
            )}
            <span className="adm-ricon">{cfg.icon?.(it)}</span>
            <div className="adm-rtxt">
              <b>{title}</b>
              <span>{cfg.sub(it)}</span>
            </div>
            <div className="adm-ract">
              {cfg.toggle && (
                <button
                  type="button"
                  className="adm-ibtn"
                  title={off ? 'Show on site' : 'Hide from site'}
                  aria-label={`${off ? 'Show' : 'Hide'} ${title}`}
                  onClick={() => {
                    cfg.toggle!(it);
                    toast(off ? 'Will be shown on the site' : 'Will be hidden from the site');
                  }}
                >
                  <Ic n={off ? 'eyeoff' : 'eye'} />
                </button>
              )}
              {cfg.move && (
                <>
                  <button
                    type="button"
                    className="adm-ibtn"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => cfg.move!(i, i - 1)}
                  >
                    <Ic n="up" />
                  </button>
                  <button
                    type="button"
                    className="adm-ibtn"
                    aria-label="Move down"
                    disabled={i === cfg.items.length - 1}
                    onClick={() => cfg.move!(i, i + 1)}
                  >
                    <Ic n="down" />
                  </button>
                </>
              )}
              <button type="button" className="adm-ibtn" aria-label={`Edit ${title}`} onClick={() => cfg.edit(it)}>
                <Ic n="edit" />
              </button>
              <button
                type="button"
                className="adm-ibtn danger"
                aria-label={`Delete ${title}`}
                onClick={() => void del()}
              >
                <Ic n="del" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const moveIn = <T,>(a: T[], from: number, to: number) => {
  const m = a.splice(from, 1)[0];
  a.splice(to, 0, m);
};

/* ---------- overview ---------- */

export function OverviewView({ newRequests }: { newRequests: number | null }) {
  const { d, base, show, open, update } = useStudio();
  const { toast } = useUi();
  const ctx = { update, toast };
  const ch = changedSections(d, base);
  const skills = d.skills.reduce((a, g) => a + g.items.length, 0);
  const stat = (tab: Parameters<typeof show>[0], n: number, label: string, small: string) => (
    <button type="button" onClick={() => show(tab)}>
      <b>{n}</b>
      <span>{label}</span>
      <small>{small}</small>
    </button>
  );
  const qa = (title: string, sub: string, fn: () => void) => (
    <button type="button" className="adm-qa" onClick={fn}>
      <Ic n="plus" />
      <span>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
    </button>
  );
  return (
    <>
      <Head
        title="Welcome back, Daniel"
        desc={
          <>
            Manage everything on your portfolio from here. Changes stay private until you press <b>Publish changes</b>.
          </>
        }
      />
      <div className="adm-stats">
        {stat(
          'projects',
          d.projects.length,
          'Projects',
          `${d.projects.filter((p) => p.visible !== false).length} visible`,
        )}
        {stat(
          'experience',
          d.experience.filter((e) => !e.milestone).length,
          'Roles',
          `${d.experience.filter((e) => e.milestone).length} milestones`,
        )}
        {stat('skills', skills, 'Skills', `${d.skills.length} categories`)}
        {newRequests !== null
          ? stat('requests', newRequests, 'New requests', 'from the Services page')
          : stat(
              'services',
              d.services.length,
              'Services',
              `${d.services.filter((s) => s.visible !== false).length} visible`,
            )}
      </div>
      <div className="adm-grid2">
        <div className="adm-card">
          <h3>Quick actions</h3>
          <div className="adm-quick">
            {qa('Add a project', 'With features, tags, links and a screenshot', () => {
              show('projects');
              open(projectSpec(null, ctx));
            })}
            {qa('Add a role', 'New job, internship or freelance work', () => {
              show('experience');
              open(roleSpec(null, false, ctx));
            })}
            {qa('Add skills', 'Drop new tools into a category', () => show('skills'))}
            {qa('Add a certification', 'Courses and certificates', () => show('about'))}
            {qa('Edit your CV', 'Summary, headline, section order', () => show('cv'))}
            {qa('Edit page text', 'Headings and paragraphs on every page', () => show('pages'))}
          </div>
        </div>
        <div className="adm-card">
          <h3>Status</h3>
          {ch.length ? (
            <>
              <p className="adm-warn">
                <span className="adm-dot" />
                {ch.length} section{ch.length > 1 ? 's have' : ' has'} unpublished changes:
              </p>
              <ul className="adm-chlist">
                {ch.map((k) => (
                  <li key={k}>{LABEL[k]}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="adm-ok">
              <Ic n="check" />
              Everything is published. Your site matches what you see here.
            </p>
          )}
          <p className="adm-muted">
            {base.updatedAt
              ? `Last published ${new Date(base.updatedAt).toLocaleString()}`
              : 'Not published from the studio yet.'}
          </p>
          <Checks />
          <h3 className="adm-mt">How it works</h3>
          <ol className="adm-how">
            <li>Edit anything in the tabs on the left.</li>
            <li>
              Press <b>Preview</b> to see the real site with your changes, privately.
            </li>
            <li>
              Press <b>Publish changes</b> and everyone sees the update.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}

/** Things worth a look before publishing. Each one opens the tab where it can be fixed. */
function Checks() {
  const { d, show } = useStudio();
  const items: { ok: boolean; text: string; tab: Parameters<typeof show>[0] }[] = [];
  const noVisual = d.projects.filter((p) => p.visible && !p.image && !p.demo);
  const noBullets = d.experience.filter((e) => !e.milestone && !e.bullets.some((b) => b.trim()));
  const offCv =
    d.projects.filter((p) => p.visible && !p.cv).length + d.experience.filter((e) => !e.milestone && !e.cv).length;
  const summary = d.cv.summary.trim().length;
  const hiddenSections = d.cv.sections.filter((s) => !s.visible).length;
  if (noVisual.length)
    items.push({
      ok: false,
      text: `${noVisual.length} project${noVisual.length > 1 ? 's have' : ' has'} no screenshot or demo`,
      tab: 'projects',
    });
  if (noBullets.length)
    items.push({
      ok: false,
      text: `${noBullets.length} role${noBullets.length > 1 ? 's have' : ' has'} no bullets, so the CV shows only the title`,
      tab: 'experience',
    });
  if (summary > 900) items.push({ ok: false, text: `Your CV summary is long (${summary} characters)`, tab: 'cv' });
  if (offCv)
    items.push({
      ok: true,
      text: `${offCv} item${offCv > 1 ? 's are' : ' is'} left off your CV on purpose`,
      tab: 'cv',
    });
  if (hiddenSections)
    items.push({
      ok: true,
      text: `${hiddenSections} CV section${hiddenSections > 1 ? 's are' : ' is'} switched off`,
      tab: 'cv',
    });
  return (
    <>
      <h3 className="adm-mt">Checks</h3>
      {items.length ? (
        <ul className="adm-checks">
          {items.map((it) => (
            <li key={it.text}>
              <button type="button" className={it.ok ? 'info' : 'warn'} onClick={() => show(it.tab)}>
                <Ic n={it.ok ? 'info' : 'warn'} />
                <span>{it.text}</span>
                <Ic n="arrow" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-ok">
          <Ic n="check" />
          Every project has a visual, every role has bullets, and your CV is in good shape.
        </p>
      )}
    </>
  );
}

/** What the drawer specs need to save their changes. */
type SpecCtx = { update: (fn: (d: SiteContent) => void) => void; toast: (m: string) => void };

/* ---------- projects ---------- */

function projectPreview(p: Obj) {
  const tags = ((p.tags as string[]) ?? []).slice(0, 4);
  return (
    <>
      <p className="adm-pvl">Live preview</p>
      <div className="adm-pvcard">
        <span className="adm-pvic">
          <Icon name={String(p.icon || p.demo)} />
        </span>
        <div>
          <small>{String(p.kind || 'Category')}</small>
          <b>{String(p.title || 'Project title')}</b>
          <p>{String(p.summary || 'A short summary of what the project does appears here.')}</p>
          {p.image && !DEMO_LABELS[String(p.demo)] ? <img src={String(p.image)} alt="" /> : null}
          <div className="adm-pvtags">
            {tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function projectSpec(p: Project | null, { update, toast }: SpecCtx) {
  const cur: Obj = p
    ? clone(p)
    : {
        id: '',
        title: '',
        short: '',
        kind: '',
        tagline: '',
        summary: '',
        reel: '',
        features: [],
        tags: [],
        github: '',
        live: '',
        demo: '',
        icon: 'rocket',
        image: '',
        visible: true,
        home: true,
        cv: true,
        cvBullets: [],
      };
  const demoChoices: [string, string][] = [['', 'No demo, screenshot or text only']];
  if (cur.demo && DEMO_LABELS[String(cur.demo)])
    demoChoices.unshift([String(cur.demo), `${DEMO_LABELS[String(cur.demo)]} (built in)`]);
  const fields = (): Field[] => [
    { kind: 'section', label: 'Basics' },
    { kind: 'text', key: 'title', label: 'Project title', req: true, max: 120, ph: 'e.g. Invoice extraction agent' },
    {
      kind: 'text',
      key: 'kind',
      label: 'Category',
      req: true,
      max: 80,
      ph: 'e.g. AI assistant, Backend, Mobile app',
      help: 'Small label shown above the title.',
    },
    {
      kind: 'text',
      key: 'summary',
      label: 'Summary',
      req: true,
      area: true,
      rows: 3,
      max: 600,
      ph: 'One or two sentences on what it does and for whom.',
    },
    { kind: 'section', label: 'Details' },
    {
      kind: 'lines',
      key: 'features',
      label: 'Key features',
      req: true,
      ph: 'e.g. Answers questions from SharePoint documents',
      addLabel: 'Add feature',
      help: 'Short, concrete points. Three to five works best.',
    },
    { kind: 'chips', key: 'tags', label: 'Tech stack', req: true, ph: 'e.g. C#, Azure OpenAI' },
    { kind: 'section', label: 'Links' },
    { kind: 'text', key: 'github', label: 'GitHub link', url: true, ph: 'https://github.com/...' },
    { kind: 'text', key: 'live', label: 'Live site link', url: true, ph: 'https://...' },
    { kind: 'section', label: 'Visual' },
    {
      kind: 'select',
      key: 'demo',
      label: 'Demo on the Projects page',
      choices: demoChoices,
      help: 'Built-in demos stay attached to their project. New projects can show a screenshot instead.',
    },
    { kind: 'image', key: 'image', label: 'Screenshot' },
    { kind: 'select', key: 'icon', label: 'Icon', choices: ICON_CHOICES },
    { kind: 'section', label: 'Where it appears' },
    { kind: 'text', key: 'short', label: 'Short name for the side menu', max: 60, ph: 'Defaults to the title' },
    { kind: 'text', key: 'tagline', label: 'Side menu subtitle', max: 60, ph: 'Defaults to the category' },
    {
      kind: 'text',
      key: 'reel',
      label: 'Home page card text',
      area: true,
      rows: 2,
      max: 300,
      ph: 'Defaults to the summary',
    },
    { kind: 'toggle', key: 'visible', label: 'Show on the site', help: 'Turn off to keep it as a hidden draft.' },
    { kind: 'toggle', key: 'home', label: 'Show on the home page', help: 'Adds it to the "Selected projects" row.' },
    { kind: 'section', label: 'On your CV' },
    { kind: 'toggle', key: 'cv', label: 'Include on the CV', help: 'New projects are on the CV automatically.' },
    {
      kind: 'lines',
      key: 'cvBullets',
      label: 'CV bullets',
      ph: 'e.g. Users ask questions about SharePoint files from WhatsApp',
      addLabel: 'Add CV bullet',
      help: 'Optional. Leave empty and the CV uses the summary or the key features, as set in the CV tab.',
    },
  ];
  const onSave = (c: Obj) =>
    update((x) => {
      if (!p) {
        c.id = slug(String(c.title), x.projects);
        x.projects.unshift(c as unknown as Project);
        toast('Project added. Publish to make it live.');
      } else {
        x.projects[x.projects.findIndex((y) => y.id === p.id)] = c as unknown as Project;
        toast('Project updated');
      }
    });
  return { title: p ? 'Edit project' : 'Add project', cur, fields, preview: projectPreview, onSave };
}

export function ProjectsView() {
  const { d, update, open } = useStudio();
  const { toast } = useUi();
  const [q, setQ] = useState('');
  const ctx = { update, toast };
  return (
    <>
      <Head
        title="Projects"
        desc='Shown on the Projects page and in the "Selected projects" row on the home page. Drag rows to change the order.'
        actions={<AddBtn label="Add project" onClick={() => open(projectSpec(null, ctx))} />}
      />
      <FilterBar ph="Search projects" q={q} setQ={setQ} />
      <Rows
        q={q}
        items={d.projects}
        title={(p) => p.title}
        icon={(p) => <Icon name={p.icon || p.demo} />}
        sub={(p) => (
          <>
            {p.kind}{' '}
            {p.demo && DEMO_LABELS[p.demo] ? (
              <span className="adm-tag">Live demo</span>
            ) : p.image ? (
              <span className="adm-tag">Screenshot</span>
            ) : null}{' '}
            {p.visible === false ? (
              <span className="adm-tag warn">Hidden</span>
            ) : p.home === false ? (
              <span className="adm-tag">Not on home</span>
            ) : null}
          </>
        )}
        hidden={(p) => p.visible === false}
        toggle={(p) => update((x) => void (x.projects.find((y) => y.id === p.id)!.visible = p.visible === false))}
        move={(from, to) => update((x) => moveIn(x.projects, from, to))}
        edit={(p) => open(projectSpec(p, ctx))}
        remove={(p) => update((x) => void (x.projects = x.projects.filter((y) => y.id !== p.id)))}
        emptyTitle="No projects yet"
        emptyText="Add your first project to show it on the site."
      />
    </>
  );
}

/* ---------- experience ---------- */

function rolePreview(e: Obj) {
  if (e.milestone)
    return (
      <>
        <p className="adm-pvl">Live preview</p>
        <div className="adm-pvms">
          <Ic n="about" />
          <div>
            <b>{String(e.title || 'Milestone title')}</b>
            <span>
              {String(e.org || 'Where')}, {fmtM(e.start as string)}
            </span>
          </div>
        </div>
      </>
    );
  const metrics = ((e.metrics as string[][]) ?? []).filter((m) => m[0]);
  return (
    <>
      <p className="adm-pvl">Live preview</p>
      <div className="adm-pvcard">
        <span className="adm-pvic">
          <b>{String(e.org || '?').charAt(0)}</b>
        </span>
        <div>
          <small>
            {String(e.org || 'Company')}, {e.start ? fmtM(e.start as string) : 'Start'} to{' '}
            {e.current ? 'Present' : e.end ? fmtM(e.end as string) : 'End'}
          </small>
          <b>{String(e.title || 'Role title')}</b>
          {metrics.length > 0 && (
            <div className="adm-pvm">
              {metrics.map((m, i) => (
                <span key={i}>
                  <i>{m[0]}</i>
                  {m[1]}
                </span>
              ))}
            </div>
          )}
          <p>{((e.bullets as string[]) ?? [])[0] || 'Your first bullet point appears here.'}</p>
        </div>
      </div>
    </>
  );
}

const TYPES: [string, string][] = [
  ['', 'No badge'],
  ['Internship', 'Internship'],
  ['Part-time internship', 'Part-time internship'],
  ['Part-time', 'Part-time'],
  ['Full-time', 'Full-time'],
  ['Freelance', 'Freelance'],
  ['Contract', 'Contract'],
];

export function roleSpec(e: Experience | null, ms: boolean, { update, toast }: SpecCtx) {
  const cur: Obj = e
    ? { ...clone(e), end: e.end ?? '' }
    : ms
      ? { id: '', title: '', org: '', start: '', milestone: true, cv: true }
      : {
          id: '',
          title: '',
          short: '',
          org: '',
          start: '',
          end: '',
          type: '',
          metrics: [],
          bullets: [],
          tags: [],
          milestone: false,
          cv: true,
        };
  if (!ms) {
    cur.current = Boolean(e) && !e?.end;
    if (cur.type === 'Current') cur.type = '';
  }
  const types = [...TYPES];
  if (cur.type && !types.some((t) => t[0] === cur.type)) types.push([String(cur.type), String(cur.type)]);
  const fields = (c: Obj): Field[] =>
    ms
      ? [
          {
            kind: 'note',
            body: 'Milestones mark moments like a graduation or a big launch. They show as a badge on the timeline and a dashed line on the chart.',
          },
          {
            kind: 'text',
            key: 'title',
            label: 'Milestone',
            req: true,
            max: 120,
            ph: 'e.g. Graduated, BSc in Computer Science',
          },
          { kind: 'text', key: 'org', label: 'Where', req: true, max: 120, ph: 'e.g. Antonine University' },
          { kind: 'month', key: 'start', label: 'When', req: true },
        ]
      : [
          { kind: 'section', label: 'Role' },
          { kind: 'text', key: 'title', label: 'Job title', req: true, max: 120, ph: 'e.g. Senior AI Engineer' },
          {
            kind: 'text',
            key: 'org',
            label: 'Company',
            req: true,
            max: 120,
            ph: 'e.g. SoftFlow Group',
            help: 'Roles at the same company share one row on the chart.',
          },
          { kind: 'select', key: 'type', label: 'Badge', choices: types },
          { kind: 'section', label: 'Dates' },
          { kind: 'month', key: 'start', label: 'Start month', req: true },
          { kind: 'toggle', key: 'current', label: 'I currently work here', help: 'Shows "present" and a live badge.' },
          {
            kind: 'month',
            key: 'end',
            label: 'End month',
            req: !c.current,
            after: String(c.start || ''),
            hidden: Boolean(c.current),
          },
          { kind: 'section', label: 'Highlights' },
          { kind: 'metrics', key: 'metrics', label: 'Key numbers' },
          {
            kind: 'lines',
            key: 'bullets',
            label: 'What you did',
            req: true,
            ph: 'Start with a verb: Built, Led, Designed...',
            addLabel: 'Add bullet',
          },
          { kind: 'chips', key: 'tags', label: 'Tools and tech', ph: 'e.g. Azure OpenAI' },
          { kind: 'section', label: 'Chart' },
          {
            kind: 'text',
            key: 'short',
            label: 'Label on the chart bar',
            max: 20,
            ph: 'e.g. Tech Lead',
            help: 'Keep it very short. Defaults to the job title.',
          },
          { kind: 'section', label: 'On your CV' },
          {
            kind: 'toggle',
            key: 'cv',
            label: 'Include on the CV',
            help: 'New roles are on the CV automatically, with these bullets.',
          },
        ];
  return {
    title: e ? (ms ? 'Edit milestone' : 'Edit role') : ms ? 'Add milestone' : 'Add role',
    cur,
    fields,
    preview: rolePreview,
    onSave: (c: Obj) => {
      if (!ms) {
        if (c.current || !c.end) c.end = null;
        delete c.current;
      }
      update((x) => {
        if (!e) {
          c.id = slug(String(c.title), x.experience);
          x.experience.push(c as unknown as Experience);
          toast(ms ? 'Milestone added' : 'Role added. Publish to make it live.');
        } else {
          x.experience[x.experience.findIndex((y) => y.id === e.id)] = c as unknown as Experience;
          toast('Saved');
        }
      });
    },
  };
}

export function ExperienceView() {
  const { d, update, open } = useStudio();
  const { toast } = useUi();
  const ctx = { update, toast };
  const sorted = [...d.experience].sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  return (
    <>
      <Head
        title="Experience"
        desc="Your roles appear on the timeline and chart, sorted by date automatically. Milestones such as graduations sit between roles."
        actions={
          <>
            <AddBtn ghost label="Add milestone" onClick={() => open(roleSpec(null, true, ctx))} />
            <AddBtn label="Add role" onClick={() => open(roleSpec(null, false, ctx))} />
          </>
        }
      />
      <Rows
        items={sorted}
        title={(e) => e.title}
        icon={(e) => (e.milestone ? <Ic n="star" /> : <b className="adm-co">{(e.org || '?').charAt(0)}</b>)}
        sub={(e) =>
          e.milestone ? (
            <>
              {e.org}, {fmtM(e.start)} <span className="adm-tag">Milestone</span>
            </>
          ) : (
            <>
              {e.org}, {fmtM(e.start)} to {fmtM(e.end)} {!e.end && <span className="adm-tag ok">Current</span>}
            </>
          )
        }
        edit={(e) => open(roleSpec(e, !!e.milestone, ctx))}
        remove={(e) => update((x) => void (x.experience = x.experience.filter((y) => y.id !== e.id)))}
        emptyTitle="No experience yet"
        emptyText="Add your first role."
      />
    </>
  );
}

/* ---------- skills ---------- */

export function SkillsView() {
  const { d, update, open } = useStudio();
  const { ask, toast } = useUi();
  const edit = (cat: SkillCategory | null, i?: number) =>
    open({
      title: cat ? 'Edit category' : 'Add skill category',
      cur: cat ? clone(cat) : { name: '', desc: '', items: [] },
      fields: () => [
        { kind: 'text', key: 'name', label: 'Category name', req: true, max: 80, ph: 'e.g. Cloud and DevOps' },
        {
          kind: 'text',
          key: 'desc',
          label: 'Short description',
          area: true,
          rows: 2,
          max: 300,
          help: 'Only shown for the first, featured category.',
        },
        { kind: 'chips', key: 'items', label: 'Skills', req: true },
      ],
      onSave: (c) =>
        update((x) => {
          if (i === undefined) {
            x.skills.push(c as unknown as SkillCategory);
            toast('Category added');
          } else {
            x.skills[i] = c as unknown as SkillCategory;
            toast('Saved');
          }
        }),
    });
  return (
    <>
      <Head
        title="Skills"
        desc='Shown on the About page. The first category is featured in a larger card. Echo also uses these to answer "does he know…" questions.'
        actions={<AddBtn label="Add category" onClick={() => edit(null)} />}
      />
      <div className="adm-skgrid">
        {d.skills.map((cat, i) => (
          <div key={i} className={`adm-skcard${i === 0 ? ' lead' : ''}`}>
            <header>
              <b>{cat.name}</b>
              {i === 0 && <span className="adm-tag ok">Featured</span>}
              <div>
                <button
                  type="button"
                  className="adm-ibtn sm"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => update((x) => moveIn(x.skills, i, i - 1))}
                >
                  <Ic n="up" />
                </button>
                <button
                  type="button"
                  className="adm-ibtn sm"
                  aria-label="Move down"
                  disabled={i === d.skills.length - 1}
                  onClick={() => update((x) => moveIn(x.skills, i, i + 1))}
                >
                  <Ic n="down" />
                </button>
                <button type="button" className="adm-ibtn sm" aria-label="Edit" onClick={() => edit(cat, i)}>
                  <Ic n="edit" />
                </button>
                <button
                  type="button"
                  className="adm-ibtn sm danger"
                  aria-label="Delete"
                  onClick={async () => {
                    if (
                      await ask({
                        title: `Delete the "${cat.name}" category?`,
                        text: `All ${cat.items.length} skills in it will be removed when you publish.`,
                        ok: 'Delete',
                        danger: true,
                      })
                    ) {
                      update((x) => void x.skills.splice(i, 1));
                      toast('Category deleted');
                    }
                  }}
                >
                  <Ic n="del" />
                </button>
              </div>
            </header>
            <div className="adm-skchips">
              <ChipsField
                label={`Skills in ${cat.name}`}
                value={cat.items}
                ph="Add a skill and press Enter"
                onChange={(v) => update((x) => void (x.skills[i].items = v))}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- services ---------- */

function servicePreview(s: Obj) {
  const k = visualKey(String(s.visual));
  return (
    <>
      <p className="adm-pvl">Live preview</p>
      <div className={`bt-tile adm-pvtile bt-${k}`}>
        <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: SERVICE_VISUALS[k] }} />
        <span className="bt-txt">
          <b>{String(s.title || 'Service title')}</b>
          <span>{String(s.desc || 'What you offer, in a sentence or two.')}</span>
          {s.proof ? <small>{String(s.proof)}</small> : null}
        </span>
      </div>
    </>
  );
}

export function ServicesView() {
  const { d, update, open } = useStudio();
  const { toast } = useUi();
  const edit = (s: Service | null) =>
    open({
      title: s ? 'Edit service' : 'Add service',
      cur: s ? clone(s) : { id: '', visual: 'generic', chip: '', title: '', desc: '', proof: '', visible: true },
      preview: servicePreview,
      fields: () => [
        { kind: 'text', key: 'title', label: 'Service name', req: true, max: 100, ph: 'e.g. Data dashboards' },
        { kind: 'text', key: 'desc', label: 'Description', req: true, area: true, rows: 3, max: 500 },
        {
          kind: 'text',
          key: 'proof',
          label: 'Proof line',
          max: 240,
          ph: 'e.g. Delivered 12 SPFx web parts',
          help: 'A real result from your work. Keep it factual.',
        },
        { kind: 'text', key: 'chip', label: 'Label in the request form', max: 60, ph: 'Defaults to the service name' },
        { kind: 'select', key: 'visual', label: 'Animation', choices: VISUAL_CHOICES },
        { kind: 'toggle', key: 'visible', label: 'Show on the site' },
      ],
      onSave: (c) =>
        update((x) => {
          if (!c.chip) c.chip = c.title;
          if (!s) {
            c.id = slug(String(c.title), x.services);
            x.services.push(c as unknown as Service);
            toast('Service added');
          } else {
            x.services[x.services.findIndex((y) => y.id === s.id)] = c as unknown as Service;
            toast('Saved');
          }
        }),
    });
  return (
    <>
      <Head
        title="Services"
        desc="The cards on the Services page. Visitors tap them to build a request. Drag to reorder. The first card is shown large."
        actions={<AddBtn label="Add service" onClick={() => edit(null)} />}
      />
      <Rows
        items={d.services}
        title={(s) => s.title}
        icon={(s) => <b className="adm-co">{(s.visual || '?').slice(0, 2).toUpperCase()}</b>}
        sub={(s) => (
          <>
            {s.desc.slice(0, 90)}
            {s.desc.length > 90 ? '…' : ''} {s.visible === false && <span className="adm-tag warn">Hidden</span>}
          </>
        )}
        hidden={(s) => s.visible === false}
        toggle={(s) => update((x) => void (x.services.find((y) => y.id === s.id)!.visible = s.visible === false))}
        move={(from, to) => update((x) => moveIn(x.services, from, to))}
        edit={(s) => edit(s)}
        remove={(s) => update((x) => void (x.services = x.services.filter((y) => y.id !== s.id)))}
        emptyTitle="No services yet"
        emptyText="Add a service you offer."
      />
    </>
  );
}

/* ---------- profile (inline forms) ---------- */

function InlineForm({ fields, obj, onChange }: { fields: Field[]; obj: Obj; onChange: (o: Obj) => void }) {
  const [errs, setErrs] = useState<Record<string, string | null>>({});
  return (
    <div className="adm-card adm-form">
      {fields.map((f, i) => (
        <FieldView
          key={'key' in f ? f.key : i}
          f={f}
          o={obj}
          err={'key' in f ? errs[f.key] : null}
          setErr={(k, e) => setErrs((x) => ({ ...x, [k]: e }))}
          set={(k, v) => {
            const n = { ...obj, [k]: v };
            const f2 = fields.find((x) => 'key' in x && x.key === k);
            if (f2) setErrs((x) => ({ ...x, [k]: validateField(f2, n) }));
            onChange(n);
          }}
        />
      ))}
    </div>
  );
}

export function ProfileView() {
  const { d, update } = useStudio();
  const p = d.profile as unknown as Obj;
  const setP = (n: Obj) => update((x) => void (x.profile = n as unknown as SiteContent['profile']));
  return (
    <>
      <Head
        title="Profile and home"
        desc="Your home page intro, contact details and highlight numbers. Changes save as you type."
      />
      <h3 className="adm-h3">Home intro</h3>
      <InlineForm
        obj={p}
        onChange={setP}
        fields={[
          { kind: 'text', key: 'status', label: 'Status pill', max: 120, ph: 'Open to relocation and new projects' },
          { kind: 'text', key: 'hello', label: 'Greeting', max: 80 },
          {
            kind: 'text',
            key: 'headline',
            label: 'Headline start',
            req: true,
            max: 80,
            help: 'Followed by the rotating words below.',
          },
          {
            kind: 'chips',
            key: 'rotating',
            label: 'Rotating words',
            req: true,
            help: (
              <>
                Each one appears in turn after the headline. End them with a period. Press <kbd>Enter</kbd> to add.
              </>
            ),
          },
          { kind: 'text', key: 'intro', label: 'Intro, bold part', max: 200 },
          { kind: 'text', key: 'introRest', label: 'Intro, rest', area: true, rows: 2, max: 400 },
        ]}
      />
      <h3 className="adm-h3">Contact details</h3>
      <InlineForm
        obj={p}
        onChange={setP}
        fields={[
          { kind: 'note', body: 'These update every email link, WhatsApp button and profile link across the site.' },
          { kind: 'text', key: 'email', label: 'Email', req: true, email: true },
          {
            kind: 'text',
            key: 'whatsapp',
            label: 'WhatsApp number',
            req: true,
            digits: true,
            help: 'Country code and number, digits only.',
          },
          { kind: 'text', key: 'phone', label: 'Phone, as displayed', max: 30 },
          { kind: 'text', key: 'linkedin', label: 'LinkedIn link', req: true, url: true },
          { kind: 'text', key: 'github', label: 'GitHub link', req: true, url: true },
        ]}
      />
      <h3 className="adm-h3">Highlights</h3>
      <div className="adm-card">
        <p className="adm-muted">
          The four big numbers on the home page. Plain numbers count up when visitors scroll to them.
        </p>
        <div className="adm-hl">
          {d.highlights.map((h, i) => (
            <div className="adm-metric wide" key={i}>
              <input
                value={h.n}
                maxLength={12}
                aria-label={`Number ${i + 1}`}
                onChange={(e) => update((x) => void (x.highlights[i].n = e.target.value))}
              />
              <input
                value={h.t}
                maxLength={160}
                aria-label={`Label ${i + 1}`}
                onChange={(e) => update((x) => void (x.highlights[i].t = e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>
      <h3 className="adm-h3">Experience page</h3>
      <InlineForm
        obj={p}
        onChange={setP}
        fields={[
          {
            kind: 'text',
            key: 'teamStat',
            label: 'Developers you lead today',
            max: 10,
            help: 'Shown in the Experience page stats.',
          },
        ]}
      />
    </>
  );
}

/* ---------- about details ---------- */

type ListKey = 'education' | 'certifications' | 'languages' | 'volunteering';

function Repeater({ title, k, ph1, ph2 }: { title: string; k: ListKey; ph1: string; ph2: string }) {
  const { d, update } = useStudio();
  const { toast } = useUi();
  const list = d[k];
  return (
    <>
      <h3 className="adm-h3">{title}</h3>
      <div className="adm-card">
        <div className="adm-rep">
          {list.map((x, i) => (
            <div className="adm-repr" key={i}>
              <input
                value={x.title}
                placeholder={ph1}
                aria-label={ph1}
                maxLength={160}
                onChange={(e) => update((s) => void (s[k][i].title = e.target.value))}
              />
              <input
                value={x.detail}
                placeholder={ph2}
                aria-label={ph2}
                maxLength={300}
                onChange={(e) => update((s) => void (s[k][i].detail = e.target.value))}
              />
              <div className="adm-lact">
                <button
                  type="button"
                  className="adm-ibtn sm"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => update((s) => moveIn(s[k], i, i - 1))}
                >
                  <Ic n="up" />
                </button>
                <button
                  type="button"
                  className="adm-ibtn sm"
                  aria-label="Move down"
                  disabled={i === list.length - 1}
                  onClick={() => update((s) => moveIn(s[k], i, i + 1))}
                >
                  <Ic n="down" />
                </button>
                <button
                  type="button"
                  className="adm-ibtn sm danger"
                  aria-label="Remove"
                  onClick={() => {
                    update((s) => void s[k].splice(i, 1));
                    toast('Removed');
                  }}
                >
                  <Ic n="x" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="adm-add"
          onClick={() => update((s) => void s[k].push({ title: '', detail: '' }))}
        >
          <Ic n="plus" />
          Add
        </button>
      </div>
    </>
  );
}

export function AboutView() {
  const { d, update } = useStudio();
  return (
    <>
      <Head
        title="About details"
        desc="Education, certifications, languages and volunteering on the About page, and the clients shown on the Experience page."
      />
      <Repeater title="Education" k="education" ph1="Degree" ph2="School and date" />
      <Repeater title="Certifications" k="certifications" ph1="Certificate name" ph2="Issuer, year, details" />
      <Repeater title="Languages" k="languages" ph1="Language" ph2="Level" />
      <Repeater title="Volunteering" k="volunteering" ph1="Organization" ph2="What you did" />
      <h3 className="adm-h3">Clients</h3>
      <div className="adm-card adm-form">
        <ChipsField
          label="Clients you have delivered for"
          help="Shown under the chart on the Experience page."
          value={d.clients}
          onChange={(v) => update((x) => void (x.clients = v))}
        />
      </div>
    </>
  );
}

/* ---------- backup and restore ---------- */

export function DataView() {
  const { d, replace, show } = useStudio();
  const { ask, toast } = useUi();
  const [paste, setPaste] = useState('');
  const json = () => JSON.stringify(d, null, 2);
  const load = async (txt: string) => {
    let o: unknown;
    try {
      o = JSON.parse(txt);
    } catch {
      return toast('That is not valid JSON.', 'err');
    }
    const parsed = siteContentSchema.safeParse(o);
    if (!parsed.success) return toast('That file does not look like portfolio content.', 'err');
    if (
      await ask({
        title: 'Replace your draft with this file?',
        text: 'Your current unpublished edits will be replaced. The live site does not change until you publish.',
        ok: 'Load file',
      })
    ) {
      replace(parsed.data);
      show('overview');
      toast('Content loaded. Review it, then publish.');
    }
  };
  return (
    <>
      <Head
        title="Backup and restore"
        desc="Download a copy of all your content, or load one back. Handy before big edits."
      />
      <div className="adm-grid2">
        <div className="adm-card">
          <h3>Export</h3>
          <p className="adm-muted">Everything you see in the studio, including unpublished changes, as a JSON file.</p>
          <div className="adm-row2">
            <button
              type="button"
              className="adm-btn primary"
              onClick={() => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([json()], { type: 'application/json' }));
                a.download = `portfolio-content-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              }}
            >
              <Ic n="data" />
              Download JSON
            </button>
            <button
              type="button"
              className="adm-btn ghost"
              onClick={() =>
                void copyText(json()).then((ok) =>
                  toast(ok ? 'Copied to clipboard' : 'Copy failed. Use Download instead.', ok ? '' : 'err'),
                )
              }
            >
              <Ic n="copy" />
              Copy to clipboard
            </button>
          </div>
        </div>
        <div className="adm-card">
          <h3>Import</h3>
          <p className="adm-muted">
            Load a JSON file you exported before. It replaces your current draft. Nothing goes live until you publish.
          </p>
          <label className="adm-btn ghost adm-filebtn">
            <Ic n="up" />
            Choose JSON file
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void f.text().then(load);
              }}
            />
          </label>
          <textarea
            rows={4}
            placeholder="Or paste JSON here"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button type="button" className="adm-btn ghost" onClick={() => void load(paste)}>
            Load pasted JSON
          </button>
        </div>
      </div>
    </>
  );
}

/** Sidebar tabs: [tab, label, icon, group]. A new group starts a new heading. */
export const TABS: [Parameters<ReturnType<typeof useStudio>['show']>[0], string, IconName, string][] = [
  ['overview', 'Overview', 'overview', 'Start'],
  ['requests', 'Requests', 'requests', 'Start'],
  ['visitors', 'Visitors', 'chart', 'Start'],
  ['projects', 'Projects', 'projects', 'Your work'],
  ['experience', 'Experience', 'experience', 'Your work'],
  ['skills', 'Skills', 'skills', 'Your work'],
  ['services', 'Services', 'services', 'Your work'],
  ['about', 'About details', 'about', 'Your work'],
  ['cv', 'CV', 'cv', 'Pages'],
  ['profile', 'Profile and home', 'profile', 'Pages'],
  ['pages', 'Page text', 'text', 'Pages'],
  ['data', 'Backup and restore', 'data', 'Settings'],
  ['activity', 'Activity', 'activity', 'Settings'],
  ['account', 'Account', 'lock', 'Settings'],
];
