<script lang="ts">
  import AlbumCard from "$lib/components/cards/AlbumCard.svelte";
  import Hero from "$lib/components/chrome/Hero.svelte";
  import FilterButton from "$lib/components/widgets/FilterButton.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { t } from "$lib/i18n";
  import { seoConfig, portfolioConfig } from "$lib/config";
  import { getPortfolio } from "$lib/data";
  import type { PageData } from "$lib/data";

  // Match the augmented shape `getPortfolio` returns (PortfolioAlbumFlat
  // + the runtime-injected `id` from the JSON filename). Importing the
  // inferred type avoids re-declaring the augmentation here.
  type Album = ReturnType<typeof getPortfolio>[number];

  interface Props {
    pageData: PageData;
  }

  let { pageData }: Props = $props();

  // Album sort mode from `portafolio.json#defaultSort`. Three modes:
  //   "manual"   (default): use the order from the JSON / glob (editor-controlled)
  //   "name-asc"          : alphabetical by album title
  //   "name-desc"         : reverse alphabetical
  // Future modes ("date-desc" once album dates are first-class, "featured-first")
  // land here; the sort fn is pure so adding cases is a one-line change.
  type AlbumSort = "manual" | "name-asc" | "name-desc";
  const SORT_MODE: AlbumSort = portfolioConfig.defaultSort;
  // Initial filter chip selection. `"all"` shows every album; any other value
  // must match a real tag in the dataset to pre-select that chip on first
  // paint. If the configured tag doesn't exist, falls through to "all" below.
  const INITIAL_FILTER = portfolioConfig.defaultFilter;

  /**
   * Apply the configured sort mode to an album list. Returns a new array so
   * callers can chain with `.filter()` safely.
   * @param list - Albums to sort.
   * @returns Sorted copy.
   */
  function sortAlbums(list: Album[]): Album[] {
    const copy = list.slice();
    if (SORT_MODE === "name-asc") {
      return copy.sort((a, b) => a.title.localeCompare(b.title, lang));
    }
    if (SORT_MODE === "name-desc") {
      return copy.sort((a, b) => b.title.localeCompare(a.title, lang));
    }
    return copy; // "manual" — preserve glob/JSON order
  }

  let lang = $derived(getLang());
  let albums = $derived(sortAlbums(getPortfolio(lang)));
  let bgImage = $derived(pageData.backgroundImage || seoConfig.defaultBackgroundImage);
  let hasHero = $derived(!!bgImage);

  let allTags = $derived.by(() => {
    const set = new Set<string>();
    for (const album of albums) {
      for (const tag of album.tags) set.add(tag);
    }
    return Array.from(set).sort();
  });

  // Initialize the active filter from config, falling back to "all" if the
  // configured tag doesn't exist in the current dataset (e.g. a fork sets
  // `defaultFilter: "landscape"` but the EN locale has no landscape album).
  let activeTag = $state<string>(
    INITIAL_FILTER !== "all" && !allTagsContains(INITIAL_FILTER) ? "all" : INITIAL_FILTER,
  );

  /**
   * Check if a tag exists in the current albums set. Used to validate the
   * configured `defaultFilter` against actual data before pre-selecting it.
   * @param tag - Tag to test.
   * @returns Whether any album carries this tag.
   */
  function allTagsContains(tag: string): boolean {
    for (const album of getPortfolio(lang)) {
      if (album.tags.includes(tag)) return true;
    }
    return false;
  }

  let filtered = $derived(
    activeTag === "all" ? albums : albums.filter((a) => a.tags.includes(activeTag)),
  );
</script>

{#if hasHero}
  <Hero title={pageData.title} backgroundImage={bgImage} />
{/if}

<div class="max-w-5xl mx-auto px-4 sm:px-6 py-16">
  {#if !hasHero}
    <h1 class="font-serif text-4xl font-bold mb-8">{pageData.title}</h1>
  {/if}
  <div class="flex flex-wrap gap-2 mb-10">
    <FilterButton
      label={t(lang, "portfolio.all")}
      isActive={activeTag === "all"}
      onClick={() => (activeTag = "all")}
    />
    {#each allTags as tag (tag)}
      <FilterButton label={tag} isActive={activeTag === tag} onClick={() => (activeTag = tag)} />
    {/each}
  </div>

  <!--
    Screen-reader-only filter result count. `aria-live="polite"` announces a
    fresh "N albums shown" after every filter chip click without yanking
    focus. Always-rendered (even when the count is 0) so the live region
    has a stable node identity — re-creating the region per filter would
    miss the announcement entirely on some screen readers.
  -->
  <span class="sr-only" aria-live="polite" aria-atomic="true">
    {t(lang, "portfolio.filterResultCount", { count: filtered.length })}
  </span>

  {#if filtered.length === 0}
    <p class="text-muted dark:text-muted-dark text-center py-12">
      {t(lang, "portfolio.noResults")}
    </p>
  {:else}
    <div class="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
      {#each filtered as album (album.id)}
        <div class="break-inside-avoid">
          <AlbumCard {album} />
        </div>
      {/each}
    </div>
  {/if}
</div>
