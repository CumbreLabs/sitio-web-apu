// `$app/environment` only exists when SvelteKit's runtime is loaded. Vitest
// runs in plain Node, so we alias the import to this tiny stub (see
// `vitest.config.ts`). Defaults match a production-built client. Tests that
// need to flip `dev: true` (e.g. the dev-only reroute hook) use
// `vi.mock("$app/environment", () => ({ dev: true }))` at the top of the
// spec file to override per test.
export const dev = false;
export const browser = false;
export const building = false;
