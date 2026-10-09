<p align="center">
  <img src="docs/images/banner.webp" alt="Daniel Al Kabbout: portfolio, CV and content studio" width="100%">
</p>

<p align="center">
  <a href="https://danielalkabbout.pages.dev"><b>Live site</b></a> ·
  <a href="https://danielalkabbout.pages.dev/cv"><b>CV</b></a> ·
  <a href="https://danielalkabbout.pages.dev/projects"><b>Projects</b></a> ·
  <a href="SECURITY.md"><b>Security</b></a> ·
  <a href="docs/DEPLOY.md"><b>Hosting guide</b></a>
</p>

<p align="center">
  <a href="https://github.com/danielalkabbout/Daniel-Portfolio/actions/workflows/pipeline.yml"><img src="https://github.com/danielalkabbout/Daniel-Portfolio/actions/workflows/pipeline.yml/badge.svg" alt="Pipeline"></a>
  <img src="https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white" alt=".NET 10">
  <img src="https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB" alt="React 19">
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL on Neon">
  <img src="https://img.shields.io/badge/Hosting-Cloudflare%20%2B%20Render-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Pages and Render">
</p>

My portfolio, built as a small full-stack product rather than a static page: a React site, an ASP.NET Core API
with a PostgreSQL database, a private studio where I edit everything, and a pipeline that tests every change
before it goes live.

<p align="center">
  <img src="docs/images/home.webp" alt="Home page with Echo, the assistant that answers questions about my work" width="100%">
</p>

## What's inside

| | |
| --- | --- |
| **Echo, a CV assistant** | Answers questions about my work from a rule engine built on my CV, and falls back to Google Gemini for anything the rules don't cover. |
| **Interactive projects** | Live demos (a WhatsApp chat, a noise-cancellation pipeline, an object detector, a terminal) and architecture views for each project. Private code can be requested with one click. |
| **A CV that builds itself** | The CV page and its A4 PDF are generated from the same content as the site, so a new project or role appears on the CV automatically. |
| **Content studio** | A private `/admin` where every project, role, skill, heading, card and home page block can be edited, reordered by drag and drop, previewed and published. |
| **Requests inbox** | The services form and code requests are saved to the database, listed in the studio and emailed to me. |
| **Secure by design** | SRP sign-in where the password never leaves the browser, HttpOnly session cookies, CSRF checks, rate limits, bot protection and a strict CSP. |
| **Fully responsive** | Designed for phones as carefully as for desktop, in dark and light themes. |

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/images/projects.webp" alt="Projects page with live demos and links"><br><sub><b>Projects:</b> demos, stack and links, or a code request when the repository is private</sub></td>
    <td width="50%"><img src="docs/images/cv.webp" alt="CV page generated from the site content"><br><sub><b>CV:</b> generated from the site content, with a real A4 PDF download</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/studio.webp" alt="Content studio overview"><br><sub><b>Studio:</b> overview, publish status and quick actions</sub></td>
    <td width="50%"><img src="docs/images/studio-pages.webp" alt="Studio page layout editor"><br><sub><b>Page text and layout:</b> edit every section and drag the home page blocks into any order</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/images/mobile.webp" alt="The site, the CV and the studio on a phone" width="100%">
</p>

## Architecture

```mermaid
flowchart LR
    visitor([Visitor]) -->|HTTPS| site
    me([Me, in the studio]) -->|HTTPS| site

    subgraph cf [Cloudflare]
        site[React 19 site<br/>Cloudflare Pages]
        fn[/api proxy<br/>Pages Function/]
        site --- fn
    end

    fn -->|edge key| api

    subgraph render [Render]
        api[ASP.NET Core 10 API<br/>Docker]
    end

    api --> db[(PostgreSQL<br/>Neon)]
    api -.->|optional| gemini[Google Gemini<br/>Echo fallback]
    api -.->|optional| resend[Resend<br/>request emails]
    api -.->|optional| r2[Cloudflare R2<br/>images]
```

The browser only ever talks to its own origin. A Cloudflare Pages Function forwards `/api` calls to the API
with a shared edge key, so the API can refuse anything that didn't come through the site, and the session
cookie can stay `SameSite=Strict`. Each production build also bakes the latest content into the site, so it
renders instantly even while the free API host is asleep.

## How the studio sign-in works

The studio uses **SRP-6a** ([RFC 5054](https://datatracker.ietf.org/doc/html/rfc5054)): the browser proves it
knows the password without ever sending it, and the database stores only a salt and a verifier.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (studio)
    participant A as API
    participant D as Database

    B->>A: challenge: fingerprint of the email
    A->>D: look up salt and verifier
    A-->>B: salt + server value B (one-time)
    Note over B: derive the key from the password (PBKDF2),<br/>compute the proof M1 locally
    B->>A: login: value A + proof M1 (no email, no password)
    A->>A: check M1 against the verifier
    A-->>B: HttpOnly session cookie + server proof M2
    Note over B: check M2, so a fake server can't pretend
```

Five wrong attempts lock the account for a while, and changing the password ends every other session.

## How changes ship

```mermaid
flowchart LR
    pr[Pull request] --> checks{API tests on a real PostgreSQL<br/>container build<br/>web lint, tests and build}
    checks -->|merge to main| filter[Detect what changed]
    filter -->|api/| deployApi[Deploy API to Render<br/>wait for the new commit]
    filter -->|web/| deployWeb[Rebuild site on Cloudflare Pages<br/>wait for the new build]
    deployApi --> prod[Production check<br/>health, content, CORS, every page]
    deployWeb --> prod
```

Nothing deploys unless its tests pass, and only the part that changed is redeployed. Dependabot opens weekly
update pull requests, which go through the same checks.

## Tech stack

| Part | Stack | Hosting |
| --- | --- | --- |
| `web/` | React 19, TypeScript, Vite, React Router, TanStack Query, zod, jsPDF, Vitest | Cloudflare Pages |
| `api/` | ASP.NET Core 10, EF Core, FluentValidation, SRP-6a, JWT in HttpOnly cookies, xUnit | Render (Docker) |
| Database | PostgreSQL | Neon |
| Pipeline | GitHub Actions, Dependabot | GitHub |

## Repository layout

```
api/
  src/Portfolio.Api/             controllers, SRP sign-in, validation, Echo, email alerts
  src/Portfolio.Domain/          entities
  src/Portfolio.Infrastructure/  EF Core, migrations, content service, seed
  tests/Portfolio.Tests/         xUnit integration tests against PostgreSQL
web/
  src/pages/                     Home, About, Experience, Projects, Services, CV, Admin
  src/features/                  studio, CV builder and PDF, Echo, project demos
  functions/api/                 Cloudflare Pages Function that forwards /api
  public/_headers                security headers and caching
.github/workflows/               pipeline, PR checks, keep-warm
docs/                            hosting guide and README images
```

## Run it locally

You need the [.NET 10 SDK](https://dotnet.microsoft.com/download), [Node.js 22](https://nodejs.org) and a
PostgreSQL database (local or a free Neon branch).

```bash
# API: http://localhost:5080
cd api
dotnet user-secrets --project src/Portfolio.Api set "ConnectionStrings:Default" "Host=localhost;Database=portfolio;Username=postgres;Password=..."
dotnet run --project src/Portfolio.Api -- migrate        # create the tables and the starting content
dotnet run --project src/Portfolio.Api -- create-admin   # your studio account (asks for email and password)
dotnet run --project src/Portfolio.Api
dotnet test                                              # set TEST_DB to run the integration tests

# Website: http://localhost:5173
cd web
cp .env.example .env.local    # VITE_API_URL=http://localhost:5080
npm install
npm run dev
npm test
```

Without `VITE_API_URL` the site still runs on its bundled content; the studio needs the API.
Hosting it for free, step by step, is in [docs/DEPLOY.md](docs/DEPLOY.md), and the website's details are in
[web/README.md](web/README.md).

## Security

This repository is public and holds no secrets: keys, passwords and connection strings live only in the
hosting dashboards and GitHub Actions secrets. See [SECURITY.md](SECURITY.md) for how the site is protected
and how to report a problem.

---

<p align="center">
  Built by <a href="https://www.linkedin.com/in/daniel-alkabbout">Daniel Al Kabbout</a>, AI Software Engineer (C#/.NET), Lebanon
</p>
