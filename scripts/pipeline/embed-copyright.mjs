/**
 * Embeds copyright and authorship metadata (EXIF, IPTC, XMP) into
 * selected images, and strips copyright from all others.
 *
 * Idempotent: reads current metadata in one bulk exiftool call, then only
 * writes to files whose tags differ from the desired state. Files already
 * in sync are skipped so their mtime (and git status) stays clean.
 *
 * Requires `exiftool` to be installed: brew install exiftool
 *
 * Run standalone:  node scripts/embed-copyright.mjs
 * Or as part of:   npm run copyright
 */

import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PUBLIC = join(ROOT, "static");

// ---------- config (read from configuracion/{lang}/sitio.json so it stays in sync with the CMS) ----------
// `name` and `url` are `i18n: duplicate` in the CMS config, so their values
// are identical across locale slices — read whichever sitio.json exists. A
// monolingual fork that only ships an EN slice still works.
const CONFIG_ROOT = join(ROOT, "src", "data", "configuracion");
function loadSiteConfig() {
  let langs;
  try {
    langs = readdirSync(CONFIG_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { config: {}, langs: [] };
  }
  for (const lang of ["es", "en", ...langs]) {
    try {
      const text = readFileSync(join(CONFIG_ROOT, lang, "sitio.json"), "utf-8");
      return { config: JSON.parse(text), langs };
    } catch {
      /* try next */
    }
  }
  return { config: {}, langs };
}
const { config: siteConfig, langs: ALL_LANGS } = loadSiteConfig();
const SITE_LANGS =
  Array.isArray(siteConfig.languages) && siteConfig.languages.length > 0
    ? siteConfig.languages
    : ALL_LANGS;
const AUTHOR = siteConfig.author || siteConfig.name || "";
// `copyrightNotice` is a template string from sitio.json with two
// placeholders: `{author}` (siteConfig.author) and `{year}` (current year).
// Default keeps the historical "© <name>. All rights reserved." shape so
// existing data files without the field still produce the same output.
// A fork can swap it for any wording:
//   "© {year} {author}, CC-BY-NC 4.0"
//   "Copyright (c) {author} — All photos by their respective owners"
const COPYRIGHT_TEMPLATE = siteConfig.copyrightNotice || "© {author}. All rights reserved.";
const COPYRIGHT = COPYRIGHT_TEMPLATE.replace(/\{author\}/g, AUTHOR).replace(
  /\{year\}/g,
  String(new Date().getFullYear()),
);
const WEBSITE = siteConfig.url || "";
const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".ico",
  ".webp",
  ".avif",
]);
// ICO files cannot be written by exiftool — exclude from embed/strip. AVIF is
// supported by exiftool 12.50+ for XMP writes (ubuntu-latest + macOS Homebrew
// both ship newer versions, so safe to enable).
const WRITABLE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".avif"]);

// Source of truth for "which images get the site author's copyright": the
// photo `src` paths declared in src/data/portafolio/<lang>/*.json (plus each
// album's `coverSrc`). Iterates the languages declared in sitio.json so a
// monolingual or trilingual fork picks up the right set of folders without
// editing this script. Filename-based heuristics would drift the moment
// someone renames a file or adds a new album with a different prefix.
//
// Iterates with the default language FIRST so the title / description we
// embed reads as default-lang prose (the first value added to a Set wins on
// later iteration). EN/ES title fields are typically translations of each
// other; default-lang is the right pick for the primary metadata since the
// canonical URL also lives there.
const DEFAULT_LANG = siteConfig.defaultLanguage || SITE_LANGS[0];
const LANGS_DEFAULT_FIRST = [DEFAULT_LANG, ...SITE_LANGS.filter((l) => l !== DEFAULT_LANG)];
const PORTFOLIO_DIRS = LANGS_DEFAULT_FIRST.map((lang) =>
  join(ROOT, "src", "data", "portafolio", lang),
);

/**
 * Collect every image `src` referenced by a portfolio album JSON file.
 * Reads both `coverSrc` and each entry in the `photos` array.
 * @param albumPath - Absolute path to an album JSON file.
 * @returns Array of public image paths (e.g. "/media/foo.webp").
 */
function collectAlbumImages(albumPath) {
  const album = JSON.parse(readFileSync(albumPath, "utf-8"));
  const srcs = [];
  if (typeof album.coverSrc === "string" && album.coverSrc) srcs.push(album.coverSrc);
  if (Array.isArray(album.photos)) {
    for (const p of album.photos) {
      if (p && typeof p.src === "string" && p.src) srcs.push(p.src);
    }
  }
  return srcs;
}

const portfolioSrcSet = new Set();

// Per-image semantic metadata for Google Image Search SEO. Keyed by public
// `src` path (e.g. "/media/album-handstand-01.webp"); value is a structure
// describing the title (album-level), description (per-photo alt or
// album-level for covers), and keywords (album tags). Each field is a Set
// during accumulation so we can merge entries across locales — a tag like
// "Portraits" might be the same in both ES + EN JSONs and we want it once;
// translated tags ("Dance" vs "Danza") merge into a multi-keyword set so an
// image-search query in either language can surface the photo.
const imageMetadata = new Map();

function getOrCreateMetadata(src) {
  let m = imageMetadata.get(src);
  if (!m) {
    m = { titles: new Set(), descriptions: new Set(), keywords: new Set() };
    imageMetadata.set(src, m);
  }
  return m;
}

for (const dir of PORTFOLIO_DIRS) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const albumPath = join(dir, entry.name);
    const album = JSON.parse(readFileSync(albumPath, "utf-8"));
    const albumTitle = typeof album.title === "string" ? album.title.trim() : "";
    const albumTags =
      typeof album.tags === "string"
        ? album.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

    for (const src of collectAlbumImages(albumPath)) {
      portfolioSrcSet.add(src);
      const m = getOrCreateMetadata(src);
      if (albumTitle) m.titles.add(albumTitle);
      for (const tag of albumTags) m.keywords.add(tag);
    }

    // Per-photo alt only — covers don't have per-image alt text, so their
    // description falls back to the album title (handled at write time).
    if (Array.isArray(album.photos)) {
      for (const p of album.photos) {
        if (!p?.src || typeof p.alt !== "string" || !p.alt.trim()) continue;
        getOrCreateMetadata(p.src).descriptions.add(p.alt.trim());
      }
    }
  }
}

/**
 * Resolve the desired semantic tags for one image: title (album title),
 * description (per-photo alt, or album title for cover-only images), and
 * keywords (sorted album tags). Returns null for images outside the
 * portfolio set so callers can skip the per-image write.
 * @param publicPath - Public path like "/media/foo.webp".
 * @returns Tag struct or null.
 */
function getSemanticTags(publicPath) {
  const m = imageMetadata.get(publicPath);
  if (!m) return null;
  // First element of each Set was inserted by the default-lang iteration.
  const title = [...m.titles][0] || "";
  const description = [...m.descriptions][0] || title;
  // Sort keywords for deterministic output (idempotency).
  const keywords = [...m.keywords].sort();
  return { title, description, keywords };
}

/**
 * Decide whether a file should have the site author's copyright embedded.
 * True when the file's public URL appears in any portfolio album's
 * `coverSrc` or `photos`.
 * @param filePath - Absolute path to a candidate image under static/.
 * @returns True if the file is referenced by a portfolio album.
 */
function shouldCopyright(filePath) {
  const publicPath = "/" + relative(PUBLIC, filePath).split(/[\\/]/).join("/");
  return portfolioSrcSet.has(publicPath);
}

// Desired tag values when embedding. Keys match the exiftool JSON keys.
// IPTC tags are intentionally omitted — WebP (the project's only image
// format) doesn't store IPTC, so writing them silently no-ops while the
// re-read returns empty, breaking idempotency. XMP-dc:Rights / XMP-dc:Creator
// carry the same semantic info in a format WebP actually supports.
const EMBED_TAGS = {
  Copyright: COPYRIGHT,
  Artist: AUTHOR,
  Creator: AUTHOR,
  Rights: COPYRIGHT,
  WebStatement: WEBSITE,
  Marked: "True",
};

const STRIP_TAG_KEYS = Object.keys(EMBED_TAGS);

// ---------- helpers ----------
function findImages(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findImages(fullPath));
    } else if (IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

function findSingleImage(filePath) {
  if (existsSync(filePath) && IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    return [filePath];
  }
  return [];
}

function hasExiftool() {
  try {
    execFileSync("exiftool", ["-ver"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function runExiftool(args) {
  execFileSync("exiftool", args, { stdio: "inherit", cwd: ROOT });
}

/**
 * Read all relevant copyright AND semantic tags from a batch of files in one
 * exiftool call. Semantic tags (Title/Description/Subject) are added so the
 * per-image SEO embed can decide whether to write or skip — same idempotency
 * guarantee as copyright tags.
 * @param files - Absolute paths of images to read.
 * @returns Map keyed by `SourceFile` → tag object.
 */
function readCopyrightTags(files) {
  if (files.length === 0) return new Map();
  const args = [
    "-j",
    "-Copyright",
    "-Artist",
    "-Creator",
    "-XMP-dc:Creator",
    "-XMP-dc:Rights",
    "-XMP-xmpRights:WebStatement",
    "-XMP-xmpRights:Marked",
    "-XMP-dc:Title",
    "-XMP-dc:Description",
    "-XMP-dc:Subject",
    ...files,
  ];
  const stdout = execFileSync("exiftool", args, { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  const map = new Map();
  for (const entry of JSON.parse(stdout)) {
    map.set(entry.SourceFile, entry);
  }
  return map;
}

/**
 * Normalize an exiftool JSON value for comparison.
 * Arrays (e.g. Creator written via both EXIF Creator and XMP-dc:Creator) collapse
 * to the first element. Booleans (e.g. Marked=true) become lowercased strings.
 * @param value - Raw value from exiftool's JSON output.
 * @returns Trimmed string ready for case-insensitive comparison.
 */
function normalizeTag(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value).trim();
}

function needsEmbed(tags) {
  if (!tags) return true;
  for (const [key, desired] of Object.entries(EMBED_TAGS)) {
    const current = normalizeTag(tags[key]).toLowerCase();
    const target = String(desired).trim().toLowerCase();
    if (current !== target) return true;
  }
  return false;
}

function needsStrip(tags) {
  if (!tags) return false;
  return STRIP_TAG_KEYS.some((key) => normalizeTag(tags[key]) !== "");
}

/**
 * Compare current semantic tags against desired. Exiftool returns `Subject` as
 * either a `;`-separated string OR an array depending on count + version, so
 * normalize both sides to a sorted array of strings for comparison.
 * @param current - The exiftool entry for this file.
 * @param desired - Desired semantic tags from `getSemanticTags()`.
 * @returns True if the embed should run.
 */
function needsSemanticEmbed(current, desired) {
  if (!desired) return false;
  const currentTitle = normalizeTag(current?.Title);
  const currentDescription = normalizeTag(current?.Description);
  let currentSubject = current?.Subject;
  if (typeof currentSubject === "string") {
    currentSubject = currentSubject
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (!Array.isArray(currentSubject)) {
    currentSubject = [];
  }
  currentSubject = [...currentSubject].sort();
  const desiredSubject = [...desired.keywords].sort();
  if (currentTitle !== desired.title) return true;
  if (currentDescription !== desired.description) return true;
  if (currentSubject.length !== desiredSubject.length) return true;
  for (let i = 0; i < desiredSubject.length; i++) {
    if (currentSubject[i] !== desiredSubject[i]) return true;
  }
  return false;
}

/**
 * Build the exiftool args for one image's semantic embed.
 * `XMP-dc:Subject` is a list field: the first `Subject=` arg clears the list,
 * subsequent `Subject=value` args append. Title + Description are scalar.
 * @param desired - The desired semantic tags.
 * @returns Array of exiftool CLI args.
 */
function buildSemanticEmbedArgs(desired) {
  const args = [
    `-XMP-dc:Title=${desired.title}`,
    `-XMP-dc:Description=${desired.description}`,
    `-XMP-dc:Subject=`,
  ];
  for (const k of desired.keywords) args.push(`-XMP-dc:Subject=${k}`);
  return args;
}

// ---------- main ----------
if (!hasExiftool()) {
  console.warn("⚠ exiftool not found — skipping copyright embedding.");
  console.warn("  Install with: brew install exiftool");
  process.exit(0);
}

// Step 1: Find ALL images in static/ that we touch (originals + favicons).
// Skip static/srcset/ — sharp variants inherit EXIF/XMP from the source via
// .keepExif().keepXmp() in optimize-images.mjs, so as long as this script runs
// BEFORE optimize-images in the maintenance pipeline (pre-commit hook + daily
// workflow are ordered this way), variants automatically carry the right
// copyright without us having to write to each one. If you reorder the
// scripts, the next optimize-images run will still propagate metadata — but
// the *current* commit's variants would be stale until then.
const allImages = [
  ...findImages(join(PUBLIC, "media")),
  ...findImages(join(PUBLIC, "favicon")),
  ...findSingleImage(join(PUBLIC, "favicon.ico")),
];

if (allImages.length === 0) {
  console.log("No images found.");
  process.exit(0);
}

// Step 2: Determine which images get copyright vs stripped (writable formats only)
const copyrightTargets = [];
const stripTargets = [];

for (const img of allImages) {
  if (!WRITABLE_EXTENSIONS.has(extname(img).toLowerCase())) continue;
  if (shouldCopyright(img)) {
    copyrightTargets.push(img);
  } else {
    stripTargets.push(img);
  }
}

// Step 3: Read existing tags in a single batch to decide what actually needs writing.
const allCandidates = [...copyrightTargets, ...stripTargets];
const currentTags = readCopyrightTags(allCandidates);

const toEmbed = copyrightTargets.filter((img) => needsEmbed(currentTags.get(img)));
const toStrip = stripTargets.filter((img) => needsStrip(currentTags.get(img)));
const embedSkipped = copyrightTargets.length - toEmbed.length;
const stripSkipped = stripTargets.length - toStrip.length;

// Step 4: Strip copyright AND semantic tags from non-copyrighted images that
// still have them. If an image was previously in a portfolio album and got
// removed, its semantic tags would be stale; stripping ensures non-portfolio
// images carry zero of our metadata.
if (toStrip.length > 0) {
  console.log(`\nStripping copyright from ${toStrip.length} image(s):`);
  for (const img of toStrip) console.log(`  - ${relative(PUBLIC, img)}`);
  try {
    runExiftool([
      "-Copyright=",
      "-Artist=",
      "-Creator=",
      "-XMP-dc:Creator=",
      "-XMP-dc:Rights=",
      "-XMP-xmpRights:WebStatement=",
      "-XMP-xmpRights:Marked=",
      "-XMP-dc:Title=",
      "-XMP-dc:Description=",
      "-XMP-dc:Subject=",
      "-overwrite_original",
      ...toStrip,
    ]);
  } catch (err) {
    console.error("Failed to strip copyright:", err);
  }
}

// Step 5: Embed copyright in copyrighted images that don't match the desired state
if (toEmbed.length > 0) {
  console.log(`\nEmbedding copyright in ${toEmbed.length} image(s):`);
  for (const img of toEmbed) console.log(`  + ${relative(PUBLIC, img)}`);
  try {
    runExiftool([
      `-Copyright=${COPYRIGHT}`,
      `-Artist=${AUTHOR}`,
      `-Creator=${AUTHOR}`,
      `-XMP-dc:Creator=${AUTHOR}`,
      `-XMP-dc:Rights=${COPYRIGHT}`,
      `-XMP-xmpRights:WebStatement=${WEBSITE}`,
      `-XMP-xmpRights:Marked=True`,
      "-overwrite_original",
      ...toEmbed,
    ]);
  } catch (err) {
    console.error("Failed to embed copyright:", err);
    process.exit(1);
  }
}

// Step 6: Embed per-image semantic metadata (Title / Description / Subject)
// for Google Image Search SEO. Title = album title, Description = per-photo
// alt (or album title for cover-only images), Subject = album tags merged
// across locales. Only applies to portfolio images (covers + photos), never
// editorial / system images. Re-reads tags so the freshly-written copyright
// from step 5 doesn't make us think semantic tags are still missing.
const refreshedTags = readCopyrightTags(copyrightTargets);
const semanticWork = [];
let semanticSkipped = 0;
for (const img of copyrightTargets) {
  const publicPath = "/" + relative(PUBLIC, img).split(/[\\/]/).join("/");
  const desired = getSemanticTags(publicPath);
  if (!desired) continue;
  if (needsSemanticEmbed(refreshedTags.get(img), desired)) {
    semanticWork.push({ img, desired });
  } else {
    semanticSkipped++;
  }
}

if (semanticWork.length > 0) {
  console.log(`\nEmbedding semantic metadata in ${semanticWork.length} image(s):`);
  for (const { img } of semanticWork) console.log(`  ◆ ${relative(PUBLIC, img)}`);
  // Per-image exiftool call because the embed args differ per file (each
  // photo has its own alt-derived description). ~30 portfolio images × ~100ms
  // each ≈ 3 sec total — acceptable for a pre-commit / daily script. If the
  // portfolio grows past ~200 images, switch to `-@ argfile` batching.
  for (const { img, desired } of semanticWork) {
    try {
      runExiftool([...buildSemanticEmbedArgs(desired), "-overwrite_original", img]);
    } catch (err) {
      console.error(`Failed to embed semantic metadata in ${relative(PUBLIC, img)}:`, err);
      process.exit(1);
    }
  }
}

console.log(
  `\nDone: ${toEmbed.length} embedded (${embedSkipped} already in sync), ${toStrip.length} stripped (${stripSkipped} already clean), ${semanticWork.length} semantic embeds (${semanticSkipped} already in sync).`,
);
