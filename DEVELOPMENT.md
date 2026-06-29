# Development Guide

Deep reference for working in the codebase. For the short orientation see [CLAUDE.md](./CLAUDE.md); for the build/maintenance pipelines see [MAINTENANCE.md](./MAINTENANCE.md); for per-site config fields see [FORKING.md](./FORKING.md).

## Architecture at a glance

Static site generation: every page is pre-rendered to a real HTML file in `dist/` at build time (`@sveltejs/adapter-static`), then served by GitHub Pages. There is no runtime server — `+server.ts` endpoints (`sitemap.xml`, `llms.txt`, per-lang `rss.xml`/`atom.xml`) are all prerendered.

Content is **data, not code**. Markdown pages and JSON collections under `src/data/` are loaded at build time via `import.meta.glob({ eager: true })` in `src/lib/data/`, and markdown bodies are pre-rendered to sanitized HTML by a Vite plugin (`scripts/vite/rendered-pages.ts`). None of the markdown machinery (`marked`, Shiki, `sanitize-html`) ships to the client — the runtime just inserts pre-rendered HTML.

```text
src/data/*.md / *.json
        │  (build time)
        ▼
src/lib/data/*.ts  ──glob/load──►  typed content objects
        │
        ▼
src/routes/**/+page.ts  ──load()──►  page data
        │
        ▼
src/routes/**/+page.svelte  ──►  templates + collections  ──►  HTML in dist/
```

## Routing

File-based routing under `src/routes/`:

| Route                                           | Purpose                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `+layout.svelte` / `+layout.ts`                 | Root layout: `<html lang>`, JSON-LD graph, chrome (navbar/footer)     |
| `+page.svelte` / `+page.ts`                     | Root `/` — mirrors the default-language home (no redirect)            |
| `[lang=lang]/+page.svelte`                      | `/es/`, `/en/` home                                                   |
| `[lang=lang]/[...slug]/+page.svelte`            | Catch-all that resolves any page by slug and dispatches to a template |
| `[lang=lang]/{rss,atom}.xml/+server.ts`         | Per-language feeds (writing section)                                  |
| `sitemap.xml/+server.ts`, `llms.txt/+server.ts` | Site-wide, default-language, derived from the same data               |

`src/params/lang.ts` is the `[lang=lang]` matcher — it reads `getSupportedLanguages()` from config, so a monolingual fork automatically 404s the other locale.

### The catch-all dispatch

`[lang=lang]/[...slug]/+page.svelte` is the heart of page rendering. It:

1. Splits the slug into segments, resolves the first segment to a real page via `resolvePageSlug()`.
2. Loads `pageData` via `getPageData(pageSlug, lang)`.
3. Branches on segment count + section helpers (`isWritingSection`, `isPortfolioSection`) and the page's `template` field:
   - 4 segments under the writing section → `WritingPostTemplate` (`/writing/YYYY/MM/slug/`)
   - 2 segments under the portfolio section → `AlbumTemplate`
   - `template: writing`/`portfolio` listing pages → `WritingsTemplate` / `PortfolioTemplate`
   - everything else → `PageTemplate`
   - no/inactive page → inline 404

> On the APU site today only the `PageTemplate` branch is exercised (home + privacy). The writing/portfolio branches are live template code with no content behind them — see CLAUDE.md "Dormant subsystems."

## Pages and collections

A page is a markdown file with frontmatter (`src/data/paginas/{lang}/<slug>.md`):

```yaml
title: APU Viajes de Montaña
subtitle: Escalada y Trekking en Colombia
template: page
collections:
  - { active: true, collection: hero }
  - { active: true, collection: servicios }
settings:
  active: true
  slug: inicio
  sidebar: false
  ogDescription: "…"
  ogImage: /media/new-logo.png
```

`template: page` renders each listed **collection** in order. A collection is a JSON file in `src/data/colecciones/{lang}/<name>.json` mapped to a `Collection*.svelte` component via the registry in `CollectionRenderer.svelte`. The home page composes: `hero`, `sobre-nosotros`, `servicios`, `galeria`, `contacto`.

To add a collection: create the JSON in both locales, add a `Collection<Name>.svelte`, register it in `CollectionRenderer.svelte`, then reference it from a page's `collections[]`.

## Configuration & defaults

Per-locale config lives in `src/data/configuracion/{lang}/`: `sitio.json`, `seo.json`, `navegacion.json`, `pie-de-pagina.json`, `escritos.json`, `portafolio.json`, `proyectos.json`, `traducciones.json`. See [FORKING.md](./FORKING.md) for the full field reference.

Defaults are centralized in **`src/lib/defaults.ts`** and merged onto the per-locale JSON in **`src/lib/config.ts`** (`import.meta.glob` so monolingual forks work). Consumers read the fully-resolved shape — **never write `?? fallback` for a config knob in a component**; move the default into `defaults.ts`. `check:required-config` fails the build if a `REQUIRED()` sentinel survives unset.

## State (Svelte 5 runes)

Rune stores in `src/lib/stores/*.svelte.ts`:

- `theme.svelte.ts` — dark/light, persisted to `localStorage` (all access wrapped in try/catch for Safari Private Mode), synced to system preference.
- `lang.svelte.ts` — current locale, URL-driven.
- `sidebar.svelte.ts` — sidebar open state.

Component reactivity uses `$state`, `$derived`, `$effect`, `$props`. The catch-all page is fully `$derived` off `data.slug` + `lang`, so SSG output and client hydration produce identical DOM. See AUDIT_CHECKLIST.md §3 (Runtime Correctness) for the patterns the audit enforces.

## i18n

Custom, zero-runtime-library: `t(lang, "key")` and `tObject(lang, "key")` read flat key paths from `src/data/configuracion/{lang}/traducciones.json`. Pluralization via `_one`/`_other` suffixes. `npm run check:i18n` enforces EN↔ES key parity and flags orphan keys (see MAINTENANCE.md).

## Styling

Tailwind v4, CSS-first. `src/theme.css` holds the `@theme` tokens (colors light + dark, fonts, radii, shadows); components use utility classes (`bg-bg`, `text-text`, `text-accent`, `border-border`). **No hex literals in components** — `check:fork` enforces it. `src/app.css` does the `@import` of fonts + global rules + the `prefers-reduced-motion` override.

To re-skin: edit `src/theme.css` only. To swap a typeface, see FORKING.md § "Swapping primary typeface" (npm swap + `@import` + token + fallback-metrics block).

## Markdown rendering pipeline

`scripts/vite/rendered-pages.ts` (Vite plugin) walks `src/data/{escritos,paginas}/**/*.md` at build time: `gray-matter` frontmatter → `marked` + `marked-gfm-heading-id` → Shiki dual-theme code → Pandoc image attrs + responsive `srcset`/`width`/`height` → external-link hardening → `sanitize-html`. Output is exposed as the `virtual:rendered-pages` module; data loaders consume the pre-rendered HTML and templates do `<MarkdownRenderer html={data.html} />`.

The narrow exception is **inline markdown in JSON config strings** (footer copyright, bio, hero subtitle), rendered at runtime by `src/lib/inline-markdown.ts` (~80-line regex renderer for bold/italic/code/links). Want richer markdown in a field? Move it to an `.md` page body instead of growing that file.

Other build-time Vite plugins (`scripts/vite/`): `srcset-manifest`, `image-dims`, `og-manifest`, and a dev-only admin-index server. See MAINTENANCE.md § "Build-time Vite plugins."

## Editing content via the CMS locally

```bash
npm run dev          # then open http://localhost:5173/admin/
```

Click **Work with Local Repository**, grant folder access, pick the repo root. Edits write straight to the working tree (Sveltia uses the File System Access API — no proxy, no `local_backend`). Review, then `git add` + commit yourself. See MAINTENANCE.md § "Edit content via Sveltia CMS locally" for the dev-only preview-path details.

## Quality gates

Run the full local gate before considering work done:

```bash
npm run audit:all
```

It chains type-check, lint, markdownlint, prettier, cspell, ~20 `check:*` validators, vitest, build, and bundle/jsonld/canonical-host checks. The pre-commit hook runs the fast subset; CI runs the rest. Full breakdown in [MAINTENANCE.md](./MAINTENANCE.md).
