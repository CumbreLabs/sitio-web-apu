/**
 * Run the axe-core accessibility scanner against every representative URL
 * in headless Chromium. Reports violations grouped by rule id.
 *
 * Why this exists alongside the heuristic Playwright sweep (rows 8.10–8.18):
 * axe-core encodes hundreds of WCAG 2.1 AA + best-practice checks that would
 * be tedious to reimplement by hand (color contrast on actual pixels,
 * landmark-role nesting, valid ARIA combos, focusable-without-keyboard
 * detection, …). The heuristic sweep is for fast pre-commit gating; this
 * script is the deeper audit run on demand.
 *
 * Run via `npm run audit:a11y`. Assumes a preview server on `BASE_URL`
 * (default `http://localhost:4173`).
 *
 * `bypassCSP: true` is set on the browser context so the inlined axe-core
 * source from the installed npm package can run — our app's CSP would
 * otherwise refuse the eval-like injection.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");

const BASE = process.env.BASE_URL || "http://localhost:4173";
const PAGES = [
  // APU is a single-page marketing site: the home route renders every
  // section (hero, sobre-nosotros, servicios, planes, galería, contacto), so
  // the two home pages plus the two privacy pages cover all rendered UI.
  "/es/",
  "/en/",
  "/es/privacidad/",
  "/en/privacy/",
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ bypassCSP: true });

const allViolations = [];
let totalChecked = 0;

for (const path of PAGES) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 15000 });
    await page.evaluate(AXE_SOURCE);
    const results = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
      });
      return {
        violations: r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.length,
          firstTarget: v.nodes[0]?.target,
          firstFailure: v.nodes[0]?.failureSummary?.slice(0, 200),
        })),
        passCount: r.passes.length,
      };
    });
    totalChecked++;
    if (results.violations.length) {
      allViolations.push({ path, ...results });
    } else {
      console.log(`  ✔ ${path}  (${results.passCount} checks passed)`);
    }
  } catch (e) {
    console.error(`  ✗ ${path}  navigation/scan error: ${e.message}`);
    allViolations.push({ path, error: e.message });
  }
  await page.close();
}

await browser.close();

console.log(`\nScanned ${totalChecked} page(s).`);
if (allViolations.length === 0) {
  console.log("axe-scan: zero violations across all pages.");
  process.exit(0);
}

console.error(`\naxe-scan: ${allViolations.length} page(s) with violations:\n`);
for (const v of allViolations) {
  console.error(`  ${v.path}`);
  if (v.error) {
    console.error(`    error: ${v.error}`);
    continue;
  }
  for (const violation of v.violations) {
    console.error(`    [${violation.impact}] ${violation.id}: ${violation.help}`);
    console.error(
      `      ${violation.nodes} node(s); first: ${JSON.stringify(violation.firstTarget)}`,
    );
    if (violation.firstFailure) console.error(`      ${violation.firstFailure}`);
    console.error(`      ${violation.helpUrl}`);
  }
}
process.exit(1);
