/**
 * Minimal markdown renderer for short, trusted, config-supplied strings —
 * footer copyright / madeWith, header bios, hero subtitles. Handles only the
 * subset that those fields actually use:
 *
 *   - **bold** / __bold__ → `<strong>`
 *   - *italic* / _italic_ → `<em>`
 *   - `inline code` → `<code>` (with HTML-escape of content)
 *   - [label](url) → `<a>` with external-link hardening
 *   - Paragraph breaks on blank lines (block mode only)
 *
 * **Why ~80 lines of regex instead of `marked`?** Because `marked` is
 * ~15 KB gzipped and these call sites need maybe 1 KB of behavior. Body
 * markdown (writing posts, paginas bodies) is pre-rendered at build time
 * by `scripts/vite/rendered-pages.ts`, so the marked library never enters
 * the client bundle. This file is the runtime escape hatch for the handful
 * of inline strings that come from JSON config (not `.md` files) and so
 * can't be pre-rendered by the build-time plugin.
 *
 * The renderer is deliberately small so it can stay in the client bundle
 * without budget concern. If a future field needs lists / tables / code
 * fences, the right answer is to MOVE THAT FIELD INTO AN `.md` FILE so the
 * build-time pipeline can pre-render it — NOT to grow this module.
 *
 * Security: this runs on **trusted, author-controlled** content from
 * config JSON committed to git. There is no user input pathway here. The
 * sanitization step is belt-and-suspenders against a maintainer typo:
 * unsafe URL schemes are downgraded to `#`, and the link extractor uses a
 * null-byte stash so emphasis-pass regexes can't eat through the generated
 * `<a target="_blank">` markup.
 * @module inline-markdown
 */

/** Schemes accepted for `[label](url)` — anything else downgrades to `#`. */
const SAFE_HREF_RE = /^(?:https?:\/\/|mailto:|tel:|\/|#|\?)/i;

/**
 * HTML-escape special characters in text. Used inside inline-code rendering
 * (`\`code\`` → `<code>…</code>`) where the content must be escaped before
 * being placed between tags.
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
 * Apply inline emphasis + code + link formatting to a single chunk of text.
 * Process links FIRST and stash them out with `\x00<idx>\x00` so the bold /
 * italic regexes can't eat through the generated `<a>` markup. Same trick
 * the old `renderInline` in `$lib/markdown` used; see its test for the
 * invariant we're preserving (`**[click](url)**`).
 * @param text - Raw inline markdown text (already HTML-escaped at this point).
 * @returns Text with inline markup converted to HTML.
 */
function inlineFormat(text: string): string {
  const stash: string[] = [];

  // 1. Links: `[label](url)` → `<a>` (with target=_blank for external).
  let s = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
    const trimmed = url.trim();
    const isSafe = SAFE_HREF_RE.test(trimmed);
    const isExternal = /^https?:\/\//i.test(trimmed);
    const href = isSafe ? escapeHtml(trimmed) : "#";
    const extras = isExternal ? ` target="_blank" rel="noopener noreferrer"` : "";
    const html = `<a href="${href}"${extras}>${label}</a>`;
    stash.push(html);
    return `\x00${stash.length - 1}\x00`;
  });

  // 2. Inline code: `\`code\`` → `<code>…</code>`. Content HTML-escaped.
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${escapeHtml(code)}</code>`);

  // 3. Bold (must process before italic since `**` overlaps with `*`).
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // 4. Italic.
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");

  // 5. Restore stashed links.
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x00(\d+)\x00/g, (_m, idx: string) => stash[Number(idx)] ?? "");

  return s;
}

/**
 * Render a short inline-only markdown snippet (no block wrap — caller
 * already provides the surrounding `<p>` / `<h1>` / etc.).
 *
 * Use for: footer copyright, footer "made with", navbar brand text — any
 * one-liner that wants `**bold**` / `*italic*` / `[link]` but should
 * NOT generate its own paragraph wrapper.
 * @param text - Raw inline markdown.
 * @returns Inline HTML, no `<p>` wrap.
 */
export function renderInline(text: string): string {
  return inlineFormat(text);
}

/**
 * Render a multi-paragraph markdown string. Splits on blank lines, wraps
 * each paragraph in `<p>`, applies inline formatting to each.
 *
 * Use for: header bio (config JSON, one or two paragraphs of prose with
 * occasional bold + links). For anything more complex (headings, lists,
 * code fences), move the field into an `.md` file and let the build-time
 * pipeline render it.
 * @param text - Raw block markdown (paragraphs separated by blank lines).
 * @returns Block HTML — sequence of `<p>` elements with inline markup.
 */
export function renderBlock(text: string): string {
  if (!text) return "";
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${inlineFormat(p)}</p>`)
    .join("\n");
}
