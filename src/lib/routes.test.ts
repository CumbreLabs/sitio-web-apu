import { describe, it, expect, vi, afterEach } from "vitest";

// `routes.ts` builds its slug + path maps at module-load time from `data.ts`.
// Mock the relevant data helpers BEFORE importing `routes` so the test
// fixtures are deterministic (the real data files change as Arena adds
// posts).

const fixture = {
  paginasEs: new Map<string, string>([
    ["inicio", "inicio"],
    ["sobre-mi", "sobre-mi"],
    ["portafolio", "portafolio"],
    ["escritos", "escritos"],
    ["proyectos", "proyectos"],
    ["privacidad", "privacidad"],
  ]),
  paginasEn: new Map<string, string>([
    ["inicio", "home"],
    ["sobre-mi", "about"],
    ["portafolio", "portfolio"],
    ["escritos", "writing"],
    ["proyectos", "projects"],
    ["privacidad", "privacy"],
  ]),
  writingByLang: {
    es: [
      { fileId: "post-a", slug: "primer-post", date: "2024-01-15" },
      { fileId: "post-b", slug: "segundo-post", date: "2024-03-20" },
    ],
    en: [
      { fileId: "post-a", slug: "first-post", date: "2024-01-15" },
      // post-b only exists in ES — represents the fallback-to-EN-original case.
    ],
  },
  portfolioByLang: {
    es: [
      { id: "album-1", slug: "parada-de-manos" },
      { id: "album-2", slug: "bodegon-estudio" },
    ],
    en: [
      { id: "album-1", slug: "handstand" },
      { id: "album-2", slug: "studio-still-life" },
    ],
  },
};

vi.mock("$lib/data", () => ({
  getPageSlugMap: (lang: string) => (lang === "es" ? fixture.paginasEs : fixture.paginasEn),
  getWritingPosts: (lang: string) =>
    lang === "es" ? fixture.writingByLang.es : fixture.writingByLang.en,
  getWritingPost: (slug: string, lang: string) => {
    const list = lang === "es" ? fixture.writingByLang.es : fixture.writingByLang.en;
    return list.find((p) => p.slug === slug);
  },
  getWritingPostByFileId: (fileId: string, lang: string) => {
    const list = lang === "es" ? fixture.writingByLang.es : fixture.writingByLang.en;
    return list.find((p) => p.fileId === fileId);
  },
  getPortfolio: (lang: string) =>
    lang === "es" ? fixture.portfolioByLang.es : fixture.portfolioByLang.en,
  getAlbumBySlug: (slug: string, lang: string) => {
    const list = lang === "es" ? fixture.portfolioByLang.es : fixture.portfolioByLang.en;
    return list.find((a) => a.slug === slug);
  },
  getAlbumByFileId: (id: string, lang: string) => {
    const list = lang === "es" ? fixture.portfolioByLang.es : fixture.portfolioByLang.en;
    return list.find((a) => a.id === id);
  },
}));

vi.mock("$lib/config", () => ({
  siteConfig: {
    homePage: "inicio",
    defaultLanguage: "es",
  },
  writingConfig: { writingPageId: "escritos" },
  portfolioConfig: { portfolioPageId: "portafolio" },
  footerConfig: { privacyPageId: "privacidad" },
  getSupportedLanguages: () => ["es", "en"] as const,
  getAlternateLanguage: (lang: string) => (lang === "es" ? "en" : "es"),
}));

const routes = await import("./routes");

afterEach(() => vi.clearAllMocks());

describe("getPagePath", () => {
  it("returns the localized URL for a known page id", () => {
    expect(routes.getPagePath("sobre-mi", "es")).toBe("/es/sobre-mi/");
    expect(routes.getPagePath("sobre-mi", "en")).toBe("/en/about/");
    expect(routes.getPagePath("portafolio", "en")).toBe("/en/portfolio/");
    expect(routes.getPagePath("escritos", "es")).toBe("/es/escritos/");
  });

  it("falls back to the language home for unknown ids", () => {
    expect(routes.getPagePath("totally-unknown", "es")).toBe("/es/");
    expect(routes.getPagePath("totally-unknown", "en")).toBe("/en/");
  });
});

describe("getHomePath", () => {
  it("returns /<lang>/", () => {
    expect(routes.getHomePath("es")).toBe("/es/");
    expect(routes.getHomePath("en")).toBe("/en/");
  });
});

describe("resolvePageSlug", () => {
  it("maps a localized URL segment back to its page id", () => {
    expect(routes.resolvePageSlug("sobre-mi", "es")).toBe("sobre-mi");
    expect(routes.resolvePageSlug("about", "en")).toBe("sobre-mi");
    expect(routes.resolvePageSlug("portfolio", "en")).toBe("portafolio");
    expect(routes.resolvePageSlug("escritos", "es")).toBe("escritos");
  });

  it("returns undefined for unknown segments", () => {
    expect(routes.resolvePageSlug("nope", "es")).toBeUndefined();
    expect(routes.resolvePageSlug("about", "es")).toBeUndefined(); // EN slug in ES space
  });
});

describe("getWritingBasePath", () => {
  it("returns the localized writing-section URL", () => {
    expect(routes.getWritingBasePath("es")).toBe("/es/escritos/");
    expect(routes.getWritingBasePath("en")).toBe("/en/writing/");
  });
});

describe("getEquivalentPath — language toggle", () => {
  it("translates simple landing pages", () => {
    expect(routes.getEquivalentPath("/es/sobre-mi/", "en")).toBe("/en/about/");
    expect(routes.getEquivalentPath("/en/about/", "es")).toBe("/es/sobre-mi/");
    expect(routes.getEquivalentPath("/es/portafolio/", "en")).toBe("/en/portfolio/");
    expect(routes.getEquivalentPath("/en/writing/", "es")).toBe("/es/escritos/");
  });

  it("translates the home and lang-root paths", () => {
    expect(routes.getEquivalentPath("/", "en")).toBe("/en/");
    expect(routes.getEquivalentPath("/es/", "en")).toBe("/en/");
    expect(routes.getEquivalentPath("/en/", "es")).toBe("/es/");
  });

  it("translates writing deep paths via paired fileId", () => {
    expect(routes.getEquivalentPath("/es/escritos/2024/01/primer-post/", "en")).toBe(
      "/en/writing/2024/01/first-post/",
    );
    expect(routes.getEquivalentPath("/en/writing/2024/01/first-post/", "es")).toBe(
      "/es/escritos/2024/01/primer-post/",
    );
  });

  it("falls back to the target listing when the paired post is missing", () => {
    // `post-b` only exists in ES — toggling EN should land on the listing.
    expect(routes.getEquivalentPath("/es/escritos/2024/03/segundo-post/", "en")).toBe(
      "/en/writing/",
    );
  });

  it("translates album deep paths via paired id", () => {
    expect(routes.getEquivalentPath("/es/portafolio/parada-de-manos/", "en")).toBe(
      "/en/portfolio/handstand/",
    );
    expect(routes.getEquivalentPath("/en/portfolio/handstand/", "es")).toBe(
      "/es/portafolio/parada-de-manos/",
    );
  });

  it("falls back to the target home for unknown sections", () => {
    expect(routes.getEquivalentPath("/es/totally-unknown/", "en")).toBe("/en/");
    expect(routes.getEquivalentPath("", "en")).toBe("/en/");
  });

  it("tolerates trailing slashes", () => {
    expect(routes.getEquivalentPath("/es/sobre-mi", "en")).toBe("/en/about/");
    expect(routes.getEquivalentPath("/es/sobre-mi/", "en")).toBe("/en/about/");
  });
});

describe("getAllPageEntries — sitemap source", () => {
  it("emits one entry per page-id × language but skips the home page", () => {
    const entries = routes.getAllPageEntries();
    // 6 paginas × 2 langs - 2 home entries = 10
    const paginaEntries = entries.filter(
      (e) =>
        !e.slug.includes("/") ||
        (!e.slug.startsWith("escritos") &&
          !e.slug.startsWith("writing") &&
          !e.slug.startsWith("portafolio") &&
          !e.slug.startsWith("portfolio")),
    );
    expect(paginaEntries.length).toBeGreaterThanOrEqual(10);
    // The home page id "inicio" must not appear in any slug.
    expect(entries.find((e) => e.slug === "inicio")).toBeUndefined();
    expect(entries.find((e) => e.slug === "home")).toBeUndefined();
  });

  it("emits writing posts with the YYYY/MM segment", () => {
    const entries = routes.getAllPageEntries();
    expect(entries).toContainEqual({ lang: "es", slug: "escritos/2024/01/primer-post" });
    expect(entries).toContainEqual({ lang: "es", slug: "escritos/2024/03/segundo-post" });
    expect(entries).toContainEqual({ lang: "en", slug: "writing/2024/01/first-post" });
  });

  it("emits portfolio albums in both languages", () => {
    const entries = routes.getAllPageEntries();
    expect(entries).toContainEqual({ lang: "es", slug: "portafolio/parada-de-manos" });
    expect(entries).toContainEqual({ lang: "en", slug: "portfolio/handstand" });
  });
});
