<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    data: { lang: string };
    children: Snippet;
  }

  // Language is detected from the URL by the root +layout.svelte, so this wrapper
  // is a passthrough. The data load function still validates `params.lang`.
  let { children }: Props = $props();
</script>

{@render children()}
