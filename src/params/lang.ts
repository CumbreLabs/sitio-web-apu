import type { ParamMatcher } from "@sveltejs/kit";
import { getSupportedLanguages } from "$lib/config";

// Source of truth for "what's a valid language" is `sitio.json#languages`
// (read once at module load). A fork that adds `fr` or switches to a
// monolingual `["en"]` site just edits sitio.json and the matcher updates.
const SUPPORTED = new Set(getSupportedLanguages());

/**
 * Restrict the `[lang]` route param to one of `siteConfig.languages`.
 * @param param - Route parameter value.
 * @returns True if param is a supported language code.
 */
export const match: ParamMatcher = (param) => SUPPORTED.has(param);
