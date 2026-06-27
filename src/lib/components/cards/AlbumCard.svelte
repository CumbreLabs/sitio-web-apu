<script lang="ts">
  import TagList from "$lib/components/widgets/TagList.svelte";
  import Picture from "$lib/components/media/Picture.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { t } from "$lib/i18n";
  import { getPagePath, SECTION_PORTFOLIO } from "$lib/routes";
  import type { PortfolioAlbumFlat } from "$lib/data";

  interface Props {
    album: PortfolioAlbumFlat & { id: string };
  }

  let { album }: Props = $props();

  let lang = $derived(getLang());
  let cover = $derived(
    album.photos.find((p) => p.src === album.coverSrc) ??
      album.photos[0] ?? { src: album.coverSrc, alt: album.title },
  );
  let albumPath = $derived(`${getPagePath(SECTION_PORTFOLIO, lang)}${album.slug}/`);
</script>

<a
  href={albumPath}
  class="block w-full overflow-hidden group cursor-pointer relative shadow-sm dark:shadow-[0_0_12px_rgba(255,255,255,0.06)] {album.orientation ===
  'portrait'
    ? 'aspect-[3/4]'
    : 'aspect-[4/3]'}"
>
  <Picture
    src={cover.src}
    alt={cover.alt}
    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
    width={400}
    height={album.orientation === "portrait" ? 533 : 300}
    imgClass="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
  />

  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

  <div class="absolute bottom-0 left-0 right-0 p-4 text-left">
    {#if album.title}
      <h2 class="font-serif text-lg font-semibold text-white leading-tight">{album.title}</h2>
    {/if}
    <div class="flex items-center gap-2 mt-1.5 font-sans text-xs text-white/70">
      <span>{t(lang, "portfolio.photoCount", { count: album.photos.length })}</span>
    </div>
    <TagList tags={album.tags} variant="overlay" class="mt-2" />
  </div>
</a>
