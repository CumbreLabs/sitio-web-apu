import {
  getPageSlugMap,
  getWritingPosts,
  getWritingPost,
  getWritingPostByFileId,
  getPortfolio,
  getAlbumBySlug,
  getAlbumByFileId,
} from "$lib/data";
import { siteConfig, writingConfig, portfolioConfig, footerConfig } from "$lib/config";

/**
 * Build a mapping from page IDs to full URL paths for a given language.
 * @param slugMap - Map of page IDs to slug strings.
 * @param lang - Language code.
 * @returns Record mapping page IDs to their full paths.
 */
function buildPathMap(slugMap: Map<string, string>, lang: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [id, slug] of slugMap) {
    map[id] = `/${lang}/${slug}/`;
  }
  return map;
}

/**
 * Build a reverse mapping from URL slugs to page IDs.
 * @param slugMap - Map of page IDs to slug strings.
 * @returns Record mapping slugs to their page IDs.
 */
function buildSegmentToKey(slugMap: Map<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [id, slug] of slugMap) {
    map[slug] = id;
  }
  return map;
}

// Build slug + path + segment-key maps for EVERY supported language, then look
// them up by language code at call time. Scaling to a third language requires
// no code changes — just add the locale to `sitio.json#languages`.
import { getSupportedLanguages } from "$lib/config";
const SUPPORTED = getSupportedLanguages();
const slugMapByLang = new Map<string, Map<string, string>>();
const pathMapByLang = new Map<string, Record<string, string>>();
const segmentToKeyByLang = new Map<string, Record<string, string>>();
for (const code of SUPPORTED) {
  const slugMap = getPageSlugMap(code);
  slugMapByLang.set(code, slugMap);
  pathMapByLang.set(code, buildPathMap(slugMap, code));
  segmentToKeyByLang.set(code, buildSegmentToKey(slugMap));
}

/**
 * Get the full URL path for a page by its slug and language.
 * @param pageSlug - The page identifier slug.
 * @param lang - Language code.
 * @returns Full URL path for the page.
 */
export function getPagePath(pageSlug: string, lang: string): string {
  const map = pathMapByLang.get(lang) ?? pathMapByLang.values().next().value ?? {};
  return map[pageSlug] ?? `/${lang}/`;
}

/**
 * Get the home page path for a given language.
 * @param lang - Language code.
 * @returns Home page URL path.
 */
export function getHomePath(lang: string): string {
  return `/${lang}/`;
}

/**
 * Resolve a URL path segment to its page identifier for a given language.
 * @param pathSegment - The URL segment to resolve.
 * @param lang - Language code.
 * @returns The page identifier, or undefined if not found.
 */
export function resolvePageSlug(pathSegment: string, lang: string): string | undefined {
  const segmentMap = segmentToKeyByLang.get(lang) ?? {};
  return segmentMap[pathSegment];
}

/**
 * Get the base path for the writing section in a given language.
 * @param lang - Language code.
 * @returns URL path to the writing section.
 */
export function getWritingBasePath(lang: string): string {
  return getPagePath(WRITING_KEY, lang);
}

/**
 * Page-id keys for the two sections that have locale-aware DEEP paths
 * (writing posts paired by `fileId`, portfolio albums paired by `id`) plus
 * the privacy page id consumed by the footer link.
 * Read from `escritos.json` / `portafolio.json` / `pie-de-pagina.json` so a
 * fork can rename the markdown file under `src/data/paginas/{lang}/` without
 * touching this module — set `writingPageId: "blog"` and the catch-all
 * dispatches accordingly. Defaults preserve the historical Spanish ids so
 * older configs without these fields keep working.
 */
const WRITING_KEY = (writingConfig as { writingPageId?: string }).writingPageId || "escritos";
const PORTFOLIO_KEY =
  (portfolioConfig as { portfolioPageId?: string }).portfolioPageId || "portafolio";
const PRIVACY_KEY = (footerConfig as { privacyPageId?: string }).privacyPageId || "privacidad";

/** Section-id constants for callers that need to identify a template branch. */
export const SECTION_WRITING = WRITING_KEY;
/** Section-id constants for callers that need to identify a template branch. */
export const SECTION_PORTFOLIO = PORTFOLIO_KEY;
/** Privacy page id — used by the footer link and the sitemap. */
export const SECTION_PRIVACY = PRIVACY_KEY;

/**
 * Test whether a `pageData.template` (or page id) marks a writing-list page.
 * Replaces hardcoded `template === "escritos"` checks.
 * @param value - The string under test.
 * @returns True when the value matches the configured writing section id.
 */
export function isWritingSection(value: string | undefined): boolean {
  return value === WRITING_KEY;
}

/**
 * Test whether a `pageData.template` (or page id) marks a portfolio-list page.
 * @param value - The string under test.
 * @returns True when the value matches the configured portfolio section id.
 */
export function isPortfolioSection(value: string | undefined): boolean {
  return value === PORTFOLIO_KEY;
}

/**
 * Translate a writing-post deep path (year/month/slug) to the target locale's slug.
 * @param rest - Path segments after the writing root.
 * @param sourceLang - Current language code.
 * @param targetLang - Target language code.
 * @returns The translated trailing segment, or undefined if no mapping exists.
 */
function translateWritingDeepPath(
  rest: string[],
  sourceLang: string,
  targetLang: string,
): string | undefined {
  if (rest.length !== 3) return undefined;
  const postSlug = rest[2]!;
  const sourcePost = getWritingPost(postSlug, sourceLang);
  if (!sourcePost) return undefined;
  const targetPost = getWritingPostByFileId(sourcePost.fileId, targetLang);
  if (!targetPost) return undefined;
  return `${rest[0]}/${rest[1]}/${targetPost.slug}/`;
}

/**
 * Translate a portfolio-album deep path to the target locale's slug.
 * @param rest - Path segments after the portfolio root.
 * @param sourceLang - Current language code.
 * @param targetLang - Target language code.
 * @returns The translated trailing segment, or undefined if no mapping exists.
 */
function translateAlbumDeepPath(
  rest: string[],
  sourceLang: string,
  targetLang: string,
): string | undefined {
  if (rest.length !== 1) return undefined;
  const sourceAlbum = getAlbumBySlug(rest[0]!, sourceLang);
  if (!sourceAlbum) return undefined;
  const targetAlbum = getAlbumByFileId(sourceAlbum.id, targetLang);
  if (!targetAlbum) return undefined;
  return `${targetAlbum.slug}/`;
}

/**
 * Map a path in one language to its equivalent in the target language.
 * @param currentPath - Current URL path.
 * @param targetLang - Target language code.
 * @returns Equivalent path in the target language.
 */
export function getEquivalentPath(currentPath: string, targetLang: string): string {
  const targetPathMap = pathMapByLang.get(targetLang) ?? {};
  const targetHome = `/${targetLang}/`;

  const path = currentPath.replace(/\/$/, "");
  const parts = path.split("/");
  if (path === "" || parts.length < 3) return targetHome;

  // Source lang is the first path segment, validated against the configured
  // language list. Falls back to the site default for unrecognized prefixes
  // (e.g. paths under `/`) so we don't dereference an empty segment map.
  const candidateLang = parts[1] || "";
  const sourceLang = SUPPORTED.includes(candidateLang) ? candidateLang : SUPPORTED[0]!;
  const sourceSegmentMap = segmentToKeyByLang.get(sourceLang) ?? {};

  if (path === `/${sourceLang}`) return targetHome;

  const key = sourceSegmentMap[parts[2]!];
  if (!key) return targetHome;
  const targetBase = targetPathMap[key];
  if (!targetBase) return targetHome;
  if (parts.length === 3) return targetBase;

  const rest = parts.slice(3);
  if (key === WRITING_KEY) {
    // Writing posts have per-locale slugs paired by `fileId`. If the paired
    // translation doesn't exist (post is ES-only), fall back to the target
    // language's writing listing rather than emitting a 404-bound URL with
    // the source-language slug.
    const translated = translateWritingDeepPath(rest, sourceLang, targetLang);
    return translated ? `${targetBase}${translated}` : targetBase;
  }
  if (key === PORTFOLIO_KEY) {
    // Same reasoning as writing: portfolio album slugs differ per locale.
    const translated = translateAlbumDeepPath(rest, sourceLang, targetLang);
    return translated ? `${targetBase}${translated}` : targetBase;
  }
  return `${targetBase}${rest.join("/")}/`;
}

/**
 * Get all page entries across both languages for sitemap generation.
 * @returns Array of objects with lang and slug for every page, post, and album.
 */
export function getAllPageEntries(): { lang: string; slug: string }[] {
  const entries: { lang: string; slug: string }[] = [];

  // Skip the home page — root `/` and `/<lang>/` already render it.
  // Match by page id (the markdown filename), not by slug, so renaming the URL
  // slug doesn't accidentally re-add the home page to the sitemap.
  const homePageId = siteConfig.homePage;

  for (const [langCode, slugMap] of slugMapByLang) {
    for (const [id, slug] of slugMap) {
      if (id !== homePageId) entries.push({ lang: langCode, slug });
    }
  }

  for (const langCode of SUPPORTED) {
    const writingSegment = getPagePath(WRITING_KEY, langCode)
      .replace(`/${langCode}/`, "")
      .replace(/\/$/, "");
    const portfolioSegment = getPagePath(PORTFOLIO_KEY, langCode)
      .replace(`/${langCode}/`, "")
      .replace(/\/$/, "");

    for (const post of getWritingPosts(langCode)) {
      const dateMatch = post.date.match(/^(\d{4})-(\d{2})/);
      if (!dateMatch) {
        console.warn(
          `getAllPageEntries: skipping post "${post.slug}" with invalid date "${post.date}"`,
        );
        continue;
      }
      entries.push({
        lang: langCode,
        slug: `${writingSegment}/${dateMatch[1]}/${dateMatch[2]}/${post.slug}`,
      });
    }

    for (const album of getPortfolio(langCode)) {
      entries.push({ lang: langCode, slug: `${portfolioSegment}/${album.slug}` });
    }
  }

  return entries;
}
