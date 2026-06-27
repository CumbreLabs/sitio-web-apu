/**
 * Post-process `dist/404.html` after the SvelteKit build.
 *
 * `adapter-static`'s `fallback: "404.html"` emits a route-content-free copy of
 * `app.html`, which GitHub Pages serves (with HTTP 404 status) for any URL
 * that doesn't match a built page. SvelteKit boots client-side, the router
 * resolves to no route, and `+error.svelte` renders.
 *
 * The shell has no `<title>` and no robots directive, so the URL-as-served
 * looks naked in the browser tab during boot and could in principle be
 * indexed (the HTTP 404 status is the primary signal, but adding `noindex` is
 * belt-and-suspenders). This script injects both directly into the shell.
 *
 * Runs as `postbuild`, so every `npm run build` produces a consistent 404.
 * Idempotent: re-running on an already-processed file is a no-op.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FILE = join(ROOT, "dist", "404.html");

if (!existsSync(FILE)) {
  console.warn("postprocess-404: dist/404.html not found — skipping (build may have failed).");
  process.exit(0);
}

// Pull the site name from the default-locale sitio.json so a fork doesn't
// need to edit this script. Falls back gracefully when sitio.json is absent
// or malformed (e.g. fresh clone before `npm ci` runs the JSON-aware build).
let siteName = "";
try {
  const defaultLocaleConfig = JSON.parse(
    readFileSync(join(ROOT, "src", "data", "configuracion", "es", "sitio.json"), "utf-8"),
  );
  const defaultLang = defaultLocaleConfig.defaultLanguage || "es";
  const config = JSON.parse(
    readFileSync(join(ROOT, "src", "data", "configuracion", defaultLang, "sitio.json"), "utf-8"),
  );
  siteName = (config && typeof config.name === "string" && config.name.trim()) || "";
} catch {
  // Fresh clone or unexpected layout — leave siteName empty.
}

const html = readFileSync(FILE, "utf-8");

const NOINDEX = '<meta name="robots" content="noindex" />';
const TITLE = `<title>Page not found${siteName ? ` | ${siteName}` : ""}</title>`;

let updated = html;
let changed = false;

// Insert noindex once, right after <meta charset>. The order matters: noindex
// must come before any external resource load so a crawler that aborts early
// still sees it.
if (!updated.includes('name="robots"')) {
  updated = updated.replace(
    /<meta charset="UTF-8" \/>/,
    `<meta charset="UTF-8" />\n    ${NOINDEX}`,
  );
  changed = true;
}

// Insert a stable <title>. The +error.svelte page replaces this with the
// localized version after hydration, but the static shell has something
// readable until then.
if (!/<title>[^<]*<\/title>/.test(updated)) {
  updated = updated.replace(/<\/head>/, `    ${TITLE}\n  </head>`);
  changed = true;
}

if (changed) {
  writeFileSync(FILE, updated);
  console.log("postprocess-404: injected noindex + title into dist/404.html.");
} else {
  console.log("postprocess-404: dist/404.html already processed (no-op).");
}
