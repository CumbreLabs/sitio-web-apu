<script lang="ts">
  import { Users } from "lucide-svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getVolunteering, getVolunteeringTitle } from "$lib/data";

  let lang = $derived(getLang());
  let items = $derived(getVolunteering(lang));
  let title = $derived(getVolunteeringTitle(lang));
</script>

{#if items.length > 0}
  <section id="volunteering" class="mb-16">
    <h2
      class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark mb-6"
    >
      {title}
    </h2>
    <div class="grid gap-4 sm:grid-cols-2">
      {#each items as item, i (i)}
        <div
          class="flex gap-4 border border-border dark:border-border-dark rounded bg-surface dark:bg-surface-dark p-5 hover:shadow-card dark:hover:shadow-card-dark transition-all"
        >
          {#if item.logo}
            {#if item.url}
              <a href={item.url} target="_blank" rel="noopener noreferrer" class="shrink-0">
                <img
                  src={item.logo}
                  alt={item.organization}
                  width="48"
                  height="48"
                  loading="lazy"
                  decoding="async"
                  class="w-12 h-12 rounded-full object-contain bg-white hover:opacity-80 transition-opacity"
                />
              </a>
            {:else}
              <img
                src={item.logo}
                alt={item.organization}
                width="48"
                height="48"
                loading="lazy"
                decoding="async"
                class="w-12 h-12 rounded-full object-contain shrink-0 bg-white"
              />
            {/if}
          {:else}
            <Users size={28} class="text-muted dark:text-muted-dark shrink-0" />
          {/if}
          <div class="flex-1 min-w-0">
            <h3 class="font-sans font-semibold text-text dark:text-text-dark">
              {item.organization}
            </h3>
            <p class="font-sans text-sm text-muted dark:text-muted-dark">{item.role}</p>
            {#if item.events && item.events.length > 0}
              <p class="font-sans text-xs text-muted dark:text-muted-dark mt-2 leading-relaxed">
                {#each item.events as ev, j (j)}{#if j > 0},
                  {/if}{#if ev.url}<a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="underline underline-offset-2 hover:text-accent dark:hover:text-accent-dark"
                      >{ev.name}</a
                    >{:else}{ev.name}{/if}{/each}
              </p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
