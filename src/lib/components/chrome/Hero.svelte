<script lang="ts">
  import { siteConfig } from "$lib/config";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getAboutHeader } from "$lib/data";
  import { renderInline } from "$lib/inline-markdown";
  import SocialLinks from "$lib/components/widgets/SocialLinks.svelte";

  interface Props {
    title: string;
    subtitle?: string | undefined;
    // Kept for backwards-compat with the old PageTemplate signature but
    // intentionally unused — the goanpeca skin is a text+photo hero, not a
    // full-bleed background image with overlay.
    backgroundImage?: string;
  }

  let { title, subtitle }: Props = $props();
  let lang = $derived(getLang());
  let header = $derived(getAboutHeader(lang));
  let photo = $derived(header.photo || siteConfig.personImage);

  // First paragraph of the bio becomes the hero blurb. We strip remaining
  // paragraphs so the hero stays a single dense block — the full bio renders
  // on /about/ via the same encabezado collection.
  let firstParagraph = $derived(
    (header.bio ?? "").split("\n\n")[0]?.replace(/\n/g, " ") ?? "",
  );
</script>

<section
  class="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center sm:flex-row sm:items-start gap-8"
>
  {#if photo}
    <img
      src={photo}
      alt={title}
      width="208"
      height="208"
      fetchpriority="high"
      loading="eager"
      decoding="async"
      class="w-40 h-40 sm:w-52 sm:h-52 rounded-sm object-cover border border-border dark:border-border-dark shadow-card dark:shadow-card-dark shrink-0"
    />
  {/if}
  <div class="text-center sm:text-left min-w-0">
    <h1 class="font-sans text-3xl sm:text-4xl font-bold mb-2 text-text dark:text-text-dark">
      {title}
    </h1>
    {#if subtitle}
      <p
        class="font-sans text-base sm:text-lg text-muted dark:text-muted-dark mb-4 max-w-xl leading-relaxed"
      >
        {subtitle}
      </p>
    {/if}
    {#if firstParagraph}
      <div
        class="prose-bio font-serif text-muted dark:text-muted-dark mb-5 max-w-xl leading-relaxed"
      >
        {@html renderInline(firstParagraph)}
      </div>
    {/if}
    <SocialLinks size={18} />
  </div>
</section>

<style>
  :global(.prose-bio a) {
    color: var(--color-accent);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  :global([data-theme="dark"] .prose-bio a) {
    color: var(--color-accent-dark);
  }
</style>
