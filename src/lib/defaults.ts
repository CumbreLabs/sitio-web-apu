/**
 * Single source of truth for every default config value across the site.
 *
 * Every field of every config slice (sitio / seo / escritos / portafolio /
 * proyectos / navegacion / pie-de-pagina) appears here with EITHER:
 *
 *   - a real default value that takes effect when the per-locale JSON file
 *     under `src/data/configuracion/{lang}/` omits it, OR
 *   - a `REQUIRED("hint")` sentinel, declaring that this field has no sane
 *     default and a fork MUST provide its own value. The
 *     `check:required-config` validator walks the merged config at build
 *     time and fails with the hint if a sentinel survives.
 *
 * Why this file exists: the previous setup scattered `?? 10`,
 * `?? "date-desc"`, `!== false` fallbacks across templates and components.
 * That made forking awkward (no single "what defaults am I inheriting?"
 * answer) and easy to break (changing a default required hunting through
 * `.svelte` files). The contract now lives in one auditable place.
 *
 * Consumers should NEVER write `someConfig.x ?? defaultValue` — the
 * defaults are pre-merged in `$lib/config`. If you see a `??` for a
 * config knob outside this file or the merge layer, that's a bug: move
 * the default here.
 *
 * Defaults are **language-agnostic** — `cardsPerRow: 3` means 3 in every
 * locale. Per-locale text (UI strings, descriptions, jobTitle, etc.) is
 * handled by the per-locale JSON files themselves; this file declares the
 * technical fallbacks that survive a missing JSON value.
 *
 * Translations (`configuracion/{lang}/traducciones.json`) are intentionally
 * NOT defaulted here — they're inherently per-locale and the `t()` helper
 * already returns the key as a string when a translation is missing.
 * @module defaults
 */

/**
 * Sentinel for "this field has no sane default — a fork MUST set it".
 * Survives into the merged config when the JSON omits the field; the
 * `check:required-config` validator catches the sentinel at build time
 * and fails with the hint so the fork knows exactly what to provide.
 * @param hint - Human-readable description of what to set + why.
 * @returns A sentinel string with a magic prefix the validator detects.
 */
export function REQUIRED(hint: string): string {
  return `${REQUIRED_PREFIX}${hint}`;
}

/** Magic prefix the validator scans for. Exported for the validator + tests. */
export const REQUIRED_PREFIX = "__REQUIRED__";

/**
 * Type-guard: does this value still carry the `REQUIRED(...)` sentinel?
 * Used by `scripts/checks/check-required-config.mjs` to detect
 * un-overridden required fields after the defaults merge.
 * @param value - Anything to test.
 * @returns True iff `value` is a string starting with `REQUIRED_PREFIX`.
 */
export function isRequiredSentinel(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(REQUIRED_PREFIX);
}

/**
 * Extract the human-readable hint from a `REQUIRED(hint)` sentinel.
 * Returns the raw value unchanged if it isn't a sentinel.
 * @param value - Value to extract from.
 * @returns The hint suffix, or the original value if not a sentinel.
 */
export function requiredHint(value: string): string {
  return value.startsWith(REQUIRED_PREFIX) ? value.slice(REQUIRED_PREFIX.length) : value;
}

/**
 * Master default-values table. Every CMS-editable field belongs here.
 * Add a new field? Add it here too — don't sprinkle `??` in the consumer.
 */
export const DEFAULTS = {
  /** `configuracion/{lang}/sitio.json` defaults. Identity + routing + analytics. */
  site: {
    name: REQUIRED("Site name — appears in <title>, og:site_name, JSON-LD WebSite."),
    author: REQUIRED("Author byline — separate from name so studio/person can differ."),
    url: REQUIRED("Canonical site URL, NO trailing slash (e.g. https://example.com)."),
    favicon: REQUIRED(
      "Path under /media/ to a ≥512px square source — the favicon pipeline derives every variant.",
    ),
    homePage: "inicio",
    defaultLanguage: "es",
    languages: ["es"] as readonly string[],
    lcpHeroImage: "",
    personImage: "",
    jobTitle: "",
    themeColor: "#000000",
    knowsLanguage: [] as readonly string[],
    timezone: "",
    timezoneLabel: "",
    copyrightNotice: "",
    sitemapExtras: [] as readonly string[],
    analytics: { provider: "none" as "none" | "gtm" | "ga4", id: "" },
  },

  /** `configuracion/{lang}/seo.json` defaults. Meta + social-card defaults. */
  seo: {
    description: REQUIRED(
      "Site description, 100-200 chars (LinkedIn warns under 100). Per-language.",
    ),
    defaultOGImage: REQUIRED("Path under /media/ to a 1200×630 landscape OG fallback."),
    titleTemplate: "{title} | {name}",
    defaultBackgroundImage: "",
    ogLocales: {} as Readonly<Record<string, string>>,
    twitterCard: "summary_large_image",
    twitterHandle: "",
  },

  /** `configuracion/{lang}/escritos.json` defaults. Writing-section knobs. */
  writing: {
    writingPageId: "escritos",
    writingPageSize: 10,
    feedSectionLabel: "Writing",
    defaultSort: "date-desc" as "date-desc" | "date-asc" | "updated-desc",
    feedItemCount: 50,
    showSummary: true,
    showFilters: true,
    cardsPerRow: 3,
  },

  /** `configuracion/{lang}/portafolio.json` defaults. Portfolio-section knobs. */
  portfolio: {
    portfolioPageId: "portafolio",
    defaultSort: "manual" as "manual" | "name-asc" | "name-desc",
    defaultFilter: "all",
  },

  /** `configuracion/{lang}/proyectos.json` defaults. Projects-section knobs. */
  projects: {
    cardsPerRow: 3,
    /** Rows the home `proyectos-destacados` collection fills (× cardsPerRow). */
    featuredRows: 2,
  },

  /** `configuracion/{lang}/pie-de-pagina.json` defaults. Footer + privacy link. */
  footer: {
    copyright: "",
    madeWith: "",
    social: [] as readonly object[],
    privacyPageId: "privacidad",
  },

  /** `configuracion/{lang}/navegacion.json` defaults. Brand block + nav items. */
  navigation: {
    brand: {
      text: "",
      image: "",
      imageDark: "",
      imageAlt: "",
      imageHeight: 32,
      showText: true,
    },
    items: [] as readonly object[],
  },
} as const;

import { createDefu } from "defu";

// Plain `defu` CONCATENATES arrays (`defu(["en","es"], ["es"])` →
// `["en","es","es"]`). That silently broke the bilingual language toggle:
// `siteConfig.languages` resolved to length 3, so `isBilingual` (=== 2) was
// false and the toggle rendered nothing. We need arrays REPLACED wholesale —
// a fork's `languages: ["en"]` must override the baseline `["es"]`, not append
// to it. `createDefu` lets us customize the per-key merge: when the incoming
// value is an array, assign it directly and return `true` to skip defu's
// concat. Plain objects still recurse; scalars still override; omitted fields
// still fall back to the default.
//
// Note on argument order: in `mergeConfig(override, defaults)` defu seeds the
// accumulator with `defaults` first, THEN calls the merger with `override` as
// `value` — so assigning `obj[key] = value` is what makes the override win.
const mergeConfig = createDefu((obj, key, value) => {
  if (Array.isArray(value)) {
    (obj as Record<string, unknown>)[key as string] = value;
    return true;
  }
  return false;
});

/**
 * Recursive deep-merge for the per-domain defaults pattern. Plain objects
 * recurse key-by-key; arrays and scalars are REPLACED wholesale (a fork
 * supplying its own `languages: ["en"]` doesn't get the default `["es"]`
 * concatenated onto it). Returns a new object — neither input is mutated.
 *
 * Used by `$lib/config` to fold the raw per-locale JSON (which may omit
 * fields) onto the `DEFAULTS` baseline so consumers see a fully-resolved
 * shape with no holes and no `?? fallback` in template code.
 *
 * Implementation: a `createDefu` instance with an array-replace merger (see
 * the comment above `mergeConfig`). Plain `defu` would concatenate arrays,
 * which broke the bilingual toggle's `languages.length === 2` check.
 * @param defaults - Base values from `DEFAULTS`.
 * @param override - Partial override from raw JSON (or `undefined`).
 * @returns Merged object — defaults filled in where override omits.
 */
export function withDefaults<T extends object>(defaults: T, override: unknown): T {
  // `mergeConfig(override, defaults)` = override values win where present;
  // defaults fill the gaps. Cast through unknown because defu's generic
  // inference doesn't pick up our `T extends object` constraint precisely.
  return mergeConfig(
    (override ?? {}) as Record<string, unknown>,
    defaults as Record<string, unknown>,
  ) as T;
}
