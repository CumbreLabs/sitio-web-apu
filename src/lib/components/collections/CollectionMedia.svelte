<script lang="ts">
  import type { MediaItem } from "$lib/types";
  import { Play, X } from "lucide-svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getMedia } from "$lib/data";
  import { t } from "$lib/i18n";

  const types = ["all", "conference", "meetup", "webinar", "demo"] as const;

  // Colored badge per talk type — mirrors original goanpeca palette.
  const TYPE_BADGE: Record<string, string> = {
    conference: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    meetup: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    webinar: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    demo: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  };

  let activeType = $state<string>("all");
  let lang = $derived(getLang());
  let items = $derived(getMedia(lang));
  let playingId = $state<string | null>(null);
  let dialogEl = $state<HTMLDialogElement | null>(null);
  let triggerEl = $state<HTMLElement | null>(null);
  let closeBtnEl = $state<HTMLButtonElement | null>(null);

  let filtered = $derived(
    activeType === "all" ? items : items.filter((m) => m.type === activeType),
  );

  function year(d: string): string {
    return /^\d{4}/.test(d) ? d.slice(0, 4) : d;
  }

  /**
   * Resolve the effective provider for an item, defaulting to "youtube" for
   * legacy entries written before the `provider` field existed.
   * @param item - The media item being rendered.
   * @returns "youtube" or "loom".
   */
  function providerOf(item: MediaItem): "youtube" | "loom" {
    return item.provider ?? "youtube";
  }

  /**
   * Resolve the effective video ID, falling back to the legacy `youtubeId`
   * field so pre-`videoId` entries keep working.
   * @param item - The media item being rendered.
   * @returns Provider-specific video identifier, or empty string when neither field is set.
   */
  function videoIdOf(item: MediaItem): string {
    return item.videoId ?? item.youtubeId ?? "";
  }

  /**
   * Build the iframe `src` URL for the configured provider. Both hosts use a
   * privacy-friendly variant: `youtube-nocookie.com` for YouTube, `loom.com/embed`
   * for Loom (Loom doesn't ship a separate no-cookie host).
   * @param item - The media item being played.
   * @returns Fully-qualified embed URL, or empty string when no video ID is set.
   */
  function embedSrc(item: MediaItem): string {
    const id = videoIdOf(item);
    if (!id) return "";
    if (providerOf(item) === "loom") {
      return `https://www.loom.com/embed/${id}?autoplay=1&hide_owner=true&hide_share=true&hide_title=true`;
    }
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&rel=0&modestbranding=1`;
  }

  /**
   * Default thumbnail URL when the entry doesn't set one explicitly. Loom
   * thumbnails need a signed asset URL so they can't be synthesized from just
   * the session id; Loom items without an explicit `thumbnail` render the
   * card without a cover image (the play button still works).
   * @param item - The media item being rendered.
   * @returns Thumbnail URL, or empty string when none can be resolved.
   */
  function thumbnailFor(item: MediaItem): string {
    if (item.thumbnail) return item.thumbnail;
    if (providerOf(item) === "youtube" && videoIdOf(item)) {
      return `https://img.youtube.com/vi/${videoIdOf(item)}/hqdefault.jpg`;
    }
    return "";
  }

  function openPlayer(id: string, trigger: HTMLElement) {
    triggerEl = trigger;
    playingId = id;
  }

  function closePlayer() {
    playingId = null;
    dialogEl?.close();
    triggerEl?.focus();
    triggerEl = null;
  }

  $effect(() => {
    if (playingId && dialogEl && !dialogEl.open) {
      dialogEl.showModal();
      closeBtnEl?.focus();
    }
  });
</script>

<div class="flex flex-wrap gap-2 mb-8">
  {#each types as type (type)}
    <button
      type="button"
      onclick={() => (activeType = type)}
      aria-pressed={activeType === type}
      class="px-4 py-1.5 font-sans text-sm rounded transition-colors {activeType === type
        ? 'bg-text text-bg dark:bg-text-dark dark:text-bg-dark'
        : 'bg-surface dark:bg-surface-dark text-muted dark:text-muted-dark hover:bg-border dark:hover:bg-border-dark hover:text-text dark:hover:text-text-dark'}"
    >
      {t(lang, `media.${type}`)}
    </button>
  {/each}
</div>

{#if filtered.length === 0}
  <p class="font-sans text-muted dark:text-muted-dark text-center py-12">
    {t(lang, "media.noItems")}
  </p>
{:else}
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {#each filtered as item (item.url)}
      {@const thumbnailSrc = thumbnailFor(item)}
      {@const badgeClass =
        TYPE_BADGE[item.type] ?? "bg-surface text-muted dark:bg-surface-dark dark:text-muted-dark"}

      <button
        type="button"
        onclick={(e) => openPlayer(item.url, e.currentTarget)}
        class="group block w-full text-left border border-border dark:border-border-dark rounded bg-surface dark:bg-surface-dark overflow-hidden hover:shadow-card dark:hover:shadow-card-dark transition-all"
      >
        {#if thumbnailSrc}
          <div class="relative aspect-video overflow-hidden bg-bg dark:bg-bg-dark">
            <img
              src={thumbnailSrc}
              alt={item.title}
              width="480"
              height="270"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              class="w-full h-full object-cover"
            />
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors"
            >
              <div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                <Play size={20} class="text-black ml-0.5" fill="currentColor" />
              </div>
            </div>
          </div>
        {/if}
        <div class="p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-0.5 text-xs font-sans rounded {badgeClass}">
              {t(lang, `media.${item.type}`, { defaultValue: item.type })}
            </span>
            {#if item.language}
              <span
                class="px-2 py-0.5 text-xs font-sans rounded bg-bg dark:bg-bg-dark text-muted dark:text-muted-dark border border-border dark:border-border-dark uppercase"
              >
                {item.language}
              </span>
            {/if}
          </div>
          <h2
            class="font-sans font-semibold text-sm leading-snug mb-1 text-text dark:text-text-dark group-hover:text-accent dark:group-hover:text-accent-dark transition-colors"
          >
            {item.title}
          </h2>
          <p class="font-sans text-xs text-muted dark:text-muted-dark">
            {item.event || item.source} &middot; {year(item.date)}
          </p>
        </div>
      </button>

      {#if playingId === item.url}
        <dialog
          bind:this={dialogEl}
          class="fixed inset-0 z-50 flex items-center justify-center w-full h-full m-0 p-0 max-w-none max-h-none border-none bg-transparent backdrop:bg-black/85"
          onclick={closePlayer}
          onclose={closePlayer}
        >
          <div
            class="relative w-full max-w-4xl mx-4"
            role="presentation"
            onclick={(e) => e.stopPropagation()}
          >
            <button
              bind:this={closeBtnEl}
              type="button"
              onclick={closePlayer}
              class="absolute -top-12 -right-2 p-3 text-white hover:text-warm-300 transition-colors"
              aria-label="Close video"
            >
              <X size={24} />
            </button>
            <div class="relative w-full aspect-video overflow-hidden bg-black">
              <iframe
                src={embedSrc(item)}
                title={item.title}
                class="absolute inset-0 w-full h-full"
                referrerpolicy="origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </div>
            <p class="text-center text-white mt-3 font-sans text-sm">{item.title}</p>
            <p class="text-center text-muted-dark font-sans text-xs">{item.event || item.source}</p>
          </div>
        </dialog>
      {/if}
    {/each}
  </div>
{/if}
