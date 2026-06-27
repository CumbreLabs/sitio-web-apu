<script lang="ts">
  import { ArrowRight } from "lucide-svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getWritingPosts, sortPosts } from "$lib/data";
  import { getPagePath } from "$lib/routes";
  import { writingConfig } from "$lib/config";
  import { gridColsClass } from "$lib/grid";
  import { t } from "$lib/i18n";
  import WritingPostCard from "$lib/components/cards/WritingPostCard.svelte";

  let lang = $derived(getLang());
  // Show the same number of cards as `cardsPerRow` so featured fills exactly
  // one row at the largest breakpoint (no half-empty trailing rows). The
  // value is pre-defaulted in $lib/config — see $lib/defaults.
  let perRow = $derived(writingConfig.cardsPerRow);
  let posts = $derived(sortPosts(getWritingPosts(lang), "date-desc").slice(0, perRow));
  let blogPath = $derived(getPagePath("escritos", lang));
  let gridClass = $derived(gridColsClass(perRow));
</script>

{#if posts.length > 0}
  <section id="featured-writings" class="mb-16">
    <div class="flex items-center justify-between mb-6">
      <h2
        class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark"
      >
        {t(lang, "home.recentPostsTitle")}
      </h2>
      <a
        href={blogPath}
        class="inline-flex items-center gap-1 font-sans text-sm text-accent dark:text-accent-dark hover:underline"
      >
        {t(lang, "home.viewAll")}
        <ArrowRight size={14} />
      </a>
    </div>
    <div class="{gridClass} gap-4">
      {#each posts as post (post.slug)}
        <WritingPostCard {post} headingLevel="h3" />
      {/each}
    </div>
  </section>
{/if}
