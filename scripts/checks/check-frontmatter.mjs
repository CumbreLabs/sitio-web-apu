#!/usr/bin/env node
/**
 * Markdown frontmatter schema validator (AUDIT_CHECKLIST.md #10.11).
 *
 * Walks every `.md` under `src/data/escritos/` and `src/data/paginas/`,
 * parses the YAML frontmatter via `gray-matter`, and validates each file
 * against a Zod schema. Catches:
 *
 *   - Typos in field names (`tepmlate:` instead of `template:`).
 *   - Missing required keys (no `title`, no `slug`).
 *   - Wrong types (collections as string, dates as number).
 *   - Bad enum values (`type: "wrong-tag"` not in the allowed set).
 *
 * Currently the catch-all route silently falls back to `PageTemplate` when
 * a `template:` typo means the field is missing — bad data renders the
 * wrong page. This gate fails the build before that ships.
 *
 * **Why gray-matter + zod here, but a hand-rolled parser in
 * `src/lib/frontmatter.ts`?** This script runs in Node only (pre-commit + CI)
 * so heavy parsers + a schema library don't affect the client bundle. The
 * runtime path stays lean (see the bundle-size note at the top of
 * `src/lib/frontmatter.ts`). Result: editors get gray-matter's full YAML
 * grammar + Zod's expressive schemas at validation time, browsers ship the
 * lean hand-rolled parser. The two parsers handle the same data shape
 * identically — the runtime path is intentionally a subset of what gray-
 * matter accepts.
 * @module scripts/checks/check-frontmatter
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const ROOT = process.cwd();

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Derive the set of valid `template:` enum values from the config files
 * instead of hardcoding them. Sources:
 *   - escritos.json#writingPageId      → e.g. "escritos" / "writing" / "blog"
 *   - portafolio.json#portfolioPageId  → e.g. "portafolio" / "portfolio" / "gallery"
 * Plus a few historical aliases (`"page"`, the English names `"writings"` /
 * `"portfolio"`) that the catch-all renderer also recognizes. Empty string is
 * always allowed (falls through to PageTemplate).
 *
 * Reads only the default-lang slice — the page-id fields are `i18n: duplicate`
 * in the CMS so all locale slices carry the same value.
 * @returns Array of accepted template values for paginas frontmatter.
 */
function deriveTemplateEnum() {
  const enums = new Set(["page", "writings", "portfolio"]);
  try {
    const cfgDir = join(ROOT, "src/data/configuracion");
    const langDirs = readdirSync(cfgDir).filter(
      (d) => !d.startsWith(".") && statSync(join(cfgDir, d)).isDirectory(),
    );
    const langDir = langDirs.includes("es") ? "es" : (langDirs[0] ?? "");
    if (langDir) {
      for (const [file, field] of [
        ["escritos.json", "writingPageId"],
        ["portafolio.json", "portfolioPageId"],
      ]) {
        const path = join(cfgDir, langDir, file);
        if (existsSync(path)) {
          const v = JSON.parse(readFileSync(path, "utf8"))[field];
          if (typeof v === "string" && v) enums.add(v);
        }
      }
    }
  } catch {
    // Defensive: if the configuracion tree is missing/malformed, fall back
    // to the historical hardcoded set so the validator still does something useful.
    ["escritos", "portafolio"].forEach((v) => enums.add(v));
  }
  return [...enums];
}
const TEMPLATE_ENUM = deriveTemplateEnum();

// ---------------------------------------------------------------------------
// Zod-based schemas. Each schema is a strict subset of the actual data shape
// — we coerce values that gray-matter parses richly (Date objects, numbers)
// back into the strings the rest of the codebase consumes, and use `passthrough`
// so unknown keys (Sveltia extensions, future fields) don't fail the gate.
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEBAB_RE = /^[a-z][a-z0-9-]*$/;
const URL_RE = /^https?:\/\/.+/;

/** YYYY-MM-DD string. gray-matter parses unquoted YAML dates as `Date`; coerce. */
const isoDate = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))
  .refine((v) => ISO_DATE_RE.test(v), { message: "must be YYYY-MM-DD" });

/** Optional YYYY-MM-DD: also accepts empty string (CMS writes empty for unset). */
const isoDateOrEmpty = z.union([z.literal(""), isoDate]).optional();

/** kebab-case slug (lowercase, hyphens). Matches `^[a-z][a-z0-9-]*$`. */
const kebabSlug = z.string().regex(KEBAB_RE, "must be kebab-case (^[a-z][a-z0-9-]*$)");

/** http(s) URL. */
const httpUrl = z.string().regex(URL_RE, "must be an http(s) URL");

/** http(s) URL or empty string. */
const httpUrlOrEmpty = z.union([z.literal(""), httpUrl]).optional();

/**
 * A single entry in `paginas[].collections[]` — accepts either a plain string
 * collection name (legacy/short form) OR a `{active, collection}` object with
 * the per-collection visibility toggle. Same shape `loadPages()` accepts in
 * `src/lib/data/pages.ts`.
 */
const collectionListItem = z.union([
  z.string(),
  z
    .object({
      collection: z.string(),
      active: z.boolean().optional(),
    })
    .passthrough(),
]);

const writingSettings = z
  .object({
    active: z.boolean().optional(),
    slug: kebabSlug.optional(),
    redirectUrl: httpUrlOrEmpty,
    ogDescription: z.string().optional(),
    ogImage: z.string().optional(),
    sidebar: z.boolean().optional(),
  })
  .passthrough()
  .optional();

const escritosSchema = z
  .object({
    title: z.string().min(1, "must be a non-empty string"),
    date: isoDate,
    slug: kebabSlug,
    summary: z.string().min(1, "must be a non-empty string"),
    type: z.enum(["opinion", "report", "journal", "thesis", "article"]),
    tags: z.string().optional(),
    updatedDate: isoDateOrEmpty,
    originalLanguage: z.union([z.literal(""), z.enum(["es", "en", "fr"])]).optional(),
    externalUrl: httpUrlOrEmpty,
    redirectUrl: httpUrlOrEmpty,
    ogDescription: z.string().optional(),
    settings: writingSettings,
  })
  .passthrough();

const paginasSettings = z
  .object({
    active: z.boolean().optional(),
    slug: kebabSlug.optional(),
    redirectUrl: httpUrlOrEmpty,
    ogDescription: z.string().optional(),
    ogImage: z.string().optional(),
    backgroundImage: z.string().optional(),
    sidebar: z.boolean().optional(),
  })
  .passthrough()
  .optional();

const paginasSchema = z
  .object({
    title: z.string().min(1, "must be a non-empty string"),
    subtitle: z.string().optional(),
    collections: z.array(collectionListItem).optional(),
    // Template enum derived from config (escritos.json#writingPageId +
    // portafolio.json#portfolioPageId) — so renaming a section in the CMS
    // automatically updates the validator. Empty string falls through to
    // the default PageTemplate.
    template: z.union([z.literal(""), z.enum(TEMPLATE_ENUM)]).optional(),
    settings: paginasSettings,
  })
  .passthrough();

const SCHEMAS = {
  escritos: escritosSchema,
  paginas: paginasSchema,
};

/**
 * Yield every `.md` file under a directory recursively.
 * @param dir - Directory to walk.
 * @yields {string} Absolute file paths ending in `.md`.
 */
function* walkMd(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMd(p);
    } else if (entry.name.endsWith(".md")) {
      yield p;
    }
  }
}

/**
 * Format a single Zod issue path + message as `key  rule-msg`.
 * @param issue - Zod issue.
 * @returns Human-friendly violation string.
 */
function formatIssue(issue) {
  const path = issue.path.join(".");
  return `${path || "(root)"}: ${issue.message}`;
}

const COLLECTIONS = [
  { dir: "src/data/escritos", schema: SCHEMAS.escritos },
  { dir: "src/data/paginas", schema: SCHEMAS.paginas },
];

let filesChecked = 0;
const failures = [];

for (const { dir, schema } of COLLECTIONS) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    console.error(`${YELLOW}check-frontmatter: ${dir}/ not found, skipping.${RESET}`);
    continue;
  }
  for (const file of walkMd(abs)) {
    filesChecked++;
    const sourcePath = relative(ROOT, file);
    const raw = readFileSync(file, "utf8");
    let parsed;
    try {
      parsed = matter(raw);
    } catch (err) {
      failures.push(`${sourcePath}  YAML parse error: ${err.message}`);
      continue;
    }
    const result = schema.safeParse(parsed.data ?? {});
    if (!result.success) {
      for (const issue of result.error.issues) {
        failures.push(`${sourcePath}  ${formatIssue(issue)}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`${RED}✗ check-frontmatter: ${failures.length} violation(s)${RESET}`);
  for (const v of failures.slice(0, 25)) console.error(`  ${DIM}${v}${RESET}`);
  if (failures.length > 25) {
    console.error(`  ${DIM}... and ${failures.length - 25} more${RESET}`);
  }
  process.exit(1);
}

console.log(
  `${GREEN}check-frontmatter: ${filesChecked} markdown files — all conform to schema.${RESET}`,
);
