<script lang="ts">
  import HeartIcon from "../widgets/HeartIcon.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getFooterText } from "$lib/data";
  import { renderInline } from "$lib/inline-markdown";
  import { t } from "$lib/i18n";
  import { getPagePath, SECTION_PRIVACY } from "$lib/routes";

  let lang = $derived(getLang());
  let footer = $derived(getFooterText(lang));
  let privacyPath = $derived(getPagePath(SECTION_PRIVACY, lang));

  // Build attribution ("Hecho con ♥ por Cumbre Labs"). The wording lives in
  // pie-de-pagina.json; the `{heart}` token is swapped for an inline accent
  // SVG heart instead of the 💜 emoji so it renders in the site accent color.
  let madeWithParts = $derived.by(() => {
    const [before, after] = footer.madeWith.split("{heart}");
    return { before: before ?? footer.madeWith, after: after ?? "" };
  });
  let loveLabel = $derived(lang === "en" ? "love" : "amor");
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
        {@html renderInline(madeWithParts.before)}<HeartIcon
          class="inline-block h-3.5 w-3.5 fill-[var(--color-accent-dark)] align-[-0.2em]"
          label={loveLabel}
        />{@html renderInline(madeWithParts.after)}
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
