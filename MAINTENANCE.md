# Maintenance Guide

Operational reference for the scripts under `scripts/`, the pre-commit hook, and the CI gates that keep everything in sync. For architecture, see [CLAUDE.md](./CLAUDE.md); for the project intro, see [README.md](./README.md).

## TL;DR

| You changed…                                                                  | What regenerates                                                           | Where it runs                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| `sitio.json.favicon` (source image)                                           | All favicon variants + `favicon.ico` + `manifest.json`                     | pre-commit, `prebuild`, CI               |
| `static/media/*.webp` (added/replaced an image)                               | Srcset variants (WebP + AVIF, 320/480/768/1080)                            | pre-commit, `prebuild`                   |
| `src/data/portafolio/{en,es}/*.json`                                          | EXIF/XMP copyright on the listed photos; stripped from anything not listed | pre-commit, CI                           |
| `src/data/paginas/`, `escritos/`, `portafolio/` slugs/dates                   | `lighthouse/{core,albums,writing}-{en,es}.json` URL list (up to 6 shards)  | pre-commit, CI                           |
| Any `/media/`, `/srcset/`, `/favicon/` path in code or data                   | `check:images` walks all JSON/frontmatter/source and fails on broken refs  | pre-commit, CI                           |
| Any `t()` / `tObject()` call site or `configuracion/{lang}/traducciones.json` | `check:i18n` enforces key parity + flags orphans (handles pluralization)   | pre-commit, CI                           |
| Anything touching shipped JS / CSS                                            | `check:bundle` runs after build and fails on per-bucket size regression    | CI-only (post-build; deploy.yml is lean) |
| Source code                                                                   | Type check, lint, format check, build                                      | pre-commit, CI                           |

**You never edit any generated file directly.** If you do, the pre-commit hook overwrites it, and CI fails the PR with a diff.

## The maintenance scripts

### `scripts/pipeline/generate-favicons.mjs`

Single-source favicon pipeline. Reads the source path from `sitio.json.favicon` (typically `/media/whatever.png`), then uses `sharp` to derive every variant:

- `static/favicon.ico` — multi-size ICO (16, 32, 48) with PNG-encoded entries. Wrapped by a ~30-line pure-JS ICO writer; no extra dependency.
- `static/favicon/favicon-{16,32}x{16,32}.png`
- `static/favicon/apple-icon-180x180.png`
- `static/favicon/android-icon-{36,48,72,96,144,192}.png`
- `static/favicon/favicon-512x512.png`
- `static/favicon/manifest.json` (name/short_name come from `sitio.json.name`; theme/background colors hardcoded to the dark palette)

**Source format**: anything `sharp` can read — PNG, SVG, JPEG, WebP, TIFF. ICO is rejected with a helpful error (sharp can't decode ICO; if your source is currently ICO, upload a higher-res raster or vector).

**Cleanup**: any file in `static/favicon/` that isn't in the generated set is treated as stale and removed. This way you can never have an `apple-icon-114x114.png` left over from a previous generator drifting against what `app.html` and the manifest reference.

**Idempotency**: output bytes are compared against existing files; the script only writes when something actually differs. Two runs back-to-back = `0 written, 12 already in sync`.

```bash
npm run favicons
```

### `scripts/pipeline/optimize-images.mjs`

Walks `static/media/`, generates 320/480/768/1080-wide variants in `static/srcset/` for any WebP/JPG/PNG larger than the target width. Emits **both** WebP and AVIF for each variant — `Picture.svelte` does native `<picture>` negotiation so AVIF-capable browsers grab the smaller file. Skips variants smaller than the source. Removes any srcset file whose source no longer exists. Forces `.toColorspace("srgb")` so wide-gamut originals never ship unprofiled.

`mtime`-based skip: if the variant is newer than the source, nothing happens.

```bash
npm run optimize
```

### `scripts/pipeline/embed-copyright.mjs`

Reads every `src/data/portafolio/{en,es}/*.json`, collects each album's `coverSrc` plus all `photos[].src` into a Set, then:

- **Embeds** the owner's copyright (EXIF `Copyright`, `Artist`, `Creator` + XMP `dc:Rights`, `dc:Creator`, `xmpRights:WebStatement`, `xmpRights:Marked`) on exactly the files in that Set.
- **Strips** the same fields from every other image under `static/media/` and `static/favicon/`, so nothing is misattributed.

Why JSON-driven instead of filename patterns: when Gonzalo renames or adds an album, the JSON is the only thing he touches — the script picks up the change with no separate config.

Why no IPTC tags: WebP doesn't store IPTC. Writing them silently no-ops; the re-read returns empty; the script thinks it needs to re-write; idempotency breaks. XMP-dc carries the same semantic info in a format WebP actually supports.

```bash
npm run copyright
```

Requires `exiftool` on `$PATH`. macOS: `brew bundle`. Linux: `sudo apt-get install -y libimage-exiftool-perl`.

### `scripts/pipeline/generate-lighthouse-config.mjs`

Walks the current `src/data/paginas/{en,es}/`, `portafolio/{en,es}/`, and `escritos/{en,es}/` data and writes up to **six** lighthouse configs into `lighthouse/` (a shard is skipped when its URL list is empty — so on the goanpeca site today there are 4 files because the portfolio is inactive):

| Config            | URLs                            | Purpose                                         |
| ----------------- | ------------------------------- | ----------------------------------------------- |
| `core-en.json`    | / + /en/ + every listing page   | EN home + section landings + the canonical root |
| `core-es.json`    | /es/ + every listing page       | ES home + section landings                      |
| `albums-en.json`  | every active EN portfolio album | EN portfolio detail pages (skipped if empty)    |
| `albums-es.json`  | every active ES portfolio album | ES portfolio detail pages (skipped if empty)    |
| `writing-en.json` | every active EN writing post    | EN essay/article pages                          |
| `writing-es.json` | every active ES writing post    | ES essay/article pages                          |

Together they cover every built HTML page that's worth auditing — currently 25 unique URLs across the 4 emitted shards (7 EN core + 6 ES core + 6 EN writing + 6 ES writing). Excludes the `/admin/` CMS page (`noindex`) and any non-HTML assets.

The output folder is deleted and recreated on every run so a future shard rename / removal can't leave stale configs behind. `lighthouse.yml` consumes these via a `lang × type` matrix (one parallel shard per emitted file) so the per-shard wall-clock is ~9-13 min (numberOfRuns: 3 — bumped from 2 after a 30× TBT outlier on a single page surfaced as Lighthouse hardware-jitter noise that a 2-sample median couldn't filter out). Total audit wall-clock is dominated by the slowest shard, so widening the matrix is essentially free coverage.

The `lighthouse.yml` workflow also sets `DISABLE_ANALYTICS=1` in its `env:` block so the build skips GTM/GA4 injection. Lighthouse scores then reflect OUR code, not the 3rd-party perf hit from googletagmanager.com that we can't control. Production deploys still inject analytics normally. A trailing `summarize` job (only on push to `main`) aggregates per-shard result URLs into a single GitHub issue with label `lighthouse-results` — issue body is PATCHed in place every run (never new comments, never new issues) so it stays a live latest-run dashboard.

Output is deterministic — listings sorted alphabetically, posts sorted by date descending then slug alphabetical — so two runs produce identical files.

```bash
npm run lighthouse:config
```

### `scripts/checks/check-image-paths.mjs`

Walks every JSON file under `src/data/`, every frontmatter block under `src/data/{escritos,paginas}/`, and every `.svelte` / `.ts` file under `src/` for path strings matching `/media/`, `/srcset/`, or `/favicon/`. Resolves each against the filesystem (`static/<path>`) and fails with the offending file + missing path if anything is broken. Catches the case where someone renames an image without updating every reference, or vice versa.

Runs in the pre-commit hook and in `ci.yml`. ~137 files scanned in <100ms.

```bash
npm run check:images
```

### `scripts/checks/check-bundle-size.mjs`

Runs **after** `npm run build` and enforces per-bucket size budgets on `dist/_app/immutable/`:

| Bucket   | Budget | Purpose                                   |
| -------- | ------ | ----------------------------------------- |
| `chunks` | 320 KB | SvelteKit-managed shared JS chunks        |
| `nodes`  | 80 KB  | Per-route page entries                    |
| `entry`  | 24 KB  | App / start entry shims                   |
| `assets` | 600 KB | CSS + fonts + other static-emitted assets |

Budgets are deliberately set ~25% over the current measurement so content / dep updates don't trip them. If a legitimate feature pushes a bucket over, **bump the BUDGETS object in the script** as part of that feature's PR (and explain why in the message). Don't bump to silence a regression.

Runs in `ci.yml` and `deploy.yml` after `build`. Not in pre-commit (would require building locally on every commit).

```bash
npm run build && npm run check:bundle
```

### `scripts/checks/check-i18n.mjs`

Walks every `t(lang, "...")` and `tObject(lang, "...")` call across `src/` (`.svelte` / `.ts` / `.js`), plus the `consent.*` keys read inline by the GTM bootstrap in `src/app.html`. Compares the resulting key set against the flat key paths in `src/data/configuracion/{en,es}/traducciones.json`.

Handles three indirection patterns so it doesn't false-positive:

1. **Subtree consumers** — `tObject(lang, "group")` resolves to every leaf under `group.*`; the script expands accordingly.
2. **Pluralization** — `t(lang, "photoCount", { count: n })` resolves to `photoCount_one` or `photoCount_other` via the helper's suffix convention; the base key is satisfied if either suffix exists in JSON.
3. **Template literals** — ``t(lang, `writing.${type}`)`` captures the static prefix (`writing.`) and marks every JSON key under that prefix as referenced.

Fails (exit 1) on any of: missing key in en.json, missing key in es.json, EN↔ES parity drift, orphan JSON keys never used in code.

Runs in pre-commit + `ci.yml`.

```bash
npm run check:i18n
```

## Build-time Vite plugins (`scripts/vite/`)

Vite plugins run automatically as part of `npm run build` (and during `npm run dev` for HMR). They expose `virtual:*` modules to the runtime code but live entirely Node-side — no maintenance script to invoke, no separate `npm run` entry. Listed here so a maintainer hunting "where does X come from?" finds the right file:

| Plugin                              | Virtual module            | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/vite/rendered-pages.ts`    | `virtual:rendered-pages`  | Walks `src/data/{escritos,paginas}/**/*.md`, parses frontmatter with `gray-matter`, renders the body through `marked` + `marked-gfm-heading-id` + Shiki (dual light/dark theme), expands Pandoc image attributes, injects responsive `srcset` + `width`/`height` on `/media/` images, hardens external links, sanitizes with `sanitize-html`, and pre-extracts H2/H3 headings. **None of this machinery ships to the client** — the runtime just consumes the pre-rendered HTML. Replaces the older `virtual:highlighted-code` plugin |
| `scripts/vite/srcset-manifest.ts`   | `virtual:srcset-manifest` | `Set<string>` of every `/srcset/<file>` path that exists on disk; consumed by `Picture.svelte` for native `<picture>` source negotiation                                                                                                                                                                                                                                                                                                                                                                                              |
| `scripts/vite/image-dims.ts`        | `virtual:image-dims`      | `Map</media/path, [width, height]>` measured by sharp at build start, used by `AlbumTemplate` for CLS-free `<img>` rendering                                                                                                                                                                                                                                                                                                                                                                                                          |
| `scripts/vite/og-manifest.ts`       | `virtual:og-manifest`     | `Set<string>` of every `/og/<stem>.webp` landscape variant emitted by `scripts/pipeline/generate-og-images.mjs`, consumed by `SEO.svelte` for portrait-cover lookup                                                                                                                                                                                                                                                                                                                                                                   |
| `scripts/vite/serve-admin-index.ts` | _(dev middleware)_        | Dev-only — serves `static/admin/index.html` when the browser asks for `/admin/` so Sveltia CMS works locally without `npm run build`                                                                                                                                                                                                                                                                                                                                                                                                  |

Why `rendered-pages.ts` is worth knowing about: it consolidated four previous concerns (the runtime marked configure, the old `virtual:highlighted-code` Shiki cache, the runtime sanitize-html regex pipeline, the runtime heading-extraction cache) into one Node-only stage. The client bundle no longer contains `marked`, `marked-gfm-heading-id`, `github-slugger`, the Shiki cache, or any HTML sanitizer. The trade-off: pre-rendered Shiki HTML is more verbose than raw markdown (each token gets a `style="color:#X;--shiki-dark:#Y"` wrapper), so for code-heavy posts the data chunk grows by ~50 KB. The chunks budget on this site was bumped 400 → 480 KB to absorb that growth — see the header comment in `scripts/checks/check-bundle-size.mjs` for the full rationale and the future-work pointer (Shiki transformer mapping inline styles to CSS classes).

## The pre-commit hook (`.husky/pre-commit`)

```bash
# Fast bail if the required system dep is missing.
command -v exiftool || exit 1

# Regenerate everything that could have drifted from your edits (5 scripts).
# Ordering matters: embed-copyright runs BEFORE optimize-images so srcset
# variants inherit fresh EXIF/XMP; generate-og-images runs AFTER so portrait
# variants pick up the embedded copyright too.
node scripts/pipeline/embed-copyright.mjs
node scripts/pipeline/optimize-images.mjs
node scripts/pipeline/generate-favicons.mjs
node scripts/pipeline/generate-lighthouse-config.mjs
node scripts/pipeline/generate-og-images.mjs

# Re-stage modified tracked files + the directories the scripts write to.
git add -u
git add static/srcset static/favicon static/favicon.ico static/og 2>/dev/null || true

# Run every verification gate (18 in pre-commit; CI adds 5 more after build).
# check:ci-parity asserts this list stays symmetric with ci.yml so adding a
# gate to one place fails the build until you add it to the other.
npm run check:images          # /media/, /srcset/, /favicon/ refs all resolve
npm run check:i18n            # every t()/tObject() key in both en.json + es.json
npm run check:cms             # CMS pattern validators applied to actual data
npm run check                 # svelte-check / TypeScript
npm run lint                  # ESLint (max-warnings 0)
npm run format:check          # Prettier
npm run check:fork            # no brand strings / hex / hardcoded section IDs in framework code
npm run check:required-config # no __REQUIRED__ sentinel from src/lib/defaults.ts survives in merged config
npm run check:frontmatter     # escritos + paginas markdown frontmatter schemas valid (incl. settings.sidebar)
npm run check:ci-parity       # pre-commit ↔ ci.yml gate set symmetric
npm run check:node-pin        # Node major version matches across .nvmrc / package.json / Brewfile / workflows
npm run check:audit-doc       # AUDIT_CHECKLIST.md structural integrity (unique row IDs, valid cross-refs)
npm run check:orphan-images   # static/media/ images all referenced
npm run check:nav-slugs       # navegacion.json items[].key resolves to real paginas
npm run check:required-paginas  # 4 system page-IDs (home/writing/portfolio/privacy) each have an active paginas file
npm run check:portfolio-parity  # every album's photos[].src array identical across locales
npm run check:album-weight    # per-image ≤ 2 MB + per-album ≤ 20 MB source-bytes budget
npm run spell                 # cspell across .ts/.svelte/.md/etc.
npm run lint:md               # markdownlint structural rules on top-level docs
npm test                      # vitest unit suite (115 tests, ~1 s)
```

`check:bundle`, `check:jsonld`, and `check:canonical-host` are CI-only because they need `dist/` from a `build` step (skipped pre-commit to keep commits fast). `check:ci-parity` knows about this asymmetry via its `CI_ONLY_ALLOWED` set.

**Run the full gate locally any time**: `npm run audit:all` chains all 26 programmatic checks (every `check:*` + lint + lint:md + spell + format + test + build + bundle + jsonld + canonical-host + licenses + actions-pinned). The 26th gate, `check:required-config`, walks the per-locale merged config tree and fails with a field path + hint if any `__REQUIRED__` sentinel from `src/lib/defaults.ts` survived because a fork forgot to set a required field — see [FORKING.md § Required config fields](./FORKING.md#required-config-fields--the-sentinel-system).

**Why `git add -u` plus explicit paths**: `-u` only re-stages files that were already tracked. The scripts may create entirely new files inside `static/srcset/` (after you add a new photo) or `static/favicon/` (after you bump favicon source resolution), and those need the explicit `git add` to make it into the commit.

**Bypass**: `git commit --no-verify` skips the hook. **CI catches it**: the drift checks below will fail the PR.

**Workflow timeout cap**: every job declares `timeout-minutes: 10` so a hung step can't sit consuming a runner indefinitely. Lighthouse shards (9-13 min typical with numberOfRuns: 3) are the tightest — bump to 15 if they start tripping the cap. Every workflow also sets `HUSKY=0` in its `env:` block so `npm ci`'s `prepare: husky` script can't fail on a shallow checkout (Husky 9 is no-op in CI by default, but explicit is safer).

**Post-deploy smoke test**: `deploy.yml` runs a separate `smoke` job after `build-and-deploy` completes. It sleeps 10 s for CDN propagation, then `curl`s 5 key URLs (`/`, `/es/`, `/en/`, `/sitemap.xml`, `/robots.txt`) and asserts each returns HTTP 200 + the expected `Content-Type` (text/html, application/xml, text/plain). Catches deploys that "succeed" but ship a corrupted artifact, zero-byte HTML, wrong MIME, or GH Pages stuck on a previous version. ~10 s cheap insurance.

## CI drift checks (`ci.yml`)

```yaml
- name: Verify lighthouse configs are up to date
  run: |
    npm run lighthouse:config
    if [ -n "$(git status --porcelain lighthouse/)" ]; then
      echo "::error::lighthouse/*.json are out of sync."
      git --no-pager diff lighthouse/
      git status --porcelain lighthouse/
      exit 1
    fi

- name: Verify favicons are up to date
  run: |
    npm run favicons
    git diff --quiet static/favicon static/favicon.ico || {
      echo "::error::Favicons are out of sync with src/data/sitio.json."
      git --no-pager diff --stat static/favicon static/favicon.ico
      exit 1
    }

- run: npm run build
- run: npm run check:bundle
```

The drift checks catch the `--no-verify` escape hatch. If you bump `sitio.json.favicon` and skip the hook, CI runs the generator and notices that the committed PNGs don't match what the source would produce now → fails the PR with the offending diff in the error log.

There's no equivalent check for `embed-copyright.mjs` because that script is already invoked unconditionally in `ci.yml` (`- run: npm run copyright`); if it modifies anything, the subsequent `git diff` would already be dirty.

The `check:bundle` step runs after `build` and fails the PR if any bucket in `dist/_app/immutable/` exceeds its budget (see the `check-bundle-size.mjs` section above). Bump the BUDGETS object in the same commit that legitimately pushes the bucket past the limit; never silently raise the budget to make a regression pass.

## Common operations

### Replace the favicon

1. Edit the `Favicon` field in `/admin/` (or drop the file directly into `static/media/`).
2. Update `sitio.json.favicon` to point to the new path (CMS does this automatically).
3. `git add` + commit. Pre-commit regenerates all 11 PNG variants + the multi-size `.ico` + `manifest.json` from your new source.

### Add a portfolio photo

1. Drop the image into `static/media/album-<slug>-NN.webp` (kebab-case).
2. Add `{ "src": "/media/album-<slug>-NN.webp", "alt": "…" }` to the matching album's `photos[]` in `src/data/portafolio/{en,es}/<slug>.json`.
3. `git add` + commit. Pre-commit generates the srcset variants, embeds copyright, and the build picks up the image dimensions for CLS.

### Add a writing post

1. Create `src/data/escritos/{en,es}/<slug>.md` with frontmatter (`title`, `date`, `type`, `tags`, `summary`, optional `externalUrl`, `originalLanguage`).
2. `git add` + commit. Pre-commit regenerates the lighthouse configs so the new URL gets audited.

### Add a new page

1. Create `src/data/paginas/{en,es}/<slug>.md` with frontmatter (`title`, `collections`, `settings.slug`).
2. Add an entry to `src/data/configuracion/{en,es}/navegacion.json` so it appears in the navbar.
3. `git add` + commit.

### Edit content via Sveltia CMS locally (no GitHub commits)

1. Run `npm run dev` (or `npm run preview` for a production build).
2. Open `http://localhost:5173/admin/` (or `:4173/admin/` for preview mode).
3. Click **Work with Local Repository** on the login screen. Browser prompts for permission to access the project folder; pick the repo root.
4. Edits write directly to the working tree — no commits, no push. Save in the CMS = files change on disk.
5. The CMS detects it's on `localhost` and rewrites `site_url` / `display_url` to `http://localhost:<port>` for the editing session (see `static/admin/index.html`), so the per-entry "View on site" link opens the LOCAL page, not production. This is why `preview_path: "{{locale}}/{{fields.settings.slug}}/"` on the `paginas` collection is so useful — one click jumps from an edit to its rendered local preview.
6. When happy, `git add` + commit + push as normal. (We never auto-commit on Gonzalo's behalf — see the top of [CLAUDE.md](./CLAUDE.md).)

> **Why no `local_backend: true`?** That's a Decap CMS option for proxying writes through a local server. Sveltia uses the browser's File System Access API directly — no proxy needed, no extra dependency. The flag was removed; Sveltia warned about it being ignored.

> **Why does "View on site" work for English writing/portfolio entries in dev but 404 in prod?** Sveltia's `preview_path` is a single template per collection — it doesn't accept per-locale variants — so the template hardcodes the ES prefix (`escritos`, `portafolio`). The dev-only `reroute` hook in [src/hooks.ts](./src/hooks.ts) rewrites `/en/escritos/...` → `/en/writing/...` (and the portfolio analogue) so the link works while editing locally. The hook is deliberately scoped to `dev` to keep production URLs canonical (no SEO duplicates). When Sveltia ships per-locale `preview_path` support, delete the hook; the proposal lives in [docs/upstream-issues/sveltia-cms-preview-path-i18n.md](./docs/upstream-issues/sveltia-cms-preview-path-i18n.md).

### Diagnose a failing CI drift check

If `Verify favicons are up to date` fails:

```bash
npm run favicons
git diff static/favicon static/favicon.ico
```

If the diff is non-empty, the source changed but the generated artifacts in your commit didn't. Re-stage and amend (or new commit).

If `Verify lighthouse configs` fails, same pattern with `npm run lighthouse:config`.

## Workflow concurrency policy

The two workflows that react to commits on `main` (`deploy.yml`, `lighthouse.yml`) use deliberately **opposite** cancellation policies. The split exists because they answer different questions about "what should happen when a newer commit lands while I'm running?"

### `deploy.yml` — never cancel

```yaml
concurrency:
  group: pages
  cancel-in-progress: false
```

Sveltia CMS writes through git: every edit Gonzalo makes in `/admin/` produces a commit on `main`. Editors often land 2-3 commits in rapid succession (publish a post, immediately fix a typo). If a deploy is mid-`upload-pages-artifact` when commit B lands, canceling commit A's deploy can leave the GitHub Pages environment in a half-uploaded state and then commit B's deploy races against the partial artifact. Queuing serializes: commit A finishes, commit B starts. Every commit eventually ships; final state is always the latest commit.

Trade-off: if 5 commits land in a minute, the queue holds them and they deploy sequentially. For this site's commit cadence (a few pushes a week) the queue is essentially always empty.

### `lighthouse.yml` — auto-cancel on the same ref

```yaml
concurrency:
  group: lighthouse-${{ github.ref }}
  cancel-in-progress: true
```

Lighthouse only tells you about the current build's quality. An audit of an obsolete commit is pure waste — burns CI minutes, clutters the artifact list. When a new commit lands on the same ref, the in-flight Lighthouse audit is canceled and the latest commit's audit runs instead.

Grouping by `${{ github.ref }}` is load-bearing: a push to `main` should NOT cancel an in-flight PR audit, because those test different commits. Each PR / branch / `main` gets its own cancellation lane.

### Why the asymmetry

|                              | `deploy.yml`                                                | `lighthouse.yml`                                         |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| What does cancellation lose? | A deployed commit (production drift, possibly broken state) | An audit of a now-obsolete commit (no production impact) |
| Can we skip a commit?        | No — every commit must reach prod                           | Yes — only the latest matters                            |
| Cost of running anyway       | Cheap (~1-2 min build + deploy)                             | Expensive (~6-9 min per shard × N active shards)         |
| Correct policy               | Queue (`cancel-in-progress: false`)                         | Cancel (`cancel-in-progress: true`)                      |
