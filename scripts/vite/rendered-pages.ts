/**
 * Vite plugin: build-time markdown rendering.
 *
 * Walks every `.md` file under `src/data/escritos/` + `src/data/paginas/`
 * at build time and produces a fully-rendered HTML string (with frontmatter
 * parsed, Shiki code highlighting baked in, Pandoc-style image attrs
 * expanded, external links hardened with `target=_blank rel=noopener`,
 * responsive `srcset` + `width`/`height` injected on `/media/` images, and
 * the output run through `sanitize-html`). The result map is exposed via
 * the `virtual:rendered-pages` virtual module:
 *
 * ```ts
 * import renderedPages from "virtual:rendered-pages";
 * const entry = renderedPages["src/data/escritos/es/foo.md"];
 * // entry.meta     — gray-matter–parsed frontmatter
 * // entry.html     — pre-rendered, sanitized HTML
 * // entry.headings — extracted H2/H3 list for sidebar TOC
 * // entry.body     — raw markdown body (kept for diagnostics / counts)
 * ```
 *
 * **Why this exists.** Before this plugin landed, every page in the client
 * bundle pulled in `marked` (~15 KB gzip) + a Shiki-pre-tokenized HTML map
 * (~20–30 KB gzip) + `marked-gfm-heading-id` + `github-slugger` +
 * `src/lib/markdown.ts`'s 280-line render pipeline + `src/lib/frontmatter.ts`'s
 * YAML parser. None of that runs at hydration on an SSG site — the HTML
 * is already in the page when the JS loads. This plugin moves all of it to
 * the Node-only Vite layer; the client just consumes the pre-rendered HTML
 * via Svelte's html-rendering directive.
 *
 * **Replaces** the older `virtual:highlighted-code` plugin: that one
 * pre-tokenized only the code blocks and still required `marked` at
 * runtime to assemble surrounding HTML. With full build-time rendering,
 * the entire markdown machinery is server-only.
 * @module scripts/vite/rendered-pages
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Marked, type Tokens } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";
import GithubSlugger from "github-slugger";
import matter from "gray-matter";
import sanitizeHtml from "sanitize-html";
import { createHighlighter, type BundledLanguage, type BundledTheme } from "shiki";
import type { Plugin } from "vite";

/** A single rendered markdown file's exposed shape. */
export interface RenderedPage {
  /** Frontmatter object (arbitrary YAML — `meta.date` is normalized to YYYY-MM-DD string). */
  meta: Record<string, unknown>;
  /** Fully-rendered, sanitized HTML — ready for Svelte's html-render directive. */
  html: string;
  /** Extracted H2/H3 headings for sidebar TOC. */
  headings: { id: string; label: string; level: 2 | 3 }[];
  /** Raw markdown body (kept for word-count + diagnostics; not for rendering). */
  body: string;
}

/** Options for {@link renderedPagesPlugin}. */
export interface RenderedPagesOptions {
  /**
   * Content roots to scan recursively for `.md` files. Paths are relative
   * to the project root.
   */
  contentRoots: string[];
  /**
   * Shiki theme pair for code blocks. Generates dual-theme HTML with
   * `color: X; --shiki-dark: Y` inline styles that pair with the
   * `[data-theme="dark"]` CSS swap in `app.css`.
   */
  themes?: { light: BundledTheme; dark: BundledTheme };
  /**
   * Code-block languages to load into the Shiki highlighter at build time.
   * Unknown languages fall back to plain `<pre><code class="language-X">`.
   */
  langs?: BundledLanguage[];
  /**
   * Responsive srcset widths to emit on `/media/` images. The plugin reads
   * `static/srcset/` directly to know which variants actually exist.
   */
  srcsetWidths?: number[];
}

const VIRTUAL_ID = "virtual:rendered-pages";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const DEFAULT_LANGS: BundledLanguage[] = [
  "bash",
  "sh",
  "shell",
  "json",
  "yaml",
  "yml",
  "css",
  "html",
  "python",
  "py",
  "javascript",
  "js",
  "typescript",
  "ts",
  "tsx",
  "jsx",
  "markdown",
  "md",
];

const DEFAULT_THEMES = { light: "github-light", dark: "github-dark-dimmed" } as const;
const DEFAULT_SRCSET_WIDTHS = [480, 768, 1080];

/** YYYY-MM-DD pattern check on gray-matter Date → string normalization. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/;

/**
 * Recursively walk a directory yielding `.md` file paths.
 * @param dir - Absolute directory to walk.
 * @yields {string} Absolute file paths ending in `.md`.
 */
function* walkMd(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkMd(p);
    else if (entry.name.endsWith(".md")) yield p;
  }
}

/**
 * Walk gray-matter's parsed data tree and coerce `Date` objects (which YAML
 * date-parsing produces from unquoted `2021-01-01` literals) back into
 * `YYYY-MM-DD` strings. The rest of the codebase expects strings — sort
 * comparators call `.localeCompare`, route templates slice into URL segments.
 * @param value - Any value from gray-matter's parsed `data` tree.
 * @returns The same structure with Date → string normalized.
 */
function normalizeDates(value: unknown): unknown {
  if (value instanceof Date) {
    const iso = value.toISOString();
    return ISO_DATE_RE.test(iso) ? iso.slice(0, 10) : iso;
  }
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeDates(v);
    return out;
  }
  return value;
}

/**
 * HTML-escape a string for safe insertion as text or attribute value.
 * @param text - Raw text to escape.
 * @returns HTML-safe string with `&`, `<`, `>`, `"` replaced by entities.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Parse a trailing Pandoc-style attribute block off image alt text.
 * `hero{.centered .max-w-md #fig-1 data-zoom=true}` →
 *   `{ alt: "hero", classes: ["centered", "max-w-md"], id: "fig-1", attrs: [["data-zoom", "true"]] }`.
 * @param text - Raw alt text from marked (may include trailing `{…}` block).
 * @returns Extracted alt + classes + id + arbitrary key/value attrs.
 */
function parseImageAttrs(text: string): {
  alt: string;
  classes: string[];
  id: string;
  attrs: Array<[string, string]>;
} {
  const match = text.match(/^(.*?)\s*\{([^}]+)\}\s*$/);
  if (!match) return { alt: text, classes: [], id: "", attrs: [] };
  const alt = match[1]!;
  const raw = match[2]!;
  const classes: string[] = [];
  let id = "";
  const attrs: Array<[string, string]> = [];
  const tokenRe = /\.([\w-]+)|#([\w-]+)|([\w-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  for (const tok of raw.matchAll(tokenRe)) {
    if (tok[1]) classes.push(tok[1]);
    else if (tok[2]) id = tok[2];
    else if (tok[3]) attrs.push([tok[3], tok[4] ?? tok[5] ?? tok[6] ?? ""]);
  }
  return { alt, classes, id, attrs };
}

/**
 * Scan `static/srcset/` to build the set of variant filenames that exist
 * on disk. The plugin only emits a `srcset=` attribute pointing at variants
 * we can actually deliver — missing variants are a build-time signal that
 * `optimize-images.mjs` hasn't run for a new source image, NOT an in-the-wild
 * 404 the visitor sees.
 * @param projectRoot - Absolute project root (where `static/` lives).
 * @returns Set of all `/srcset/<file>` paths present on disk.
 */
function loadSrcsetSet(projectRoot: string): Set<string> {
  const dir = join(projectRoot, "static", "srcset");
  if (!existsSync(dir)) return new Set();
  const out = new Set<string>();
  for (const name of readdirSync(dir)) out.add(`/srcset/${name}`);
  return out;
}

/**
 * Build an image-dimensions map by walking `static/media/` with sharp at
 * build time. Same idea as `scripts/vite/image-dims.ts`'s virtual module
 * but duplicated here so this plugin is self-contained (no inter-plugin
 * dependency, no load-order constraints — Vite plugins can't import each
 * other's virtual modules during their own `load` hook).
 * @param projectRoot - Absolute project root.
 * @returns Map of `/media/<file>` → `[width, height]` for every measured image.
 */
async function loadImageDimsMap(projectRoot: string): Promise<Map<string, [number, number]>> {
  const out = new Map<string, [number, number]>();
  const mediaDir = join(projectRoot, "static", "media");
  if (!existsSync(mediaDir)) return out;
  const sharp = (await import("sharp")).default;
  for (const name of readdirSync(mediaDir)) {
    if (!/\.(webp|jpg|jpeg|png)$/i.test(name)) continue;
    try {
      const meta = await sharp(join(mediaDir, name)).metadata();
      if (meta.width && meta.height) {
        out.set(`/media/${name}`, [meta.width, meta.height]);
      }
    } catch {
      // Unreadable — markdown renderer just won't emit width/height for it.
    }
  }
  return out;
}

/**
 * Build a configured `Marked` instance with our custom renderers:
 *   - Heading IDs from `marked-gfm-heading-id` (GitHub-style with collision dedup).
 *   - Code blocks tokenized by Shiki with dual light/dark theme output.
 *   - Pandoc-style image attributes (`![alt](src){.class #id}`) preserved.
 *   - `/media/` images get `srcset` + `width`/`height` injected (LCP-friendly).
 *   - External links get `target="_blank"` + `rel="noopener noreferrer"`.
 *   - Unsafe URI schemes (`javascript:`, `vbscript:`, `data:text/*`) downgrade to `#`.
 * @param highlighter - Pre-loaded Shiki highlighter with the configured themes + langs.
 * @param themes - Light/dark theme pair (passed through to Shiki's `codeToHtml`).
 * @param themes.light - Light-mode Shiki theme name.
 * @param themes.dark - Dark-mode Shiki theme name (rendered into `--shiki-dark` CSS vars).
 * @param srcsetWidths - Widths to consult when emitting srcset attributes.
 * @param srcsetSet - Set of `/srcset/<file>` paths that actually exist on disk.
 * @param imageDims - Map of `/media/<file>` → `[width, height]`.
 * @returns Configured marked instance plus a reset hook for the LCP-image counter.
 */
function configureMarked(
  highlighter: Awaited<ReturnType<typeof createHighlighter>>,
  themes: { light: BundledTheme; dark: BundledTheme },
  srcsetWidths: number[],
  srcsetSet: Set<string>,
  imageDims: Map<string, [number, number]>,
): { marked: Marked; resetImgIndex: () => void } {
  // Track whether we've emitted the LCP candidate (first img). Reset per-file.
  let imgIndex = 0;
  const resetImgIndex = () => {
    imgIndex = 0;
  };

  const m = new Marked({ gfm: true, breaks: false });
  m.use(gfmHeadingId());
  m.use({
    renderer: {
      code({ text, lang }: Tokens.Code) {
        const language = (lang ?? "").trim().toLowerCase();
        if (language && highlighter.getLoadedLanguages().includes(language as BundledLanguage)) {
          try {
            return (
              highlighter.codeToHtml(text, {
                lang: language as BundledLanguage,
                themes,
                defaultColor: false,
              }) + "\n"
            );
          } catch {
            // Fall through to plain rendering.
          }
        }
        const classAttr = language ? ` class="language-${escapeHtml(language)}"` : "";
        return `<pre><code${classAttr}>${escapeHtml(text)}</code></pre>\n`;
      },
      image({ href, title, text }: Tokens.Image) {
        const { alt, classes, id, attrs } = parseImageAttrs(text);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        const classAttr = classes.length > 0 ? ` class="${escapeHtml(classes.join(" "))}"` : "";
        const idAttr = id ? ` id="${escapeHtml(id)}"` : "";
        const extraAttrs = attrs.map(([k, v]) => ` ${escapeHtml(k)}="${escapeHtml(v)}"`).join("");

        // Respect explicit width/height attrs the author passed via Pandoc
        // syntax; otherwise injection-pass below handles dimensions.
        let img = `<img src="${escapeHtml(href)}" alt="${escapeHtml(alt)}"${titleAttr}${classAttr}${idAttr}${extraAttrs}`;

        // Inject responsive srcset + width/height for /media/ sources that
        // have build-time variants. First image is the LCP candidate.
        if (href.startsWith("/media/") && /\.(webp|jpg|jpeg|png)$/i.test(href)) {
          const dot = href.lastIndexOf(".");
          const ext = href.substring(dot);
          const base = href.substring(0, dot).replace("/media/", "/srcset/");
          const available = srcsetWidths.filter((w) => srcsetSet.has(`${base}@${w}${ext}`));
          if (available.length > 0) {
            const srcset = available.map((w) => `${base}@${w}${ext} ${w}w`).join(", ");
            img += ` srcset="${srcset}" sizes="(min-width: 768px) 768px, 100vw"`;
          }
          const dim = imageDims.get(href);
          if (dim && !extraAttrs.includes("width=")) img += ` width="${dim[0]}" height="${dim[1]}"`;
        }

        const isLcp = imgIndex === 0;
        imgIndex++;
        if (isLcp) {
          img += ' loading="eager" fetchpriority="high"';
        } else {
          img += ' loading="lazy"';
        }
        img += ' decoding="async" />';
        return img;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const label = this.parser.parseInline(tokens);
        const trimmed = href.trim();
        const isSafe =
          /^https?:\/\//i.test(trimmed) ||
          /^mailto:/i.test(trimmed) ||
          /^tel:/i.test(trimmed) ||
          trimmed.startsWith("/") ||
          trimmed.startsWith("#") ||
          trimmed.startsWith("?");
        const safeHref = isSafe ? escapeHtml(trimmed) : "#";
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        if (/^https?:\/\//i.test(trimmed)) {
          return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${label}</a>`;
        }
        return `<a href="${safeHref}"${titleAttr}>${label}</a>`;
      },
    },
  });

  return { marked: m, resetImgIndex };
}

/**
 * Extract H2/H3 headings from raw markdown for the sidebar TOC. Uses a fresh
 * `GithubSlugger` per call so duplicate headings get the `-1`, `-2` suffix
 * treatment that `marked-gfm-heading-id` applies on the rendered `<h2>` /
 * `<h3>` — same instance type + lowercase pre-treatment, so a sidebar link
 * to the second "Setup" actually scrolls to it.
 * @param markdown - Raw markdown content.
 * @returns Ordered list of `{ id, label, level }` heading items.
 */
function extractHeadings(markdown: string): RenderedPage["headings"] {
  const items: RenderedPage["headings"] = [];
  const slugger = new GithubSlugger();
  let inCodeBlock = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1]!.length as 2 | 3;
      const text = match[2]!.trim();
      items.push({ id: slugger.slug(text.toLowerCase()), label: text, level });
    }
  }
  return items;
}

/** sanitize-html rule set — permissive for our trusted-author content. */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  // Allow the union of marked's output tags + our custom additions.
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "hr",
    "strong",
    "em",
    "u",
    "s",
    "del",
    "ins",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "picture",
    "source",
    "code",
    "pre",
    "span",
    "div",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "figure",
    "figcaption",
  ],
  allowedAttributes: {
    "*": ["id", "class", "data-*", "aria-*", "title", "role"],
    a: ["href", "name", "target", "rel", "title"],
    img: [
      "src",
      "srcset",
      "sizes",
      "alt",
      "title",
      "width",
      "height",
      "loading",
      "decoding",
      "fetchpriority",
    ],
    span: ["style"], // Shiki emits inline color styles
    code: ["class"],
    pre: ["class", "tabindex", "style"],
    th: ["align", "scope"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] }, // allow data:image for inlines
  allowProtocolRelative: false,
  // Permit `style="..."` only on `<span>` (Shiki) — strip all other inline styles.
  // The per-tag allow-list above already handles this.
};

/**
 * Build the rendered-pages plugin.
 * @param opts - Plugin options (content roots, Shiki theme/langs, srcset widths).
 * @returns A Vite plugin.
 */
export default function renderedPagesPlugin(opts: RenderedPagesOptions): Plugin {
  let projectRoot = process.cwd();
  let cache: Record<string, RenderedPage> | null = null;
  // Per-build set of `.md` files we've ever rendered, for HMR invalidation.
  const watchedFiles = new Set<string>();

  /**
   * Build the full per-file map. Runs once per `load`; lazy because Vite
   * may evaluate the virtual module multiple times during a build.
   * @returns Promise resolving to the full rendered-pages map.
   */
  async function build(): Promise<Record<string, RenderedPage>> {
    if (cache) return cache;
    const themes = opts.themes ?? DEFAULT_THEMES;
    const highlighter = await createHighlighter({
      themes: [themes.light, themes.dark],
      langs: opts.langs ?? DEFAULT_LANGS,
    });
    const srcsetWidths = opts.srcsetWidths ?? DEFAULT_SRCSET_WIDTHS;
    const srcsetSet = loadSrcsetSet(projectRoot);
    const imageDims = await loadImageDimsMap(projectRoot);
    const { marked, resetImgIndex } = configureMarked(
      highlighter,
      themes,
      srcsetWidths,
      srcsetSet,
      imageDims,
    );

    const out: Record<string, RenderedPage> = {};
    for (const root of opts.contentRoots) {
      const abs = join(projectRoot, root);
      for (const file of walkMd(abs)) {
        watchedFiles.add(file);
        const raw = readFileSync(file, "utf-8");
        const parsed = matter(raw);
        resetImgIndex();
        const rawHtml = (await marked.parse(parsed.content)) as string;
        const safeHtml = sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
        const key = relative(projectRoot, file).replaceAll("\\", "/");
        out[key] = {
          meta: normalizeDates(parsed.data ?? {}) as Record<string, unknown>,
          html: safeHtml,
          headings: extractHeadings(parsed.content),
          body: parsed.content ?? "",
        };
      }
    }
    cache = out;
    return out;
  }

  return {
    name: "rendered-pages",
    enforce: "pre",
    configResolved(config) {
      projectRoot = config.root;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null;
      const out = await build();
      // Serialize JSON literal then export as default. JSON.stringify is safe
      // here because every value is plain (no functions, no refs, no Dates —
      // we coerced those above).
      return `export default ${JSON.stringify(out)};`;
    },
    configureServer(server) {
      // HMR: invalidate the virtual module whenever any tracked `.md` changes.
      const invalidate = (file: string) => {
        if (!file.endsWith(".md")) return;
        // Only invalidate for files inside our content roots.
        const inScope = opts.contentRoots.some((root) => file.startsWith(join(projectRoot, root)));
        if (!inScope && !watchedFiles.has(file)) return;
        cache = null;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      server.watcher.on("add", invalidate);
      server.watcher.on("change", invalidate);
      server.watcher.on("unlink", invalidate);
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.endsWith(".md")) return;
      const inScope = opts.contentRoots.some((root) =>
        ctx.file.startsWith(join(projectRoot, root)),
      );
      if (!inScope && !watchedFiles.has(ctx.file)) return;
      cache = null;
      const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_ID);
      return mod ? [mod, ...ctx.modules] : ctx.modules;
    },
  };
}
