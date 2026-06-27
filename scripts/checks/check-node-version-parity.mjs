#!/usr/bin/env node
/**
 * Node version pin parity check (AUDIT_CHECKLIST.md #1.13).
 *
 * Node 24 is currently pinned in four places. Drift causes local-vs-CI bugs
 * that surface only at deploy time:
 *
 *   - `.nvmrc`                              → `nvm use` for contributors
 *   - `package.json#engines.node`           → `npm ci` engine guard
 *   - `.github/workflows/*.yml`             → `actions/setup-node` on CI
 *   - `Brewfile`                            → `brew bundle` install spec
 *
 * Asserts the **major** version matches across all sources. A patch bump
 * in `Brewfile` doesn't fail; a major mismatch does.
 * @module scripts/checks/check-node-version-parity
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Extract the integer major Node version from a piece of text given a pattern
 * with a single capturing group around the version digits.
 * @param text - File content.
 * @param re - Regex with one capture group around the major-version digits.
 * @returns Integer major version, or null if not found.
 */
function pickMajor(text, re) {
  const m = text.match(re);
  return m ? parseInt(m[1], 10) : null;
}

const findings = []; // { source, major }
const missing = [];

if (existsSync(".nvmrc")) {
  const v = pickMajor(readFileSync(".nvmrc", "utf8"), /(\d+)/);
  if (v !== null) findings.push({ source: ".nvmrc", major: v });
  else missing.push(".nvmrc has no version number");
} else {
  missing.push(".nvmrc not found");
}

if (existsSync("package.json")) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const enginesNode = pkg.engines?.node;
  if (typeof enginesNode === "string") {
    const v = pickMajor(enginesNode, /(\d+)/);
    if (v !== null) findings.push({ source: "package.json#engines.node", major: v });
    else missing.push(`package.json engines.node has no version: ${enginesNode}`);
  } else {
    missing.push("package.json has no engines.node entry");
  }
} else {
  missing.push("package.json not found");
}

if (existsSync("Brewfile")) {
  const text = readFileSync("Brewfile", "utf8");
  const v = pickMajor(text, /brew\s+["']node@(\d+)/);
  if (v !== null) findings.push({ source: "Brewfile", major: v });
  // else: Brewfile may legitimately omit node (Linux installs)
}

// Walk every workflow under .github/workflows/
const workflowsDir = ".github/workflows";
if (existsSync(workflowsDir)) {
  for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
    const path = join(workflowsDir, entry.name);
    const text = readFileSync(path, "utf8");
    // Every `node-version:` line; one workflow can have multiple jobs each setting it
    const seen = new Set();
    for (const match of text.matchAll(/node-version:\s*['"]?(\d+)/g)) {
      const v = parseInt(match[1], 10);
      const key = `${path} (node-version: ${v})`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ source: key, major: v });
    }
  }
}

if (missing.length > 0) {
  console.error(`${RED}check-node-version-parity: missing required sources${RESET}`);
  for (const m of missing) console.error(`  ${DIM}${m}${RESET}`);
  process.exit(1);
}

const majors = new Set(findings.map((f) => f.major));
if (majors.size > 1) {
  console.error(`${RED}✗ check-node-version-parity: major-version drift${RESET}`);
  for (const f of findings) {
    console.error(`  ${DIM}${f.source}${RESET}  → Node ${f.major}`);
  }
  console.error(
    `\n  Pick one major version and update every source. The four canonical pins are:\n` +
      `    .nvmrc, package.json#engines.node, Brewfile (brew "node@N"), all .github/workflows/*.yml setup-node steps.`,
  );
  process.exit(1);
}

const [major] = [...majors];
console.log(
  `${GREEN}check-node-version-parity: ${findings.length} source(s) all pin Node ${major}.${RESET}`,
);
