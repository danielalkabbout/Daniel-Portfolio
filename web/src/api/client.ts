/**
 * Small fetch wrapper. Every request goes through here so errors and headers live in one place.
 *
 * The site always calls its own /api path. In production a Cloudflare Pages Function forwards it to the
 * API (functions/api/[[path]].ts); in development Vite does (vite.config.ts). Same-origin requests let
 * the studio use an HttpOnly cookie instead of keeping a token where scripts could read it.
 */

/** True when this build has an API behind /api (VITE_API_URL was set at build time). */
export const API_ENABLED = Boolean(import.meta.env.VITE_API_URL);

export class ApiError extends Error {
  status: number;
  /** Field errors from an ASP.NET validation problem, keyed by property path. */
  errors: Record<string, string[]>;
  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
  /** Every validation message as one flat list. */
  get messages(): string[] {
    const list = Object.values(this.errors).flat();
    return list.length ? list : [this.message];
  }
}

type ApiInit = Omit<RequestInit, 'body'> & { body?: unknown; timeoutMs?: number };

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  if (!API_ENABLED) throw new ApiError(0, 'The API address is not set.');
  const { body, timeoutMs = 30000, headers, ...rest } = init;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      signal: rest.signal ?? ctrl.signal,
      credentials: 'same-origin',
      headers: {
        // The API refuses data changes without this header, which other sites can't add (CSRF protection).
        'X-Requested-With': 'dk-site',
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    let errors: Record<string, string[]> = {};
    let explained = false;
    try {
      const p = (await res.json()) as { title?: string; detail?: string; errors?: Record<string, string[]> };
      message = p.detail || p.title || message;
      explained = Boolean(p.detail);
      errors = p.errors ?? {};
    } catch {
      /* body was not JSON */
    }
    if (res.status === 429 && !explained) message = 'Too many tries. Wait a minute, then try again.';
    throw new ApiError(res.status, message, errors);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
