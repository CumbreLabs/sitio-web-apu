<script lang="ts">
  import { ArrowRight, Globe, ShoppingBag, Book, ExternalLink } from "lucide-svelte";
  import BrandIcons from "$lib/components/widgets/BrandIcons.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getProjects } from "$lib/data";
  import { getPagePath } from "$lib/routes";
  import { projectsConfig } from "$lib/config";
  import { gridColsClass } from "$lib/grid";
  import { t } from "$lib/i18n";

  let lang = $derived(getLang());
  // Both knobs come pre-defaulted from $lib/config (see $lib/defaults).
  // `featuredRows` × `cardsPerRow` = how many cards we slice — keeps featured
  // a tidy rectangular block at the largest breakpoint.
  let perRow = $derived(projectsConfig.cardsPerRow);
  let projects = $derived(getProjects(lang).slice(0, perRow * projectsConfig.featuredRows));
  let projectsPath = $derived(getPagePath("proyectos", lang));
  let gridClass = $derived(gridColsClass(perRow));

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
  <section id="featured-projects" class="mb-16">
    <div class="flex items-center justify-between mb-6">
      <h2
        class="font-sans text-xs font-semibold uppercase tracking-widest text-muted dark:text-muted-dark"
      >
        {t(lang, "home.featuredProjectsTitle")}
      </h2>
      <a
        href={projectsPath}
        class="inline-flex items-center gap-1 font-sans text-sm text-accent dark:text-accent-dark hover:underline"
      >
        {t(lang, "home.viewAll")}
        <ArrowRight size={14} />
      </a>
    </div>
    <div class="{gridClass} gap-4">
      {#each projects as project, i (i)}
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
              <h3
                class="font-sans font-semibold text-lg text-text dark:text-text-dark leading-snug"
              >
                {project.title}
              </h3>
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
  </section>
{/if}
