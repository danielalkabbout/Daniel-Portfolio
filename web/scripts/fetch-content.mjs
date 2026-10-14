// Runs before every build. When VITE_API_URL is set, it saves the live content from the API
// into src/content/fallback.json, so the built site opens with up-to-date content even while
// the API is asleep. If the API can't be reached, the existing snapshot is kept and the build continues.
import { readFile, writeFile } from 'node:fs/promises';

const api = (process.env.VITE_API_URL ?? '').replace(/\/$/, '');
const file = new URL('../src/content/fallback.json', import.meta.url);

if (!api) {
  console.log('[content] VITE_API_URL not set, using the bundled snapshot.');
  process.exit(0);
}
// Only ever read from a real HTTPS address (or a local API while developing).
if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(api)) {
  console.warn('[content] VITE_API_URL must be an https:// address. Keeping the existing snapshot.');
  process.exit(0);
}
/** Content is a few hundred KB; anything far bigger is not ours. */
const MAX_BYTES = 5 * 1024 * 1024;

try {
  // Free hosting can take up to a minute to wake up.
  const res = await fetch(`${api}/api/content`, {
    signal: AbortSignal.timeout(90_000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!(res.headers.get('content-type') ?? '').includes('json')) throw new Error('not JSON');
  const raw = await res.text();
  if (raw.length > MAX_BYTES) throw new Error('response too large');
  const data = JSON.parse(raw);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('unexpected response');
  if (typeof data.profile !== 'object' || !Array.isArray(data.projects)) throw new Error('unexpected response');
  // Keep only the sections the site knows (the same ones as the bundled snapshot), so nothing unexpected
  // ever lands in the build. The site checks every field again with its schema when it loads.
  const known = Object.keys(JSON.parse(await readFile(file, 'utf8').catch(() => '{}')));
  const clean = known.length ? Object.fromEntries(known.filter((k) => k in data).map((k) => [k, data[k]])) : data;
  const next = `${JSON.stringify(clean, null, 2)}\n`;
  const prev = await readFile(file, 'utf8').catch(() => '');
  if (prev === next) console.log('[content] Snapshot already up to date.');
  else {
    await writeFile(file, next);
    console.log(`[content] Snapshot updated from ${api}.`);
  }
} catch (err) {
  console.warn(`[content] Could not fetch content (${err.message}). Keeping the existing snapshot.`);
}
