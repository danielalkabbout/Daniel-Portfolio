import { afterEach, describe, expect, it, vi } from 'vitest';
import { login, logout } from './auth';

afterEach(() => vi.unstubAllGlobals());

const EMAIL = 'me@test.dev';
const PASSWORD = 'a very secret password';

/** Fake API that records what the browser sends, like the Network tab. */
function fakeApi(m2: string) {
  const sent: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      sent.push(String(init.body ?? ''));
      if (url.endsWith('/challenge'))
        return new Response(
          JSON.stringify({
            challengeId: 'c1',
            salt: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
            b: '17624790b200768133c469baf7fa753630f0e516f9d4bb0faba3a5561b99c6d18961ed61ab72ff365bda98d85bdc4721a1cbf300fc7058ea83562100ca25fb01d82f8a14a09c28c91378af89d3c46c5d35f7cd280f0201c2a03f5f017ba513d144834096fe6ac6132021324f1373e2e454b5bd5d6845d7d4c36c85b7e886df6b5eea5b766c58ece3eebcc741f225e76143ee136c062291e67a65693d331a5de185cae4117952cde403e82b67e569c9a676aab26af642acf07447d790ddf4f3a4e7ea53c67f1a256c041bb89cbcbaa360663f6c1f11291222ff5ebf450671c70e824510d986ef6ff9cf62b05285e5fb16c2de99ffd0a171fc22d79396f7a14bae',
            iterations: 1000,
          }),
        );
      return new Response(JSON.stringify({ email: EMAIL, expiresAt: '2999-01-01T00:00:00Z', m2 }));
    }),
  );
  return sent;
}

describe('studio sign-in', () => {
  it('never sends the email or the password', async () => {
    const sent = fakeApi('not-the-real-proof');
    await login(EMAIL, PASSWORD).catch(() => undefined);
    expect(sent).toHaveLength(2);
    for (const body of sent) {
      expect(body).not.toContain(EMAIL);
      expect(body).not.toContain(PASSWORD);
      expect(body.toLowerCase()).not.toContain('password');
    }
    expect(JSON.parse(sent[0])).toEqual({ id: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(Object.keys(JSON.parse(sent[1])).sort()).toEqual(['a', 'challengeId', 'm1']);
  });

  it('refuses a server that cannot prove itself, and keeps nothing', async () => {
    fakeApi('0'.repeat(64));
    await expect(login(EMAIL, PASSWORD)).rejects.toThrow(/could not prove/);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(EMAIL);
  });

  it('logout forgets the session', () => {
    sessionStorage.setItem('dk-admin-session', JSON.stringify({ email: EMAIL, expiresAt: '2999-01-01T00:00:00Z' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    logout();
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(EMAIL);
  });
});
