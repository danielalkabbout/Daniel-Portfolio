import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { reduceMotion } from '../lib/env';

let firstPage = true;

/**
 * Wraps each route. Sets the tab title, plays the page-enter animation after the first
 * page, and moves focus to the heading so screen readers announce the new page.
 */
export function Page({ name, title, children }: { name: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const isFirst = useRef(firstPage);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useLayoutEffect(() => {
    const first = isFirst.current;
    firstPage = false;
    if (first) return;
    const el = ref.current;
    if (!el) return;
    if (!reduceMotion()) el.classList.add('enter');
    el.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="page" data-page={name} ref={ref}>
      {children}
    </div>
  );
}
