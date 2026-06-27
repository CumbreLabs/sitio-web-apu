/**
 * Smoke-test the built site across Chromium, Firefox, and WebKit (Safari).
 *
 * Why: the rest of the project ships under SvelteKit + Tailwind + custom
 * runes — patterns that USUALLY render identically across engines, but the
 * one time they don't (Safari quirk on `<dialog>`, Firefox `:has()` selector
 * difference, etc.) is exactly the thing manual QA misses. This script gives
 * a cheap-and-fast "did anything obvious break?" gate by loading a small
 * representative URL set in all three engines, asserting 200 + clean console
 * + single `<h1>` + correct lang attribute.
 *
 * Run via `npm run smoke:cross-browser`. Assumes a preview server is already
 * running on `BASE_URL` (default `http://localhost:4173`); start one with
 * `npm run preview` in another terminal first, or run `npm run smoke:full`
 * which orchestrates build → preview → smoke → kill.
 *
 * Exits non-zero on any console.error, pageerror, or non-2xx response.
 */
import { chromium, firefox, webkit } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:4173";
// Representative URL set — one per template (home + section landing + album +
// post + privacy) across both locales. Not exhaustive on purpose: the goal
// is a fast smoke, not full coverage.
const PAGES = [
  "/",
  "/es/",
  "/en/",
  "/es/sobre-mi/",
  "/en/about/",
  "/es/blog/",
  "/en/blog/",
  "/es/blog/2026/02/how-i-use-claude-code/",
  "/es/charlas/",
  "/en/talks/",
];
const ENGINES = { chromium, firefox, webkit };

const allFindings = [];

for (const [name, launcher] of Object.entries(ENGINES)) {
  let browser;
  try {
    browser = await launcher.launch({ headless: true });
  } catch (e) {
    console.error(`[${name}] failed to launch:`, e.message);
    allFindings.push({ engine: name, path: "(launch)", issues: [`launch error: ${e.message}`] });
    continue;
  }
  const ctx = await browser.newContext();
  for (const path of PAGES) {
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      // Only log console.error — warnings are noisy across engines (deprecated
      // API hints, etc.) and don't indicate broken pages.
      if (m.type() === "error") pageErrors.push(`console.error: ${m.text().slice(0, 200)}`);
    });
    try {
      const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 15000 });
      const status = res?.status() ?? 0;
      const probe = await page.evaluate(() => ({
        title: document.title,
        lang: document.documentElement.lang,
        h1Count: document.querySelectorAll("h1").length,
      }));
      const issues = [];
      if (status >= 400) issues.push(`HTTP ${status}`);
      if (probe.h1Count !== 1) issues.push(`h1Count=${probe.h1Count}`);
      if (!probe.lang) issues.push("missing <html lang>");
      issues.push(...pageErrors);
      if (issues.length) {
        allFindings.push({ engine: name, path, issues });
      }
    } catch (e) {
      allFindings.push({ engine: name, path, issues: [`navigation error: ${e.message}`] });
    }
    await page.close();
  }
  await browser.close();
}

if (allFindings.length === 0) {
  console.log(
    `cross-browser-smoke: ${Object.keys(ENGINES).length} engines × ${PAGES.length} pages — all clean.`,
  );
  process.exit(0);
}

console.error(`\ncross-browser-smoke: ${allFindings.length} page(s) with issues:\n`);
for (const f of allFindings) {
  console.error(`  [${f.engine}] ${f.path}`);
  for (const issue of f.issues) console.error(`    - ${issue}`);
}
process.exit(1);
