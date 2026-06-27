/**
 * Server-side SvelteKit handle hook that injects the `lang` attribute, the
 * analytics bootstrap (GTM or GA4 based on `sitio.json#analytics.provider`),
 * the home-page LCP preload tag, and the theme-color meta into the static
 * HTML shell at build time.
 * @module hooks.server
 */

import type { Handle } from "@sveltejs/kit";
import { siteConfig, seoConfig, analyticsConfig, getSupportedLanguages } from "$lib/config";

const ANALYTICS_HEAD_PLACEHOLDER = /%analytics_head%/g;
const ANALYTICS_BODY_PLACEHOLDER = /%analytics_body%/g;
const HOME_LCP_PLACEHOLDER = /%home_lcp_preload%/g;
const THEME_COLOR_PLACEHOLDER = /%theme_color%/g;

const supportedLanguages = getSupportedLanguages();
const defaultLang = siteConfig.defaultLanguage || supportedLanguages[0] || "es";

// Home paths: `/` (root mirrors default lang) + `/<lang>/` for every supported
// language. Derived once at module load so the runtime check is a Set hit and
// adding a third locale needs no code changes.
const HOME_PATHS = new Set<string>(["/", ...supportedLanguages.map((l) => `/${l}/`)]);

// LCP preload only fires on home pages. Image path comes from sitio.json's
// `lcpHeroImage` (falls back to seo.json's `defaultOGImage`) so a fork doesn't
// need to patch this file. Empty value → no preload tag emitted at all (fine
// for sites that don't have a hero image).
const LCP_IMAGE =
  (siteConfig as { lcpHeroImage?: string }).lcpHeroImage ||
  (seoConfig as { defaultOGImage?: string }).defaultOGImage ||
  "";
/**
 * MIME-type lookup for the LCP preload image's `type` attribute.
 * @param src - Image path under `/media/`.
 * @returns MIME type string ("image/webp" / "image/avif" / etc.).
 */
function lcpImageType(src: string): string {
  if (src.endsWith(".avif")) return "image/avif";
  if (src.endsWith(".png")) return "image/png";
  if (src.endsWith(".jpg") || src.endsWith(".jpeg")) return "image/jpeg";
  return "image/webp";
}
const HOME_LCP_TAG = LCP_IMAGE
  ? `<link rel="preload" href="${LCP_IMAGE}" as="image" type="${lcpImageType(LCP_IMAGE)}" fetchpriority="high" />`
  : "";

const THEME_COLOR = (siteConfig as { themeColor?: string }).themeColor || "#0c0a09";

// Build analytics snippets ONCE at module load. Both providers use the same
// lazy-on-first-interaction pattern so analytics doesn't block first paint
// and the consent-mode defaults block in app.html keeps tracking gated until
// the cookie banner is accepted.
//
// `DISABLE_ANALYTICS=1` env var forces provider to "none" at build time.
// Used by the Lighthouse CI workflow so audits measure OUR code, not the
// 3rd-party perf hit from GTM/GA4 (which we can't control). Without this,
// Lighthouse penalizes us for googletagmanager.com main-thread work +
// async fetches that have nothing to do with the static site itself.
// Any truthy value (1 / true / yes) flips it off; the empty/unset case
// reads the configured provider normally.
const ANALYTICS_DISABLED = /^(1|true|yes)$/i.test(process.env["DISABLE_ANALYTICS"] || "");
const ANALYTICS_PROVIDER = ANALYTICS_DISABLED ? "none" : analyticsConfig?.provider || "none";
const ANALYTICS_ID = ANALYTICS_DISABLED ? "" : analyticsConfig?.id || "";

// Interaction events that trigger lazy analytics load — covers mouse, touch,
// and keyboard so any meaningful user signal kicks the script. Both GTM and
// GA4 bootstraps register the same listener set.
const ANALYTICS_INTERACTION_EVENTS = ["scroll", "click", "touchstart", "mousemove", "keydown"];
// Hard cap before we give up waiting for interaction. 5 s is the conventional
// "engaged session" threshold (GA4's default), so loading by then preserves
// session attribution for users who land + bounce within 5 s.
const ANALYTICS_LAZY_LOAD_DELAY_MS = 5000;
const ANALYTICS_EVENTS_JSON = JSON.stringify(ANALYTICS_INTERACTION_EVENTS);

/**
 * Render the head-side analytics bootstrap for the configured provider.
 * Returns empty string for `none` or when the id is empty — keeps the HTML
 * shell tidy when analytics is off.
 * @returns HTML string injected into `<head>` via the `%analytics_head%` placeholder.
 */
function renderAnalyticsHead(): string {
  if (!ANALYTICS_ID) return "";
  if (ANALYTICS_PROVIDER === "gtm") {
    return `<script>
(function () {
  var loaded = false;
  function loadGTM() {
    if (loaded) return;
    loaded = true;
    events.forEach(function (e) { window.removeEventListener(e, loadGTM); });
    (function (w, d, s, l, i) {
      w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
      var f = d.getElementsByTagName(s)[0],
        j = d.createElement(s),
        dl = l != "dataLayer" ? "&l=" + l : "";
      j.async = true;
      j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, "script", "dataLayer", ${JSON.stringify(ANALYTICS_ID)});
  }
  var events = ${ANALYTICS_EVENTS_JSON};
  events.forEach(function (e) {
    window.addEventListener(e, loadGTM, { once: true, passive: true });
  });
  setTimeout(loadGTM, ${ANALYTICS_LAZY_LOAD_DELAY_MS});
})();
</script>`;
  }
  if (ANALYTICS_PROVIDER === "ga4") {
    // gtag.js loads on first interaction (parallel to the GTM pattern).
    // `dataLayer` + `gtag` are already declared in app.html's consent-mode
    // bootstrap, so we just `gtag('config', ID)` after the script lands.
    // `anonymize_ip: true` truncates the last octet of IPv4 / last 80 bits of
    // IPv6 before storage — GDPR-friendly default, matches the consent-mode
    // posture (analytics defaults denied) and our cookie banner's promise.
    return `<script>
(function () {
  var loaded = false;
  function loadGA4() {
    if (loaded) return;
    loaded = true;
    events.forEach(function (e) { window.removeEventListener(e, loadGA4); });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + ${JSON.stringify(ANALYTICS_ID)};
    document.head.appendChild(s);
    gtag("js", new Date());
    gtag("config", ${JSON.stringify(ANALYTICS_ID)}, { anonymize_ip: true });
  }
  var events = ${ANALYTICS_EVENTS_JSON};
  events.forEach(function (e) {
    window.addEventListener(e, loadGA4, { once: true, passive: true });
  });
  setTimeout(loadGA4, ${ANALYTICS_LAZY_LOAD_DELAY_MS});
})();
</script>`;
  }
  return "";
}

/**
 * Render the body-side analytics tag (GTM `<noscript>` iframe for no-JS
 * tracking; GA4 has no equivalent because gtag.js is JS-only by design).
 * @returns HTML string injected at the top of `<body>` via the `%analytics_body%` placeholder.
 */
function renderAnalyticsBody(): string {
  if (ANALYTICS_PROVIDER !== "gtm" || !ANALYTICS_ID) return "";
  return `<noscript><iframe title="Google Tag Manager" src="https://www.googletagmanager.com/ns.html?id=${ANALYTICS_ID}" height="0" width="0" class="gtm-noscript"></iframe></noscript>`;
}

const ANALYTICS_HEAD = renderAnalyticsHead();
const ANALYTICS_BODY = renderAnalyticsBody();

/**
 * Detect the active language from the URL pathname against the configured
 * `siteConfig.languages` list. Anything outside that list falls back to the
 * site default — keeps `<html lang>` honest on the root mirror path and any
 * unprefixed routes.
 * @param pathname - Request URL pathname.
 * @returns The detected language code.
 */
function detectLang(pathname: string): string {
  for (const code of supportedLanguages) {
    if (pathname === `/${code}` || pathname.startsWith(`/${code}/`)) return code;
  }
  return defaultLang;
}

/**
 * Server-side handle hook that customizes the prerendered HTML per request.
 * @param root0 - The handle event containing the request and resolve function.
 * @param root0.event - The SvelteKit request event.
 * @param root0.resolve - The resolve function to continue request processing.
 * @returns The resolved response with placeholders filled in.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const pathname = event.url.pathname;
  const lang = detectLang(pathname);
  const lcpPreload = HOME_PATHS.has(pathname) ? HOME_LCP_TAG : "";
  return resolve(event, {
    // Preload the self-hosted variable fonts (Inter + Playfair Display).
    // They're @import'd from CSS, which means the browser only discovers
    // them AFTER the CSS file parses — pushing them into chain level 3 of
    // the critical-request graph (Lighthouse: 17-chain critical path on
    // every page, all 45 reports flagged). With this hint, SvelteKit
    // emits `<link rel="preload" as="font" type="font/woff2" crossorigin>`
    // in the head, so the font fetch starts in parallel with CSS parsing
    // instead of waiting for it. Saves ~100-300 ms FCP across every page.
    // Only the latin-wght-normal subset is preloaded; italic + other
    // subsets stay lazy because they're rarely above the fold.
    preload: ({ type, path }) => {
      if (type === "font") {
        return /latin-wght-normal/.test(path) && !/italic/.test(path);
      }
      // Defer to SvelteKit's default preload behavior for everything else
      // (JS chunks for the route, route-level CSS).
      return type === "js" || type === "css";
    },
    transformPageChunk: ({ html }) =>
      html
        .replace("%sveltekit.html_attributes%", `lang="${lang}"`)
        .replace(ANALYTICS_HEAD_PLACEHOLDER, ANALYTICS_HEAD)
        .replace(ANALYTICS_BODY_PLACEHOLDER, ANALYTICS_BODY)
        .replace(HOME_LCP_PLACEHOLDER, lcpPreload)
        .replace(THEME_COLOR_PLACEHOLDER, THEME_COLOR),
  });
};
