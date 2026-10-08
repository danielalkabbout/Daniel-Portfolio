import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BackToTop } from './BackToTop';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BackToTop />
    </MemoryRouter>,
  ).container.querySelector<HTMLButtonElement>('button.to-top');

describe('BackToTop', () => {
  it('is hidden at the top of the page and absent from the studio', () => {
    const btn = at('/about');
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute('aria-label')).toBe('Back to top');
    expect(btn!.classList.contains('on')).toBe(false);
    expect(btn!.tabIndex).toBe(-1);
    expect(at('/admin')).toBeNull();
  });
});
