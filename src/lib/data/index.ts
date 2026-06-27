/**
 * Public data API. Consumers do `import { ... } from "$lib/data"` and get a
 * unified surface — internally each concern lives in its own sibling file
 * (collections / portfolio / writing / pages / featured / site).
 *
 * Re-exports are SELECTIVE (no `export *`): only the public symbols below
 * are part of the API. Anything not listed here is an internal helper
 * shared between sibling files (see `_internal.ts` and the `_*` prefixed
 * accessors).
 * @module data
 */

// About-page collections + projects + media
export {
  type AboutHeader,
  type AwardFlat,
  type CommunityEvent,
  type EducationFlat,
  type ExperienceFlat,
  type LanguageFlat,
  type ProjectFlat,
  type RecommendationFlat,
  type SoftwareFlat,
  type VolunteeringFlat,
  getAboutHeader,
  getAboutHeaderTitle,
  getAwards,
  getAwardsTitle,
  getEducation,
  getEducationTitle,
  getExperience,
  getExperienceTitle,
  getLanguages,
  getLanguagesTitle,
  getMedia,
  getProjects,
  getProjectsTitle,
  getRecommendations,
  getRecommendationsTitle,
  getSoftware,
  getSoftwareTitle,
  getVolunteering,
  getVolunteeringTitle,
} from "./collections";

// Portfolio
export {
  type PortfolioAlbumFlat,
  type PortfolioPhotoFlat,
  getAlbumByFileId,
  getAlbumBySlug,
  getPortfolio,
} from "./portfolio";

// Writing posts + the post-sorting helpers (live next to the post data they operate on)
export {
  type WritingPostFlat,
  type WritingSort,
  getWritingPost,
  getWritingPostByFileId,
  getWritingPosts,
  sortPosts,
} from "./writing";

// Pages
export { type PageData, getPageData, getPageSlugMap } from "./pages";

// Featured-content curation
export {
  getFeaturedAlbums,
  getFeaturedAlbumsTitle,
  getFeaturedWritings,
  getFeaturedWritingsTitle,
} from "./featured";

// APU home-page sections (single-page site: hero / about / services / gallery / contact)
export {
  type AboutData,
  type ContactData,
  type Cta,
  type GalleryData,
  type GalleryPhoto,
  type HeroData,
  type Plan,
  type ServicesData,
  type Stat,
  getAbout,
  getContact,
  getGallery,
  getHero,
  getServices,
} from "./secciones";

// Site chrome — i18n facade + footer + navigation
export {
  type FooterText,
  type NavBrand,
  type NavItem,
  type SiteI18n,
  getFooterText,
  getNavBrand,
  getNavItems,
  getSiteI18n,
  getSocial,
} from "./site";
