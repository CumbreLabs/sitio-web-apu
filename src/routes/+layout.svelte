<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { afterNavigate } from "$app/navigation";
  import Navbar from "$lib/components/chrome/Navbar.svelte";
  import Footer from "$lib/components/chrome/Footer.svelte";
  import SidebarNav from "$lib/components/chrome/SidebarNav.svelte";
  import CookieBanner from "$lib/components/chrome/CookieBanner.svelte";
  import BrandIcons from "$lib/components/widgets/BrandIcons.svelte";
  import { siteConfig, getSupportedLanguages } from "$lib/config";
  import { getSocial, getSiteI18n } from "$lib/data";
  import { setLang } from "$lib/stores/lang.svelte";
  import { t } from "$lib/i18n";
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const defaultLang = siteConfig.defaultLanguage || "es";
  const supportedLanguages = getSupportedLanguages();

  /**
   * Derive the active language directly from the URL pathname. The root `/` renders
   * the default-language home page; `/<lang>/...` is explicit. Doing this here
   * instead of relying on store state avoids module-state pollution across
   * prerender invocations and lets the Navbar render in the right language from
   * the very first paint.
   * @param pathname - Current URL pathname.
   * @returns The detected language code.
   */
  function detectLang(pathname: string): string {
    for (const code of supportedLanguages) {
      if (pathname === `/${code}` || pathname.startsWith(`/${code}/`)) return code;
    }
    return defaultLang;
  }

  // Sync the store with the URL before any child component renders.
  setLang(detectLang($page.url.pathname));

  let lang = $derived(detectLang($page.url.pathname));
  // Keep the store in sync on client-side navigation.
  $effect.pre(() => {
    setLang(lang);
  });

  // Per-locale labels read from sitio.json / traducciones.json so a fork can
  // change the section name (Writing / Posts / Articles / Blog) without
  // touching layout markup. Skip-link label flows through the i18n table.
  let feedSectionLabel = $derived(getSiteI18n(lang).feedSectionLabel || "");
  let skipLinkLabel = $derived(t(lang, "nav.skipToContent"));

  // Other derived values now use the URL-derived lang rather than the (possibly
  // stale) store value, so they're never wrong on the first render.
  let social = $derived(getSocial(lang));

  // Floating WhatsApp button (APU brand chrome): sourced from the configured
  // `pie-de-pagina.json#social` whatsapp entry so a fork without WhatsApp simply
  // omits it and the FAB disappears. No hardcoded number in markup.
  let whatsappUrl = $derived(social.find((s) => s.icon === "Whatsapp")?.url ?? "");
  let whatsappLabel = $derived(t(lang, "contact.whatsapp"));

  // Use the locale-aware site description (from configuracion/{lang}/sitio.json)
  // for the WebSite + Person JSON-LD descriptions so a Spanish page's structured
  // data carries Spanish prose — was previously hardcoded to the English-only
  // root sitio.json. `jobTitle` stays English because schema.org consumers
  // typically don't localize that field, but `description` is the user-visible
  // blurb that surfaces in Google Knowledge Panel / SERP and should match the
  // page lang.
  let siteDescription = $derived(getSiteI18n(lang).description);
  // Locale-aware job title and person-image — drawn from per-language sitio.json
  // so a Spanish page's structured data uses Spanish prose and a fork can swap
  // headshots without code changes.
  let personJobTitle = $derived(getSiteI18n(lang).jobTitle || "");
  const personImagePath =
    (siteConfig as { personImage?: string }).personImage || siteConfig.favicon;
  const personName = siteConfig.author || siteConfig.name;
  // Defaults that older configs without explicit fields still get a sane value.
  const knowsLanguage =
    (siteConfig as { knowsLanguage?: readonly string[] }).knowsLanguage || supportedLanguages;

  let websiteJsonLd = $derived(
    JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${siteConfig.url}/#website`,
          url: siteConfig.url,
          name: siteConfig.name,
          description: siteDescription,
          inLanguage: supportedLanguages,
          publisher: { "@id": `${siteConfig.url}/#person` },
        },
        {
          "@type": "Person",
          "@id": `${siteConfig.url}/#person`,
          name: personName,
          url: siteConfig.url,
          image: {
            "@type": "ImageObject",
            contentUrl: `${siteConfig.url}${personImagePath}`,
            creator: { "@type": "Person", name: personName },
            copyrightNotice: personName,
            creditText: personName,
          },
          ...(personJobTitle ? { jobTitle: personJobTitle } : {}),
          description: siteDescription,
          sameAs: social.filter((s) => s.url.startsWith("http")).map((s) => s.url),
          knowsLanguage,
        },
      ],
    }),
  );

  afterNavigate(({ from, to }) => {
    if (from?.url.pathname === to?.url.pathname) return;
    // Language toggle hands off a `scrollPct` (current scrollY / docHeight)
    // via sessionStorage plus a `<html style="min-height: …">` pin that keeps
    // the document tall enough during the DOM swap to prevent the browser
    // from clamping scrollY to 0. We restore the equivalent position on the
    // new doc and release the pin in the SAME requestAnimationFrame so the
    // user sees a single paint at the new position — no flicker. Any other
    // cross-page navigation gets the usual top-of-page reset.
    const pctStr = window.sessionStorage.getItem("scrollPct");
    if (pctStr !== null) {
      window.sessionStorage.removeItem("scrollPct");
      const pct = parseFloat(pctStr);
      if (Number.isFinite(pct)) {
        window.requestAnimationFrame(() => {
          document.documentElement.style.minHeight = "";
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (docHeight > 0) window.scrollTo(0, pct * docHeight);
        });
        return;
      }
      // Defensive: if pct was malformed, drop the pin so the page isn't stuck
      // at the old height.
      document.documentElement.style.minHeight = "";
    }
    window.scrollTo(0, 0);
  });
</script>

<svelte:head>
  {@html `<script type="application/ld+json">${websiteJsonLd}</` + "script>"}
  <link
    rel="alternate"
    type="application/rss+xml"
    title="{siteConfig.name} — {feedSectionLabel} (RSS)"
    href="/{lang}/rss.xml"
  />
  <link
    rel="alternate"
    type="application/atom+xml"
    title="{siteConfig.name} — {feedSectionLabel} (Atom)"
    href="/{lang}/atom.xml"
  />
</svelte:head>

<a href="#main" class="skip-link">{skipLinkLabel}</a>

<div class="min-h-screen flex flex-col">
  <Navbar />
  <SidebarNav />
  <main id="main" class="flex-1">
    {@render children()}
  </main>
  <Footer />
  <CookieBanner />

  {#if whatsappUrl}
    <!-- Floating WhatsApp shortcut. Wrapped in <aside> (a complementary
         landmark) so this persistent action isn't orphan content sitting
         outside every landmark — axe's "region" rule. The <aside> is
         zero-height; the link itself is position:fixed to the viewport. -->
    <aside aria-label={whatsappLabel}>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={whatsappLabel}
        class="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-card transition-transform hover:scale-110"
      >
        <BrandIcons name="Whatsapp" size={30} />
      </a>
    </aside>
  {/if}
</div>
