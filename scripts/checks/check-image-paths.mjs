/**
 * Walk every JSON + frontmatter file under src/data/ and verify that every
 * image path it references actually exists on disk under static/. Catches
 * broken refs the moment a content editor renames or deletes a file but forgets to
 * update the corresponding JSON.
 *
 * Exit code:
 *   0 — all referenced paths exist
 *   1 — one or more dangling references (printed to stderr)
 *
 * Runs in pre-commit + CI. No external deps — just node:fs.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PUBLIC = join(ROOT, "static");
const DATA_DIR = join(ROOT, "src", "data");
const SOURCE_DIRS = [join(ROOT, "src", "lib"), join(ROOT, "src", "routes")];

// Match literal `/media/...`, `/srcset/...`, `/favicon/...` paths in source.
// Limited to file extensions we care about so we don't false-positive on
// route paths like "/en/about/".
const SOURCE_PATH_RE =
  /\/(media|srcset|favicon)\/[A-Za-z0-9._/@-]+\.(?:webp|png|jpe?g|svg|ico|pdf|avif)/g;

const URL_KEYS = new Set([
  "src",
  "coverSrc",
  "logo",
  "photo",
  "thumbnail",
  "ogImage",
  "backgroundImage",
  "image",
  "favicon",
  "defaultOGImage",
  "defaultBackgroundImage",
  "file",
]);

/**
 * Recursively yield every regular file under `dir`.
 * @param dir - Absolute directory path to walk.
 * @yields {string} Absolute file path of each regular file.
 */
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/**
 * Verify a public URL like "/media/foo.webp" exists under static/.
 * @param value - Candidate value from a JSON or frontmatter field.
 * @param source - Origin file path for error reporting.
 * @param refs - Mutable accumulator for dangling references.
 */
function checkPath(value, source, refs) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/")) return;
  const clean = trimmed.split(/[?#]/)[0];
  if (!clean) return;
  const ext = extname(clean).toLowerCase();
  if (!ext) return;
  const onDisk = join(PUBLIC, clean.replace(/^\//, ""));
  if (!existsSync(onDisk) || !statSync(onDisk).isFile()) {
    refs.push({ value: clean, source });
  }
}

/**
 * Recurse any JSON/parsed-yaml structure, calling checkPath on string values
 * whose key matches URL_KEYS.
 * @param node - Tree node to walk.
 * @param source - Origin file path for error reporting.
 * @param refs - Mutable accumulator for dangling references.
 */
function walkJson(node, source, refs) {
  if (Array.isArray(node)) {
    for (const item of node) walkJson(item, source, refs);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, val] of Object.entries(node)) {
      if (URL_KEYS.has(key)) checkPath(val, source, refs);
      else walkJson(val, source, refs);
    }
  }
}

/**
 * Tiny frontmatter parser — just what's needed for image-key extraction.
 * @param text - Raw file contents including YAML frontmatter.
 * @returns Object map of key to scalar value.
 */
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const obj = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    let val = m[3].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    obj[m[2]] = val;
  }
  return obj;
}

/**
 * Pull every Markdown image src out of a body.
 * @param body - Markdown body (with frontmatter already stripped).
 * @returns Array of image src strings.
 */
function extractMarkdownImages(body) {
  const out = [];
  const re = /!\[[^\]]*\]\(([^)\s]+)/g;
  let m;
  while ((m = re.exec(body)) !== null) out.push(m[1]);
  return out;
}

const refs = [];
let scanned = 0;

for (const file of walk(DATA_DIR)) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf-8");
  scanned++;

  if (file.endsWith(".json")) {
    try {
      walkJson(JSON.parse(text), rel, refs);
    } catch (err) {
      console.warn("  skipping " + rel + " (invalid JSON: " + err.message + ")");
    }
  } else if (file.endsWith(".md")) {
    const fm = parseFrontmatter(text);
    walkJson(fm, rel, refs);
    const body = text.replace(/^---[\s\S]*?\n---\n?/, "");
    for (const src of extractMarkdownImages(body)) {
      checkPath(src, rel + " (markdown body)", refs);
    }
  }
}

// Second pass — sweep .svelte / .ts source for hardcoded `/media/...` etc.
// Catches sitemap, layout, and any component that embeds an asset path as a
// string literal (e.g. JSON-LD image fields). JSDoc comments are filtered out
// (the regex only matches valid file extensions, but example paths in JSDoc
// can still hit — we skip them by detecting the `* @param` pattern context).
for (const dir of SOURCE_DIRS) {
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (!/\.(svelte|ts|js)$/.test(file)) continue;
    // Vitest fixture files reference stub image paths like
    // `/media/test-landscape.webp` that never exist on disk by design —
    // they're inputs to mocked `imgDims`/`virtual:srcset-manifest` Sets.
    // Walking them would false-positive on every stub.
    if (/\.(test|spec)\.(ts|js)$/.test(file)) continue;
    const rel = relative(ROOT, file);
    const text = readFileSync(file, "utf-8");
    scanned++;
    for (const match of text.matchAll(SOURCE_PATH_RE)) {
      const path = match[0];
      // Skip JSDoc/comment example paths — line starts with `*` or `//`.
      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      const lineHead = text.slice(lineStart, match.index).trimStart();
      if (lineHead.startsWith("*") || lineHead.startsWith("//")) continue;
      checkPath(path, rel, refs);
    }
  }
}

if (refs.length === 0) {
  console.log("check-image-paths: " + scanned + " files scanned, all referenced paths exist.");
  process.exit(0);
}

console.error("check-image-paths: " + refs.length + " dangling reference(s):");
for (const { value, source } of refs) {
  console.error("  x " + value + "  (in " + source + ")");
}
process.exit(1);
