#!/usr/bin/env node
// Monolingual-build smoke test (AUDIT_CHECKLIST.md #18.8).
//
// Spins up a temporary git worktree, deletes the non-default-language
// locale folders, sets `languages: ["<default>"]` + `defaultLanguage: "<default>"`,
// runs `npm run build`, and asserts the build succeeds with the right URL
// shape. Proves the i18n abstraction holds — a fork that only ships one
// language can do so by editing sitio.json, with NO code changes.
//
// Uses `git worktree add` so the source tree stays untouched. The worktree
// lives in /tmp and the script always cleans up via `git worktree remove
// --force`, even on failure.
//
// CI-only — too slow + too destructive for pre-commit. Wall-clock is
// dominated by the `npm ci` in the worktree (~30-60 s) plus the build
// itself (~30 s). ~1-2 min total.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
  mkdtempSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

function runQuiet(args, opts = {}) {
  return execFileSync(args[0], args.slice(1), {
    stdio: "pipe",
    encoding: "utf8",
    cwd: ROOT,
    ...opts,
  });
}

try {
  runQuiet(["git", "rev-parse", "--git-dir"]);
} catch {
  console.log(
    `${YELLOW}check-monolingual-build:${RESET} not a git repo, skipping (only runs in CI / dev checkouts).`,
  );
  process.exit(0);
}

const tmpRoot = mkdtempSync(join(tmpdir(), "lh-mono-"));
const worktreePath = join(tmpRoot, "worktree");
let cleanedUp = false;

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  try {
    runQuiet(["git", "worktree", "remove", "--force", worktreePath]);
  } catch {
    // worktree might never have been added if we failed early
  }
  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

console.log(`check-monolingual-build: creating temp worktree at ${worktreePath}`);
try {
  runQuiet(["git", "worktree", "add", "--detach", worktreePath, "HEAD"]);
} catch (err) {
  console.error(`${RED}✗${RESET} git worktree add failed:`, err.message);
  process.exit(1);
}

const sitioPath = join(worktreePath, "src/data/configuracion/es/sitio.json");
const sitio = JSON.parse(readFileSync(sitioPath, "utf8"));
const defaultLang = sitio.defaultLanguage || "es";
const allLangs = Array.isArray(sitio.languages) ? sitio.languages : [defaultLang];
const otherLangs = allLangs.filter((l) => l !== defaultLang);

if (otherLangs.length === 0) {
  console.log(
    `${GREEN}check-monolingual-build:${RESET} already monolingual (languages: ["${defaultLang}"]) — nothing to test.`,
  );
  cleanup();
  process.exit(0);
}

console.log(
  `check-monolingual-build: stripping locales [${otherLangs.join(", ")}], keeping "${defaultLang}"`,
);

// 1. Rewrite every sitio.json slice to declare only the default lang.
for (const langDir of readdirSync(join(worktreePath, "src/data/configuracion"))) {
  const sitioPathLang = join(worktreePath, "src/data/configuracion", langDir, "sitio.json");
  if (!existsSync(sitioPathLang)) continue;
  const obj = JSON.parse(readFileSync(sitioPathLang, "utf8"));
  obj.languages = [defaultLang];
  obj.defaultLanguage = defaultLang;
  writeFileSync(sitioPathLang, JSON.stringify(obj, null, 2) + "\n");
}

// 2. Delete every non-default-language locale folder across the data root.
const dataDirs = [
  "src/data/paginas",
  "src/data/escritos",
  "src/data/portafolio",
  "src/data/colecciones",
  "src/data/configuracion",
];
for (const d of dataDirs) {
  const abs = join(worktreePath, d);
  if (!existsSync(abs)) continue;
  for (const entry of readdirSync(abs)) {
    const full = join(abs, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry === defaultLang) continue;
    if (otherLangs.includes(entry)) {
      rmSync(full, { recursive: true, force: true });
    }
  }
}

// 3. Install deps in the worktree (uses the same lockfile) + build.
console.log("check-monolingual-build: npm ci in worktree…");
try {
  execFileSync("npm", ["ci", "--no-audit", "--no-fund", "--prefer-offline"], {
    cwd: worktreePath,
    stdio: "pipe",
    env: { ...process.env, HUSKY: "0" },
  });
} catch (err) {
  console.error(`${RED}✗${RESET} npm ci failed in worktree:`, err.message);
  process.exit(1);
}

console.log("check-monolingual-build: building…");
try {
  execFileSync("npm", ["run", "build"], {
    cwd: worktreePath,
    stdio: "inherit",
    env: { ...process.env, HUSKY: "0" },
  });
} catch (err) {
  console.error(`${RED}✗${RESET} build failed in monolingual mode:`, err.message);
  console.error(
    `\nThis indicates the framework code carries a hidden assumption about ${JSON.stringify(otherLangs)} being present.`,
  );
  process.exit(1);
}

// 4. Assert: dist/<otherLang>/ should NOT exist; dist/<defaultLang>/ should.
for (const lang of otherLangs) {
  const dir = join(worktreePath, "dist", lang);
  if (existsSync(dir)) {
    console.error(
      `${RED}✗${RESET} dist/${lang}/ exists after stripping that locale — fork bug, framework code is hardcoded somewhere.`,
    );
    process.exit(1);
  }
}
const defaultDir = join(worktreePath, "dist", defaultLang);
if (!existsSync(defaultDir)) {
  console.error(`${RED}✗${RESET} dist/${defaultLang}/ missing after monolingual build.`);
  process.exit(1);
}

console.log(
  `${GREEN}check-monolingual-build: monolingual build (languages: ["${defaultLang}"]) succeeds.${RESET}`,
);
