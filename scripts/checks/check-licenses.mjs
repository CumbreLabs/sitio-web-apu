#!/usr/bin/env node
// Dependency-license audit.
//
// Walks the production dependency tree via `license-checker-rseidelsohn`
// (the maintained fork of the original `license-checker`) and fails CI
// if any transitive dep ships under a license that ISN'T on the allowlist.
// The allowlist is permissive licenses + public-domain — anything
// share-alike (GPL-3.0, AGPL-3.0) or unknown is a hard fail because we
// distribute the bundled JS as part of the static site and a copyleft
// license would arguably bind the rest of our (proprietary) bundle.
//
// `--production` skips devDependencies (eslint, vitest, prettier, etc.)
// — those don't ship to users so their licenses are only a process-level
// concern, not a distribution one. If a devDep ever bundles into the
// shipped JS (rare), the bundler would import it as a runtime dep and
// this gate would catch it.
//
// Runs in pre-commit + CI + audit:all.

import * as checker from "license-checker-rseidelsohn";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

// Permissive licenses we accept across all transitive runtime deps. Order
// matches descending frequency in typical Node ecosystems (MIT dominates).
const ALLOWED = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BSD",
  "Apache-2.0",
  "Apache 2.0",
  "0BSD",
  "CC0-1.0",
  "CC-BY-4.0",
  "Unlicense",
  "WTFPL",
  "Python-2.0",
  "BlueOak-1.0.0",
  // SIL Open Font License 1.1. The standard license for redistributable
  // fonts (Inter, Playfair Display, all of fontsource). NOT a copyleft
  // SOFTWARE license — it specifically permits use in any product
  // including proprietary ones; the only restriction is that the font
  // can't be sold by itself. Safe for us; we self-host + bundle but never
  // sell the typeface as a standalone artifact.
  "OFL-1.1",
  "SIL OFL 1.1",
]);

// Per-package exceptions. ONLY add a package here after manually verifying
// its actual licensing terms — license-checker's parser sometimes misreads
// dual-licensed or oddly-formatted SPDX expressions. Each entry needs a
// `reason` comment so a future audit can re-verify.
const EXCEPTIONS = new Map([
  // Example:
  // ["package-name@1.2.3", "Dual-licensed MIT OR GPL-2.0; we use MIT"],
]);

const opts = {
  start: ROOT,
  production: true,
  excludePrivatePackages: true,
};

await new Promise((resolve, reject) => {
  checker.init(opts, (err, packages) => {
    if (err) return reject(err);
    const violations = [];
    let total = 0;
    for (const [name, info] of Object.entries(packages)) {
      total++;
      if (EXCEPTIONS.has(name)) continue;
      // license-checker emits the license as a string OR as a "(MIT OR Apache-2.0)" expression
      // when the package.json lists multiple. Split on " OR " and accept if ANY clause is allowed.
      const raw = String(info.licenses ?? "UNKNOWN");
      const clauses = raw
        .replace(/[()]/g, "")
        .split(/\s+OR\s+/i)
        .map((s) => s.trim());
      const ok = clauses.some((c) => ALLOWED.has(c));
      if (!ok) {
        violations.push({ name, license: raw, repository: info.repository ?? "?" });
      }
    }
    if (violations.length > 0) {
      console.error(
        `${RED}✗${RESET} ${violations.length} package(s) with disallowed license(s):\n`,
      );
      for (const v of violations) {
        console.error(`  ${v.name}`);
        console.error(`    license:    ${v.license}`);
        console.error(`    repository: ${v.repository}`);
      }
      console.error(
        `\n${YELLOW}Fix:${RESET} replace the package, OR if the license IS acceptable (e.g. a dual-license edge case),`,
      );
      console.error(`add it to EXCEPTIONS in scripts/check-licenses.mjs with a one-line reason.`);
      console.error(`\nAllowed: ${[...ALLOWED].sort().join(", ")}`);
      process.exit(1);
    }
    console.log(
      `${GREEN}check-licenses: ${total} production dep(s) audited — all on the permissive-license allowlist.${RESET}`,
    );
    resolve();
  });
});
