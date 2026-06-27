/**
 * Bundle-size regression budget. Run after `npm run build`. Fails (exit 1) if
 * any tracked bucket grows beyond the budget below. Encodes the intent that
 * bundle size is a deliberate decision: a 10KB bump in chunks needs a
 * conscious bump of the budget here, not a silent accumulation.
 *
 * Budgets are deliberately set ~25% over the current measurement so normal
 * content/dep updates don't trip them. Tighten as the site grows or shrinks.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DIST = join(ROOT, "dist", "_app", "immutable");

// Per-bucket budget in kilobytes. Bump deliberately when a feature legitimately
// increases the budget; don't bump to silence regressions.
const BUDGETS = {
  // SvelteKit-managed JS chunks (shared code). Bumped 400 → 480 KB after the
  // build-time markdown migration (`scripts/vite/rendered-pages.ts`):
  //   - **OUT** of the client bundle: `marked` (~15 K gzip), the old Shiki
  //     pre-tokenized code-cache Map, `marked-gfm-heading-id`, `github-slugger`
  //     usage from `markdown.ts`, the 280-line `src/lib/markdown.ts`, the
  //     200-line `src/lib/frontmatter.ts`, and `src/lib/headings.ts`. Net
  //     library-code reduction: ~25 KB minified.
  //   - **IN** the client bundle: pre-rendered, sanitized HTML for every `.md`
  //     under `escritos/` + `paginas/`. For this site's code-heavy posts each
  //     fenced block balloons ~3× through Shiki's dual-theme inline-style
  //     output (`color:#X;--shiki-dark:#Y` on every token span). Net body-
  //     content growth: ~50 KB for the current 12 posts × ~5 code blocks
  //     each. The two effects roughly cancel for prose-only sites (see arena:
  //     304 → 280 K); on a code-heavy site they net out positive.
  //
  // Worth the trade: zero markdown machinery in the client, build-time
  // sanitization via `sanitize-html` (defense-in-depth, not theater), single
  // source of truth for rendering. A further optimization (Shiki transformer
  // that maps inline styles to deduplicated CSS classes — Option A in the
  // bundle audit) would recover most of that growth; it's deliberately
  // deferred to keep the rendered-pages plugin minimal and avoid coupling
  // the markdown output to `app.css`.
  chunks: 480,
  nodes: 80, // per-route page entries
  entry: 24, // app/start entry shims
  assets: 800, // CSS + fonts + other static-emitted assets (Inter + Lora subsets land ~630K)
};

if (!existsSync(DIST)) {
  console.error("check-bundle-size: dist/_app/immutable not found — run `npm run build` first.");
  process.exit(1);
}

let failed = false;
const lines = [];
for (const [bucket, budget] of Object.entries(BUDGETS)) {
  const dir = join(DIST, bucket);
  if (!existsSync(dir)) {
    lines.push(`  ${bucket.padEnd(8)}  (missing — skipped)`);
    continue;
  }
  const out = execSync(`du -sk "${dir}"`, { encoding: "utf-8" }).trim();
  const actual = parseInt(out.split(/\s+/)[0], 10);
  const pct = Math.round((actual / budget) * 100);
  const status = actual > budget ? "FAIL" : "ok";
  lines.push(
    `  ${bucket.padEnd(8)} ${String(actual).padStart(4)}K / ${String(budget).padStart(4)}K  (${pct}%)  ${status}`,
  );
  if (actual > budget) failed = true;
}

console.log("Bundle-size budgets:");
for (const line of lines) console.log(line);

if (failed) {
  console.error(
    "\ncheck-bundle-size: one or more buckets exceeded the budget. If this is intentional, bump the BUDGETS object in scripts/check-bundle-size.mjs.",
  );
  process.exit(1);
}
console.log("\nAll buckets within budget.");
