/** Small browser checks used by the animations. Each is evaluated when called, so tests and SSR stay safe. */

const mq = (q: string) => typeof window !== 'undefined' && window.matchMedia(q).matches;

export const reduceMotion = () => mq('(prefers-reduced-motion: reduce)');
export const finePointer = () => mq('(pointer: fine)');
export const coarsePointer = () => mq('(pointer: coarse)');

export const smooth = (): ScrollBehavior => (reduceMotion() ? 'auto' : 'smooth');

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Reads sessionStorage/localStorage without throwing when storage is blocked. */
export function store(kind: 'local' | 'session') {
  const s = () => (kind === 'local' ? window.localStorage : window.sessionStorage);
  return {
    get(key: string): string | null {
      try {
        return s().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string): boolean {
      try {
        s().setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key: string) {
      try {
        s().removeItem(key);
      } catch {
        /* storage blocked */
      }
    },
  };
}

export const escapeHtml = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
