#!/usr/bin/env node
// Canonical-host parity.
//
// GitHub Pages serves both the apex (`arenalucia.co`, 301s to www) and the
// canonical (`www.arenalucia.co`). Mixed `<link rel="canonical">` values
// would split SEO juice across two domains. This script walks `dist/**/*.html`,
// extracts every canonical href, and fails if any of them point at a host
// that isn't the canonical `www.` variant from `siteConfig.url`.
//
// Needs `dist/` from a prior build. Runs in pre-commit + CI + audit:all after
// `npm run build` produces the static output.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const ROOT = new URL("../..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");

// Pull canonical host from the same source the runtime uses, so a fork that
// switches to `acme.com` automatically updates this validator's expectation
// without a script edit. Try the ES file first (most common) and fall back
// to EN so a monolingual `en`-only fork without `es/` still works.
const sitioEs = join(ROOT, "src/data/configuracion/es/sitio.json");
const sitioEn = join(ROOT, "src/data/configuracion/en/sitio.json");
const sitioPath = existsSync(sitioEs) ? sitioEs : sitioEn;
const { url } = JSON.parse(readFileSync(sitioPath, "utf8"));
const expectedHost = new URL(url).host;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile() && entry.endsWith(".html")) out.push(full);
  }
  return out;
}

let htmlFiles;
try {
  htmlFiles = walk(DIST);
} catch (err) {
  if (err.code === "ENOENT") {
    console.error(`check-canonical-host: dist/ not found. Run \`npm run build\` first.`);
    process.exit(1);
  }
  throw err;
}

const CANONICAL_RE = /<link\s+rel="canonical"\s+href="([^"]+)"/gi;
const failures = [];
let totalCanonicals = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(CANONICAL_RE)) {
    totalCanonicals++;
    const href = match[1];
    let host;
    try {
      host = new URL(href).host;
    } catch {
      failures.push({ file, href, reason: "not a valid URL" });
      continue;
    }
    if (host !== expectedHost) {
      failures.push({
        file: file.replace(`${ROOT}/`, ""),
        href,
        reason: `host '${host}' != expected '${expectedHost}'`,
      });
    }
  }
}

if (failures.length > 0) {
  console.error(`${RED}✗${RESET} canonical host mismatch in ${failures.length} location(s):`);
  for (const f of failures) {
    console.error(`    ${f.file}: ${f.href} (${f.reason})`);
  }
  console.error(
    `\ncheck-canonical-host: expected every canonical to use host '${expectedHost}' (from sitio.json#url).`,
  );
  process.exit(1);
}

console.log(
  `${GREEN}check-canonical-host: ${htmlFiles.length} HTML files, ${totalCanonicals} canonical(s) — all on '${expectedHost}'.${RESET}`,
);
