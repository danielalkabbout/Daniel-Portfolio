import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('calls the site’s own /api with the CSRF header and no token', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await api('/api/admin/content', { method: 'PUT', body: { a: 1 } });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('/api/admin/content');
    expect(init.credentials).toBe('same-origin');
    expect(headers['X-Requested-With']).toBeTruthy();
    expect(headers.Authorization).toBeUndefined();
  });

  it('turns validation problems into readable messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ title: 'Invalid', errors: { Email: ['Enter a valid email.'] } }), {
            status: 400,
          }),
      ),
    );
    const err = await api('/api/requests', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).messages).toEqual(['Enter a valid email.']);
  });
});
