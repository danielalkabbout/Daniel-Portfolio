import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

const browser = typeof window !== 'undefined';

afterEach(() => {
  if (!browser) return;
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

// jsdom has no matchMedia; the site asks it about motion and pointer preferences.
if (browser && !window.matchMedia)
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

// jsdom has no IntersectionObserver either; the scroll effects only need it to exist.
if (browser && !('IntersectionObserver' in window))
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
