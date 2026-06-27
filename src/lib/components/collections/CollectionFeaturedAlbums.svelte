<script lang="ts">
  import { getLang } from "$lib/stores/lang.svelte";
  import { getPagePath, SECTION_PORTFOLIO } from "$lib/routes";
  import { getFeaturedAlbums, getFeaturedAlbumsTitle } from "$lib/data";
  import Picture from "$lib/components/media/Picture.svelte";

  let lang = $derived(getLang());
  let highlighted = $derived(getFeaturedAlbums(lang));
  let sectionTitle = $derived(getFeaturedAlbumsTitle(lang));
  let portfolioPath = $derived(getPagePath(SECTION_PORTFOLIO, lang));
</script>

{#if highlighted.length > 0}
  <section id="featured-albums" class="max-w-5xl mx-auto px-4 sm:px-6 py-20">
    <h2 class="font-serif text-2xl sm:text-3xl font-semibold mb-10">
      {sectionTitle}
    </h2>

    <div class="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
      {#each highlighted as album (album.id)}
        {@const cover = album.photos.find((p) => p.src === album.coverSrc) ??
          album.photos[0] ?? { src: album.coverSrc, alt: album.title }}
        <a
          href="{portfolioPath}{album.slug}/"
          class="block break-inside-avoid overflow-hidden group shadow-sm dark:shadow-[0_0_12px_rgba(255,255,255,0.06)] {album.orientation ===
          'portrait'
            ? 'aspect-[3/4]'
            : 'aspect-[4/3]'}"
        >
          <Picture
            src={cover.src}
            alt={cover.alt}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            imgClass="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </a>
      {/each}
    </div>
  </section>
{/if}
