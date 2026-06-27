import { describe, it, expect, vi } from "vitest";

// `t()` and `tObject()` close over the real `traducciones.json` files at
// module-import time. Mock both before importing so test outcomes don't
// depend on whatever copy lives on disk today. Keep the mocked shape close
// to the real one so realistic dot-paths still resolve.
vi.mock("../data/configuracion/en/traducciones.json", () => ({
  default: {
    sidebar: { onThisPage: "On this page" },
    nav: { openMenu: "Open menu", closeMenu: "Close menu" },
    portfolio: {
      photoCount_one: "{{count}} photo",
      photoCount_other: "{{count}} photos",
      all: "All",
    },
    writing: { opinion: "Opinion", report: "Reports" },
    greeting: "Hello, {{name}}!",
  },
}));

vi.mock("../data/configuracion/es/traducciones.json", () => ({
  default: {
    sidebar: { onThisPage: "En esta página" },
    nav: { openMenu: "Abrir menú", closeMenu: "Cerrar menú" },
    portfolio: {
      photoCount_one: "{{count}} foto",
      photoCount_other: "{{count}} fotos",
      all: "Todo",
    },
    writing: { opinion: "Opinión", report: "Informes" },
    greeting: "¡Hola, {{name}}!",
  },
}));

const { t } = await import("./i18n");

describe("t — simple lookup", () => {
  it("returns the value at a dot path", () => {
    expect(t("en", "sidebar.onThisPage")).toBe("On this page");
    expect(t("es", "sidebar.onThisPage")).toBe("En esta página");
  });

  it("falls back to English when the locale is unknown", () => {
    expect(t("fr", "sidebar.onThisPage")).toBe("On this page");
  });

  it("returns the key itself when nothing matches", () => {
    expect(t("en", "totally.bogus.key")).toBe("totally.bogus.key");
  });

  it("respects a defaultValue when the key is missing", () => {
    expect(t("en", "totally.bogus.key", { defaultValue: "fallback" })).toBe("fallback");
  });
});

describe("t — interpolation", () => {
  it("interpolates {{var}} placeholders", () => {
    expect(t("en", "greeting", { name: "Arena" })).toBe("Hello, Arena!");
    expect(t("es", "greeting", { name: "Arena" })).toBe("¡Hola, Arena!");
  });

  it("leaves unknown placeholders intact", () => {
    // A missing param shows the bare placeholder so a translation bug is
    // visible to a reviewer instead of silently disappearing.
    expect(t("en", "greeting")).toBe("Hello, {{name}}!");
  });
});

describe("t — pluralization", () => {
  it("picks _one when count === 1", () => {
    expect(t("en", "portfolio.photoCount", { count: 1 })).toBe("1 photo");
    expect(t("es", "portfolio.photoCount", { count: 1 })).toBe("1 foto");
  });

  it("picks _other otherwise", () => {
    expect(t("en", "portfolio.photoCount", { count: 0 })).toBe("0 photos");
    expect(t("en", "portfolio.photoCount", { count: 5 })).toBe("5 photos");
    expect(t("es", "portfolio.photoCount", { count: 42 })).toBe("42 fotos");
  });

  it("interpolates the count value into the chosen branch", () => {
    expect(t("en", "portfolio.photoCount", { count: 1 })).toContain("1");
    expect(t("en", "portfolio.photoCount", { count: 99 })).toContain("99");
  });

  it("falls back to plain lookup when no plural form is defined", () => {
    expect(t("en", "portfolio.all", { count: 1 })).toBe("All");
    expect(t("en", "portfolio.all", { count: 5 })).toBe("All");
  });
});

describe("t — dynamic key template support (used by check-i18n)", () => {
  it("resolves keys built as template literals at runtime", () => {
    // Real consumers do `t(lang, \`writing.${type}\`)`; that's a runtime
    // string, but `t` shouldn't care.
    const type = "opinion";
    expect(t("en", `writing.${type}`)).toBe("Opinion");
    expect(t("es", "writing.report")).toBe("Informes");
  });
});
