<script lang="ts">
  import { getLang } from "$lib/stores/lang.svelte";
  import { getAbout } from "$lib/data";

  let lang = $derived(getLang());
  let about = $derived(getAbout(lang));
</script>

<section id="nosotros" class="bg-surface dark:bg-surface-dark">
  <div class="mx-auto max-w-4xl px-6 py-20 text-center">
    <h2 class="section-title font-sans text-3xl font-bold text-text dark:text-text-dark sm:text-4xl">
      {about.title}
    </h2>
    <p class="mx-auto mt-6 max-w-3xl font-sans text-lg leading-relaxed text-muted dark:text-muted-dark">
      {about.text}
    </p>

    {#if about.stats.length}
      <div class="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {#each about.stats as stat, i (i)}
          <div>
            <p class="font-sans text-4xl font-bold text-accent dark:text-accent-dark sm:text-5xl">
              {stat.number}
            </p>
            <p class="mt-2 font-sans text-sm uppercase tracking-wide text-muted dark:text-muted-dark">
              {stat.label}
            </p>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>
