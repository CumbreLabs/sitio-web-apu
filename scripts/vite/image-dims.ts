/**
 * Vite plugin: measures every image in `static/media/` with sharp at build
 * time and exposes the dimensions as a Map keyed by public URL via the
 * `virtual:image-dims` module. Consumed by the markdown renderer
 * (`src/lib/markdown.ts:injectSrcset`) and `AlbumTemplate.svelte` so inline
 * `<img>` tags get explicit width/height attributes — eliminates CLS for
 * lazy-loaded body images that would otherwise have no reserved space.
 *
 * Sharp is dynamically imported inside `load()` rather than at module top
 * so plugin construction stays cheap; the actual measurement happens once,
 * lazily, the first time the virtual module is requested per build.
 * @module scripts/vite/image-dims
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:image-dims";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/**
 * Build the Vite plugin.
 * @returns Vite plugin instance.
 */
export default function imageDimsManifest(): Plugin {
  return {
    name: "image-dims",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const sharp = (await import("sharp")).default;
      const dims: [string, [number, number]][] = [];
      let files: string[] = [];
      try {
        files = readdirSync(join("static", "media"));
      } catch {
        // static/media may not exist on fresh clones — fall through to empty.
      }
      for (const f of files) {
        if (!/\.(webp|jpg|jpeg|png)$/i.test(f)) continue;
        try {
          const meta = await sharp(join("static", "media", f)).metadata();
          if (meta.width && meta.height) {
            dims.push([`/media/${f}`, [meta.width, meta.height]]);
          }
        } catch {
          // Unreadable file — skip. Markdown renderer just won't get dims for it.
        }
      }
      return `export default new Map(${JSON.stringify(dims)});`;
    },
  };
}
