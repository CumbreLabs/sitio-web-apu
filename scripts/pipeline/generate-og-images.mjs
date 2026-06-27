#!/usr/bin/env node

// Generates 1200×630 landscape OG-image variants from every portrait source
// in `static/media/`. Output lives in `static/og/<stem>.webp`.
//
// Why: LinkedIn (and other social previewers) refuse to render the big
// "summary_large_image" card for portrait OG images — they collapse to a
// ~110px side-thumbnail without the description. SEO.svelte used to fall
// back to the site-wide landscape default (`fondo-paisaje.webp`) for every
// portrait page, which gave a consistently big card but always showed the
// wrong image (a landscape hero instead of the page's actual cover). This
// pipeline fixes that: each portrait cover gets its own landscape OG
// variant via a blurred self-fill composite — the original is centered
// inside 1200×630 with a heavily blurred upscale of itself behind it, so
// the actual album/post visual identity shows through in social cards
// while still meeting LinkedIn's 1.91:1 aspect requirement.
//
// Idempotent: skips when output mtime ≥ source mtime, removes any stale
// outputs whose source no longer exists or flipped to landscape.

import { readdir, stat, mkdir, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import sharp from "sharp";

const MEDIA_DIR = "static/media";
const OG_DIR = "static/og";
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const EXTENSIONS = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const VARIANT_RE = /@\d+\./;

await mkdir(OG_DIR, { recursive: true });

let generated = 0;
let skipped = 0;
let nonPortrait = 0;
const expected = new Set();

let entries = [];
try {
  entries = await readdir(MEDIA_DIR);
} catch {
  // No media dir yet — nothing to do.
}

for (const f of entries) {
  const ext = extname(f).toLowerCase();
  if (!EXTENSIONS.has(ext)) continue;
  if (VARIANT_RE.test(f)) continue; // never re-process an @480/@768/@1080 variant

  const srcPath = join(MEDIA_DIR, f);
  let meta;
  try {
    meta = await sharp(srcPath).metadata();
  } catch (err) {
    console.warn(`  skipping ${f} (unreadable image): ${err.message}`);
    continue;
  }
  if (!meta.width || !meta.height) continue;

  // Landscape + square images render fine as-is in social previews. Only
  // portrait sources need the composited landscape variant.
  if (meta.height <= meta.width) {
    nonPortrait++;
    continue;
  }

  const stem = f.slice(0, -ext.length);
  const outName = `${stem}.webp`;
  const outPath = join(OG_DIR, outName);
  expected.add(outName);

  try {
    const [srcSt, outSt] = await Promise.all([stat(srcPath), stat(outPath)]);
    if (outSt.mtimeMs >= srcSt.mtimeMs) {
      skipped++;
      continue;
    }
  } catch {
    // Output missing — fall through to generation.
  }

  // Blurred self-fill: cover-resize the source to fill 1200×630 then blur
  // heavily for the backdrop, then composite the contain-resized original
  // centered over it. Two-pass because sharp's composite can't blur a
  // single layer mid-pipeline.
  const bg = await sharp(srcPath).resize(OG_WIDTH, OG_HEIGHT, { fit: "cover" }).blur(40).toBuffer();
  const fg = await sharp(srcPath).resize(OG_WIDTH, OG_HEIGHT, { fit: "inside" }).toBuffer();

  await sharp(bg)
    .composite([{ input: fg, gravity: "center" }])
    .toColorspace("srgb")
    .webp({ quality: 85 })
    .toFile(outPath);

  generated++;
  console.log(`  ${outPath}`);
}

let removed = 0;
try {
  const existing = await readdir(OG_DIR);
  for (const f of existing) {
    if (!expected.has(f)) {
      await unlink(join(OG_DIR, f));
      removed++;
      console.log(`  Removed: ${f}`);
    }
  }
} catch {
  // OG_DIR was just created above so this should never throw, but be permissive.
}

console.log(
  `\nDone: ${generated} generated, ${skipped} up-to-date, ${nonPortrait} non-portrait (skipped), ${removed} removed`,
);
