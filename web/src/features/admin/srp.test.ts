// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { _internal, loginId, prove, register } from './srp';

// Shared with api/tests/Portfolio.Tests/SrpTests.cs and an independent Python check.
const EMAIL = 'daniel@example.com';
const PASSWORD = 'correct horse battery staple';
const SALT = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const FIXED_A = 0x1f2e3d4c5b6a79880f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778n;
const HARDENED = '2beb29a0fb4649a96df5ef8e6523300101a899adf282701953312383de1a9e6f';
const V =
  '682e0e234715ab400c344ed34bbbda30aef958701424263d88fe234db7c551594e63d480dd13290b1e67a2b1080b7f85e1b4d6c0e8cc9b61552e96d40fc32b9628008b8476ceb22c9ba1cd0007eca1cf98bdf237118a223c93e0e589a01392a326938495e7db891740e97bf59f039126950bf88be11a685195542354f987e79933cc0e74103cdbed533b63961fdb30c09cb9667d9a06d5b1c10ffa53d0a474c1c4c1195f2bc923fed8cf0b57b1e70fd3f82dcb315a129765b0d2ea1095d01d7a5234f2e31c4eb509165c4b0b6c0793a448e89b099fc9491ab1d5263878390ef82f064dc92e27583a930f8911803f125a1590bf5d9ffb848999c0250de31e7618';
const A =
  '211d2b156c1a6a520e4005709f3adb59d151ed2b2505e2977224723ff7d49973ad90f8ea5458966fe6b2e55a92f5e2f81585dae5bb2f018187393aa34b20b7f89d4876bda01eb32d11a1734d7f7cc794cc4f2dadc0dc85b0e50cde378cc7c16557e398589914c151d5eebdb8a68fde50ecb0dd2e4fc3640b11d74cd6458a11140c4d24541e446b2337ec110894dc21f7021a1273a0e77eff0f18a4c59c2ccc631c2d22eb627b4edfcfbcf2e2b57e473051cc16e87b964255b5c0ebe164c7bd6ee35a0b4fbd5dd17ecfe5eb14126ec10fe85397536696dba3830a95440e6a3db0a9a71c0c2a2020f0f17b69b5174c39b78cbabcac61c19a2af42b2cde4a3b7933';
const B =
  '17624790b200768133c469baf7fa753630f0e516f9d4bb0faba3a5561b99c6d18961ed61ab72ff365bda98d85bdc4721a1cbf300fc7058ea83562100ca25fb01d82f8a14a09c28c91378af89d3c46c5d35f7cd280f0201c2a03f5f017ba513d144834096fe6ac6132021324f1373e2e454b5bd5d6845d7d4c36c85b7e886df6b5eea5b766c58ece3eebcc741f225e76143ee136c062291e67a65693d331a5de185cae4117952cde403e82b67e569c9a676aab26af642acf07447d790ddf4f3a4e7ea53c67f1a256c041bb89cbcbaa360663f6c1f11291222ff5ebf450671c70e824510d986ef6ff9cf62b05285e5fb16c2de99ffd0a171fc22d79396f7a14bae';
const M1 = 'cfd7f5938e91f7f3f26f68f6e532459439f00a7dd5d012c9542123c3034bda2b';
const M2 = 'd4607ddd63ed61b137dff9274f9c111da3d3298103b8901c3405eda1a9a9b92f';
const ID = '638175c12e1a26b7e4ac19f49e74fbabbdd9cb9ad871d84e52a6d30c0bdc24b2';
const ITERATIONS = 210000;

describe('SRP in the browser', () => {
  it('hardens the password and derives the verifier like the server', async () => {
    const salt = _internal.fromHex(SALT);
    const hardened = await _internal.harden(PASSWORD, salt, ITERATIONS);
    expect(hardened).toBe(HARDENED);
    const v = _internal.modPow(2n, await _internal.x(salt, EMAIL, hardened), _internal.N);
    expect(_internal.toHex(_internal.pad(v))).toBe(V);
  });

  it('produces the same A, M1 and M2 as the server for fixed values', async () => {
    const r = await prove(
      ' Daniel@Example.com ',
      PASSWORD,
      { challengeId: 'x', salt: SALT, b: B, iterations: ITERATIONS },
      FIXED_A,
    );
    expect(r.a).toBe(A);
    expect(r.m1).toBe(M1);
    expect(r.m2).toBe(M2);
  });

  it('sends a fingerprint, never the email', async () => {
    expect(await loginId(' DANIEL@example.com')).toBe(ID);
  });

  it('makes a fresh salt and a full-length verifier for a new password', async () => {
    const one = await register(EMAIL, 'a brand new password', 1000);
    const two = await register(EMAIL, 'a brand new password', 1000);
    expect(one.salt).toHaveLength(32);
    expect(one.verifier).toHaveLength(512);
    expect(one.salt).not.toBe(two.salt);
    expect(JSON.stringify(one)).not.toContain('brand new');
  });

  it('gives a different proof for a wrong password', async () => {
    const r = await prove(
      EMAIL,
      'not the password',
      { challengeId: 'x', salt: SALT, b: B, iterations: ITERATIONS },
      FIXED_A,
    );
    expect(r.m1).not.toBe(M1);
  });
});
