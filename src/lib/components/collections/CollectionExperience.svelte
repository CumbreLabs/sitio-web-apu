<script lang="ts">
  import { Briefcase, ExternalLink } from "lucide-svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getExperience, getExperienceTitle } from "$lib/data";
  import { t } from "$lib/i18n";
  import { formatYearMonth } from "$lib/date";

  let lang = $derived(getLang());
  let experience = $derived(getExperience(lang));
  let title = $derived(getExperienceTitle(lang));

  /**
   * Format an experience period as "Mar 2010 - Aug 2010", "Apr 2026 - Present", or "Mar 2010".
   * @param start - Start date in ISO YYYY-MM-DD format.
   * @param end - End date in ISO YYYY-MM-DD format (empty when the role has no recorded end).
   * @param current - When true, the end label is replaced with the localized "Present" string.
   * @returns Human-readable period string for the active language.
   */
  function period(start: string, end: string, current?: boolean): string {
    const s = formatYearMonth(start, lang);
    if (current) return `${s} - ${t(lang, "about.present")}`;
    if (!end) return s;
    return `${s} - ${formatYearMonth(end, lang)}`;
  }
</script>

{#if experience.length > 0}
  <section id="experience" class="mb-16">
    <h2
      class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark mb-6"
    >
      {title}
    </h2>
    <div class="space-y-4">
      {#each experience as exp, i (i)}
        <div
          class="flex gap-4 border border-border dark:border-border-dark rounded bg-surface dark:bg-surface-dark p-5 hover:shadow-card dark:hover:shadow-card-dark transition-all"
        >
          {#if exp.logo}
            {#if exp.url}
              <a href={exp.url} target="_blank" rel="noopener noreferrer" class="shrink-0">
                <img
                  src={exp.logo}
                  alt={exp.organization}
                  width="40"
                  height="40"
                  loading="lazy"
                  decoding="async"
                  class="w-10 h-10 rounded-sm object-contain bg-white hover:opacity-80 transition-opacity"
                />
              </a>
            {:else}
              <img
                src={exp.logo}
                alt={exp.organization}
                width="40"
                height="40"
                loading="lazy"
                decoding="async"
                class="w-10 h-10 rounded-sm object-contain shrink-0 bg-white"
              />
            {/if}
          {:else}
            <Briefcase size={24} class="text-muted dark:text-muted-dark shrink-0 mt-0.5" />
          {/if}
          <div class="flex-1 min-w-0">
            <h3 class="font-sans font-semibold text-text dark:text-text-dark">{exp.role}</h3>
            <p class="font-sans text-sm text-muted dark:text-muted-dark mt-0.5">
              {#if exp.url}
                <a
                  href={exp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:text-text dark:hover:text-text-dark inline-flex items-center gap-1"
                >
                  {exp.organization}
                  <ExternalLink size={11} />
                </a>
              {:else}
                {exp.organization}
              {/if}
            </p>
            <p class="font-sans text-xs text-muted dark:text-muted-dark mt-0.5">
              <time datetime={exp.start_date}
                >{period(exp.start_date, exp.end_date, exp.current)}</time
              >
              {#if exp.location}
                &middot; {exp.location}
              {/if}
            </p>
            {#if exp.description && exp.description.length > 0}
              <ul class="mt-3 space-y-1.5">
                {#each exp.description as item, j (j)}
                  <li class="font-serif text-sm text-text dark:text-text-dark leading-relaxed">
                    &bull; {item}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
