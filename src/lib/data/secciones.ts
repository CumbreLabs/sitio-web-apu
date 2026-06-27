/**
 * APU home-page section loaders. APU is a single-page site: the home page
 * (`paginas/{lang}/inicio.md`) lists a set of "collections" that are really
 * the page's stacked sections — hero, about+stats, services/plans, gallery,
 * contact. Each section is one localized JSON object under
 * `colecciones/{lang}/<name>.json`, loaded here and rendered by the matching
 * `Collection*.svelte` partial via `CollectionRenderer`.
 *
 * Unlike the template's about-page collections (which are `{title, items[]}`
 * lists), these are bespoke per-section shapes — so each getter returns the
 * whole typed object rather than a filtered item list.
 * @module data/secciones
 */

import { bucketByLocale, pickByLang, pickFromBucket } from "./_internal";

/** A call-to-action button (label + destination). */
export interface Cta {
  label: string;
  href: string;
}

/** Hero section: headline, subtitle, two CTAs, background image. */
export interface HeroData {
  title: string;
  subtitle: string;
  ctaPrimary: Cta;
  ctaSecondary: Cta;
  backgroundImage: string;
}

/** A single headline statistic (e.g. "10+" / "Years of experience"). */
export interface Stat {
  number: string;
  label: string;
}

/** About / "Sobre Nosotros" section: heading, intro prose, stat trio. */
export interface AboutData {
  title: string;
  text: string;
  stats: Stat[];
}

/** The highlighted course card above the plans grid. */
export interface FeaturedPlan {
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  price: string;
  perks: string;
}

/** One service/plan card in the services grid. */
export interface Plan {
  title: string;
  subtitle: string;
  items: string[];
  price: string;
}

/** A promotional callout below the plans grid (e.g. TREPA discount). */
export interface Discount {
  title: string;
  body: string;
  linkLabel: string;
  linkHref: string;
}

/** Services section: featured course + plans grid + discount callout. */
export interface ServicesData {
  title: string;
  featured: FeaturedPlan;
  plansTitle: string;
  plans: Plan[];
  discount: Discount;
}

/** One gallery photo. */
export interface GalleryPhoto {
  src: string;
  alt: string;
}

/** Gallery section: heading + carousel photos. */
export interface GalleryData {
  title: string;
  photos: GalleryPhoto[];
}

/** Contact / "Reserva Ahora" section: CTA heading + contact details. */
export interface ContactData {
  title: string;
  subtitle: string;
  email: string;
  phone: string;
}

/**
 * Build a default-language-resolving getter for a single-object section.
 * @param name - Section file name (without extension) under colecciones/{lang}/.
 * @param glob - Eager glob result for that section across locales.
 * @returns A `(lang) => SectionData` accessor.
 */
function sectionGetter<T>(name: string, glob: Record<string, T>): (lang: string) => T {
  const bucket = bucketByLocale(glob, "colecciones");
  const en = pickFromBucket(bucket, "en");
  const es = pickFromBucket(bucket, "es");
  void name;
  return (lang: string) => pickByLang(en, es, lang);
}

/** Hero section data for a language. */
export const getHero = sectionGetter<HeroData>(
  "hero",
  import.meta.glob("../../data/colecciones/*/hero.json", {
    eager: true,
    import: "default",
  }) as Record<string, HeroData>,
);

/** About section data for a language. */
export const getAbout = sectionGetter<AboutData>(
  "sobre-nosotros",
  import.meta.glob("../../data/colecciones/*/sobre-nosotros.json", {
    eager: true,
    import: "default",
  }) as Record<string, AboutData>,
);

/** Services section data for a language. */
export const getServices = sectionGetter<ServicesData>(
  "servicios",
  import.meta.glob("../../data/colecciones/*/servicios.json", {
    eager: true,
    import: "default",
  }) as Record<string, ServicesData>,
);

/** Gallery section data for a language. */
export const getGallery = sectionGetter<GalleryData>(
  "galeria",
  import.meta.glob("../../data/colecciones/*/galeria.json", {
    eager: true,
    import: "default",
  }) as Record<string, GalleryData>,
);

/** Contact section data for a language. */
export const getContact = sectionGetter<ContactData>(
  "contacto",
  import.meta.glob("../../data/colecciones/*/contacto.json", {
    eager: true,
    import: "default",
  }) as Record<string, ContactData>,
);
