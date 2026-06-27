/**
 * Svelte 5 rune-based language store managing the active locale (EN/ES). Persists
 * the user's language preference to localStorage and updates the document lang attribute.
 * @module stores/lang
 */

import { browser } from "$app/environment";
import { siteConfig } from "$lib/config";

const defaultLang = siteConfig.defaultLanguage || "es";

let currentLang = $state<string>(defaultLang);

/**
 * Get the current language code.
 * @returns The active language code (e.g., "en" or "es")
 */
export function getLang(): string {
  return currentLang;
}

/**
 * Set the active language and persist the choice.
 * Updates localStorage and the document's `lang` attribute in the browser.
 * localStorage writes are guarded — Safari Private Mode throws on access.
 * @param lang - The language code to set ("en" or "es")
 */
export function setLang(lang: string): void {
  currentLang = lang;
  if (browser) {
    try {
      localStorage.setItem("language", lang);
    } catch {
      // Storage disabled — preference just won't persist across visits.
    }
    document.documentElement.lang = lang;
  }
}
