# daniel-portfolio-web

React + TypeScript frontend for Daniel Al Kabbout's portfolio (Vite).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run lint     # oxlint
npm run format   # prettier
```

## Structure

```
src/
  app/          router, providers, layout, error page
  pages/        Home, About, Experience, Projects, Services, Admin, NotFound
  components/   Header, Footer (shared UI grows here in Phase 4)
  features/     echo, project demos, services wizard, admin (Phase 4)
  api/          fetch client + React Query hooks
  types/        zod schemas and TypeScript types for site content
  content/      fallback.json, the bundled content snapshot
  styles/       design tokens + global styles
```

## Content

Pages read content through `useContent()` (src/api/content.ts).
Until `VITE_API_URL` is set, everything comes from `src/content/fallback.json`.
In Phase 5 the hook refreshes from `GET /api/content` and keeps the snapshot as a fallback.
