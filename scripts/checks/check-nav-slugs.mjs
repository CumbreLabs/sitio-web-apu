#!/usr/bin/env node
/**
 * Navegacion key ↔ paginas slug parity check.
 *
 * Every `navegacion.json#items[].key` must match a real page id (frontmatter
 * `slug`) under `src/data/paginas/{lang}/*.md` for the same language. Today
 * `buildNavItems` in `src/lib/data.ts` falls back to using the `key` AS the
 * path when no page resolves — so a typo (`"sobre_mi"` instead of
 * `"sobre-mi"`) silently renders a navbar link to a 404.
 *
 * This gate fails the build before that ships. Runs per-language: each
 * locale's navegacion can have its own item set (entirely valid for forks).
 *
 * Inactive items (`active: false`) are still checked — if the editor flips
 * one back to active later, the `key` had better still resolve.
 * @module scripts/checks/check-nav-slugs
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CONFIG_DIR = "src/data/configuracion";
const PAGINAS_DIR = "src/data/paginas";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Detect the available languages by listing `src/data/configuracion/`.
 * Mirrors the convention of every other content collection: one subfolder
 * per locale, name matching `siteConfig.languages`.
 * @returns Language codes (e.g. ["es", "en"]).
 */
function detectLanguages() {
  const abs = join(ROOT, CONFIG_DIR);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/**
 * Extract `slug:` from a markdown file's frontmatter. Falls back to the
 * filename (without `.md`) if no `slug:` line is found — matches what
 * `data.ts` does when it loads pages.
 * @param path - Absolute path to the markdown file.
 * @returns The slug (page id) for this page.
 */
function extractSlug(path) {
  const text = readFileSync(path, "utf8");
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) {
    const slugLine = fm[1].match(/^slug:\s*["']?([a-z0-9-]+)["']?\s*$/m);
    if (slugLine) return slugLine[1];
    // Some paginas declare slug nested under settings:
    const settingsSlug = fm[1].match(/^\s+slug:\s*["']?([a-z0-9-]+)["']?\s*$/m);
    if (settingsSlug) return settingsSlug[1];
  }
  return path.split("/").pop().replace(/\.md$/, "");
}

/**
 * Gather every paginas slug for a given language.
 * @param lang - Language code.
 * @returns Set of slugs (page ids).
 */
function gatherPageSlugs(lang) {
  const abs = join(ROOT, PAGINAS_DIR, lang);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return new Set();
  const slugs = new Set();
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    slugs.add(extractSlug(join(abs, entry.name)));
    // Also accept the filename-stem as a valid id (data.ts uses it as the
    // primary key; the frontmatter `slug` is just the URL segment).
    slugs.add(entry.name.replace(/\.md$/, ""));
  }
  return slugs;
}

const languages = detectLanguages();
if (languages.length === 0) {
  console.error(`${RED}check-nav-slugs: no languages found under ${CONFIG_DIR}/${RESET}`);
  process.exit(1);
}

const failures = [];
let itemsChecked = 0;

for (const lang of languages) {
  const navPath = join(ROOT, CONFIG_DIR, lang, "navegacion.json");
  if (!existsSync(navPath)) {
    failures.push(`Missing ${CONFIG_DIR}/${lang}/navegacion.json`);
    continue;
  }
  const nav = JSON.parse(readFileSync(navPath, "utf8"));
  const items = Array.isArray(nav.items) ? nav.items : [];
  const knownSlugs = gatherPageSlugs(lang);
  for (const item of items) {
    itemsChecked++;
    if (typeof item.key !== "string" || !item.key) {
      failures.push(`${lang}: nav item missing 'key' field`);
      continue;
    }
    // Anchor items (single-page sites) point at an in-page section id, not a
    // paginas slug — they resolve to `/#<key>`, so skip the slug-parity check.
    if (item.anchor === true) continue;
    if (!knownSlugs.has(item.key)) {
      const known = [...knownSlugs].sort().join(", ");
      failures.push(
        `${lang}/navegacion.json: key="${item.key}" does not match any paginas slug. Available: ${known || "(none)"}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`${RED}✗ check-nav-slugs: ${failures.length} violation(s)${RESET}`);
  for (const v of failures.slice(0, 20)) console.error(`  ${DIM}${v}${RESET}`);
  if (failures.length > 20) {
    console.error(`  ${DIM}... and ${failures.length - 20} more${RESET}`);
  }
  console.error(
    `\n  ${YELLOW}Fix:${RESET} either correct the typo in navegacion.json or create the missing paginas/${"{lang}"}/<key>.md`,
  );
  process.exit(1);
}

console.log(
  `${GREEN}check-nav-slugs: ${itemsChecked} nav item(s) across ${languages.length} locale(s) — all keys resolve.${RESET}`,
);
