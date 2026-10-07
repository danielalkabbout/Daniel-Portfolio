/** Small fetch wrapper. Every request goes through here so errors and the base URL live in one place. */

export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

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

type ApiInit = Omit<RequestInit, 'body'> & { token?: string | null; body?: unknown; timeoutMs?: number };

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'The API address is not set.');
  const { token, body, timeoutMs = 30000, headers, ...rest } = init;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal: rest.signal ?? ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    try {
      const p = (await res.json()) as { title?: string; detail?: string; errors?: Record<string, string[]> };
      message = p.detail || p.title || message;
      errors = p.errors ?? {};
    } catch {
      /* body was not JSON */
    }
    if (res.status === 429) message = 'Too many tries. Wait a minute, then try again.';
    throw new ApiError(res.status, message, errors);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
