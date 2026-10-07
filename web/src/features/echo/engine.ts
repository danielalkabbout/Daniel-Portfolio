import type { SiteContent } from '../../types/content';
import { escapeHtml } from '../../lib/env';
import {
  BASE_SKILLS,
  CHIP_MAP,
  DISPLAY,
  NOT_LISTED,
  btn,
  buildIntents,
  contactCardHtml,
  type EchoContext,
  type Intent,
} from './intents';

export interface EchoAnswer {
  /** Trusted HTML. */
  a: string;
  f: string[];
  id?: string;
  /** True when no rule matched, so the AI may do better. */
  unsure?: boolean;
}

export const GREETING = "Hi, I'm Echo, Daniel's assistant. Ask me anything about his work, or tap a suggestion below.";
export const START_CHIPS = [
  'Who is Daniel?',
  'What does he build?',
  'Can I hire him?',
  'His projects',
  'Does he know Docker?',
  'How do I contact him?',
];

/** Projects with a hand-written answer in the rules; other projects get one built from their content. */
const BUILT = new Set(['whatsapp', 'noise', 'booking', 'detector', 'todo']);

export function echoContext(site: SiteContent): EchoContext {
  const p = site.profile;
  return { email: p.email, wa: `https://wa.me/${p.whatsapp}`, li: p.linkedin, gh: p.github };
}

const dn = (k: string) => DISPLAY[k] ?? k.replace(/\b\w/g, (c) => c.toUpperCase());

const norm = (t: string) =>
  ' ' +
  t
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\.(\s|$)/g, ' ')
    .replace(/[?!,;:()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() +
  ' ';

const has = (t: string, k: string) => t.includes(` ${k} `) || (k.length >= 5 && t.includes(k));

export class EchoEngine {
  private intents: Intent[];
  private byId: Record<string, Intent> = {};
  private skills: Record<string, string[]>;
  private ctx: EchoContext;

  constructor(site: SiteContent) {
    this.ctx = echoContext(site);
    this.intents = buildIntents(this.ctx);
    this.skills = Object.fromEntries(Object.entries(BASE_SKILLS).map(([k, v]) => [k, [...v]]));

    const projects = site.projects.filter((p) => p.visible !== false);
    for (const it of this.intents) this.byId[it.id] = it;
    this.byId.projects.a =
      'Here are his personal projects:' +
      projects
        .map(
          (p) =>
            `<a class="prow" href="/projects/${escapeHtml(p.id)}"><b>${escapeHtml(p.title)}</b><span>${escapeHtml(p.kind)}</span></a>`,
        )
        .join('');
    for (const p of projects) {
      if (BUILT.has(p.id)) continue;
      const it: Intent = {
        id: `p_${p.id}`,
        k: [p.title.toLowerCase(), (p.short || '').toLowerCase()].filter((x) => x.length > 3),
        a:
          escapeHtml(p.summary) +
          btn('See the project', `/projects/${p.id}`) +
          (p.github ? btn('Code on GitHub', p.github) : ''),
        f: ['All projects', 'His stack'],
      };
      this.intents.unshift(it);
      this.byId[it.id] = it;
    }
    for (const g of site.skills) {
      const key = g.name.toLowerCase();
      this.skills[key] = (this.skills[key] ?? []).concat(g.items.map((x) => x.toLowerCase()));
    }
  }

  get contactCard() {
    return contactCardHtml(this.ctx);
  }

  get github() {
    return this.ctx.gh;
  }

  private skillCheck(t: string): string | null {
    const asks =
      / (know|knows|use|uses|work with|works with|experience with|familiar|skilled|can he|does he|do you|proficient) /.test(
        t,
      );
    for (const k of NOT_LISTED) {
      if (has(t, k) && asks)
        return `${dn(k)} isn't on his CV. He may still have worked with it, so it's worth asking him.${btn('Ask by email', `mailto:${this.ctx.email}`)}`;
    }
    if (!asks) return null;
    const hits: [string, string][] = [];
    for (const [cat, keys] of Object.entries(this.skills)) for (const k of keys) if (has(t, k)) hits.push([k, cat]);
    if (!hits.length) return null;
    hits.sort((a, b) => b[0].length - a[0].length);
    const [k, cat] = hits[0];
    return `Yes. ${dn(k)} is on his CV, under ${cat}.${cat === 'AI and machine learning' ? " It's central to his current work." : ''}`;
  }

  /** @param lastIntent the topic of the previous answer, so "tell me more" can continue it. */
  answer(raw: string, lastIntent: string | null = null): EchoAnswer {
    const t = norm(raw);
    if (/[؀-ۿ]/.test(raw))
      return {
        a:
          'I can only answer in English for now, but Daniel speaks Arabic natively and would be happy to talk in Arabic.' +
          this.contactCard,
        f: ['Who is Daniel?', 'Can I hire him?'],
      };
    if (/ (quel|quelle|est-ce|pourquoi|comment|parle|travail|compétences) /.test(t))
      return {
        a:
          'I answer in English, but Daniel works professionally in French too. Feel free to write to him in French.' +
          this.contactCard,
        f: ['Who is Daniel?'],
      };
    if (
      / (more|tell me more|details|elaborate|go on|and then|what else|continue) /.test(t) &&
      t.split(' ').length < 7 &&
      lastIntent
    ) {
      const li = this.byId[lastIntent];
      if (li?.m) return { a: li.m, f: li.f, id: li.id };
      if (li)
        return {
          a: "That's everything his CV says on that. Want to ask him directly?" + this.contactCard,
          f: ['Can I hire him?'],
        };
    }
    const sc = this.skillCheck(t);
    if (sc) return { a: sc, f: ['His stack', 'Projects'] };
    let best: Intent | null = null;
    let bs = 0;
    for (const x of this.intents) {
      let s = 0;
      for (const k of x.k) if (has(t, k)) s += 1 + k.split(' ').length * 1.5 + (k.length > 6 ? 0.5 : 0);
      if (s > bs) {
        bs = s;
        best = x;
      }
    }
    if (best && bs >= 1.5) return { a: best.a, f: best.f, id: best.id };
    return {
      a:
        "I'm not sure about that one. I only answer from Daniel's CV. You could ask about his experience, projects, skills or services, or reach him directly." +
        this.contactCard,
      f: ['Who is Daniel?', 'His projects', 'Can I hire him?'],
      unsure: true,
    };
  }

  /** Answer for a suggestion chip; chips map straight to an intent where possible. */
  chip(label: string, lastIntent: string | null = null): EchoAnswer {
    const id = CHIP_MAP[label];
    if (id === '__more') return this.answer('tell me more', lastIntent);
    if (id === '__docker') return this.answer('does he know docker');
    if (id === '__gh')
      return {
        a: 'Opening his GitHub in a new tab.' + btn(this.ctx.gh.replace(/^https:\/\//, ''), this.ctx.gh),
        f: ['All projects', 'His stack'],
      };
    if (id && this.byId[id]) return { a: this.byId[id].a, f: this.byId[id].f, id };
    return this.answer(label);
  }

  isGitHubChip(label: string) {
    return CHIP_MAP[label] === '__gh';
  }
}
