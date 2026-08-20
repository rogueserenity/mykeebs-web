# Contributing

## Workflow

```sh
npm run check     # typecheck (svelte-kit sync + svelte-check)
npm run lint       # prettier --check . && eslint .
npm run format      # prettier --write .
npm run test       # vitest run
```

Run `npm run lint` and `npm run test` before opening a PR. `npm run format` will fix most lint
formatting complaints automatically; ESLint errors need manual fixes.

## Tests

Two vitest projects share `vite.config.ts`:

- `*.svelte.spec.ts` — component tests, run in real headless Chromium via
  `vitest-browser-svelte`/Playwright.
- `*.spec.ts` (not matching the above) — plain unit tests, run in Node.

Name new test files to match whichever project they belong in. Run a single file with
`npx vitest run path/to/file.spec.ts`, or filter by name with `npx vitest run -t "test name"`.

## Conventions

- Tabs, single quotes, no trailing commas, 100-char print width — enforced by Prettier
  (`prettier.config.js`); don't hand-format against it.
- Svelte 5 runes mode is forced project-wide (see `vite.config.ts`'s `compilerOptions.runes`).
- Env vars are read via `$env/static/public` — anything new needs a `PUBLIC_` prefix to be exposed
  to client code, and should be added to `.env.example` alongside the real `.env`.
- This is a pure SPA (`adapter-static`, no server routes) — but `vite dev` and `svelte-check` still
  perform SSR of the initial render. Code that touches `window`/`document` outside of `onMount` (or
  an equivalent client-only guard) will crash server-side even though it never actually runs on a
  server in production.

## Installing `@rogueserenity/kbdb-api-client`

This package is generated from kbdb's OpenAPI spec and published to GitHub Packages on every kbdb
release — it's not hand-written, so don't patch it in `node_modules`; bump the version in
`package.json` instead when the API changes.

Installing or updating it requires a GitHub Packages read token in your environment
(`GITHUB_PACKAGES_TOKEN`, referenced from `.npmrc`). One-time setup per machine:

```sh
gh auth refresh -h github.com -s read:packages
mise set GITHUB_PACKAGES_TOKEN=$(gh auth token) --file mise.local.toml
```

This value is a snapshot of `gh`'s token at the time you run it — if that token is later refreshed
or rotated, re-run the `mise set` line. `mise.local.toml` is gitignored; never commit a token.
