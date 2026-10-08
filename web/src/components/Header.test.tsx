import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './Header';

describe('Header menu', () => {
  it('opens the full-screen menu, lists every page with the CV, and closes with Escape', () => {
    const { container, getByRole } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/about']}>
          <Header onOpenPalette={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const btn = getByRole('button', { name: 'Open menu' });
    const menu = container.querySelector('#mnav')!;
    expect(menu.classList.contains('on')).toBe(false);

    fireEvent.click(btn);
    expect(menu.classList.contains('on')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.classList.contains('menu-open')).toBe(true);
    const labels = [...menu.querySelectorAll('.mnav-links b')].map((b) => b.textContent);
    expect(labels).toEqual(['Home', 'About', 'Experience', 'Projects', 'Services', 'CV']);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(menu.classList.contains('on')).toBe(false);
    expect(document.body.classList.contains('menu-open')).toBe(false);
  });
});
