<script lang="ts">
  import {
    siteConfig,
    seoConfig,
    resolveTitle,
    getOgLocale,
    getAlternateLanguage,
  } from "$lib/config";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getEquivalentPath } from "$lib/routes";
  import { getSiteI18n } from "$lib/data";
  import { imgDims } from "$lib/images";
  import ogVariants from "virtual:og-manifest";

  /**
   * 1200×630 is LinkedIn's preferred landscape size for the big card layout
   * and matches what `scripts/generate-og-images.mjs` emits. Hardcoded here
   * because the variant is generated to those exact dimensions — no need
   * to round-trip through `imgDims` for the variant lookup.
   */
  const OG_VARIANT_WIDTH = 1200;
  const OG_VARIANT_HEIGHT = 630;

  interface Props {
    title?: string | undefined;
    description?: string | undefined;
    image?: string | undefined;
    imageAlt?: string | undefined;
    path?: string | undefined;
    type?: string | undefined;
    jsonLd?: Record<string, unknown> | undefined;
    alternatePath?: string | undefined;
    /** Article-only: publish date (YYYY-MM-DD) — emitted as article:published_time */
    publishedTime?: string | undefined;
    /** Article-only: modified date (YYYY-MM-DD) — emitted as article:modified_time */
    modifiedTime?: string | undefined;
    /** Article-only: section name (e.g. first tag) — emitted as article:section */
    section?: string | undefined;
    /** Article-only: tag list — emitted as repeated article:tag meta tags */
    tags?: readonly string[] | undefined;
  }

  let {
    title,
    description,
    image,
    imageAlt,
    path = "/",
    type = "website",
    jsonLd,
    alternatePath,
    publishedTime,
    modifiedTime,
    section,
    tags = [],
  }: Props = $props();

  const SITE_URL = siteConfig.url;
  const DEFAULT_TITLE = siteConfig.name;
  const DEFAULT_OG_IMAGE = seoConfig.defaultOGImage;
  // Single author for the whole site — emitted on every page as
  // `<meta name="author">`. Silences LinkedIn Post Inspector's "No author
  // found" warning on profile / about / portfolio pages where the catch-all
  // type is `website` but LinkedIn classifies the content as article-like.
  // Pulled from sitio.json's explicit `author` field so it can diverge from
  // `name` (the browser-tab + OG site_name title). `author` is REQUIRED in
  // $lib/defaults so it's always set — a fork that forgets fails at
  // build-time via check:required-config rather than silently shipping the
  // browser-tab name as the byline.
  const SITE_AUTHOR = siteConfig.author;
  // Twitter handle from `seo.json#twitterHandle`. Empty string (the default)
  // means "no twitter presence" — the meta tags are omitted entirely (see
  // the {#if TWITTER_HANDLE} branch below) rather than emitting `content=""`.
  const TWITTER_HANDLE = seoConfig.twitterHandle;

  const defaultLang = siteConfig.defaultLanguage;

  let lang = $derived(getLang());
  let alternateLang = $derived(getAlternateLanguage(lang));

  let pageTitle = $derived(title ? resolveTitle(title) : DEFAULT_TITLE);
  // Default description is per-language: pages that don't pass their own
  // description (e.g. portfolio albums with empty `ogDescription`) get the
  // locale-appropriate site bio from `configuracion/{lang}/sitio.json#description`.
  // Without this, a Spanish album with empty `ogDescription` would unfurl with
  // the English site bio on WhatsApp / Twitter / Facebook.
  let pageDescription = $derived(description || getSiteI18n(lang).description);
  // Local path of the requested OG image (before SITE_URL prefix), or the
  // default. Used to look up real pixel dimensions via `imgDims`.
  let pageImagePath = $derived.by(() => {
    if (!image) return DEFAULT_OG_IMAGE;
    if (image.startsWith("http")) return image; // remote — can't measure
    return image;
  });
  // Look up the natural dimensions for the chosen image. `imgDims` returns
  // undefined for remote URLs or anything not measured at build time. When
  // the OG image is **portrait** (taller than wide), LinkedIn refuses to
  // render the large-card layout (it strictly wants ~1.91:1 landscape) and
  // downgrades to a tiny side-thumbnail without showing the description.
  //
  // Resolution order for portrait sources:
  //   1. Prefer the precomputed `/og/{stem}.webp` variant — a 1200×630
  //      blurred self-fill of the original cover (build-time, see
  //      `scripts/generate-og-images.mjs`). Keeps the actual album/post
  //      visual identity in social cards.
  //   2. Fall back to `seoConfig.defaultOGImage` (a known landscape hero)
  //      only when no variant exists — e.g. remote images or covers added
  //      between commits before the script has run.
  let measuredImage = $derived.by(() => {
    const dims = pageImagePath.startsWith("/") ? imgDims(pageImagePath) : undefined;
    if (dims && dims[1] > dims[0]) {
      // Portrait. Try the per-image landscape variant first.
      const dot = pageImagePath.lastIndexOf(".");
      const slash = pageImagePath.lastIndexOf("/");
      const stem = dot > slash && slash >= 0 ? pageImagePath.slice(slash + 1, dot) : undefined;
      const variantPath = stem ? `/og/${stem}.webp` : undefined;
      if (variantPath && ogVariants.has(variantPath)) {
        return { path: variantPath, width: OG_VARIANT_WIDTH, height: OG_VARIANT_HEIGHT };
      }
      const fallbackDims = imgDims(DEFAULT_OG_IMAGE);
      return {
        path: DEFAULT_OG_IMAGE,
        width: fallbackDims?.[0] ?? 1200,
        height: fallbackDims?.[1] ?? 630,
      };
    }
    return {
      path: pageImagePath,
      width: dims?.[0] ?? 1200,
      height: dims?.[1] ?? 630,
    };
  });
  let pageImage = $derived(
    measuredImage.path.startsWith("http")
      ? measuredImage.path
      : `${SITE_URL}${measuredImage.path}`,
  );
  let pageImageWidth = $derived(measuredImage.width);
  let pageImageHeight = $derived(measuredImage.height);
  let pageImageAlt = $derived(imageAlt || pageTitle);
  // Derive og:image:type from the file extension. Helps crawlers (especially
  // Slack/Discord) negotiate without sniffing the file. Falls back to webp
  // since that's the project default.
  let pageImageType = $derived.by(() => {
    const ext = pageImage.toLowerCase().split("?")[0]?.split(".").pop() ?? "";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "gif") return "image/gif";
    if (ext === "avif") return "image/avif";
    return "image/webp";
  });
  let pageUrl = $derived(`${SITE_URL}${path}`);
  let ogLocale = $derived(getOgLocale(lang));
  let ogAlternateLocale = $derived(getOgLocale(alternateLang));
  let isArticle = $derived(type === "article");

  let alternateUrl = $derived.by(() => {
    if (alternatePath) return `${SITE_URL}${alternatePath}`;
    return `${SITE_URL}${getEquivalentPath(path, alternateLang)}`;
  });

  // x-default should always point to the site's default language, not flip
  // based on the current page's language (which would create contradictory
  // hreflang annotations across URLs).
  let xDefaultUrl = $derived(lang === defaultLang ? pageUrl : alternateUrl);

  // Escape `<` followed by `/` so a title or description containing the
  // closing-script sequence can't break out of the JSON-LD `<script>` tag.
  // JSON.stringify alone doesn't escape that sequence. The regex is built
  // from a String so Svelte's template parser doesn't try to read a literal
  // `<` followed by `/` as a closing tag inside this file.
  const CLOSING_SCRIPT_RE = new RegExp("<" + "/", "g");
  let jsonLdScript = $derived(
    jsonLd ? JSON.stringify(jsonLd).replace(CLOSING_SCRIPT_RE, "<\\/") : undefined,
  );
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={pageDescription} />
  <meta name="author" content={SITE_AUTHOR} />
  <link rel="canonical" href={pageUrl} />
  <link rel="alternate" hreflang={lang} href={pageUrl} />
  <link rel="alternate" hreflang={alternateLang} href={alternateUrl} />
  <link rel="alternate" hreflang="x-default" href={xDefaultUrl} />

  <meta property="og:type" content={type} />
  <meta property="og:url" content={pageUrl} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={pageDescription} />
  <meta property="og:image" content={pageImage} />
  <meta property="og:image:alt" content={pageImageAlt} />
  <meta property="og:image:type" content={pageImageType} />
  <meta property="og:image:width" content={String(pageImageWidth)} />
  <meta property="og:image:height" content={String(pageImageHeight)} />
  <meta property="og:site_name" content={SITE_AUTHOR} />
  <meta property="og:locale" content={ogLocale} />
  <meta property="og:locale:alternate" content={ogAlternateLocale} />

  {#if isArticle}
    {#if publishedTime}<meta property="article:published_time" content={publishedTime} />{/if}
    {#if modifiedTime}<meta property="article:modified_time" content={modifiedTime} />{/if}
    <meta property="article:author" content={SITE_URL} />
    {#if section}<meta property="article:section" content={section} />{/if}
    {#each tags as tag (tag)}<meta property="article:tag" content={tag} />{/each}
  {/if}

  <meta name="twitter:card" content={seoConfig.twitterCard} />
  {#if TWITTER_HANDLE}
    <meta name="twitter:site" content={TWITTER_HANDLE} />
    <meta name="twitter:creator" content={TWITTER_HANDLE} />
  {/if}
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={pageDescription} />
  <meta name="twitter:image" content={pageImage} />
  <meta name="twitter:image:alt" content={pageImageAlt} />

  {#if jsonLdScript}
    {@html `<script type="application/ld+json">${jsonLdScript}</` + "script>"}
  {/if}
</svelte:head>
