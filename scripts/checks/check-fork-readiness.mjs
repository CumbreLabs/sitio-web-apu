#!/usr/bin/env node
/**
 * Verify the codebase remains fork-ready.
 *
 * Per AUDIT_CHECKLIST.md #18, this gate enforces that framework code in
 * `src/lib/`, `src/routes/`, and `src/params/` does not carry per-site
 * literals — those belong in `src/data/configuracion/{lang}/*.json` and
 * `src/theme.css` so a fork edits data + tokens, not code.
 *
 * Six checks (each maps to one row in AUDIT_CHECKLIST.md #18):
 *   18.1 — No hardcoded brand strings (arenalucia / Arena / Bogotá / …)
 *   18.2 — No hex color literals (`#a85008` etc.) — use theme.css tokens
 *   18.3 — No hardcoded section IDs in dispatch code (`"escritos"` / `"portfolio"`)
 *   18.4 — `src/params/lang.ts` matcher reads from `getSupportedLanguages()`
 *   18.5 — No hardcoded BCP-47 / OG locale codes — use `getOgLocale()`
 *   18.6 — All 8 config files present for every language in `sitio.json#languages`
 *
 * Runs in pre-commit + CI; fails the build on any violation. Comments / JSDoc /
 * test fixtures are excluded since they legitimately use these tokens to
 * explain or test what the framework code abstracts.
 * @module scripts/checks/check-fork-readiness
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_DIRS = ["src/lib", "src/routes", "src/params"];
const SOURCE_EXT = /\.(ts|svelte|svelte\.ts)$/;

// Tests use brand strings + section IDs as fixtures. CSS files own color
// tokens. Skip these from the framework-code scans.
const SKIP_PATHS = [/\.test\.[a-z]+$/, /\.spec\.[a-z]+$/];

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Recursively yield every source-file path (relative to ROOT) under `dir`.
 * @param dir - Directory relative to ROOT.
 * @yields {string} Relative source-file paths.
 */
function* walk(dir) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(p);
    } else if (SOURCE_EXT.test(entry.name) && !SKIP_PATHS.some((re) => re.test(p))) {
      yield p;
    }
  }
}

/**
 * Collect every framework-code source file under SOURCE_DIRS.
 * @returns Relative paths.
 */
function gatherSourceFiles() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    if (!existsSync(join(ROOT, dir))) continue;
    for (const p of walk(dir)) files.push(p);
  }
  return files;
}

/**
 * Run a regex against the given files and return matches, skipping comment lines
 * (`//`, `/*`, `*`) and any caller-supplied per-line exclusion.
 * @param files - Files to scan.
 * @param pattern - Pattern to match.
 * @param allowFile - Optional predicate per file (true = include).
 * @param allowLine - Optional predicate per line (true = include).
 * @returns Match descriptors: file path, 1-based line number, trimmed line content.
 */
function findMatches(files, pattern, allowFile = () => true, allowLine = () => true) {
  const matches = [];
  for (const file of files) {
    if (!allowFile(file)) continue;
    const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      // Skip pure-comment lines so JSDoc / inline explanations don't false-positive
      if (/^(\/\/|\/\*|\*)/.test(trimmed)) return;
      if (!allowLine(line)) return;
      if (pattern.test(line)) {
        matches.push({ file, line: idx + 1, content: trimmed });
      }
    });
  }
  return matches;
}

const failures = [];

/**
 * Run one named check and pretty-print pass/fail with up to 5 example violations.
 * @param id - Audit row id (e.g. "18.1").
 * @param name - Short check name.
 * @param hint - One-line fix hint shown on failure.
 * @param fn - Returns the list of violations (empty array means pass).
 */
function check(id, name, hint, fn) {
  try {
    const matches = fn();
    if (matches.length === 0) {
      console.log(`${GREEN}✓${RESET} ${id} ${name}`);
    } else {
      failures.push({ id, name, hint, matches });
      console.error(`${RED}✗${RESET} ${id} ${name}`);
      for (const m of matches.slice(0, 5)) {
        console.error(`  ${DIM}${m.file}:${m.line}${RESET}  ${m.content}`);
      }
      if (matches.length > 5) {
        console.error(`  ${DIM}... and ${matches.length - 5} more${RESET}`);
      }
      console.error(`  ${YELLOW}Hint:${RESET} ${hint}`);
    }
  } catch (e) {
    failures.push({ id, name, hint, matches: [], error: e });
    console.error(`${RED}✗${RESET} ${id} ${name}: ${e.message}`);
  }
}

const files = gatherSourceFiles();

// 18.1 — No hardcoded brand strings in framework code
check(
  "18.1",
  "No hardcoded brand strings in framework code",
  "Brand strings (name, author, byline) live in sitio.json + traducciones.json; read via siteConfig / t().",
  () =>
    findMatches(
      files,
      /\b(arenalucia|Simbaqueba|Bogot[áa]|ArenaLucia)\b/i,
      // Allow the URL-builder helper that constructs canonical URLs from siteConfig.url
      undefined,
      // Exclude lines that reference siteConfig.* or import paths (those are how brand
      // strings legitimately flow into the codebase via config)
      (line) => !/siteConfig\.|sitio\.json|from\s+["']/.test(line),
    ),
);

// 18.2 — No hex color literals
check(
  "18.2",
  "No hex color literals — use theme.css tokens via Tailwind utilities",
  "Add the color to src/theme.css under @theme; reference via Tailwind utility (text-..., bg-...).",
  () =>
    findMatches(
      files,
      /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/,
      // CSS files own color tokens. `src/lib/defaults.ts` is the ONE place
      // default config values are allowed to live as literals — moving a
      // default out of there into a component IS the bug this gate exists
      // to prevent, so the exemption is narrow + named.
      (f) => !f.endsWith(".css") && !f.endsWith("src/lib/defaults.ts"),
      (line) =>
        // Exclude HTML/CSS id/anchor selectors (#elementId) and href fragments (#anchor)
        // Exclude numeric ranges in regex character classes like [#a-f0-9]
        !/^\s*[a-zA-Z_-]/.test(
          line
            .replace(/[^#]*#[a-z][a-zA-Z0-9_-]+/g, "")
            .replace(/href=["']#[a-zA-Z_-]/g, "")
            .replace(/\[[^\]]*#[^\]]*\]/g, ""),
        ) || /#[0-9a-fA-F]{3,6}\b/.test(line.replace(/#[a-z][a-zA-Z0-9_-]+/g, "")),
    ),
);

// 18.3 — No hardcoded section IDs in dispatch code
check(
  "18.3",
  "No hardcoded section IDs in framework code — use SECTION_* / isWritingSection() etc.",
  "Replace string-comparing dispatch with isWritingSection(value) / isPortfolioSection(value) / isPrivacySection(value).",
  () =>
    findMatches(
      files,
      /===\s*['"](escritos|portafolio|privacidad|writing|portfolio|privacy)['"]|['"](escritos|portafolio|privacidad|writing|portfolio|privacy)['"]\s*===/,
      // `src/lib/routes.ts` is the source of truth for these constants (and falls back
      // to the literal default), so its string mentions are legitimate.
      (f) => f !== join("src", "lib", "routes.ts"),
    ),
);

// 18.4 — lang.ts matcher delegates to getSupportedLanguages()
check(
  "18.4",
  "src/params/lang.ts param matcher reads from getSupportedLanguages()",
  "Import + call getSupportedLanguages() at module load; do not hardcode the language set.",
  () => {
    const path = "src/params/lang.ts";
    if (!existsSync(join(ROOT, path))) {
      return [{ file: path, line: 0, content: "(file missing)" }];
    }
    const content = readFileSync(join(ROOT, path), "utf8");
    if (!content.includes("getSupportedLanguages")) {
      return [
        {
          file: path,
          line: 1,
          content: "matcher does not call getSupportedLanguages()",
        },
      ];
    }
    // Sanity: must not contain a literal Set/Array of language codes either
    if (/new\s+Set\s*\(\s*\[\s*["'][a-z]{2}["']/.test(content)) {
      return [
        {
          file: path,
          line: 1,
          content: "matcher hardcodes a Set of language literals",
        },
      ];
    }
    return [];
  },
);

// 18.5 — No hardcoded BCP-47 / OG locale codes
check(
  "18.5",
  "No hardcoded BCP-47 / OG locale codes — use getOgLocale()",
  "Add the per-lang locale to seo.json#ogLocales; framework code reads via getOgLocale(lang).",
  () =>
    findMatches(
      files,
      /['"]([a-z]{2}_[A-Z]{2}|[a-z]{2}-[A-Z]{2})['"]/,
      undefined,
      (line) =>
        // Exclude Accept-Language / file-glob lines
        !/Accept-Language|glob|require\s*\(/.test(line),
    ),
);

// 18.6 — All 7 config files present for every configured language
check(
  "18.6",
  "All 8 config files present for every language in sitio.json#languages",
  "Create the missing JSON files — use src/data/configuracion/es/ as a template.",
  () => {
    const sitioPath = "src/data/configuracion/es/sitio.json";
    if (!existsSync(join(ROOT, sitioPath))) {
      return [{ file: sitioPath, line: 0, content: "(default-locale sitio.json missing)" }];
    }
    const sitioEs = JSON.parse(readFileSync(join(ROOT, sitioPath), "utf8"));
    const languages =
      Array.isArray(sitioEs.languages) && sitioEs.languages.length > 0 ? sitioEs.languages : ["es"];
    const required = [
      "sitio.json",
      "seo.json",
      "escritos.json",
      "portafolio.json",
      "proyectos.json",
      "navegacion.json",
      "pie-de-pagina.json",
      "traducciones.json",
    ];
    const missing = [];
    for (const lang of languages) {
      for (const f of required) {
        const path = `src/data/configuracion/${lang}/${f}`;
        if (!existsSync(join(ROOT, path))) {
          missing.push({ file: path, line: 0, content: "(missing)" });
        }
      }
    }
    return missing;
  },
);

if (failures.length > 0) {
  console.error(`\n${RED}check-fork-readiness: ${failures.length} check(s) failed.${RESET}`);
  console.error(
    `${DIM}See AUDIT_CHECKLIST.md #18 (Template / Forking Readiness) for the rationale per row.${RESET}`,
  );
  process.exit(1);
}
console.log(`\n${GREEN}check-fork-readiness: all 6 checks passed.${RESET}`);
