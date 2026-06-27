/**
 * Writing-post loader + sort helpers. Consumes the `virtual:rendered-pages`
 * map (populated at build time by `scripts/vite/rendered-pages.ts`), filters
 * down to entries under `src/data/escritos/{lang}/`, and surfaces them
 * keyed by file id and slug.
 *
 * **Why a virtual module instead of `import.meta.glob`?** Two reasons.
 * First, the virtual module's entries already carry pre-rendered, sanitized
 * HTML — no `marked` library, no Shiki cache, no frontmatter parser, no
 * sanitizer ever enters the client bundle. Second, headings are pre-
 * extracted at build time so the sidebar TOC doesn't need a runtime
 * markdown re-parse. The data loader becomes pure projection: pick the
 * `escritos/` entries, normalize their meta into the runtime `WritingPostFlat`
 * shape, sort by date.
 *
 * EN/ES posts pair by FILE ID — `parada-de-manos.md` ↔ `handstand.md` may
 * have different slugs but share the same `fileId`, which keeps the
 * language toggle and JSON-LD `inLanguage` graph consistent.
 * @module data/writing
 */

import renderedPages from "virtual:rendered-pages";
import type { SidebarItem } from "$lib/types";
import { INACTIVE_VALUES, idFromPath, parseTags, pickByLang } from "./_internal";

/** A writing post with pre-rendered HTML body, frontmatter metadata, and TOC headings. */
export interface WritingPostFlat {
  /** Filename-based identifier, shared across languages. */
  fileId: string;
  /** URL slug (language-specific). */
  slug: string;
  /** Post title. */
  title: string;
  /** Publication date (YYYY-MM-DD). */
  date: string;
  /** Last updated date (YYYY-MM-DD), empty if never updated. */
  updatedDate: string;
  /** Brief summary. */
  summary: string;
  /** Categorization tags. */
  tags: string[];
  /** Post type. */
  type: "opinion" | "report" | "journal" | "thesis";
  /** URL if the post is hosted externally. */
  externalUrl?: string | undefined;
  /** Language the post was originally written in. */
  originalLanguage?: "en" | "es" | undefined;
  /** Whether this post is active/published. */
  active: boolean;
  /** Redirect URL if post should redirect. */
  redirectUrl?: string | undefined;
  /**
   * Whether the right-side sidebar (auto-generated table of contents from
   * H2/H3 body headings) renders for this post. Defaults `true`. Set
   * `false` in frontmatter `settings.sidebar` to hide it on per-post basis
   * — useful for short opinion pieces where a 2-item TOC is more noise
   * than signal, or photo-essay posts where the visual flow matters more
   * than nav affordances.
   */
  sidebar: boolean;
  /** OG description. */
  ogDescription: string;
  /** OG image path. */
  ogImage: string;
  /**
   * Card-cover image — falls through `ogImage` → first inline `/media/`
   * image in the body → frontmatter top-level `image:` (legacy) →
   * `undefined`. Used by `WritingPostCard` so a fork that includes a hero
   * image inline doesn't need to set `ogImage` manually for the listing
   * tile to show it. `undefined` means the card renders text-only.
   */
  image: string | undefined;
  /** Pre-rendered, sanitized HTML body — feed into Svelte's html-render directive. */
  html: string;
  /** Raw markdown body — preserved for `wordCount` JSON-LD + diagnostics. */
  body: string;
  /** H2 / H3 sidebar headings, pre-extracted at build time. */
  headings: SidebarItem[];
}

/**
 * Supported sort modes for writing-post listings + RSS/Atom feeds. Driven by
 * `escritos.json#defaultSort`.
 */
export type WritingSort = "date-desc" | "date-asc" | "updated-desc";

/**
 * Sort writing posts by the requested mode. Returns a new array (does not
 * mutate the input) so callers can safely chain with `.filter()` / `.slice()`.
 *
 * `updated-desc` falls back to the publish `date` when `updatedDate` is empty,
 * so posts without a recorded update still sort by publish time rather than
 * sinking to the bottom of the list.
 * @param posts - Posts to sort.
 * @param mode - Sort mode from `escritos.json#defaultSort`.
 * @returns Sorted copy of the posts array.
 */
export function sortPosts(posts: WritingPostFlat[], mode: WritingSort): WritingPostFlat[] {
  const copy = posts.slice();
  if (mode === "date-asc") {
    return copy.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  if (mode === "updated-desc") {
    return copy.sort((a, b) => {
      const ad = a.updatedDate || a.date;
      const bd = b.updatedDate || b.date;
      return ad > bd ? -1 : ad < bd ? 1 : 0;
    });
  }
  // date-desc (default + fallback for unknown modes — defensible technical default)
  return copy.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

/**
 * Project a single `virtual:rendered-pages` entry into `WritingPostFlat`.
 * @param path - Path key from the virtual module (already project-relative).
 * @param entry - Pre-rendered page entry.
 * @returns Runtime-shaped writing post.
 */
function toWritingPost(path: string, entry: (typeof renderedPages)[string]): WritingPostFlat {
  const meta = entry.meta;
  const settings = (meta["settings"] as Record<string, string> | undefined) ?? {};
  const ogImage = settings["ogImage"] || "";
  // Resolution order for the WritingPostCard cover image:
  //   1. `settings.ogImage` from frontmatter (explicit author-set cover)
  //   2. First inline `![](...)` in the body — so a post that already has a
  //      hero shot inline gets it on the card without a duplicate `ogImage`
  //   3. Legacy top-level `image:` frontmatter (kept for back-compat)
  //   4. `undefined` — card renders text-only
  const firstBodyImageMatch = entry.body.match(/!\[[^\]]*\]\(([^)\s]+)/);
  const cardImage = ogImage || firstBodyImageMatch?.[1] || (meta["image"] as string) || undefined;
  return {
    fileId: idFromPath(path),
    slug: settings["slug"] || (meta["slug"] as string) || idFromPath(path),
    title: (meta["title"] as string) || "",
    date: (meta["date"] as string) || "",
    updatedDate: (meta["updatedDate"] as string) || "",
    summary: (meta["summary"] as string) || "",
    tags: parseTags(meta["tags"]),
    type: (meta["type"] as WritingPostFlat["type"]) || "opinion",
    externalUrl: (meta["externalUrl"] as string) || undefined,
    originalLanguage: (meta["originalLanguage"] as "en" | "es") || undefined,
    // Frontmatter parsing yields strings; treat any falsy form as inactive
    // ("false", "0", "no", boolean false). Anything else (including missing) is active.
    active: !INACTIVE_VALUES.has(String(settings["active"] ?? "").toLowerCase()),
    redirectUrl: settings["redirectUrl"] || undefined,
    ogDescription: settings["ogDescription"] || "",
    ogImage,
    image: cardImage,
    // Sidebar (auto-generated H2/H3 TOC) defaults ON. Explicit `false`
    // hides it. Frontmatter parsing yields strings, so the
    // string-coerced "false"/"0"/"no" cases are caught alongside
    // boolean `false`. Any other value (including missing) is true.
    sidebar: !INACTIVE_VALUES.has(String(settings["sidebar"] ?? "").toLowerCase()),
    html: entry.html,
    body: entry.body,
    headings: entry.headings,
  };
}

/**
 * Filter rendered-pages entries to a specific locale subtree and project
 * them into the `WritingPostFlat` shape, sorted newest-first.
 * @param lang - Two-letter locale (matches the `escritos/{lang}/` directory).
 * @returns Date-desc sorted writing posts for that locale.
 */
function loadWritingPostsForLang(lang: string): WritingPostFlat[] {
  const prefix = `src/data/escritos/${lang}/`;
  return Object.entries(renderedPages)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, entry]) => toWritingPost(path, entry))
    .sort((a, b) => b.date.localeCompare(a.date));
}

const writEn = loadWritingPostsForLang("en");
const writEs = loadWritingPostsForLang("es");

/**
 * Internal accessor for the full (unfiltered) per-locale post arrays. Only
 * `data/featured.ts` reaches for these — public callers always go through
 * `getWritingPosts` which applies the active filter.
 * @returns Tuple of [EN posts, ES posts].
 */
export function _allWritingPosts(): [WritingPostFlat[], WritingPostFlat[]] {
  return [writEn, writEs];
}

/**
 * Return all writing posts for a language, sorted by date (newest first).
 * @param lang - Language code ("en" or "es").
 * @returns Entries for the requested language.
 */
export function getWritingPosts(lang: string): WritingPostFlat[] {
  return pickByLang(writEn, writEs, lang).filter((p) => p.active);
}

/**
 * Find a single writing post by slug and language.
 * @param slug - Post URL slug.
 * @param lang - Language code ("en" or "es").
 * @returns The matched post, or undefined.
 */
export function getWritingPost(slug: string, lang: string): WritingPostFlat | undefined {
  return pickByLang(writEn, writEs, lang).find((p) => p.slug === slug);
}

/**
 * Find a writing post by fileId and language.
 * @param fileId - Filename identifier shared across languages.
 * @param lang - Language code ("en" or "es").
 * @returns The matched post, or undefined.
 */
export function getWritingPostByFileId(fileId: string, lang: string): WritingPostFlat | undefined {
  return pickByLang(writEn, writEs, lang).find((p) => p.fileId === fileId);
}
