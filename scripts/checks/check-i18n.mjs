/**
 * i18n key parity + usage check.
 *
 * - Walks every `t(lang, "...")` and `tObject(lang, "...")` call in `src/` and
 *   the inline `consent` keys read by the GTM bootstrap in `src/app.html`.
 * - Compares the resulting key set against the flat key paths in
 *   `src/data/configuracion/{en,es}/traducciones.json`.
 *
 * Fails (exit 1) on any of:
 *   - Keys used in code but absent from en.json
 *   - Keys used in code but absent from es.json
 *   - Keys present in only one of the two JSON files (parity break)
 *   - Keys present in both JSON files but never referenced in code (orphan)
 *
 * Runs in the pre-commit hook and in `ci.yml` so missing translations show up
 * the moment a `t()` call is added without the matching JSON entry, and stale
 * JSON entries get flagged the moment their last call site is removed.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

// Discover every `configuracion/<lang>/traducciones.json` so the script
// supports monolingual (1 lang) up through trilingual+ sites. Languages are
// derived from on-disk folders so a fork that drops a locale (or adds one)
// works without editing this script.
const CONFIG_ROOT = join(SRC, "data", "configuracion");
const LANG_DIRS = readdirSync(CONFIG_ROOT)
  .filter((d) => {
    try {
      return statSync(join(CONFIG_ROOT, d, "traducciones.json")).isFile();
    } catch {
      return false;
    }
  })
  .sort();
if (LANG_DIRS.length === 0) {
  console.error("check-i18n: no traducciones.json found under src/data/configuracion/<lang>/");
  process.exit(1);
}

// Match t(lang, "key.path") AND tObject(lang, "key.path"). Accepts both single
// and double quotes around the key. Ignores anything after in the argument list
// (count, defaultValue, interpolation params).
const T_CALL_RE = /\bt(?:Object)?\(\s*[a-zA-Z_$][\w$]*\s*,\s*["']([\w.]+)["']/g;

// Match dynamic template-literal keys: t(lang, `prefix.${expr}.suffix`).
// We can't resolve the runtime value, so we capture the static prefix (up to
// the first `${`) and treat anything in JSON under that prefix as "in use".
// Example: `writing.${type}` captures `writing.` → marks all `writing.*` keys
// as referenced.
const T_DYNAMIC_RE = /\bt(?:Object)?\(\s*[a-zA-Z_$][\w$]*\s*,\s*`([\w.]*?)\$\{/g;

// Walk every .svelte / .ts / .js file under src/ plus app.html which contains
// the inline GTM bootstrap that reads consent.* keys directly.
const EXTS = new Set([".svelte", ".ts", ".js"]);

/**
 * Recursively walk a directory, yielding file paths whose extension is in EXTS.
 * @param dir - Directory to walk.
 * @yields {string} File paths matching the EXTS extension set.
 */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      yield* walk(full);
    } else if (EXTS.has(extname(entry))) {
      yield full;
    }
  }
}

const usedKeys = new Set();
// Dynamic prefixes (e.g. "writing." from `t(lang, \`writing.${type}\`)`) mark
// every key under the prefix as in use.
const dynamicPrefixes = new Set();
const usageLocations = new Map(); // key -> first source file that uses it

for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf-8");
  for (const m of text.matchAll(T_CALL_RE)) {
    const key = m[1];
    usedKeys.add(key);
    if (!usageLocations.has(key)) {
      usageLocations.set(key, relative(ROOT, file));
    }
  }
  for (const m of text.matchAll(T_DYNAMIC_RE)) {
    const prefix = m[1];
    if (prefix) dynamicPrefixes.add(prefix);
  }
}

// app.html reads consent.message/accept/decline directly from the JSON via an
// inline script. The walk() above doesn't reach .html files, so add these
// keys explicitly — they're load-bearing for the cookie banner to work pre-hydration.
const APP_HTML_KEYS = ["consent.message", "consent.accept", "consent.decline"];
for (const k of APP_HTML_KEYS) {
  usedKeys.add(k);
  if (!usageLocations.has(k)) usageLocations.set(k, "src/app.html (inline GTM bootstrap)");
}

/**
 * Recursively flatten a nested object into a Set of dot-path keys.
 * @param obj - Object to flatten.
 * @param prefix - Optional prefix accumulator.
 * @param out - Optional output Set (passed during recursion).
 * @returns Set of flat dot-path keys.
 */
function flatten(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

// Map of lang → flattened key set. Built from every discovered translation file.
const flatByLang = new Map();
for (const lang of LANG_DIRS) {
  const text = readFileSync(join(CONFIG_ROOT, lang, "traducciones.json"), "utf-8");
  flatByLang.set(lang, flatten(JSON.parse(text)));
}

// Expand usage to cover the i18n helper's two indirection patterns:
//   1. `tObject(lang, 'group')` resolves to every leaf under `group.*`.
//   2. `t(lang, 'photoCount', { count: n })` resolves to `photoCount_one` /
//      `photoCount_other` via the helper's pluralization suffix convention.
//   3. Template-literal calls like `t(lang, \`writing.${type}\`)` resolve to
//      arbitrary leaves under the captured static prefix (dynamicPrefixes).
function expandSubtreeUsage(used, dynamic, allFlat) {
  const expanded = new Set(used);
  // (1) subtree consumers
  for (const u of used) {
    const prefix = u + ".";
    for (const k of allFlat) {
      if (k.startsWith(prefix)) expanded.add(k);
    }
  }
  // (2) pluralization suffixes
  for (const u of used) {
    for (const suffix of ["_one", "_other", "_zero", "_two", "_few", "_many"]) {
      if (allFlat.has(u + suffix)) expanded.add(u + suffix);
    }
  }
  // (3) dynamic prefix consumers
  for (const prefix of dynamic) {
    for (const k of allFlat) {
      if (k.startsWith(prefix)) expanded.add(k);
    }
  }
  return expanded;
}
const allFlat = new Set();
for (const set of flatByLang.values()) for (const k of set) allFlat.add(k);
const usedExpanded = expandSubtreeUsage(usedKeys, dynamicPrefixes, allFlat);

// Also treat any explicitly-used pluralization base (e.g. `photoCount`) as
// satisfied by EITHER `photoCount_one` OR `photoCount_other` — we only flag
// it as missing from a JSON if NEITHER suffix exists there.
function isMissingFromLang(key, langFlat) {
  if (langFlat.has(key)) return false;
  for (const suffix of ["_one", "_other", "_zero", "_two", "_few", "_many"]) {
    if (langFlat.has(key + suffix)) return false;
  }
  return true;
}

// For each language, flag keys called from code that are missing from its
// JSON. For parity drift, flag keys present in one locale but missing from
// any other (pairwise). Orphans are keys present in EVERY locale that no
// code site references.
const missingByLang = new Map();
for (const [lang, flat] of flatByLang) {
  missingByLang.set(lang, [...usedKeys].filter((k) => isMissingFromLang(k, flat)).sort());
}
const parityDrift = [];
for (const [langA, flatA] of flatByLang) {
  for (const [langB, flatB] of flatByLang) {
    if (langA >= langB) continue;
    for (const k of flatA)
      if (!flatB.has(k)) parityDrift.push({ key: k, in: langA, missingFrom: langB });
    for (const k of flatB)
      if (!flatA.has(k)) parityDrift.push({ key: k, in: langB, missingFrom: langA });
  }
}
parityDrift.sort((a, b) => a.key.localeCompare(b.key));
const firstLangFlat = flatByLang.values().next().value;
const orphans = [...firstLangFlat]
  .filter((k) => {
    for (const flat of flatByLang.values()) if (!flat.has(k)) return false;
    return !usedExpanded.has(k);
  })
  .sort();

let failed = false;
function report(label, items, withLocations = false) {
  if (items.length === 0) return;
  failed = true;
  console.error(`\n${label} (${items.length}):`);
  for (const k of items) {
    if (withLocations && usageLocations.has(k)) {
      console.error(`  - ${k}  (used in ${usageLocations.get(k)})`);
    } else {
      console.error(`  - ${k}`);
    }
  }
}

for (const [lang, missing] of missingByLang) {
  report(`Keys used in code but MISSING from ${lang}.json`, missing, true);
}
if (parityDrift.length > 0) {
  failed = true;
  console.error(`\nParity drift across locales (${parityDrift.length}):`);
  for (const { key, in: src, missingFrom } of parityDrift) {
    console.error(`  - ${key}  (in ${src}.json, missing from ${missingFrom}.json)`);
  }
}
report("Orphan keys (present in every locale but never used in code)", orphans);

if (failed) {
  console.error("\ncheck-i18n: FAIL");
  process.exit(1);
}

const sizes = [...flatByLang.entries()]
  .map(([lang, flat]) => `${flat.size} ${lang}.json keys`)
  .join(", ");
console.log(
  `check-i18n: ${usedKeys.size} call site keys (${usedExpanded.size} after subtree expansion), ${sizes} — all in sync.`,
);
