<script lang="ts">
  import SEO from "$lib/components/SEO.svelte";
  import PageTemplate from "$lib/components/templates/PageTemplate.svelte";
  import WritingsTemplate from "$lib/components/templates/WritingsTemplate.svelte";
  import PortfolioTemplate from "$lib/components/templates/PortfolioTemplate.svelte";
  import WritingPostTemplate from "$lib/components/templates/WritingPostTemplate.svelte";
  import AlbumTemplate from "$lib/components/templates/AlbumTemplate.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import {
    resolvePageSlug,
    getPagePath,
    getEquivalentPath,
    isWritingSection,
    isPortfolioSection,
  } from "$lib/routes";
  import { getPageData } from "$lib/data";
  import { getAlternateLanguage } from "$lib/config";
  import { t } from "$lib/i18n";

  interface Props {
    data: { slug: string };
  }

  let { data }: Props = $props();

  let lang = $derived(getLang());
  let segments = $derived(data.slug.split("/").filter(Boolean));
  let firstSegment = $derived(segments[0] ?? "");

  let pageSlug = $derived(resolvePageSlug(firstSegment, lang));
  let pageData = $derived(pageSlug ? getPageData(pageSlug, lang) : undefined);

  let isWritingPost = $derived(isWritingSection(pageSlug) && segments.length === 4);
  let isAlbumPage = $derived(isPortfolioSection(pageSlug) && segments.length === 2);

  let writingYear = $derived(isWritingPost ? segments[1]! : "");
  let writingMonth = $derived(isWritingPost ? segments[2]! : "");
  let writingSlug = $derived(isWritingPost ? segments[3]! : "");
  let albumSlug = $derived(isAlbumPage ? segments[1]! : "");

  let currentPath = $derived(getPagePath(pageSlug ?? "", lang));
  let alternatePath = $derived(getEquivalentPath(currentPath, getAlternateLanguage(lang)));
  let notFoundLabel = $derived(t(lang, "error.notFoundTitle"));
</script>

{#if !pageData || !pageData.active}
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
    <h1 class="text-2xl font-bold mb-4">404</h1>
    <p class="text-muted dark:text-muted-dark">{notFoundLabel}</p>
  </div>
{:else if isWritingPost}
  <WritingPostTemplate year={writingYear} month={writingMonth} slug={writingSlug} />
{:else if isAlbumPage}
  <AlbumTemplate {albumSlug} />
{:else if isWritingSection(pageData.template)}
  <SEO
    title={pageData.title}
    description={pageData.ogDescription || undefined}
    path={currentPath}
    image={pageData.ogImage || undefined}
    {alternatePath}
  />
  <WritingsTemplate {pageData} />
{:else if isPortfolioSection(pageData.template)}
  <SEO
    title={pageData.title}
    description={pageData.ogDescription || undefined}
    path={currentPath}
    image={pageData.ogImage || undefined}
    {alternatePath}
  />
  <PortfolioTemplate {pageData} />
{:else}
  <SEO
    title={pageData.title}
    description={pageData.ogDescription || undefined}
    path={currentPath}
    image={pageData.ogImage || undefined}
    {alternatePath}
  />
  <PageTemplate {pageData} />
{/if}
