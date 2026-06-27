<script lang="ts">
  interface Props {
    label: string;
    isActive: boolean;
    onClick: () => void;
  }

  let { label, isActive, onClick }: Props = $props();
</script>

<button
  type="button"
  onclick={onClick}
  aria-pressed={isActive}
  class="px-4 py-1.5 font-sans text-sm rounded transition-colors {isActive
    ? 'bg-text text-bg dark:bg-text-dark dark:text-bg-dark'
    : 'bg-surface dark:bg-surface-dark text-muted dark:text-muted-dark hover:bg-border dark:hover:bg-border-dark hover:text-text dark:hover:text-text-dark'}"
>
  {label}
</button>
