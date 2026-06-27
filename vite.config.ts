import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import srcsetManifest from "./scripts/vite/srcset-manifest";
import imageDimsManifest from "./scripts/vite/image-dims";
import ogManifest from "./scripts/vite/og-manifest";
import renderedPages from "./scripts/vite/rendered-pages";
import serveAdminIndex from "./scripts/vite/serve-admin-index";
import serveIconMime from "./scripts/vite/serve-icon-mime";

export default defineConfig({
  plugins: [
    srcsetManifest(),
    imageDimsManifest(),
    ogManifest(),
    // Build-time markdown rendering for every `.md` under
    // `src/data/{escritos,paginas}/`. Parses frontmatter with gray-matter,
    // tokenizes fenced code with Shiki (dual light/dark theme), expands
    // Pandoc image attrs, injects responsive srcset + width/height, hardens
    // external links, sanitizes with sanitize-html — all server-side. The
    // result map is consumed via `virtual:rendered-pages` by the data
    // loaders in `$lib/data/`. Replaces the older `virtual:highlighted-code`
    // plugin which only pre-tokenized code blocks; full body rendering
    // moves to build time so `marked`, the Shiki cache, `marked-gfm-heading-id`,
    // `github-slugger`, `src/lib/markdown.ts` and `src/lib/frontmatter.ts`
    // never enter the client bundle. Themes pair with the dark-mode swap
    // in `src/app.css`; pick any bundled Shiki theme.
    renderedPages({
      contentRoots: ["src/data/escritos", "src/data/paginas"],
      themes: { light: "github-light", dark: "github-dark-dimmed" },
    }),
    serveAdminIndex(),
    serveIconMime(),
    sveltekit(),
    tailwindcss(),
  ],
  server: {
    fs: {
      // `node_modules` is hoisted one level up to the workspace root (multiple
      // sibling projects share it). Vite's default fs.allow only covers the
      // project root, which causes 403s on `@fontsource-variable/*` font files
      // requested via the `@fs/` dev-server path. Adding the parent dir to the
      // allow-list lets dev serve the woff2 assets from the shared install.
      // No prod impact — this only governs Vite's dev middleware.
      allow: [".."],
    },
  },
});
