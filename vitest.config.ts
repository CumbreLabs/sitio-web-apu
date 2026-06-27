import { defineConfig, type Plugin } from "vitest/config";
import { readdirSync } from "node:fs";
import { join } from "node:path";

// Tests import a few virtual modules (`virtual:srcset-manifest`,
// `virtual:image-dims`, `virtual:og-manifest`) defined by Vite plugins in
// vite.config.ts. We can't load the full SvelteKit plugin chain here (it
// expects `$app/*` imports and .svelte components in the test runtime, which
// Vitest doesn't provide without `@sveltejs/vite-plugin-svelte` + the kit
// adapter shim). So we re-declare lightweight versions of just the virtual
// modules the units under test need. Markdown tests stub `imgDims()`
// directly, so the image-dims plugin returns an empty map here.

const SRCSET_VIRTUAL = "virtual:srcset-manifest";
const IMAGE_DIMS_VIRTUAL = "virtual:image-dims";
const OG_VIRTUAL = "virtual:og-manifest";
const HIGHLIGHTED_CODE_VIRTUAL = "virtual:highlighted-code";

/**
 * Minimal srcset-manifest plugin for Vitest. Reads `static/srcset/` so tests
 * that exercise `imgSrcset()` see the same available variants as production.
 * @returns Vite plugin instance.
 */
function srcsetManifest(): Plugin {
  const resolvedId = "\0" + SRCSET_VIRTUAL;
  return {
    name: "test-srcset-manifest",
    resolveId(id) {
      return id === SRCSET_VIRTUAL ? resolvedId : undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      let files: string[] = [];
      try {
        files = readdirSync(join("static", "srcset")).map((f) => `/srcset/${f}`);
      } catch {
        // Fresh clones may not have built srcset variants yet.
      }
      return `export default new Set(${JSON.stringify(files)});`;
    },
  };
}

/**
 * OG-manifest virtual returns the real set of generated `/og/*.webp` paths so
 * tests that exercise `SEO.svelte`'s portrait-variant lookup mirror production
 * — the OG variants are deterministic build artifacts of portrait covers and
 * stay in lockstep with the data. Tests that need a specific stubbed set
 * still mock it per-test via `vi.mock("virtual:og-manifest", ...)`.
 * @returns Vite plugin instance.
 */
function ogManifest(): Plugin {
  const resolvedId = "\0" + OG_VIRTUAL;
  return {
    name: "test-og-manifest",
    resolveId(id) {
      return id === OG_VIRTUAL ? resolvedId : undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      let files: string[] = [];
      try {
        files = readdirSync(join("static", "og")).map((f) => `/og/${f}`);
      } catch {
        // static/og may not exist on fresh clones / before first OG run.
      }
      return `export default new Set(${JSON.stringify(files)});`;
    },
  };
}

/**
 * Image-dims virtual returns an empty Map for tests. Markdown tests construct
 * their own dims via the `imgDims` mock; using the real sharp-based plugin in
 * tests would be slow (measures every file in static/media/) and unnecessary.
 * @returns Vite plugin instance.
 */
function emptyImageDims(): Plugin {
  const resolvedId = "\0" + IMAGE_DIMS_VIRTUAL;
  return {
    name: "test-image-dims",
    resolveId(id) {
      return id === IMAGE_DIMS_VIRTUAL ? resolvedId : undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      return `export default new Map();`;
    },
  };
}

/**
 * Highlighted-code virtual returns an empty Map for tests. The production
 * plugin walks `src/data/{escritos,paginas}/**` and runs Shiki, which is
 * slow + irrelevant for unit tests — markdown tests assert against the
 * plain `<pre><code class="language-X">` fallback that runs on cache miss.
 * Tests that want to exercise a cache hit can mock `virtual:highlighted-code`
 * per-test via `vi.mock(...)`.
 * @returns Vite plugin instance.
 */
function emptyHighlightedCode(): Plugin {
  const resolvedId = "\0" + HIGHLIGHTED_CODE_VIRTUAL;
  return {
    name: "test-highlighted-code",
    resolveId(id) {
      return id === HIGHLIGHTED_CODE_VIRTUAL ? resolvedId : undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      return `export default new Map();`;
    },
  };
}

export default defineConfig({
  plugins: [srcsetManifest(), emptyImageDims(), ogManifest(), emptyHighlightedCode()],
  resolve: {
    alias: {
      // Match SvelteKit's `$lib` alias so tests can use it.
      $lib: new URL("./src/lib", import.meta.url).pathname,
      // `$app/environment` doesn't exist outside SvelteKit; stub it via alias
      // to a tiny test module that re-exports an overridable `dev` flag.
      "$app/environment": new URL("./src/lib/__mocks__/app-environment-stub.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.ts", "scripts/**/*.{test,spec}.ts"],
    environment: "node",
    // Tests must not pollute one another via shared module state — each test
    // file gets its own module graph.
    isolate: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/hooks.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/__mocks__/**", "src/lib/types.ts"],
      reporter: ["text", "html"],
    },
  },
});
