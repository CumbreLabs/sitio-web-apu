<script lang="ts">
  import { imgSrcset, imgDims } from "$lib/images";

  interface Props {
    /** Source image path under /media/ */
    src: string;
    /** Alt text (required for a11y) */
    alt: string;
    /** Sizes attribute for the responsive srcset. */
    sizes?: string | undefined;
    /** Class applied to the inner <img>. */
    imgClass?: string | undefined;
    /** loading strategy; defaults to lazy. */
    loading?: "lazy" | "eager";
    /** decoding hint; defaults to async. */
    decoding?: "async" | "sync" | "auto";
    /**
     * Fetch priority hint. Use "high" on the LCP image (hero / first
     * above-the-fold photo). Browsers use this to prioritize ahead of other
     * resources during initial load. Default omits the attribute entirely
     * so non-critical images use the browser's normal scheduling.
     */
    fetchpriority?: "high" | "low" | "auto" | undefined;
    /** Optional explicit width/height override (otherwise read from virtual:image-dims). */
    width?: number | undefined;
    height?: number | undefined;
    /** referrerpolicy passthrough (used by external thumbnails). */
    referrerpolicy?:
      | ""
      | "no-referrer"
      | "no-referrer-when-downgrade"
      | "origin"
      | "origin-when-cross-origin"
      | "same-origin"
      | "strict-origin"
      | "strict-origin-when-cross-origin"
      | "unsafe-url"
      | undefined;
  }

  let {
    src,
    alt,
    sizes,
    imgClass,
    loading = "lazy",
    decoding = "async",
    fetchpriority,
    width,
    height,
    referrerpolicy,
  }: Props = $props();

  let srcsetWebp = $derived(imgSrcset(src));
  let srcsetAvif = $derived(imgSrcset(src, undefined, ".avif"));
  let dims = $derived(imgDims(src));
  let resolvedWidth = $derived(width ?? dims?.[0]);
  let resolvedHeight = $derived(height ?? dims?.[1]);
</script>

<picture>
  {#if srcsetAvif}
    <source type="image/avif" srcset={srcsetAvif} {sizes} />
  {/if}
  {#if srcsetWebp}
    <source srcset={srcsetWebp} {sizes} />
  {/if}
  <img
    {src}
    {alt}
    width={resolvedWidth}
    height={resolvedHeight}
    {loading}
    {decoding}
    {fetchpriority}
    {referrerpolicy}
    class={imgClass}
  />
</picture>
