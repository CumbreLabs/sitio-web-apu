#!/usr/bin/env node
// Per-album image-weight budget.
//
// Photography portfolios have a natural failure mode: an editor uploads a
// 12 MB raw export instead of an optimized WebP, or the album cover is a
// 5 MB master file. The srcset pipeline (optimize-images.mjs) downscales for
// the browser, but the SOURCE file ends up in git history forever and slows
// every build (sharp re-encodes it on every CI run). This validator catches
// bloated sources at commit time so they never land.
//
// Budgets are calibrated for the current portfolio's distribution (max per
// image today is ~200 KB; max per album is ~190 KB total). The hard limits
// are intentionally generous so the validator only trips on actual bloat —
// bump them if a legitimate high-res-master need arises (and document why).
//
// Runs in pre-commit + CI + audit:all.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const ROOT = new URL("../..", import.meta.url).pathname;
const PORTFOLIO = join(ROOT, "src/data/portafolio");
const MEDIA = join(ROOT, "static/media");

// Per-image hard limit. Source WebP files above this are flagged regardless
// of how few are in an album. A well-optimized WebP cover at 1600×2400 is
// typically 250-500 KB; 2 MB indicates an unoptimized export.
const PER_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

// Per-album total source weight. Generous on purpose: an album with 40
// photos at 500 KB each fits under this. If you legitimately need a
// portfolio-heavy album above 20 MB, document the reason and bump.
const PER_ALBUM_MAX_BYTES = 20 * 1024 * 1024;

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

if (!existsSync(PORTFOLIO)) {
  console.log("check-album-weight: no portfolio directory, skipping.");
  process.exit(0);
}

// Walk every album JSON in every locale. Iterate locale-first so the same
// album appearing in ES + EN doesn't double-count its photos — we collect
// into a Set of unique src paths per album-id.
const albumImages = new Map(); // albumId -> Set of public src paths

for (const lang of readdirSync(PORTFOLIO)) {
  if (lang.startsWith(".")) continue;
  const langDir = join(PORTFOLIO, lang);
  if (!statSync(langDir).isDirectory()) continue;
  for (const file of readdirSync(langDir)) {
    if (!file.endsWith(".json")) continue;
    const albumId = file.replace(/\.json$/, "");
    const album = JSON.parse(readFileSync(join(langDir, file), "utf-8"));
    if (!albumImages.has(albumId)) albumImages.set(albumId, new Set());
    const set = albumImages.get(albumId);
    if (typeof album.coverSrc === "string" && album.coverSrc) set.add(album.coverSrc);
    if (Array.isArray(album.photos)) {
      for (const p of album.photos) {
        if (p && typeof p.src === "string" && p.src) set.add(p.src);
      }
    }
  }
}

const failures = [];
let totalAlbums = 0;
let totalImages = 0;
let totalBytes = 0;

for (const [albumId, srcSet] of albumImages) {
  totalAlbums++;
  let albumBytes = 0;
  const albumFails = [];
  for (const publicPath of srcSet) {
    const filePath = join(MEDIA, publicPath.replace(/^\/media\//, ""));
    if (!existsSync(filePath)) {
      // Broken refs are caught by check:images; skip here so we don't double-report.
      continue;
    }
    const size = statSync(filePath).size;
    albumBytes += size;
    totalImages++;
    totalBytes += size;
    if (size > PER_IMAGE_MAX_BYTES) {
      albumFails.push(
        `    [per-image] ${publicPath}: ${fmt(size)} > ${fmt(PER_IMAGE_MAX_BYTES)} limit`,
      );
    }
  }
  if (albumBytes > PER_ALBUM_MAX_BYTES) {
    albumFails.unshift(
      `    [per-album] total ${fmt(albumBytes)} > ${fmt(PER_ALBUM_MAX_BYTES)} limit (${srcSet.size} photo${srcSet.size === 1 ? "" : "s"})`,
    );
  }
  if (albumFails.length > 0) {
    failures.push({ albumId, fails: albumFails });
  }
}

if (failures.length > 0) {
  console.error(`${RED}✗${RESET} ${failures.length} album(s) exceed image-weight budget:\n`);
  for (const { albumId, fails } of failures) {
    console.error(`  ${albumId}`);
    for (const f of fails) console.error(f);
  }
  console.error(
    `\nFix: re-export the flagged images at lower quality (e.g. \`cwebp -q 85\`) or smaller dimensions.`,
  );
  console.error(
    `If the size is intentional (high-res master needed), bump PER_IMAGE_MAX_BYTES or PER_ALBUM_MAX_BYTES in scripts/check-album-weight.mjs with a comment explaining why.`,
  );
  process.exit(1);
}

console.log(
  `${GREEN}check-album-weight: ${totalAlbums} album(s), ${totalImages} image(s), ${fmt(totalBytes)} total — all within budget (per-image ≤ ${fmt(PER_IMAGE_MAX_BYTES)}, per-album ≤ ${fmt(PER_ALBUM_MAX_BYTES)}).${RESET}`,
);
