import { describe, expect, it } from 'vitest';
import { fallbackContent } from '../../api/content';
import { clone } from '../admin/studio-state';
import { buildCv, cvMonth, SEP, type Run } from './cv';

const text = (runs: Run[]) => runs.map((r) => (r === SEP ? ' | ' : r.t)).join('');

describe('CV model', () => {
  const cv = buildCv(fallbackContent, 'danielalkabbout.pages.dev');
  const section = (t: string) => cv.sections.find((s) => s.title === t)!;

  it('follows the Word CV section order', () => {
    expect(cv.sections.map((s) => s.title)).toEqual([
      'Summary',
      'Skills',
      'Work Experience',
      'Projects',
      'Education',
      'Certifications',
      'Languages',
      'Volunteer Experience',
    ]);
  });

  it('writes roles like the Word CV', () => {
    const heads = section('Work Experience').entries!.map((e) => text(e.head));
    expect(heads[0]).toBe('AI Software Engineer / Technical Lead | SoftFlow Group | April 2026 – Present');
    expect(heads).toContain(
      'Front-End Developer Intern (Part-Time) | Professional Computers | June 2024 – August 2024',
    );
    expect(cvMonth(null)).toBe('Present');
  });

  it('includes every visible project and picks up new ones', () => {
    const site = clone(fallbackContent);
    site.projects.push({ ...site.projects[0], id: 'new', title: 'New project', tags: ['Go'], visible: true });
    site.projects.push({ ...site.projects[0], id: 'off', title: 'Hidden project', visible: false });
    const heads = buildCv(site)
      .sections.find((s) => s.title === 'Projects')!
      .entries!.map((e) => text(e.head));
    expect(heads).toHaveLength(site.projects.filter((p) => p.visible).length);
    expect(heads).toContain('New project | Go');
    expect(heads.join()).not.toContain('Hidden project');
  });

  it('builds the summary and contact lines from the profile', () => {
    expect(text(section('Summary').lines![0])).toContain('a team of three');
    expect(text(section('Summary').lines![0])).toContain('BSc in Computer Science, Antonine University (2026).');
    expect(text(cv.contact[0])).toContain(fallbackContent.profile.email);
    expect(cv.contact[1].some((r) => r.href === fallbackContent.profile.linkedin)).toBe(true);
  });
});

describe('CV settings from the studio', () => {
  const titles = (site: typeof fallbackContent) => buildCv(site).sections.map((s) => s.title);
  const projectBullets = (site: typeof fallbackContent, id: string) => {
    const p = site.projects.find((x) => x.id === id)!;
    return buildCv(site)
      .sections.find((s) => s.key === 'projects')!
      .entries!.find((e) => text(e.head).startsWith(p.title))!.bullets;
  };

  it('follows the section order, titles and switches', () => {
    const site = clone(fallbackContent);
    site.cv.sections = [
      { key: 'projects', title: 'Selected work', visible: true },
      { key: 'summary', title: '', visible: true },
      { key: 'skills', title: 'Skills', visible: false },
    ];
    const t = titles(site);
    expect(t.slice(0, 2)).toEqual(['Selected work', 'Summary']);
    expect(t).not.toContain('Skills');
    // Sections missing from the list still appear, after the others, so nothing gets lost.
    expect(t).toContain('Work Experience');
  });

  it('uses the edited header and summary, and falls back to the defaults when empty', () => {
    const site = clone(fallbackContent);
    site.cv.headline = ['AI Engineer', 'Tech Lead'];
    site.cv.summary = 'My own summary.';
    site.cv.location = 'Beirut';
    site.cv.showWebsite = false;
    const cv = buildCv(site, 'example.dev');
    expect(text(cv.headline)).toBe('AI Engineer | Tech Lead');
    expect(text(cv.contact[0])).toContain('Beirut');
    expect(text(cv.contact[1])).not.toContain('example.dev');
    expect(text(cv.sections.find((s) => s.key === 'summary')!.lines![0])).toBe('My own summary.');

    site.cv.summary = '  ';
    site.cv.headline = [];
    const fallback = buildCv(site);
    expect(text(fallback.headline)).toBe('AI Software Engineer | Backend Developer');
    expect(text(fallback.sections.find((s) => s.key === 'summary')!.lines![0])).toContain('Software engineer');
  });

  it('leaves out projects and roles switched off for the CV', () => {
    const site = clone(fallbackContent);
    site.projects[0].cv = false;
    const role = site.experience.find((e) => !e.milestone)!;
    role.cv = false;
    const cv = buildCv(site);
    const heads = cv.sections.flatMap((s) => s.entries ?? []).map((e) => text(e.head));
    expect(heads.some((h) => h.startsWith(site.projects[0].title))).toBe(false);
    expect(heads.some((h) => h.startsWith(`${role.title} |`))).toBe(false);
  });

  it('describes projects by style, unless a project has its own CV bullets', () => {
    const site = clone(fallbackContent);
    const id = site.projects[1].id;
    site.cv.projectStyle = 'features';
    expect(projectBullets(site, id)).toEqual(site.projects[1].features);
    site.cv.projectStyle = 'both';
    expect(projectBullets(site, id)[0]).toBe(site.projects[1].summary);
    site.projects[1].cvBullets = ['Written just for the CV'];
    expect(projectBullets(site, id)).toEqual(['Written just for the CV']);
  });
});
