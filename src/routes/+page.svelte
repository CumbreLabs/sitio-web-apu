<script lang="ts">
  import SEO from "$lib/components/SEO.svelte";
  import PageTemplate from "$lib/components/templates/PageTemplate.svelte";
  import WritingsTemplate from "$lib/components/templates/WritingsTemplate.svelte";
  import PortfolioTemplate from "$lib/components/templates/PortfolioTemplate.svelte";
  import { siteConfig } from "$lib/config";
  import { isWritingSection, isPortfolioSection } from "$lib/routes";
  import { getPageData } from "$lib/data";

  // Root `/` mirrors the default-language home page (siteConfig.defaultLanguage +
  // siteConfig.homePage). No redirect — the same content is served at both `/` and
  // `/<defaultLang>/` so crawlers and users without a language preference get a
  // real prerendered page instead of an empty redirect shell. The active language
  // is set by the root +layout.svelte based on the URL.
  const defaultLang = siteConfig.defaultLanguage || "es";
  let pageData = $derived(getPageData(siteConfig.homePage, defaultLang));

  // Canonical points at `/<defaultLang>/` (not `/`) because both URLs serve
  // byte-identical content. Without this, Google sees two distinct pages each
  // claiming canonical-to-self — classic duplicate-content trap. Pointing both
  // at the same canonical collapses them to one indexable URL.
  const defaultHomePath = `/${defaultLang}/`;

  let homeJsonLd = $derived({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: siteConfig.name,
    url: `${siteConfig.url}${defaultHomePath}`,
  });
</script>

{#if pageData}
  <SEO path={defaultHomePath} jsonLd={homeJsonLd} />
  {#if isWritingSection(pageData.template)}
    <WritingsTemplate {pageData} />
  {:else if isPortfolioSection(pageData.template)}
    <PortfolioTemplate {pageData} />
  {:else}
    <PageTemplate {pageData} />
  {/if}
{/if}
