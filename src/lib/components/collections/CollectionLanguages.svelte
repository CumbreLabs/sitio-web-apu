<script lang="ts">
  import { getLang } from "$lib/stores/lang.svelte";
  import { getLanguages, getLanguagesTitle } from "$lib/data";

  let lang = $derived(getLang());
  let items = $derived(getLanguages(lang));
  let title = $derived(getLanguagesTitle(lang));
</script>

{#if items.length > 0}
  <section id="languages" class="mb-16">
    <h2
      class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark mb-6"
    >
      {title}
    </h2>
    <div class="flex flex-wrap gap-2">
      {#each items as item, i (i)}
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-sans bg-surface text-text dark:bg-surface-dark dark:text-text-dark border border-border dark:border-border-dark"
        >
          {item.name}
        </span>
      {/each}
    </div>
  </section>
{/if}
