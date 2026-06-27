<script lang="ts">
  import CollectionHero from "./CollectionHero.svelte";
  import CollectionAbout from "./CollectionAbout.svelte";
  import CollectionServices from "./CollectionServices.svelte";
  import CollectionGallery from "./CollectionGallery.svelte";
  import CollectionContact from "./CollectionContact.svelte";

  interface Props {
    name: string;
  }

  let { name }: Props = $props();

  // Module-scoped so we don't log the same unknown name once per instance.
  const warnedNames = new Set<string>();

  // APU is a single-page site: the home page (`paginas/{lang}/inicio.md`)
  // lists these section names in render order, and each maps to its partial.
  const COMPONENTS: Record<string, typeof CollectionHero> = {
    hero: CollectionHero,
    "sobre-nosotros": CollectionAbout,
    servicios: CollectionServices,
    galeria: CollectionGallery,
    contacto: CollectionContact,
  };

  let Component = $derived(COMPONENTS[name]);

  $effect(() => {
    if (!Component && !warnedNames.has(name)) {
      warnedNames.add(name);
      console.warn(`CollectionRenderer: unknown collection "${name}"`);
    }
  });
</script>

{#if Component}
  <Component />
{/if}
