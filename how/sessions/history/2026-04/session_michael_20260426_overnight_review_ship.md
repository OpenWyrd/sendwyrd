---
type: session
created: 2026-04-26
updated: 2026-04-26
status: completed
last_edited_by: agent_operator
tags: [session, ship, tier-1, tier-2, pwa, sentry, dashboard, ops, manifesto, agents]
---

# Session — Overnight review, ship, observability, ops, agent-friendliness

## Goal

Review and merge the five overnight branches produced 2026-04-25 (T1 spec sync, T2 burn UI, T3 HD recovery, integration, T5 PWA), then ship Tier-2 + close real-user-friction loops + open the system for agent builders. Originally scoped for an hour or two; expanded to ~12 hours of continuous shipping under "do all" / "stop asking questions" / "trust your gut and merge what's ready" mode.

## What shipped (24 PRs merged to main)

### Overnight review + Tier-1 close
- `t1-spec-sync` — spec v1.0.1-draft sync (handle client-generated, ttl=0 permanent, reply caps 300/2500)
- `t2-burn-ui` — author-only burn affordance on view + inbox (K_origin_pub-matched, two-stage confirm, inline tombstone)
- `t3-hd-recovery` — presence-check API + mnemonic-import sweep flow
- `integration-overnight-2026-04-25` — single PR collapsing T1+T2+T3, conflicts resolved, smoke green
- `t5-pwa-hardening` — manifest, manual SW (no plaintext cache, no push), install prompt, persistent-storage UI, iOS meta tags, honesty copy
- e2e smoke verified all four scripts green against production after each deploy

### Architecture pivot (CEO call)
- `architecture-single-form` (ADR-021) — collapsed two-form to single canonical form (fragment only). Public path-form removed (replaced with client-side redirect for legacy URLs). PrivacyIndicator monomorphic. OG/SEO removed by design — link previews on social platforms deliberately do NOT unfurl.
- ADR-004 marked superseded; ADR-019 marked amended.
- VISION updated: Use Case 1 (Cross-post canonical URL) explicitly notes recipients see bare URL, must visit to read. The protocol refuses the algorithmic-feed surface.

### Tier-2: CI / observability / tests
- `b-ci-deploy` — GitHub Actions auto-deploy on push to `main` (typecheck → build → deploy api → deploy web → e2e smoke). `cancel-in-progress: false` for serialized prod deploys.
- `c-sentry` — `@sentry/browser` (web) + `@sentry/cloudflare` (api) with §16 redaction (URL fragments, auth headers, request bodies, 43-char b64u patterns scrubbed). Skipped `@sentry/nextjs` due to OpenNext incompat (issue #756).
- `sourcemaps-upload` — sentry-cli inject + upload after web build, then strip step deletes `.map` files before client deploy. Source maps go to Sentry, never to clients. Release tag = git SHA on both web (`NEXT_PUBLIC_RELEASE`) and api (`--var SENTRY_RELEASE`).
- `d-core-tests` — vitest on `packages/core`: 142 tests, 95.66% line coverage, zero bugs surfaced. Independently re-derived every spec-defined byte layout.
- `e-web-tests` — vitest + jsdom + react-testing-library on `packages/web`: 103 tests across components/lib/integration. Hand-rolled mocks (no MSW). Real WebCrypto in jsdom for crypto round-trips.

### Spec patches
- `a-spec-patch` — six surfaced drift points fixed (v1.0.3-draft): published_at client-asserted, §15 empty-list 200/empty-array, X-Mop-Auth canonical format §14.2.1, gone_at:null semantics, K_read non-derivability §5.5, signature_invalid 422 disambiguation §17.
- `spec-codepoint-url-exclusion` — §8.2 refined: URLs excluded from 300-codepoint cap; cap is a *prose* budget (v1.0.4-draft).

### Public-facing copy
- `share-affordance` — small "share" text-link on `/w/[handle]` view page (Web Share API mobile, clipboard fallback desktop, prompt() last-ditch). Closes a real user-surfaced UX gap.
- `about-page` — /about route with 6-point manifesto + "Hyperlinks for conversation" h1 + Compose CTA. README mirrored as front-door manifesto. Landing pull-quote: "Intent and action over theatrical consensus. Depth over breadth."
- `about-architecture` — extended /about with Architecture (no identity primitives), Cryptography, Brittleness (K_read non-derivability contract), Why not Nostr (identity-first vs capability-first; broadcasting vs ephemeral handoff), Stack. README mirrored.
- `twitter-attribution` — replaced GitHub repo source link with `@deltaclimbs` Twitter (user not an active developer; repo link is content-not-identity).
- `landing-install-and-yc-removal` — InstallAffordance client component below Compose CTA (Chromium native prompt OR iOS Add-to-Home-Screen hint, hides if installed). YC dropped from specimen wyrd; cap-table topic preserved.
- `build-page` — new `/build` route documenting wire spec + reference TS impl + endpoints + agent notes + roadmap (npm publish, OpenAPI, Python SDK, MCP server all deferred) + anti-roadmap (server-side compose, API keys, push — VISION violations). Linked from /about Stack.

### Ops dashboard (substantial)
- `ops-dashboard` — capability-gated `/ops/{secret}` server-rendered dashboard. Pulls live from Sentry REST API (issues), Postgres (volume metrics), and Cloudflare GraphQL Analytics (edge metrics). Auto-refreshes every 30s. Auth token stash at `~/.config/sentry/auth_token`.
- `ops-usage-stats` — `GET /api/v1/admin/stats` endpoint on api worker (bearer-auth, OPS_DASH_SECRET). Postgres aggregates: wyrds (total/24h/7d/active/burned/expired), replies (total/24h/7d).
- `ops-edge-analytics-and-secrets-page` — Cloudflare GraphQL httpRequests1hGroups for last-24h edge metrics (distinct IPs, page views, requests, bytes). Plus `/ops/{secret}/secrets` form + server action: paste worker secret name+value, server action calls Cloudflare API. No more chat round-trips for secrets.
- `release-as-number-and-bot-caveat` — dashboard shows `#N · short-sha` (run number from CI) instead of just hex SHA. Edge caveat updated honestly: bot scoring is paid-only on Cloudflare; the IP count includes CI runners + crawlers + scanners + probes. Real human-action signal is in the usage section.

### Bug fixes that landed mid-session
- `fix-strip-step` — source-map strip step was dying silently on the runner. Split security-critical .map deletion (strict) from cosmetic sed (best-effort + `|| true`).
- `fix-cf-analytics-iso-format` — datetime regex was producing `2026-04-26T19:23:00:00Z` (extra colon-pair). Fixed with `setUTCMinutes(0,0,0)` + millis strip.
- `fix-cf-analytics-orderby` — `orderBy: [datetime_DESC]` referenced a non-projected field. Removed; we aggregate, order doesn't matter.

### External provisioning (user-side)
- Sentry org `sendwyrd` created with two projects (`sendwyrd-web`, `sendwyrd-api`); both DSNs wired and live.
- Sentry user auth token rotated to one with `event:read` scope (the issues endpoint specifically requires this beyond `project:read`).
- Cloudflare scoped read-only Zone Analytics token created via UI (existing deploy token couldn't programmatically create scoped tokens — `User:User Tokens:Edit` not held).

## SITREP

### Completed
- All five overnight branches reviewed, merged, deployed, smoke-tested green.
- Architecture pivot to single-form addressing (ADR-021) shipped end-to-end, with legacy redirect preserving in-the-wild public-form URLs.
- Tier-2 closed: CI auto-deploy, Sentry observability with redaction + source maps + release tagging, 245 tests with zero bugs surfaced.
- Public manifesto published at /about (philosophy + architecture + crypto + brittleness + Nostr comparison + stack). README mirrors.
- Custom ops dashboard live at `/ops/{secret}` with health, usage (Postgres aggregates), edge (Cloudflare analytics), recent issues (Sentry), build, deploy number. Capability-URL-gated.
- Secrets-entry page at `/ops/{secret}/secrets` for setting Cloudflare Worker secrets without chat round-trips.
- /build page documents the API for agents and builders.
- Spec at v1.0.4-draft (8 total drift points patched today).
- Repo cleaned: only `main` on origin, only `main` worktree locally.

### In progress
- Final deploy of /build page (in flight at session-close time).

### Outstanding follow-ups (NOT in scope this session)
- **DDoS audit, owed**: Cloudflare automatic L3/L4 protection is on (free tier). NO application-level per-IP rate limiting in the api worker despite ADR-013's "edge + per-IP rate-limits + size caps; no PoW" directive. Body/reply size caps are enforced. Cloudflare WAF rate limiting requires Pro plan ($20/mo). Lowest-effort path forward: implement KV-based per-IP rate limiter in api worker (~1 day, free).
- **Bot vs human split on edge analytics**: Cloudflare botScore field requires Pro plan ("zone does not have access to the field 'botscore'"). Caveat documented on dashboard; real human-action signal is wyrds/replies count, not IP count.
- **`@sendwyrd/core` npm publish** — currently a workspace-private package. Documented at /build as roadmap. Requires user to set up @sendwyrd npm org + login.
- **Python SDK** — not built. Documented at /build as roadmap.
- **OpenAPI generation from wire spec** — not built. Documented at /build as roadmap.
- **MCP server for SendWyrd** — not built. Documented at /build as roadmap. Highest-leverage agent integration if the user wants to push agent ecosystems further.
- **Cloudflare org-level analytics token** — currently using a user-scoped read-only token. Org auth token would survive user-account changes; consider for production hardening.
- **Sentry auth token in worker env** — current token is user-scoped (sntryu_*) with full account permissions. Org auth token with read-only scopes would be the production-correct rotation. Documented as security debt.
- **Per-IP rate limiting** — per ADR-013, deferred. KV-based implementation candidate.
- **Defensive domain registrations** — explicitly declined by user this session.

### Blockers
None.

## Files Touched

Across 24 PRs: `packages/web/**`, `packages/api/**`, `packages/core/**`, `.github/workflows/deploy.yml`, `what/docs/spec/spec_mop_v1.md`, `what/docs/spec/visual_direction_v1.md`, `what/decisions/adr_004_*.md`, `what/decisions/adr_019_*.md`, `what/decisions/adr_021_*.md` (new), `who/governance/VISION.md`, `README.md`, `pnpm-lock.yaml`, `.gitignore`, plus session files in `how/sessions/history/2026-04/`.

Memory updated: `~/.claude/projects/-home-operator-lattice-sendwyrd/memory/project_sendwyrd_v1_live.md` reflects the end-of-session state.

## Decisions (CTO calls made by agent)

- Single integration PR for T1+T2+T3 (vs three sequential) — chose merge-commit strategy to preserve per-unit attribution
- Skipped `@sentry/nextjs` for OpenNext incompat → lighter `@sentry/browser` direct integration
- Source maps deleted (not hidden) from deploy artifact since Next 15 has no `'hidden'` mode; sed strip is best-effort with `|| true`, .map deletion is the security gate
- `@sentry/cli` via `npx --package=` (lazy fetch, no global install)
- Wrangler `--var SENTRY_RELEASE:${SHA}` for api release tag (cleaner than wrangler secret put, which is interactive)
- Hidden vs deleted maps → deleted; wire-spec strip-step gate is non-negotiable
- Concurrency on deploy.yml: `cancel-in-progress: false` so in-flight deploys finish before next runs
- /api route name → renamed to /build because `sendwyrd.com/api/*` is owned by the api worker
- Bot management caveat → honest docs over silent skip (free tier doesn't expose botScore)
- /build page over npm publish → publish needs CEO action (npm login, @sendwyrd org setup)

## Decisions (CEO calls made by user)

- Single-form addressing (ADR-021) — supersedes ADR-004 two-form
- Domain registrations declined (defensive registrations not pursued)
- Twitter attribution over GitHub source link in /about
- "do all" / "stop asking questions" / "trust your gut" — explicit delegation that drove the velocity

## Next Session Prompt

SendWyrd v1 is **fully operational**. Production at `https://sendwyrd.com`. Auto-deploys on push to main. Observed (Sentry + custom /ops dashboard). Tested (245 tests, 95.66% core coverage). Documented (manifesto + architecture + agent-API at /about and /build). Memory at `~/.claude/projects/-home-operator-lattice-sendwyrd/memory/project_sendwyrd_v1_live.md` is the canonical orientation document.

Read order for a fresh session:
1. CLAUDE.md (auto-loaded)
2. STATE.md
3. `project_sendwyrd_v1_live` memory file (auto-loaded via MEMORY.md index)
4. This SITREP if you need the recent operational thread

Most likely next-session candidates, ranked by leverage:
1. **MCP server** — highest-leverage agent integration. ~half day. Lets Claude Code (and other MCP-capable agents) call SendWyrd compose/share/burn as native tools.
2. **Per-IP rate limiting** in api worker via KV — closes the operational gap from ADR-013. ~1 day. DDoS hardening beyond Cloudflare's free L3/L4.
3. **`@sendwyrd/core` npm publish** — once user has npm @sendwyrd org. Low effort, opens the ecosystem.
4. **Soft-launch** — pick 5-10 humans, send them sendwyrd.com URLs, watch the dashboard.

User is in full CTO-delegated mode for technical/aesthetic calls. CEO-call boundaries: scope, branding, trust posture, domain/account provisioning, soft-launch decisions.

Production state at session close:
- ~22 deploys today
- 50 wyrds published (mostly CI smoke-test artifacts, some real)
- 9 replies sent
- Real-world traffic: ~169 distinct IPs in 24h (mostly non-human; CI + crawlers + scanners)
- Zero unresolved Sentry issues
- All four e2e smoke scripts green against production
