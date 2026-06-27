<script lang="ts">
  import { page } from "$app/stores";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getHomePath } from "$lib/routes";
  import { resolveTitle } from "$lib/config";
  import { t } from "$lib/i18n";

  let lang = $derived(getLang());
  let homePath = $derived(getHomePath(lang));
  let status = $derived($page.status);
  let message = $derived($page.error?.message ?? "");

  // Strings come from traducciones.json — never fall back to a hardcoded
  // English string. `check:i18n` (pre-commit + CI) guarantees every key
  // exists in both locales; if it ever doesn't, `t()` returns the key path
  // (visibly broken) instead of pretending to handle missing translations.
  let title = $derived(
    status === 404 ? t(lang, "error.notFoundTitle") : t(lang, "error.genericTitle"),
  );
  let description = $derived(
    status === 404 ? t(lang, "error.notFoundDescription") : message,
  );
  let homeLabel = $derived(t(lang, "error.backHome"));
</script>

<svelte:head>
  <title>{resolveTitle(title)}</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center">
  <p class="font-serif text-8xl font-bold text-accent dark:text-accent-dark mb-6">
    {status}
  </p>
  <h1 class="font-serif text-2xl font-semibold mb-4">
    {title}
  </h1>
  <p class="font-sans text-muted dark:text-muted-dark mb-10 max-w-md mx-auto">
    {description}
  </p>
  <a
    href={homePath}
    class="inline-block px-6 py-2.5 font-sans text-sm bg-accent dark:bg-accent-dark text-white dark:text-bg-dark hover:opacity-90 transition-opacity"
  >
    &larr; {homeLabel}
  </a>
</div>
