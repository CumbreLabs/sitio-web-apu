#!/usr/bin/env node
/**
 * Required-paginas integrity check.
 *
 * Four page-IDs are load-bearing for the framework — if their paginas
 * markdown file is missing or its slug doesn't match the configured value,
 * core routes break at user-visit time with no build-time signal:
 *
 *   - `sitio.json#homePage`              → root `/` → resolves to `/<lang>/`
 *   - `escritos.json#writingPageId`      → `/<lang>/<writingId>/` listing
 *   - `portafolio.json#portfolioPageId`  → `/<lang>/<portfolioId>/` listing
 *   - `pie-de-pagina.json#privacyPageId` → footer privacy link target
 *
 * For each configured language under `siteConfig.languages`, this gate asserts:
 *   1. A `src/data/paginas/<lang>/<page-id>.md` file exists.
 *   2. Its frontmatter `settings.active` is not `false` (an inactive system
 *      page would be excluded from the page registry → same 404 outcome).
 *
 * Parallel to `check:nav-slugs` (navegacion → paginas resolution); together
 * they form a fork-safety bijection on the config → paginas surface.
 * @module scripts/checks/check-required-paginas
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CONFIG_DIR = "src/data/configuracion";
const PAGINAS_DIR = "src/data/paginas";
const PORTAFOLIO_DIR = "src/data/portafolio";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * The 4 system page-IDs we enforce. Each entry maps a config field path to a
 * one-line description of what breaks if the paginas file is missing.
 * Add a fifth row here if a fork introduces another required page-id.
 *
 * The optional `skipWhenEmpty` predicate lets a section be intentionally
 * disabled on a fork that doesn't use it (e.g. a personal site with no
 * photography portfolio). When the predicate returns true the page-id is
 * allowed to point at an inactive/missing paginas file without failing the
 * gate — the section is "not present" in the same way an empty navegacion
 * item would be hidden from the navbar.
 */
const REQUIRED = [
  {
    file: "sitio.json",
    field: "homePage",
    breaks: "root `/` and `/<lang>/` home routes 404",
  },
  {
    file: "escritos.json",
    field: "writingPageId",
    breaks: "writing list + post deep paths 404",
    // Allow a writing-less fork (e.g. a single-page marketing site): when every
    // locale's escritos data directory has no posts, the section has nothing to
    // render and a missing/inactive paginas file is the correct "route off"
    // signal — symmetric with the portfolio escape below.
    skipWhenEmpty: () => isWritingDataEmpty(),
  },
  {
    file: "portafolio.json",
    field: "portfolioPageId",
    breaks: "portfolio list + album deep paths 404",
    // Allow a portfolio-less fork: when every locale's portafolio data
    // directory is empty, the section has nothing to render and an inactive
    // paginas file is the correct signal that the route is intentionally off.
    skipWhenEmpty: () => isPortfolioDataEmpty(),
  },
  {
    file: "pie-de-pagina.json",
    field: "privacyPageId",
    breaks: "footer privacy link 404",
  },
];

/**
 * Whether every per-locale portfolio data directory contains zero album JSON
 * files. Treat a missing directory as empty for forks that delete it entirely.
 * @returns True when no portfolio content exists in any locale.
 */
function isPortfolioDataEmpty() {
  const root = join(ROOT, PORTAFOLIO_DIR);
  if (!existsSync(root)) return true;
  for (const lang of readdirSync(root)) {
    const langDir = join(root, lang);
    let entries;
    try {
      entries = readdirSync(langDir);
    } catch {
      continue;
    }
    if (entries.some((f) => f.endsWith(".json"))) return false;
  }
  return true;
}

/**
 * Whether every per-locale writing data directory contains zero post markdown
 * files. Treat a missing directory as empty for forks that delete it entirely.
 * Mirror of {@link isPortfolioDataEmpty} for the writing section.
 * @returns True when no writing content exists in any locale.
 */
function isWritingDataEmpty() {
  const root = join(ROOT, "src/data/escritos");
  if (!existsSync(root)) return true;
  for (const lang of readdirSync(root)) {
    const langDir = join(root, lang);
    let entries;
    try {
      entries = readdirSync(langDir);
    } catch {
      continue;
    }
    if (entries.some((f) => f.endsWith(".md"))) return false;
  }
  return true;
}

/**
 * Read sitio.json#languages from the default-locale (es) config. Mirrors
 * what the framework does at module load.
 * @returns Array of language codes.
 */
function getLanguages() {
  const sitioPath = join(ROOT, CONFIG_DIR, "es", "sitio.json");
  if (!existsSync(sitioPath)) {
    throw new Error(`Missing ${CONFIG_DIR}/es/sitio.json`);
  }
  const sitio = JSON.parse(readFileSync(sitioPath, "utf8"));
  const langs =
    Array.isArray(sitio.languages) && sitio.languages.length > 0 ? sitio.languages : ["es"];
  return langs;
}

/**
 * Read a config field from `<configDir>/<lang>/<file>` and return the named
 * top-level field. Returns null if the file is missing or the field is empty.
 * @param lang - Language code.
 * @param file - Config filename (e.g. "sitio.json").
 * @param field - Top-level field name.
 * @returns String value, or null when absent/empty.
 */
function readConfigField(lang, file, field) {
  const path = join(ROOT, CONFIG_DIR, lang, file);
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    const val = data[field];
    return typeof val === "string" && val.length > 0 ? val : null;
  } catch {
    return null;
  }
}

/**
 * Parse the YAML frontmatter of a paginas markdown file and return the
 * nested `settings.active` value. Defaults to `true` if the field is absent
 * (matches data.ts loader behavior). Returns `false` ONLY when the
 * frontmatter explicitly sets `active: false`.
 * @param path - Absolute path to the markdown file.
 * @returns Whether the page is active per its frontmatter.
 */
function isPageActive(path) {
  const text = readFileSync(path, "utf8");
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return true;
  // Match `  active: false` under `settings:`. We're lenient: a top-level
  // `active: false` would also count (paginas data.ts loader normalizes both).
  return !/^\s*active:\s*false\s*$/m.test(fm[1]);
}

let langs;
try {
  langs = getLanguages();
} catch (err) {
  console.error(`${RED}check-required-paginas: ${err.message}${RESET}`);
  process.exit(1);
}

const failures = [];
let pagesChecked = 0;

for (const { file, field, breaks, skipWhenEmpty } of REQUIRED) {
  // The default-locale value is the source of truth — `i18n: duplicate`
  // means every locale mirrors it. We still verify per-locale presence below.
  const pageId = readConfigField("es", file, field);
  const sectionDisabled = typeof skipWhenEmpty === "function" && skipWhenEmpty();
  if (!pageId) {
    if (sectionDisabled) continue;
    failures.push(
      `${file}#${field} is unset (defaults Spanish-only fallback in routes.ts; if you intentionally renamed it, set it explicitly)`,
    );
    continue;
  }
  for (const lang of langs) {
    pagesChecked++;
    const path = join(ROOT, PAGINAS_DIR, lang, `${pageId}.md`);
    if (!existsSync(path)) {
      if (sectionDisabled) continue;
      failures.push(
        `${lang}: missing src/data/paginas/${lang}/${pageId}.md (required by ${file}#${field}; would ${breaks})`,
      );
      continue;
    }
    if (!isPageActive(path)) {
      if (sectionDisabled) continue;
      failures.push(
        `${lang}: src/data/paginas/${lang}/${pageId}.md is settings.active=false (would ${breaks})`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`${RED}✗ check-required-paginas: ${failures.length} violation(s)${RESET}`);
  for (const v of failures) console.error(`  ${DIM}${v}${RESET}`);
  console.error(
    `\n  ${YELLOW}Fix:${RESET} create the missing paginas file, or update the config field to point at an existing page-id, or set active=true on the inactive page.`,
  );
  process.exit(1);
}

console.log(
  `${GREEN}check-required-paginas: ${pagesChecked} required page-id(s) across ${langs.length} locale(s) — all resolve.${RESET}`,
);
