<script lang="ts">
  import { Quote, ExternalLink, User } from "lucide-svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getRecommendations, getRecommendationsTitle } from "$lib/data";

  let lang = $derived(getLang());
  let recs = $derived(getRecommendations(lang));
  let title = $derived(getRecommendationsTitle(lang));
</script>

{#if recs.length > 0}
  <section id="recommendations" class="mb-16">
    <h2
      class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark mb-6"
    >
      {title}
    </h2>
    <div class="grid gap-4 sm:grid-cols-2">
      {#each recs as rec, i (i)}
        <div
          class="flex flex-col border border-border dark:border-border-dark rounded bg-surface dark:bg-surface-dark p-6"
        >
          <Quote size={20} class="text-muted dark:text-muted-dark mb-3" />
          <p
            class="font-serif text-sm italic text-text dark:text-text-dark leading-relaxed mb-5 flex-1"
          >
            &ldquo;{rec.text}&rdquo;
          </p>
          <div class="flex items-center gap-3 mt-auto">
            {#if rec.image}
              <img
                src={rec.image}
                alt={rec.name}
                width="40"
                height="40"
                loading="lazy"
                decoding="async"
                class="w-10 h-10 rounded-full object-cover shrink-0 bg-bg dark:bg-bg-dark"
              />
            {:else}
              <div
                class="w-10 h-10 rounded-full bg-border dark:bg-border-dark flex items-center justify-center shrink-0"
              >
                <User size={20} class="text-muted dark:text-muted-dark" />
              </div>
            {/if}
            <div class="min-w-0">
              <p class="font-sans font-semibold text-sm text-text dark:text-text-dark">
                {#if rec.linkedin}
                  <a
                    href={rec.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 hover:text-accent dark:hover:text-accent-dark"
                  >
                    {rec.name}
                    <ExternalLink size={11} />
                  </a>
                {:else}
                  {rec.name}
                {/if}
              </p>
              <p class="font-sans text-xs text-muted dark:text-muted-dark">{rec.title}</p>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
