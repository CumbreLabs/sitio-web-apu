<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import WritingPostCard from "$lib/components/cards/WritingPostCard.svelte";
  import Hero from "$lib/components/chrome/Hero.svelte";
  import FilterButton from "$lib/components/widgets/FilterButton.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { t } from "$lib/i18n";
  import { siteConfig, seoConfig, writingConfig } from "$lib/config";
  import { gridColsClass } from "$lib/grid";
  import { getWritingPosts, sortPosts, type WritingSort } from "$lib/data";
  import type { PageData } from "$lib/data";

  interface Props {
    pageData: PageData;
  }

  let { pageData }: Props = $props();

  const types = ["all", "opinion", "report", "journal", "thesis"] as const;

  // Every knob below is resolved against DEFAULTS in $lib/config — see
  // $lib/defaults for the values that take effect when escritos.json
  // omits a field. Templates never carry `?? fallback` for config knobs.
  const PAGE_SIZE = writingConfig.writingPageSize;
  const SORT_MODE: WritingSort = writingConfig.defaultSort;
  const SHOW_FILTERS = writingConfig.showFilters;
  // Cards-per-row applies to BOTH this listing and the home
  // `escritos-destacados` collection so both layouts stay in lockstep.
  const GRID_CLASS = gridColsClass(writingConfig.cardsPerRow);

  let activeType = $state<string>("all");
  let lang = $derived(getLang());
  let posts = $derived(sortPosts(getWritingPosts(lang), SORT_MODE));
  let bgImage = $derived(pageData.backgroundImage || seoConfig.defaultBackgroundImage);
  let hasHero = $derived(!!bgImage);

  let filtered = $derived(
    activeType === "all" ? posts : posts.filter((p) => p.type === activeType),
  );

  // Current page is read from `?page=N` so deep links stay shareable and the
  // browser back button works through pagination. Page 1 is the implicit
  // default — the param is omitted from the URL to keep the canonical clean.
  //
  // The `browser` gate is required by SvelteKit's prerenderer: prerendered
  // URLs have no query string, and accessing `url.searchParams` during
  // prerender throws "Cannot access url.searchParams on a page with
  // prerendering enabled". SSR always renders page 1; the client picks up
  // the real value after hydration. The flip to page N happens in a single
  // post-hydration tick — no perceived FOUC for the prerendered base URL.
  let pageParam = $derived(browser ? $page.url.searchParams.get("page") : null);
  let requestedPage = $derived.by(() => {
    const n = pageParam ? parseInt(pageParam, 10) : 1;
    return Number.isFinite(n) && n >= 1 ? n : 1;
  });
  let totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  // Clamp to total — if a user lands on `?page=99` but the filter only has
  // 2 pages, render page 2 rather than an empty grid.
  let currentPage = $derived(Math.min(requestedPage, totalPages));
  let pageStart = $derived((currentPage - 1) * PAGE_SIZE);
  let paged = $derived(filtered.slice(pageStart, pageStart + PAGE_SIZE));
  let showPagination = $derived(filtered.length > PAGE_SIZE);

  /**
   * Navigate to a specific page. Page 1 strips the query param entirely so
   * the canonical URL stays clean. Uses `goto` with default scroll so the
   * user lands at the top of the next page's grid (standard list-paging UX).
   * @param n - Target page number (1-indexed).
   */
  function goToPage(n: number): void {
    const url = new URL($page.url);
    if (n <= 1) url.searchParams.delete("page");
    else url.searchParams.set("page", String(n));
    goto(url);
  }

  /**
   * Apply a new type filter and reset to page 1 — the previous page index
   * is likely out of range for the new filtered set.
   * @param type - Filter type id ("all" or one of the writing type enum values).
   */
  function applyFilter(type: string): void {
    activeType = type;
    goToPage(1);
  }

  /**
   * Build the absolute URL for a given page index. Page 1 omits `?page=` so
   * the canonical stays clean; pages 2..N include it. Used by `rel="prev"` /
   * `rel="next"` crawler-discovery hints. SSR returns the bare page path
   * (no query) because `$page.url` isn't query-aware during prerender.
   * @param n - Page number (1-indexed).
   * @returns Absolute URL including site origin.
   */
  function pageUrlFor(n: number): string {
    const basePath = browser
      ? $page.url.pathname
      : `/${lang}${pageData.slug ? `/${pageData.slug}/` : "/"}`;
    const qs = n <= 1 ? "" : `?page=${n}`;
    return `${siteConfig.url}${basePath}${qs}`;
  }

  // Resolved prev/next URLs for the current pagination state. Undefined when
  // pagination isn't visible or at the boundary (currentPage 1 has no prev;
  // last page has no next). Bing / Yandex / Baidu still use these for crawl
  // discovery (Google deprecated them for indexing in 2019). The base
  // canonical comes from upstream `<SEO>` and already points at the
  // un-paginated listing — Strategy A in Google's pagination guidance
  // (consolidate signals to one URL; pages 2..N drop from the index but
  // share the listing's ranking signal).
  let prevHref = $derived(
    showPagination && currentPage > 1 ? pageUrlFor(currentPage - 1) : undefined,
  );
  let nextHref = $derived(
    showPagination && currentPage < totalPages ? pageUrlFor(currentPage + 1) : undefined,
  );
</script>

<svelte:head>
  {#if prevHref}<link rel="prev" href={prevHref} />{/if}
  {#if nextHref}<link rel="next" href={nextHref} />{/if}
</svelte:head>

{#if hasHero}
  <Hero title={pageData.title} subtitle={pageData.subtitle} backgroundImage={bgImage} />
{/if}

<div class="max-w-3xl mx-auto px-4 sm:px-6 py-12">
  {#if !hasHero}
    <h1
      class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark mb-3"
    >
      {pageData.title}
    </h1>
    {#if pageData.subtitle}
      <p class="font-serif text-lg text-text dark:text-text-dark mb-10 max-w-2xl leading-relaxed">
        {pageData.subtitle}
      </p>
    {:else}
      <div class="mb-8"></div>
    {/if}
  {/if}
  {#if SHOW_FILTERS}
    <div class="flex flex-wrap gap-2 mb-8">
      {#each types as type (type)}
        <FilterButton
          label={t(lang, `writing.${type}`)}
          isActive={activeType === type}
          onClick={() => applyFilter(type)}
        />
      {/each}
    </div>

    <!--
      Screen-reader-only filter result count. `aria-live="polite"` announces a
      fresh "N posts shown" after every filter chip click. Reports `filtered`
      length (the full filtered set), NOT `paged` (current-page slice), since
      pagination already announces page-N-of-N via its own live region.
      Only rendered alongside the filter chips — when filters are hidden there
      is nothing to announce.
    -->
    <span class="sr-only" aria-live="polite" aria-atomic="true">
      {t(lang, "writing.filterResultCount", { count: filtered.length })}
    </span>
  {/if}

  {#if filtered.length === 0}
    <p class="text-muted dark:text-muted-dark text-center py-12">
      {t(lang, "writing.noResults")}
    </p>
  {:else}
    <div class="{GRID_CLASS} gap-4">
      {#each paged as post (post.slug)}
        <WritingPostCard {post} />
      {/each}
    </div>
  {/if}

  {#if showPagination}
    <nav
      aria-label={t(lang, "writing.pagination.label")}
      class="mt-12 flex items-center justify-between gap-4 font-sans text-sm"
    >
      <button
        type="button"
        onclick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        class="px-3 py-2 border border-border dark:border-border-dark hover:bg-surface dark:hover:bg-surface-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← {t(lang, "writing.pagination.newer")}
      </button>
      <span class="text-muted dark:text-muted-dark" aria-live="polite">
        {t(lang, "writing.pagination.pageXofY", {
          current: currentPage,
          total: totalPages,
        })}
      </span>
      <button
        type="button"
        onclick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        class="px-3 py-2 border border-border dark:border-border-dark hover:bg-surface dark:hover:bg-surface-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {t(lang, "writing.pagination.older")} →
      </button>
    </nav>
  {/if}
</div>
