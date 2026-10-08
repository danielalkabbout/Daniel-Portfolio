import type { SiteContent } from '../../types/content';
import { escapeHtml } from '../../lib/env';
import { fmtMonth, monthIndex } from '../../lib/dates';
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

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const count = (n: number) => WORDS[n] ?? String(n);
const listText = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join('; ')}; and ${items[items.length - 1]}`;

/** Words in company names too generic to identify the company on their own. */
const COMMON = new Set([
  'group',
  'professional',
  'computers',
  'computer',
  'company',
  'solutions',
  'systems',
  'services',
  'technologies',
  'technology',
  'digital',
  'international',
  'mobility',
  'software',
  'university',
]);

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
    this.fromContent(site);
  }

  /**
   * Answers that come straight from the published content, so editing the studio updates Echo too.
   * The hand-written rules stay as they are for everything else.
   */
  private fromContent(site: SiteContent) {
    const set = (id: string, a: string) => {
      if (this.byId[id]) this.byId[id].a = a;
    };
    const e = escapeHtml;

    const roles = site.experience
      .filter((x) => !x.milestone)
      .sort((a, b) => monthIndex(b.end) - monthIndex(a.end) || monthIndex(b.start) - monthIndex(a.start));
    if (roles.length) {
      const first = roles.reduce((m, r) => (monthIndex(r.start) < monthIndex(m.start) ? r : m), roles[0]);
      set(
        'exp',
        `${count(roles.length)} role${roles.length === 1 ? '' : 's'} since ${fmtMonth(first.start)}:<div class="tlc">` +
          roles
            .map(
              (r) =>
                `<p><b>${e(r.title)}</b><span>${e(r.org)}, ${fmtMonth(r.start, true)} to ${fmtMonth(r.end, true)}</span></p>`,
            )
            .join('') +
          '</div>' +
          btn('See the full timeline', '/experience'),
      );
      // "What did he do at Eurisko?" and the like, for every company on the timeline.
      const orgs = [...new Set(roles.map((r) => r.org))];
      for (const org of orgs) {
        const at = roles.filter((r) => r.org === org);
        const words = org
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3 && !COMMON.has(w));
        const it: Intent = {
          id: `org_${org.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          k: [org.toLowerCase(), ...words],
          a:
            `At ${e(org)}:<div class="tlc">` +
            at
              .map(
                (r) =>
                  `<p><b>${e(r.title)}</b><span>${fmtMonth(r.start, true)} to ${fmtMonth(r.end, true)}${
                    r.bullets[0] ? `. ${e(r.bullets[0])}` : ''
                  }</span></p>`,
              )
              .join('') +
            '</div>' +
            btn('See the full timeline', '/experience'),
          f: ['Experience', 'Current role?'],
        };
        this.intents.push(it);
        this.byId[it.id] = it;
      }
    }

    const items = (list: { title: string; detail: string }[]) =>
      list.map((x) => (x.detail ? `${e(x.title)} (${e(x.detail)})` : e(x.title)));
    if (site.education.length) set('edu', `Education: ${listText(items(site.education))}.`);
    if (site.certifications.length) set('certs', `Certifications: ${listText(items(site.certifications))}.`);
    if (site.languages.length)
      set('langs', `Languages: ${listText(site.languages.map((x) => `${e(x.title)}, ${e(x.detail.toLowerCase())}`))}.`);
    if (site.volunteering.length) set('volunteer', `Volunteering: ${listText(items(site.volunteering))}.`);

    const services = site.services.filter((x) => x.visible);
    if (services.length)
      set(
        'hire',
        `Yes. He takes on: ${listText(services.map((x) => e(x.title)))}.` +
          btn('Request a service', '/services', true) +
          btn('Email him', `mailto:${this.ctx.email}`),
      );

    set(
      'cv',
      'His CV is on this site, always up to date, and you can save it as a PDF.' +
        btn('Open his CV', '/cv', true) +
        btn('Experience', '/experience'),
    );
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
