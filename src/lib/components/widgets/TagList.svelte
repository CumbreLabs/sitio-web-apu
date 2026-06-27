<script lang="ts">
  type Variant = "overlay" | "muted" | "surface";

  interface Props {
    tags: readonly string[];
    variant?: Variant;
    class?: string;
  }

  let { tags, variant = "muted", class: extraClass = "" }: Props = $props();

  const VARIANT_CLASSES: Record<Variant, string> = {
    overlay: "px-2 py-0.5 bg-white/15 font-sans text-[11px] text-white/80",
    muted:
      "px-2 py-0.5 text-xs font-sans bg-border/50 dark:bg-border-dark text-muted dark:text-muted-dark",
    surface:
      "px-2 py-0.5 text-xs font-sans bg-surface dark:bg-surface-dark text-muted dark:text-muted-dark",
  };

  let tagClass = $derived(VARIANT_CLASSES[variant]);
</script>

{#if tags.length > 0}
  <div class="flex flex-wrap gap-1.5 {extraClass}">
    {#each tags as tag (tag)}
      <span class={tagClass}>{tag}</span>
    {/each}
  </div>
{/if}
