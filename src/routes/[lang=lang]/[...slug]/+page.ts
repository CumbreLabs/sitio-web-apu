import type { PageLoad } from "./$types";
import type { EntryGenerator } from "./$types";
import { getAllPageEntries } from "$lib/routes";

export const prerender = true;

export const entries: EntryGenerator = () => getAllPageEntries();

export const load: PageLoad = ({ params }) => {
  return {
    slug: params.slug,
  };
};
