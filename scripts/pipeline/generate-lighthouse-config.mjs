/**
 * Generate lighthouse/{type}-{lang}.json (6 files) from the actual data in
 * src/data/ so the URL list always reflects current page slugs (no stale URLs
 * after a slug rename — which would 404 in CI). Runs on pre-commit + CI so the
 * committed configs are always in sync with content.
 *
 * Why six configs instead of two? Splits the audit across more parallel CI
 * matrix workers — each shard runs a shorter URL list, so wall-clock drops
 * from ~15-25 min (one big config per lang) to ~3-7 min (split per type).
 * GitHub Actions free tier allows plenty of concurrent jobs, so widening the
 * matrix is essentially free.
 *
 * Shards:
 *   core-{lang}   — root (`/` only in core-es since it canonicalizes there),
 *                   lang home, every listing in src/data/paginas/{lang}/*.md
 *   albums-{lang} — every active album in src/data/portafolio/{lang}/*.json
 *   writing-{lang}— every active writing post in src/data/escritos/{lang}/*.md
 *
 * Union of the six shards equals every active built HTML page (44 pages) plus
 * the root (`/`) = 45 unique URLs — same coverage as the previous two-file
 * setup, just spread across 6 workers instead of 2.
 *
 * Run standalone: node scripts/generate-lighthouse-config.mjs
 * Or via npm:     npm run lighthouse:config
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA = join(ROOT, "src", "data");
const OUT_DIR = join(ROOT, "lighthouse");

// 3 runs per shard. Was 2, bumped after run #148 surfaced a 30x TBT outlier
// on the `/` URL (perf 63 vs 94+ on the byte-identical `/es/` + `/en/`) —
// classic hardware-jitter symptom that 2 runs can't filter out. Lighthouse CI
// takes the median, so 3 runs lets one bad sample get outvoted by the two
// stable ones. Wall-clock impact: ~+50% per shard (e.g. core-es 6 min → 9 min).
// Total Lighthouse workflow stays under the 10-min timeout cap since shards
// run in parallel and the longest shard's wall-clock is what matters.
const NUMBER_OF_RUNS = 3;
// `defaultLanguage` is `i18n: duplicate` in the CMS — identical across locale
// slices — so reading any one is fine as the source of truth. We probe the ES
// slice first (the historical default) and fall back to whichever
// configuracion/<lang>/ folder exists. A monolingual site that only ships an
// EN slice is read directly.
import { readdirSync as _readdirSync } from "node:fs";
/**
 * Find the first readable sitio.json under configuracion/<lang>/ and return
 * its parsed contents. Probes ES first (the historical default), then EN,
 * then any other locale directory present on disk — so a monolingual fork
 * that only ships e.g. `configuracion/fr/` still resolves correctly.
 * @returns Parsed sitio.json object, or {} when none exists.
 */
/**
 * Load a per-locale JSON file from configuracion/, probing ES first then EN
 * then any other locale directory present on disk. Returns {} when none exists.
 * @param filename - File name to read (e.g. "sitio.json", "escritos.json").
 * @returns Parsed JSON object, or {} when no readable file is found.
 */
function loadLocaleJson(filename) {
  const root = join(DATA, "configuracion");
  let dirs;
  try {
    dirs = _readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return {};
  }
  for (const lang of ["es", "en", ...dirs]) {
    try {
      return JSON.parse(readFileSync(join(root, lang, filename), "utf-8"));
    } catch {
      // try next
    }
  }
  return {};
}
const siteConfig = loadLocaleJson("sitio.json");
const writingConfig = loadLocaleJson("escritos.json");
const portfolioConfig = loadLocaleJson("portafolio.json");

// Language list comes from sitio.json; section page-ids come from
// escritos.json + portafolio.json so a fork that renames `writingPageId` to
// "blog" gets correct lighthouse URLs without editing this script.
const LANGS =
  Array.isArray(siteConfig.languages) && siteConfig.languages.length > 0
    ? siteConfig.languages
    : ["es", "en"];
const defaultLang = siteConfig.defaultLanguage || LANGS[0];
const HOME_PAGE_ID = siteConfig.homePage || "inicio";
const WRITING_PAGE_ID = writingConfig.writingPageId || "escritos";
const PORTFOLIO_PAGE_ID = portfolioConfig.portfolioPageId || "portafolio";

/** Section-listing page slugs that are NOT included in lighthouse runs (handled separately). */
const SKIP_PAGE_IDS = new Set([HOME_PAGE_ID]);

/**
 * Extract the value of a YAML key from a settings block (very small parser:
 * single-quoted or double-quoted or bare strings only; assumes the project's
 * frontmatter conventions).
 * @param block - The `settings:` block as a multi-line string.
 * @param key - The key to read.
 * @returns The extracted value, or undefined.
 */
function readSettingsValue(block, key) {
  const re = new RegExp(`^\\s+${key}:\\s*(.*)$`, "m");
  const m = block.match(re);
  if (!m) return undefined;
  return m[1].replace(/^['"]|['"]$/g, "").trim();
}

/**
 * Parse the frontmatter of a markdown file and return its known fields.
 * @param text - File contents.
 * @returns Object with slug, date, active, settingsSlug.
 */
function parseMarkdownFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { active: true };
  const fm = m[1];
  const topSlug = fm
    .match(/^slug:\s*(.*)$/m)?.[1]
    ?.replace(/^['"]|['"]$/g, "")
    .trim();
  const date = fm
    .match(/^date:\s*(.*)$/m)?.[1]
    ?.replace(/^['"]|['"]$/g, "")
    .trim();
  const settingsBlock = fm.match(/^settings:\n((?:\s+.*\n?)*)/m)?.[1] ?? "";
  const settingsSlug = readSettingsValue(settingsBlock, "slug");
  const activeRaw = readSettingsValue(settingsBlock, "active");
  const active = activeRaw !== "false";
  return { slug: topSlug, date, active, settingsSlug };
}

/**
 * Resolve listing-page slugs from paginas/{lang}/*.md.
 * @param lang - Language code.
 * @returns Map of page id (filename) → slug.
 */
function listingPageSlugs(lang) {
  const dir = join(DATA, "paginas", lang);
  if (!existsSync(dir)) return new Map();
  const map = new Map();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const id = name.replace(/\.md$/, "");
    if (SKIP_PAGE_IDS.has(id)) continue;
    const { active, settingsSlug } = parseMarkdownFrontmatter(
      readFileSync(join(dir, name), "utf-8"),
    );
    if (!active) continue;
    map.set(id, settingsSlug || id);
  }
  return map;
}

/**
 * All active portfolio album slugs in deterministic order.
 * @param lang - Language code.
 * @returns Slugs for every active album in the language, sorted by filename.
 */
function allAlbumSlugs(lang) {
  const dir = join(DATA, "portafolio", lang);
  if (!existsSync(dir)) return [];
  const slugs = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    const album = JSON.parse(readFileSync(join(dir, name), "utf-8"));
    if (album.settings?.active === false) continue;
    slugs.push(album.settings?.slug || name.replace(/\.json$/, ""));
  }
  return slugs;
}

/**
 * All active writing posts in deterministic order (newest first, then slug
 * alphabetical as tie-breaker).
 * @param lang - Language code.
 * @returns Every active post with slug/year/month.
 */
function allWritingPosts(lang) {
  const dir = join(DATA, "escritos", lang);
  if (!existsSync(dir)) return [];
  const posts = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const { slug, date, active, settingsSlug } = parseMarkdownFrontmatter(
      readFileSync(join(dir, name), "utf-8"),
    );
    if (!active || !date) continue;
    const m = date.match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    const finalSlug = settingsSlug || slug || name.replace(/\.md$/, "");
    posts.push({ slug: finalSlug, year: m[1], month: m[2], date });
  }
  return posts
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
    .map(({ slug, year, month }) => ({ slug, year, month }));
}

/**
 * Build the URL list for the `core` shard of a language: root (only in the
 * default-lang shard so we don't audit identical content twice), language
 * home, and every listing page.
 * @param lang - Language code.
 * @returns Ordered list of lighthouse URLs.
 */
function buildCoreUrls(lang) {
  const urls = [];
  if (lang === defaultLang) urls.push("http://localhost/");
  urls.push(`http://localhost/${lang}/`);
  const pages = [...listingPageSlugs(lang).entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [, slug] of pages) urls.push(`http://localhost/${lang}/${slug}/`);
  return [...new Set(urls)];
}

/**
 * Build the URL list for the `albums` shard of a language.
 * @param lang - Language code.
 * @returns Ordered list of album URLs.
 */
function buildAlbumsUrls(lang) {
  const portfolioPageSlug = listingPageSlugs(lang).get(PORTFOLIO_PAGE_ID) ?? PORTFOLIO_PAGE_ID;
  return allAlbumSlugs(lang).map(
    (slug) => `http://localhost/${lang}/${portfolioPageSlug}/${slug}/`,
  );
}

/**
 * Build the URL list for the `writing` shard of a language.
 * @param lang - Language code.
 * @returns Ordered list of writing-post URLs.
 */
function buildWritingUrls(lang) {
  const writingPageSlug = listingPageSlugs(lang).get(WRITING_PAGE_ID) ?? WRITING_PAGE_ID;
  return allWritingPosts(lang).map(
    (post) =>
      `http://localhost/${lang}/${writingPageSlug}/${post.year}/${post.month}/${post.slug}/`,
  );
}

/** Map shard name → URL builder. */
const SHARDS = {
  core: buildCoreUrls,
  albums: buildAlbumsUrls,
  writing: buildWritingUrls,
};

/**
 * Build a complete lighthouserc config object for one shard.
 * @param urls - URL list this shard should audit.
 * @returns The serializable lighthouse CI config.
 */
function buildConfig(urls) {
  return {
    ci: {
      collect: {
        staticDistDir: "./dist",
        isSinglePageApplication: false,
        numberOfRuns: NUMBER_OF_RUNS,
        url: urls,
      },
      assert: {
        assertions: {
          "categories:performance": ["warn", { minScore: 0.9 }],
          "categories:accessibility": ["error", { minScore: 0.9 }],
          "categories:best-practices": ["error", { minScore: 0.9 }],
          "categories:seo": ["error", { minScore: 0.9 }],
        },
      },
      upload: {
        target: "temporary-public-storage",
      },
    },
  };
}

// Recreate the output folder fresh each run so removed shards (e.g. a future
// rename) can't leave stale configs behind that CI would still try to load.
// Keeps the directory in lockstep with the SHARDS map without a separate
// cleanup pass.
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

let wrote = 0;
const expectedFiles = [];
for (const lang of LANGS) {
  for (const [shard, builder] of Object.entries(SHARDS)) {
    const urls = builder(lang);
    if (urls.length === 0) continue;
    const config = buildConfig(urls);
    const out = JSON.stringify(config, null, 2) + "\n";
    const filename = `${shard}-${lang}.json`;
    const path = join(OUT_DIR, filename);
    writeFileSync(path, out);
    wrote++;
    expectedFiles.push(filename);
    console.log(`Wrote ${relative(ROOT, path)} (${urls.length} URLs)`);
  }
}

console.log(
  `\nDone: ${wrote} configs written across ${LANGS.length} languages × ${Object.keys(SHARDS).length} content types. (default lang: ${defaultLang})`,
);
