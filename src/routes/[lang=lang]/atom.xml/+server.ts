import type { RequestHandler } from "./$types";
import { getWritingPosts, getSiteI18n, sortPosts, type WritingSort } from "$lib/data";
import { siteConfig, writingConfig, getSupportedLanguages } from "$lib/config";
import { getWritingBasePath } from "$lib/routes";
import { t } from "$lib/i18n";

const SITE_URL = siteConfig.url;
// Mirror the RSS feed: same cap + sort so an editor only configures once.
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
 * Render a YYYY-MM-DD date as ISO-8601 with a UTC offset — Atom's required
 * `updated`/`published` format. Falls back to current ISO string when parsing
 * fails so the feed stays valid.
 * @param raw - Date string in YYYY-MM-DD form.
 * @returns RFC-3339 / ISO-8601 string.
 */
function toIso(raw: string): string {
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return new Date().toISOString();
  const date = new Date(Date.UTC(+parts[1]!, +parts[2]! - 1, +parts[3]!));
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

export const prerender = true;

export const GET: RequestHandler = ({ params }) => {
  // See rss.xml for the same supported-languages validation pattern.
  const supported = getSupportedLanguages();
  const lang = supported.includes(params.lang as string)
    ? (params.lang as string)
    : (siteConfig.defaultLanguage as string) || (supported[0] as string);
  const posts = sortPosts(getWritingPosts(lang), FEED_SORT).slice(0, FEED_ITEM_COUNT);
  const writingBase = getWritingBasePath(lang);
  const feedUrl = `${SITE_URL}/${lang}/atom.xml`;
  const siteHomeUrl = `${SITE_URL}/${lang}/`;
  const sectionLabel = getSiteI18n(lang).feedSectionLabel || "";
  const title = sectionLabel ? `${siteConfig.name} — ${sectionLabel}` : siteConfig.name;
  const subtitle = t(lang, "feed.description", { defaultValue: siteConfig.name });

  // Feed-level `updated` = max(updatedDate || date) across all posts. Atom
  // readers use this to detect channel-level changes (re-edited posts, not just
  // new ones).
  const latest = posts.reduce((acc, p) => {
    const candidate = p.updatedDate || p.date;
    return candidate > acc ? candidate : acc;
  }, "");
  const feedUpdated = latest ? toIso(latest) : new Date().toISOString();

  const authorName = siteConfig.name;
  const authorUri = siteHomeUrl;

  const entries = posts
    .map((post) => {
      const [year, month] = post.date.split("-");
      const canonical = `${SITE_URL}${writingBase}${year}/${month}/${post.slug}/`;
      const link = post.externalUrl || canonical;
      const updated = toIso(post.updatedDate || post.date);
      const published = toIso(post.date);
      const categories = post.tags.map((t) => `    <category term="${escXml(t)}" />`).join("\n");
      return `  <entry>
    <title>${escXml(post.title)}</title>
    <link href="${escXml(link)}" />
    <id>${escXml(canonical)}</id>
    <published>${published}</published>
    <updated>${updated}</updated>
    <summary>${escXml(post.summary)}</summary>${categories ? "\n" + categories : ""}
  </entry>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">
  <title>${escXml(title)}</title>
  <subtitle>${escXml(subtitle)}</subtitle>
  <link href="${escXml(feedUrl)}" rel="self" type="application/atom+xml" />
  <link href="${escXml(siteHomeUrl)}" rel="alternate" type="text/html" />
  <id>${escXml(feedUrl)}</id>
  <updated>${feedUpdated}</updated>
  <author>
    <name>${escXml(authorName)}</name>
    <uri>${escXml(authorUri)}</uri>
  </author>
${entries}
</feed>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
};
