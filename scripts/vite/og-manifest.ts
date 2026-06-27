/**
 * Vite plugin: exposes a `virtual:og-manifest` module with the set of
 * generated landscape OG-image variants under `static/og/`. `SEO.svelte`
 * uses this to decide whether a portrait page-image has a precomputed
 * 1200×630 social variant available — when it does, the variant is
 * preferred so social cards show the page's actual cover (blurred
 * self-fill composite) instead of falling back to the site-wide landscape
 * default. See `scripts/pipeline/generate-og-images.mjs` for the producer.
 * @module scripts/vite/og-manifest
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:og-manifest";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/**
 * Build the Vite plugin.
 * @returns Vite plugin instance.
 */
export default function ogManifest(): Plugin {
  return {
    name: "og-manifest",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      let files: string[] = [];
      try {
        files = readdirSync(join("static", "og")).map((f) => `/og/${f}`);
      } catch {
        // static/og may not exist on fresh clones or before first build
      }
      return `export default new Set(${JSON.stringify(files)});`;
    },
  };
}
