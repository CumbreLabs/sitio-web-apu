<script lang="ts">
  import { getLang } from "$lib/stores/lang.svelte";
  import { getFooterText } from "$lib/data";
  import { renderInline } from "$lib/inline-markdown";
  import { t } from "$lib/i18n";
  import { getPagePath, SECTION_PRIVACY } from "$lib/routes";

  let lang = $derived(getLang());
  let footer = $derived(getFooterText(lang));
  let privacyPath = $derived(getPagePath(SECTION_PRIVACY, lang));
</script>

<!-- APU footer: a slim copyright strip in the same dark navy as the navbar
     (bg-navbar), sitting under the teal "Reserva Ahora" contact band
     (CollectionContact) to anchor the bottom of the page. -->
<footer class="bg-navbar text-white">
  <div class="mx-auto max-w-4xl px-6 py-6 text-center footer-text">
    <p class="font-sans text-sm text-white/90">
      {@html renderInline(footer.copyright)}
    </p>
    <p class="mt-1 font-sans text-xs text-white/70">
      <a href={privacyPath}>{t(lang, "footer.privacy")}</a>
    </p>
    {#if footer.madeWith}
      <p class="mt-1 font-sans text-xs text-white/70">
        {@html renderInline(footer.madeWith)}
      </p>
    {/if}
  </div>
</footer>

<style>
  .footer-text :global(a) {
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color 0.2s;
  }
  .footer-text :global(a:hover) {
    color: var(--color-brand-orange);
  }
</style>
