import type { RequestHandler } from "./$types";
import { getPortfolio, getWritingPosts, getPageData, getPageSlugMap, getSiteI18n } from "$lib/data";
import { siteConfig, getSupportedLanguages, getAlternateLanguage } from "$lib/config";
import {
  getHomePath,
  getPagePath,
  getWritingBasePath,
  SECTION_WRITING,
  SECTION_PORTFOLIO,
} from "$lib/routes";

/**
 * `/llms.txt` generator — implements the https://llmstxt.org/ proposal: a
 * single markdown file at the site root that gives an LLM a concise, curated
 * map of the site's content (who this is, what pages exist, every writing post
 * + portfolio album with a short description and its canonical URL). Crawlers
 * and assistants read it the way they read robots.txt / sitemap.xml.
 *
 * Everything is derived from the SAME data/config the rest of the site uses,
 * so it stays correct as content changes — no hand-maintained list. It's
 * emitted in the DEFAULT language (the canonical content); the alternate
 * locale's home + feeds are linked under "## Optional" so an LLM can discover
 * the other language without doubling the listing.
 *
 * Prerendered to a static `/llms.txt` by adapter-static, exactly like
 * `sitemap.xml`.
 * @module routes/llms.txt
 */

const SITE_URL = siteConfig.url;

/**
 * Collapse whitespace and trim a one-line field so a stray newline in a
 * frontmatter description can't break the markdown list structure.
 * @param s - Raw field value.
 * @returns Single-line, trimmed string.
 */
function clean(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Build one `- [name](url): notes` list line, omitting the `: notes` tail when
 * there's no description.
 * @param name - Link text.
 * @param url - Absolute URL.
 * @param notes - Optional trailing description.
 * @returns Formatted markdown list item.
 */
function item(name: string, url: string, notes?: string): string {
  const n = clean(notes);
  return n ? `- [${clean(name)}](${url}): ${n}` : `- [${clean(name)}](${url})`;
}

export const prerender = true;

export const GET: RequestHandler = () => {
  const supported = getSupportedLanguages();
  const lang = siteConfig.defaultLanguage || supported[0] || "es";
  const i18n = getSiteI18n(lang);

  const out: string[] = [];

  // --- H1 + summary (required + recommended by the spec) ---------------------
  out.push(`# ${clean(siteConfig.name)}`, "");
  if (i18n.description) out.push(`> ${clean(i18n.description)}`, "");

  // Free-form context paragraph: role + canonical URL + which locale this file
  // is written in (so a consumer knows the URLs are the default-lang variants).
  const langList = supported.map((l) => l.toUpperCase()).join(" / ");
  const ctx = [
    i18n.jobTitle ? `${clean(i18n.jobTitle)}.` : "",
    `Canonical site: ${SITE_URL}. Available in ${langList}; the links below are the ${lang.toUpperCase()} versions.`,
  ]
    .filter(Boolean)
    .join(" ");
  out.push(ctx, "");

  // --- Classify top-level pages ----------------------------------------------
  // getPageSlugMap is id→slug (active pages only). The map is keyed by file id,
  // so getPageData is looked up by id; the URL uses the slug. The home page is
  // the H1 above, and the writing/portfolio listing pages get their own
  // sections below — everything else lands under "## Pages".
  const slugMap = getPageSlugMap(lang);
  const pageLines: string[] = [];
  // Home first — the canonical entry point.
  pageLines.push(item("Home", `${SITE_URL}${getHomePath(lang)}`, clean(siteConfig.name)));
  for (const [id, slug] of slugMap) {
    if (id === siteConfig.homePage || id === SECTION_WRITING || id === SECTION_PORTFOLIO) continue;
    const data = getPageData(id, lang);
    if (!data) continue;
    pageLines.push(item(data.title || slug, `${SITE_URL}/${lang}/${slug}/`, data.subtitle));
  }
  if (pageLines.length) out.push("## Pages", ...pageLines, "");

  // --- Writing posts ---------------------------------------------------------
  const posts = getWritingPosts(lang);
  if (posts.length) {
    const sectionTitle = getPageData(SECTION_WRITING, lang)?.title || "Writing";
    const base = getWritingBasePath(lang); // e.g. /es/escritos/
    const lines: string[] = [];
    for (const p of posts) {
      const m = p.date.match(/^(\d{4})-(\d{2})/);
      if (!m) continue; // mirror sitemap: skip posts with an unparseable date
      const url = `${SITE_URL}${base}${m[1]}/${m[2]}/${p.slug}/`;
      const notes = [clean(p.summary), p.date ? `(${p.date})` : ""].filter(Boolean).join(" ");
      lines.push(item(p.title || p.slug, url, notes));
    }
    if (lines.length) out.push(`## ${clean(sectionTitle)}`, ...lines, "");
  }

  // --- Portfolio albums ------------------------------------------------------
  const albums = getPortfolio(lang);
  if (albums.length) {
    const sectionTitle = getPageData(SECTION_PORTFOLIO, lang)?.title || "Portfolio";
    const base = getPagePath(SECTION_PORTFOLIO, lang); // e.g. /es/portafolio/
    const lines = albums.map((a) =>
      item(a.title || a.slug, `${SITE_URL}${base}${a.slug}/`, a.description || a.tags.join(", ")),
    );
    out.push(`## ${clean(sectionTitle)}`, ...lines, "");
  }

  // --- Optional: machine-readable feeds + the other locale -------------------
  // Per the spec, "## Optional" holds links a consumer can skip for a shorter
  // context window. We put the sitemap, per-language feeds, and the alternate
  // locale's home here.
  const optional: string[] = [
    item("Sitemap", `${SITE_URL}/sitemap.xml`, "All indexable URLs (XML)"),
    item("RSS feed", `${SITE_URL}/${lang}/rss.xml`, "Writing posts (RSS 2.0)"),
    item("Atom feed", `${SITE_URL}/${lang}/atom.xml`, "Writing posts (Atom 1.0)"),
  ];
  if (supported.length === 2) {
    const alt = getAlternateLanguage(lang);
    optional.push(
      item(
        `${alt.toUpperCase()} version`,
        `${SITE_URL}${getHomePath(alt)}`,
        `Same site in ${alt.toUpperCase()}`,
      ),
    );
  }
  out.push("## Optional", ...optional, "");

  // Single trailing newline.
  const body = out.join("\n").replace(/\n+$/, "") + "\n";

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
