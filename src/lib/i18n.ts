/**
 * Custom internationalization system providing `t()` for string lookups.
 * Supports dot-notation keys, interpolation, and i18next-style pluralization.
 * @module i18n
 */

// Discover translation files via `import.meta.glob` (eager) so the framework
// supports monolingual forks that only ship one locale. Static `import en/es`
// would fail at build time if either locale folder is absent.
const translationModules = import.meta.glob("../data/configuracion/*/traducciones.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

/** Generic translation-dictionary shape — nested string maps. */
type Translations = Record<string, unknown>;

/** Map of language codes to their corresponding translation dictionaries. */
const translations: Record<string, Translations> = {};
for (const [path, value] of Object.entries(translationModules)) {
  const m = path.match(/configuracion\/([^/]+)\//);
  if (m && m[1]) translations[m[1]] = value as Translations;
}

/**
 * Get a nested value from an object using a dot-separated key path.
 * Supports interpolation with {{key}} syntax.
 * @param obj - The object to traverse
 * @param keyPath - Dot-separated path (e.g., "home.featuredWork")
 * @returns The value at the key path, or undefined if not found
 */
function getNestedValue(obj: unknown, keyPath: string): unknown {
  const keys = keyPath.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Translation function that retrieves a localized string by key.
 *
 * Supports:
 * - Dot-separated key paths: `t("en", "home.featuredWork")`
 * - Interpolation: `t("en", "portfolio.photoCount", { count: 5 })`
 * - i18next-style pluralization via `_one` / `_other` suffixes based on `count`
 * - `defaultValue` option for fallback text
 * @param lang - The language code ("en" or "es")
 * @param key - Dot-notation key path into the translation JSON (e.g., "home.title")
 * @param options - Optional parameters for interpolation, pluralization, and behavior
 * @param options.count - Count value for pluralization (selects `_one` or `_other` suffix)
 * @param options.defaultValue - Fallback string if the key is not found
 * @returns The translated string, or the key itself if not found
 */
export function t(
  lang: string,
  key: string,
  options?: {
    count?: number;
    defaultValue?: string;
    [k: string]: unknown;
  },
): string {
  const dict = translations[lang] ?? translations["en"];

  // Pluralization: if count is provided, try key_one or key_other
  if (options?.count !== undefined) {
    const pluralSuffix = options.count === 1 ? "_one" : "_other";
    const pluralValue = getNestedValue(dict, key + pluralSuffix);
    if (typeof pluralValue === "string") {
      return interpolate(pluralValue, options);
    }
  }

  const value = getNestedValue(dict, key);

  if (typeof value === "string") {
    return interpolate(value, options);
  }

  return options?.defaultValue ?? key;
}

/**
 * Replace `{{key}}` placeholders in a string with values from the params object.
 * @param str - The template string containing `{{key}}` placeholders
 * @param params - Key-value pairs for interpolation
 * @returns The interpolated string
 */
function interpolate(str: string, params?: Record<string, unknown>): string {
  if (!params) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    params[k] !== undefined ? String(params[k]) : `{{${k}}}`,
  );
}
