/**
 * Paginas loader. Consumes the `virtual:rendered-pages` map (populated at
 * build time by `scripts/vite/rendered-pages.ts`), filters to `paginas/`
 * entries, and exposes:
 *   - `getPageData(slug, lang)` — full page lookup for the catch-all renderer.
 *     `body` is the pre-rendered, sanitized HTML — feed straight into the
 *     Svelte html-render directive.
 *   - `getPageSlugMap(lang)` — id→slug map filtered to active pages (drives
 *     sitemap, link-graph crawler, and SECTION_* resolution in `$lib/routes`).
 *
 * Collections are language-INDEPENDENT: the ES file's `collections:` list is
 * the source of truth and gets mirrored into the EN page object at load time.
 * Editors update collection ordering in the ES paginas file; the EN file's
 * collections block is ignored at runtime. This keeps the about-page section
 * order locked across locales without needing a separate i18n-duplicate flag.
 *
 * **Why a virtual module instead of `import.meta.glob`?** Same reason as
 * `data/writing.ts` — markdown rendering moves to build time so the marked
 * library, Shiki cache, frontmatter parser, and sanitizer never enter the
 * client bundle. Templates receive pre-rendered HTML; runtime data flow
 * becomes pure projection.
 * @module data/pages
 */

import renderedPages from "virtual:rendered-pages";
import { INACTIVE_VALUES, idFromPath, pickByLang } from "./_internal";

/**
 * Page settings + pre-rendered HTML body loaded from paginas markdown files.
 * `template` is a free-form string id resolved at render time against the
 * configured section ids (see `isWritingSection` / `isPortfolioSection` in
 * `$lib/routes`). Leaving it untyped lets a fork add new template branches
 * without editing this union.
 *
 * The `body` field carries the build-time pre-rendered HTML — feed it
 * straight into Svelte's html-render directive. Use `MarkdownRenderer` for
 * the wrapping `.prose-blog` class boilerplate.
 */
export interface PageData {
  title: string;
  subtitle?: string | undefined;
  template?: string | undefined;
  collections: string[];
  slug: string;
  active: boolean;
  redirectUrl: string;
  backgroundImage: string;
  ogDescription: string;
  ogImage: string;
  /** Pre-rendered, sanitized HTML body — ready for the Svelte html-render directive. */
  body: string;
  /**
   * Whether the right-side sidebar (collection-section anchors built from
   * the page's `collections:` list) renders for this page. Defaults `true`.
   * Set `false` in frontmatter `settings.sidebar` to hide it on per-page
   * basis — useful for landing-style pages where the chrome should be
   * minimal, or for the privacy / 404 pages where a TOC adds zero value.
   */
  sidebar: boolean;
}

/**
 * Project a single rendered-pages entry into the runtime `PageData` shape.
 * @param path - Path key from the virtual module (project-relative).
 * @param entry - Pre-rendered page entry.
 * @returns Runtime-shaped page object.
 */
function toPageData(path: string, entry: (typeof renderedPages)[string]): PageData {
  const meta = entry.meta;
  const settings = (meta["settings"] as Record<string, string> | undefined) ?? {};
  // Accepts both shapes for backwards compat:
  //   - legacy string form: `collections: ["albumes-destacados", ...]`
  //   - new object form:    `collections: [{active: true, collection: "albumes-destacados"}, ...]`
  // Object items with `active: false` are filtered out so editors can
  // toggle a collection off via Sveltia CMS without deleting the entry.
  // String items have no active flag — treated as always active (matches
  // legacy behavior).
  const rawCollections = meta["collections"];
  const collections: string[] = Array.isArray(rawCollections)
    ? rawCollections
        .map((c: unknown) => {
          if (typeof c === "string") return c;
          const obj = c as Record<string, unknown>;
          if (INACTIVE_VALUES.has(String(obj["active"] ?? "").toLowerCase())) return "";
          return (obj["collection"] as string) || "";
        })
        .filter(Boolean)
    : [];
  const template = meta["template"] as string | undefined;
  return {
    title: (meta["title"] as string) || "",
    subtitle: (meta["subtitle"] as string) || undefined,
    template: template || undefined,
    collections,
    slug: settings["slug"] || idFromPath(path),
    active: !INACTIVE_VALUES.has(String(settings["active"] ?? "").toLowerCase()),
    redirectUrl: settings["redirectUrl"] || "",
    backgroundImage: settings["backgroundImage"] || "",
    ogDescription: settings["ogDescription"] || "",
    ogImage: settings["ogImage"] || "",
    // Sidebar (collection-section anchors) defaults ON. Same string-coerce
    // semantics as `active` so YAML "false"/"0"/"no" all hide it.
    sidebar: !INACTIVE_VALUES.has(String(settings["sidebar"] ?? "").toLowerCase()),
    body: entry.html,
  };
}

/**
 * Filter rendered-pages entries to a specific locale subtree of `paginas/`
 * and produce a `Map<fileId, PageData>` keyed by file id.
 * @param lang - Two-letter locale ("en" or "es").
 * @returns Map of file id → projected page data.
 */
function loadPagesForLang(lang: string): Map<string, PageData> {
  const prefix = `src/data/paginas/${lang}/`;
  const map = new Map<string, PageData>();
  for (const [path, entry] of Object.entries(renderedPages)) {
    if (!path.startsWith(prefix)) continue;
    map.set(idFromPath(path), toPageData(path, entry));
  }
  return map;
}

const pagesEn = loadPagesForLang("en");
const pagesEs = loadPagesForLang("es");

// Collections are language-independent — sync ES collections into EN as new objects
for (const [id, esPage] of pagesEs) {
  const enPage = pagesEn.get(id);
  if (enPage) {
    pagesEn.set(id, { ...enPage, collections: [...esPage.collections] });
  }
}

/**
 * Internal accessor for the full per-locale page maps. Only `data/site.ts`
 * (navigation resolution) reaches for these — public callers go through
 * `getPageData` / `getPageSlugMap`.
 * @returns Tuple of [EN pages map, ES pages map].
 */
export function _allPages(): [Map<string, PageData>, Map<string, PageData>] {
  return [pagesEn, pagesEs];
}

/**
 * Get page data by slug and language.
 * @param slug - Page slug identifier.
 * @param lang - Language code ("en" or "es").
 * @returns The matched page data, or undefined.
 */
export function getPageData(slug: string, lang: string): PageData | undefined {
  return pickByLang(pagesEn, pagesEs, lang).get(slug);
}

/**
 * Get a map of page file ids to their slugs for a language. Inactive pages
 * (frontmatter `settings.active: false`) are excluded so they don't leak into
 * the sitemap, the link-graph crawler used by adapter-static, or any other
 * downstream consumer that enumerates routes. The slug catch-all renderer
 * already renders 404 content when `pageData.active` is false — pruning here
 * means the URL truly 404s (no soft-404) and Google never sees an inactive
 * URL listed in sitemap.xml. Writing posts and portfolio albums apply the
 * same filter via their own `getWritingPosts` / `getPortfolio` accessors.
 * @param lang - Language code ("en" or "es").
 * @returns Map of active page id to slug.
 */
export function getPageSlugMap(lang: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [id, page] of pickByLang(pagesEn, pagesEs, lang)) {
    if (page.active === false) continue;
    map.set(id, page.slug);
  }
  return map;
}
