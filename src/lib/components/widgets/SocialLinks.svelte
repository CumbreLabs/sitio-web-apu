<script lang="ts">
  import { Mail, Globe } from "lucide-svelte";
  import BrandIcons from "./BrandIcons.svelte";
  import { getSocial } from "$lib/data";
  import { getLang } from "$lib/stores/lang.svelte";
  import type { BrandIconName } from "$lib/types";

  interface Props {
    size?: number;
    /**
     * "inverse" renders white icons (orange on hover) for placement on the
     * dark-teal contact band; "default" uses the muted-on-surface palette.
     */
    tone?: "default" | "inverse";
  }

  let { size = 20, tone = "default" }: Props = $props();

  let lang = $derived(getLang());
  let social = $derived(getSocial(lang));

  let linkClass = $derived(
    tone === "inverse"
      ? "text-white hover:text-brand-orange transition-colors"
      : "text-muted hover:text-accent dark:text-muted-dark dark:hover:text-accent-dark transition-colors",
  );
</script>

<ul class="flex items-center gap-3 list-none m-0 p-0">
  {#each social as link (link.name)}
    <li>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        class={linkClass}
        aria-label={link.name}
      >
        {#if link.icon === "Mail"}
          <Mail {size} />
        {:else if link.icon === "Globe"}
          <Globe {size} />
        {:else}
          <BrandIcons name={link.icon as BrandIconName} {size} />
        {/if}
      </a>
    </li>
  {/each}
</ul>
