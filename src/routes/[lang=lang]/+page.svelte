<script lang="ts">
  import SEO from "$lib/components/SEO.svelte";
  import PageTemplate from "$lib/components/templates/PageTemplate.svelte";
  import WritingsTemplate from "$lib/components/templates/WritingsTemplate.svelte";
  import PortfolioTemplate from "$lib/components/templates/PortfolioTemplate.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { siteConfig } from "$lib/config";
  import { isWritingSection, isPortfolioSection } from "$lib/routes";
  import { getPageData } from "$lib/data";

  let lang = $derived(getLang());
  let pageData = $derived(getPageData(siteConfig.homePage, lang));

  let homeJsonLd = $derived({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: siteConfig.name,
    url: `${siteConfig.url}/${lang}/`,
  });
</script>

{#if pageData}
  <SEO path="/{lang}/" jsonLd={homeJsonLd} />
  {#if isWritingSection(pageData.template)}
    <WritingsTemplate {pageData} />
  {:else if isPortfolioSection(pageData.template)}
    <PortfolioTemplate {pageData} />
  {:else}
    <PageTemplate {pageData} />
  {/if}
{/if}
