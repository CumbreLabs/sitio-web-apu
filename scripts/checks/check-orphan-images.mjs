#!/usr/bin/env node
/**
 * Orphan-image sweep (AUDIT_CHECKLIST.md #17.9).
 *
 * Walks every image under `static/media/`, then walks every JSON / Markdown /
 * Svelte / TS source for `/media/<file>` references. Any image with zero
 * references is flagged as orphaned (bloats the deploy artifact, may indicate
 * a forgotten cleanup after a content rename).
 *
 * Inverse of `scripts/check-image-paths.mjs` (which verifies referenced paths
 * exist on disk). Run together they form a bijection: every reference resolves,
 * and every file is referenced.
 *
 * Notes:
 *   - `static/srcset/`, `static/og/`, `static/favicon/` are derived from
 *     `static/media/` + generators; their orphans are caught by the generators
 *     deleting stale outputs. We only sweep `static/media/`.
 *   - `favicon` source declared in `sitio.json#favicon` counts as a reference.
 *   - Reports orphans as a warning by default (informational); pass `--strict`
 *     to fail the build. CI may eventually want strict; for now, drop-in.
 * @module scripts/checks/check-orphan-images
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const MEDIA = "static/media";
const SCAN_DIRS = ["src/data", "src/lib", "src/routes", "src/params", "static/admin"];
const SCAN_EXTS = new Set([
  ".json",
  ".md",
  ".svelte",
  ".ts",
  ".mjs",
  ".js",
  ".html",
  ".yml",
  ".yaml",
]);
const IMAGE_EXTS = new Set([".webp", ".jpg", ".jpeg", ".png", ".avif", ".gif", ".svg", ".ico"]);
const STRICT = process.argv.includes("--strict");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Recursively yield every file path under a directory.
 * @param dir - Directory to walk.
 * @yields {string} Relative file paths.
 */
function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

if (!existsSync(MEDIA) || !statSync(MEDIA).isDirectory()) {
  console.error(`${RED}check-orphan-images: ${MEDIA}/ not found.${RESET}`);
  process.exit(1);
}

// 1. Gather every image file basename under static/media/
const mediaFiles = new Map(); // basename -> relative path
for (const file of walk(MEDIA)) {
  const ext = extname(file).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) continue;
  const basename = file.slice(MEDIA.length + 1); // strip "static/media/"
  mediaFiles.set(basename, file);
}

// 2. Scan source files for `/media/<basename>` references.
const referenced = new Set();
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    if (!SCAN_EXTS.has(extname(file).toLowerCase())) continue;
    const text = readFileSync(file, "utf8");
    for (const basename of mediaFiles.keys()) {
      if (referenced.has(basename)) continue;
      if (text.includes(`/media/${basename}`)) {
        referenced.add(basename);
      }
    }
  }
}

const orphans = [...mediaFiles.keys()].filter((b) => !referenced.has(b)).sort();

if (orphans.length === 0) {
  console.log(`${GREEN}check-orphan-images: ${mediaFiles.size} images, all referenced.${RESET}`);
  process.exit(0);
}

const totalBytes = orphans.reduce((sum, b) => sum + statSync(join(MEDIA, b)).size, 0);
const totalKb = (totalBytes / 1024).toFixed(1);

const colour = STRICT ? RED : YELLOW;
const mark = STRICT ? "✗" : "⚠";
console.error(
  `${colour}${mark} check-orphan-images: ${orphans.length} unreferenced image(s) (${totalKb} KB)${RESET}`,
);
for (const o of orphans.slice(0, 30)) {
  const path = relative(ROOT, join(MEDIA, o));
  const bytes = statSync(join(MEDIA, o)).size;
  console.error(`  ${DIM}${path}${RESET}  ${(bytes / 1024).toFixed(1)} KB`);
}
if (orphans.length > 30) {
  console.error(`  ${DIM}... and ${orphans.length - 30} more${RESET}`);
}
console.error(
  `\n  ${YELLOW}Hint:${RESET} delete if truly unused, or add the missing reference. Pass ${DIM}--strict${RESET} to fail the build on orphans.`,
);

process.exit(STRICT ? 1 : 0);
