<script lang="ts">
  interface Props {
    src: string;
    alt: string;
    url?: string | undefined;
  }

  let { src, alt, url }: Props = $props();

  const imgClass = "w-10 h-10 object-contain bg-white";
</script>

{#if url}
  <a href={url} target="_blank" rel="noopener noreferrer" class="shrink-0">
    <img {src} {alt} width="40" height="40" loading="lazy" decoding="async" class="{imgClass} hover:opacity-80 transition-opacity" />
  </a>
{:else}
  <img {src} {alt} width="40" height="40" loading="lazy" decoding="async" class="{imgClass} shrink-0" />
{/if}
