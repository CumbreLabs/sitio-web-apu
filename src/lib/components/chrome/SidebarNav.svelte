<script lang="ts">
  import { getLang } from "$lib/stores/lang.svelte";
  import { getSidebarItems, getSidebarContentMaxWidth } from "$lib/stores/sidebar.svelte";
  import { t } from "$lib/i18n";
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/stores";

  let lang = $derived(getLang());
  let items = $derived(getSidebarItems());
  let contentMaxWidth = $derived(getSidebarContentMaxWidth());

  let activeId = $state<string | null>(null);

  $effect(() => {
    if (!browser || items.length === 0) return;

    const sectionIds = items.map((item) => item.id);
    const visibleMap = new Map<string, IntersectionObserverEntry>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibleMap.set(entry.target.id, entry);
        }

        let topEntry: IntersectionObserverEntry | null = null;
        for (const id of sectionIds) {
          const entry = visibleMap.get(id);
          if (entry?.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }

        if (topEntry) {
          activeId = topEntry.target.id;
          return;
        }

        const viewportThird = window.innerHeight / 3;
        let fallbackId: string | null = null;
        for (const id of sectionIds) {
          const el = document.getElementById(id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= viewportThird) {
              fallbackId = id;
            }
          }
        }
        if (fallbackId) {
          activeId = fallbackId;
        }
      },
      {
        rootMargin: "-10% 0px -60% 0px",
        threshold: Array.from({ length: 11 }, (_, i) => i / 10),
      },
    );

    const elements: Element[] = [];
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        elements.push(el);
      }
    }

    return () => {
      observer.disconnect();
    };
  });

  let isWideContent = $derived(contentMaxWidth === "64rem");
  let visibilityClass = $derived(isWideContent ? "hidden xl:block" : "hidden lg:block");
  let isCompact = $derived(items.length > 6);
  let baseSizes = $derived(
    isCompact ? { h2: "text-xs", h3: "text-[11px]" } : { h2: "text-sm", h3: "text-xs" },
  );
  let itemPadding = $derived(isCompact ? "py-0.5" : "py-1");

  function handleClick(e: MouseEvent, id: string) {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    // Move focus to the target heading so a screen reader announces it after
    // navigation (otherwise focus stays on the anchor and the user has no idea
    // what section they're now in). Headings aren't focusable by default;
    // `tabindex="-1"` makes them programmatically focusable without putting
    // them in the Tab sequence. `preventScroll: true` lets the smooth scroll
    // run uninterrupted instead of focus() snapping the viewport.
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "smooth" });
    // SvelteKit owns the History API — calling `history.replaceState` directly
    // logs a warning and risks confusing the router's internal navigation state.
    // The `$app/navigation` `replaceState` updates only the hash here (passing
    // the current pathname + search so nothing else mutates) while keeping the
    // router in sync.
    const url = new URL($page.url);
    url.hash = id;
    replaceState(url, $page.state);
  }
</script>

{#if items.length > 0}
  <nav
    aria-labelledby="sidebar-nav-heading"
    class="fixed top-28 z-40 {visibilityClass}"
    style:right="max(1rem, calc((100vw - {contentMaxWidth}) / 2 - 14rem))"
    style:width="13rem"
  >
    <p
      id="sidebar-nav-heading"
      class="font-sans text-sm font-semibold text-text dark:text-text-dark mb-3"
    >
      {t(lang, "sidebar.onThisPage")}
    </p>
    <div class="flex flex-col">
      {#each items as item (item.id)}
        {@const isActive = activeId === item.id}
        {@const isNested = (item.level ?? 2) >= 3}
        <a
          href="#{item.id}"
          aria-current={isActive ? "location" : undefined}
          class="block border-l-[3px] {itemPadding} transition-colors {isNested
            ? 'pl-5'
            : 'pl-3'} {isActive
            ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
            : 'border-border dark:border-border-dark text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark'}"
          onclick={(e) => handleClick(e, item.id)}
        >
          <span class="font-sans {isNested ? baseSizes.h3 : baseSizes.h2} leading-snug">
            {item.label}
          </span>
        </a>
      {/each}
    </div>
  </nav>
{/if}
