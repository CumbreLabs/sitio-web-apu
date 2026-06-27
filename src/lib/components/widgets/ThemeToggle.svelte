<script lang="ts">
  import { Sun, Moon } from "lucide-svelte";
  import { getTheme, toggleTheme } from "$lib/stores/theme.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { t } from "$lib/i18n";

  let theme = $derived(getTheme());
  let lang = $derived(getLang());
</script>

<button
  type="button"
  onclick={toggleTheme}
  class="p-2 hover:bg-surface dark:hover:bg-surface-dark transition-colors"
  aria-label={theme === "light" ? t(lang, "theme.dark") : t(lang, "theme.light")}
>
  {#if theme === "light"}
    <Moon size={18} class="text-muted" />
  {:else}
    <Sun size={18} class="text-muted-dark" />
  {/if}
</button>
