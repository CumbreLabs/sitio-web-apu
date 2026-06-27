/**
 * Site-chrome data: the per-language strings + structured items consumed by
 * `<SEO>` / `Footer.svelte` / `Navbar.svelte`. Three concerns:
 *
 *   1. `getSiteI18n(lang)` — facade that stitches together fields from
 *      `sitio.json` (jobTitle), `seo.json` (description), and `escritos.json`
 *      (feedSectionLabel) so external callers don't churn when fields move
 *      between config files.
 *   2. Footer text + social links from `pie-de-pagina.json`.
 *   3. Navbar items + brand from `navegacion.json`, with nav items resolved
 *      against the paginas slug map (so editors get the right URL per locale
 *      even when slugs differ — `sobre-mi` vs `about`).
 * @module data/site
 */

import { siteConfig, siteByLang, seoByLang, writingByLang } from "$lib/config";
import type { SocialLink } from "$lib/types";
import { bucketByLocale, pickByLang, pickFromBucket } from "./_internal";
import { _allPages, type PageData } from "./pages";

// ---------------------------------------------------------------------------
// Site-level localized fields (read from sitio.json + seo.json + escritos.json)
// ---------------------------------------------------------------------------

/**
 * Curated per-language site fields used by `<SEO>`, the root JSON-LD graph,
 * and feed builders. After the config split this is a FACADE — internally
 * stitches together `sitio.json` (jobTitle), `seo.json` (description), and
 * `escritos.json` (feedSectionLabel) so external callers don't churn when
 * fields move between files. Add fields here when they're genuinely
 * per-language and needed across multiple consumers.
 */
export interface SiteI18n {
  description: string;
  jobTitle?: string | undefined;
  feedSectionLabel?: string | undefined;
}

/**
 * Get the language-specific slice of curated site fields. Resolves the meta
 * description (from seo.json) + jobTitle (from sitio.json) + feedSectionLabel
 * (from escritos.json) so a Spanish page's SEO/JSON-LD/feed text is Spanish.
 * Falls back to the default-language slice if the requested locale is missing.
 * @param lang - Language code.
 * @returns Per-language curated site fields.
 */
export function getSiteI18n(lang: string): SiteI18n {
  const siteSlice = siteByLang[lang] ?? siteByLang[Object.keys(siteByLang)[0]!]!;
  const seoSlice = seoByLang[lang] ?? seoByLang[Object.keys(seoByLang)[0]!]!;
  const writingSlice = writingByLang[lang] ?? writingByLang[Object.keys(writingByLang)[0]!]!;
  return {
    description: seoSlice.description || "",
    jobTitle: siteSlice.jobTitle,
    feedSectionLabel: writingSlice.feedSectionLabel,
  };
}

// ---------------------------------------------------------------------------
// Footer + social (from configuracion/{lang}/pie-de-pagina.json)
// ---------------------------------------------------------------------------

interface PieDePaginaJson {
  copyright: string;
  madeWith: string;
  social: Array<{ active: boolean; key: string; url: string }>;
  privacyPageId?: string;
}

const _pieBucket = bucketByLocale(
  import.meta.glob("../../data/configuracion/*/pie-de-pagina.json", {
    eager: true,
    import: "default",
  }) as Record<string, PieDePaginaJson>,
  "configuracion",
);
const pieDePageEn = pickFromBucket(_pieBucket, "en");
const pieDePageEs = pickFromBucket(_pieBucket, "es");

const socialMap: Record<string, { name: string; icon: string }> = {
  email: { name: "Email", icon: "Mail" },
  linkedin: { name: "LinkedIn", icon: "Linkedin" },
  twitter: { name: "X / Twitter", icon: "Twitter" },
  instagram: { name: "Instagram", icon: "Instagram" },
  facebook: { name: "Facebook", icon: "Facebook" },
  youtube: { name: "YouTube", icon: "Youtube" },
  github: { name: "GitHub", icon: "Github" },
  tiktok: { name: "TikTok", icon: "Tiktok" },
  threads: { name: "Threads", icon: "Threads" },
  bluesky: { name: "Bluesky", icon: "Bluesky" },
  pinterest: { name: "Pinterest", icon: "Pinterest" },
  telegram: { name: "Telegram", icon: "Telegram" },
  whatsapp: { name: "WhatsApp", icon: "Whatsapp" },
  vimeo: { name: "Vimeo", icon: "Vimeo" },
  behance: { name: "Behance", icon: "Behance" },
  flickr: { name: "Flickr", icon: "Flickr" },
  website: { name: "Website", icon: "Globe" },
};

/** Footer text strings (copyright and made-with). */
export interface FooterText {
  copyright: string;
  madeWith: string;
}

/**
 * Get footer text with the current year interpolated into the copyright.
 * @param lang - Language code ("en" or "es").
 * @returns Footer text strings.
 */
export function getFooterText(lang: string): FooterText {
  const data = pickByLang(pieDePageEn, pieDePageEs, lang);
  return {
    copyright: data.copyright.replace("{{currentYear}}", String(new Date().getFullYear())),
    madeWith: data.madeWith,
  };
}

/**
 * Get active social links for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active social link entries with name, url, and icon.
 */
export function getSocial(lang: string): SocialLink[] {
  const items = pickByLang(pieDePageEn, pieDePageEs, lang).social as {
    active: boolean;
    key: string;
    url: string;
  }[];
  return items
    .filter((item) => item.active && item.url)
    .map((item) => ({
      name: socialMap[item.key]?.name ?? item.key,
      url: item.url,
      icon: socialMap[item.key]?.icon ?? item.key,
    }));
}

// ---------------------------------------------------------------------------
// Navigation (configuracion/{lang}/navegacion.json)
// ---------------------------------------------------------------------------

const _navBucket = bucketByLocale(
  import.meta.glob("../../data/configuracion/*/navegacion.json", {
    eager: true,
    import: "default",
  }) as Record<string, { brand?: unknown; items: unknown[] }>,
  "configuracion",
);
const navEn = pickFromBucket(_navBucket, "en");
const navEs = pickFromBucket(_navBucket, "es");

interface NavItemRaw {
  /**
   * When `false`, hides this item from the navbar without requiring deletion.
   * Symmetric with `pie-de-pagina.json#social[].active`. Defaults to `true`
   * if absent so legacy navegacion.json entries don't disappear after a
   * schema bump.
   */
  active?: boolean;
  /**
   * When `true`, this is an in-page anchor item (single-page sites): its `key`
   * is a section id and the resolved path becomes `/#<key>` (the navbar's
   * `fullPath` prefixes the locale → `/<lang>/#<key>`). When false/absent the
   * key is resolved against the paginas slug map (multi-page sites).
   */
  anchor?: boolean;
  key: string;
  label: string;
}

/** A resolved navigation item with its computed path. */
export interface NavItem {
  key: string;
  label: string;
  path: string;
}

const navRawEs: NavItemRaw[] = navEs.items as NavItemRaw[];
const navRawEn: NavItemRaw[] = navEn.items as NavItemRaw[];

/**
 * Build resolved navigation items by mapping raw nav entries to page slugs.
 * Items with `active: false` are filtered out so an editor can hide an entry
 * without deleting it (e.g. while a section is under construction).
 * @param raw - Raw navigation item entries.
 * @param pages - Map of page data keyed by page id.
 * @returns Navigation items with resolved paths (active items only).
 */
function buildNavItems(raw: NavItemRaw[], pages: Map<string, PageData>): NavItem[] {
  return raw
    .filter((item) => item.active !== false)
    .map((item) => {
      // Anchor items (single-page sites) resolve to `/#<key>`; the navbar's
      // fullPath() prefixes the locale. Page items resolve against the slug map.
      if (item.anchor) {
        return { key: item.key, label: item.label, path: `/#${item.key}` };
      }
      const page = pages.get(item.key);
      return {
        key: item.key,
        label: item.label,
        path: page ? `/${page.slug}/` : `/${item.key}/`,
      };
    });
}

const [pagesEn, pagesEs] = _allPages();
const navItemsEs = buildNavItems(navRawEs, pagesEs);
const navItemsEn = buildNavItems(navRawEn, pagesEn);

/**
 * Get the navigation items for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Navigation items with labels and resolved paths.
 */
export function getNavItems(lang: string): NavItem[] {
  return pickByLang(navItemsEn, navItemsEs, lang);
}

/**
 * Raw shape of `navegacion.json#brand` as authored by editors. Every field is
 * optional — empty / missing values cascade to sensible fallbacks at resolve
 * time (see `resolveNavBrand`).
 */
interface NavBrandRaw {
  /** Wordmark shown in the navbar. Empty → fallback to `siteConfig.name`. */
  text?: string;
  /** Logo image path. Empty → no image (text-only navbar). */
  image?: string;
  /** Dark-theme variant. Empty → reuse `image` in both themes. */
  imageDark?: string;
  /** Accessibility alt for the logo. Empty → cascade text → siteConfig.name. */
  imageAlt?: string;
  /** Pixel height for CLS-stable layout. Width auto-derives to preserve aspect ratio. */
  imageHeight?: number;
  /** Show wordmark text alongside the image. False = image-only navbar. */
  showText?: boolean;
}

/**
 * Resolved brand with every fallback applied — what Navbar.svelte actually
 * consumes. No field is ever undefined / empty here.
 */
export interface NavBrand {
  text: string;
  image: string;
  imageDark: string;
  imageAlt: string;
  imageHeight: number;
  showText: boolean;
}

/**
 * Apply the brand-field fallback cascade so the renderer never has to repeat
 * the `?? siteConfig.name` dance per field. Every empty/missing value
 * resolves to another config value (siteConfig.name, sibling field) — no
 * hardcoded user-facing strings.
 * @param raw - Raw brand block from navegacion.json (or undefined).
 * @param fallbackText - Site identity text (typically siteConfig.name).
 * @returns Resolved brand ready for rendering.
 */
function resolveNavBrand(raw: NavBrandRaw | undefined, fallbackText: string): NavBrand {
  const text = raw?.text || fallbackText;
  const image = raw?.image || "";
  // Dark variant defaults to the light image — single-image setups stay
  // single-image in both themes without needing imageDark explicitly set.
  const imageDark = raw?.imageDark || image;
  // Alt cascade: explicit alt → wordmark text → fallback site name. Ensures
  // the img tag always carries meaningful alt content.
  const imageAlt = raw?.imageAlt || text;
  // CLS-stable height. Default 32 matches the current text-only navbar's
  // rendered line-height (`text-lg` → ~28px content + line-height).
  const imageHeight =
    typeof raw?.imageHeight === "number" && raw.imageHeight > 0 ? raw.imageHeight : 32;
  // showText defaults to true: legacy behavior + the common case (image + text
  // side-by-side). Editors explicitly set false for image-only navbar.
  const showText = raw?.showText !== false;
  return { text, image, imageDark, imageAlt, imageHeight, showText };
}

const navBrandEs = resolveNavBrand(navEs.brand as NavBrandRaw | undefined, siteConfig.name);
const navBrandEn = resolveNavBrand(navEn.brand as NavBrandRaw | undefined, siteConfig.name);

/**
 * Get the resolved navbar brand for a language. All fields are guaranteed
 * non-empty (fallback cascade applied at module load).
 * @param lang - Language code.
 * @returns Resolved NavBrand object.
 */
export function getNavBrand(lang: string): NavBrand {
  return pickByLang(navBrandEn, navBrandEs, lang);
}
