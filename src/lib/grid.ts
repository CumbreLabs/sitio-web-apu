/**
 * Card-grid responsive class helper.
 *
 * The `cardsPerRow` config keys on `escritos.json` / `proyectos.json` map to
 * a responsive Tailwind grid class set here. Mobile always renders one
 * column (cards need space on narrow screens); `sm:` jumps to two; `lg:`
 * (and `xl:` for the wider counts) reach the configured count.
 *
 * Tailwind v4's JIT scanner only emits classes it sees **literally** in
 * source — `grid-cols-${n}` built at runtime is invisible to it and would
 * render as a plain `grid` with one column. That's why this helper is a
 * switch over hand-written class strings rather than a template literal.
 * Keep every case literal: editing this file is the right place to add a
 * new `cardsPerRow` value, NOT inlining a different expression elsewhere.
 *
 * Used by: `WritingsTemplate.svelte` + `CollectionFeaturedWritings.svelte`
 * (read `writingConfig.cardsPerRow`) and `CollectionProjects.svelte` +
 * `CollectionFeaturedProjects.svelte` (read `projectsConfig.cardsPerRow`).
 * @module grid
 */

/**
 * Map a per-row card count to a responsive Tailwind grid class set.
 *
 * Defaults to 3 columns when the count is out of the supported range
 * (1-6). The `grid` base class is always included so callers can write
 * `<div class={gridColsClass(n)} ...>` without adding anything else.
 * @param perRow - Target number of cards per row at the largest breakpoint.
 * @returns Tailwind class string covering the responsive ramp from 1 → perRow.
 */
export function gridColsClass(perRow: number | undefined): string {
  switch (perRow) {
    case 1:
      return "grid";
    case 2:
      return "grid sm:grid-cols-2";
    case 3:
      return "grid sm:grid-cols-2 lg:grid-cols-3";
    case 4:
      return "grid sm:grid-cols-2 lg:grid-cols-4";
    case 5:
      return "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
    case 6:
      return "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";
    default:
      return "grid sm:grid-cols-2 lg:grid-cols-3";
  }
}
