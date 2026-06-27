import type { RequestHandler } from "./$types";
import { getPortfolio, getWritingPosts, getEducation, getExperience, getMedia } from "$lib/data";
import { siteConfig, getSupportedLanguages } from "$lib/config";
import {
  getPagePath,
  getHomePath,
  getEquivalentPath,
  getAllPageEntries,
  SECTION_WRITING,
  SECTION_PORTFOLIO,
} from "$lib/routes";

const SITE_URL = siteConfig.url;

interface SitemapImage {
  src: string;
  title?: string | undefined;
  caption?: string | undefined;
}

interface SitemapVideo {
  title: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
}

function escXml(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function imageTag(img: SitemapImage): string {
  const url = img.src.startsWith("http") ? img.src : `${SITE_URL}${img.src}`;
  let tag = `      <image:image>\n        <image:loc>${escXml(url)}</image:loc>`;
  if (img.title) tag += `\n        <image:title>${escXml(img.title)}</image:title>`;
  if (img.caption) tag += `\n        <image:caption>${escXml(img.caption)}</image:caption>`;
  tag += `\n      </image:image>`;
  return tag;
}

function videoTag(video: SitemapVideo): string {
  return `      <video:video>
        <video:thumbnail_loc>${escXml(video.thumbnailUrl)}</video:thumbnail_loc>
        <video:title>${escXml(video.title)}</video:title>
        <video:description>${escXml(video.description)}</video:description>
        <video:content_loc>${escXml(video.contentUrl)}</video:content_loc>
      </video:video>`;
}

function urlEntry(
  loc: string,
  changefreq: string,
  priority: string,
  images: SitemapImage[] = [],
  videos: SitemapVideo[] = [],
  lastmod?: string,
  hreflangAlts?: { lang: string; href: string }[],
): string {
  const imageTags = images.map(imageTag).join("\n");
  const videoTags = videos.map(videoTag).join("\n");
  const hreflangTags = (hreflangAlts ?? [])
    .map(
      (a) => `      <xhtml:link rel="alternate" hreflang="${a.lang}" href="${escXml(a.href)}" />`,
    )
    .join("\n");
  const extras = [imageTags, videoTags, hreflangTags].filter(Boolean).join("\n");
  const extrasBlock = extras ? `\n${extras}` : "";
  const lastmodBlock = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>
    <loc>${escXml(loc)}</loc>${lastmodBlock}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${extrasBlock}
  </url>`;
}

/**
 * Extract every `![alt](src)` image from a post body. Used to enrich writing
 * post entries with the in-body images they reference.
 * @param lang - Language code to load writing posts for.
 * @returns Map of post slug → ordered image refs.
 */
function getWritingImagesByLang(lang: string): Map<string, SitemapImage[]> {
  const map = new Map<string, SitemapImage[]>();
  const imageRe = /!\[((?:\\\]|[^\]])*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const post of getWritingPosts(lang)) {
    const matches = [...post.body.matchAll(imageRe)];
    map.set(
      post.slug,
      matches.map((m) => ({
        src: m[2]!,
        title: m[1] ? m[1].replace(/\\(.)/g, "$1") : undefined,
      })),
    );
  }
  return map;
}

// Default per-page priorities. Pages not listed default to STD_PRIORITY.
// Section pages (writing/portfolio listings) get a bump because they're
// content-rich hubs; deep pages (posts/albums) get the default.
const STD_PRIORITY = "0.7";
const STD_CHANGEFREQ = "monthly";
const PRIORITY_OVERRIDES: Record<string, { priority: string; changefreq: string }> = {
  [siteConfig.homePage]: { priority: "1.0", changefreq: STD_CHANGEFREQ },
  [SECTION_PORTFOLIO]: { priority: "0.9", changefreq: "weekly" },
  [SECTION_WRITING]: { priority: "0.7", changefreq: STD_CHANGEFREQ },
};

export const prerender = true;

export const GET: RequestHandler = () => {
  const supported = getSupportedLanguages();
  const defaultLang = siteConfig.defaultLanguage || supported[0] || "es";

  // Default-locale data is the source of truth for the page table; the
  // other locale's slug maps + post pairings are resolved on demand below.
  const defLang = defaultLang;
  const portfolio = getPortfolio(defLang);
  const writingDef = getWritingPosts(defLang);
  const writingByLang = new Map<string, ReturnType<typeof getWritingPosts>>();
  const portfolioByLang = new Map<string, ReturnType<typeof getPortfolio>>();
  for (const l of supported) {
    writingByLang.set(l, getWritingPosts(l));
    portfolioByLang.set(l, getPortfolio(l));
  }

  const writingImagesByLang = new Map<string, ReturnType<typeof getWritingImagesByLang>>();
  for (const l of supported) writingImagesByLang.set(l, getWritingImagesByLang(l));

  // ---------------------------------------------------------------------------
  // Site-wide image collections used on a couple of landing pages. Sources are
  // siteConfig fields so a fork's hero + portrait flow through without code edits.
  // ---------------------------------------------------------------------------
  const portfolioCovers: SitemapImage[] = portfolio.flatMap((a) => {
    const cover = a.photos.find((p) => p.src === a.coverSrc) ?? a.photos[0];
    return cover ? [{ src: cover.src, title: a.title, caption: cover.alt }] : [];
  });

  const lcpHeroImage = (siteConfig as { lcpHeroImage?: string }).lcpHeroImage || "";
  const homeImages: SitemapImage[] = [
    ...(lcpHeroImage ? [{ src: lcpHeroImage, title: siteConfig.name }] : []),
    ...portfolioCovers.slice(0, 6),
  ];

  const personImage =
    (siteConfig as { personImage?: string }).personImage || siteConfig.favicon || "";
  const education = getEducation(defLang);
  const experience = getExperience(defLang);
  const aboutLogos: SitemapImage[] = [
    ...education.filter((e) => e.logo).map((e) => ({ src: e.logo, title: e.institution })),
    ...experience.filter((e) => e.logo).map((e) => ({ src: e.logo, title: e.organization })),
  ];
  const seenLogos = new Set<string>();
  const uniqueAboutLogos = aboutLogos.filter((img) => {
    if (seenLogos.has(img.src)) return false;
    seenLogos.add(img.src);
    return true;
  });
  const aboutImages: SitemapImage[] = [
    ...(personImage ? [{ src: personImage, title: siteConfig.author || siteConfig.name }] : []),
    ...uniqueAboutLogos,
  ];

  const media = getMedia(defLang);
  const mediaVideos: SitemapVideo[] = media
    .filter((m) => m.youtubeId)
    .map((m) => ({
      title: m.title,
      description: m.description,
      thumbnailUrl: m.thumbnail || `https://img.youtube.com/vi/${m.youtubeId}/hqdefault.jpg`,
      contentUrl: `https://www.youtube.com/watch?v=${m.youtubeId}`,
    }));
  const mediaThumbnails: SitemapImage[] = media
    .filter((m) => m.thumbnail)
    .map((m) => ({ src: m.thumbnail!, title: m.title, caption: m.description }));

  const allPortfolioPhotos: SitemapImage[] = portfolio.flatMap((a) =>
    a.photos.map((p) => ({ src: p.src, title: p.alt, caption: p.alt })),
  );

  // Map page-id → image bundle attached to that page's sitemap entry. Page
  // ids that aren't keyed here get an empty image list (still valid sitemap).
  // Keys reference the configured section ids so a renamed section keeps
  // its image attachment.
  const imagesByPageId: Record<string, { images?: SitemapImage[]; videos?: SitemapVideo[] }> = {
    [siteConfig.homePage]: { images: homeImages },
    [SECTION_PORTFOLIO]: { images: allPortfolioPhotos },
    ...(siteConfig.homePage === "inicio" ? {} : {}), // no-op slot to keep types simple
  };
  // The "about" / "media" pages aren't always configured by id at the site
  // level; attach images to anything tagged with a known collection in its
  // page id pattern. Skip when the page isn't present in the data.
  const ABOUT_PAGE_HINTS = ["sobre-mi", "about"];
  const MEDIA_PAGE_HINTS = ["medios", "media"];
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Page-level lastmod hints. Writing-list shows the latest post date so
  // crawlers see content freshness without re-fetching the listing every day.
  // ---------------------------------------------------------------------------
  const latestWritingDate = writingDef.reduce((latest, w) => {
    const candidate = w.updatedDate || w.date;
    return candidate > latest ? candidate : latest;
  }, "");

  /**
   * Build the hreflang alternates for a page given its path in EVERY supported
   * language. `x-default` always points at the default-language URL so two
   * sites with different defaults emit non-contradictory annotations.
   * @param pathByLang - Map of language code → path for this page.
   * @returns Array of hreflang alternates ready for the sitemap.
   */
  function hreflangFor(pathByLang: Map<string, string>): { lang: string; href: string }[] {
    const alts: { lang: string; href: string }[] = [];
    for (const [code, p] of pathByLang) {
      alts.push({ lang: code, href: `${SITE_URL}${p}` });
    }
    const defaultPath = pathByLang.get(defaultLang) ?? pathByLang.values().next().value;
    if (defaultPath) alts.push({ lang: "x-default", href: `${SITE_URL}${defaultPath}` });
    return alts;
  }

  const entries: string[] = [];

  // 1) Top-level page entries. Use getAllPageEntries() as the source of truth
  //    (it already excludes the home page id), then add `/` + every
  //    `/<lang>/` home explicitly.
  for (const lang of supported) {
    const homePath = getHomePath(lang);
    const altPathByLang = new Map<string, string>();
    for (const l of supported) altPathByLang.set(l, getHomePath(l));
    const meta = PRIORITY_OVERRIDES[siteConfig.homePage] ?? {
      priority: STD_PRIORITY,
      changefreq: STD_CHANGEFREQ,
    };
    entries.push(
      urlEntry(
        `${SITE_URL}${homePath}`,
        meta.changefreq,
        meta.priority,
        homeImages,
        [],
        undefined,
        hreflangFor(altPathByLang),
      ),
    );
  }

  // Track page ids we've already emitted (writing/portfolio listings get
  // attached image collections; we want them in the page table but emit
  // them through the per-page loop so their priorities resolve correctly).
  const allEntries = getAllPageEntries();
  // Group by `pageId` (first slug segment) so we pair languages together
  // and emit one URL per lang with shared hreflang alternates.
  type Grouped = { pageId: string; perLang: Map<string, string>; isDeep: boolean };
  const grouped = new Map<string, Grouped>();
  for (const e of allEntries) {
    const segs = e.slug.split("/");
    const pageId = segs[0]!;
    const key = `${pageId}::${segs.slice(1).join("/")}`;
    let g = grouped.get(key);
    if (!g) {
      g = { pageId, perLang: new Map(), isDeep: segs.length > 1 };
      grouped.set(key, g);
    }
    g.perLang.set(e.lang, `/${e.lang}/${e.slug}/`);
  }

  for (const [, group] of grouped) {
    const meta = PRIORITY_OVERRIDES[group.pageId] ?? {
      priority: group.isDeep ? "0.6" : STD_PRIORITY,
      changefreq: group.isDeep ? "yearly" : STD_CHANGEFREQ,
    };
    const attached = imagesByPageId[group.pageId] ?? {};
    let images = attached.images ?? [];
    const videos = attached.videos ?? [];

    // Attach about / media collections based on slug hint (so renamed
    // pages like "about" / "sobre-mi" still get their image bundles).
    if (!images.length && ABOUT_PAGE_HINTS.includes(group.pageId)) images = aboutImages;
    let effectiveVideos = videos;
    if (!images.length && MEDIA_PAGE_HINTS.includes(group.pageId)) {
      images = mediaThumbnails;
      effectiveVideos = mediaVideos;
    }

    // Per-album cover image (deep portfolio path: `<sectionId>/<slug>`).
    let lastmod: string | undefined;
    let perAlbumImages: SitemapImage[] | undefined;
    let perPostImages: SitemapImage[] | undefined;
    if (group.isDeep && group.pageId === SECTION_PORTFOLIO) {
      // group.perLang.values() are paths like /es/portafolio/<slug>/ — strip to slug.
      const defaultPath = group.perLang.get(defaultLang);
      const slug = defaultPath?.split("/").filter(Boolean).slice(-1)[0];
      const album = portfolio.find((a) => a.slug === slug);
      if (album) {
        const cover = album.photos.find((p) => p.src === album.coverSrc) ?? album.photos[0];
        perAlbumImages = cover ? [{ src: cover.src, title: album.title, caption: cover.alt }] : [];
        lastmod = album.date || undefined;
      }
    }
    if (group.isDeep && group.pageId === SECTION_WRITING) {
      // Path: /<lang>/<writingId>/<year>/<month>/<slug>/
      const defaultPath = group.perLang.get(defaultLang);
      const parts = defaultPath?.split("/").filter(Boolean) ?? [];
      const slug = parts[4];
      const post = writingDef.find((p) => p.slug === slug);
      if (post) {
        perPostImages = (writingImagesByLang.get(defaultLang)?.get(post.slug) ?? []).map((img) => ({
          ...img,
          caption: img.caption || post.title,
        }));
        lastmod = post.updatedDate || post.date;
      }
    }
    if (group.pageId === SECTION_WRITING && !group.isDeep && latestWritingDate) {
      lastmod = latestWritingDate;
    }

    const finalImages = perAlbumImages ?? perPostImages ?? images;

    for (const [, p] of group.perLang) {
      entries.push(
        urlEntry(
          `${SITE_URL}${p}`,
          meta.changefreq,
          meta.priority,
          finalImages,
          effectiveVideos,
          lastmod,
          hreflangFor(group.perLang),
        ),
      );
    }
  }

  // 2) Sitemap extras (standalone URLs not represented as pages — e.g. a
  //    downloadable PDF the site links to but doesn't render as a page).
  //    Reads from `sitio.json#sitemapExtras` so a fork can add/remove
  //    standalone URLs without editing this module. After the defaults
  //    merge the field is always an array (empty by default).
  const extras = siteConfig.sitemapExtras.filter(Boolean);
  for (const extra of extras) {
    entries.push(
      `  <url>
    <loc>${escXml(extra.startsWith("http") ? extra : `${SITE_URL}${extra}`)}</loc>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>`,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
    xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
    xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
};

// Suppress unused-helper warnings on these — they're available for callers
// who want them but the new derived-from-data flow uses them implicitly via
// `getAllPageEntries()` and `getPagePath()`. Kept exported through
// `$lib/routes` for the rest of the codebase.
void getPagePath;
void getEquivalentPath;
