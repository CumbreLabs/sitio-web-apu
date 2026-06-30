<script lang="ts">
  /**
   * Small heart glyph used in the footer attribution ("Hecho con ♥ por …").
   * Replaces the 💜 emoji so the mark renders in the site's own accent color
   * (via Tailwind's `fill-accent`, sourced from the `--color-accent` theme
   * token) and stays crisp at any size / DPI.
   *
   * Decorative by default (`aria-hidden`). Pass `label` to expose it as an
   * `img` to assistive tech so the sentence reads "Hecho con amor por …".
   */
  interface Props {
    /** Tailwind classes controlling size + fill. Defaults to accent-colored. */
    class?: string;
    /** Accessible label (e.g. "amor" / "love"). Omit to keep it decorative. */
    label?: string;
  }

  let { class: klass = "h-3.5 w-3.5 fill-accent", label }: Props = $props();
</script>

<svg
  viewBox="0 0 24 24"
  class={klass}
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
  focusable="false"
>
  <path
    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
  />
</svg>
