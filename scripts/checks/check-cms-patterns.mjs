/**
 * Apply Sveltia CMS `pattern` validators to actual data files programmatically.
 *
 * Sveltia enforces field `pattern` constraints only inside the CMS UI at edit
 * time — there's no CLI validator shipped with the project. This script reads
 * `static/admin/config.yml`, walks every field that declares a `pattern`, then
 * loads the matching data files (per-collection folder + extension) and tests
 * the value against the regex. Fails CI on any value that the CMS would have
 * rejected.
 *
 * Why this matters: edits made by hand (or by an old CMS version that didn't
 * have the pattern set) bypass the UI validator. Without this script, a 234-
 * character `summary` slips into production and gets truncated on Google /
 * Twitter / Facebook with no one noticing until the SERP looks ugly.
 *
 * Scope: only `string` and `text` widget patterns (the common case). Object /
 * list / select widgets are skipped — Sveltia validates those via `widget`
 * type, not `pattern`. Skipped fields are reported as a count so a future
 * pattern type isn't silently ignored.
 *
 * Runs in pre-commit + CI alongside `check:i18n` and `check:images`.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const CONFIG = join(ROOT, "static", "admin", "config.yml");

const config = parseYaml(readFileSync(CONFIG, "utf-8"));

/**
 * Yield every field object in the config, with its dot-path. Recurses into
 * `object` widget children (used for `settings.*`) and `list` widget children
 * (used for `photos.*`).
 * @param fields - Array of field definitions from a collection.
 * @param prefix - Dot-path prefix for nested fields.
 * @yields {{ path: string, field: object }} Each leaf field with its dot path.
 */
function* walkFields(fields, prefix = "") {
  if (!Array.isArray(fields)) return;
  for (const f of fields) {
    if (!f || !f.name) continue;
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    yield { path, field: f };
    if (f.widget === "object" && Array.isArray(f.fields)) {
      yield* walkFields(f.fields, path);
    }
    if (f.widget === "list" && Array.isArray(f.fields)) {
      // Walk list children with `[]` marker so we can recognize them downstream.
      yield* walkFields(f.fields, `${path}[]`);
    }
  }
}

/**
 * Resolve a dot-path value from a frontmatter / JSON object, supporting the
 * `parent.child` form. Returns undefined when any segment is missing.
 * @param obj - Source object.
 * @param path - Dot-path (no `[]` segments at this layer).
 * @returns The resolved value or undefined.
 */
function getDeep(obj, path) {
  return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

/**
 * Extract YAML frontmatter from a markdown file.
 * @param text - Full markdown file contents.
 * @returns Parsed frontmatter object, or empty object when none.
 */
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  try {
    return parseYaml(m[1]) ?? {};
  } catch {
    return {};
  }
}

/**
 * Read every per-language file in a folder collection. Sveltia's
 * `i18n.structure: multiple_folders` mode means files live in `folder/<locale>/`.
 * @param folder - Project-relative folder path from the collection config.
 * @param extension - File extension (without leading dot).
 * @param locales - Locale codes (e.g. `["es", "en"]`).
 * @returns Array of `{ path, data }` pairs across every locale.
 */
function readFolderCollection(folder, extension, locales) {
  const out = [];
  for (const locale of locales) {
    const dir = join(ROOT, folder, locale);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith("." + extension)) continue;
      const full = join(dir, entry);
      const text = readFileSync(full, "utf-8");
      const data = extension === "json" ? JSON.parse(text) : parseFrontmatter(text);
      out.push({ path: relative(ROOT, full), data });
    }
  }
  return out;
}

const failures = [];
let totalFields = 0;
let totalValuesChecked = 0;
let skippedWidgets = 0;

const defaultLocales = config.i18n?.locales ?? ["es", "en"];

for (const collection of config.collections ?? []) {
  // Two collection shapes:
  //   1. folder collection — `folder` + `extension`, one file per item
  //   2. files collection  — `files: [{name, file, fields}, ...]`
  //
  // The `colecciones` collection wraps single-locale per-collection JSON files
  // under per-locale folders. We treat each `files[].file` template as a glob
  // resolved against each locale dir.
  const i18n = collection.i18n;
  const locales = i18n?.locales ?? defaultLocales;

  if (collection.folder && collection.extension) {
    const items = readFolderCollection(collection.folder, collection.extension, locales);
    for (const { path: itemPath, data } of items) {
      for (const { path: fieldPath, field } of walkFields(collection.fields)) {
        if (!field.pattern) continue;
        // Skip list-item patterns — those require iterating the list and we
        // don't have a list-pattern check in scope right now.
        if (fieldPath.includes("[]")) {
          skippedWidgets++;
          continue;
        }
        totalFields++;
        const value = getDeep(data, fieldPath);
        if (value == null || value === "") continue; // empty values are checked by `required`, not `pattern`
        totalValuesChecked++;
        const [regexSrc, message] = field.pattern;
        const re = new RegExp(regexSrc);
        if (!re.test(String(value))) {
          failures.push({
            file: itemPath,
            field: fieldPath,
            length: String(value).length,
            message,
            preview: String(value).slice(0, 80) + (String(value).length > 80 ? "…" : ""),
          });
        }
      }
    }
  }

  if (collection.files) {
    for (const f of collection.files) {
      if (!f.fields) continue;
      // Two file shapes:
      //   1. plain `file: src/.../foo.json` — single locale, read once.
      //   2. `file: src/.../{{locale}}/foo.json` with `i18n: true` — read once
      //      per locale, substituting `{{locale}}` so per-locale validators
      //      (e.g. `description` length cap on each `configuracion/<lang>/sitio.json`)
      //      run on the actual on-disk value, not just the default-locale one.
      const isPerLocale = typeof f.file === "string" && f.file.includes("{{locale}}");
      const fileLocales = isPerLocale ? locales : [null];
      for (const loc of fileLocales) {
        const resolved = isPerLocale ? f.file.replaceAll("{{locale}}", String(loc)) : f.file;
        const filePath = join(ROOT, resolved);
        if (!existsSync(filePath) || !filePath.endsWith(".json")) continue;
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        for (const { path: fieldPath, field } of walkFields(f.fields)) {
          if (!field.pattern) continue;
          if (fieldPath.includes("[]")) {
            skippedWidgets++;
            continue;
          }
          totalFields++;
          const value = getDeep(data, fieldPath);
          if (value == null || value === "") continue;
          totalValuesChecked++;
          const [regexSrc, message] = field.pattern;
          const re = new RegExp(regexSrc);
          if (!re.test(String(value))) {
            failures.push({
              file: relative(ROOT, filePath),
              field: fieldPath,
              length: String(value).length,
              message,
              preview: String(value).slice(0, 80) + (String(value).length > 80 ? "…" : ""),
            });
          }
        }
      }
    }
  }
}

if (failures.length === 0) {
  console.log(
    `check-cms-patterns: ${totalValuesChecked} values across ${totalFields} pattern-validated fields (${skippedWidgets} list-item fields skipped) — all pass.`,
  );
  process.exit(0);
}

console.error(`\ncheck-cms-patterns: ${failures.length} CMS pattern violation(s):\n`);
for (const f of failures) {
  console.error(`  ${f.file}`);
  console.error(`    field:   ${f.field}`);
  console.error(`    length:  ${f.length}`);
  console.error(`    rule:    ${f.message}`);
  console.error(`    preview: ${f.preview}`);
  console.error("");
}
console.error("Fix the values above (the CMS UI would have rejected them at edit time).");
process.exit(1);
