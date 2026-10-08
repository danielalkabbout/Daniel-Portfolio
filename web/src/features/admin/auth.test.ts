import { afterEach, describe, expect, it, vi } from 'vitest';
import { login, logout } from './auth';

afterEach(() => vi.unstubAllGlobals());

describe('studio session', () => {
  it('keeps only the email and expiry in the browser, never a token or password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ email: 'me@test.dev', expiresAt: '2999-01-01T00:00:00Z' }))),
    );
    await login('me@test.dev', 'a very secret password');
    const everything = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    expect(everything).toContain('me@test.dev');
    expect(everything).not.toContain('secret');
    expect(everything.toLowerCase()).not.toContain('token');

    logout();
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('me@test.dev');
  });
});
