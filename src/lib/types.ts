/**
 * Shared TypeScript type definitions used across the site, including interfaces
 * for portfolio albums, writing posts, projects, media items, social links, and sidebar navigation.
 * @module types
 */

/** Union of supported brand icon names for social links. */
export type BrandIconName =
  | "Github"
  | "Linkedin"
  | "Youtube"
  | "Twitter"
  | "Instagram"
  | "Facebook"
  | "Tiktok"
  | "Threads"
  | "Bluesky"
  | "Pinterest"
  | "Telegram"
  | "Whatsapp"
  | "Vimeo"
  | "Behance"
  | "Flickr";

/**
 * Represents an external social media or profile link.
 */
export interface SocialLink {
  /** Display name of the social platform (e.g., "LinkedIn", "GitHub"). */
  name: string;
  /** Full URL to the social profile. */
  url: string;
  /** Icon identifier used to render the appropriate icon component. */
  icon: string;
}

/**
 * Represents a media appearance (video, interview, podcast, or press article).
 */
export interface MediaItem {
  /** Display title of the media item. */
  title: string;
  /** Brief description of the media content. */
  description: string;
  /** URL to the media resource. */
  url: string;
  /**
   * Video host. Drives the iframe embed URL + thumbnail URL templates in
   * `CollectionMedia.svelte`. Defaults to "youtube" for legacy entries that
   * only carry `youtubeId`.
   */
  provider?: "youtube" | "loom";
  /**
   * Video ID at the configured `provider`. For YouTube this is the 11-char
   * watch-URL slug; for Loom this is the 32-char hex session id. Legacy
   * `youtubeId` entries are still honored when `provider`/`videoId` are absent.
   */
  videoId?: string;
  /** Legacy field retained for back-compat with pre-`provider` entries. */
  youtubeId?: string;
  /** URL or path to a thumbnail image. */
  thumbnail?: string;
  /** Publication or appearance date in "YYYY-MM-DD" format. */
  date: string;
  /** The type of media appearance. */
  type: "video" | "interview" | "podcast" | "press" | "conference" | "meetup" | "webinar" | "demo";
  /** Name of the media source or publisher. */
  source: string;
  /** Whether this media item is active/visible. */
  active?: boolean;
  /** Display event name (e.g. "PyCon Colombia"); falls back to `source`. */
  event?: string;
  /** Spoken language of the talk (BCP-47 short code: "en", "es", etc.). */
  language?: string;
}

/**
 * Represents an item in the sidebar navigation (e.g., a heading from a writing post).
 */
export interface SidebarItem {
  /** Unique identifier used as the anchor target. */
  id: string;
  /** Display label for the sidebar item. */
  label: string;
  /** Heading level (2 for h2, 3 for h3). Defaults to 2 if omitted. */
  level?: number;
}
