/**
 * Shared date formatting utilities for collection components.
 * @module date
 */

import { getOgLocale } from "$lib/config";

/**
 * Memoized `Intl.DateTimeFormat` instances keyed by BCP-47 tag. Constructing
 * a DateTimeFormat is ~1 ms; an Experience/Education page renders 10-20
 * date strings, so caching matters even with a small fixed locale set.
 */
const SHORT_MONTH_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/**
 * Resolve the BCP-47 tag for Intl. Accepts either a short lang code
 * ("en", "es", "fr") — looked up via `seo.json#ogLocales` → `getOgLocale()`
 * with `<lang>_<LANG>` fallback — or an already-qualified tag ("en-GB", "es_CO").
 * @param locale - Short lang code or full BCP-47/OG tag.
 * @returns BCP-47 tag with dashes (the form Intl expects).
 */
function bcp47Tag(locale: string): string {
  return /[-_]/.test(locale) ? locale.replace("_", "-") : getOgLocale(locale).replace("_", "-");
}

/**
 * Get (or build + cache) the short-month formatter for a BCP-47 tag.
 * @param tag - BCP-47 tag.
 * @returns Memoized formatter for `month: "short"`.
 */
function shortMonthFormatter(tag: string): Intl.DateTimeFormat {
  let f = SHORT_MONTH_FORMATTERS.get(tag);
  if (!f) {
    f = new Intl.DateTimeFormat(tag, { month: "short" });
    SHORT_MONTH_FORMATTERS.set(tag, f);
  }
  return f;
}

/**
 * Format a date string as "Mon YYYY" in the given locale.
 *
 * Short month names come from `Intl.DateTimeFormat` with `month: "short"` —
 * no hardcoded month tables per language. A fork adding French (or any
 * Intl-supported locale) gets correct short months automatically.
 *
 * Output normalization for cross-locale consistency:
 * 1. Strip trailing period some locales add (es-CO `"ene."` → `"ene"`,
 *    fr-FR `"janv."` → `"janv"`); en-US/de-DE don't add one to begin with.
 * 2. Capitalize first letter (Romance languages return lowercase short months;
 *    Germanic/English already capitalize).
 *
 * Note: Intl's es-CO outputs `"sept."` for September (where the legacy
 * hardcoded table used `"Sep"`) — RAE-correct but a slight visible change.
 * @param raw - Date string in YYYY-MM or YYYY-MM-DD format.
 * @param locale - Language code ("en"/"es"/…) or full BCP-47 tag.
 * @returns Formatted date string, or the raw input if it doesn't match.
 */
export function formatYearMonth(raw: string, locale: string): string {
  const m = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!m) return raw;
  const year = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10);
  if (month < 1 || month > 12) return raw;
  const short = shortMonthFormatter(bcp47Tag(locale))
    .format(new Date(year, month - 1, 1))
    .replace(/\.$/, "");
  return `${short.charAt(0).toUpperCase()}${short.slice(1)} ${year}`;
}

/**
 * Format a date range as "Mon YYYY - Mon YYYY" or just "Mon YYYY" if no end.
 * @param start - Start date in YYYY-MM or YYYY-MM-DD format.
 * @param end - Optional end date in the same format.
 * @param locale - Language code ("en" or "es").
 * @returns Formatted date period string.
 */
export function formatPeriod(start: string, end: string | undefined, locale: string): string {
  const s = formatYearMonth(start, locale);
  if (!end) return s;
  return `${s} - ${formatYearMonth(end, locale)}`;
}

/**
 * Extract the 4-digit year from a date string. Falls back to the input.
 * @param raw - Date string in YYYY, YYYY-MM, or YYYY-MM-DD format.
 * @returns The year as a string, or the raw input if no year could be extracted.
 */
export function formatYear(raw: string): string {
  const m = raw.match(/^(\d{4})/);
  return m ? m[1]! : raw;
}

/**
 * Split a YYYY-MM-DD blog post date into year/month segments for URL construction.
 * @param raw - Date string in YYYY-MM-DD format.
 * @returns Year and month strings, or undefined when the format does not match.
 */
export function postDateSegments(raw: string): { year: string; month: string } | undefined {
  const m = raw.match(/^(\d{4})-(\d{2})/);
  return m ? { year: m[1]!, month: m[2]! } : undefined;
}

/**
 * Format a date string as a localized long date (e.g. "March 5, 2026").
 *
 * The BCP-47 tag is derived from `seoConfig.ogLocales` via `getOgLocale(locale)`
 * (which uses underscore form like "es_CO") and converted to the dash form Intl
 * expects ("es-CO"). Falls back to the bare lang code if no country-qualified
 * locale is configured for that language. A fork picks its own country variant
 * by editing seo.json#ogLocales — no edit to this file needed.
 * @param raw - Date string in YYYY-MM-DD format.
 * @param locale - Language code ("en" or "es"), or a full BCP-47 tag.
 * @returns Localized long date, or the raw input if parsing fails.
 */
export function formatLongDate(raw: string, locale: string): string {
  // Validate the YYYY-MM-DD parts explicitly. Date's constructor silently rolls
  // overflow (e.g. "2024-02-30" becomes March 1), so an invalid frontmatter
  // date would print a real-but-wrong day. Fall back to the raw input instead.
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return raw;
  const year = parseInt(parts[1]!, 10);
  const month = parseInt(parts[2]!, 10);
  const day = parseInt(parts[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return raw;
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return raw;
  }
  return date.toLocaleDateString(bcp47Tag(locale), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
