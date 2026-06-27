<script lang="ts">
  import { ChevronLeft, ChevronRight } from "lucide-svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getGallery } from "$lib/data";
  import { t } from "$lib/i18n";

  let lang = $derived(getLang());
  let gallery = $derived(getGallery(lang));

  let index = $state(0);
  let count = $derived(gallery.photos.length);

  /**
   * Advance the carousel, wrapping around at both ends.
   * @param delta - +1 next, -1 previous.
   */
  function move(delta: number): void {
    if (count === 0) return;
    index = (index + delta + count) % count;
  }
</script>

{#if count > 0}
  <section id="galeria" class="scroll-mt-24 bg-surface dark:bg-surface-dark">
    <div class="mx-auto max-w-5xl px-6 py-20">
      <h2
        id="galeria-heading"
        class="section-title text-center font-sans text-3xl font-bold text-text dark:text-text-dark sm:text-4xl"
      >
        {gallery.title}
      </h2>

      <!-- APG carousel semantics: the viewport is a labelled group announced as
           a "carousel" to assistive tech; each slide is a "slide N of M" group.
           All slides stay in the DOM (translateX), so screen-reader users can
           reach every image regardless of the visible index. -->
      <div
        role="group"
        aria-roledescription="carousel"
        aria-labelledby="galeria-heading"
        class="relative mt-10 overflow-hidden rounded-2xl shadow-card dark:shadow-card-dark"
      >
        <div
          class="flex transition-transform duration-500 ease-out"
          style="transform: translateX(-{index * 100}%)"
        >
          {#each gallery.photos as photo, i (i)}
            <div
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              class="w-full shrink-0"
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                class="aspect-[3/2] w-full object-cover"
              />
            </div>
          {/each}
        </div>

        {#if count > 1}
          <button
            type="button"
            onclick={() => move(-1)}
            aria-label={t(lang, "gallery.prev")}
            class="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition-colors hover:bg-black/70"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onclick={() => move(1)}
            aria-label={t(lang, "gallery.next")}
            class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition-colors hover:bg-black/70"
          >
            <ChevronRight size={24} />
          </button>
        {/if}
      </div>

      {#if count > 1}
        <div class="mt-5 flex justify-center gap-2">
          {#each gallery.photos as photo, i (i)}
            <button
              type="button"
              onclick={() => (index = i)}
              aria-label={`${t(lang, "gallery.goToSlide")} ${i + 1}: ${photo.alt}`}
              aria-current={index === i ? "true" : undefined}
              class="h-2.5 w-2.5 rounded-full transition-colors {index === i
                ? 'bg-accent dark:bg-accent-dark'
                : 'bg-border dark:bg-border-dark'}"
            ></button>
          {/each}
        </div>
      {/if}
    </div>
  </section>
{/if}
