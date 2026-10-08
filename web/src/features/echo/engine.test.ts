import { describe, expect, it } from 'vitest';
import { fallbackContent } from '../../api/content';
import { clone } from '../admin/studio-state';
import { EchoEngine } from './engine';

const engine = (edit?: (c: typeof fallbackContent) => void) => {
  const c = clone(fallbackContent);
  edit?.(c);
  return new EchoEngine(c);
};

describe('Echo', () => {
  it('lists the experience from the content', () => {
    const a = engine().answer('What is his work experience?').a;
    for (const r of fallbackContent.experience.filter((e) => !e.milestone)) expect(a).toContain(r.org);
  });

  it('follows edits made in the studio', () => {
    const e = engine((c) => {
      c.experience.unshift({
        id: 'new',
        title: 'Principal Engineer',
        org: 'Contoso Labs',
        start: '2027-01',
        end: null,
        metrics: [],
        bullets: ['Built the agent platform.'],
        tags: [],
        milestone: false,
      });
      c.languages = [{ title: 'Italian', detail: 'Basic' }];
    });
    expect(e.answer('his experience').a).toContain('Principal Engineer');
    expect(e.answer('what did he do at Contoso Labs').a).toContain('Built the agent platform.');
    expect(e.answer('which languages does he speak').a).toContain('Italian');
  });

  it('points to the CV page', () => {
    expect(engine().answer('Can I get his CV?').a).toContain('href="/cv"');
  });

  it('escapes content so studio text cannot inject HTML', () => {
    const e = engine((c) => {
      c.education = [{ title: '<img src=x onerror=alert(1)>', detail: '' }];
    });
    const a = e.answer('where did he study').a;
    expect(a).not.toContain('<img');
    expect(a).toContain('&lt;img');
  });

  it('says when it is unsure, so the AI can take over', () => {
    expect(engine().answer('what is the airspeed of a swallow').unsure).toBe(true);
  });
});
