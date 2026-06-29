# CLAUDE.md — APU Viajes de Montaña

## Commit rules

- **Always confirm before committing and pushing.** Never commit, push, or merge on the maintainer's behalf without explicit confirmation first; stage and explain, then ask.
- **Commit messages must be under 72 characters and include a prefix** (e.g. `feat:`, `fix:`, `chore:`, `docs:`).

Official website for **APU Viajes de Montaña** (APU Mountain Travel), a Colombian company offering rock climbing, trekking, and mountaineering experiences. Live at **[www.viajesapu.com](https://www.viajesapu.com)**.

This file is the short orientation. The detail lives in dedicated guides — go there, don't duplicate here:

| Doc                                        | Use it for                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| [DEVELOPMENT.md](./DEVELOPMENT.md)         | Architecture deep dive, data flow, components, runes, content authoring |
| [MAINTENANCE.md](./MAINTENANCE.md)         | The `scripts/` pipelines + checks, the pre-commit hook, CI gates        |
| [FORKING.md](./FORKING.md)                 | Every per-site config field + how to re-skin the template               |
| [AUDIT_CHECKLIST.md](./AUDIT_CHECKLIST.md) | The reusable audit framework (build, perf, security, a11y, SEO…)        |
| [SECURITY.md](./SECURITY.md)               | Threat model + disclosure policy                                        |
| [README.md](./README.md)                   | Public-facing intro (services, pricing, contact)                        |
| [COMPARISON.md](./COMPARISON.md)           | Historical: the React → SvelteKit migration rationale                   |

## What this site is, in one breath

A statically generated (SSG) **SvelteKit 2 + Svelte 5** site, content-managed through **Sveltia CMS** at `/admin/`, styled with **Tailwind v4**, deployed to **GitHub Pages**. It was forked from the `goanpeca.co` template, so the framework code (`src/lib/`, `src/routes/`, `src/params/`, `scripts/`) is shared template machinery; everything APU-specific is data + config + theme.

## Tech stack

- **Framework**: SvelteKit 2 + Svelte 5 (runes), `@sveltejs/adapter-static` → `dist/`
- **Styling**: Tailwind CSS v4 (`@theme` tokens in `src/theme.css`), self-hosted fonts (`@fontsource-variable/{inter,lora}`)
- **Content**: Markdown (`src/data/paginas/`) + JSON collections (`src/data/colecciones/`, `src/data/configuracion/`), pre-rendered at build time
- **CMS**: Sveltia CMS (pinned + SRI), GitHub backend via a Cloudflare OAuth worker
- **Icons**: `lucide-svelte` + custom brand SVGs
- **Analytics**: GA4 (`G-QX7QRBG45P`), consent-gated
- **i18n**: custom `t()` / `tObject()` helpers, Spanish (default) + English
- **Build node**: Node ≥ 24 (pinned across `.nvmrc` / `package.json` / `Brewfile` / workflows)

## Current shape of the content

This is effectively a **single-page bilingual marketing site** today:

- **Pages** (`src/data/paginas/{es,en}/`): `inicio` (home) + `privacidad` (privacy). Home uses `template: page` and renders ordered **collections**: `hero`, `sobre-nosotros`, `servicios`, `galeria`, `contacto` (`src/data/colecciones/{es,en}/`).
- **Navigation** is anchor-based within the home page (`servicios`, `planes`, `galeria`, `contacto`).
- **Dormant subsystems**: the template ships portfolio (`portafolio`), writing/blog (`escritos`), and projects (`proyectos`) support — components, data loaders, config files, and checks all exist — but **this site has no such content**, so those code paths and their checks operate on empty sets. Don't delete them; activate by adding content + config per [FORKING.md](./FORKING.md).

## Project layout

```text
src/
  app.html            # HTML shell (CSP, GTM/GA bootstrap, theme/FOUC script)
  app.css             # @import fonts + global rules + reduced-motion
  theme.css           # @theme color/font/radius tokens (light + dark)
  routes/             # SvelteKit file routing (see DEVELOPMENT.md)
  lib/
    components/        # templates/, collections/, cards/, chrome/, media/, widgets/, SEO.svelte
    data/             # build-time content loaders (site, pages, collections, ...)
    stores/           # Svelte 5 rune stores (theme, lang)
  data/               # ← APU content lives here (paginas, colecciones, configuracion)
  params/lang.ts      # [lang=lang] matcher
scripts/
  pipeline/           # favicons, image optimize, OG images, copyright, lighthouse config
  checks/             # ~20 verification gates (see MAINTENANCE.md)
  vite/               # build-time Vite plugins (markdown pre-render, srcset/dims manifests)
static/               # /media, /favicon, /admin (CMS), CNAME, robots.txt
```

## Working here

```bash
npm run dev            # local dev server (CMS at http://localhost:5173/admin/)
npm run build          # SSG build → dist/
npm run audit:all      # full local gate (everything CI runs)
npm test               # vitest unit suite
```

Generated files (favicons, `static/srcset/`, `static/og/`, lighthouse configs) are **never edited by hand** — the pre-commit hook regenerates them and CI fails on drift. See [MAINTENANCE.md](./MAINTENANCE.md).

## Conventions

- **No hex literals or brand strings in framework code** (`src/lib/`, `src/routes/`). Colors come from `theme.css` tokens; brand/copy comes from `src/data/configuracion/`. `npm run check:fork` enforces this.
- **No `?? fallback` for config knobs** — defaults live once in `src/lib/defaults.ts`; consumers read the fully-merged shape from `$lib/config`.
- Spanish folder/key names under `src/data/` are intentional stable keys, not user-facing language.
- Bilingual parity (every `t()` key in both locales) is enforced by `npm run check:i18n`.
