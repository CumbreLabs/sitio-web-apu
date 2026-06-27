/**
 * Universal SvelteKit hooks (run on server + client).
 * @module hooks
 */

import type { Reroute } from "@sveltejs/kit";
import { dev } from "$app/environment";

// Locale-specific route prefixes. The catch-all `[lang=lang]/[...slug]`
// matches whatever the live route is, which means `/es/escritos/...` works in
// ES and `/en/writing/...` works in EN — but `/en/escritos/...` and
// `/es/writing/...` (and their portfolio analogues) 404 even though they
// "obviously" refer to the same content. This is a real problem for Sveltia
// CMS's `preview_path`: the template is a single string per collection, with
// no per-locale prefix token, so editing an EN writing post with a template
// like `{{locale}}/escritos/{{year}}/{{month}}/{{fields.settings.slug}}/`
// produces a 404 URL.
//
// `reroute` is a SvelteKit 2 hook that maps an incoming URL to an internal
// route BEFORE the router decides what to render. The browser's URL bar
// stays as the typed path (so editors see the "wrong-prefix" URL after
// clicking "View on site"), but the page contents come from the canonical
// route — no 404. We gate it on `dev` so this aliasing never affects
// production: in prod every public URL is canonical, and a typo in a real
// user's URL bar should 404 cleanly so SEO doesn't see duplicate content.
//
// Once Sveltia ships per-locale `preview_path` support upstream
// (`docs/upstream-issues/sveltia-cms-preview-path-i18n.md` tracks the
// request), this hook can be deleted and `preview_path` becomes
// straightforward.
const ROUTE_ALIASES: Record<string, Record<string, string>> = {
  es: { writing: "escritos", portfolio: "portafolio" },
  en: { writing: "writing", portfolio: "portfolio" },
};

const TYPE_OF_PREFIX: Record<string, "writing" | "portfolio"> = {
  escritos: "writing",
  writing: "writing",
  portafolio: "portfolio",
  portfolio: "portfolio",
};

/**
 * Rewrite cross-locale path aliases to their canonical route in dev. No-op
 * in production. See module-level comment for the why.
 * @param input - The reroute input.
 * @param input.url - The requested URL being routed.
 * @returns The rewritten pathname, or undefined to leave the URL untouched.
 */
export const reroute: Reroute = ({ url }) => {
  if (!dev) return;
  const match = url.pathname.match(/^\/(en|es)\/(escritos|writing|portafolio|portfolio)(\/.*)?$/);
  if (!match) return;
  const [, lang, prefix, rest = ""] = match;
  const type = TYPE_OF_PREFIX[prefix!];
  const canonical = ROUTE_ALIASES[lang!]?.[type!];
  if (!canonical || canonical === prefix) return;
  return `/${lang}/${canonical}${rest}`;
};
