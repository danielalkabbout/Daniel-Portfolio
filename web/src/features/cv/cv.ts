import type { SiteContent } from '../../types/content';
import { MONTHS, monthIndex, ym } from '../../lib/dates';

/**
 * The CV, built from the published content so it never goes out of date.
 * The page (CvPage) and the downloadable PDF (pdf.ts) both draw this same structure,
 * in the layout of Daniel's Word CV.
 */

export const CV_NAME = 'Daniel Al Kabbout';
export const CV_FILE = 'Daniel-AlKabbout-CV.pdf';

/** Lines that only appear on the CV, so they live here rather than in the studio. */
export const CV_HEADLINE = ['AI Software Engineer', 'Backend Developer'];
export const CV_SUMMARY =
  'Software engineer working on generative AI and backend systems. At SoftFlow Group I lead a team of {team} that ' +
  'builds AI agents with Azure OpenAI, Azure AI Foundry and Copilot Studio, using RAG over SharePoint and SQL Server ' +
  'data and deploying them in Microsoft Teams and WhatsApp. On the backend side I work with C#/.NET (ASP.NET Core, ' +
  'MVC), Java (Spring Boot) and Python: REST APIs, microservices, JWT/OAuth 2.0, Docker, and CI/CD pipelines in ' +
  'Azure DevOps. {education}Open to relocating.';

/** A piece of text, optionally bold. A line or paragraph is a list of these. */
export interface Run {
  t: string;
  b?: boolean;
  href?: string;
}
/** Marks the "  |  " separator between parts of a line. */
export const SEP: Run = { t: '|' };

export interface CvEntry {
  head: Run[];
  bullets: string[];
}

export interface CvSection {
  title: string;
  /** Plain paragraphs (summary, skills, education...). */
  lines?: Run[][];
  /** Job or project: a bold heading line followed by bullets. */
  entries?: CvEntry[];
  /** A bulleted list on its own (certifications). */
  bullets?: Run[][];
}

export interface Cv {
  name: string;
  headline: Run[];
  contact: Run[][];
  sections: CvSection[];
}

const numbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "April 2026", or "Present" for an ongoing role. */
export const cvMonth = (v?: string | null) => {
  if (!v) return 'Present';
  const [y, m] = ym(v);
  return `${MONTHS[m]} ${y}`;
};

const strip = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** Joins parts with the CV's "  |  " separator. */
function joined(parts: (Run | string | null | undefined | false)[]): Run[] {
  const out: Run[] = [];
  for (const p of parts) {
    if (!p) continue;
    const run = typeof p === 'string' ? { t: p } : p;
    if (!run.t.trim()) continue;
    if (out.length) out.push(SEP);
    out.push(run);
  }
  return out;
}

/** "Antonine University, Lebanon. Graduated January 2026" becomes two parts. */
const parts = (detail: string) =>
  detail
    .split(/\.\s+/)
    .map((s) => s.replace(/\.$/, '').trim())
    .filter(Boolean);

export function buildCv(site: SiteContent, siteHost = ''): Cv {
  const p = site.profile;
  const team = numbers[Number(p.teamStat)] ?? p.teamStat;
  const degree = site.education[0];
  const gradYear = degree?.detail.match(/\b(19|20)\d{2}\b/)?.[0];
  const school = degree ? (parts(degree.detail)[0] ?? '').split(',')[0] : '';
  const education = degree ? `${degree.title}, ${school}${gradYear ? ` (${gradYear})` : ''}. ` : '';

  const roles = site.experience
    .filter((e) => !e.milestone)
    .sort((a, b) => monthIndex(b.end) - monthIndex(a.end) || monthIndex(b.start) - monthIndex(a.start));
  // Every project shown on the site, in the studio's order: one added there appears here too.
  const projects = site.projects.filter((x) => x.visible);

  const sections: CvSection[] = [
    {
      title: 'Summary',
      lines: [[{ t: CV_SUMMARY.replace('{team}', team).replace('{education}', education) }]],
    },
    {
      title: 'Skills',
      lines: site.skills
        .filter((s) => s.items.length)
        .map((s) => [{ t: `${s.name}: `, b: true }, { t: s.items.join(', ') }]),
    },
    {
      title: 'Work Experience',
      entries: roles.map((r) => ({
        head: joined([
          { t: /part[- ]?time/i.test(r.type ?? '') ? `${r.title} (Part-Time)` : r.title, b: true },
          r.org,
          `${cvMonth(r.start)} – ${cvMonth(r.end)}`,
        ]),
        bullets: r.bullets,
      })),
    },
    {
      title: 'Projects',
      entries: projects.map((x) => ({
        head: joined([{ t: x.title, b: true }, x.tags.join(', ')]),
        bullets: [x.summary].filter(Boolean),
      })),
    },
    {
      title: 'Education',
      lines: site.education.map((e) => joined([{ t: e.title, b: true }, ...parts(e.detail)])),
    },
    {
      title: 'Certifications',
      bullets: site.certifications.map((c) => joined([c.title, ...parts(c.detail)])),
    },
    {
      title: 'Languages',
      lines: site.languages.length
        ? [joined(site.languages.map((l) => (l.detail ? `${l.title}: ${l.detail}` : l.title)))]
        : [],
    },
    {
      title: 'Volunteer Experience',
      lines: site.volunteering.map((v) => joined([{ t: 'Volunteer', b: true }, ...parts(v.title), v.detail])),
    },
  ];

  return {
    name: CV_NAME,
    headline: joined(CV_HEADLINE),
    contact: [
      joined(['Lebanon', p.status, p.phone, p.email && { t: p.email, href: `mailto:${p.email}` }]),
      joined([
        p.linkedin && { t: strip(p.linkedin), href: p.linkedin },
        p.github && { t: strip(p.github), href: p.github },
        siteHost && { t: siteHost, href: `https://${siteHost}` },
      ]),
    ].filter((l) => l.length),
    sections: sections.filter((s) => s.lines?.length || s.entries?.length || s.bullets?.length),
  };
}
