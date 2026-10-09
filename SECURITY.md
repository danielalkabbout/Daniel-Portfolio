# Security

This repository is public, so it holds **no secrets**: every key, password and connection string lives in
the hosting dashboards (Render, Cloudflare Pages) or in GitHub Actions secrets, and is read from the
environment at runtime. `appsettings.json` only has empty placeholders.

## How the site is protected

| Area | Protection |
| --- | --- |
| Studio sign-in | SRP-6a (RFC 5054): the email and password never leave the browser; the database keeps only a verifier. Five wrong attempts lock the account for a while. |
| Sessions | HttpOnly, Secure, SameSite=Strict cookie scoped to `/api`, never readable by scripts. Changing the password ends every other session. |
| Requests to the API | Same-origin through a Cloudflare Pages Function, optional shared edge key so only the site can reach the API, a CSRF header on every change, strict CORS. |
| Forms | Server-side validation (FluentValidation), rate limits, a hidden bot field and Cloudflare Turnstile. |
| Browser | Strict Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, a narrow Permissions-Policy. |
| Uploads | Size limits and a file-signature check, so only real images are accepted. |
| Pipeline | Tests run against a real PostgreSQL database before anything deploys; workflows get read-only repository access; deploy hooks are GitHub secrets. |
| Dependencies | Dependabot opens weekly update pull requests for npm, NuGet, Docker and GitHub Actions. |

## Reporting a problem

If you find a security issue, please don't open a public issue. Use GitHub's
**[private vulnerability reporting](../../security/advisories/new)** for this repository, or email
the address on [danielalkabbout.pages.dev](https://danielalkabbout.pages.dev). I'll reply as soon as I can.
