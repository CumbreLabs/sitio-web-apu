<script lang="ts">
  import MarkdownRenderer from "$lib/components/media/MarkdownRenderer.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { siteConfig } from "$lib/config";
  import { getAboutHeader, getAboutHeaderTitle } from "$lib/data";
  import { renderBlock } from "$lib/inline-markdown";

  let lang = $derived(getLang());
  let header = $derived(getAboutHeader(lang));
  let title = $derived(getAboutHeaderTitle(lang));
  // `header.bio` lives in `colecciones/{lang}/encabezado.json` (not in a `.md`
  // file), so it can't be pre-rendered by the `virtual:rendered-pages` Vite
  // plugin. Run it through the minimal client-side renderer for paragraphs +
  // inline formatting (bold/italic/links) instead — the field never needs
  // headings / lists / code blocks. If a fork's bio ever wants those, move it
  // to an `.md` file under `paginas/` and reference it as page body content.
  let bioHtml = $derived(renderBlock(header?.bio ?? ""));
</script>

{#if header && (header.bio || header.photo)}
  <section id="bio" class="mb-16">
    <h2
      class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark mb-6"
    >
      {title}
    </h2>
    <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
      <img
        src={header.photo}
        alt={siteConfig.name}
        width="96"
        height="96"
        loading="lazy"
        decoding="async"
        class="w-24 h-24 rounded-sm object-cover border border-border dark:border-border-dark shrink-0"
      />
      <div class="text-center sm:text-left">
        <h3 class="font-sans text-2xl font-bold text-text dark:text-text-dark mb-1">
          {siteConfig.name}
        </h3>
        <p class="font-sans text-sm text-muted dark:text-muted-dark">
          {siteConfig.jobTitle}
        </p>
      </div>
    </div>
    <div class="prose-bio font-serif text-text dark:text-text-dark leading-relaxed">
      <MarkdownRenderer html={bioHtml} />
    </div>
  </section>
{/if}

<style>
  :global(.prose-bio a) {
    color: var(--color-accent);
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: 500;
  }
  :global([data-theme="dark"] .prose-bio a) {
    color: var(--color-accent-dark);
  }
  :global(.prose-bio p) {
    margin-bottom: 1rem;
  }
</style>
