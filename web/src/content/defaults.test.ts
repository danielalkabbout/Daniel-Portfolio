import { describe, expect, it } from 'vitest';
import { fallbackContent } from '../api/content';
import { clone } from '../features/admin/studio-state';
import { DEFAULT_PAGES, pageText, withDefaults } from './defaults';

describe('page text', () => {
  it('uses what the studio saved, and the built-in text for anything empty', () => {
    const site = clone(fallbackContent);
    site.pages.about.title = 'My own title';
    site.pages.about.paragraphs = ['', '  '];
    const t = pageText(site, 'about');
    expect(t.title).toBe('My own title');
    expect(t.kicker).toBe(DEFAULT_PAGES.about.kicker);
    expect(t.paragraphs).toEqual(DEFAULT_PAGES.about.paragraphs);
  });

  it('gives the studio every field filled in, without changing real edits', () => {
    const site = clone(fallbackContent);
    site.cv.summary = 'Kept';
    const filled = withDefaults(site);
    expect(filled.cv.summary).toBe('Kept');
    expect(filled.cv.sections).toHaveLength(8);
    expect(filled.pages.services.steps).toHaveLength(3);
    expect(withDefaults(filled)).toEqual(filled);
  });
});
