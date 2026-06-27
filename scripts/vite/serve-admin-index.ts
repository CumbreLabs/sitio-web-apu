/**
 * Vite plugin: serves `static/admin/index.html` for `/admin/` URLs during
 * `npm run dev`. SvelteKit's dev server doesn't natively route to static
 * HTML at non-root paths, so without this middleware visiting `/admin/`
 * in dev returns the SPA shell instead of the Sveltia CMS bootstrap.
 *
 * Production is unaffected — `adapter-static` copies `static/` verbatim to
 * `dist/`, and GitHub Pages serves `dist/admin/index.html` for `/admin/`
 * via its directory-index behavior.
 * @module scripts/vite/serve-admin-index
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * Build the Vite plugin.
 * @returns Vite plugin instance.
 */
export default function serveAdminIndex(): Plugin {
  return {
    name: "serve-admin-index",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (url === "/admin" || url === "/admin/" || url.startsWith("/admin/?")) {
          try {
            const html = readFileSync(join("static", "admin", "index.html"), "utf-8");
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end(html);
            return;
          } catch {
            // fall through
          }
        }
        next();
      });
    },
  };
}
