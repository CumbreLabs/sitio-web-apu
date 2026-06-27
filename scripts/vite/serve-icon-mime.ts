/**
 * Vite plugin: serve `.ico` requests with the correct `Content-Type` during
 * `npm run dev` and `npm run preview`.
 *
 * Vite's static-file middleware resolves MIME types via `mrmime`, whose lean
 * database has NO entry for `.ico` (`mrmime.lookup('favicon.ico') === undefined`).
 * As a result the dev/preview server answers `/favicon.ico` with an empty
 * `Content-Type` header, and Chrome (which always auto-requests `/favicon.ico`)
 * treats the resource as untyped and renders no tab icon — the favicon looks
 * "broken" even though the file is a perfectly valid multi-size ICO.
 *
 * This middleware intercepts any `*.ico` URL, reads the matching file from
 * `static/`, and serves it with `image/x-icon`. Other assets are untouched.
 *
 * Production is unaffected: `adapter-static` copies `static/` verbatim to
 * `dist/`, and GitHub Pages serves `.ico` with `image/vnd.microsoft.icon`
 * on its own — this gap is dev/preview-only.
 * @module scripts/vite/serve-icon-mime
 */

import { readFileSync, existsSync } from "node:fs";
import { join, normalize } from "node:path";
import type { Plugin, ViteDevServer, PreviewServer } from "vite";

/**
 * Map a request URL to its file under `static/`, or null if it escapes.
 * @param url - Incoming request URL (may include query string / hash).
 * @returns Absolute path to the `.ico` file under `static/`, or null when the
 *   URL is not a `.ico`, traverses outside `static/`, or the file is missing.
 */
function resolveStaticIco(url: string): string | null {
  const path = (url.split("?")[0] || "").split("#")[0] || "";
  if (!path.toLowerCase().endsWith(".ico")) return null;
  // Strip the leading slash and normalize to block `..` path traversal.
  const rel = normalize(decodeURIComponent(path))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  if (rel.includes("..")) return null;
  const file = join("static", rel);
  return existsSync(file) ? file : null;
}

/**
 * Register the `.ico` MIME-fixing middleware on a Vite server.
 * @param server - The Vite dev or preview server to attach middleware to.
 */
function useIcoMime(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use((req, res, next) => {
    const file = resolveStaticIco(req.url || "");
    if (!file) {
      next();
      return;
    }
    try {
      const buf = readFileSync(file);
      res.setHeader("Content-Type", "image/x-icon");
      res.setHeader("Cache-Control", "no-cache");
      res.end(buf);
    } catch {
      next();
    }
  });
}

/**
 * Build the Vite plugin.
 * @returns Vite plugin instance.
 */
export default function serveIconMime(): Plugin {
  return {
    name: "serve-icon-mime",
    configureServer(server) {
      useIcoMime(server);
    },
    configurePreviewServer(server) {
      useIcoMime(server);
    },
  };
}
