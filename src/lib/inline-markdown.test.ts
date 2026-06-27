import { describe, it, expect } from "vitest";
import { renderInline, renderBlock } from "./inline-markdown";

// The inline renderer is intentionally small — it ONLY handles the markdown
// features that footer copyright / bio / hero subtitles use: bold, italic,
// inline code, links, and (for `renderBlock`) paragraph breaks on blank
// lines. Anything more (headings, lists, code fences, images) should live
// in an `.md` file and route through the build-time `virtual:rendered-pages`
// plugin. These tests pin the contract.

describe("renderInline — basic formatting", () => {
  it("renders bold and italic", () => {
    expect(renderInline("**bold**")).toBe("<strong>bold</strong>");
    expect(renderInline("__bold__")).toBe("<strong>bold</strong>");
    expect(renderInline("*italic*")).toBe("<em>italic</em>");
    expect(renderInline("_italic_")).toBe("<em>italic</em>");
  });

  it("renders inline code", () => {
    expect(renderInline("see `foo()`")).toBe("see <code>foo()</code>");
  });

  it("escapes special characters inside inline code", () => {
    expect(renderInline("`<script>`")).toBe("<code>&lt;script&gt;</code>");
  });

  it("preserves plain text without markup", () => {
    expect(renderInline("just text")).toBe("just text");
  });
});

describe("renderInline — links (the null-byte stash invariant)", () => {
  it("renders a plain external link with target=_blank + rel=noopener", () => {
    expect(renderInline("[label](https://example.com)")).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">label</a>',
    );
  });

  it("renders a relative link without target=_blank", () => {
    expect(renderInline("[About](/about/)")).toBe('<a href="/about/">About</a>');
  });

  it("renders mailto / tel links without target=_blank", () => {
    expect(renderInline("[Email](mailto:a@b.com)")).toBe('<a href="mailto:a@b.com">Email</a>');
    expect(renderInline("[Call](tel:+57300)")).toBe('<a href="tel:+57300">Call</a>');
  });

  it("downgrades unsafe schemes to href=#", () => {
    // javascript: / vbscript: / data: URIs can carry executable payloads —
    // collapse them so a maintainer typo can't ship a clickable XSS vector.
    expect(renderInline("[x](javascript:foo)")).toBe('<a href="#">x</a>');
    expect(renderInline("[x](vbscript:foo)")).toBe('<a href="#">x</a>');
  });

  it("handles **[link](url)** without the emphasis pass eating the anchor", () => {
    // This is the null-byte stash invariant. Naive regex order would try to
    // bold-wrap `[**link**](url)` and produce garbage like
    // `<strong><a … target=</strong>_blank` …`. Stashing links out first
    // keeps the inner formatting intact.
    expect(renderInline("**[click](https://example.com)** and *more*")).toBe(
      '<strong><a href="https://example.com" target="_blank" rel="noopener noreferrer">click</a></strong> and <em>more</em>',
    );
  });
});

describe("renderBlock — paragraphs", () => {
  it("wraps each paragraph in <p>", () => {
    const out = renderBlock("First paragraph.\n\nSecond paragraph.");
    expect(out).toBe("<p>First paragraph.</p>\n<p>Second paragraph.</p>");
  });

  it("applies inline formatting inside each paragraph", () => {
    const out = renderBlock(
      "Hello **bold** world.\n\nVisit [our site](https://example.com) for more.",
    );
    expect(out).toBe(
      "<p>Hello <strong>bold</strong> world.</p>\n" +
        '<p>Visit <a href="https://example.com" target="_blank" rel="noopener noreferrer">our site</a> for more.</p>',
    );
  });

  it("collapses runs of blank lines into a single split", () => {
    // Editors sometimes leave double blank lines between paragraphs.
    const out = renderBlock("A\n\n\nB");
    expect(out).toBe("<p>A</p>\n<p>B</p>");
  });

  it("returns empty string for empty input", () => {
    expect(renderBlock("")).toBe("");
    expect(renderBlock("   ")).toBe("");
  });

  it("drops paragraphs that are only whitespace", () => {
    expect(renderBlock("A\n\n   \n\nB")).toBe("<p>A</p>\n<p>B</p>");
  });
});
