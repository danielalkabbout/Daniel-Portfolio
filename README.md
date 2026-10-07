# Daniel Al Kabbout, portfolio

[![Pipeline](https://github.com/danielalkabbout/Daniel-Portfolio/actions/workflows/pipeline.yml/badge.svg)](https://github.com/danielalkabbout/Daniel-Portfolio/actions/workflows/pipeline.yml)

My portfolio site with a content studio, built as a small full-stack product.

| Part | Stack | Hosting |
| --- | --- | --- |
| `web/` | React 19, TypeScript, Vite, React Router, TanStack Query, zod | Cloudflare Pages |
| `api/` | ASP.NET Core 10, EF Core, PostgreSQL, FluentValidation, JWT | Render (Docker) |
| Database | PostgreSQL | Neon |

Highlights: Echo, an assistant that answers from my CV with rules and falls back to Gemini;
a content studio for editing every section without touching code; interactive project demos;
request form with bot protection and email alerts.

## How changes ship

```
pull request ──► API tests (real Postgres) + container check, web lint + build
merge to main ─► Pipeline: test what changed ─► deploy API (Render) ─► wait for new commit live
                                            └─► rebuild site (Cloudflare Pages) ─► wait for new build
                                            └─► production check: health, content, CORS, every page
```

Dependabot opens weekly update PRs, which go through the same checks.

- Website: [web/README.md](web/README.md)
- Hosting setup: [docs/DEPLOY.md](docs/DEPLOY.md)
