#!/usr/bin/env node
/**
 * Pre-commit ↔ CI gate parity check (AUDIT_CHECKLIST.md #13.15).
 *
 * Extracts every `npm run X` invocation from `.husky/pre-commit` and from
 * `.github/workflows/ci.yml`, then asserts the verification-gate set is
 * symmetric. Drift creeps in silently: someone adds `check:newthing` to
 * pre-commit but forgets ci.yml, and breaking changes only surface when a
 * dev runs the gate locally vs the PR shipping with a broken state.
 *
 * Some scripts are intentionally **pre-commit-only**:
 *   - Maintenance scripts (`embed-copyright`, `optimize-images`,
 *     `generate-favicons`, `generate-lighthouse-config`, `generate-og-images`)
 *     run pre-commit to regenerate artifacts before the commit. CI re-runs
 *     the artifacts implicitly via `prebuild` + drift checks (those `git
 *     status --porcelain` blocks in ci.yml that fail on a regeneration diff)
 *     so the verification still happens — just through a different mechanism.
 *
 * Anything outside that allow-list must appear in BOTH places.
 * @module scripts/checks/check-ci-parity
 */

import { readFileSync, existsSync } from "node:fs";

const PRE_COMMIT = ".husky/pre-commit";
const CI = ".github/workflows/ci.yml";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

/**
 * Scripts intentionally only in pre-commit. Each entry must state WHY so a
 * future maintainer can decide whether to promote it to CI as well.
 */
const PRE_COMMIT_ONLY_ALLOWED = new Set([
  // Drift checks in ci.yml re-run these and fail on diff, providing
  // equivalent coverage via a different mechanism.
  // (No actual `npm run` scripts here — generate-* scripts are invoked via
  // `node scripts/...` not `npm run`, so they don't show up in our scan.)
]);

/**
 * Scripts intentionally only in CI. Examples: ones that require artifacts
 * (`check:bundle` needs `dist/` from a prior build step), or ones that
 * pre-commit invokes directly via `node scripts/<x>.mjs` instead of through
 * `npm run` (so the script DOES run pre-commit, just not via npm).
 */
const CI_ONLY_ALLOWED = new Set([
  "check:bundle", // needs dist/ from build step
  "check:jsonld", // needs dist/ from build step (validates emitted HTML JSON-LD)
  "check:canonical-host", // needs dist/ from build step (validates emitted canonicals)
  "check:monolingual-build", // ~1-2 min (worktree + npm ci + build); too slow for pre-commit
  "build", // pre-commit doesn't build (slow + skipped artifact); CI builds + drift-checks
  // The maintenance scripts below run pre-commit via `node scripts/<x>.mjs`
  // rather than `npm run`. CI invokes them via `npm run` so the artifacts
  // come from the same source-of-truth path the user would run manually.
  "favicons",
  "og:images",
  "copyright",
  "lighthouse:config",
]);

/**
 * Parse every `npm run <name>` invocation from text.
 * @param text - File content.
 * @returns Sorted set of unique script names.
 */
function extractNpmRuns(text) {
  const scripts = new Set();
  for (const match of text.matchAll(/\bnpm run ([a-z][a-z0-9:_-]*)/g)) {
    scripts.add(match[1]);
  }
  return scripts;
}

if (!existsSync(PRE_COMMIT) || !existsSync(CI)) {
  console.error(`${RED}check-ci-parity: missing ${PRE_COMMIT} or ${CI}.${RESET}`);
  process.exit(1);
}

const preCommitScripts = extractNpmRuns(readFileSync(PRE_COMMIT, "utf8"));
const ciScripts = extractNpmRuns(readFileSync(CI, "utf8"));

const onlyPreCommit = [...preCommitScripts].filter(
  (s) => !ciScripts.has(s) && !PRE_COMMIT_ONLY_ALLOWED.has(s),
);
const onlyCi = [...ciScripts].filter((s) => !preCommitScripts.has(s) && !CI_ONLY_ALLOWED.has(s));

const violations = [];
if (onlyPreCommit.length > 0) {
  violations.push(
    `${onlyPreCommit.length} script(s) in pre-commit but NOT in ci.yml: ${onlyPreCommit.join(", ")}`,
  );
}
if (onlyCi.length > 0) {
  violations.push(
    `${onlyCi.length} script(s) in ci.yml but NOT in pre-commit: ${onlyCi.join(", ")}`,
  );
}

if (violations.length > 0) {
  console.error(`${RED}✗ check-ci-parity: drift detected${RESET}`);
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    `\n  ${YELLOW}Fix:${RESET} either add the missing invocation to the other file, or document the asymmetry in PRE_COMMIT_ONLY_ALLOWED / CI_ONLY_ALLOWED at the top of scripts/check-ci-parity.mjs.`,
  );
  process.exit(1);
}

console.log(
  `${GREEN}check-ci-parity: ${preCommitScripts.size} pre-commit, ${ciScripts.size} CI — gates aligned.${RESET}`,
);
