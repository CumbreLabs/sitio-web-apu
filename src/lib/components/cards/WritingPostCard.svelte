<script lang="ts">
  import { Calendar, ExternalLink } from "lucide-svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getWritingBasePath } from "$lib/routes";
  import { formatLongDate, postDateSegments } from "$lib/date";
  import { writingConfig } from "$lib/config";
  import type { WritingPostFlat } from "$lib/data";

  interface Props {
    post: WritingPostFlat;
    /**
     * Heading tag for the card title. Defaults to `"h2"` (the listing-page
     * case: page `<h1>` → card `<h2>`). Pass `"h3"` when rendering under an
     * intermediate `<h2>` section header (e.g. the home "Recent Posts" block)
     * so axe-core's `heading-order` rule sees a strictly-increasing sequence.
     */
    headingLevel?: "h2" | "h3";
  }

  let { post, headingLevel = "h2" }: Props = $props();

  const SHOW_SUMMARY = (writingConfig as { showSummary?: boolean }).showSummary !== false;

  let lang = $derived(getLang());
  let writingBase = $derived(getWritingBasePath(lang));
  let segments = $derived(postDateSegments(post.date));
  let path = $derived(
    segments ? `${writingBase}${segments.year}/${segments.month}/${post.slug}/` : writingBase,
  );
  let formattedDate = $derived(formatLongDate(post.date, lang));
</script>

<a href={path} class="h-full block">
  <div
    class="group h-full flex flex-col border border-border dark:border-border-dark rounded bg-surface dark:bg-surface-dark overflow-hidden hover:shadow-card dark:hover:shadow-card-dark transition-all"
  >
    {#if post.image}
      <div class="relative w-full aspect-video overflow-hidden bg-bg dark:bg-bg-dark">
        <img
          src={post.image}
          alt=""
          width="640"
          height="360"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
    {/if}
    <div class="flex flex-col flex-1 p-5">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2">
          <Calendar size={14} class="text-muted dark:text-muted-dark" />
          <time class="font-sans text-xs text-muted dark:text-muted-dark" datetime={post.date}>
            {formattedDate}
          </time>
        </div>
        {#if post.externalUrl}
          <ExternalLink size={13} class="text-muted dark:text-muted-dark shrink-0" />
        {/if}
      </div>
      <svelte:element
        this={headingLevel}
        class="font-sans font-semibold text-lg text-text dark:text-text-dark group-hover:text-accent dark:group-hover:text-accent-dark transition-colors mb-2 leading-snug"
      >
        {post.title}
      </svelte:element>
      {#if SHOW_SUMMARY && post.summary}
        <p class="font-serif text-sm text-muted dark:text-muted-dark leading-relaxed mb-3 flex-1">
          {post.summary}
        </p>
      {/if}
      {#if post.tags && post.tags.length > 0}
        <div class="flex flex-wrap gap-1.5 mt-auto pt-1">
          {#each post.tags as tag (tag)}
            <span
              class="px-2 py-0.5 text-xs font-sans rounded bg-bg dark:bg-bg-dark text-muted dark:text-muted-dark border border-border dark:border-border-dark"
            >
              {tag}
            </span>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</a>
