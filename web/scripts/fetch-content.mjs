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

try {
  // Free hosting can take up to a minute to wake up.
  const res = await fetch(`${api}/api/content`, {
    signal: AbortSignal.timeout(90_000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.profile || !Array.isArray(data.projects)) throw new Error('unexpected response');
  const next = `${JSON.stringify(data, null, 2)}\n`;
  const prev = await readFile(file, 'utf8').catch(() => '');
  if (prev === next) console.log('[content] Snapshot already up to date.');
  else {
    await writeFile(file, next);
    console.log(`[content] Snapshot updated from ${api}.`);
  }
} catch (err) {
  console.warn(`[content] Could not fetch content (${err.message}). Keeping the existing snapshot.`);
}
