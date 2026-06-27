#!/usr/bin/env node
/**
 * Programmatic JSON-LD shape validator (AUDIT_CHECKLIST.md #9.20).
 *
 * Walks every `dist/`-emitted HTML file, extracts every
 * `<script type="application/ld+json">` block, parses it, and asserts the
 * required schema.org fields per `@type` are present and non-empty.
 *
 * Catches "deployed and silently broken JSON-LD" between manual
 * [Rich Results](https://search.google.com/test/rich-results) checks. Run
 * after `npm run build` (or via `npm run audit:all`).
 *
 * Why a hand-rolled validator instead of a full schema.org JSON-Schema:
 * `ajv` plus the full schema is ~200 KB and overkill for "did we emit the
 * keys Google's validator would flag as required". The map below mirrors the
 * Rich-Results-required field set per type.
 * @module scripts/checks/check-jsonld
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Required fields per `@type`. Each value is the list of keys that MUST be
 * present (non-empty) for that type to be considered valid. Optional fields
 * (`dateModified`, `wordCount`, `keywords`, etc.) are not enforced.
 */
const REQUIRED_FIELDS = {
  WebSite: ["name", "url"],
  Person: ["name", "url"],
  Article: ["headline", "datePublished", "author", "image", "mainEntityOfPage"],
  BreadcrumbList: ["itemListElement"],
  ImageGallery: ["name", "image"],
};

/**
 * Per-item required fields on known list properties.
 * BreadcrumbList itemListElement[] needs position + name + item.
 * ImageGallery image[] needs contentUrl (or url).
 */
const ARRAY_ITEM_REQUIRED = {
  itemListElement: ["position", "name", "item"],
  image: ["contentUrl"],
};

/**
 * Recursively yield every file path under a directory matching a regex.
 * @param dir - Directory to walk.
 * @param matcher - Regex applied to the file name.
 * @yields {string} Absolute file paths matching `matcher`.
 */
function* walk(dir, matcher) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(p, matcher);
    } else if (matcher.test(entry.name)) {
      yield p;
    }
  }
}

/**
 * Extract every JSON-LD payload from an HTML string. Each script block is
 * parsed; parse failures are reported (not silently skipped).
 * @param html - Raw HTML.
 * @param sourcePath - Path of the file, for error reporting.
 * @returns Parsed payloads (one per script block).
 */
function extractJsonLd(html, sourcePath) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch (err) {
      throw new Error(`Invalid JSON-LD in ${sourcePath}: ${err.message}\n  ${raw.slice(0, 120)}…`, {
        cause: err,
      });
    }
  }
  return blocks;
}

/**
 * Walk a JSON-LD value and yield every node that has an `@type` we care about.
 * Handles single object, array of objects, `@graph` array, nested embedded entities.
 * @param node - Anything from a parsed JSON-LD payload.
 * @yields {{ type: string, node: object }} Each node tagged with its type.
 */
function* eachTypedNode(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) yield* eachTypedNode(n);
    return;
  }
  if (Array.isArray(node["@graph"])) {
    for (const n of node["@graph"]) yield* eachTypedNode(n);
  }
  const type = node["@type"];
  if (typeof type === "string" && REQUIRED_FIELDS[type]) {
    yield { type, node };
  }
}

/**
 * Validate one node against the required-fields rules.
 * @param type - Schema.org type.
 * @param node - The JSON-LD node.
 * @param sourcePath - File path for error reporting.
 * @returns Violation messages (empty array = valid).
 */
function validateNode(type, node, sourcePath) {
  const violations = [];
  const required = REQUIRED_FIELDS[type];
  for (const key of required) {
    const val = node[key];
    const missing =
      val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0);
    if (missing) {
      violations.push(`${sourcePath}  ${type} missing required field: ${key}`);
    }
  }
  for (const [arrayKey, itemKeys] of Object.entries(ARRAY_ITEM_REQUIRED)) {
    if (!Array.isArray(node[arrayKey])) continue;
    node[arrayKey].forEach((item, idx) => {
      if (!item || typeof item !== "object") return;
      for (const key of itemKeys) {
        if (item[key] === undefined || item[key] === null || item[key] === "") {
          if (arrayKey === "image" && key === "contentUrl" && item.url) continue;
          violations.push(
            `${sourcePath}  ${type}.${arrayKey}[${idx}] missing required field: ${key}`,
          );
        }
      }
    });
  }
  return violations;
}

if (!existsSync(DIST) || !statSync(DIST).isDirectory()) {
  console.error(`${RED}check-jsonld: ${DIST}/ not found. Run \`npm run build\` first.${RESET}`);
  process.exit(1);
}

let filesChecked = 0;
let nodesChecked = 0;
const failures = [];

for (const file of walk(DIST, /^index\.html$/)) {
  filesChecked++;
  const html = readFileSync(file, "utf8");
  let blocks;
  try {
    blocks = extractJsonLd(html, file);
  } catch (err) {
    failures.push(err.message);
    continue;
  }
  for (const block of blocks) {
    for (const { type, node } of eachTypedNode(block)) {
      nodesChecked++;
      const violations = validateNode(type, node, file);
      failures.push(...violations);
    }
  }
}

if (failures.length > 0) {
  console.error(`${RED}✗ check-jsonld: ${failures.length} violation(s)${RESET}`);
  for (const v of failures.slice(0, 25)) console.error(`  ${DIM}${v}${RESET}`);
  if (failures.length > 25) {
    console.error(`  ${DIM}... and ${failures.length - 25} more${RESET}`);
  }
  console.error(
    `  ${YELLOW}Hint:${RESET} run [Google Rich Results](https://search.google.com/test/rich-results) on a deployed URL for the cross-check.`,
  );
  process.exit(1);
}

console.log(
  `${GREEN}check-jsonld: ${filesChecked} HTML files, ${nodesChecked} JSON-LD nodes — all valid.${RESET}`,
);
