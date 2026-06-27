<script lang="ts">
  /**
   * Renders pre-built HTML inside the `.prose-blog` typography wrapper.
   *
   * **The HTML must be pre-rendered + sanitized at build time** — either by
   * the `virtual:rendered-pages` Vite plugin (for `.md` source files) or by
   * `$lib/inline-markdown:renderBlock` (for short config-string markdown that
   * lives in JSON, not `.md`). This component does NOT run a markdown
   * parser at runtime — that pipeline moved to the Node-only Vite layer
   * to keep `marked` + Shiki + the sanitizer out of the client bundle.
   *
   * Use `html` for already-rendered HTML; the older `content` prop is gone.
   */

  interface Props {
    html: string;
  }

  let { html }: Props = $props();
</script>

<div class="prose-blog">
  {@html html}
</div>
