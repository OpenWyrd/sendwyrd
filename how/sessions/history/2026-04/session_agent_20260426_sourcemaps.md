---
type: session
session_id: session_agent_20260426_sourcemaps
agent: agent_claude_opus_4_7
created: 2026-04-26
updated: 2026-04-26
status: completed
intent: Wire @sentry/cli source map upload into CI deploy workflow; release detection plumbed through SDKs
tier: 2
branch: worktree-agent-a44b5e1062a103884
tags: [observability, sentry, source-maps, ci, github-actions, privacy]
---

# Session — Sentry source-map upload in CI deploy

## Intent

Production stack traces show minified names (`o.A` instead of `composeWyrd`).
Wire `@sentry/cli sourcemaps inject + upload` into the deploy workflow so Sentry
can resolve them. Critical constraint: source maps must NEVER reach clients —
that would publish an unminified codebase to the world.

## Reconnaissance

| Source | Finding |
|--------|---------|
| `next.config.ts` | No `productionBrowserSourceMaps`; need to enable. |
| Next 15.5.15 schema (`config-schema.js`) | `productionBrowserSourceMaps: z.boolean().optional()` — **boolean only**, no `'hidden'` mode. So we must emit + delete, not emit-hidden. |
| `.next/static` after `next build` w/ flag | 22 `.map` files emitted alongside `.js` chunks. |
| `@opennextjs/cloudflare` build internals | Calls `buildNextjsApp(options)` itself in standalone mode → re-runs `next build`, so a prior `next build`'s output gets overwritten. `--skipNextBuild` requires standalone mode + would lose injected debug IDs anyway. |
| `.open-next/assets/_next/static` after OpenNext build | `.map` files copied in (also 22). This is what the worker actually serves (per `wrangler.jsonc` `assets.directory: ".open-next/assets"`). **Ground truth for what ships.** |
| Existing `SentryInit.tsx` | No `release` set. Needs `process.env.NEXT_PUBLIC_RELEASE`. |
| Existing `packages/api/src/index.ts` | No `release` set. Needs `env.SENTRY_RELEASE`. |
| `packages/api/src/env.ts` | Need to add `SENTRY_RELEASE?: string` to `Env` interface. |
| `packages/api/wrangler.toml` | No release var; will plumb via `wrangler deploy --var SENTRY_RELEASE:${GITHUB_SHA}` (CI runtime, no commit needed). |
| `npx --package=@sentry/cli sentry-cli --version` | Works; v3.4.0 fetches on demand. No global install needed. |

## CTO calls made

### 1. Hidden vs deleted source maps → **deleted** (strip after upload)

Next 15 only supports `productionBrowserSourceMaps: boolean` (no `'hidden'`).
So the only option is: emit maps → upload to Sentry → delete the `.map` files
+ strip the `//# sourceMappingURL=...` references from `.js` / `.css` files
before deploy. Defense in depth: the strip step is also a sanity check that
fails the deploy if any `.map` slipped through.

### 2. Where to inject + upload from → **`.open-next/assets/_next/static`**

OpenNext re-runs `next build` itself. Running `sentry-cli inject` against
`.next/static` before OpenNext's build would have its work overwritten.
Instead, build OpenNext first (which copies `.next/static` → `.open-next/
assets/_next/static`), then inject + upload + strip against the OpenNext
output. That's the ground truth for what ships, per `wrangler.jsonc`
`assets.directory`.

### 3. Web release tag → **`NEXT_PUBLIC_RELEASE: ${{ github.sha }}`**

Next inlines `NEXT_PUBLIC_*` env vars at build time. Set on both the `pnpm
build` step (turbo's web build) and the `opennextjs-cloudflare build` step
(OpenNext's internal `next build`) so the bundle contains the right release
ID regardless of which build's output ends up shipping.

### 4. API release tag → **`wrangler deploy --var SENTRY_RELEASE:<sha>`**

Three options were considered:
- `wrangler secret put SENTRY_RELEASE` in CI: requires interactive input
  (no `--value` flag for non-secret vars on `secret put`). Skipped.
- Commit `[vars] SENTRY_RELEASE = "auto"` to `wrangler.toml`, override at
  deploy time: workable but pollutes the static config. Skipped.
- **Pass `--var SENTRY_RELEASE:${GITHUB_SHA}` on `wrangler deploy`**:
  cleanest. Wrangler supports `--var KEY:VALUE` repeatable on the CLI as
  per its docs. Picked. No file changes, no commits, release ID lives in
  the CI run only.

### 5. `SENTRY_PROJECT_API` secret → set but unused for now

Set per the prompt's instruction; reserved for future use. The api worker
runs in Cloudflare Workers (V8 isolate), not as a browser bundle —
`@sentry/cli sourcemaps upload` is for browser-side source maps. Server-
side trace de-minification on Workers is a separate problem (Sentry's
`@sentry/cloudflare` SDK uses different mechanisms; out of scope for this
session).

### 6. `npx --package=@sentry/cli sentry-cli` (vs global install or
   workspace dep)

Per the prompt, prefer no postinstall scripts that could fail in CI. `npx
--package=@sentry/cli sentry-cli` lazily fetches the binary at first run
(observed: 3.4.0 downloaded in <1s during local verify). No package.json
changes; no global install; no postinstall risk.

## Files touched

### Modified

- `packages/web/next.config.ts` — added `productionBrowserSourceMaps: true`
  with explanatory comment pointing at the workflow.
- `packages/web/src/components/SentryInit.tsx` — read
  `process.env.NEXT_PUBLIC_RELEASE` and pass `release` to `Sentry.init`.
- `packages/api/src/env.ts` — added `SENTRY_RELEASE?: string` to `Env`.
- `packages/api/src/index.ts` — pass `release: env.SENTRY_RELEASE ||
  undefined` to `Sentry.withSentry` factory.
- `.github/workflows/deploy.yml` — added 3 new steps (Sentry upload, strip,
  re-ordered around OpenNext build); added `NEXT_PUBLIC_RELEASE` env var
  to both build steps; added `--var SENTRY_RELEASE:<sha>` to api deploy.

### Created

- `how/sessions/active/session_agent_20260426_sourcemaps.md` (this file).

## Workflow step order (final)

1. Checkout / pnpm / Node / install
2. Typecheck
3. `pnpm build` (turbo, with `NEXT_PUBLIC_RELEASE`)
4. **Deploy api worker** with `--var SENTRY_RELEASE:${{ github.sha }}`
5. **OpenNext build** (with `NEXT_PUBLIC_RELEASE`) — re-runs `next build`,
   emits `.next/static/*.map`, copies to `.open-next/assets/_next/static`
6. **Sentry sourcemaps inject + upload** against
   `.open-next/assets/_next/static`
7. **Strip `.map` + `sourceMappingURL` refs** from
   `.open-next/assets/_next/static`; fails the deploy if any survive
8. Deploy web worker (`opennextjs-cloudflare deploy`)
9. Smoke test (e2e against production)

## GitHub secrets set (from /tmp shell, NOT committed)

```bash
cd /tmp
gh secret set SENTRY_AUTH_TOKEN --repo openwyrd/sendwyrd --body "$(cat ~/.config/sentry/auth_token)"
gh secret set SENTRY_ORG --repo openwyrd/sendwyrd --body "sendwyrd"
gh secret set SENTRY_PROJECT_WEB --repo openwyrd/sendwyrd --body "sendwyrd-web"
gh secret set SENTRY_PROJECT_API --repo openwyrd/sendwyrd --body "sendwyrd-api"
```

Verified via `gh secret list --repo openwyrd/sendwyrd`:

```
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN       (new)
SENTRY_ORG              (new)
SENTRY_PROJECT_API      (new, reserved for future)
SENTRY_PROJECT_WEB      (new)
```

## Verification

| Check | Result |
|-------|--------|
| `pnpm typecheck` (full turbo) | 4/4 pass, FULL TURBO |
| `pnpm --filter @sendwyrd/web typecheck` (cache-busted) | pass |
| `pnpm --filter @sendwyrd/api typecheck` (cache-busted) | pass |
| `pnpm --filter @sendwyrd/web build` | pass; 22 `.map` files emitted in `.next/static/` |
| `pnpm --filter @sendwyrd/web exec opennextjs-cloudflare build` | pass; `.open-next/assets/_next/static` contains 22 `.map` files |
| Strip step (local sim) on `.open-next/assets/_next/static` | 22 → 0 `.map`, 0 `sourceMappingURL` refs left |
| `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"` | parses cleanly; 12 steps in correct order |
| `npx --package=@sentry/cli sentry-cli --version` | 3.4.0 fetches and runs |

Did NOT trigger the workflow (per task constraints). Did NOT push remote.

## Constraint compliance

- No remote push (orchestrator handles).
- Workflow not triggered.
- No Sentry config changes outside source-map upload wiring.
- `gh secret set` commands run from `/tmp` (NOT inside the worktree).
- Secrets stored on GitHub, not in the repo.
- `npx --package=@sentry/cli sentry-cli` avoids global install /
  postinstall risk.

## SITREP

**Completed**
- `productionBrowserSourceMaps: true` in `next.config.ts`.
- Sentry source-map upload step + strip step wired into `deploy.yml`,
  positioned correctly (after OpenNext build, before web deploy).
- Source-map deletion verified: shipped bundle contains zero `.map` files
  and zero `sourceMappingURL` references after the strip step.
- Release ID plumbed: web reads `process.env.NEXT_PUBLIC_RELEASE` (build-
  inlined); api reads `env.SENTRY_RELEASE` (Worker var, set at deploy via
  `wrangler deploy --var`).
- Four GitHub secrets set: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
  `SENTRY_PROJECT_WEB`, `SENTRY_PROJECT_API`.
- Typecheck green; web build green; OpenNext build green; YAML parses;
  local end-to-end pipeline simulation green.

**In progress**
- None.

**Next up**
- Orchestrator pushes worktree branch and opens PR.
- After merge, the next push to `main` triggers the auto-deploy. Watch the
  Actions tab for the "Upload web source maps to Sentry" step output —
  expect `sentry-cli` to report N artifacts uploaded with the release SHA.
- Force a known client-side error in production (e.g. uncaught throw in a
  client component) and confirm Sentry shows the unminified function name
  instead of `o.A` shapes.

**Blockers**
- None.

**Files touched**
- Modified: `packages/web/next.config.ts`
- Modified: `packages/web/src/components/SentryInit.tsx`
- Modified: `packages/api/src/env.ts`
- Modified: `packages/api/src/index.ts`
- Modified: `.github/workflows/deploy.yml`
- Created: `how/sessions/active/session_agent_20260426_sourcemaps.md`
  (will be moved to `how/sessions/history/2026-04/` at session close)

## Next Session Prompt

Sentry source-map upload is wired into `.github/workflows/deploy.yml`. On
push to `main`, the workflow now: builds turbo with `NEXT_PUBLIC_RELEASE`
set to `${{ github.sha }}`, deploys api with `--var SENTRY_RELEASE:<sha>`,
runs OpenNext (which copies `.next/static` to `.open-next/assets/_next/
static`), runs `sentry-cli sourcemaps inject + upload` against the
OpenNext output, strips `.map` files + `sourceMappingURL` refs from that
output (failing the deploy if any slip through), then deploys the web
worker. Source maps go to Sentry only — never to clients. Web SDK reads
release from `NEXT_PUBLIC_RELEASE` (build-inlined); api SDK reads from
`env.SENTRY_RELEASE` (Cloudflare Worker var). Four GitHub secrets are now
set: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_WEB`,
`SENTRY_PROJECT_API` (last one is reserved; the api worker doesn't have
browser-style source maps to upload — see CTO call 5). `@sentry/cli` is
fetched on demand via `npx --package=@sentry/cli sentry-cli` so there's
no global install or postinstall risk. To verify after merge: watch the
Actions run for `sentry-cli` artifact-upload output, then force a known
client-side error in production and confirm the Sentry dashboard shows
the unminified function name.
