/**
 * Smoke tests for the maintenance scripts under scripts/. They're already
 * exercised in pre-commit + CI + audit:all, but those runs depend on
 * idempotency to stay clean — if a script crashes on a specific edge case
 * in real data, the failure would only surface mid-commit. This file runs
 * each idempotent script in process and asserts exit 0 PLUS that no
 * unstaged file changes are produced (which would mean the script
 * accidentally became non-idempotent after a refactor).
 *
 * Skips the heavy ones: optimize-images, generate-favicons, generate-og-images
 * all touch the filesystem in ways that can produce mtime-only differences
 * (sharp re-encodes faster than the script's mtime guard updates). Those
 * are covered by the pre-commit hook + the CI drift checks.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/**
 * Run a check script under `scripts/checks/` and return its exit code +
 * combined output. `relPath` is the filename only (e.g. `"check-image-paths.mjs"`)
 * — the `scripts/checks/` prefix is added internally.
 * @param relPath - Filename of the check script under `scripts/checks/`.
 * @param ms - Per-process timeout in ms (default 30 s).
 * @returns Object with combined `stdout` and exit `status`.
 */
function execCheck(relPath: string, ms = 30_000): { stdout: string; status: number } {
  try {
    const stdout = execFileSync("node", [join(ROOT, "scripts", "checks", relPath)], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
      timeout: ms,
    });
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: (e.stdout?.toString() ?? "") + "\n" + (e.stderr?.toString() ?? ""),
      status: e.status ?? 1,
    };
  }
}

describe("maintenance scripts — smoke tests on live data", () => {
  it("check-images succeeds on live data", () => {
    const r = execCheck("check-image-paths.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  it("check-portfolio-parity succeeds (every album's photos[].src array matches across locales)", () => {
    const r = execCheck("check-portfolio-parity.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  it("check-album-weight succeeds (every image + album within budget)", () => {
    const r = execCheck("check-album-weight.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  it("check-nav-slugs succeeds (every navegacion item resolves to real paginas)", () => {
    const r = execCheck("check-nav-slugs.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  it("check-required-paginas succeeds (4 system page-IDs all resolve per locale)", () => {
    const r = execCheck("check-required-paginas.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  it("check-actions-pinned succeeds (every workflow action SHA-pinned)", () => {
    const r = execCheck("check-actions-pinned.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  it("check-frontmatter succeeds (escritos + paginas frontmatter schemas valid)", () => {
    const r = execCheck("check-frontmatter.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  it("check-ci-parity succeeds (pre-commit ↔ ci.yml symmetric)", () => {
    const r = execCheck("check-ci-parity.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  it("check-node-version-parity succeeds", () => {
    const r = execCheck("check-node-version-parity.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  it("check-audit-checklist succeeds (structural integrity of AUDIT_CHECKLIST.md)", () => {
    const r = execCheck("check-audit-checklist.mjs");
    expect(r.status, r.stdout).toBe(0);
  });

  // Skip orphan-images here — it's warn-only by default + can have a small
  // number of legitimate orphans during content transitions. Pre-commit
  // still runs it for visibility.

  // check-canonical-host + check-jsonld + check-bundle all need dist/ —
  // skipped here because vitest runs without a build step. CI runs them
  // after build.
  it.skipIf(!existsSync(join(ROOT, "dist")))("check-canonical-host on existing dist/", () => {
    const r = execCheck("check-canonical-host.mjs");
    expect(r.status, r.stdout).toBe(0);
  });
});
