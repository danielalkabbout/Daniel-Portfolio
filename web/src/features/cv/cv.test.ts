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
