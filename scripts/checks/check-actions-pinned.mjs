#!/usr/bin/env node
// GitHub Actions SHA-pin enforcer.
//
// Walks every `.github/workflows/*.yml` file and asserts that every
// `uses: org/repo@<ref>` line pins to a 40-char commit SHA, NOT a tag
// like `@v6` or `@main`. Tag pinning is a supply-chain attack vector:
// a compromised maintainer or a stolen npm token can force-push a new
// commit under an existing tag, and our CI would silently pull in the
// malicious code. Commit SHAs are immutable.
//
// Trailing `# v6` comments are encouraged so the human-readable version
// stays next to the SHA — we look for them and tolerate either presence.
//
// To bump a pinned version: look up the new SHA with
//   gh api repos/<owner>/<repo>/commits/<tag> --jq .sha
// then update both the SHA AND the trailing `# vN` comment in one edit.
//
// Runs in pre-commit + CI + audit:all.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const ROOT = new URL("../..", import.meta.url).pathname;
const WORKFLOWS = join(ROOT, ".github/workflows");

const files = readdirSync(WORKFLOWS).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
const violations = [];
let totalUses = 0;

// `uses: org/repo@<ref>` — capture the ref. Allow optional whitespace before
// `uses:`, optional leading `-` for list items, and tolerate a trailing
// `# comment` (which `# v6` annotations rely on).
const USES_RE = /^\s*-?\s*uses:\s*([^\s@#]+)@([^\s#]+)(?:\s*#.*)?$/;
// 40-char hex SHA. GitHub commit SHAs are always 40 chars; abbreviated SHAs
// are unsafe (they can collide as the repo grows).
const SHA_RE = /^[0-9a-f]{40}$/;

for (const f of files) {
  const text = readFileSync(join(WORKFLOWS, f), "utf8");
  let lineNo = 0;
  for (const line of text.split("\n")) {
    lineNo++;
    const m = line.match(USES_RE);
    if (!m) continue;
    totalUses++;
    const [, repo, ref] = m;
    // Local-action references (./.github/actions/foo) are allowed — they
    // ship in our repo, no supply chain risk.
    if (repo.startsWith("./") || repo.startsWith("../")) continue;
    if (!SHA_RE.test(ref)) {
      violations.push({ file: f, line: lineNo, repo, ref });
    }
  }
}

if (violations.length > 0) {
  console.error(`${RED}✗${RESET} ${violations.length} unpinned action(s):\n`);
  for (const v of violations) {
    console.error(`  .github/workflows/${v.file}:${v.line}  ${v.repo}@${v.ref}`);
  }
  console.error(`\nFix: replace each tag with the matching commit SHA + trailing version comment:`);
  console.error(`  uses: org/repo@<40-char-sha> # vN`);
  console.error(`\nResolve SHA with:  gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`);
  process.exit(1);
}

console.log(
  `${GREEN}check-actions-pinned: ${totalUses} action reference(s) across ${files.length} workflow(s) — all SHA-pinned.${RESET}`,
);
