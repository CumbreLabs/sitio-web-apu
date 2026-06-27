#!/usr/bin/env node
// Portfolio photos[].src parity across locales.
//
// Why: portfolio photos are the SAME physical files for every locale — only
// the `alt` text differs. The CMS schema declares `photos: i18n: duplicate`
// with `src: i18n: duplicate` + `alt: i18n: true` inside, so Sveltia mirrors
// the array shape and per-photo src across locales automatically. But a
// direct hand-edit to one locale's JSON (or a temporary regression of the
// schema flag back to `i18n: true`) can re-introduce drift silently — and
// the site would then render different photo sets per locale without any
// visible error.
//
// This script asserts that for every album that exists in BOTH locales, the
// photos[].src array is identical in length AND order. Differences are
// reported with the album name, the position, and the two diverging src
// paths so reconciliation is mechanical.
//
// Runs in pre-commit + CI + audit:all.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const ROOT = new URL("../..", import.meta.url).pathname;
const PORTFOLIO = join(ROOT, "src/data/portafolio");

// A fork with no portfolio section (e.g. APU, a single-page marketing site)
// ships no `src/data/portafolio/` dir at all. Skip cleanly instead of crashing
// on readdirSync(ENOENT) — mirrors check:frontmatter's "not found, skipping".
if (!existsSync(PORTFOLIO)) {
  console.log("check-portfolio-parity: src/data/portafolio/ not found, skipping.");
  process.exit(0);
}

const LOCALES = readdirSync(PORTFOLIO)
  .filter((d) => !d.startsWith(".") && statSync(join(PORTFOLIO, d)).isDirectory())
  .filter((d) => readdirSync(join(PORTFOLIO, d)).some((f) => f.endsWith(".json")));

if (LOCALES.length < 2) {
  console.log(
    `check-portfolio-parity: only one locale (${LOCALES.join(", ")}), nothing to compare.`,
  );
  process.exit(0);
}

const [primary, ...others] = LOCALES;
const primaryDir = join(PORTFOLIO, primary);
const albums = readdirSync(primaryDir).filter((f) => f.endsWith(".json"));

let failures = 0;
let compared = 0;

for (const album of albums) {
  const primaryPath = join(primaryDir, album);
  const primaryData = JSON.parse(readFileSync(primaryPath, "utf8"));
  const primarySrcs = (primaryData.photos ?? []).map((p) => p.src);

  for (const other of others) {
    const otherPath = join(PORTFOLIO, other, album);
    if (!existsSync(otherPath)) continue;
    compared++;

    const otherData = JSON.parse(readFileSync(otherPath, "utf8"));
    const otherSrcs = (otherData.photos ?? []).map((p) => p.src);

    if (primarySrcs.length !== otherSrcs.length) {
      console.error(
        `${RED}✗${RESET} ${album}: length mismatch — ${primary} has ${primarySrcs.length}, ${other} has ${otherSrcs.length}`,
      );
      failures++;
      continue;
    }
    const diffs = [];
    for (let i = 0; i < primarySrcs.length; i++) {
      if (primarySrcs[i] !== otherSrcs[i]) {
        diffs.push(`    [${i}] ${primary}: ${primarySrcs[i]} | ${other}: ${otherSrcs[i]}`);
      }
    }
    if (diffs.length > 0) {
      console.error(`${RED}✗${RESET} ${album}: src array drift between ${primary} and ${other}:`);
      diffs.forEach((d) => console.error(d));
      console.error(
        `    fix: reorder ${other}/${album} photos[] to match ${primary}/${album}, keeping each alt glued to its src.`,
      );
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\ncheck-portfolio-parity: ${failures} album(s) drifted across locales.`);
  process.exit(1);
}
console.log(
  `${GREEN}check-portfolio-parity: ${compared} album comparison(s) across ${LOCALES.length} locales — all in sync.${RESET}`,
);
