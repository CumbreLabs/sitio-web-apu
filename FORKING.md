# Forking guide

This site is built to be forked. The framework code in `src/lib/`, `src/routes/`, `src/params/`, and `scripts/` is identical across every site that uses this template; per-site customization lives in five places:

1. **`src/data/configuracion/{lang}/*.json`** — eight per-locale config files split by domain:
   - `sitio.json` — brand identity, routing, theme, analytics, sitemap
   - `seo.json` — SEO defaults + OG/Twitter card config
   - `escritos.json` — writing-section settings (page id, pagination, sort, feed cap, summary toggle, feed label, cards-per-row)
   - `portafolio.json` — portfolio-section settings (page id, sort, initial filter)
   - `proyectos.json` — projects-section settings (cards-per-row drives both listing + home `proyectos-destacados`)
   - `pie-de-pagina.json` — footer copy + social links + privacy page id
   - `navegacion.json` — navbar **brand** (text + logo + dark variant) + nav items (each with an `active` toggle)
   - `traducciones.json` — UI strings
2. **`src/data/{paginas,colecciones,portafolio,escritos,documentos}/`** — actual content
3. **`src/theme.css`** — colors, fonts, radii, shadows (Tailwind v4 `@theme` tokens)
4. **`static/`** — media (`/media/*.webp`), favicons (regenerated), CMS config, CNAME, robots.txt
5. **`README.md` + `package.json#name` + `LICENSE`** — repo-level identity. **LICENSE in this repo is proprietary** (© Gonzalo Peña-Castellanos; framework + content). A fork that intends a different license MUST replace `LICENSE` entirely; the engineering separation between framework code and per-site data was built for the copyright holder's internal multi-site maintainability, NOT as a public-fork invitation. Contact `goanpeca@gmail.com` for licensing inquiries.

If you find yourself editing a `.svelte` file in `src/lib/components/` to change a brand string or color, **stop** — that's a bug in the abstraction, not a fork requirement. File an issue or extend the schema instead.

---

## 30-second bootstrap (when only copy / palette change)

```bash
# 1. Clone
git clone <this-repo> ~/sites/new-site && cd ~/sites/new-site
git remote remove origin

# 2. Wipe content (keep structure)
find src/data/portafolio src/data/escritos -mindepth 2 -delete
find src/data/colecciones -name '*.json' -delete
find src/data/paginas -mindepth 2 -delete
find static/media static/srcset static/og -mindepth 1 -delete

# 3. Re-seed the 4 SYSTEM paginas (required — npm run check:required-paginas
#    will fail the build if any are missing or set to active=false):
#      - paginas/{lang}/<homePage>.md         (default: inicio.md)
#      - paginas/{lang}/<writingPageId>.md    (default: escritos.md)
#      - paginas/{lang}/<portfolioPageId>.md  (default: portafolio.md)
#      - paginas/{lang}/<privacyPageId>.md    (default: privacidad.md)
#    Copy templates from a sibling fork or check this repo's git history.

# 4. Edit the customization points
$EDITOR src/data/configuracion/{es,en}/*.json   # all 8 config files
$EDITOR src/theme.css
$EDITOR static/admin/config.yml                  # site_url, display_url, repo
$EDITOR static/CNAME                             # new custom domain
$EDITOR README.md                                # new site name
$EDITOR LICENSE                                  # replace with your fork's license

# 5. Drop in initial content + assets, then
npm ci
npm run audit:all      # all 26 gates must pass before commit (also runs in pre-commit + CI)
npm run dev
```

That's the happy path. Anything beyond a re-skin needs the deeper guide below.

> **Verification gates that protect a fork:** `npm run audit:all` chains 26 checks including `check:fork` (no per-site literals in framework code), `check:required-config` (no `__REQUIRED__` sentinel from `src/lib/defaults.ts` survives into the merged config — see [Required config fields](#required-config-fields--the-sentinel-system) below), `check:required-paginas` (the 4 system page-IDs all resolve), `check:nav-slugs` (every navbar key points at a real page), `check:frontmatter` (paginas + escritos schemas valid, incl. `settings.sidebar`), `check:i18n` (every `t()` key in both locales), `check:node-pin` (Node version pinned consistently across `.nvmrc` / `package.json#engines` / `Brewfile` / workflows), `check:audit-doc` (AUDIT_CHECKLIST.md structural integrity), `check:portfolio-parity` (every album's `photos[].src` array identical across locales), `check:album-weight` (per-image ≤ 2 MB + per-album ≤ 20 MB source-bytes budget), `check:licenses` (transitive deps all permissive), `check:actions-pinned` (every GitHub Action pinned to a 40-char SHA), and `check:canonical-host` (every emitted canonical URL matches `sitio.json#url` host). Failing any of these breaks the build before you ship.

### Required config fields — the sentinel system

Every default config value across every domain (sitio / seo / escritos / portafolio / proyectos / navegacion / pie-de-pagina) lives in **`src/lib/defaults.ts`**. Each field is either a literal default (`cardsPerRow: 3`, `defaultSort: "date-desc"`) or a `REQUIRED("hint")` sentinel that survives the deep-merge in `$lib/config` if the fork forgot to override it. Fields that **must** be set per fork (no sane default exists) include:

- `site.name`, `site.author`, `site.url`, `site.favicon` (identity + canonical + favicon source)
- `seo.description`, `seo.defaultOGImage` (per-locale meta description + landscape OG fallback)

The `check:required-config` gate walks the merged config tree, finds any surviving `__REQUIRED__` strings, and fails the build with the field path + the embedded hint — e.g. `seo.description: __REQUIRED__Site-wide meta description (per-locale)…`. So a fresh fork can't ship a half-configured site that renders literal `__REQUIRED__…` strings into the page.

If you see `check:required-config` fail or `__REQUIRED__…` text appear in a built page, open `src/lib/defaults.ts` to see the full schema + hints — that file is the single auditable source of truth for "what defaults am I inheriting? what must I set?". Templates and components NEVER carry `?? fallback` for config knobs; the defaults are pre-merged once in `$lib/config` and consumers read the fully-resolved shape. If you find a `??` for a config field in a `.svelte` or `.ts` file, that's a bug — move the default into `defaults.ts` instead.

### Markdown rendering pipeline (build-time)

Body markdown for writing posts and paginas is **pre-rendered at build time** by `scripts/vite/rendered-pages.ts` — a Vite plugin that walks `src/data/{escritos,paginas}/**/*.md`, parses frontmatter with `gray-matter`, renders the body through `marked` + `marked-gfm-heading-id`, tokenizes fenced code blocks with **Shiki** (dual light/dark theme output), expands Pandoc-style image attributes, injects responsive `srcset` + `width`/`height` on `/media/` images, hardens external links (`target="_blank" rel="noopener noreferrer"`, unsafe URI schemes downgraded), and finally runs the output through **`sanitize-html`**. The plugin exposes `virtual:rendered-pages` (a `Record<path, {meta, html, headings, body}>`) which the data loaders in `$lib/data/` consume.

Why a forking guide cares: **none of that markdown machinery ever ships to the client**. The marked library, Shiki cache, `marked-gfm-heading-id`, `github-slugger`, and the sanitizer all live inside the Node-only Vite layer. Templates do `<MarkdownRenderer html={data.html} />` — the runtime just inserts pre-rendered HTML. A fork that adds new `.md` files anywhere under `src/data/escritos/` or `src/data/paginas/` gets the same pipeline for free (no per-post wiring, no opt-in).

The narrow exception: **inline markdown in JSON config strings** (footer copyright, header bio paragraph, hero subtitle) is rendered at runtime by `$lib/inline-markdown.ts` — an ~80-line regex renderer for the bold/italic/code/links + paragraph subset that those fields actually use. If a fork wants a config field with richer markdown (lists, code fences, images), **move that field to an `.md` file** under `paginas/` and reference it as page body content; don't grow `inline-markdown.ts`.

---

## Per-config-file field reference

### `sitio.json` — site identity, routing, theme, analytics, sitemap

| Field             | Type                        | Controls                                                                                                    | Notes                                                                                                                                                                                                                                               |
| ----------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`            | string                      | `<title>` site-name part, `og:site_name`, Navbar wordmark, error-page title, JSON-LD WebSite                | Browser-tab visible. Keep short.                                                                                                                                                                                                                    |
| `author`          | string                      | `<meta name="author">` on every page, JSON-LD Person, OG site_name fallback                                 | Can diverge from `name` (e.g. `name="Estudio X"` + `author="Person Name"`). Falls back to `name` when empty.                                                                                                                                        |
| `jobTitle`        | string (per-lang)           | JSON-LD `Person.jobTitle`                                                                                   | Omitted from JSON-LD when empty.                                                                                                                                                                                                                    |
| `knowsLanguage`   | string[] of ISO 639-1 codes | JSON-LD `Person.knowsLanguage` only — feeds Google Knowledge Panel                                          | NOT the human-readable "Idiomas" section on the About page (that lives in `colecciones/{lang}/idiomas.json` with display labels like "Español (Nativo)"). Keep this in sync with the visible list manually. Defaults to `languages[]` when missing. |
| `defaultLanguage` | `"es" \| "en" \| ...`       | Which locale renders at `/` (no redirect; root mirrors `/<defaultLanguage>/`). Fallback for missing strings | Must be one of `languages[]`.                                                                                                                                                                                                                       |
| `languages`       | string[]                    | The set of supported locales. Drives `src/params/lang.ts` matcher + language toggle + JSON-LD `inLanguage`  | Single-language site: `["en"]`. Lang toggle hides itself when length is 1.                                                                                                                                                                          |
| `homePage`        | page-id string              | Which `paginas/*.md` file renders at `/` and `/<lang>/`                                                     | File basename in `src/data/paginas/{lang}/`.                                                                                                                                                                                                        |
| `url`             | URL                         | Canonical site URL, hreflang absolute URLs, JSON-LD `@id`s                                                  | Must NOT end with `/`. Validated by CMS pattern.                                                                                                                                                                                                    |
| `themeColor`      | CSS color                   | `<meta name="theme-color">` value injected into the HTML shell                                              | Match the dark-mode `--color-bg` token from `theme.css` for visual coherence on initial paint.                                                                                                                                                      |
| `personImage`     | path                        | JSON-LD `Person.image.contentUrl`                                                                           | Defaults to `favicon` when empty.                                                                                                                                                                                                                   |
| `favicon`         | path                        | Source for `generate-favicons.mjs` — derives every variant from this one image                              | High-res PNG/SVG/WebP/JPEG (≥ 512). ICO is rejected explicitly.                                                                                                                                                                                     |
| `lcpHeroImage`    | path                        | LCP preload image injected by `hooks.server.ts` on home pages                                               | Defaults to `seo.defaultOGImage`. Empty → no preload tag.                                                                                                                                                                                           |
| `analytics`       | `{provider, id}` object     | Generalized analytics. `provider` ∈ `"gtm" \| "ga4" \| "none"`; `id` is `GTM-…` or `G-…`                    | `none` disables. GTM loads the lazy bootstrap; GA4 loads gtag.js directly. Both gated by consent-mode.                                                                                                                                              |
| `sitemapExtras`   | string[]                    | Standalone URLs to add to `sitemap.xml` outside the page system (e.g. downloadable PDFs)                    | Each entry is either an absolute URL or a `/`-rooted path. Empty/missing → no extras.                                                                                                                                                               |

### `seo.json` — SEO + social card defaults

| Field                    | Type                             | Controls                                                                                                                            | Notes                                                                                                                                                       |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `description`            | string (per-lang)                | `<meta description>` site-wide default + JSON-LD WebSite/Person description                                                         | **CMS-enforced 100-200 chars** (LinkedIn `<100` warning).                                                                                                   |
| `titleTemplate`          | string with `{title}`+`{name}`   | Format of `<title>` per page. Default `"{title}                                                                                     | {name}"`                                                                                                                                                    | Both placeholders required. Empty falls back to default. |
| `defaultOGImage`         | path                             | Landscape OG fallback when a portrait cover has no `/og/` variant                                                                   | Must be ≥ 1200×630. Lives under `/media/`.                                                                                                                  |
| `defaultBackgroundImage` | path (optional)                  | Hero background used by `PageTemplate` / `WritingsTemplate` / `PortfolioTemplate` when a page doesn't set its own `backgroundImage` | Set to a real `/media/…` path (e.g. `/media/fondo-paisaje.webp`) for consistent listing-page heroes. Empty → no hero on pages without their own background. |
| `ogLocales`              | record<lang,OG-locale>           | `og:locale` + `og:locale:alternate`. Falls back to `<lang>_<LANG>` (e.g. `fr_FR`) when missing                                      | Use country-qualified codes (`es_CO`, `en_US`, `fr_CA`).                                                                                                    |
| `twitterCard`            | `summary \| summary_large_image` | Twitter unfurl style                                                                                                                | `summary_large_image` for image-heavy sites.                                                                                                                |
| `twitterHandle`          | `@handle` (optional)             | `twitter:site` + `twitter:creator` meta. **Empty → tags omitted** rather than emitting `content=""`                                 | 15 chars max alphanumeric, optional `@`.                                                                                                                    |

### `escritos.json` — writing-section settings

| Field              | Type                                              | Controls                                                                                                           | Notes                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `writingPageId`    | page-id string                                    | The page-id that renders the writing-list template + owns the deep-path dispatch                                   | Default `"escritos"`. Set to `"blog"` / `"posts"` / `"articles"` for other sites.                                                                                                                                |
| `writingPageSize`  | integer                                           | Posts per page in the writing-list pagination (`?page=N` URL state)                                                | Default `10`. Pagination controls only render when total filtered posts exceed this number.                                                                                                                      |
| `feedSectionLabel` | string (per-lang)                                 | RSS/Atom feed title segment + breadcrumb label for the writing section                                             | `i18n: true` in CMS. Per-language.                                                                                                                                                                               |
| `defaultSort`      | `"date-desc"` \| `"date-asc"` \| `"updated-desc"` | Sort mode for the writing list AND the RSS/Atom feeds (so one config drives both surfaces)                         | Default `"date-desc"` (newest first). Use `"updated-desc"` for changelog-style sites where post edits should resurface posts.                                                                                    |
| `feedItemCount`    | integer                                           | Cap on how many posts the RSS + Atom feeds include                                                                 | Default `50`. Lower for tiny sites; bump for extensive archives. RSS readers truncate very large feeds silently.                                                                                                 |
| `showSummary`      | boolean                                           | Whether to show the post `summary` line under the title on listing cards                                           | Default `true`. Set `false` for a minimal date+title+tags card layout. Per-post summary text always comes from the markdown frontmatter — no hardcoded fallback in code.                                         |
| `cardsPerRow`      | integer 1-6                                       | Cards per row at the largest breakpoint on BOTH the Escritos listing and the home `escritos-destacados` collection | Default `3`. Mobile is always 1 col, `sm` is 2 cols; this value sets `lg+`. Use `2` for content-heavy summaries, `3` for a standard blog grid, `4`+ for very dense feeds. Resolved by `$lib/grid#gridColsClass`. |

### `portafolio.json` — portfolio-section settings

| Field             | Type                                        | Controls                                                                                                           | Notes                                                                                                                                                                            |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `portfolioPageId` | page-id string                              | The page-id that renders the portfolio-list template + owns album deep paths                                       | Default `"portafolio"`. Set to `"gallery"` / `"work"` etc.                                                                                                                       |
| `defaultSort`     | `"manual"` \| `"name-asc"` \| `"name-desc"` | Album ordering in the portfolio list                                                                               | Default `"manual"` (preserves JSON-file order — useful when you want editorial control). Alphabetical sorts are good for large portfolios where manual ordering becomes tedious. |
| `defaultFilter`   | tag string (or `"all"`)                     | Pre-selected filter chip on portfolio page load (must match a real tag in the dataset, else falls back to `"all"`) | Default `"all"`. Set to `"vertical"` / `"horizontal"` / any project-specific tag for a focused entry view.                                                                       |

### `proyectos.json` — projects-section settings

| Field         | Type        | Controls                                                                                                             | Notes                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cardsPerRow` | integer 1-6 | Cards per row at the largest breakpoint on BOTH the Proyectos listing and the home `proyectos-destacados` collection | Default `3`. Mobile is always 1 col, `sm` is 2 cols; this value sets `lg+`. Use `1` for text-heavy project cards (preserves stacked layout), `2` for icon-and-description cards, `3` for a dense project grid. Resolved by `$lib/grid#gridColsClass`. The home collection also pulls `2 × cardsPerRow` items so featured fills two rows. |

### `navegacion.json` — navbar (brand + items)

| Field               | Type                         | Controls                                                                      | Notes                                                                                                                                                                                   |
| ------------------- | ---------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand.text`        | string (per-lang)            | Wordmark shown in the navbar's top-left link (always navigates to `/<lang>/`) | Empty → falls back to `sitio.json#name`. Useful when you want a shorter nav wordmark than the full site name (e.g. `"ACME"` vs `"Acme Corporation Inc."`). Max 60 chars (mobile width). |
| `brand.image`       | path (optional)              | Logo image rendered to the left of (or instead of) the wordmark               | Empty → text-only navbar (current default). PNG / SVG / WebP / JPEG / AVIF. Lives under `/media/`.                                                                                      |
| `brand.imageDark`   | path (optional)              | Dark-theme variant of the logo                                                | Empty → reuse `brand.image` in both themes. Useful for PNG logos with locked palettes; SVGs using `currentColor` can usually skip this.                                                 |
| `brand.imageAlt`    | string (per-lang)            | Accessibility alt text for the logo                                           | Cascade when empty: `brand.text` → `sitio.json#name`. Always carries meaningful alt.                                                                                                    |
| `brand.imageHeight` | integer                      | Pixel height of the logo (width auto-derives to preserve aspect ratio)        | Default `32`. Range 16-80. Set higher (40-48) for prominent logos.                                                                                                                      |
| `brand.showText`    | boolean                      | Whether to render the wordmark alongside the image                            | Default `true`. Set `false` for image-only navbars (when the logo already includes the brand name baked in).                                                                            |
| `items[]`           | list of `{active,key,label}` | Primary nav links rendered in the navbar                                      | `key` is a page-id (validated against real paginas by `npm run check:nav-slugs`); `label` is per-language; `active: false` hides the item without deletion.                             |

### `pie-de-pagina.json` — footer + privacy link

| Field           | Type                | Controls                                                                | Notes                                                                                              |
| --------------- | ------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `privacyPageId` | page-id string      | Page-id that the footer's privacy link points to                        | Default `"privacidad"`. Set to `"privacy"` or the canonical id used in `src/data/paginas/{lang}/`. |
| `copyright`     | markdown (per-lang) | Footer copyright line. `{{currentYear}}` is interpolated at render time | `i18n: true` in CMS.                                                                               |
| `madeWith`      | markdown (per-lang) | Credit line below copyright                                             | `i18n: true` in CMS.                                                                               |
| `social`        | list                | Social-network icons + URLs                                             | Each entry is `{active, key, url}`. `key` picks the icon from a fixed select list.                 |

---

## Customizing the look

### Colors, fonts, radii — `src/theme.css`

Single file. Edit the `@theme` block:

```css
@theme {
  --color-bg: #...; /* light mode */
  --color-bg-dark: #...; /* dark mode (default) */
  /* …text, muted, border, accent, surface for both modes */
  --font-sans: "…", system-ui, sans-serif;
  --font-serif: "…", Georgia, serif;
  --radius-sm: 0; /* increase for rounded UI */
  --shadow-card: 0 1px 2px...;
}
```

Every component renders through these tokens via Tailwind v4 utility classes (`bg-bg`, `text-text`, `border-border`, `text-accent`). **No hex literals in components.** If you see one, it's a bug — flag it.

#### Swapping primary typeface

1. `npm rm @fontsource-variable/inter` (or whichever you're replacing)
2. `npm i @fontsource-variable/<new-face>`
3. Replace the `@import "@fontsource-variable/<old>";` in `src/app.css`
4. Update `--font-sans` (or `--font-serif`) in `src/theme.css`
5. Update the matching `@font-face` fallback metrics block in `app.css` to tune CLS for the new face. Find the metrics by feeding the font URL to a tool like [Fontaine](https://github.com/danielroe/fontaine) or measuring the cap-height ratio manually.

#### WCAG AA contrast

Every `--color-text` / `--color-muted` / `--color-accent` pair must clear 4.5:1 against `--color-bg` AND `--color-surface` of the same mode. See [AUDIT_CHECKLIST.md](AUDIT_CHECKLIST.md) #8.4 for the contrast script. Re-run it whenever you change palette tokens.

---

## Adding a new content type (e.g. "events")

This is the only operation that requires touching `src/lib/data/`. Pattern:

1. Add a markdown folder: `src/data/events/{lang}/*.md` with frontmatter (`slug`, `date`, `title`).
2. Add a new file `src/lib/data/events.ts` matching the existing `writing.ts` pattern (~30 lines: glob + loader + getter), and re-export it from `src/lib/data/index.ts`.
3. Add a page to `src/data/paginas/{lang}/events.md` with `template: events`, `settings.active: true`.
4. Add a new template `src/lib/components/templates/EventsTemplate.svelte` (clone `WritingsTemplate.svelte`).
5. In `[lang=lang]/[...slug]/+page.svelte`, add a dispatch branch:

   ```svelte
   {:else if pageData.template === "events"}
     <SEO ... />
     <EventsTemplate {pageData} />
   ```

6. Add CMS config block for the new collection.

**If the new content type has deep paths** (`/events/YYYY/{slug}/`) like writing posts do, also add:

- `eventsPageId` to `sitio.json` (defaults to `"events"`)
- A `SECTION_EVENTS` export in `routes.ts`
- An `isEventsSection()` helper
- Per-language slug pairing if titles differ between locales

---

## Single-language sites

Set `languages: ["en"]` in `sitio.json` (both files — though only the EN one matters now).

The lang param matcher reads from `getSupportedLanguages()`, so a single-language site will 404 on `/es/...` URLs automatically. The LanguageToggle component renders nothing when there's only one supported language.

You can delete the `src/data/configuracion/es/` folder entirely if you don't need the EN fallback chain to consider Spanish at all, but keeping it cheap and harmless is usually fine.

---

## Renaming the data folders

The folders under `src/data/` use Spanish names (`paginas`, `colecciones`, `portafolio`, `escritos`, `configuracion`, `documentos`). This is **intentional** — they're treated as keys, not as user-facing language. Renaming them is a one-shot mechanical operation:

1. `git mv src/data/paginas src/data/pages` (repeat for each)
2. Sweep `src/lib/data/` for the old folder names and update `import.meta.glob` patterns (~10 sites across the per-concern files: `collections.ts`, `portfolio.ts`, `writing.ts`, `pages.ts`, `featured.ts`, `site.ts`).
3. Sweep `static/admin/config.yml` for the `folder:` / `file:` paths.
4. Sweep `scripts/checks/check-image-paths.mjs`, `scripts/checks/check-i18n.mjs`, `scripts/checks/check-cms-patterns.mjs`.

No component code references these folder names directly — only the files in `src/lib/data/` do the glob loading.

---

## Verifying a fork

```bash
npm ci
npm run check     # TypeScript
npm run lint      # ESLint
npm run format    # Prettier write
npm test          # Vitest unit suite (115 tests)
npm run check:i18n
npm run check:images
npm run check:cms
npm run build && npm run check:bundle
```

All gates must pass before deploying. Pre-commit hook runs the same gates locally on every commit.

For social-card verification after deploy, see the inspector links in [CLAUDE.md](./CLAUDE.md) under "Verifying social-card output".

---

## What's intentionally NOT abstracted

- **Spanish folder names** in `src/data/` — treated as stable keys (see rename guide above)
- **`src/lib/components/collections/Collection*.svelte` registry** — collections are hand-mapped in `CollectionRenderer.svelte`. Forks with very different content shapes (recipe blog, consultancy site) should expect to add/remove entire `Collection*` components rather than re-skinning the existing ones.
- **Sveltia CMS config schema** — collection labels, view filters, hints are all in Spanish. Per-site curation work.
- **Person-shaped JSON-LD graph** — the root layout emits a `Person` entity. A non-personal-brand site (agency, company) should swap to `Organization` JSON-LD in `+layout.svelte` (single-file edit).

---

## Switching adapters (when SSG isn't enough)

This template ships with `@sveltejs/adapter-static` because GitHub Pages can only serve static files. A fork that needs runtime behavior (per-request CSP nonces, dynamic OG-image generation, edge personalization, server-side form handling, A/B testing at the edge) needs a different adapter.

### What stays the same regardless of adapter

These keep working when you swap adapters — they're not adapter-specific:

| System                                                                    | Why it's portable                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `hooks.server.ts` `transformPageChunk` (LCP preload, analytics injection) | Runs on every adapter; SSR or SSG.                                              |
| `src/routes/sitemap.xml/+server.ts`                                       | Server endpoint; works under adapter-node or edge.                              |
| `src/routes/[lang=lang]/rss.xml/+server.ts` + `atom.xml`                  | Same.                                                                           |
| Per-page `<SEO>` component + JSON-LD                                      | Pure component logic.                                                           |
| `virtual:srcset-manifest` + `virtual:image-dims`                          | Build-time Vite virtual modules; emitted into the bundle regardless of adapter. |
| `getAllPageEntries` + `routes.ts` + `+layout.ts` trailing-slash config    | Plain Svelte/SvelteKit code.                                                    |
| Sveltia CMS at `/admin/`                                                  | Pure static; CMS commits land in git, your deploy pipeline picks them up.       |

### What needs adjustment per target adapter

#### `adapter-node` (Node.js server — Render, Fly.io, Railway, your own VPS)

| Concern                                           | Action                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `svelte.config.js`                                | Replace `@sveltejs/adapter-static` import + config with `@sveltejs/adapter-node`. Drop `fallback: "404.html"` and `pages: "dist"` (adapter-node doesn't pre-render by default).                                                                                                             |
| Per-request CSP nonces                            | Now possible — replace the inline `'unsafe-inline'` in `app.html` CSP with a nonce, generate it in `hooks.server.ts`, and rewrite the inline `<script>` tags via `transformPageChunk` to include `nonce="..."`. Currently the meta CSP allows `'unsafe-inline'` because nonces require SSR. |
| `scripts/pipeline/generate-lighthouse-config.mjs` | Still works — it enumerates URL paths from the JSON data, independent of how the URLs are served.                                                                                                                                                                                           |
| Postprocess-404 script (`postprocess-404.mjs`)    | Skip on adapter-node; the equivalent is your server's 404 handler (`+error.svelte` route in SvelteKit).                                                                                                                                                                                     |
| `dist/` artifact path                             | Adapter-node emits to `build/` by default; either rename or update `actions/upload-pages-artifact` `path:` in deploy.yml.                                                                                                                                                                   |
| Bundle-size budget (`check:bundle`)               | Still useful — adjust `BUDGETS` keys in `scripts/checks/check-bundle-size.mjs` to point at adapter-node's chunk layout (likely the same `.svelte-kit/output/client/_app/immutable/` subtree).                                                                                               |
| `check:canonical-host`                            | Still relevant — host parity matters regardless of adapter.                                                                                                                                                                                                                                 |
| `check:jsonld`                                    | Re-target to crawl actual rendered HTML from a smoke test (or run after a `playwright` crawl). The current script walks `dist/**/*.html` which won't exist on a non-SSG adapter.                                                                                                            |
| Deploy workflow                                   | Replace `actions/configure-pages` + `actions/deploy-pages` with whatever your host's deploy action is (Render webhook, Fly `flyctl deploy`, etc.). The smoke job in `deploy.yml` (curl key URLs + assert 200) stays the same.                                                               |

#### `adapter-cloudflare` (Cloudflare Workers / Pages with functions)

| Concern                     | Action                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `svelte.config.js`          | Replace adapter import. Cloudflare Pages with functions uses the same `adapter-cloudflare`.                                                                                                                   |
| Per-request CSP nonces      | Same opportunity as adapter-node — generate nonce in `hooks.server.ts`, swap `'unsafe-inline'` for `'nonce-{nonce}'` in CSP.                                                                                  |
| Image processing at runtime | `sharp` doesn't run in Workers (native dep). Move to Cloudflare Images (HTTP API) OR pre-build srcset variants via the existing `optimize-images.mjs` (still works).                                          |
| OG-image generation         | If you want runtime OG generation per page, ship a Worker route at `/og/<slug>.png` using `@vercel/og` or `satori-html`. The existing `generate-og-images.mjs` build-time approach still works as a fallback. |
| `process.env.*` reads       | Wrap in `import { env } from "$env/dynamic/private"` — Workers doesn't have a real `process`.                                                                                                                 |
| Sveltia CMS OAuth backend   | The current Cloudflare Worker at `cumbre-labs-cms-oauth.goanpeca.workers.dev` (or your fork's equivalent) stays — it's already a Worker, just not part of the site.                                           |
| Deploy workflow             | Use `cloudflare/pages-action@v1` instead of `actions/deploy-pages`. Smoke job stays the same.                                                                                                                 |

#### `adapter-vercel` / `adapter-netlify`

Largely the same shape as `adapter-node`. The vendor-specific adapters provide automatic ISR / edge-function routing. Per-page `export const prerender = true` opts individual routes back into SSG to keep static pages fast and free-tier-friendly.

### What you LOSE moving off adapter-static

| Capability                   | Why SSG is uniquely good at it                                         |
| ---------------------------- | ---------------------------------------------------------------------- |
| Free GitHub Pages hosting    | GitHub Pages only serves static files. Move = need new hosting.        |
| Zero runtime errors at scale | A static file can't 500. Adapter-node can.                             |
| Trivial CDN caching          | Every URL is a file; CDNs cache by default with no headers tuning.     |
| `check:jsonld` walks `dist/` | Needs replacement with crawl-time validation.                          |
| Build = artifact (immutable) | Adapter-node's runtime can drift from the built artifact via env vars. |

### Decision heuristic

Stick with adapter-static unless you have a specific need on this list. The CSP nonce concern is the most common reason to switch (security folks dislike `'unsafe-inline'`), but a meta CSP with `'unsafe-inline'` is fine for personal sites and is what we accept here as the cost of SSG + Svelte's scoped-style hashing.
