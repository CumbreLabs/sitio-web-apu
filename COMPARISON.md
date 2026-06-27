# React → SvelteKit Migration Comparison

> **Historical document.** The migration is complete; this file is kept as a reference for why each architectural choice was made. For current-state engineering reference, see [CLAUDE.md](./CLAUDE.md). For day-to-day docs, see [README.md](./README.md).

This document explains every architectural change from the React to SvelteKit migration.

## Framework & Build

| Concept        | React                                  | SvelteKit                                |
| -------------- | -------------------------------------- | ---------------------------------------- |
| Framework      | React 19 (virtual DOM, JSX)            | Svelte 5 (compiled, no virtual DOM)      |
| Meta-framework | None (manual SPA)                      | SvelteKit (routing, SSG, server)         |
| Build tool     | Vite with `@vitejs/plugin-react`       | Vite with `@sveltejs/vite-plugin-svelte` |
| Output         | SPA — single `index.html` + JS bundles | SSG — one real HTML file per page        |
| Config         | `vite.config.ts` only                  | `svelte.config.js` + `vite.config.ts`    |

## Routing

| Concept              | React                                          | SvelteKit                                                                                                                                                    |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Router               | TanStack Router (code-based, `src/router.tsx`) | SvelteKit file-based routing (`src/routes/`)                                                                                                                 |
| Route definitions    | Explicit code in one file                      | File/folder structure = routes                                                                                                                               |
| Language prefixes    | Manual route config in `src/lib/routes.ts`     | `[lang=lang]` param matcher (`src/params/lang.ts`) — no reroute hook needed; slugs live in `paginas/{lang}/*.md` and the catch-all `[...slug]` resolves them |
| Spanish path aliases | `getEquivalentPath()` function                 | `getEquivalentPath()` (in `src/lib/routes.ts`) — used by the language toggle to map e.g. `/es/sobre-mi/` ↔ `/en/about/`                                      |
| Code splitting       | Manual `manualChunks` in Vite config           | Automatic per-route splitting by SvelteKit                                                                                                                   |

### Example: defining a route

**React (TanStack Router):**

```tsx
// src/router.tsx
const aboutRoute = createRoute({
  getParentRoute: () => langRoute,
  path: "about",
  component: AboutPage,
});
```

**SvelteKit:**

```text
src/routes/[lang]/about/+page.svelte  ← file existence = route
```

## Components

| Concept        | React                                     | SvelteKit                                       |
| -------------- | ----------------------------------------- | ----------------------------------------------- |
| File extension | `.tsx`                                    | `.svelte`                                       |
| Syntax         | JSX (JavaScript + HTML mixed)             | HTML-first with `<script>` and `<style>` blocks |
| Location       | `src/components/` and `src/pages/`        | `src/lib/components/` and `src/routes/`         |
| Props          | `interface Props { ... }` + destructuring | `let { prop1, prop2 }: Props = $props()`        |
| Children       | `{children}` prop                         | `<slot />` or `{@render children()}`            |

### Example: a simple component

**React:**

```tsx
interface Props {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: Props) {
  return (
    <div className="p-4 border rounded">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

**Svelte:**

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="p-4 border rounded">
  <h2>{title}</h2>
  {@render children()}
</div>
```

## State Management

| Concept        | React                    | SvelteKit                          |
| -------------- | ------------------------ | ---------------------------------- |
| Local state    | `useState()`             | `$state()`                         |
| Derived values | `useMemo()`              | `$derived()`                       |
| Side effects   | `useEffect()`            | `$effect()`                        |
| Global stores  | React Context + Provider | Svelte stores (`.svelte.ts` files) |
| Store files    | `src/contexts/*.tsx`     | `src/lib/stores/*.svelte.ts`       |

### Example: theme toggle

**React:**

```tsx
const [theme, setTheme] = useState("light");

useEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}, [theme]);

const toggleTheme = useCallback(() => {
  setTheme((t) => (t === "dark" ? "light" : "dark"));
}, []);
```

**Svelte:**

```ts
let theme = $state("light");

$effect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
});

function toggleTheme() {
  theme = theme === "dark" ? "light" : "dark";
}
```

## Internationalization (i18n)

| Concept           | React                                       | SvelteKit                                   |
| ----------------- | ------------------------------------------- | ------------------------------------------- |
| Library           | `react-i18next` + `i18next` (runtime)       | Custom `t()` function (no library)          |
| Bundle impact     | ~55 KB for i18next runtime                  | ~0 KB (simple object lookup)                |
| Translation files | `src/i18n/en.json`, `es.json`               | Same files, unchanged                       |
| Usage             | `const { t } = useTranslation(); t("key")`  | `$t("key")` (Svelte store)                  |
| Init              | `i18next.use(initReactI18next).init({...})` | Just import JSON and create a derived store |

## SEO & Static Generation

| Concept           | React                                               | SvelteKit                                         |
| ----------------- | --------------------------------------------------- | ------------------------------------------------- |
| SSG approach      | Custom 500+ line `generate-static-pages.mjs` script | Built-in `adapter-static` (zero custom code)      |
| Output            | SPA shell + manually generated HTML per page        | Real HTML per page, automatically                 |
| SPA redirect hack | `public/404.html` with JS redirect                  | Not needed — real files exist at each URL         |
| Sitemap           | Generated in same custom script                     | `src/routes/sitemap.xml/+server.ts` (prerendered) |
| Meta tags         | Custom `<SEO>` component injecting tags             | Same `<SEO>` component, works identically         |

**This is the biggest win.** The entire `scripts/generate-static-pages.mjs` (500+ lines) is replaced by a single line in `svelte.config.js`:

```js
adapter: adapter({ pages: "dist", assets: "dist" });
```

## Static Assets

| Concept                | React (Vite)  | SvelteKit                 |
| ---------------------- | ------------- | ------------------------- |
| Static files directory | `public/`     | `static/`                 |
| Referenced as          | `/images/...` | `/images/...` (same URLs) |

Just a folder rename. All image paths stay identical.

## Icons

| Concept     | React                                      | SvelteKit                              |
| ----------- | ------------------------------------------ | -------------------------------------- |
| Library     | `lucide-react`                             | `lucide-svelte`                        |
| Brand icons | Custom `BrandIcons.tsx` (React components) | Custom `.svelte` components            |
| Usage       | `<Github size={20} />`                     | `<Github size={20} />` (identical API) |

## Dark Mode

Identical approach in both:

- `data-theme` attribute on `<html>`
- localStorage persistence
- Inline `<script>` in HTML for FOUC prevention
- Tailwind `@custom-variant dark` for styling

The only difference is where the toggle logic lives (React hook vs Svelte store).

## Styling

Identical in both:

- Tailwind CSS v4 with CSS-first config
- Same `@theme` definitions
- Same `@custom-variant dark` for dark mode
- Same utility classes throughout

The CSS file was renamed from `src/index.css` to `src/app.css` (SvelteKit convention).

## Bundle Size Impact

| Metric              | React                             | SvelteKit                | Change      |
| ------------------- | --------------------------------- | ------------------------ | ----------- |
| Largest JS chunk    | 192 KB (React vendor)             | ~37 KB                   | -81%        |
| Framework runtime   | ~180 KB (React + Router + i18n)   | ~32 KB (Svelte runtime)  | -82%        |
| Total JS (gzip)     | ~150-210 KB                       | ~55-70 KB                | -63%        |
| CSS                 | ~33 KB                            | ~33 KB                   | same        |
| Time to interactive | JS must download + parse + render | HTML visible immediately | much faster |

## Files Removed

- `src/router.tsx` — replaced by file-based routing
- `src/main.tsx` — replaced by `src/app.html` + SvelteKit entry
- `src/i18n/index.ts` — replaced by `src/lib/i18n.ts`
- `src/contexts/` — replaced by `src/lib/stores/`
- `src/hooks/` — replaced by Svelte `$effect` and actions
- `src/pages/` — replaced by `src/routes/[lang]/*/+page.svelte`
- `src/components/` — moved to `src/lib/components/`
- `scripts/generate-static-pages.mjs` — replaced by adapter-static
- `public/404.html` — no longer needed
- `index.html` — replaced by `src/app.html`
- `tsconfig.app.json`, `tsconfig.node.json` — replaced by single `tsconfig.json`
- `vite-env.d.ts` — replaced by `src/app.d.ts`

## Files Added

- `svelte.config.js` — SvelteKit configuration
- `src/app.html` — HTML shell (replaces `index.html`)
- `src/app.d.ts` — SvelteKit type declarations
- `src/params/lang.ts` — route param matcher (en | es)
- `src/hooks.server.ts` — server hook injecting `<html lang>`, GTM id, and conditional LCP preload via `transformPageChunk`
- `src/lib/stores/*.svelte.ts` — Svelte 5 rune-based stores
- `src/routes/**/+page.svelte` — page components
- `src/routes/**/+layout.svelte` — layout components
- `src/routes/**/+layout.ts` — layout data loaders
- `src/routes/sitemap.xml/+server.ts` — sitemap endpoint

## What Stayed the Same

- All JSON data files (`src/data/`)
- All markdown blog content (`src/data/escritos/`)
- All i18n translation files (`src/i18n/en.json`, `es.json`)
- All images (just moved from `public/` to `static/`)
- Tailwind CSS theme and classes
- Visual design — pixel-identical output
- GitHub Actions workflows (just `npm run build`)
- Dependabot config
- Lighthouse CI config
