/**
 * Svelte 5 rune-based theme store managing dark/light mode. Persists the user's
 * choice to localStorage and syncs with the system color-scheme preference.
 * @module stores/theme
 */

import { browser } from "$app/environment";

/** The allowed theme values. */
type Theme = "light" | "dark";

/**
 * Read a key from localStorage. Safari Private Mode (and other storage-disabled
 * contexts) throws synchronously on access — swallow it so module load + writes
 * stay infallible and the site falls back to system/in-memory state.
 * @param key - Storage key to read.
 * @returns The stored value, or null if missing/unavailable.
 */
function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write a key to localStorage. Same rationale as `safeRead` — never throw.
 * @param key - Storage key to write.
 * @param value - Value to persist.
 */
function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or disabled — preference just won't persist.
  }
}

/**
 * Determine the initial theme based on localStorage or system preference.
 * Falls back to "light" on the server (matches the default skin).
 * @returns The initial theme value
 */
function getInitialTheme(): Theme {
  if (!browser) return "light";
  const stored = safeRead("theme") as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let theme = $state<Theme>(getInitialTheme());

/**
 * Get the current theme value.
 * @returns The current theme ("light" or "dark")
 */
export function getTheme(): Theme {
  return theme;
}

/**
 * Toggle the theme between "light" and "dark".
 * Updates the DOM `data-theme` attribute and persists the choice to localStorage.
 */
export function toggleTheme(): void {
  theme = theme === "light" ? "dark" : "light";
  if (browser) {
    document.documentElement.setAttribute("data-theme", theme);
    safeWrite("theme", theme);
  }
}

/**
 * Initialize the theme on the client side.
 * Sets the `data-theme` attribute on the document element and listens
 * for system color scheme changes to update the theme automatically
 * when no explicit preference is stored.
 * @returns Cleanup function that removes the media query listener.
 */
export function initTheme(): () => void {
  if (!browser) return () => {};
  document.documentElement.setAttribute("data-theme", theme);

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    if (!safeRead("theme")) {
      theme = e.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
    }
  };
  mq.addEventListener("change", handler);

  // Cross-tab sync: if the user toggles the theme in another tab/window of
  // this same origin, mirror the change here so both tabs stay in lockstep.
  const storageHandler = (e: StorageEvent) => {
    if (e.key !== "theme" || e.storageArea !== localStorage) return;
    const next = e.newValue;
    if (next === "light" || next === "dark") {
      theme = next;
      document.documentElement.setAttribute("data-theme", theme);
    }
  };
  window.addEventListener("storage", storageHandler);

  return () => {
    mq.removeEventListener("change", handler);
    window.removeEventListener("storage", storageHandler);
  };
}
