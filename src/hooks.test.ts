import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `reroute` reads `dev` from $app/environment at call time, but the import
// only resolves once per module. Use vi.resetModules() + vi.doMock() around
// each `import` to swap the value per-test.

const ALIAS_CASES_DEV = [
  // [input, expected-rewrite, description]
  ["/en/escritos/2024/10/foo/", "/en/writing/2024/10/foo/", "EN escritos→writing deep path"],
  ["/en/escritos/", "/en/writing/", "EN escritos→writing root"],
  ["/en/portafolio/handstand/", "/en/portfolio/handstand/", "EN portafolio→portfolio"],
  ["/en/portafolio/", "/en/portfolio/", "EN portafolio→portfolio root"],
  ["/es/writing/2024/10/foo/", "/es/escritos/2024/10/foo/", "ES writing→escritos deep path"],
  ["/es/writing/", "/es/escritos/", "ES writing→escritos root"],
  ["/es/portfolio/parada-de-manos/", "/es/portafolio/parada-de-manos/", "ES portfolio→portafolio"],
  ["/es/portfolio/", "/es/portafolio/", "ES portfolio→portafolio root"],
] as const;

const NOOP_CASES_DEV = [
  ["/es/escritos/2024/10/foo/", "ES with native escritos prefix"],
  ["/en/writing/2024/10/foo/", "EN with native writing prefix"],
  ["/es/portafolio/parada-de-manos/", "ES with native portafolio prefix"],
  ["/en/portfolio/handstand/", "EN with native portfolio prefix"],
  ["/es/", "home page"],
  ["/es/sobre-mi/", "non-locale-divergent slug (sobre-mi only exists in ES routes)"],
  ["/en/about/", "non-locale-divergent slug (about only exists in EN routes)"],
  ["/", "root"],
  ["/api/something/", "non-langed root segment"],
] as const;

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("$app/environment");
});

describe("reroute in dev mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("$app/environment", () => ({ dev: true, browser: false, building: false }));
  });

  it.each(ALIAS_CASES_DEV)("rewrites %s → %s (%s)", async (input, expected) => {
    const { reroute } = await import("./hooks");
    expect(reroute({ url: new URL(`http://localhost${input}`), fetch })).toBe(expected);
  });

  it.each(NOOP_CASES_DEV)("leaves %s alone (%s)", async (input) => {
    const { reroute } = await import("./hooks");
    expect(reroute({ url: new URL(`http://localhost${input}`), fetch })).toBeUndefined();
  });

  it("preserves query strings on the path being rewritten", async () => {
    const { reroute } = await import("./hooks");
    // SvelteKit's reroute receives the URL; querystring should NOT be in the
    // returned pathname (only the path matters). Verify behavior: querystring
    // is dropped from the rewrite because it isn't part of the pathname.
    expect(reroute({ url: new URL("http://localhost/en/escritos/?utm=x"), fetch })).toBe(
      "/en/writing/",
    );
  });
});

describe("reroute in production", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("$app/environment", () => ({ dev: false, browser: true, building: false }));
  });

  it("does NOT rewrite cross-locale aliases — they must 404 in prod for SEO", async () => {
    const { reroute } = await import("./hooks");
    expect(
      reroute({ url: new URL("http://localhost/en/escritos/2024/10/foo/"), fetch }),
    ).toBeUndefined();
    expect(
      reroute({ url: new URL("http://localhost/es/writing/2024/10/foo/"), fetch }),
    ).toBeUndefined();
    expect(
      reroute({ url: new URL("http://localhost/en/portafolio/handstand/"), fetch }),
    ).toBeUndefined();
    expect(
      reroute({ url: new URL("http://localhost/es/portfolio/parada-de-manos/"), fetch }),
    ).toBeUndefined();
  });

  it("leaves canonical URLs alone", async () => {
    const { reroute } = await import("./hooks");
    expect(reroute({ url: new URL("http://localhost/es/"), fetch })).toBeUndefined();
    expect(
      reroute({ url: new URL("http://localhost/en/portfolio/handstand/"), fetch }),
    ).toBeUndefined();
  });
});
