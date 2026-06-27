<script lang="ts">
  import { Globe, ShoppingBag, Book, ExternalLink } from "lucide-svelte";
  import BrandIcons from "$lib/components/widgets/BrandIcons.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getProjects } from "$lib/data";
  import { projectsConfig } from "$lib/config";
  import { gridColsClass } from "$lib/grid";
  import { t } from "$lib/i18n";

  type CategoryFilter = "all" | "oss" | "professional";

  let lang = $derived(getLang());
  let filter = $state<CategoryFilter>("all");
  let projects = $derived(getProjects(lang));
  let filtered = $derived(
    filter === "all" ? projects : projects.filter((p) => p.category === filter),
  );
  // Cards-per-row from `proyectos.json#cardsPerRow`. Same value drives the
  // home `proyectos-destacados` collection (`CollectionFeaturedProjects`) so
  // listing and featured stay visually aligned. Defaults to 3 in
  // `$lib/grid#gridColsClass` when missing.
  const GRID_CLASS = gridColsClass(projectsConfig.cardsPerRow);

  /**
   * Resolve a lucide icon component for a project link based on its `type`.
   * @param type - Optional link type from the project data ("marketplace", "docs", "website", "github", etc.).
   * @returns Lucide icon component appropriate for the link kind (defaults to ExternalLink).
   */
  function iconFor(type?: string) {
    switch (type) {
      case "marketplace":
        return ShoppingBag;
      case "docs":
        return Book;
      case "website":
        return Globe;
      default:
        return ExternalLink;
    }
  }
</script>

{#if projects.length > 0}
  <div class="flex gap-2 mb-8">
    {#each ["all", "oss", "professional"] as f (f)}
      <button
        type="button"
        onclick={() => (filter = f as CategoryFilter)}
        aria-pressed={filter === f}
        class="px-4 py-1.5 font-sans text-sm rounded transition-colors {filter === f
          ? 'bg-text text-bg dark:bg-text-dark dark:text-bg-dark'
          : 'bg-surface dark:bg-surface-dark text-muted dark:text-muted-dark hover:bg-border dark:hover:bg-border-dark hover:text-text dark:hover:text-text-dark'}"
      >
        {t(lang, `projects.${f}`)}
      </button>
    {/each}
  </div>

  <div class="{GRID_CLASS} gap-4">
    {#each filtered as project, i (i)}
      <div
        class="group h-full flex flex-col border border-border dark:border-border-dark rounded bg-surface dark:bg-surface-dark p-5 hover:shadow-card dark:hover:shadow-card-dark transition-all"
      >
        <div class="flex items-start gap-3 mb-3">
          {#if project.icon}
            <img
              src={project.icon}
              alt=""
              width="32"
              height="32"
              loading="lazy"
              decoding="async"
              class="w-8 h-8 rounded-sm object-contain shrink-0 mt-0.5"
            />
          {/if}
          <div class="flex-1 min-w-0">
            <h2 class="font-sans font-semibold text-lg text-text dark:text-text-dark leading-snug">
              {project.title}
            </h2>
            {#if project.role}
              <p class="font-sans text-xs text-muted dark:text-muted-dark">{project.role}</p>
            {/if}
          </div>
        </div>
        <p class="font-serif text-sm text-text dark:text-text-dark leading-relaxed mb-4 flex-1">
          {project.description}
        </p>
        {#if project.skills.length > 0}
          <div class="flex flex-wrap gap-1.5 mb-4">
            {#each project.skills as tag (tag)}
              <span
                class="px-2 py-0.5 text-xs font-sans rounded bg-bg dark:bg-bg-dark text-muted dark:text-muted-dark border border-border dark:border-border-dark"
              >
                {tag}
              </span>
            {/each}
          </div>
        {/if}
        {#if project.links.length > 0}
          <div
            class="flex flex-wrap gap-2 mt-auto pt-3 border-t border-border dark:border-border-dark"
          >
            {#each project.links as link (link.url)}
              {@const Icon = iconFor(link.type)}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans rounded bg-bg dark:bg-bg-dark text-text dark:text-text-dark border border-border dark:border-border-dark hover:border-accent dark:hover:border-accent-dark hover:text-accent dark:hover:text-accent-dark transition-colors"
              >
                {#if link.type === "github"}
                  <BrandIcons name="Github" size={13} />
                {:else}
                  <Icon size={13} />
                {/if}
                {link.label}
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
