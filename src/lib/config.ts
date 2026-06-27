/**
 * Loads per-locale JSON config and merges it onto the `DEFAULTS` baseline
 * from `$lib/defaults` so consumers see a fully-resolved shape with no
 * `?? fallback` in template code. There are only three places defaults
 * should ever live: this module's interfaces, the `DEFAULTS` table, and
 * the per-locale JSON files. If you find a `??` or `||` for a config
 * knob in component code, that's a bug — move the default into
 * `defaults.ts` instead.
 *
 * Per-locale slices are discovered via `import.meta.glob` (eager) so the
 * framework supports both bilingual sites AND monolingual forks that only
 * ship one of the locale folders. Static `import` would fail at build
 * time if either locale is absent — `check:monolingual-build` (see
 * AUDIT_CHECKLIST.md #18.8) gates this monolingual claim.
 *
 * Most fields are `i18n: duplicate` in the Sveltia CMS config — identical
 * across locale slices — so the default-language slice is the source of
 * truth for language-agnostic callers. For language-aware reads, use the
 * `*ByLang` exports or `getSiteI18n` in `$lib/data` (which curates a
 * single `{description, jobTitle, feedSectionLabel}` shape across all
 * source files).
 * @module config
 */

import { DEFAULTS, withDefaults } from "./defaults";

const siteModules = import.meta.glob("../data/configuracion/*/sitio.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;
const seoModules = import.meta.glob("../data/configuracion/*/seo.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;
const writingModules = import.meta.glob("../data/configuracion/*/escritos.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;
const portfolioModules = import.meta.glob("../data/configuracion/*/portafolio.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;
const projectsModules = import.meta.glob("../data/configuracion/*/proyectos.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;
const footerModules = import.meta.glob("../data/configuracion/*/pie-de-pagina.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

/**
 * Turn an `import.meta.glob` map ({ "../data/configuracion/es/sitio.json": {...} })
 * into a locale-keyed record ({ es: {...}, en: {...} }). Returns an empty
 * object when no files match (shouldn't happen for a valid fork — the
 * `check:fork` gate enforces at least the default locale exists).
 * @param modules - Map returned by `import.meta.glob`.
 * @returns Record keyed by locale code.
 */
function byLocale<T>(modules: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [path, value] of Object.entries(modules)) {
    const m = path.match(/configuracion\/([^/]+)\//);
    if (m && m[1]) out[m[1]] = value;
  }
  return out;
}

/**
 * Apply `DEFAULTS.<domain>` to every locale slice in a per-locale record.
 * Returns a new map where each value has been deep-merged onto the
 * baseline, so missing keys in any locale's JSON get filled from
 * `DEFAULTS` rather than surfacing as `undefined` at call sites.
 * @param all - Per-locale raw record from `byLocale`.
 * @param baseline - Slice of `DEFAULTS` for this config domain.
 * @returns New per-locale record with defaults applied to every slice.
 */
function applyDefaultsByLocale<T extends object>(
  all: Record<string, unknown>,
  baseline: T,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [lang, raw] of Object.entries(all)) {
    out[lang] = withDefaults(baseline, raw);
  }
  return out;
}

const rawSiteAll = byLocale(siteModules);
const rawSeoAll = byLocale(seoModules);
const rawWritingAll = byLocale(writingModules);
const rawPortfolioAll = byLocale(portfolioModules);
const rawProjectsAll = byLocale(projectsModules);
const rawFooterAll = byLocale(footerModules);

const siteAll = applyDefaultsByLocale(rawSiteAll, DEFAULTS.site);
const seoAll = applyDefaultsByLocale(rawSeoAll, DEFAULTS.seo);
const writingAll = applyDefaultsByLocale(rawWritingAll, DEFAULTS.writing);
const portfolioAll = applyDefaultsByLocale(rawPortfolioAll, DEFAULTS.portfolio);
const projectsAll = applyDefaultsByLocale(rawProjectsAll, DEFAULTS.projects);
const footerAll = applyDefaultsByLocale(rawFooterAll, DEFAULTS.footer);

// `defaultLanguage` is `i18n: duplicate` (every locale slice carries the
// same value), so reading from any locale's slice is fine. We pick the
// first present one to support monolingual forks that only ship one locale.
// After the defaults merge `defaultLanguage` is always a string — DEFAULTS
// provides "es" as the baseline when raw JSON omits it.
const firstSite = Object.values(siteAll)[0];
const defaultLang = firstSite ? firstSite.defaultLanguage : DEFAULTS.site.defaultLanguage;

/**
 * Pick the locale slice for `lang`, falling back to the default-language
 * slice when the requested locale is missing. Lets a monolingual fork's
 * `.en` and `.es` reads both resolve to the same (only-present) object,
 * so the legacy `(en, es, lang)` pickByLang callers keep working.
 * @param all - Per-locale record from `byLocale`.
 * @returns A Proxy where `.<lang>` returns the slice or the default-lang fallback.
 */
function localeProxy<T>(all: Record<string, T>): Record<string, T> {
  const fallback = all[defaultLang] ?? Object.values(all)[0];
  return new Proxy(all, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return fallback;
    },
  });
}

/**
 * Public surface of each config slice. Interfaces declare the RESOLVED
 * shape callers see (post-merge with `DEFAULTS`) — every field is
 * required at the type level because the defaults guarantee it's
 * present. Optional fields in the source JSON become required here.
 * Keep these in sync with `DEFAULTS` in `$lib/defaults` and with the
 * Sveltia CMS widget definitions in `static/admin/config.yml`.
 */
export interface SiteConfig {
  name: string;
  author: string;
  url: string;
  homePage: string;
  defaultLanguage: string;
  languages: readonly string[];
  favicon: string;
  lcpHeroImage: string;
  personImage: string;
  analytics: { provider: string; id: string };
  jobTitle: string;
  themeColor: string;
  knowsLanguage: readonly string[];
  copyrightNotice: string;
  timezone: string;
  timezoneLabel: string;
  sitemapExtras: readonly string[];
}

/** Resolved shape of `configuracion/{lang}/seo.json`. */
export interface SeoConfig {
  description: string;
  titleTemplate: string;
  defaultOGImage: string;
  defaultBackgroundImage: string;
  ogLocales: Record<string, string>;
  twitterCard: string;
  twitterHandle: string;
}

/** Resolved shape of `configuracion/{lang}/escritos.json`. */
export interface WritingConfig {
  writingPageId: string;
  writingPageSize: number;
  feedSectionLabel: string;
  defaultSort: "date-desc" | "date-asc" | "updated-desc";
  feedItemCount: number;
  showSummary: boolean;
  showFilters: boolean;
  /**
   * How many post cards render per row at the largest breakpoint. Applies
   * to BOTH the Escritos listing template and the home
   * `escritos-destacados` collection so layouts stay in sync. Resolved by
   * `$lib/grid#gridColsClass` (supports 1-6).
   */
  cardsPerRow: number;
}

/** Resolved shape of `configuracion/{lang}/portafolio.json`. */
export interface PortfolioConfig {
  portfolioPageId: string;
  defaultSort: "manual" | "name-asc" | "name-desc";
  defaultFilter: string;
}

/** Resolved shape of `configuracion/{lang}/proyectos.json`. */
export interface ProjectsConfig {
  /**
   * How many project cards render per row at the largest breakpoint.
   * Applies to BOTH the Proyectos listing component and the home
   * `proyectos-destacados` collection. Resolved by
   * `$lib/grid#gridColsClass` (supports 1-6). Set to `1` for text-heavy
   * project cards to preserve a stacked, single-column layout.
   */
  cardsPerRow: number;
  /** Rows the home `proyectos-destacados` collection fills (× cardsPerRow). */
  featuredRows: number;
}

/** Resolved shape of `configuracion/{lang}/pie-de-pagina.json`. */
export interface FooterConfig {
  copyright: string;
  madeWith: string;
  social: readonly object[];
  privacyPageId: string;
}

// Pick the default-locale slice (or the only-present one for monolingual
// forks) as the canonical, language-agnostic value. After the defaults
// merge each slice has every field present, so consumers see no holes.
const pickDefaultSlice = <T extends object>(all: Record<string, T>, baseline: T): T =>
  all[defaultLang] ?? Object.values(all)[0] ?? withDefaults(baseline, undefined);

export const siteConfig: SiteConfig = pickDefaultSlice(siteAll, DEFAULTS.site) as SiteConfig;
export const seoConfig: SeoConfig = pickDefaultSlice(seoAll, DEFAULTS.seo) as SeoConfig;
export const writingConfig: WritingConfig = pickDefaultSlice(
  writingAll,
  DEFAULTS.writing,
) as WritingConfig;
export const portfolioConfig: PortfolioConfig = pickDefaultSlice(
  portfolioAll,
  DEFAULTS.portfolio,
) as PortfolioConfig;
export const projectsConfig: ProjectsConfig = pickDefaultSlice(
  projectsAll,
  DEFAULTS.projects,
) as ProjectsConfig;
export const footerConfig: FooterConfig = pickDefaultSlice(
  footerAll,
  DEFAULTS.footer,
) as FooterConfig;

export const siteByLang: Record<string, SiteConfig> = localeProxy(siteAll) as Record<
  string,
  SiteConfig
>;
export const seoByLang: Record<string, SeoConfig> = localeProxy(seoAll) as Record<
  string,
  SeoConfig
>;
export const writingByLang: Record<string, WritingConfig> = localeProxy(writingAll) as Record<
  string,
  WritingConfig
>;
export const portfolioByLang: Record<string, PortfolioConfig> = localeProxy(portfolioAll) as Record<
  string,
  PortfolioConfig
>;
export const projectsByLang: Record<string, ProjectsConfig> = localeProxy(projectsAll) as Record<
  string,
  ProjectsConfig
>;
export const footerByLang: Record<string, FooterConfig> = localeProxy(footerAll) as Record<
  string,
  FooterConfig
>;

// Analytics is `i18n: duplicate` — values are identical across locales by
// design (one site = one analytics provider). Expose the default-lang
// slice directly so `hooks.server.ts` doesn't need to thread a `lang` to
// read it. After the defaults merge `analytics` is always present as
// `{ provider: "none", id: "" }` at minimum.
export const analyticsConfig = siteConfig.analytics;

/**
 * Pick the locale-appropriate value from a per-language record, falling back
 * to the default language when the requested one is missing. Replaces the
 * `lang === "es" ? es : en` ternaries scattered through `data.ts` with a
 * single helper that respects `siteConfig.defaultLanguage` — so a site that
 * declares `defaultLanguage: "en"` (or adds a third locale later) doesn't
 * have to chase down every ternary.
 * @param lang - Requested language code.
 * @param values - Map of language code to value.
 * @returns The value for `lang`, or the default-language value.
 */
export function pickByLang<T>(lang: string, values: Record<string, T>): T {
  if (lang in values) return values[lang]!;
  return values[siteConfig.defaultLanguage] ?? Object.values(values)[0]!;
}

/**
 * Resolve a page-title from `seoConfig.titleTemplate`. Supports `{title}`
 * and `{name}` placeholders. The template is always defined post-merge
 * (`DEFAULTS.seo.titleTemplate` covers the missing-JSON case).
 * @param title - Page-specific title (or empty for the homepage).
 * @returns Full document title.
 */
export function resolveTitle(title: string | undefined): string {
  const name = siteConfig.name;
  if (!title) return name;
  return seoConfig.titleTemplate.replace("{title}", title).replace("{name}", name);
}

/**
 * Get the Open Graph locale code for a language (e.g. "es_CO", "en_US").
 * Falls back to `<lang>_<LANG>` (e.g. "fr_FR" for "fr") when the requested
 * language isn't declared in `seoConfig.ogLocales`, so a fork that adds a
 * new language without remembering to update the map still emits a valid
 * `og:locale`. This `<lang>_<LANG>` fallback is a derivation, not a
 * config default — there's no sensible per-fork value to lift into
 * `DEFAULTS.seo.ogLocales` because the locale set varies by fork.
 * @param lang - Language code.
 * @returns Locale code suitable for `og:locale` / `og:locale:alternate`.
 */
export function getOgLocale(lang: string): string {
  const mapped = seoConfig.ogLocales[lang];
  if (mapped) return mapped;
  return `${lang}_${lang.toUpperCase()}`;
}

/**
 * Get the list of supported languages from `siteConfig.languages`. After
 * the defaults merge this is always a non-empty array (`DEFAULTS.site.languages`
 * is `["es"]` for a monolingual baseline), so callers don't need their
 * own `?? []` fallback.
 * @returns Array of language codes.
 */
export function getSupportedLanguages(): readonly string[] {
  return siteConfig.languages;
}

/**
 * Get the "other" language for a bilingual language toggle. Falls back to
 * the default language when the supported-languages list doesn't have
 * exactly two entries — multi-lingual sites need their own picker UI.
 * @param lang - Current language code.
 * @returns The alternate language code.
 */
export function getAlternateLanguage(lang: string): string {
  const langs = getSupportedLanguages();
  if (langs.length === 2) return langs[0] === lang ? langs[1]! : langs[0]!;
  return siteConfig.defaultLanguage;
}
