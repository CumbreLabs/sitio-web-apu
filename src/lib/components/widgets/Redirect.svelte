<script lang="ts">
  /**
   * Renders a static-friendly redirect stub. Used when an album, writing post,
   * or page has its CMS `redirectUrl` field set — the content editor fills
   * that field expecting the page to forward visitors to the new destination
   * (e.g. retired URL → external publication, slug rename).
   *
   * On SSG we can't issue a 301, so we layer three mechanisms:
   *   1. `<link rel="canonical">` to the destination so crawlers index the
   *      target and not this stub.
   *   2. `<meta http-equiv="refresh" content="0;url=...">` for no-JS clients.
   *   3. Inline `location.replace(...)` for instant client navigation (no
   *      history entry on this URL, so Back doesn't loop).
   *
   * The body shows a manual link so visitors with both JS disabled AND meta
   * refresh suppressed still have an obvious way forward. The page is also
   * marked `noindex` so search engines never list the stub itself.
   */
  interface Props {
    url: string;
  }
  let { url }: Props = $props();

  // Escape `"` in the URL so it can safely sit inside an HTML attribute. URLs
  // legally allow encoded quotes; explicit escape removes any chance of an
  // attribute-breakout via a malformed CMS entry.
  let safeUrl = $derived(url.replace(/"/g, "%22"));
</script>

<svelte:head>
  <meta name="robots" content="noindex" />
  <link rel="canonical" href={url} />
  <meta http-equiv="refresh" content={`0;url=${safeUrl}`} />
  {@html `<script>location.replace(${JSON.stringify(url)})</` + "script>"}
</svelte:head>

<div class="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center font-sans">
  <p class="text-muted dark:text-muted-dark">
    Redirecting to
    <a href={url} class="text-accent dark:text-accent-dark hover:underline break-all">{url}</a>…
  </p>
</div>
