#!/usr/bin/env node

import { readdir, stat, mkdir, unlink, rmdir } from "node:fs/promises";
import { join, extname, relative, dirname } from "node:path";
import sharp from "sharp";

const MEDIA_DIR = "static/media";
const OPT_DIR = "static/srcset";
// `320` is the smallest variant — added so the browser can pick a
// thumbnail-appropriate file for small-displayed images (album grid
// thumbnails at ~285-380px on mobile). Keep in sync with SRCSET_WIDTHS
// in src/lib/images.ts; the runtime srcset generator filters down to
// only the widths that actually exist on disk, so they MUST match.
const WIDTHS = [320, 480, 768, 1080];
const EXTENSIONS = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const SKIP_DIRS = new Set(["admin"]);
const VARIANT_RE = /@\d+\./;

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

await mkdir(OPT_DIR, { recursive: true });

let generated = 0;
let skipped = 0;
let tooSmall = 0;
const expectedVariants = new Set();

for await (const file of walk(MEDIA_DIR)) {
  const ext = extname(file).toLowerCase();
  if (!EXTENSIONS.has(ext)) continue;
  if (VARIANT_RE.test(file)) continue;

  const rel = relative(MEDIA_DIR, file);
  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch (err) {
    console.warn(`  skipping ${rel} (unreadable image): ${err.message}`);
    continue;
  }
  if (!meta.width) {
    console.warn(`  skipping ${rel} (no width in metadata)`);
    continue;
  }

  const base = rel.slice(0, -ext.length);

  // Two variants per width: original ext (legacy fallback) + AVIF (modern,
  // typically 20-30% smaller than WebP). Markup uses <picture> or srcset
  // type negotiation to pick AVIF when supported.
  //
  // `keepExif`: AVIF only. Sharp's WebP EXIF chunk includes the "Exif\0\0"
  // JPEG-segment prefix that exiftool flags as "[minor] Improper EXIF header"
  // per the WebP container spec (the chunk should be raw EXIF, not prefixed).
  // For WebP we keep only XMP (the WebP-native attribution channel) — same
  // copyright info via XMP-dc:Rights / XMP-dc:Creator, no malformed chunk.
  // AVIF stores EXIF in a QuickTime ItemProperty box, no such prefix issue.
  const formats = [
    {
      ext: extname(rel),
      encoder: (s) => s, // pass-through encoder for source format
      keepExif: false,
    },
    {
      ext: ".avif",
      encoder: (s) => s.avif({ quality: 60, effort: 4 }),
      keepExif: true,
    },
  ];

  for (const w of WIDTHS) {
    if (meta.width <= w) {
      tooSmall++;
      continue;
    }

    for (const fmt of formats) {
      const outRel = `${base}@${w}${fmt.ext}`;
      expectedVariants.add(outRel);
      const outPath = join(OPT_DIR, outRel);

      try {
        const [srcSt, outSt] = await Promise.all([stat(file), stat(outPath)]);
        if (outSt.mtimeMs >= srcSt.mtimeMs) {
          skipped++;
          continue;
        }
      } catch {
        // Variant doesn't exist yet
      }

      await mkdir(dirname(outPath), { recursive: true });
      // Force sRGB output so a source image in Adobe RGB or Display P3 doesn't
      // ship unprofiled wide-gamut pixels that browsers misrender as sRGB.
      //
      // Inherit the source's metadata so copyright/Artist/Creator tags written
      // by embed-copyright.mjs flow through to every srcset variant. Without
      // this, sharp strips metadata by default and right-click-saved variants
      // would ship unattributed. ICC profile is intentionally NOT kept (would
      // contradict the explicit sRGB colorspace forced above). EXIF is kept
      // only when `fmt.keepExif` says so (see formats[] comment for the WebP
      // exception).
      let pipeline = sharp(file).resize(w).toColorspace("srgb").keepXmp();
      if (fmt.keepExif) pipeline = pipeline.keepExif();
      await fmt.encoder(pipeline).toFile(outPath);
      generated++;

      const outSize = (await stat(outPath)).size;
      const srcSize = (await stat(file)).size;
      const pct = Math.round((1 - outSize / srcSize) * 100);
      console.log(`  ${outPath} (${pct}% smaller)`);
    }
  }
}

let removed = 0;
for await (const optFile of walk(OPT_DIR)) {
  const rel = relative(OPT_DIR, optFile);
  if (!expectedVariants.has(rel)) {
    await unlink(optFile);
    removed++;
    console.log(`  Removed: ${rel}`);
  }
}

async function cleanEmptyDirs(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await cleanEmptyDirs(join(dir, entry.name));
      }
    }
    const remaining = await readdir(dir);
    if (remaining.length === 0 && dir !== OPT_DIR) {
      await rmdir(dir);
    }
  } catch {
    /* ignore */
  }
}
await cleanEmptyDirs(OPT_DIR);

console.log(
  `\nDone: ${generated} generated, ${skipped} up-to-date, ${tooSmall} skipped (small), ${removed} removed`,
);
