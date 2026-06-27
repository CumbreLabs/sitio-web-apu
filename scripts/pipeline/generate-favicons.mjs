/**
 * Generate every favicon variant the site needs from a SINGLE high-resolution
 * source image declared in `src/data/configuracion/{lang}/sitio.json`
 * (`favicon` field — a `i18n: duplicate` field, identical in every locale slice).
 *
 * Outputs (overwrite-only-if-changed for idempotency):
 *   static/favicon.ico                   (multi-size: 16, 32, 48)
 *   static/favicon/favicon-16x16.png
 *   static/favicon/favicon-32x32.png
 *   static/favicon/apple-icon-180x180.png
 *   static/favicon/android-icon-{36,48,72,96,144,192}.png
 *   static/favicon/favicon-512x512.png
 *   static/favicon/manifest.json
 *
 * Anything else in `static/favicon/` is treated as stale (legacy MS-tile /
 * iOS<8 sizes from an old generator) and removed so the directory stays in
 * lockstep with what `src/app.html` and `manifest.json` actually reference.
 *
 * Source format: any image sharp can read — PNG, JPEG, WebP, SVG, TIFF.
 * ICO is rejected with a helpful error (sharp can't decode ICO).
 *
 * Run standalone:  node scripts/generate-favicons.mjs
 * Or as part of:   npm run favicons  (also via pre-commit hook + CI)
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PUBLIC = join(ROOT, "static");
const FAVICON_DIR = join(PUBLIC, "favicon");
const ROOT_ICO = join(PUBLIC, "favicon.ico");
// Load whichever per-locale sitio.json + seo.json files exist (a fork may
// ship a single locale). The PWA `description` lives in `seo.json` (per-
// language). `defaultLanguage` is derived from whichever sitio file is
// present — both should agree because `defaultLanguage` is `i18n: duplicate`,
// but we read it from whichever loaded successfully so a monolingual fork
// that's deleted the non-default locale still bootstraps cleanly.
const SITE_ES_PATH = join(ROOT, "src", "data", "configuracion", "es", "sitio.json");
const SITE_EN_PATH = join(ROOT, "src", "data", "configuracion", "en", "sitio.json");
const SEO_ES_PATH = join(ROOT, "src", "data", "configuracion", "es", "seo.json");
const SEO_EN_PATH = join(ROOT, "src", "data", "configuracion", "en", "seo.json");
const siteEs = existsSync(SITE_ES_PATH) ? JSON.parse(readFileSync(SITE_ES_PATH, "utf-8")) : {};
const siteEn = existsSync(SITE_EN_PATH) ? JSON.parse(readFileSync(SITE_EN_PATH, "utf-8")) : {};
const seoEs = existsSync(SEO_ES_PATH) ? JSON.parse(readFileSync(SEO_ES_PATH, "utf-8")) : {};
const seoEn = existsSync(SEO_EN_PATH) ? JSON.parse(readFileSync(SEO_EN_PATH, "utf-8")) : {};
const defaultLang = siteEs.defaultLanguage || siteEn.defaultLanguage || "es";
const siteConfig = defaultLang === "en" ? siteEn : siteEs;
const seoConfig = defaultLang === "en" ? seoEn : seoEs;

// PWA manifest is single-locale (it carries its own `lang` field) — use the
// default language's description from seo.json.
const manifestDescription = seoConfig.description || "";
const faviconUrl = siteConfig.favicon || "/media/favicon.ico";
const sourcePath = join(PUBLIC, faviconUrl.replace(/^\//, ""));

if (!existsSync(sourcePath)) {
  console.error(`generate-favicons: source not found at ${sourcePath}`);
  console.error(
    `  configured as "favicon": "${faviconUrl}" in configuracion/${defaultLang}/sitio.json`,
  );
  process.exit(1);
}

if (extname(sourcePath).toLowerCase() === ".ico") {
  console.error(`generate-favicons: source is ICO (${faviconUrl}) — sharp can't read ICO.`);
  console.error(`  Upload a high-resolution PNG/SVG/WebP as the favicon source instead`);
  console.error(`  (>= 512x512 recommended) and update sitio.json's "favicon" field.`);
  process.exit(1);
}

// Every PNG variant referenced from src/app.html or static/favicon/manifest.json.
// Keep this list and the manifest writer below in sync.
const PNG_OUTPUTS = [
  { size: 16, name: "favicon-16x16.png" },
  { size: 32, name: "favicon-32x32.png" },
  { size: 36, name: "android-icon-36x36.png" },
  { size: 48, name: "android-icon-48x48.png" },
  { size: 72, name: "android-icon-72x72.png" },
  { size: 96, name: "android-icon-96x96.png" },
  { size: 144, name: "android-icon-144x144.png" },
  { size: 180, name: "apple-icon-180x180.png" },
  { size: 192, name: "android-icon-192x192.png" },
  { size: 512, name: "favicon-512x512.png" },
];
const ICO_SIZES = [16, 32, 48];
const MANIFEST_NAME = "manifest.json";

/**
 * Write `bytes` to `filePath` only when the existing file differs. Returns
 * true if a write happened so the caller can report churn vs. no-op.
 * @param filePath - Absolute output path.
 * @param bytes - Bytes to write.
 * @returns True if the file was written.
 */
function writeIfChanged(filePath, bytes) {
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath);
    if (existing.equals(bytes)) return false;
  }
  writeFileSync(filePath, bytes);
  return true;
}

// Multi-size favicon.ico is assembled by `png-to-ico` (a small, focused Node
// dep that accepts an array of PNG Buffers and writes a spec-compliant ICO
// header + directory). Replaces the ~30-line hand-rolled Buffer-writing
// pngsToIco helper that did the exact same thing. Trade-off: one more dev
// dependency, but a real library beats hand-rolling a 1985-era binary format
// — png-to-ico is tested across thousands of downloads and handles edge
// cases (non-32bpp PNGs, palette images, the 256-size special case) that
// the hand-roll never bothered with.

mkdirSync(FAVICON_DIR, { recursive: true });

let writes = 0;
let nochanges = 0;

// 1. Per-size PNGs into static/favicon/.
const pngBufferBySize = new Map();
for (const { size, name } of PNG_OUTPUTS) {
  const buf = await sharp(sourcePath).resize(size, size).png().toBuffer();
  pngBufferBySize.set(size, buf);
  const outPath = join(FAVICON_DIR, name);
  if (writeIfChanged(outPath, buf)) {
    writes++;
    console.log(`  + ${relative(ROOT, outPath)}`);
  } else {
    nochanges++;
  }
}

// 2. Multi-size favicon.ico at the static root. Reuses the per-size PNG
//    buffers from step 1 (so sharp only ever decodes the source once per
//    size) and hands them to `png-to-ico` which assembles the multi-image
//    ICO directory in spec-compliant order.
const icoSourceBuffers = [];
for (const size of ICO_SIZES) {
  let buf = pngBufferBySize.get(size);
  if (!buf) {
    buf = await sharp(sourcePath).resize(size, size).png().toBuffer();
  }
  icoSourceBuffers.push(buf);
}
const icoBytes = await pngToIco(icoSourceBuffers);
if (writeIfChanged(ROOT_ICO, icoBytes)) {
  writes++;
  console.log(`  + ${relative(ROOT, ROOT_ICO)}`);
} else {
  nochanges++;
}

// 3. Web App Manifest, derived from sitio.json so name/theme don't drift.
// The default-language home URL is used for start_url / scope so a PWA install
// lands on the right localized landing page instead of forcing a /<lang>/
// redirect on every launch.
const defaultHome = `/${siteConfig.defaultLanguage || "es"}/`;
const manifest = {
  name: siteConfig.name || "",
  short_name: (siteConfig.name || "").split(/\s+/).slice(0, 2).join(" "),
  description: manifestDescription,
  lang: siteConfig.defaultLanguage || "es",
  dir: "ltr",
  // Stable PWA identifier — without `id`, Chrome derives it from start_url
  // and any future start_url change would create a separate "new" PWA in the
  // user's install list. Pin it to the site root so installs survive future
  // changes to the launch URL.
  id: "/",
  scope: "/",
  start_url: defaultHome,
  display: "standalone",
  orientation: "any",
  // Brand color for the PWA toolbar tint + install splash, taken from
  // sitio.json#themeColor so it tracks the site palette instead of drifting
  // to a hardcoded default.
  theme_color: siteConfig.themeColor || "#0c0a09",
  background_color: siteConfig.themeColor || "#0c0a09",
  icons: PNG_OUTPUTS.filter(
    (o) => o.name.startsWith("android-icon-") || o.name === "favicon-512x512.png",
  ).map(({ size, name }) => ({
    src: `/favicon/${name}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    // 192 + 512 are required Android install icons; mark them maskable so the
    // launcher can crop to a safe area instead of showing the raw square.
    ...(size === 192 || size === 512 ? { purpose: "any maskable" } : {}),
  })),
};
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
const manifestPath = join(FAVICON_DIR, MANIFEST_NAME);
if (writeIfChanged(manifestPath, manifestBytes)) {
  writes++;
  console.log(`  + ${relative(ROOT, manifestPath)}`);
} else {
  nochanges++;
}

// 4. Sweep stale files. Anything in static/favicon/ that isn't in the
//    generated set is left over from a previous generator and gets removed
//    so the directory stays a faithful mirror of what we ship.
const keepNames = new Set([...PNG_OUTPUTS.map((o) => o.name), MANIFEST_NAME]);
let removed = 0;
for (const name of readdirSync(FAVICON_DIR)) {
  if (!keepNames.has(name)) {
    unlinkSync(join(FAVICON_DIR, name));
    removed++;
    console.log(`  - ${relative(ROOT, join(FAVICON_DIR, name))}`);
  }
}

console.log(`\nDone: ${writes} written (${nochanges} already in sync), ${removed} stale removed.`);
console.log(`Source: ${relative(ROOT, sourcePath)}`);
