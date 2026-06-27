<script lang="ts">
  import { Award } from "lucide-svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getAwards, getAwardsTitle } from "$lib/data";

  let lang = $derived(getLang());
  let awards = $derived(getAwards(lang));
  let title = $derived(getAwardsTitle(lang));

  function year(d: string): string {
    return /^\d{4}/.test(d) ? d.slice(0, 4) : d;
  }
</script>

{#if awards.length > 0}
  <section id="awards" class="mb-16">
    <h2
      class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark mb-6"
    >
      {title}
    </h2>
    <div class="space-y-3">
      {#each awards as award, i (i)}
        <div
          class="flex gap-4 items-center border border-border dark:border-border-dark rounded bg-surface dark:bg-surface-dark p-4"
        >
          <Award size={20} class="text-amber-500 shrink-0" />
          <div class="flex-1 min-w-0">
            <h3 class="font-sans font-semibold text-text dark:text-text-dark text-sm">
              {award.title}
            </h3>
            <p class="font-sans text-xs text-muted dark:text-muted-dark mt-0.5">
              {award.organization} &middot; <time datetime={award.date}>{year(award.date)}</time>
            </p>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
