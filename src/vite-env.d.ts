declare module "virtual:srcset-manifest" {
  const files: Set<string>;
  export default files;
}

declare module "virtual:image-dims" {
  /** Map of public image URL (e.g. "/media/foo.webp") to [width, height] in pixels. */
  const dims: Map<string, [number, number]>;
  export default dims;
}

declare module "virtual:og-manifest" {
  /** Set of public OG-variant URLs (e.g. "/og/album-foo.webp"), 1200×630 by construction. */
  const files: Set<string>;
  export default files;
}

declare module "virtual:rendered-pages" {
  /**
   * Build-time map of every `.md` file under the configured content roots
   * (`src/data/escritos/` + `src/data/paginas/`). Each entry carries pre-
   * rendered, sanitized HTML, parsed frontmatter, and pre-extracted H2/H3
   * headings — ready for direct Svelte html-render consumption with no
   * client-side markdown parsing.
   *
   * Populated by `scripts/vite/rendered-pages.ts`; consumed by the data
   * loaders in `$lib/data/`. The runtime `marked` library, Shiki cache, and
   * markdown sanitizer all live inside the plugin and never enter the
   * client bundle.
   */
  const pages: Record<
    string,
    {
      /** Frontmatter object (Date values normalized to `YYYY-MM-DD` strings). */
      meta: Record<string, unknown>;
      /** Fully-rendered, sanitized HTML — feed straight into Svelte's html-render directive. */
      html: string;
      /** H2/H3 sidebar headings, pre-extracted in document order. */
      headings: { id: string; label: string; level: 2 | 3 }[];
      /** Raw markdown body (for wordCount + LCP-image extraction heuristics). */
      body: string;
    }
  >;
  export default pages;
}
