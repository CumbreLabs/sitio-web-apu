import js from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";

export default tseslint.config(
  // `static/admin/sveltia-cms.js` is a vendored, minified CMS build (the
  // self-hosted Cumbre Labs fork), not our source — never lint it.
  { ignores: ["dist", ".svelte-kit", "docs", "static/admin/sveltia-cms.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  jsdoc.configs["flat/recommended-typescript"],
  {
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: true,
          },
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
            "ExportNamedDeclaration > TSTypeAliasDeclaration",
            "ExportNamedDeclaration > TSInterfaceDeclaration",
          ],
          checkConstructors: false,
        },
      ],
      "jsdoc/require-description": ["warn", { contexts: ["any"] }],
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-returns-description": "warn",
    },
  },
  {
    // Disable the strict require-jsdoc rule for components, scripts, routes,
    // and inner helpers — anything not part of the lib/* public API surface.
    files: ["**/*.svelte", "**/*.svelte.ts", "scripts/**", "src/routes/**"],
    rules: {
      "jsdoc/require-jsdoc": "off",
    },
  },
  {
    // For lib helpers: only require JSDoc on what's actually exported.
    // Nested functions like the `stash()` closure in renderInline are
    // implementation detail, not API.
    files: ["src/lib/**/*.ts"],
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: { FunctionDeclaration: false, ClassDeclaration: true },
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
            "ExportNamedDeclaration > TSTypeAliasDeclaration",
            "ExportNamedDeclaration > TSInterfaceDeclaration",
          ],
          checkConstructors: false,
        },
      ],
    },
  },
  {
    languageOptions: {
      globals: {
        console: "readonly",
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        history: "readonly",
        KeyboardEvent: "readonly",
        HTMLElement: "readonly",
        HTMLDialogElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLAnchorElement: "readonly",
        IntersectionObserver: "readonly",
        IntersectionObserverEntry: "readonly",
        Element: "readonly",
        MouseEvent: "readonly",
        URL: "readonly",
        process: "readonly",
        Buffer: "readonly",
      },
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // `{@html}` is intentionally used by MarkdownRenderer / SEO JSON-LD; content is built locally.
      "svelte/no-at-html-tags": "off",
      // resolve() requires generated route types; this site uses string-literal hrefs throughout.
      "svelte/no-navigation-without-resolve": "off",
      // Local Map/Set in `$derived` calculations are intentionally non-reactive containers.
      "svelte/prefer-svelte-reactivity": "off",
    },
  },
);
