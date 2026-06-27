<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { getLang, setLang } from "$lib/stores/lang.svelte";
  import { getEquivalentPath } from "$lib/routes";
  import { getAlternateLanguage, getSupportedLanguages } from "$lib/config";
  import { t } from "$lib/i18n";

  // Toggle is bilingual-only. Multilingual sites (3+ langs) need a picker
  // dropdown — render nothing here rather than guessing which "other" lang
  // to show. A fork with `languages: ["en"]` also gets nothing (no point
  // toggling to the same locale).
  const supportedLanguages = getSupportedLanguages();
  const isBilingual = supportedLanguages.length === 2;

  let lang = $derived(getLang());
  let targetLang = $derived(getAlternateLanguage(lang));
  let targetLabel = $derived(targetLang.toUpperCase());

  function handleToggle() {
    const currentPath = $page.url.pathname;
    const targetPath = getEquivalentPath(currentPath, targetLang);
    // Preserve scroll across the language switch in two cooperating steps:
    //
    //   1) Stash the current scroll position as a fraction of total scrollable
    //      height (the alt-lang page typically has a different docHeight, so
    //      a pixel offset wouldn't land at the same logical content).
    //
    //   2) Pin the document height to its CURRENT scrollHeight before the
    //      navigation tears down the old DOM. Without this pin the browser
    //      momentarily sees scrollHeight collapse to ~viewport while the new
    //      content lays out, clamps `scrollY` to 0, and paints a "jump to
    //      top" frame BEFORE our `afterNavigate` restorer runs — that frame
    //      is the visible flicker. The root layout releases the pin inside
    //      `requestAnimationFrame` once the new content is laid out, then
    //      adjusts to `pct * newDocHeight` in the same frame.
    if (typeof window !== "undefined") {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = (window.scrollY / docHeight).toFixed(4);
        window.sessionStorage.setItem("scrollPct", pct);
        document.documentElement.style.minHeight = `${document.documentElement.scrollHeight}px`;
      }
    }
    setLang(targetLang);
    // `noScroll: true` tells SvelteKit not to reset scroll after navigation —
    // we're managing it ourselves via the pct stash + min-height pin above.
    goto(targetPath, { noScroll: true });
  }
</script>

{#if isBilingual}
  <!-- White-bordered pill on the dark-teal navbar; shows the OTHER locale code
       (e.g. "EN" while on the Spanish site), matching the original APU header. -->
  <button
    type="button"
    onclick={handleToggle}
    class="rounded-full border-2 border-white px-4 py-1.5 font-sans text-sm font-medium text-white transition-colors hover:bg-white hover:text-navbar"
    aria-label={t(lang, "nav.switchLanguage")}
  >
    {targetLabel}
  </button>
{/if}
