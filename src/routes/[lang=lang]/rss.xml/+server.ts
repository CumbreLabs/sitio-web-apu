import type { RequestHandler } from "./$types";
import { getWritingPosts, getSiteI18n, sortPosts, type WritingSort } from "$lib/data";
import { siteConfig, writingConfig, getSupportedLanguages } from "$lib/config";
import { getWritingBasePath } from "$lib/routes";

import { t } from "$lib/i18n";

const SITE_URL = siteConfig.url;
// Feed item cap from `escritos.json#feedItemCount`. Defaults to 50 — RSS
// shouldn't dump unbounded content (some readers truncate large feeds
// silently, hiding the discovery of older posts).
const FEED_ITEM_COUNT = (writingConfig as { feedItemCount?: number }).feedItemCount ?? 50;
const FEED_SORT = ((writingConfig as { defaultSort?: WritingSort }).defaultSort ??
  "date-desc") as WritingSort;

/**
 * Escape characters that would break out of XML element content or attribute values.
 * @param s - Raw string.
 * @returns XML-safe text.
 */
function escXml(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render a YYYY-MM-DD post date as the RFC-822 pubDate format RSS readers expect.
 * Falls back to the raw date when parsing fails so the feed stays valid.
 * @param raw - Date string in YYYY-MM-DD form.
 * @returns RFC-822 string.
 */
function toRfc822(raw: string): string {
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return raw;
  const date = new Date(Date.UTC(+parts[1]!, +parts[2]! - 1, +parts[3]!));
  if (Number.isNaN(date.getTime())) return raw;
  return date.toUTCString();
}

export const prerender = true;

export const GET: RequestHandler = ({ params }) => {
  // Validate the param against the configured language list rather than the
  // historical "es" vs everything-else split — keeps the feed valid for forks
  // with `languages: ["en"]` or `["en", "fr"]`.
  const supported = getSupportedLanguages();
  const lang = supported.includes(params.lang as string)
    ? (params.lang as string)
    : (siteConfig.defaultLanguage as string) || (supported[0] as string);
  const posts = sortPosts(getWritingPosts(lang), FEED_SORT).slice(0, FEED_ITEM_COUNT);
  const writingBase = getWritingBasePath(lang);
  const feedUrl = `${SITE_URL}/${lang}/rss.xml`;
  const siteHomeUrl = `${SITE_URL}/${lang}/`;
  // Channel title + description come from `sitio.json` (`feedSectionLabel`
  // per-locale) and `traducciones.json` (`feed.description` per-locale) so a
  // fork rebrands without touching this file.
  const sectionLabel = getSiteI18n(lang).feedSectionLabel || "";
  const title = sectionLabel ? `${siteConfig.name} — ${sectionLabel}` : siteConfig.name;
  const description = t(lang, "feed.description", {
    defaultValue: siteConfig.name,
  });

  // Channel-level lastBuildDate = max(updatedDate || date) across all posts,
  // so subscribers re-fetch when an existing post is edited (not just on new
  // publishes).
  const latest = posts.reduce((acc, p) => {
    const candidate = p.updatedDate || p.date;
    return candidate > acc ? candidate : acc;
  }, "");
  const lastBuild = latest ? toRfc822(latest) : new Date().toUTCString();

  const items = posts
    .map((post) => {
      const [year, month] = post.date.split("-");
      const link = post.externalUrl || `${SITE_URL}${writingBase}${year}/${month}/${post.slug}/`;
      const guid = `${SITE_URL}${writingBase}${year}/${month}/${post.slug}/`;
      const categories = post.tags.map((t) => `      <category>${escXml(t)}</category>`).join("\n");
      return `    <item>
      <title>${escXml(post.title)}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="false">${escXml(guid)}</guid>
      <pubDate>${toRfc822(post.date)}</pubDate>
      <description>${escXml(post.summary)}</description>${categories ? "\n" + categories : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXml(title)}</title>
    <link>${escXml(siteHomeUrl)}</link>
    <atom:link href="${escXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${escXml(description)}</description>
    <language>${lang}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
