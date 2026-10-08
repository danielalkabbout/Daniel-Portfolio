import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { fallbackContent } from '../api/content';
import { clone } from '../features/admin/studio-state';

const site = clone(fallbackContent);
vi.mock('../api/content', async (orig) => ({
  ...(await orig<typeof import('../api/content')>()),
  useSite: () => site,
}));

const { default: CvPage } = await import('./CvPage');

describe('CV page', () => {
  it('lists every visible project, including newly added ones, and skips hidden ones', () => {
    site.projects.push(
      { ...site.projects[0], id: 'brand-new', title: 'Brand new project', visible: true },
      { ...site.projects[0], id: 'secret', title: 'Hidden project', visible: false },
    );
    const { container, getByRole } = render(
      <MemoryRouter>
        <CvPage />
      </MemoryRouter>,
    );
    const text = container.textContent ?? '';
    for (const p of site.projects.filter((x) => x.visible)) expect(text).toContain(p.title);
    expect(text).not.toContain('Hidden project');
    expect(getByRole('button', { name: /Download PDF/ })).toBeTruthy();
  });
});
