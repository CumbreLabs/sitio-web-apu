/**
 * About-page collection loaders. Each `colecciones/{lang}/<name>.json` file
 * is a flat `{ title, items: [...] }` shape; the getter pair returns the
 * filtered items + the localized section title.
 *
 * Adding a new about-page collection here means: add the JSON files under
 * `src/data/colecciones/{en,es}/`, add the import + getter pair below, and
 * register the rendering partial in `CollectionRenderer.svelte`'s map.
 * @module data/collections
 */

import type { MediaItem } from "$lib/types";
import {
  bucketByLocale,
  type CollectionJson,
  filterActive,
  parseTags,
  pickByLang,
  pickFromBucket,
} from "./_internal";

// ---------------------------------------------------------------------------
// About Header (colecciones/encabezado)
// ---------------------------------------------------------------------------

/** About page header data (title, photo, bio). */
export interface AboutHeader {
  title: string;
  photo: string;
  bio: string;
}

const _headerBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/encabezado.json", {
    eager: true,
    import: "default",
  }) as Record<string, AboutHeader>,
  "colecciones",
);
const headerEn = pickFromBucket(_headerBucket, "en");
const headerEs = pickFromBucket(_headerBucket, "es");

/**
 * Get the about page header for a language.
 * @param lang - Language code ("en" or "es").
 * @returns About header data.
 */
export function getAboutHeader(lang: string): AboutHeader {
  // Fork may have no `encabezado.json` (e.g. a single-page site) → empty bucket
  // yields undefined; fall back to a blank header so callers never crash.
  return pickByLang(headerEn, headerEs, lang) ?? { title: "", photo: "", bio: "" };
}

/**
 * Get the about page header title for a language.
 * @param lang - Language code ("en" or "es").
 * @returns The header title string.
 */
export function getAboutHeaderTitle(lang: string): string {
  return getAboutHeader(lang).title;
}

// ---------------------------------------------------------------------------
// Education (colecciones/educacion)
// ---------------------------------------------------------------------------

/** Flat representation of an education entry. */
export interface EducationFlat {
  degree: string;
  institution: string;
  start_date: string;
  honors: string;
  logo: string;
  url: string;
  active?: boolean;
}

const _educacionBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/educacion.json", {
    eager: true,
    import: "default",
  }) as Record<string, CollectionJson<EducationFlat>>,
  "colecciones",
);
const educacionEn = pickFromBucket(_educacionBucket, "en");
const educacionEs = pickFromBucket(_educacionBucket, "es");

/**
 * Get active education entries for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active education entries.
 */
export function getEducation(lang: string): EducationFlat[] {
  return filterActive(pickByLang(educacionEn?.items ?? [], educacionEs?.items ?? [], lang));
}

/**
 * Get the education section title for a language.
 * @param lang - Language code ("en" or "es").
 * @returns The section title string.
 */
export function getEducationTitle(lang: string): string {
  return pickByLang(educacionEn, educacionEs, lang)?.title ?? "";
}

// ---------------------------------------------------------------------------
// Experience (colecciones/experiencia)
// ---------------------------------------------------------------------------

/** Flat representation of an experience entry. */
export interface ExperienceFlat {
  role: string;
  project: string;
  organization: string;
  start_date: string;
  end_date: string;
  logo: string;
  url: string;
  active?: boolean;
  location?: string;
  description?: string[];
  current?: boolean;
}

const _experienciaBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/experiencia.json", {
    eager: true,
    import: "default",
  }) as Record<string, CollectionJson<ExperienceFlat>>,
  "colecciones",
);
const experienciaEn = pickFromBucket(_experienciaBucket, "en");
const experienciaEs = pickFromBucket(_experienciaBucket, "es");

/**
 * Get active experience entries for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active experience entries.
 */
export function getExperience(lang: string): ExperienceFlat[] {
  return filterActive(pickByLang(experienciaEn?.items ?? [], experienciaEs?.items ?? [], lang));
}

/**
 * Get the experience section title for a language.
 * @param lang - Language code ("en" or "es").
 * @returns The section title string.
 */
export function getExperienceTitle(lang: string): string {
  return pickByLang(experienciaEn, experienciaEs, lang)?.title ?? "";
}

// ---------------------------------------------------------------------------
// Awards (colecciones/premios)
// ---------------------------------------------------------------------------

/** Flat representation of an award entry. */
export interface AwardFlat {
  title: string;
  detail: string;
  organization: string;
  date: string;
  active?: boolean;
}

const _premiosBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/premios.json", {
    eager: true,
    import: "default",
  }) as Record<string, CollectionJson<AwardFlat>>,
  "colecciones",
);
const premiosEn = pickFromBucket(_premiosBucket, "en");
const premiosEs = pickFromBucket(_premiosBucket, "es");

/**
 * Get active award entries for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active award entries.
 */
export function getAwards(lang: string): AwardFlat[] {
  return filterActive(pickByLang(premiosEn?.items ?? [], premiosEs?.items ?? [], lang));
}

/**
 * Get the awards section title for a language.
 * @param lang - Language code ("en" or "es").
 * @returns The section title string.
 */
export function getAwardsTitle(lang: string): string {
  return pickByLang(premiosEn, premiosEs, lang)?.title ?? "";
}

// ---------------------------------------------------------------------------
// Volunteering (colecciones/voluntariado)
// ---------------------------------------------------------------------------

/** Event-style sub-entries for community/volunteering with optional dates + URL. */
export interface CommunityEvent {
  name: string;
  start_date?: string;
  current?: boolean;
  url?: string;
}

/** Flat representation of a volunteering entry. */
export interface VolunteeringFlat {
  active?: boolean;
  role: string;
  organization: string;
  start_date: string;
  end_date: string;
  logo: string;
  url: string;
  events?: CommunityEvent[];
}

const _voluntariadoBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/voluntariado.json", {
    eager: true,
    import: "default",
  }) as Record<string, CollectionJson<VolunteeringFlat>>,
  "colecciones",
);
const voluntariadoEn = pickFromBucket(_voluntariadoBucket, "en");
const voluntariadoEs = pickFromBucket(_voluntariadoBucket, "es");

/**
 * Get active volunteering entries for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active volunteering entries.
 */
export function getVolunteering(lang: string): VolunteeringFlat[] {
  return filterActive(pickByLang(voluntariadoEn?.items ?? [], voluntariadoEs?.items ?? [], lang));
}

/**
 * Get the volunteering section title for a language.
 * @param lang - Language code ("en" or "es").
 * @returns The section title string.
 */
export function getVolunteeringTitle(lang: string): string {
  return pickByLang(voluntariadoEn, voluntariadoEs, lang)?.title ?? "";
}

// ---------------------------------------------------------------------------
// Languages (colecciones/idiomas)
// ---------------------------------------------------------------------------

/** Flat representation of a spoken language entry. */
export interface LanguageFlat {
  name: string;
  order?: number;
  active?: boolean;
}

const _idiomasBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/idiomas.json", {
    eager: true,
    import: "default",
  }) as Record<string, CollectionJson<LanguageFlat>>,
  "colecciones",
);
const idiomasEn = pickFromBucket(_idiomasBucket, "en");
const idiomasEs = pickFromBucket(_idiomasBucket, "es");

/**
 * Get active language entries for a locale.
 * @param lang - Language code ("en" or "es").
 * @returns Active language entries.
 */
export function getLanguages(lang: string): LanguageFlat[] {
  return filterActive(pickByLang(idiomasEn?.items ?? [], idiomasEs?.items ?? [], lang));
}

/**
 * Get the languages section title for a locale.
 * @param lang - Language code ("en" or "es").
 * @returns The section title string.
 */
export function getLanguagesTitle(lang: string): string {
  return pickByLang(idiomasEn, idiomasEs, lang)?.title ?? "";
}

// ---------------------------------------------------------------------------
// Software (colecciones/software)
// ---------------------------------------------------------------------------

/** Flat representation of a software skill entry. */
export interface SoftwareFlat {
  name: string;
  active?: boolean;
  category?: string;
  years?: string;
}

const _softwareBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/software.json", {
    eager: true,
    import: "default",
  }) as Record<string, CollectionJson<SoftwareFlat>>,
  "colecciones",
);
const softwareEn = pickFromBucket(_softwareBucket, "en");
const softwareEs = pickFromBucket(_softwareBucket, "es");

/**
 * Get active software entries for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active software entries.
 */
export function getSoftware(lang: string): SoftwareFlat[] {
  return filterActive(pickByLang(softwareEn?.items ?? [], softwareEs?.items ?? [], lang));
}

/**
 * Get the software section title for a language.
 * @param lang - Language code ("en" or "es").
 * @returns The section title string.
 */
export function getSoftwareTitle(lang: string): string {
  return pickByLang(softwareEn, softwareEs, lang)?.title ?? "";
}

// ---------------------------------------------------------------------------
// Media (colecciones/medios)
// ---------------------------------------------------------------------------

const _mediosBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/medios.json", {
    eager: true,
    import: "default",
  }) as Record<string, CollectionJson<MediaItem>>,
  "colecciones",
);
const mediosEn = pickFromBucket(_mediosBucket, "en");
const mediosEs = pickFromBucket(_mediosBucket, "es");

/**
 * Get active media items for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active media entries.
 */
export function getMedia(lang: string): MediaItem[] {
  return filterActive(
    pickByLang(mediosEn?.items ?? [], mediosEs?.items ?? [], lang) as MediaItem[],
  );
}

// ---------------------------------------------------------------------------
// Projects (colecciones/proyectos)
// ---------------------------------------------------------------------------

/** Flat representation of a project entry. */
export interface ProjectFlat {
  title: string;
  description: string;
  organization: string;
  skills: string[];
  links: { label: string; url: string; type?: string }[];
  active?: boolean;
  icon?: string;
  role?: string;
  category?: string;
}

const _proyectosBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/proyectos.json", {
    eager: true,
    import: "default",
  }) as Record<string, CollectionJson<ProjectFlat>>,
  "colecciones",
);
const proyectosEn = pickFromBucket(_proyectosBucket, "en");
const proyectosEs = pickFromBucket(_proyectosBucket, "es");

/**
 * Get active project entries for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active project entries with parsed skill tags.
 */
export function getProjects(lang: string): ProjectFlat[] {
  const items = pickByLang(
    proyectosEn?.items ?? [],
    proyectosEs?.items ?? [],
    lang,
  ) as ProjectFlat[];
  return filterActive(items).map((p) => ({
    ...p,
    skills: parseTags(p.skills),
  }));
}

/**
 * Get the projects section title for a language.
 * @param lang - Language code.
 * @returns Section title.
 */
export function getProjectsTitle(lang: string): string {
  return (pickByLang(proyectosEn, proyectosEs, lang) as { title?: string }).title ?? "";
}

// ---------------------------------------------------------------------------
// Recommendations (colecciones/recomendaciones) — testimonial quotes
// ---------------------------------------------------------------------------

/** Flat representation of a recommendation/testimonial entry. */
export interface RecommendationFlat {
  name: string;
  title: string;
  text: string;
  image?: string;
  linkedin?: string;
  active?: boolean;
}

const _recomendacionesBucket = bucketByLocale(
  import.meta.glob("../../data/colecciones/*/recomendaciones.json", {
    eager: true,
    import: "default",
  }) as Record<string, CollectionJson<RecommendationFlat>>,
  "colecciones",
);
const recomendacionesEn = pickFromBucket(_recomendacionesBucket, "en");
const recomendacionesEs = pickFromBucket(_recomendacionesBucket, "es");

/**
 * Get active recommendation entries for a language.
 * @param lang - Language code ("en" or "es").
 * @returns Active recommendation entries.
 */
export function getRecommendations(lang: string): RecommendationFlat[] {
  return filterActive(
    pickByLang(recomendacionesEn?.items ?? [], recomendacionesEs?.items ?? [], lang),
  );
}

/**
 * Get the recommendations section title for a language.
 * @param lang - Language code.
 * @returns Section title.
 */
export function getRecommendationsTitle(lang: string): string {
  return pickByLang(recomendacionesEn, recomendacionesEs, lang)?.title ?? "";
}
