import { error } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";

export const prerender = true;

export const load: LayoutLoad = ({ params }) => {
  const lang = params.lang;
  if (lang !== "en" && lang !== "es") {
    error(404, "Not found");
  }
  return { lang };
};
