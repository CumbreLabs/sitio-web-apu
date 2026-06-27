/**
 * Internal helpers shared across the sibling files in `src/lib/data/`.
 * Not re-exported from `index.ts` — leaking these would let consumers reach
 * around the public API and tie themselves to the on-disk locale shape
 * (en/es). The single public locale-picker for consumers lives in
 * `$lib/config` as `pickByLang(lang, { es, en, ... })`.
 *
 * If a helper here becomes useful to a non-data module, promote it to its own
 * file under `$lib/` first — don't import this module directly from outside
 * `src/lib/data/`.
 * @module data/_internal
 */

import { siteConfig } from "$lib/config";

/** Entry with an optional display order field. */
export type Ordered<T> = T & { order?: number };

/** Entries that may be explicitly marked inactive. */
export type MaybeActive = { active?: boolean };

/** Frontmatter values treated as inactive (case-insensitive). */
export const INACTIVE_VALUES = new Set(["false", "0", "no"]);

/**
 * Parse a raw value into an array of tag strings. Accepts comma-separated
 * strings (Sveltia's default for the `tags` field) and arrays of strings.
 * @param raw - Raw tag value.
 * @returns Trimmed, non-empty tag strings.
 */
export function parseTags(raw: unknown): string[] {
  if (typeof raw === "string")
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  return [];
}

/**
 * Extract a file identifier from a glob path by removing the directory and
 * extension. The result is the bare filename used as a cross-locale id (so
 * `/portafolio/es/handstand.json` and `/portafolio/en/handstand.json` share
 * `id === "handstand"`).
 * @param path - File path from an import.meta.glob result.
 * @returns The bare filename without extension.
 */
export function idFromPath(path: string): string {
  const last = path.split("/").pop();
  if (!last) return "";
  return last.replace(/\.(json|md)$/, "");
}

/**
 * Pick the locale-appropriate value from an English/Spanish pair, respecting
 * `siteConfig.defaultLanguage` for the fallback rather than hardcoding ES.
 * Internal helper — generic locale-keyed picker for consumers outside data/
 * lives in `$lib/config` as `pickByLang(lang, { es, en, ... })`.
 * @param en - English value.
 * @param es - Spanish value.
 * @param lang - Language code.
 * @returns The value matching `lang`, or the default-language value.
 */
export function pickByLang<T>(en: T, es: T, lang: string): T {
  if (lang === "es") return es;
  if (lang === "en") return en;
  const def = siteConfig.defaultLanguage || "es";
  return def === "es" ? es : en;
}

/**
 * Extract the locale segment from an `import.meta.glob` path and bucket the
 * values into a per-locale record. Used by the data loaders to make their
 * locale loading monolingual-safe — a fork that ships only `en/` produces
 * `{en: {...}}` and reads still work via `pickFromBucket` which falls back
 * to the default-language slice when a locale is missing.
 *
 * Expects paths shaped like `…/colecciones/<locale>/<name>.json` or
 * `…/configuracion/<locale>/<name>.json`. The `pathSegment` arg names the
 * parent directory ("colecciones" / "configuracion" / "portafolio" /
 * "escritos") so the regex can pin the right capture.
 * @param modules - Map returned by `import.meta.glob({ eager: true, import: "default" })`.
 * @param pathSegment - Parent directory name that precedes the locale segment.
 * @returns Record keyed by locale code.
 */
export function bucketByLocale<T>(
  modules: Record<string, T>,
  pathSegment: string,
): Record<string, T> {
  const out: Record<string, T> = {};
  const re = new RegExp(`${pathSegment}/([^/]+)/`);
  for (const [path, value] of Object.entries(modules)) {
    const m = path.match(re);
    if (m && m[1]) out[m[1]] = value;
  }
  return out;
}

/**
 * Read a value from a per-locale bucket, falling back to the default-
 * language slice when the requested locale is missing. The companion to
 * `bucketByLocale` — together they replace the old pattern of static
 * `import xxxEn from ".../en/xxx.json"; import xxxEs from ".../es/xxx.json"`
 * which broke any monolingual fork.
 * @param bucket - Per-locale record from `bucketByLocale`.
 * @param lang - Requested language code.
 * @returns The slice for `lang`, or the default-language slice, or any slice.
 */
export function pickFromBucket<T>(bucket: Record<string, T>, lang: string): T {
  if (lang in bucket) return bucket[lang]!;
  const def = siteConfig.defaultLanguage || "es";
  return bucket[def] ?? Object.values(bucket)[0]!;
}

/**
 * Generic shape of a `colecciones/{lang}/<name>.json` file: a section title
 * plus an array of items. The item type `T` is the collection-specific flat
 * record (e.g. `ExperienceFlat`, `ProjectFlat`).
 */
export interface CollectionJson<T> {
  title?: string;
  items: T[];
}

/**
 * Filter out entries explicitly marked `active: false`. Items without an
 * `active` field are kept (treated as active by default).
 * @param items - Items to filter.
 * @returns Items that are active or unset.
 */
export function filterActive<T extends MaybeActive>(items: readonly T[]): T[] {
  return items.filter((item) => item.active !== false);
}

/**
 * Sort glob-loaded files by `order` field (ascending; entries with order win
 * over entries without), then by path. Each result gains an `id` derived from
 * the source filename so callers don't have to thread the path through.
 * @param files - Glob result map of ordered entries.
 * @returns Sorted array with an `id` derived from each file path.
 */
export function sorted<T>(files: Record<string, Ordered<T>>): (T & { id: string })[] {
  return Object.entries(files)
    .sort(([a, av], [b, bv]) => {
      const oa = av.order;
      const ob = bv.order;
      if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob;
      if (oa !== undefined && ob === undefined) return -1;
      if (oa === undefined && ob !== undefined) return 1;
      return a.localeCompare(b);
    })
    .map(([path, v]) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { order, ...rest } = v as Ordered<T>;
      return { id: idFromPath(path), ...rest } as T & { id: string };
    });
}
