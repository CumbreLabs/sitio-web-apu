<script lang="ts">
  import { ArrowLeft } from "lucide-svelte";
  import SEO from "$lib/components/SEO.svelte";
  import Redirect from "$lib/components/widgets/Redirect.svelte";
  import TagList from "$lib/components/widgets/TagList.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { t } from "$lib/i18n";
  import { getPagePath, SECTION_PORTFOLIO } from "$lib/routes";
  import { siteConfig, portfolioConfig, getAlternateLanguage } from "$lib/config";
  import Picture from "$lib/components/media/Picture.svelte";
  import { getAlbumBySlug, getAlbumByFileId, getPageData } from "$lib/data";
  import { page } from "$app/stores";

  interface Props {
    albumSlug: string;
  }

  let { albumSlug }: Props = $props();

  let lang = $derived(getLang());
  let album = $derived(getAlbumBySlug(albumSlug, lang));
  let portfolioPath = $derived(getPagePath(SECTION_PORTFOLIO, lang));

  // Pair EN ↔ ES by album `id` (filename) since album slugs differ per language
  // (e.g. /en/portfolio/handstand/ ↔ /es/portafolio/parada-de-manos/). Without
  // this, hreflang + x-default would all collapse to the listing page and the
  // canonical/og:url would fall back to "/".
  let altLang = $derived(getAlternateLanguage(lang));
  let altPortfolioPath = $derived(getPagePath(SECTION_PORTFOLIO, altLang));
  let altAlbum = $derived(album ? getAlbumByFileId(album.id, altLang) : undefined);
  let alternatePath = $derived(
    altAlbum ? `${altPortfolioPath}${altAlbum.slug}/` : altPortfolioPath,
  );

  let albumJsonLd = $derived(
    album
      ? {
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          name: album.title,
          description: album.description,
          image: album.photos.map((photo) => ({
            "@type": "ImageObject",
            contentUrl: `${siteConfig.url}${photo.src}`,
            name: photo.alt,
            creator: { "@type": "Person", name: siteConfig.name },
            copyrightNotice: siteConfig.name,
            creditText: siteConfig.name,
          })),
        }
      : undefined,
  );

  // Home → Portfolio → Album breadcrumb for SERP display + crawler clarity.
  // Breadcrumb labels come from the corresponding paginas markdown's `title`
  // frontmatter so they're naturally per-locale, editable via the CMS, and
  // don't carry in-code language ternaries. Fall back to siteConfig.name
  // for Home + the album title for Portfolio if the data is missing.
  let homePageData = $derived(
    siteConfig.homePage ? getPageData(siteConfig.homePage, lang) : undefined,
  );
  let portfolioPageData = $derived(
    portfolioConfig.portfolioPageId
      ? getPageData(portfolioConfig.portfolioPageId, lang)
      : undefined,
  );
  let breadcrumbJsonLd = $derived(
    album
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: homePageData?.title || siteConfig.name,
              item: `${siteConfig.url}/${lang}/`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: portfolioPageData?.title || album.title,
              item: `${siteConfig.url}${portfolioPath}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: album.title,
              item: `${siteConfig.url}${$page.url.pathname}`,
            },
          ],
        }
      : undefined,
  );

  const CLOSING_SCRIPT_RE = new RegExp("<" + "/", "g");
  let breadcrumbScript = $derived(
    breadcrumbJsonLd
      ? JSON.stringify(breadcrumbJsonLd).replace(CLOSING_SCRIPT_RE, "<\\/")
      : undefined,
  );
</script>

<svelte:head>
  {#if breadcrumbScript}
    {@html `<script type="application/ld+json">${breadcrumbScript}</` + "script>"}
  {/if}
</svelte:head>

{#if !album}
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
    <h1 class="text-2xl font-bold mb-4">{t(lang, "portfolio.albumNotFound")}</h1>
    <a
      href={portfolioPath}
      class="font-sans text-sm text-accent dark:text-accent-dark hover:underline"
    >
      &larr; {t(lang, "portfolio.backToPortfolio")}
    </a>
  </div>
{:else if album.redirectUrl}
  <Redirect url={album.redirectUrl} />
{:else}
  <SEO
    title={album.title}
    description={album.ogDescription || album.description || undefined}
    image={album.ogImage || album.coverSrc || undefined}
    path={$page.url.pathname}
    {alternatePath}
    jsonLd={albumJsonLd}
  />

  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-12">
    <a
      href={portfolioPath}
      class="inline-flex items-center gap-1 font-sans text-sm text-muted hover:text-accent dark:text-muted-dark dark:hover:text-accent-dark mb-8 transition-colors"
    >
      <ArrowLeft size={14} />
      {t(lang, "portfolio.backToPortfolio")}
    </a>

    <article aria-labelledby="album-title">
      <header>
        <h1 id="album-title" class="font-serif text-3xl font-bold mb-2">{album.title}</h1>
        {#if album.description}
          <p class="font-sans text-muted dark:text-muted-dark mb-4">{album.description}</p>
        {/if}
        <TagList tags={album.tags} variant="surface" class="mb-8" />
      </header>

      <div class="flex flex-wrap justify-center gap-4">
        {#each album.photos as photo, i (photo.src)}
          <div class="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] overflow-hidden">
            <!--
              First photo is the LCP element on album pages — measured at
              ~2.5-3 s LCP across 26 reports because it was inheriting
              `loading="lazy"` from Picture's default. Eager + fetchpriority
              tells the browser to start fetching it during HTML parse
              instead of after layout, knocking ~1 s off LCP. Subsequent
              photos stay lazy so they don't compete for bandwidth above
              the fold.
            -->
            <Picture
              src={photo.src}
              alt={photo.alt}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              imgClass="w-full h-auto object-cover"
              loading={i === 0 ? "eager" : "lazy"}
              fetchpriority={i === 0 ? "high" : undefined}
            />
          </div>
        {/each}
      </div>
    </article>
  </div>
{/if}
