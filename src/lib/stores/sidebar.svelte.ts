/**
 * Svelte 5 rune-based sidebar store managing the table-of-contents navigation items
 * and the content area max-width for writing post pages.
 * @module stores/sidebar
 */

import type { SidebarItem } from "$lib/types";

let items = $state<SidebarItem[]>([]);
let contentMaxWidth = $state("48rem");

/**
 * Get the current sidebar navigation items.
 * @returns An array of SidebarItem objects currently displayed in the sidebar
 */
export function getSidebarItems(): SidebarItem[] {
  return items;
}

/**
 * Replace the sidebar navigation items with a new set.
 * @param newItems - The new array of SidebarItem objects to display
 */
export function setSidebarItems(newItems: SidebarItem[]): void {
  items = newItems;
}

/**
 * Get the current maximum width of the sidebar content area.
 * @returns The CSS max-width value (e.g., "48rem")
 */
export function getSidebarContentMaxWidth(): string {
  return contentMaxWidth;
}

/**
 * Set the maximum width of the sidebar content area.
 * @param width - A CSS max-width value (e.g., "48rem", "100%")
 */
export function setSidebarContentMaxWidth(width: string): void {
  contentMaxWidth = width;
}
