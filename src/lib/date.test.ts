import { describe, it, expect } from "vitest";
import {
  formatYearMonth,
  formatPeriod,
  formatYear,
  postDateSegments,
  formatLongDate,
} from "./date";

describe("formatYearMonth", () => {
  it("formats YYYY-MM in English", () => {
    expect(formatYearMonth("2024-03", "en")).toBe("Mar 2024");
  });

  it("formats YYYY-MM in Spanish", () => {
    expect(formatYearMonth("2024-03", "es")).toBe("Mar 2024");
  });

  it("strips the day when given YYYY-MM-DD", () => {
    expect(formatYearMonth("2024-03-15", "en")).toBe("Mar 2024");
  });

  it("uses the right month names per locale", () => {
    // Most months happen to share 3-letter prefix between en/es — January is one
    // where they diverge ("Jan" vs "Ene").
    expect(formatYearMonth("2024-01", "en")).toBe("Jan 2024");
    expect(formatYearMonth("2024-01", "es")).toBe("Ene 2024");
    expect(formatYearMonth("2024-08", "en")).toBe("Aug 2024");
    expect(formatYearMonth("2024-08", "es")).toBe("Ago 2024");
    expect(formatYearMonth("2024-12", "en")).toBe("Dec 2024");
    expect(formatYearMonth("2024-12", "es")).toBe("Dic 2024");
  });

  it("formats unknown configured locales via Intl, not an English fallback", () => {
    // March in French = "mars" (no trailing dot per Intl fr-FR); capitalized.
    // A fork that adds French as a third language gets correct month names
    // automatically — no hardcoded MONTH_NAMES entry to update.
    expect(formatYearMonth("2024-03", "fr")).toBe("Mars 2024");
    // August in French = "août" (with diacritic, no trailing dot).
    expect(formatYearMonth("2024-08", "fr")).toBe("Août 2024");
  });

  it("returns the raw input on bad format", () => {
    expect(formatYearMonth("not-a-date", "en")).toBe("not-a-date");
    expect(formatYearMonth("2024", "en")).toBe("2024");
    expect(formatYearMonth("", "en")).toBe("");
  });
});

describe("formatPeriod", () => {
  it("joins start and end with a dash", () => {
    expect(formatPeriod("2024-01", "2024-06", "en")).toBe("Jan 2024 - Jun 2024");
  });

  it("renders just the start when end is missing", () => {
    expect(formatPeriod("2024-01", undefined, "en")).toBe("Jan 2024");
    expect(formatPeriod("2024-01", "", "en")).toBe("Jan 2024");
  });

  it("handles cross-year periods", () => {
    expect(formatPeriod("2023-11", "2024-02", "es")).toBe("Nov 2023 - Feb 2024");
  });
});

describe("formatYear", () => {
  it("extracts the year from any reasonable date format", () => {
    expect(formatYear("2024")).toBe("2024");
    expect(formatYear("2024-03")).toBe("2024");
    expect(formatYear("2024-03-15")).toBe("2024");
  });

  it("returns the raw input when no leading year", () => {
    expect(formatYear("not-a-year")).toBe("not-a-year");
    expect(formatYear("")).toBe("");
  });
});

describe("postDateSegments", () => {
  it("splits a YYYY-MM-DD date", () => {
    expect(postDateSegments("2024-03-15")).toEqual({ year: "2024", month: "03" });
  });

  it("works with YYYY-MM (used by some collections)", () => {
    expect(postDateSegments("2024-03")).toEqual({ year: "2024", month: "03" });
  });

  it("returns undefined for non-conforming input", () => {
    expect(postDateSegments("2024")).toBeUndefined();
    expect(postDateSegments("invalid")).toBeUndefined();
    expect(postDateSegments("")).toBeUndefined();
  });
});

describe("formatLongDate", () => {
  it("formats a valid date in English", () => {
    // Localized output varies slightly across Node ICU bundles; assert the
    // pieces that must be present instead of pinning the exact string.
    const out = formatLongDate("2024-03-15", "en");
    expect(out).toMatch(/March/);
    expect(out).toMatch(/15/);
    expect(out).toMatch(/2024/);
  });

  it("formats a valid date in Spanish (Colombia)", () => {
    const out = formatLongDate("2024-03-15", "es");
    expect(out).toMatch(/15/);
    expect(out).toMatch(/2024/);
    expect(out.toLowerCase()).toMatch(/marzo/);
  });

  it("rejects out-of-range months", () => {
    expect(formatLongDate("2024-13-01", "en")).toBe("2024-13-01");
    expect(formatLongDate("2024-00-01", "en")).toBe("2024-00-01");
  });

  it("rejects out-of-range days", () => {
    expect(formatLongDate("2024-03-32", "en")).toBe("2024-03-32");
    expect(formatLongDate("2024-03-00", "en")).toBe("2024-03-00");
  });

  it("rejects dates that JS would silently roll over", () => {
    // 2024 is a leap year; Feb 30 is invalid. Without explicit validation,
    // `new Date(2024, 1, 30)` becomes March 1, which would silently mislead
    // readers about when something happened.
    expect(formatLongDate("2024-02-30", "en")).toBe("2024-02-30");
    // Non-leap-year Feb 29:
    expect(formatLongDate("2023-02-29", "en")).toBe("2023-02-29");
  });

  it("returns the raw input on malformed strings", () => {
    expect(formatLongDate("not-a-date", "en")).toBe("not-a-date");
    expect(formatLongDate("2024-03", "en")).toBe("2024-03"); // no day
    expect(formatLongDate("", "en")).toBe("");
  });

  it("accepts a full BCP-47 tag as well as a short code", () => {
    const a = formatLongDate("2024-03-15", "en-GB");
    expect(a).toMatch(/March/);
    expect(a).toMatch(/2024/);
  });
});
