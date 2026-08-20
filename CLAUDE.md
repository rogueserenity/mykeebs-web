# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `DESIGN.md` for the design decisions and rationale behind the stack choices below.

## Commands

```sh
npm run dev              # start dev server
npm run build             # production build (adapter-static output to /build)
npm run preview            # preview the production build

npm run check              # svelte-kit sync + svelte-check (typecheck)
npm run check:watch

npm run lint               # prettier --check . && eslint .
npm run format              # prettier --write .

npm run test               # vitest run (both client and server projects)
npm run test:unit           # vitest in watch mode
```

To run a single test file: `npx vitest run path/to/file.test.ts` (or `.svelte.test.ts` for a component test). To run tests matching a name: `npx vitest run -t "test name"`.

Env vars (`PUBLIC_WORKOS_CLIENT_ID`, `PUBLIC_KBDB_API_BASE_PATH`) are read via SvelteKit's `$env/static/public`, so any command that boots Vite (dev, build, check, test) needs a `.env` present — copy `.env.example` and fill in values. `npm run check` and `npm run build` will fail with an unhelpful Vite error if `.env` is missing or missing a key.

Installing/updating `@rogueserenity/kbdb-api-client` requires a GitHub Packages token in the environment. `mise.toml` documents this — the token itself lives in `mise.local.toml` (gitignored, not committed) as `GITHUB_PACKAGES_TOKEN`. Run `eval "$(mise env)"` before `npm install` if the token isn't already in your shell env.

## Architecture

This is a **pure client-side SPA** — `adapter-static` with `fallback: 'index.html'` (configured inline in `vite.config.ts`, not a separate `svelte.config.js`). There is no server runtime in production: no `+page.server.ts`/`+layout.server.ts` load functions, no API routes under `src/routes/api`. All data fetching and auth happens client-side. Despite this, `vite dev` and `svelte-check` still perform SSR of the initial render — code that touches `window`/`document` at module- or component-init time will crash server-side unless guarded (e.g. via Svelte's `onMount`, which only runs client-side).

**Auth**: `src/lib/auth/client.ts` wraps `@workos-inc/authkit-js`'s `createClient` in a lazily-created singleton (PKCE flow, no server secrets). `src/lib/auth/auth.svelte.ts` exposes this as Svelte 5 rune-based reactive state (`auth.status`, `auth.user`) plus `signIn`/`signUp`/`signOut`/`getAccessToken`. `initAuth()` must be called once per page load — it's wired into the root `+layout.svelte` inside `onMount`. The redirect target is `/auth/callback` (`src/routes/auth/callback/+page.svelte`), which re-calls `initAuth()` to let AuthKit consume the `?code=` param, then navigates home.

**API client**: `src/lib/api/client.ts` instantiates the generated (`openapi-generator` `typescript-fetch`) `@rogueserenity/kbdb-api-client` classes (`BuildsApi`, `KeyboardsApi`, `KeycapSetsApi`, `LookupsApi`, `SwitchesApi`), all sharing one `Configuration` whose `accessToken` is the auth module's `getAccessToken` function — the generated client calls this per-request, so token refresh is transparent and nothing else needs to inject headers manually. This client is generated from kbdb's OpenAPI spec and published to GitHub Packages on every kbdb release; don't hand-edit anything under `node_modules/@rogueserenity/kbdb-api-client` — bump the version in `package.json` instead when the API changes.

**Testing**: `vite.config.ts` defines two vitest projects sharing one config: a `client` project (browser-mode, Playwright+Chromium, for `*.svelte.test.ts` — real component rendering) and a `server` project (Node environment, for plain `*.test.ts`, excluding anything under `src/lib/server/`). Match the existing naming convention (`Foo.svelte.spec.ts` for component tests, `foo.spec.ts` for plain unit tests) so a new test lands in the right project automatically.

**Styling**: Tailwind v4 (via `@tailwindcss/vite`, no `tailwind.config.js`) + Skeleton UI (`@skeletonlabs/skeleton` + `@skeletonlabs/skeleton-svelte`). Theme is currently `cerberus` (a placeholder, not a final choice — see `DESIGN.md`). Global styles/theme setup live in `src/routes/layout.css`, imported once from the root `+layout.svelte`.
