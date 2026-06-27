/**
 * Featured-content getters. The `colecciones/albumes-destacados.json` and
 * `colecciones/escritos-destacados.json` files are curation lists: each
 * entry has `{ active, album|post }` and the renderer pulls the matching
 * full record from `data/portfolio.ts` / `data/writing.ts`.
 *
 * Behavior: if no entries are marked active, we fall back to the full
 * active list of that content type (sorted by the type's default order).
 * This keeps the home page populated even before the editor has curated
 * a specific feature list.
 *
 * Misconfigured ids (curation pointing at a non-existent album/post) log a
 * one-time warning per id+lang, mirroring `CollectionRenderer`'s pattern.
 * @module data/featured
 */

import { bucketByLocale, pickByLang, pickFromBucket } from "./_internal";
import { type PortfolioAlbumFlat, getPortfolio } from "./portfolio";
import { type WritingPostFlat, getWritingPosts } from "./writing";

// ---------------------------------------------------------------------------
// Featured Albums (colecciones/albumes-destacados)
// ---------------------------------------------------------------------------

const _albumesDestacadosBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/albumes-destacados.json", {
    eager: true,
    import: "default",
  }) as Record<string, { title?: string; items: Array<{ active: boolean; album: string }> }>,
  "colecciones",
);
const albumesDestacadosEn = pickFromBucket(_albumesDestacadosBucket, "en");
const albumesDestacadosEs = pickFromBucket(_albumesDestacadosBucket, "es");

/**
 * Get the list of featured album IDs for a language. Internal — external callers
 * use `getFeaturedAlbums` which resolves IDs to full album objects.
 * @param lang - Language code ("en" or "es").
 * @returns Array of album identifier strings.
 */
function getFeaturedAlbumIds(lang: string): string[] {
  const items = pickByLang(
    albumesDestacadosEn?.items ?? [],
    albumesDestacadosEs?.items ?? [],
    lang,
  );
  return (items as { active: boolean; album: string }[])
    .filter((item) => item.active)
    .map((item) => item.album);
}

/**
 * Get the featured albums section title for a language.
 * @param lang - Language code ("en" or "es").
 * @returns The section title string.
 */
export function getFeaturedAlbumsTitle(lang: string): string {
  return pickByLang(albumesDestacadosEn, albumesDestacadosEs, lang)?.title ?? "";
}

// Track per-id warnings so a misconfigured featured album logs once, not once
// per call/render. Same pattern as CollectionRenderer's `warnedNames`.
const warnedFeaturedIds = new Set<string>();

/**
 * Get featured portfolio albums, falling back to all albums if none are featured.
 * @param lang - Language code ("en" or "es").
 * @returns Featured album entries with ids.
 */
export function getFeaturedAlbums(lang: string): (PortfolioAlbumFlat & { id: string })[] {
  const all = getPortfolio(lang);
  const ids = getFeaturedAlbumIds(lang);
  if (ids.length === 0) return all;
  const resolved: (PortfolioAlbumFlat & { id: string })[] = [];
  for (const id of ids) {
    const album = all.find((a) => a.id === id);
    if (album) {
      resolved.push(album);
    } else {
      const key = `${lang}:${id}`;
      if (!warnedFeaturedIds.has(key)) {
        warnedFeaturedIds.add(key);
        console.warn(
          `getFeaturedAlbums(${lang}): unknown album id "${id}" — check albumes-destacados.json`,
        );
      }
    }
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Featured Writings (colecciones/escritos-destacados)
// ---------------------------------------------------------------------------

const _escritosDestacadosBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/escritos-destacados.json", {
    eager: true,
    import: "default",
  }) as Record<string, { title?: string; items: Array<{ active: boolean; post: string }> }>,
  "colecciones",
);
const escritosDestacadosEn = pickFromBucket(_escritosDestacadosBucket, "en");
const escritosDestacadosEs = pickFromBucket(_escritosDestacadosBucket, "es");

/**
 * Get the list of featured writing-post fileIds for a language. Internal —
 * external callers use `getFeaturedWritings` which resolves IDs to full
 * post objects.
 * @param lang - Language code ("en" or "es").
 * @returns Array of writing-post fileId strings (filename without .md).
 */
function getFeaturedWritingIds(lang: string): string[] {
  const items = pickByLang(
    escritosDestacadosEn?.items ?? [],
    escritosDestacadosEs?.items ?? [],
    lang,
  );
  return (items as { active: boolean; post: string }[])
    .filter((item) => item.active)
    .map((item) => item.post);
}

/**
 * Get the featured writings section title for a language.
 * @param lang - Language code ("en" or "es").
 * @returns The section title string.
 */
export function getFeaturedWritingsTitle(lang: string): string {
  return pickByLang(escritosDestacadosEn, escritosDestacadosEs, lang)?.title ?? "";
}

// Track per-id warnings so a misconfigured featured post logs once, not once
// per call/render. Same pattern as `getFeaturedAlbums` above.
const warnedFeaturedPostIds = new Set<string>();

/**
 * Get featured writing posts, falling back to ALL active posts (date-desc)
 * when no curation list is configured. Resolves each entry's `post` (a
 * fileId) to a full `WritingPostFlat` so consumers can render via the
 * standard `WritingPostCard`.
 * @param lang - Language code ("en" or "es").
 * @returns Featured writing posts in the order declared in escritos-destacados.json.
 */
export function getFeaturedWritings(lang: string): WritingPostFlat[] {
  const all = getWritingPosts(lang);
  const ids = getFeaturedWritingIds(lang);
  if (ids.length === 0) return all;
  const resolved: WritingPostFlat[] = [];
  for (const id of ids) {
    const post = all.find((p) => p.fileId === id);
    if (post) {
      resolved.push(post);
    } else {
      const key = `${lang}:${id}`;
      if (!warnedFeaturedPostIds.has(key)) {
        warnedFeaturedPostIds.add(key);
        console.warn(
          `getFeaturedWritings(${lang}): unknown post fileId "${id}" — check escritos-destacados.json`,
        );
      }
    }
  }
  return resolved;
}
