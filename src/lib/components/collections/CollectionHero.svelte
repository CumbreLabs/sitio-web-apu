<script lang="ts">
  import { getLang } from "$lib/stores/lang.svelte";
  import { getHero } from "$lib/data";

  let lang = $derived(getLang());
  let hero = $derived(getHero(lang));

  /**
   * Anchor CTAs (`#planes`) scroll within the page; external CTAs
   * (`https://wa.me/...`) open in a new tab with rel hardening.
   * @param href - Destination URL.
   * @returns True when the link leaves the site.
   */
  function isExternal(href: string): boolean {
    return /^https?:\/\//.test(href);
  }
</script>

<section class="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
  {#if hero.backgroundImage}
    <img
      src={hero.backgroundImage}
      alt=""
      aria-hidden="true"
      fetchpriority="high"
      class="absolute inset-0 h-full w-full object-cover"
    />
  {/if}
  <!-- Brand teal scrim (matches the original APU hero gradient) so the headline
       stays legible while keeping the photo's color in the APU palette. -->
  <div
    class="absolute inset-0"
    style="background: linear-gradient(rgba(26,79,86,0.8), rgba(42,95,103,0.8));"
  ></div>

  <div class="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center text-white">
    <h1 class="font-serif text-4xl font-bold uppercase leading-tight tracking-wide sm:text-6xl">
      {hero.title}
    </h1>
    <p class="mt-5 font-sans text-lg text-white/90 sm:text-2xl">{hero.subtitle}</p>
    <div class="mt-9 flex flex-wrap items-center justify-center gap-4">
      <a
        href={hero.ctaPrimary.href}
        target={isExternal(hero.ctaPrimary.href) ? "_blank" : undefined}
        rel={isExternal(hero.ctaPrimary.href) ? "noopener noreferrer" : undefined}
        class="inline-block rounded-full bg-brand-orange px-8 py-3 font-sans font-semibold text-white shadow-card transition-transform hover:scale-105"
      >
        {hero.ctaPrimary.label}
      </a>
      <a
        href={hero.ctaSecondary.href}
        target={isExternal(hero.ctaSecondary.href) ? "_blank" : undefined}
        rel={isExternal(hero.ctaSecondary.href) ? "noopener noreferrer" : undefined}
        class="inline-block rounded-full border-2 border-white px-8 py-3 font-sans font-semibold text-white transition-colors hover:bg-white hover:text-text"
      >
        {hero.ctaSecondary.label}
      </a>
    </div>
  </div>
</section>
