<script lang="ts">
  import { GraduationCap, ExternalLink } from "lucide-svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getEducation, getEducationTitle } from "$lib/data";
  import { formatYear } from "$lib/date";

  let lang = $derived(getLang());
  let education = $derived(getEducation(lang));
  let title = $derived(getEducationTitle(lang));
</script>

{#if education.length > 0}
  <section id="education" class="mb-16">
    <h2
      class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark mb-6"
    >
      {title}
    </h2>
    <div class="space-y-4">
      {#each education as edu, i (i)}
        <div
          class="flex gap-4 border border-border dark:border-border-dark rounded bg-surface dark:bg-surface-dark p-5 hover:shadow-card dark:hover:shadow-card-dark transition-all"
        >
          {#if edu.logo}
            {#if edu.url}
              <a href={edu.url} target="_blank" rel="noopener noreferrer" class="shrink-0">
                <img
                  src={edu.logo}
                  alt={edu.institution}
                  width="40"
                  height="40"
                  loading="lazy"
                  decoding="async"
                  class="w-10 h-10 rounded-sm object-contain bg-white hover:opacity-80 transition-opacity"
                />
              </a>
            {:else}
              <img
                src={edu.logo}
                alt={edu.institution}
                width="40"
                height="40"
                loading="lazy"
                decoding="async"
                class="w-10 h-10 rounded-sm object-contain shrink-0 bg-white"
              />
            {/if}
          {:else}
            <GraduationCap size={24} class="text-muted dark:text-muted-dark shrink-0 mt-0.5" />
          {/if}
          <div class="flex-1 min-w-0">
            <h3 class="font-sans font-semibold text-text dark:text-text-dark">{edu.degree}</h3>
            <p class="font-sans text-sm text-muted dark:text-muted-dark mt-1">
              {#if edu.url}
                <a
                  href={edu.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:text-text dark:hover:text-text-dark inline-flex items-center gap-1"
                >
                  {edu.institution}
                  <ExternalLink size={11} />
                </a>
              {:else}
                {edu.institution}
              {/if}
            </p>
            <p class="font-sans text-xs text-muted dark:text-muted-dark mt-0.5">
              <time datetime={edu.start_date}>{formatYear(edu.start_date)}</time>
            </p>
            {#if edu.honors}
              <span
                class="inline-block mt-2 px-2 py-0.5 text-xs font-sans rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
              >
                {edu.honors}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
