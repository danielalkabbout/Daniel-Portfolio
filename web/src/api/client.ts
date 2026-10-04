/** Small fetch wrapper. Every request goes through here so errors and the base URL live in one place. */

export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'VITE_API_URL is not set');
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include', // sends the admin auth cookie in Phase 5
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
