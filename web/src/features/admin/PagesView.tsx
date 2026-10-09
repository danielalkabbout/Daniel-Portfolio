import { useState } from 'react';
import { DEFAULT_PAGES } from '../../content/defaults';
import type { PageKey, PageText } from '../../types/content';
import { FieldView, type Field } from './fields';
import { Ic, useUi } from './ui';
import { useStudio, type Obj } from './studio-state';
import { Head } from './views';
import { PageSections } from './PageSections';

type Block = Exclude<keyof PageText, 'steps'>;

/** Which text blocks each page has, and what they are called there. */
const PAGES: {
  key: PageKey;
  label: string;
  path: string;
  fields: [Block, string, Partial<Field>?][];
  steps?: boolean;
}[] = [
  {
    key: 'home',
    label: 'Home',
    path: '/',
    fields: [
      [
        'lead',
        'Manifesto',
        {
          area: true,
          rows: 4,
          max: 300,
          help: 'The big statement that lights up word by word as visitors scroll.',
        } as Partial<Field>,
      ],
      ['items', 'What I work on (moving strip)'],
    ],
  },
  {
    key: 'about',
    label: 'About',
    path: '/about',
    fields: [
      ['kicker', 'Small label above the title'],
      ['title', 'Title', { max: 160 } as Partial<Field>],
      ['intro', 'Line under the title', { max: 400 } as Partial<Field>],
      ['lead', 'Opening sentence (large)', { area: true, rows: 2, max: 300 } as Partial<Field>],
      ['paragraphs', 'Your story, one paragraph per line'],
    ],
  },
  {
    key: 'experience',
    label: 'Experience',
    path: '/experience',
    fields: [
      ['kicker', 'Small label above the title'],
      ['title', 'Title', { max: 160 } as Partial<Field>],
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    path: '/projects',
    fields: [
      ['kicker', 'Small label above the title'],
      ['title', 'Title', { max: 160 } as Partial<Field>],
      ['intro', 'Line under the title', { max: 400 } as Partial<Field>],
    ],
  },
  {
    key: 'services',
    label: 'Services',
    path: '/services',
    fields: [
      ['kicker', 'Small label above the title'],
      ['title', 'Title', { max: 160 } as Partial<Field>],
      ['accent', 'Second line, in colour', { max: 80 } as Partial<Field>],
      ['intro', 'Line under the title', { area: true, rows: 2, max: 400 } as Partial<Field>],
    ],
    steps: true,
  },
  {
    key: 'cv',
    label: 'CV page',
    path: '/cv',
    fields: [
      ['title', 'Title', { max: 160 } as Partial<Field>],
      ['intro', 'Line under the title', { area: true, rows: 2, max: 400 } as Partial<Field>],
    ],
  },
  {
    key: 'footer',
    label: 'Footer',
    path: '/',
    fields: [
      ['kicker', 'Label with the green dot', { max: 60 } as Partial<Field>],
      ['title', 'Big question', { max: 160 } as Partial<Field>],
      ['accent', 'Answer, in colour', { max: 80 } as Partial<Field>],
      ['intro', 'About you, under the links', { area: true, rows: 2, max: 400 } as Partial<Field>],
    ],
  },
];

function toField([key, label, extra]: [Block, string, Partial<Field>?]): Field {
  if (key === 'paragraphs') return { kind: 'lines', key, label, addLabel: 'Add paragraph', ph: 'Write a paragraph…' };
  if (key === 'items')
    return { kind: 'chips', key, label, ph: 'e.g. Microsoft Teams', help: 'Press Enter to add. Shown in this order.' };
  return { kind: 'text', key, label, max: 160, ...(extra as object) } as Field;
}

/** A small, faithful sketch of the page's heading so changes are visible at once. */
function Sketch({ k, t }: { k: PageKey; t: PageText }) {
  if (k === 'home')
    return (
      <div className="adm-sketch">
        <p className="adm-sketch-lead">{t.lead}</p>
        <div className="adm-sketch-strip">
          {t.items.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
      </div>
    );
  return (
    <div className="adm-sketch">
      {t.kicker && <p className="adm-sketch-kicker">{t.kicker}</p>}
      <p className="adm-sketch-title">
        {t.title}
        {t.accent && (
          <>
            <br />
            <span>{t.accent}</span>
          </>
        )}
      </p>
      {k === 'about' && t.lead && <p className="adm-sketch-big">{t.lead}</p>}
      {t.intro && <p className="adm-sketch-intro">{t.intro}</p>}
    </div>
  );
}

export function PagesView() {
  const { d, update } = useStudio();
  const { ask, toast } = useUi();
  const [key, setKey] = useState<PageKey>('home');
  const [errs, setErrs] = useState<Record<string, string | null>>({});
  const page = PAGES.find((p) => p.key === key)!;
  const t = d.pages[key];
  const fields = page.fields.map(toField);

  const setText = (k: string, v: unknown) => update((x) => void ((x.pages[key] as unknown as Obj)[k] = v));

  const reset = async () => {
    if (
      !(await ask({
        title: `Reset the ${page.label} text?`,
        text: 'Every field and section on this page goes back to the original text.',
        ok: 'Reset',
        danger: true,
      }))
    )
      return;
    update((x) => void (x.pages[key] = structuredClone(DEFAULT_PAGES[key])));
    toast(`${page.label} text reset`);
  };

  return (
    <>
      <Head
        title="Page text"
        desc="Every heading, button, card and line of text on each page. Pick a page, edit its sections, and publish when ready."
        actions={
          <button type="button" className="adm-btn ghost" onClick={() => void reset()}>
            <Ic n="reset" />
            Reset this page
          </button>
        }
      />
      <div className="adm-seg adm-pages-seg" role="tablist" aria-label="Page">
        {PAGES.map((p) => (
          <button key={p.key} type="button" role="tab" aria-selected={p.key === key} onClick={() => setKey(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="adm-pages">
        <div className="adm-pages-main">
          <div className="adm-card adm-form">
            {fields.map((f) => (
              <FieldView
                key={`${key}-${'key' in f ? f.key : ''}`}
                f={f}
                o={t as unknown as Obj}
                set={setText}
                err={'key' in f ? errs[f.key] : null}
                setErr={(k, e) => setErrs((x) => ({ ...x, [k]: e }))}
              />
            ))}
            {page.steps && (
              <div className="adm-field">
                <label>How we'd work together (numbered steps)</label>
                <ol className="adm-steps">
                  {t.steps.map((s, i) => (
                    <li key={i}>
                      <span className="adm-steps-n">{i + 1}</span>
                      <div>
                        <input
                          value={s.title}
                          maxLength={60}
                          aria-label={`Step ${i + 1} title`}
                          placeholder="Step title"
                          onChange={(e) => update((x) => void (x.pages.services.steps[i].title = e.target.value))}
                        />
                        <textarea
                          value={s.detail}
                          rows={2}
                          maxLength={300}
                          aria-label={`Step ${i + 1} text`}
                          placeholder="What happens in this step"
                          onChange={(e) => update((x) => void (x.pages.services.steps[i].detail = e.target.value))}
                        />
                      </div>
                      <button
                        type="button"
                        className="adm-ibtn"
                        aria-label={`Remove step ${i + 1}`}
                        onClick={() => update((x) => void x.pages.services.steps.splice(i, 1))}
                      >
                        <Ic n="del" />
                      </button>
                    </li>
                  ))}
                </ol>
                {t.steps.length < 6 && (
                  <button
                    type="button"
                    className="adm-add"
                    onClick={() => update((x) => void x.pages.services.steps.push({ title: '', detail: '' }))}
                  >
                    <Ic n="plus" />
                    Add step
                  </button>
                )}
              </div>
            )}
            <p className="adm-muted adm-pages-note">
              <Ic n="info" />
              Leave a field empty to use the original text.
            </p>
          </div>
          <PageSections page={key} />
        </div>
        <aside className="adm-pages-pv" aria-label="Sketch of the page heading">
          <div className="adm-pages-pvbar">
            <span>{page.label}</span>
            <a className="adm-link" href={page.path} target="_blank" rel="noopener">
              Open the live page
            </a>
          </div>
          <Sketch k={key} t={t} />
        </aside>
      </div>
    </>
  );
}
