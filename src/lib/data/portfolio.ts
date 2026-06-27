/**
 * Portfolio album loader. Glob-imports every JSON under
 * `src/data/portafolio/{en,es}/`, flattens the nested `settings` block at
 * load time, and exposes three lookups: slug-based, file-id-based, and the
 * full active list for the current locale.
 *
 * EN/ES albums pair by FILE ID (filename without `.json`) so the language
 * toggle can map an album to its counterpart even when the slug differs
 * (e.g. `parada-de-manos` ↔ `handstand`). The slug is used for URLs only.
 * @module data/portfolio
 */

import { type Ordered, parseTags, pickByLang, sorted } from "./_internal";

/** A single photo within a portfolio album. */
export interface PortfolioPhotoFlat {
  /** Image source path. */
  src: string;
  /** Alt text for accessibility. */
  alt: string;
}

/** A portfolio album containing photos. */
export interface PortfolioAlbumFlat {
  title: string;
  description: string;
  coverSrc: string;
  date: string;
  tags: string[];
  orientation: "portrait" | "landscape";
  photos: PortfolioPhotoFlat[];
  active: boolean;
  slug: string;
  redirectUrl: string;
  ogDescription: string;
  ogImage: string;
}

/** Raw portfolio JSON shape (settings live in a sub-object before flattening). */
type PortfolioRaw = Omit<
  PortfolioAlbumFlat,
  "active" | "slug" | "redirectUrl" | "ogDescription" | "ogImage" | "tags"
> & {
  tags: string | string[];
  settings?: {
    active?: boolean;
    slug?: string;
    redirectUrl?: string;
    ogDescription?: string;
    ogImage?: string;
  };
};

const portfolioEnFiles = import.meta.glob("../../data/portafolio/en/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Ordered<PortfolioRaw>>;
const portfolioEsFiles = import.meta.glob("../../data/portafolio/es/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Ordered<PortfolioRaw>>;

/**
 * Load and transform portfolio albums from glob results.
 * @param files - Glob result map of portfolio album data.
 * @returns Transformed portfolio albums with parsed tags and settings.
 */
function loadPortfolio(
  files: Record<string, Ordered<PortfolioRaw>>,
): (PortfolioAlbumFlat & { id: string })[] {
  return sorted(files).map((a) => {
    const settings = a.settings ?? {};
    return {
      ...a,
      tags: parseTags(a.tags),
      active: settings.active !== false,
      slug: settings.slug || a.id,
      redirectUrl: settings.redirectUrl || "",
      ogDescription: settings.ogDescription || "",
      ogImage: settings.ogImage || "",
    };
  });
}

const portEn = loadPortfolio(portfolioEnFiles);
const portEs = loadPortfolio(portfolioEsFiles);

/**
 * Get active portfolio albums for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active portfolio albums.
 */
export function getPortfolio(lang: string): (PortfolioAlbumFlat & { id: string })[] {
  return pickByLang(portEn, portEs, lang).filter((a) => a.active);
}

/**
 * Find a portfolio album by its URL slug.
 * @param slug - Album URL slug.
 * @param lang - Language code ("en" or "es").
 * @returns The matched album, or undefined.
 */
export function getAlbumBySlug(
  slug: string,
  lang: string,
): (PortfolioAlbumFlat & { id: string }) | undefined {
  return pickByLang(portEn, portEs, lang).find((a) => a.slug === slug);
}

/**
 * Find a portfolio album by its file identifier.
 * @param fileId - Filename-based identifier (shared across locales).
 * @param lang - Language code ("en" or "es").
 * @returns The matched album, or undefined.
 */
export function getAlbumByFileId(
  fileId: string,
  lang: string,
): (PortfolioAlbumFlat & { id: string }) | undefined {
  return pickByLang(portEn, portEs, lang).find((a) => a.id === fileId);
}
