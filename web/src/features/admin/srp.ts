/**
 * Browser half of the studio's SRP-6a sign-in (RFC 5054, 2048-bit group, SHA-256).
 * The password is hardened with PBKDF2 and then used only here, to compute a one-time proof:
 * the request carries a fingerprint of the email, the public value A and the proof M1, never the
 * email or the password. The server half is api/src/Portfolio.Api/Services/Srp.cs; both are tested
 * against the same fixed values (srp.test.ts and SrpTests.cs).
 */

const N = BigInt(
  '0x' +
    'AC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310D' +
    'CD7F48A9DA04FD50E8083969EDB767B0CF6095179A163AB3661A05FBD5FAAAE82918A9962F0B93B855F97993EC975EEAA80D740ADBF4FF74' +
    '7359D041D5C33EA71D281E446B14773BCA97B43A23FB801676BD207A436C6481F1D2B9078717461A5B9D32E688F87748544523B524B0D57D' +
    '5EA77A2775D2ECFA032CFBDBF52FB3786160279004E57AE6AF874E7303CE53299CCC041C7BC308D82A5698F3A8D0C38271AE35F8E9DBFBB6' +
    '94B5C803D89F7AE435DE236D525F54759B65E372FCD68EF20FA7111F9E4AFF73',
);
const g = 2n;
const LEN = 256; // bytes in N
const enc = new TextEncoder();

export interface Challenge {
  challengeId: string;
  salt: string;
  b: string;
  iterations: number;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => {
  const s = h.length % 2 ? `0${h}` : h;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const toInt = (b: Uint8Array) => (b.length ? BigInt(`0x${toHex(b)}`) : 0n);
const pad = (i: bigint, len = LEN) => fromHex(i.toString(16).padStart(len * 2, '0'));
const minimal = (i: bigint) => fromHex(i.toString(16));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const H = async (...parts: Uint8Array[]) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', concat(...parts) as BufferSource));
const mod = (a: bigint, n: bigint) => ((a % n) + n) % n;
function modPow(base: bigint, exp: bigint, m: bigint) {
  let r = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

/** PBKDF2-SHA256 of the password, as lowercase hex. Slows down guessing against a stolen verifier. */
export async function harden(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

const x = async (salt: Uint8Array, identity: string, hardened: string) =>
  toInt(await H(salt, await H(enc.encode(`${identity}:${hardened}`))));

/** What is sent instead of the email. */
export async function loginId(email: string) {
  return toHex(await H(enc.encode(`dk-studio:${normalizeEmail(email)}`)));
}

/** Answers a challenge: A and the proof M1 to send, and the M2 the real server must send back. */
export async function prove(email: string, password: string, c: Challenge, fixedA?: bigint) {
  const identity = normalizeEmail(email);
  const salt = fromHex(c.salt);
  const B = BigInt(`0x${c.b}`);
  if (mod(B, N) === 0n) throw new Error('The server sent an invalid challenge.');
  const a = fixedA ?? toInt(crypto.getRandomValues(new Uint8Array(32)));
  const A = modPow(g, a, N);
  const u = toInt(await H(pad(A), pad(B)));
  const k = toInt(await H(pad(N), pad(g)));
  const xi = await x(salt, identity, await harden(password, salt, c.iterations));
  const S = modPow(mod(B - k * modPow(g, xi, N), N), a + u * xi, N);
  const K = await H(pad(S));
  const hn = await H(minimal(N));
  const hg = await H(minimal(g));
  const m1 = await H(
    hn.map((v, i) => v ^ hg[i]),
    await H(enc.encode(identity)),
    salt,
    pad(A),
    pad(B),
    K,
  );
  const m2 = await H(pad(A), m1, K);
  return { a: toHex(pad(A)), m1: toHex(m1), m2: toHex(m2) };
}

/** A new salt and verifier for a password, made in the browser so the new password never travels. */
export async function register(email: string, password: string, iterations: number) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const v = modPow(g, await x(salt, normalizeEmail(email), await harden(password, salt, iterations)), N);
  return { salt: toHex(salt), verifier: toHex(pad(v)) };
}

/** Exposed for the tests. */
export const _internal = { N, harden, x, modPow, pad, toHex, fromHex };
