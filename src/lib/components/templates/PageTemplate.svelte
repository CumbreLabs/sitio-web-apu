<script lang="ts">
  import CollectionRenderer from "$lib/components/collections/CollectionRenderer.svelte";
  import MarkdownRenderer from "$lib/components/media/MarkdownRenderer.svelte";
  import Hero from "$lib/components/chrome/Hero.svelte";
  import Redirect from "$lib/components/widgets/Redirect.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { setSidebarItems, setSidebarContentMaxWidth } from "$lib/stores/sidebar.svelte";
  import { seoConfig } from "$lib/config";
  import {
    getAboutHeaderTitle,
    getEducationTitle,
    getExperienceTitle,
    getAwardsTitle,
    getVolunteeringTitle,
    getLanguagesTitle,
    getSoftwareTitle,
    getFeaturedAlbumsTitle,
    getFeaturedWritingsTitle,
    getProjectsTitle,
    getRecommendationsTitle,
  } from "$lib/data";
  import type { PageData } from "$lib/data";

  interface Props {
    pageData: PageData;
  }

  let { pageData }: Props = $props();

  let lang = $derived(getLang());

  function buildSidebarItems(
    collections: string[],
    currentLang: string,
  ): { id: string; label: string }[] {
    const map: Record<string, { id: string; label: string }[]> = {
      encabezado: [{ id: "bio", label: getAboutHeaderTitle(currentLang) }],
      educacion: [{ id: "education", label: getEducationTitle(currentLang) }],
      experiencia: [{ id: "experience", label: getExperienceTitle(currentLang) }],
      premios: [{ id: "awards", label: getAwardsTitle(currentLang) }],
      voluntariado: [{ id: "volunteering", label: getVolunteeringTitle(currentLang) }],
      idiomas: [{ id: "languages", label: getLanguagesTitle(currentLang) }],
      software: [{ id: "software", label: getSoftwareTitle(currentLang) }],
      // anchor IDs match the `id="..."` on each section's wrapper element so
      // the sidebar's smooth-scroll lands at the right spot.
      "albumes-destacados": [{ id: "featured-albums", label: getFeaturedAlbumsTitle(currentLang) }],
      "escritos-destacados": [
        { id: "featured-writings", label: getFeaturedWritingsTitle(currentLang) },
      ],
      "proyectos-destacados": [{ id: "featured-projects", label: getProjectsTitle(currentLang) }],
      recomendaciones: [{ id: "recommendations", label: getRecommendationsTitle(currentLang) }],
    };
    return collections.flatMap((name) => map[name] || []);
  }

  $effect(() => {
    // `settings.sidebar: false` in the paginas markdown frontmatter hides
    // the right-side TOC for this page (per-page opt-out). Default behavior
    // is unchanged when the field is absent — every page gets a sidebar
    // built from its collection-section anchors.
    const items = pageData.sidebar === false ? [] : buildSidebarItems(pageData.collections, lang);
    setSidebarItems(items);
    if (items.length > 0) {
      setSidebarContentMaxWidth("48rem");
    }
    return () => setSidebarItems([]);
  });

  let bgImage = $derived(pageData.backgroundImage || seoConfig.defaultBackgroundImage);
  let hasHero = $derived(!!bgImage);
  let activeCollections = $derived(
    pageData.collections.filter((c) => typeof c === "string" && c.trim() !== ""),
  );
  // A "hero" collection (e.g. APU's home page) renders its own <h1> banner, so
  // the reading-column page title would be a SECOND <h1> on the page (an a11y +
  // SEO problem) and a stray visible heading. Suppress it when a hero
  // collection owns the page heading. Pages without a hero collection (e.g. the
  // privacy page) still render their title normally.
  let heroFromCollection = $derived(activeCollections.includes("hero"));
  let showPageTitle = $derived(!hasHero && !heroFromCollection && !!pageData.title);
</script>

{#if pageData.redirectUrl}
  <Redirect url={pageData.redirectUrl} />
{:else}
  {#if hasHero}
    <Hero title={pageData.title} subtitle={pageData.subtitle} backgroundImage={bgImage} />
  {/if}

  <!-- Collections render EDGE-TO-EDGE. APU's sections (hero / about / services
       / gallery / contact) are full-bleed: each owns its own inner max-width
       and full-width background band, so they must NOT be wrapped in a narrow
       reading column. -->
  {#each activeCollections as collectionName (collectionName)}
    <CollectionRenderer name={collectionName} />
  {/each}

  <!-- Page title (when there's no hero) + markdown body stay in a centered
       reading column — e.g. the privacy page's prose. -->
  {#if pageData.body || showPageTitle}
    <div class="max-w-3xl mx-auto px-6 py-16">
      {#if showPageTitle}
        <h1 class="font-sans text-3xl font-bold text-text mb-8">{pageData.title}</h1>
      {/if}
      {#if pageData.body}
        <div class="prose-blog font-sans text-text leading-relaxed">
          <MarkdownRenderer html={pageData.body} />
        </div>
      {/if}
    </div>
  {/if}
{/if}
