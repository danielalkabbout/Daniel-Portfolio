import type { SiteContent } from '../../types/content';
import { MONTHS, monthIndex, ym } from '../../lib/dates';
import { cvSettings, type CvSectionKey } from '../../content/defaults';

/**
 * The CV, built from the published content so it never goes out of date: add a role, project, skill or
 * certification in the studio and it appears here and in the PDF. The studio's CV tab sets the headline,
 * summary, section order and titles, and which projects and roles are included.
 * The page (CvPage), the studio preview and the PDF (pdf.ts) all draw this same structure.
 */

export const CV_NAME = 'Daniel Al Kabbout';
export const CV_FILE = 'Daniel-AlKabbout-CV.pdf';

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
  key: CvSectionKey;
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
  const s = cvSettings(site);

  const roles = site.experience
    .filter((e) => !e.milestone && e.cv)
    .sort((a, b) => monthIndex(b.end) - monthIndex(a.end) || monthIndex(b.start) - monthIndex(a.start));
  // Every visible project the CV includes, in the studio's order: one added there appears here too.
  const projects = site.projects.filter((x) => x.visible && x.cv);

  const projectBullets = (x: (typeof projects)[number]) => {
    const own = x.cvBullets.filter((b) => b.trim());
    if (own.length) return own;
    const features = x.features.filter((f) => f.trim());
    if (s.projectStyle === 'features' && features.length) return features;
    if (s.projectStyle === 'both') return [x.summary, ...features].filter(Boolean);
    return [x.summary].filter(Boolean);
  };

  const build: Record<CvSectionKey, () => Omit<CvSection, 'key' | 'title'>> = {
    summary: () => ({ lines: s.summary.trim() ? [[{ t: s.summary.trim() }]] : [] }),
    skills: () => ({
      lines: site.skills
        .filter((g) => g.items.length)
        .map((g) => [{ t: `${g.name}: `, b: true }, { t: g.items.join(', ') }]),
    }),
    experience: () => ({
      entries: roles.map((r) => ({
        head: joined([
          { t: /part[- ]?time/i.test(r.type ?? '') ? `${r.title} (Part-Time)` : r.title, b: true },
          r.org,
          `${cvMonth(r.start)} – ${cvMonth(r.end)}`,
        ]),
        bullets: r.bullets.filter((b) => b.trim()),
      })),
    }),
    projects: () => ({
      entries: projects.map((x) => ({
        // Ends with the code or the live site, as on the Word CV.
        head: joined([
          { t: x.title, b: true },
          x.tags.join(', '),
          (x.github || x.live) && { t: strip(x.github || x.live), href: x.github || x.live },
        ]),
        bullets: projectBullets(x),
      })),
    }),
    education: () => ({ lines: site.education.map((e) => joined([{ t: e.title, b: true }, ...parts(e.detail)])) }),
    certifications: () => ({ bullets: site.certifications.map((c) => joined([c.title, ...parts(c.detail)])) }),
    languages: () => ({
      lines: site.languages.length
        ? [joined(site.languages.map((l) => (l.detail ? `${l.title}: ${l.detail}` : l.title)))]
        : [],
    }),
    volunteering: () => ({
      lines: site.volunteering.map((v) => joined([{ t: 'Volunteer', b: true }, ...parts(v.title), v.detail])),
    }),
  };

  const sections: CvSection[] = s.sections
    .filter((sec) => sec.visible)
    .map((sec) => ({ key: sec.key, title: sec.title, ...build[sec.key]() }));

  return {
    name: CV_NAME,
    headline: joined(s.headline),
    contact: [
      joined([s.location, s.availability, p.phone, p.email && { t: p.email, href: `mailto:${p.email}` }]),
      joined([
        p.linkedin && { t: strip(p.linkedin), href: p.linkedin },
        p.github && { t: strip(p.github), href: p.github },
        s.showWebsite && siteHost && { t: siteHost, href: `https://${siteHost}` },
      ]),
    ].filter((l) => l.length),
    sections: sections.filter((x) => x.lines?.length || x.entries?.length || x.bullets?.length),
  };
}
