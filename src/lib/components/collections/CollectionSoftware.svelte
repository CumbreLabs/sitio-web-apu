<script lang="ts">
  import { getLang } from "$lib/stores/lang.svelte";
  import { getSoftware, getSoftwareTitle } from "$lib/data";
  import { t } from "$lib/i18n";

  let lang = $derived(getLang());
  let items = $derived(getSoftware(lang));
  let title = $derived(getSoftwareTitle(lang));

  // Preserve insertion order when extracting unique categories so the visual
  // grouping mirrors the data file's authored order.
  let categories = $derived(Array.from(new Set(items.map((s) => s.category || "Other"))));
</script>

{#if categories.length > 0}
  <section id="software" class="mb-16">
    <h2
      class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark mb-6"
    >
      {title}
    </h2>
    <div class="space-y-6">
      {#each categories as category (category)}
        <div>
          <h3 class="font-sans text-sm font-medium text-muted dark:text-muted-dark mb-3">
            {t(lang, `about.skillCategories.${category}`, { defaultValue: category })}
          </h3>
          <div class="flex flex-wrap gap-2">
            {#each items.filter((s) => (s.category || "Other") === category) as skill (skill.name)}
              <span
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-sans bg-surface text-text dark:bg-surface-dark dark:text-text-dark border border-border dark:border-border-dark"
              >
                {skill.name}
                {#if skill.years}
                  <span class="text-xs text-muted dark:text-muted-dark">({skill.years})</span>
                {/if}
              </span>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
