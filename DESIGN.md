# kbdb frontend — design & stack notes

Working notes for the SvelteKit frontend, written before the repo existed.
Kept here as the initial basis of knowledge for this repo.

## Context

kbdb's REST API + MCP server are working end-to-end (verified via
`kbdb-dev` MCP tools: list/get across keyboards, switches, keycap sets,
builds, lookups). The next piece is a UX layer on top of the REST API.
A generated, versioned TypeScript client (`@rogueserenity/kbdb-api-client`,
published to GitHub Packages on every kbdb release) already exists for
this frontend to consume as a normal dependency — see kbdb's
`.github/workflows/publish-clients.yml`.

## Decisions made

- **Framework: SvelteKit**, `adapter-static` (pure SPA, no server runtime).
  - Why: read-only app to start, no server secrets to hide (WorkOS AuthKit
    uses PKCE — safe in a public/browser client), independently deployable
    from the Go/Lambda backend. SvelteKit's file-based routing and
    conventions reduce the number of frontend-architecture decisions a
    backend-first dev has to make from scratch (vs. plain Vite or React,
    where "how do I fetch/cache data" has many competing answers with no
    prior instinct to pick between).
- **Hosting: Cloudflare Pages.**
  - Why: already using Cloudflare for DNS; free tier comfortably covers a
    personal static SPA (unlimited requests/bandwidth, 500 builds/month);
    consolidates hosting + DNS in one dashboard instead of splitting
    across Render + Cloudflare.
- **Auth: WorkOS AuthKit**, reusing the existing OIDC setup kbdb's REST API
  already trusts (same `client_id`s — Staging `client_01M03Y9NBQB88HBSR8F50R1B2B`,
  Production `client_01M03Y9NRSFS3WT2ESNN786M4W`). PKCE flow, no new
  identity system.
- **Scope for v1: read-only browse.** List/view keyboards, switches,
  keycap sets, builds (own + others' public). No create/edit/delete forms
  yet — MCP (via Claude) is already the write path short-term, so the UI
  doesn't need to duplicate it before the read-side UX is proven out.
- **API client: generated, not hand-written.** Full `openapi-generator`
  TypeScript client (`typescript-fetch`), not a types-only/hand-rolled
  fetch layer — chosen so request/response handling, not just types, is
  generated, since hand-writing fetch/error-handling conventions isn't
  something to improvise as a first frontend project.
- **UI component library: Skeleton UI.**
  - Why (vs. shadcn-svelte, the other leading option): shadcn-svelte's
    model is "generate component source into your project, own it" — more
    control, but also more decisions land on you (styling details, a11y
    edge cases) with less of a guiding system. Skeleton UI is Svelte-native
    (not a ported design), ships a real design system (design tokens,
    premade themes, a Figma UI kit), and gives more guardrails — a better
    fit given the explicit goal of minimizing frontend-design decisions
    rather than maximizing control over them.
  - Approach: pick one of Skeleton's built-in themes as a starting point
    (don't design colors/typography from scratch); let the data shape the
    layout — a keyboard/switch/build collection is naturally a card-grid +
    detail-page pattern, so build real pages against real data rather than
    mocking up visuals in the abstract first.

## Open / not yet decided

- Which specific Skeleton theme to start from — `cerberus` wired in as a
  placeholder (Skeleton's own docs example) to get the app running; not a
  considered final choice.
- Exact page/route structure (list + detail per entity is the working
  assumption, not yet laid out).
- Whether/when to revisit CRUD forms in the UI vs. staying MCP-only for
  writes.
