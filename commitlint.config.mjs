/**
 * Commitlint configuration — enforces Conventional Commits format on every
 * commit via the `.husky/commit-msg` hook. Mirrors the convention CLAUDE.md
 * already documents ("≤ 72 char subject, imperative mood, lowercase after
 * the colon, no trailing period") so the hook locks in what we already
 * write manually.
 *
 * Allowed subject prefixes (the `type-enum`): `feat`, `fix`, `refactor`,
 * `perf`, `docs`, `chore`, `test`, `style`, `build`, `ci`, `revert`.
 *
 * Subject length cap is 72 chars (CLAUDE.md's documented ceiling for
 * GitHub commit-list UI). Anything longer rejects with a clear error.
 *
 * To bypass once (e.g. for a hotfix that legitimately needs a longer
 * subject), use `git commit --no-verify`. CI doesn't re-validate commit
 * messages so the bypass is local-only.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 72],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "refactor",
        "perf",
        "docs",
        "chore",
        "test",
        "style",
        "build",
        "ci",
        "revert",
      ],
    ],
  },
};
