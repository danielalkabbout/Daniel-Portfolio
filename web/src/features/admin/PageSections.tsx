import { DEFAULT_SECTIONS } from '../../content/defaults';
import type { PageCard, PageKey, PageSection } from '../../types/content';
import { FieldView, type Field } from './fields';
import { Ic, useUi } from './ui';
import { useStudio } from './studio-state';

type CardField = keyof PageCard;

interface SectionMeta {
  label: string;
  help?: string;
  title?: string | false;
  intro?: string | false;
  introArea?: boolean;
  words?: string;
  cards?: {
    name: string;
    fixed?: string[];
    max?: number;
    fields: Partial<Record<CardField, string>>;
  };
}

/** What each section is called in the studio and which of its fields are used on the page. */
const META: Partial<Record<PageKey, Record<string, SectionMeta>>> = {
  home: {
    hero: {
      label: 'Top of the page',
      help: 'Your name, headline and intro are in Profile and home. These are the two buttons and the note under the chat.',
      title: false,
      intro: 'Note under the chat',
      cards: {
        name: 'Button',
        fixed: ['Services button', 'About button'],
        fields: { title: 'Button text', text: 'Line under it' },
      },
    },
    strip: {
      label: 'Moving strip',
      help: 'The words in the strip are under "What I work on" above.',
      title: 'Label',
      intro: false,
    },
    agents: {
      label: 'How my agents work',
      help: 'The pinned story with the animated chat. It always has four steps.',
      title: 'Heading',
      intro: false,
      cards: {
        name: 'Step',
        fixed: ['Step 1', 'Step 2', 'Step 3', 'Step 4'],
        fields: { title: 'Step title', text: 'What happens' },
      },
    },
    proof: {
      label: 'Highlights',
      help: 'The numbers themselves are edited in Profile and home.',
      title: 'Heading',
      intro: 'Line under the heading',
    },
    reel: {
      label: 'Selected projects',
      help: 'Projects with "Show on home" switched on appear here, in your Projects order.',
      title: 'Heading',
      intro: 'Line under the heading',
      cards: {
        name: 'Last card',
        fixed: ['Last card, linking to all projects'],
        fields: { title: 'Title', text: 'Text', label: 'Button text' },
      },
    },
    marqueeTop: { label: 'Big moving words, top row', title: false, intro: false, words: 'Words' },
    marqueeBottom: { label: 'Big moving words, bottom row', title: false, intro: false, words: 'Words' },
    now: {
      label: "What I'm working on",
      help: 'Cards with a status: "In progress" gets a pulsing dot. Change the order with the arrows.',
      title: 'Heading',
      intro: 'Line under the heading',
      cards: {
        name: 'Card',
        max: 4,
        fields: { stage: 'Status', label: 'Small label', title: 'Title', text: 'Description', tags: 'Tags' },
      },
    },
  },
  about: {
    skills: { label: 'Skills', title: 'Heading', intro: 'Search label' },
  },
  experience: {
    glance: {
      label: 'Path at a glance',
      help: 'A hint about hovering or tapping is added after the line automatically.',
      title: 'Heading',
      intro: 'Line under the heading',
    },
    clients: { label: 'Clients', help: 'The client names are in Experience.', title: 'Label', intro: false },
    story: { label: 'Timeline', title: 'Heading', intro: 'Line under the heading' },
  },
  services: {
    process: {
      label: "How we'd work together",
      help: 'The steps are edited above.',
      title: 'Heading',
      intro: 'Line under the heading',
    },
    request: { label: 'Request form', title: 'Heading', intro: false },
  },
};

const STAGES: [string, string][] = [
  ['now', 'In progress'],
  ['next', 'Up next'],
  ['later', 'Planned'],
  ['', 'No status'],
];

const blank = (): PageCard => ({ label: '', title: '', text: '', tags: [], stage: '' });

function cardField(k: CardField, label: string): Field {
  if (k === 'stage') return { kind: 'select', key: k, label, choices: STAGES };
  if (k === 'tags') return { kind: 'chips', key: k, label, ph: 'e.g. React', help: 'Press Enter to add.' };
  if (k === 'text') return { kind: 'text', key: k, label, area: true, rows: 3, max: 600 } as Field;
  return { kind: 'text', key: k, label, max: k === 'label' ? 80 : 120 } as Field;
}

const noop = () => {};

/** Every named section of one page, with the built-in text ready to edit. */
export function PageSections({ page }: { page: PageKey }) {
  const { d, update } = useStudio();
  const { toast } = useUi();
  const meta = META[page];
  if (!meta) return null;
  const sections = d.pages[page].sections;

  const edit = (name: string, fn: (s: PageSection) => void) =>
    update((x) => {
      const all = x.pages[page].sections;
      all[name] ??= structuredClone(DEFAULT_SECTIONS[page][name]);
      fn(all[name]);
    });

  return (
    <>
      {Object.entries(meta).map(([name, m]) => {
        const s = sections[name] ?? DEFAULT_SECTIONS[page][name];
        if (!s) return null;
        const c = m.cards;
        return (
          <section key={`${page}-${name}`} className="adm-card adm-form adm-psec" aria-label={m.label}>
            <div className="adm-psec-h">
              <h3>{m.label}</h3>
              <button
                type="button"
                className="adm-link"
                onClick={() => {
                  edit(name, (x) => Object.assign(x, structuredClone(DEFAULT_SECTIONS[page][name])));
                  toast(`${m.label} reset`);
                }}
              >
                <Ic n="reset" />
                Reset
              </button>
            </div>
            {m.help && <p className="adm-muted adm-psec-help">{m.help}</p>}
            {m.title !== false && (
              <FieldView
                f={{ kind: 'text', key: 'title', label: m.title ?? 'Heading', max: 120 } as Field}
                o={s as never}
                set={(_, v) => edit(name, (x) => void (x.title = String(v)))}
                setErr={noop}
              />
            )}
            {m.intro !== false && (
              <FieldView
                f={{ kind: 'text', key: 'intro', label: m.intro ?? 'Line under the heading', max: 400 } as Field}
                o={s as never}
                set={(_, v) => edit(name, (x) => void (x.intro = String(v)))}
                setErr={noop}
              />
            )}
            {m.words && (
              <FieldView
                f={{
                  kind: 'chips',
                  key: 'words',
                  label: m.words,
                  ph: 'e.g. AI agents',
                  help: 'Press Enter to add. Shown in this order.',
                }}
                o={s as never}
                set={(_, v) => edit(name, (x) => void (x.words = v as string[]))}
                setErr={noop}
              />
            )}
            {c && (
              <ol className="adm-pcards">
                {s.cards.map((card, i) => (
                  <li key={i} className="adm-pcard">
                    <div className="adm-pcard-h">
                      <b>{c.fixed?.[i] ?? `${c.name} ${i + 1}`}</b>
                      {!c.fixed && (
                        <span className="adm-pcard-tools">
                          <button
                            type="button"
                            className="adm-ibtn"
                            aria-label={`Move ${c.name.toLowerCase()} ${i + 1} up`}
                            disabled={i === 0}
                            onClick={() => edit(name, (x) => void x.cards.splice(i - 1, 0, ...x.cards.splice(i, 1)))}
                          >
                            <Ic n="up" />
                          </button>
                          <button
                            type="button"
                            className="adm-ibtn"
                            aria-label={`Move ${c.name.toLowerCase()} ${i + 1} down`}
                            disabled={i === s.cards.length - 1}
                            onClick={() => edit(name, (x) => void x.cards.splice(i + 1, 0, ...x.cards.splice(i, 1)))}
                          >
                            <Ic n="down" />
                          </button>
                          <button
                            type="button"
                            className="adm-ibtn"
                            aria-label={`Remove ${c.name.toLowerCase()} ${i + 1}`}
                            disabled={s.cards.length === 1}
                            title={s.cards.length === 1 ? 'Keep at least one card' : undefined}
                            onClick={() => edit(name, (x) => void x.cards.splice(i, 1))}
                          >
                            <Ic n="del" />
                          </button>
                        </span>
                      )}
                    </div>
                    {(Object.entries(c.fields) as [CardField, string][]).map(([k, label]) => (
                      <FieldView
                        key={k}
                        f={cardField(k, label)}
                        o={card as never}
                        set={(key, v) => edit(name, (x) => void ((x.cards[i] as Record<string, unknown>)[key] = v))}
                        setErr={noop}
                      />
                    ))}
                  </li>
                ))}
              </ol>
            )}
            {c && !c.fixed && s.cards.length < (c.max ?? 8) && (
              <button
                type="button"
                className="adm-add"
                onClick={() => edit(name, (x) => void x.cards.push({ ...blank(), stage: 'later', label: 'Planned' }))}
              >
                <Ic n="plus" />
                Add {c.name.toLowerCase()}
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}
