import { describe, expect, it } from 'vitest';
import { fallbackContent } from '../api/content';
import { clone } from '../features/admin/studio-state';
import { pageSection, withDefaults } from './defaults';

describe('page sections', () => {
  it('uses the built-in text when nothing is set', () => {
    const now = pageSection(fallbackContent, 'home', 'now');
    expect(now.title).toBe("What I'm working on");
    expect(now.cards.map((c) => c.title)).toContain('Money tracker');
    expect(pageSection(fallbackContent, 'home', 'agents').cards).toHaveLength(4);
  });

  it('shows the studio edits, and drops empty cards', () => {
    const site = clone(fallbackContent);
    site.pages.home.sections.now = {
      title: 'Now and next',
      intro: '',
      words: [],
      cards: [
        { stage: 'now', label: 'In progress', title: 'Money tracker', text: 'Web and mobile.', tags: ['React'] },
        { stage: '', label: '', title: '  ', text: '', tags: [] },
      ],
    };
    const now = pageSection(site, 'home', 'now');
    expect(now.title).toBe('Now and next');
    expect(now.intro).toBe("What I'm building now, and what comes next.");
    expect(now.cards).toHaveLength(1);
    expect(now.cards[0].stage).toBe('now');
  });

  it('keeps fixed card sets complete, filling each empty field on its own', () => {
    const site = clone(fallbackContent);
    site.pages.home.sections.hero = {
      title: '',
      intro: '',
      words: [],
      cards: [{ stage: '', label: '', title: 'Hire me', text: '', tags: [] }],
    };
    const [a, b] = pageSection(site, 'home', 'hero').cards;
    expect(a.title).toBe('Hire me');
    expect(a.text).toBe('AI agents, WhatsApp bots, websites, mobile apps and more');
    expect(b.title).toBe('Get to know me');
  });

  it('gives the studio every section ready to edit', () => {
    const d = withDefaults(fallbackContent);
    expect(Object.keys(d.pages.home.sections)).toEqual(
      expect.arrayContaining(['hero', 'agents', 'proof', 'reel', 'now', 'marqueeTop', 'marqueeBottom']),
    );
    expect(d.pages.services.sections.process.title).toBe("How we'd work together");
  });
});
