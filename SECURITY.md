# Security Policy

## Reporting a vulnerability

This site is a personal portfolio + content site for Gonzalo Peña-Castellanos. It is
a static SvelteKit build deployed to GitHub Pages (no server, no database, no user
accounts, no forms accepting input). The realistic attack surface is small but
not zero — supply-chain compromise of the npm tree, the Sveltia CMS bundle, or
the GitHub OAuth worker would still be impactful.

If you've found something, please **email** [goanpeca@gmail.com](mailto:goanpeca@gmail.com) with:

- A clear description of the issue and the path to reproduce it.
- The build / commit SHA you were testing against (visible at the bottom of the
  page footer or in the GitHub repo).
- If you have a CVE / advisory link for an underlying dep, include it.

**Please do not open a public GitHub issue for security reports.** Use email
first. We'll acknowledge within 7 days and aim to ship a fix (or document a
workaround) within 30 days for genuine findings.

## What is in scope

- The site's own code in this repo (`src/`, `scripts/`, `static/`).
- The `static/admin/` Sveltia CMS bundle — version is pinned and SRI-hashed,
  so a CDN compromise of that exact pinned URL is in scope.
- The CSP, GTM consent flow, and the cookie banner storage handling.

## What is out of scope

- The Cloudflare Worker that handles the Sveltia CMS GitHub OAuth callback —
  it lives in a separate repo and has its own disclosure policy.
- Google Tag Manager / Google Analytics behavior — report directly to Google.
- Issues in third-party content the site links to (external posts, YouTube
  embeds, etc.).
- Best-practice nits that don't map to a concrete vulnerability (e.g. "you
  should use HSTS preload" — agreed, but it's a hosting-level limitation, not
  an issue in this codebase).

## Hardening already in place

For reference, the site already ships with:

- Content Security Policy (meta tag) restricting third-party origins to GTM
  and youtube-nocookie. `'unsafe-inline'` is required for Svelte's scoped
  styles + the FOUC/GTM bootstrap; nonces would require SSR.
- GDPR cookie consent (default-deny, GTM only fires after explicit accept).
- SRI hash on the Sveltia CMS script tag (defense-in-depth alongside version
  pinning).
- All `target="_blank"` paired with `rel="noopener noreferrer"`.
- YouTube embeds via `youtube-nocookie.com` + `referrerpolicy="no-referrer"`.
- Markdown rendering sanitizes link `href` schemes (only http/s, mailto, tel,
  relative) and strips `<script>` / `on*=` / `javascript:` / unsafe `data:`.
- `localStorage` reads + writes wrapped in `try/catch` (Safari Private Mode
  safety).
- `npm audit` clean on every CI run; Dependabot opens weekly PRs for both npm
  and GitHub Actions versions.
