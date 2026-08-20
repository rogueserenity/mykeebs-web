# mykeebs-web

A read-only browsing UI for [kbdb](https://github.com/rogueserenity/kbdb) — a personal mechanical
keyboard collection tracker (keyboards, switches, keycap sets, and the builds that combine them).

Built with SvelteKit as a static SPA, authenticated via WorkOS AuthKit against the same identity
kbdb's REST API already trusts, and styled with Skeleton UI. See [`DESIGN.md`](./DESIGN.md) for the
reasoning behind these choices.

## Prerequisites

- [mise](https://mise.jdx.dev/) (manages the Node version; see `mise.toml`)
- [gh CLI](https://cli.github.com/), authenticated, with the `read:packages` scope (needed to
  install `@rogueserenity/kbdb-api-client` from GitHub Packages):

  ```sh
  gh auth refresh -h github.com -s read:packages
  mise set GITHUB_PACKAGES_TOKEN=$(gh auth token) --file mise.local.toml
  ```

## Setup

```sh
cp .env.example .env   # fill in PUBLIC_WORKOS_CLIENT_ID / PUBLIC_KBDB_API_BASE_PATH
eval "$(mise env)"
npm install
```

## Developing

```sh
npm run dev
# or: npm run dev -- --open
```

## Building

```sh
npm run build
```

Produces a static build in `/build` (adapter-static). Preview it with `npm run preview`. Deploys to
Cloudflare Pages; `PUBLIC_WORKOS_CLIENT_ID` is set per-environment (Production vs. Preview) in the
Cloudflare Pages dashboard rather than committed.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the day-to-day workflow (lint, typecheck, tests).
