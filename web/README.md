# daniel-portfolio-web

React + TypeScript frontend for Daniel Al Kabbout's portfolio (Vite, React Router, TanStack Query, zod).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run lint     # oxlint
npm run format   # prettier
```

Copy `.env.example` to `.env.local` to point the site at the API:

| Variable | What it does |
| --- | --- |
| `VITE_API_URL` | Address of the .NET API, for example `http://localhost:5080`. The browser never calls it directly: the site calls its own `/api`, which Vite (locally) or a Cloudflare Pages Function (`functions/api/[[path]].ts`, in production) forwards there. Empty means the site runs on the bundled content only, the request form opens the visitor's email app, and the studio is disabled. |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for the request form. Empty skips the bot check (the API skips it too when it has no secret). |

## Structure

```
src/
  app/          router, providers, layout, error page
  pages/        Home, About, Experience, Projects, Services, Admin, NotFound
  components/   header, footer, command palette (Ctrl K), toast, page wrapper
  features/
    intro/      terminal boot screen (once per tab)
    home/       network canvas and scroll-driven effects
    echo/       Echo chat: rule engine from the CV, with the AI (POST /api/echo) for questions the rules can't answer
    projects/   interactive project demos (WhatsApp chat, noise pipeline, detector, terminal, diagrams)
    services/   Turnstile widget for the request form
    admin/      content studio: login, editor tabs, drawer forms, requests inbox, activity log
  hooks/        site-wide effects (reveal on scroll, spotlight, ripple, progress bar)
  lib/          icons, dates, browser helpers
  api/          fetch client + React Query hooks
  types/        zod schemas and TypeScript types for site content
  content/      fallback.json, the bundled content snapshot
  styles/       site.css (the whole design) and intro.css
scripts/
  fetch-content.mjs   runs before `npm run build`; refreshes fallback.json from the API when VITE_API_URL is set
functions/api/[[path]].ts   Cloudflare Pages Function: forwards /api/* to the API (adds EDGE_KEY and the visitor IP)
public/_redirects     single-page app routing on Cloudflare Pages
public/_headers       security headers (CSP, HSTS) and caching
```

## Content

Pages read content through `useSite()` (src/api/content.ts). The site renders instantly from
`src/content/fallback.json`, then refreshes from `GET /api/content` when `VITE_API_URL` is set.
Each production build bakes the latest content into that snapshot, so the site is complete even
while the free API host is asleep.

## Studio

`/admin` signs in with SRP (`features/admin/srp.ts`): `POST /api/auth/challenge` with a fingerprint of the
email, then `POST /api/auth/login` with a one-time proof, so neither the email nor the password is ever
sent. The API answers with an HttpOnly, SameSite=Strict session cookie that page scripts cannot read; the browser only keeps the email and expiry, to show the
Studio link. Every request sends an `X-Requested-With` header, which the API requires for any change
(CSRF protection).
Edits stay in a local draft until **Publish changes**, which saves with `PUT /api/admin/content`
and then asks the API to rebuild the site (`POST /api/admin/publish`). **Preview** shows the draft
on the real pages in this tab only.
