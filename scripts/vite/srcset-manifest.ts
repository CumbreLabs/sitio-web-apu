/**
 * Vite plugin: exposes a `virtual:srcset-manifest` module with the set of
 * generated responsive image paths under `static/srcset/`. Consumed by
 * `src/lib/markdown.ts`'s `injectSrcset()` post-processor and by
 * `src/lib/images.ts`'s `imgSrcset()` helper, both of which use it to
 * decide whether a `/media/<name>.<ext>` `<img>` has variants worth
 * shipping a `srcset` attribute for.
 *
 * The plugin reads the directory on `load`, not on `configResolved`, so
 * adding a new image during `npm run dev` (e.g. via the optimize-images
 * script regenerating variants) shows up after the next Vite invalidation
 * without a server restart.
 * @module scripts/vite/srcset-manifest
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:srcset-manifest";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/**
 * Build the Vite plugin.
 * @returns Vite plugin instance.
 */
export default function srcsetManifest(): Plugin {
  return {
    name: "srcset-manifest",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      let files: string[] = [];
      try {
        files = readdirSync(join("static", "srcset")).map((f) => `/srcset/${f}`);
      } catch {
        // static/srcset may not exist on fresh clones or in CI
      }
      return `export default new Set(${JSON.stringify(files)});`;
    },
  };
}
