/**
 * Cloudflare Pages Function: forwards https://<site>/api/* to the API on Render.
 *
 * Why: the browser only ever talks to the website's own address, so the studio's session can be an
 * HttpOnly, SameSite=Strict cookie (scripts can't read it, other sites can't use it), and the
 * Render address never appears in the page.
 *
 * Settings (Cloudflare Pages > Settings > Variables and Secrets):
 *   VITE_API_URL  the Render address (already set for the build)
 *   EDGE_KEY      secret shared with the API (Render: Edge__Key). Proves requests came through here.
 */

interface Env {
  VITE_API_URL?: string;
  API_ORIGIN?: string;
  EDGE_KEY?: string;
}

interface Context {
  request: Request;
  env: Env;
}

// Headers a visitor must not be able to set themselves, plus hop-by-hop ones.
const STRIP = ['x-edge-key', 'x-client-ip', 'x-forwarded-for', 'x-real-ip', 'forwarded', 'host', 'connection'];

export async function onRequest({ request, env }: Context): Promise<Response> {
  const origin = (env.API_ORIGIN || env.VITE_API_URL || '').replace(/\/$/, '');
  if (!origin) return problem(503, 'API not configured', 'Set VITE_API_URL in the Pages settings.');

  const url = new URL(request.url);
  const target = `${origin}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  for (const h of STRIP) headers.delete(h);
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers.set('x-client-ip', ip);
  if (env.EDGE_KEY) headers.set('x-edge-key', env.EDGE_KEY);

  const init: RequestInit = {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  };

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch {
    return problem(502, 'API unreachable', 'The server is waking up or down. Try again in a minute.');
  }

  const out = new Headers(res.headers);
  // Same-origin responses need no CORS headers.
  for (const h of [...out.keys()]) if (h.startsWith('access-control-')) out.delete(h);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ title, status, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store' },
  });
}
