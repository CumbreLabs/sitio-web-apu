<script lang="ts">
  import { page } from "$app/stores";
  import { ArrowLeft, ExternalLink } from "lucide-svelte";
  import SEO from "$lib/components/SEO.svelte";
  import Redirect from "$lib/components/widgets/Redirect.svelte";
  import MarkdownRenderer from "$lib/components/media/MarkdownRenderer.svelte";
  import TagList from "$lib/components/widgets/TagList.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { setSidebarItems, setSidebarContentMaxWidth } from "$lib/stores/sidebar.svelte";
  import { getWritingBasePath } from "$lib/routes";
  import { siteConfig, seoConfig, writingConfig, getAlternateLanguage } from "$lib/config";
  import { t } from "$lib/i18n";
  import { formatLongDate } from "$lib/date";
  import { getWritingPost, getWritingPostByFileId, getPageData } from "$lib/data";

  interface Props {
    year: string;
    month: string;
    slug: string;
  }

  let { year, month, slug }: Props = $props();

  let lang = $derived(getLang());
  let writingPath = $derived(getWritingBasePath(lang));

  let post = $derived(getWritingPost(slug, lang));
  // Bidirectional fallback: when the current locale doesn't have this post,
  // try the other locale's translation rather than 404'ing. Site default
  // direction (which is "primary" vs "fallback") drops out of the picker —
  // a fork that flips defaultLanguage gets the right behavior for free.
  let altLang = $derived(getAlternateLanguage(lang));
  let fallbackPost = $derived(!post ? getWritingPost(slug, altLang) : undefined);
  // Raw markdown source (for wordCount, image-extraction, image-as-LCP heuristic).
  let displayContent = $derived(post?.body || fallbackPost?.body);
  // Pre-rendered, sanitized HTML for `{@html}`. Built at SSG time by
  // `scripts/vite/rendered-pages.ts`; we never re-run marked on the client.
  let displayHtml = $derived(post?.html || fallbackPost?.html || "");
  // True when we're rendering the other language's body because no translation exists in `lang`.
  // Surface this to the reader (banner below) and to crawlers (inLanguage in JSON-LD).
  let usingFallback = $derived(!post && !!fallbackPost);
  let contentLang = $derived(usingFallback ? altLang : lang);
  let altPost = $derived(post ? getWritingPostByFileId(post.fileId, altLang) : undefined);
  let altSlug = $derived(altPost?.slug ?? slug);
  let altWritingPath = $derived(getWritingBasePath(altLang));
  let alternatePath = $derived(`${altWritingPath}${year}/${month}/${altSlug}/`);

  // Rough word count from the rendered body. Strips markdown image/link syntax
  // and code fences before counting so the number reflects prose, not markup.
  // Used in Article JSON-LD's `wordCount` (a recommended SEO field).
  let wordCount = $derived.by(() => {
    if (!displayContent) return 0;
    const stripped = displayContent
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[#>*_~-]/g, " ");
    return stripped.split(/\s+/).filter(Boolean).length;
  });

  $effect(() => {
    // `settings.sidebar: false` in the escritos markdown frontmatter hides
    // the right-side auto-TOC for this post. Useful for short opinion
    // pieces where a 2-item TOC is more noise than signal. Read from `post`
    // first then `fallbackPost` (which is the alt-locale's version we
    // render when the current locale has no translation) so the toggle
    // follows whichever post the reader actually sees.
    const sidebarFlag = post?.sidebar ?? fallbackPost?.sidebar ?? true;
    const items = post?.headings ?? fallbackPost?.headings ?? [];
    if (items.length > 0 && sidebarFlag !== false) {
      setSidebarItems(items);
      setSidebarContentMaxWidth("48rem");
    } else {
      setSidebarItems([]);
    }
    return () => setSidebarItems([]);
  });

  let displayPost = $derived(post || fallbackPost);

  let formattedDate = $derived(displayPost ? formatLongDate(displayPost.date, lang) : "");

  let title = $derived(displayPost?.title ?? "");
  let summary = $derived(displayPost?.summary ?? "");
  // Image for Article JSON-LD. Resolution: first inline image in the body →
  // post's ogImage → site-default OG image. Required by Google Rich Results
  // (Article schema considers `image` mandatory) so we always fall through to
  // a non-empty value — otherwise the JSON-LD validator (`npm run check:jsonld`)
  // would fail the build.
  let postImage = $derived(
    displayContent?.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1] ??
      (displayPost as { ogImage?: string } | undefined)?.ogImage ??
      (seoConfig as { defaultOGImage?: string }).defaultOGImage,
  );
  // Look up the localized name of the post's original language via the i18n
  // table. Translations live at `writing.languageNames.<code>` so adding a
  // new language only needs a new JSON entry — no code edit. Falls back to
  // the raw code (e.g. "fr") when the lookup misses.
  let originalLangLabel = $derived(
    displayPost?.originalLanguage
      ? t(lang, `writing.languageNames.${displayPost.originalLanguage}`, {
          defaultValue: displayPost.originalLanguage,
        })
      : "",
  );

  // Malformed externalUrl (CMS typo, missing protocol) would otherwise throw
  // from `new URL(...)` and crash the whole page render.
  let externalHost = $derived.by(() => {
    const url = displayPost?.externalUrl;
    if (!url) return "";
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  });

  // `articleSection` = the post's primary category. Google recommends a single
  // value; if the post has tags, use the first as the section. Otherwise fall
  // back to the localized writing-section title from the paginas markdown
  // frontmatter (Spanish/English/whatever the site uses).
  let writingPageData = $derived(
    writingConfig.writingPageId ? getPageData(writingConfig.writingPageId, lang) : undefined,
  );
  let articleSection = $derived(displayPost?.tags[0] ?? writingPageData?.title ?? "");

  let articleJsonLd = $derived(
    displayPost
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description: summary,
          datePublished: displayPost.date,
          ...(displayPost.updatedDate ? { dateModified: displayPost.updatedDate } : {}),
          author: { "@id": `${siteConfig.url}/#person` },
          publisher: { "@id": `${siteConfig.url}/#person` },
          url: `${siteConfig.url}${$page.url.pathname}`,
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `${siteConfig.url}${$page.url.pathname}`,
          },
          articleSection,
          ...(wordCount > 0 ? { wordCount } : {}),
          inLanguage: contentLang,
          image: {
            "@type": "ImageObject",
            contentUrl: postImage!.startsWith("http") ? postImage : `${siteConfig.url}${postImage}`,
          },
          ...(displayPost.tags.length > 0 ? { keywords: displayPost.tags } : {}),
        }
      : undefined,
  );

  // Home → Writing → Post breadcrumb. Helps Google show breadcrumbs in SERPs
  // and gives crawlers an explicit hierarchy for the deep URL structure.
  // Breadcrumb labels are read from the corresponding paginas markdown's
  // `title` frontmatter so they're naturally per-locale and editable via
  // the CMS — no in-code language ternaries.
  let homePageData = $derived(
    siteConfig.homePage ? getPageData(siteConfig.homePage, lang) : undefined,
  );
  let breadcrumbJsonLd = $derived(
    displayPost
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: homePageData?.title || siteConfig.name,
              item: `${siteConfig.url}/${lang}/`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: writingPageData?.title || articleSection,
              item: `${siteConfig.url}${writingPath}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: title,
              item: `${siteConfig.url}${$page.url.pathname}`,
            },
          ],
        }
      : undefined,
  );

  // Escape `</` so a title containing the closing-script sequence can't break
  // out of the inline <script type="application/ld+json"> block.
  const CLOSING_SCRIPT_RE = new RegExp("<" + "/", "g");
  let breadcrumbScript = $derived(
    breadcrumbJsonLd
      ? JSON.stringify(breadcrumbJsonLd).replace(CLOSING_SCRIPT_RE, "<\\/")
      : undefined,
  );
</script>

<svelte:head>
  {#if breadcrumbScript}
    {@html `<script type="application/ld+json">${breadcrumbScript}</` + "script>"}
  {/if}
</svelte:head>

{#if !displayPost}
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
    <h1 class="text-2xl font-bold mb-4">{t(lang, "writing.postNotFound")}</h1>
    <p class="text-muted dark:text-muted-dark mb-6">{t(lang, "writing.postNotFoundDesc")}</p>
    <a
      href={writingPath}
      class="font-sans text-sm text-accent dark:text-accent-dark hover:underline"
    >
      &larr; {t(lang, "writing.backToWriting")}
    </a>
  </div>
{:else if displayPost.redirectUrl}
  <Redirect url={displayPost.redirectUrl} />
{:else}
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12">
    <SEO
      {title}
      description={summary}
      path={$page.url.pathname}
      type="article"
      image={postImage}
      jsonLd={articleJsonLd}
      {alternatePath}
      publishedTime={displayPost.date}
      modifiedTime={displayPost.updatedDate || undefined}
      section={articleSection}
      tags={displayPost.tags}
    />

    <a
      href={writingPath}
      class="inline-flex items-center gap-1 font-sans text-sm text-muted hover:text-accent dark:text-muted-dark dark:hover:text-accent-dark mb-8 transition-colors"
    >
      <ArrowLeft size={14} />
      {t(lang, "writing.backToWriting")}
    </a>

    <article>
      <header class="mb-8">
        <time datetime={displayPost.date} class="font-sans text-sm text-muted dark:text-muted-dark"
          >{formattedDate}</time
        >
        <h1
          class="font-sans text-3xl sm:text-4xl font-bold mt-2 mb-4 text-text dark:text-text-dark"
        >
          {title}
        </h1>
        <TagList tags={displayPost.tags} variant="surface" class="mb-4" />
      </header>

      {#if displayPost.externalUrl}
        <div
          class="mb-8 px-4 py-3 border border-border dark:border-border-dark bg-surface dark:bg-surface-dark flex items-center gap-2"
        >
          <ExternalLink size={16} class="text-muted shrink-0" />
          <p class="font-sans text-sm text-muted dark:text-muted-dark">
            {t(lang, "writing.originallyPublished")}
            <a
              href={displayPost.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent dark:text-accent-dark hover:underline font-medium"
            >
              {externalHost}
            </a>
            {#if displayPost.originalLanguage}
              <span> ({t(lang, "writing.inLanguage")} {originalLangLabel})</span>
            {/if}
          </p>
        </div>
      {/if}

      {#if !displayPost.externalUrl && displayPost.originalLanguage && displayPost.originalLanguage !== lang}
        <div
          class="mb-8 px-4 py-3 border border-border dark:border-border-dark bg-surface dark:bg-surface-dark flex items-center gap-2"
        >
          <ExternalLink size={16} class="text-muted shrink-0" />
          <p class="font-sans text-sm text-muted dark:text-muted-dark">
            {t(lang, "writing.originallyWrittenIn")}
            {originalLangLabel}
          </p>
        </div>
      {/if}

      {#if usingFallback}
        <div
          class="mb-8 px-4 py-3 border border-border dark:border-border-dark bg-surface dark:bg-surface-dark flex items-center gap-2"
        >
          <ExternalLink size={16} class="text-muted shrink-0" />
          <p class="font-sans text-sm text-muted dark:text-muted-dark">
            {t(lang, "writing.fallbackToEnglish")}
          </p>
        </div>
      {/if}

      <div class="font-sans leading-relaxed text-muted dark:text-muted-dark" lang={contentLang}>
        {#if displayHtml}
          <MarkdownRenderer html={displayHtml} />
        {:else}
          <p>{summary}</p>
        {/if}
      </div>
    </article>
  </div>
{/if}
