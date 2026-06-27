#!/usr/bin/env node
/**
 * Verify every required-config field (declared as `REQUIRED("hint")` in
 * `src/lib/defaults.ts`) is actually set in the per-locale JSON files
 * under `src/data/configuracion/`.
 *
 * Catches the failure mode where a fork forgets to fill in a required
 * field (e.g. `siteConfig.name`, `siteConfig.url`, `seoConfig.description`)
 * — without this gate, the `REQUIRED(...)` sentinel string would silently
 * survive the defaults merge and ship as a `<title>`, OG description, or
 * favicon source path containing literal `__REQUIRED__Your site name…`.
 *
 * How it works:
 *   1. Imports `DEFAULTS` from `$lib/defaults` (Node 24 strips types natively).
 *   2. Loads every `*.json` from `src/data/configuracion/{lang}/`.
 *   3. Deep-merges raw JSON onto DEFAULTS slice via `withDefaults`.
 *   4. Walks the merged shape, flags any leaf still carrying the sentinel
 *      prefix, prints the field path + the human hint, fails the build.
 *
 * Wired into pre-commit + CI + `audit:all`. Companion to `check:fork`
 * (which only verifies the JSON files exist, not their content quality)
 * and `check:cms-patterns` (which enforces field-format regexes from the
 * CMS schema). Together: file present, fields present, fields valid.
 * @module scripts/checks/check-required-config
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULTS,
  isRequiredSentinel,
  requiredHint,
  withDefaults,
} from "../../src/lib/defaults.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG_ROOT = join(ROOT, "src", "data", "configuracion");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Map a config-domain key (as used in DEFAULTS) to the matching JSON
 * filename under `src/data/configuracion/{lang}/`. Mirrors the file map
 * in `check-fork-readiness.mjs#18.6` — keep these in sync if either set
 * grows. Both gates derive from the same source-of-truth list of config
 * files but operate at different layers (file existence vs field content).
 */
const FILE_PER_DOMAIN = {
  site: "sitio.json",
  seo: "seo.json",
  writing: "escritos.json",
  portfolio: "portafolio.json",
  projects: "proyectos.json",
  footer: "pie-de-pagina.json",
  navigation: "navegacion.json",
};

/**
 * Walk a merged config object and yield every leaf value that still
 * carries the `__REQUIRED__` sentinel prefix. Returns `[path, hint]`
 * pairs so the caller can render an actionable error message.
 * @param obj - Merged config slice (defaults applied).
 * @param prefix - Dot-path prefix accumulated during recursion.
 * @returns Pairs of `["field.path", "hint message"]`.
 */
function findSentinels(obj, prefix = "") {
  const out = [];
  if (obj === null || typeof obj !== "object") return out;
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isRequiredSentinel(value)) {
      out.push([path, requiredHint(value)]);
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...findSentinels(value, path));
    }
  }
  return out;
}

/**
 * Read a JSON config file. Returns `null` when the file doesn't exist
 * (a monolingual fork may not ship every locale folder).
 * @param path - Absolute path to the JSON file.
 * @returns Parsed JSON content, or `null` if missing.
 */
function readJsonOrNull(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`Invalid JSON in ${path}`, { cause: err });
  }
}

const sitioPath = join(CONFIG_ROOT, "es", "sitio.json");
if (!existsSync(sitioPath)) {
  console.error(`${RED}check-required-config: ${sitioPath} not found.${RESET}`);
  console.error(`${DIM}Run check:fork first — it gates the per-locale file presence.${RESET}`);
  process.exit(1);
}

const sitioEs = JSON.parse(readFileSync(sitioPath, "utf8"));
const languages =
  Array.isArray(sitioEs.languages) && sitioEs.languages.length > 0 ? sitioEs.languages : ["es"];

const failures = [];

for (const lang of languages) {
  for (const [domain, filename] of Object.entries(FILE_PER_DOMAIN)) {
    const baseline = DEFAULTS[domain];
    if (!baseline) continue;
    const filePath = join(CONFIG_ROOT, lang, filename);
    const raw = readJsonOrNull(filePath);
    if (raw === null) continue; // check:fork handles "file missing"; we only audit content
    const merged = withDefaults(baseline, raw);
    for (const [field, hint] of findSentinels(merged)) {
      failures.push({ lang, file: filename, field, hint });
    }
  }
}

if (failures.length === 0) {
  console.log(
    `${GREEN}check-required-config: all required fields set across ${languages.length} locale(s).${RESET}`,
  );
  process.exit(0);
}

console.error(`${RED}check-required-config: ${failures.length} required field(s) missing:${RESET}`);
console.error();
for (const { lang, file, field, hint } of failures) {
  console.error(`  ${RED}✗${RESET} ${DIM}${lang}/${file}${RESET} → ${field}`);
  console.error(`      ${hint}`);
}
console.error();
console.error(
  `${DIM}Fix: open each file above and replace the ${RESET}REQUIRED${DIM} placeholder with a real value.${RESET}`,
);
console.error(
  `${DIM}Defaults live in src/lib/defaults.ts — open that to see the full schema + hints.${RESET}`,
);
process.exit(1);
