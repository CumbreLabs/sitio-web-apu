<script lang="ts">
  import { page } from "$app/stores";
  import { Menu, X } from "lucide-svelte";
  import LanguageToggle from "../widgets/LanguageToggle.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getHomePath } from "$lib/routes";
  import { getNavItems, getNavBrand, getSocial } from "$lib/data";
  import { t } from "$lib/i18n";

  let isOpen = $state(false);
  let lang = $derived(getLang());
  let homePath = $derived(getHomePath(lang));
  let navItems = $derived(getNavItems(lang));
  // Resolved brand: text + (optional) image + (optional) imageDark. All
  // fallbacks applied at module load in data.ts — no per-render coalescing.
  let brand = $derived(getNavBrand(lang));
  // Render two <img> tags when light + dark logos differ; CSS toggles
  // visibility via the `dark:` Tailwind variant (matches `data-theme="dark"`
  // on <html>, not `prefers-color-scheme`). Single image when the same
  // file serves both themes.
  // "Reservar" CTA → the configured WhatsApp link (so there's no hardcoded
  // number in the navbar; a fork without WhatsApp just drops the button).
  let bookUrl = $derived(getSocial(lang).find((s) => s.icon === "Whatsapp")?.url ?? "");

  function fullPath(path: string): string {
    return `/${lang}${path}`;
  }

  function isActive(linkPath: string): boolean {
    const current = $page.url.pathname.replace(/\/$/, "");
    const target = fullPath(linkPath).replace(/\/$/, "");
    return current === target || current.startsWith(target + "/");
  }

  // Brand link goes to /<lang>/ — only treat it as the current page when the
  // user is actually on the home page, not on every subpath. `isActive("")`
  // would over-match because every subpath starts with /<lang>/.
  let isHome = $derived(
    $page.url.pathname.replace(/\/$/, "") === `/${lang}`,
  );

  let menuEl = $state<HTMLDivElement | null>(null);
  let toggleBtnEl = $state<HTMLButtonElement | null>(null);

  // Close on Escape + trap Tab inside the mobile menu when it's open, so
  // keyboard users can't tab "out" of the overlay into hidden content
  // behind it. Effect re-binds whenever `isOpen` flips; listener only
  // exists while the menu is open.
  $effect(() => {
    if (!isOpen) return;
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        isOpen = false;
        toggleBtnEl?.focus();
        return;
      }
      if (e.key !== "Tab" || !menuEl) return;
      const focusables = menuEl.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });
</script>

<!-- APU brand header: fixed dark-teal bar, white nav links (orange hover),
     round logo, white-bordered language pill, orange "Reservar" CTA. -->
<nav aria-label={t(lang, "nav.primary")} class="sticky top-0 z-40 bg-navbar text-white shadow-md">
  <div class="mx-auto max-w-7xl px-4 sm:px-6">
    <div class="flex items-center justify-between h-20">
      <a href={homePath} aria-current={isHome ? "page" : undefined} class="flex shrink-0 items-center">
        {#if brand.image}
          <img
            src={brand.image}
            alt={brand.imageAlt}
            width="64"
            height="64"
            loading="eager"
            decoding="async"
            class="h-16 w-16 rounded-full object-cover"
          />
        {/if}
        {#if brand.showText}
          <span class="ml-3 font-sans text-lg font-bold text-white">{brand.text}</span>
        {/if}
      </a>

      <!-- Desktop nav -->
      <ul class="hidden items-center gap-6 list-none m-0 p-0 md:flex">
        {#each navItems as item (item.key)}
          <li>
            <a
              href={fullPath(item.path)}
              aria-current={isActive(item.path) ? "page" : undefined}
              class="font-sans text-sm font-medium text-white transition-colors hover:text-brand-orange"
            >
              {item.label}
            </a>
          </li>
        {/each}
        <li><LanguageToggle /></li>
        {#if bookUrl}
          <li>
            <a
              href={bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block rounded-full bg-brand-orange px-5 py-2 font-sans text-sm font-semibold text-white transition-transform hover:scale-105"
            >
              {t(lang, "nav.book")}
            </a>
          </li>
        {/if}
      </ul>

      <!-- Mobile controls -->
      <div class="flex items-center gap-2 md:hidden">
        <LanguageToggle />
        <button
          bind:this={toggleBtnEl}
          type="button"
          onclick={() => (isOpen = !isOpen)}
          class="p-2 text-white transition-colors hover:text-brand-orange"
          aria-label={t(lang, `nav.${isOpen ? "closeMenu" : "openMenu"}`)}
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
        >
          {#if isOpen}
            <X size={24} />
          {:else}
            <Menu size={24} />
          {/if}
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    {#if isOpen}
      <div
        id="mobile-menu"
        bind:this={menuEl}
        class="mt-1 border-t border-white/15 pb-4 pt-3 md:hidden"
      >
        <ul class="flex flex-col gap-1 list-none m-0 p-0">
          {#each navItems as item (item.key)}
            <li>
              <a
                href={fullPath(item.path)}
                aria-current={isActive(item.path) ? "page" : undefined}
                class="block px-3 py-2 font-sans text-sm text-white transition-colors hover:text-brand-orange"
                onclick={() => (isOpen = false)}
              >
                {item.label}
              </a>
            </li>
          {/each}
          {#if bookUrl}
            <li>
              <a
                href={bookUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="block px-3 py-2 font-sans text-sm font-semibold text-brand-orange"
                onclick={() => (isOpen = false)}
              >
                {t(lang, "nav.book")}
              </a>
            </li>
          {/if}
        </ul>
      </div>
    {/if}
  </div>
</nav>
