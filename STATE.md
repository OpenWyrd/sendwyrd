---
type: state
created: 2026-04-24
updated: 2026-04-28
last_session_decisions: [adr_025_formal_verification]
status: active
last_edited_by: agent_operator
last_session: session_operator_20260428_formal_verification
tags: [state, governance, mop, sendwyrd]
---

# Operational State — SendWyrd

## Current Phase

**v1 LIVE at `https://sendwyrd.com`.** End-to-end publish / share / view / reply / burn working in production. Architecture phase closed (ADRs 003–021). Tier-1 and Tier-2 shipped; the post-Tier-2 UX polish, performance, and protocol-primitive cycle has shipped on top. CI auto-deploys on push to `main`. Sentry observed; custom `/ops/{secret}` dashboard live.

Repo: `https://github.com/openwyrd/sendwyrd` (private, stays private through launch).

Now in **post-agora topology phase**: shipping the agent-routing surfaces (MCP first), hardening operations (rate-limiting, security headers), and queuing soft-launch.

## What's Banked

### VISION-tier principles (`who/governance/VISION.md`)

1. **Hyperlinks for conversation** (north star)
2. **Protocol carries text only** (naked text; identity/signing/trust never modeled by protocol)
3. **Capability over identity** (bearer-capability URLs, no accounts, no PKI)
4. **Brittleness as feature** (architecture refuses durable identity and durable archive)
5. **Contact, not conversation** (interaction-minimalism; reply primitive is forensically necessary, not feature-welcome)

Plus the **post-agora topology** section (banked 2026-04-26) — the consequence of the five: routing becomes personal infrastructure, not platform infrastructure. Per-user agents do the connective work the algorithmic agora used to. The MCP server is the first concrete realization.

### Architectural decisions (`what/decisions/`)

| ADR | Title |
|-----|-------|
| 003 | Capability-based privacy posture: encryption mandatory, host-blind, no accounts |
| 004 | Two-key model + two-form addressing — **superseded by ADR-021** |
| 005 | Bitcoin cryptography stack: secp256k1 + BIP-32 hardened HD + BIP-39 |
| 006 | Object lifecycle: per-object K_origin, immutable post-publish, default 90-day burn |
| 007 | Body schema: text-with-embedded-URLs, transitive capability references |
| 008 | Replies: one-shot encrypted blobs, off by default, opt-in |
| 009 | Inbox aggregation: client-side via HD derivation, host stays per-object blind |
| 010 | Notifications: zero protocol primitive; entirely a client/app concern |
| 011 | Body is plain text; renderer aggressively auto-embeds non-MOP URLs |
| 012 | Object body size cap: 300 Unicode codepoints (Spartan reference) |
| 013 | v1 abuse posture: edge + per-IP rate-limits + size caps; no PoW |
| 014 | Single canonical renderer; first-party clients only across web + iOS + Android |
| 015 | v1 is unopinionated about which use case leads (closes S1) |
| 016 | Brand SendWyrd / domain sendwyrd.com / protocol codename MOP / unit noun *wyrd* |
| 017 | HD path: BIP-43 flat purpose `300'`, hardened `m/300'/n'` |
| 018 | TTL expiry: 410 Gone with structured tombstone metadata, 30-day retention |
| 019 | Renderer displays a symmetric privacy-posture indicator (Sealed / Open) — **amended by ADR-021** to monomorphic |
| 020 | v1 stack: Next.js + Hono on Cloudflare + Neon + R2; Web Crypto + noble + scure |
| 021 | Single canonical fragment URL form: collapses two-form addressing; OG previews refused on social platforms by design |
| 022 | K_read derived from seed via HKDF (was: per-wyrd CSPRNG) — mnemonic recovery now reconstructs full share URLs; forward secrecy via TTL+burn |
| 023 | Payment-token posture: detect locally, hand off to wallets, never settle — no `tip_offer` field, no `zap_attestation` kind, no in-app minting |
| 024 | No relay-side recipient model — capability URLs do all addressing; "outbox" view recoverable from seed, "inbox" (if shipped) is browser-local-only |
| 025 | Formal verification effort — Tier 1 ProVerif (run, all 4 queries pass), Tier 2 CryptoVerif POC (Theorem 1 mechanized) + hand-written reductions for Theorems 2–6, Tier 3 property-based regression (`what/docs/formal/`) |

### Use cases identified (`who/governance/VISION.md`)

1. Cross-post canonical URL (recipients see bare URL, must visit — no algorithmic preview surface, per ADR-021)
2. Intro / ask routing
3. Whisper-network dissemination
4. Tweet-replacement / canonical authored thoughts

### Future horizons (`who/governance/future_horizons.md`)

- **H1** — PKM / personal-CRM integration (Roam, Obsidian, Logseq, Tana, Folk, etc.) via OG enrichment, webhooks, browser extensions, RSS-of-my-wyrds
- **H2** — paid-tier client capabilities atop v1 protocol: audio-first compose, encrypted attachments, 3000-codepoint cap
- **H3** — agent-routing surfaces atop the post-agora topology: MCP registry listings, routing-rules DSL, PKM/CRM bridging via agent loops, inter-agent capsule exchange, local-first SDKs

## What's Shipped

All Phases B–G plus Tier-1, Tier-2, ops surfaces, agent-API docs, a long UX-polish cycle, a performance pass, and a new protocol primitive (static authorship attestations).

| Phase / cycle | Status |
|---------------|--------|
| B Wire spec | shipped — `what/docs/spec/spec_mop_v1.md` (v1.0.4-draft, 8 drift points patched) |
| C Renderer contract | shipped — `what/docs/spec/renderer_contract_v1.md` |
| D Visual direction | shipped — `what/docs/spec/visual_direction_v1.md` |
| E Scaffolding + deploy | shipped — monorepo + live at `sendwyrd.com` |
| F Landing copy + sigil | shipped — plus theme-aware favicon, sigil-wordmark lockup |
| G Implementation | shipped — full publish / fetch / burn / replies / inbox |
| Tier-1 punch list | shipped — burn UI, HD recovery sweep, spec sync |
| Tier-2 hardening | shipped — CI auto-deploy, Sentry+redaction+sourcemaps+release-tag, 263+ tests |
| Architecture pivot | shipped — ADR-021 single-form addressing, legacy redirect for in-the-wild URLs |
| /about manifesto | shipped — 6-point manifesto + architecture + crypto + brittleness + Why-not-Nostr + stack |
| /build agent docs | shipped — wire spec + endpoints + agent notes + roadmap + anti-roadmap |
| `/ops/{secret}` dashboard | shipped — Sentry issues, Postgres usage, Cloudflare edge metrics, secrets-entry page |
| UX polish cycle | shipped — passphrase-cache lifetime, BIP-39 boxed input, mnemonic dropdown bg, sigil lockup, mobile bottom-bar Compose CTA, /about Nav tab, in-app attest-authorship affordance |
| Performance | shipped — SSR-fetch + Suspense streaming on `/w/[handle]` (warm TTFB ~100-150ms) |
| Authorship attestation primitive | shipped — sign + verify + body-shape parser + verification banner; in-app affordance landed via squash-PR |
| Unfurl proxy + LinkEmbed | shipped — `/api/v1/unfurl` (HEAD-then-GET, OG/twitter scrape, 256 KiB cap, 1h CF cache, no URL logging) + image-extension fallback |
| Quote affordance + bare-domain URLs | shipped — quote button on `/w/[handle]`; bare `example.com` detection with email/case heuristics |
| MCP server (`packages/mcp/`) | **shipped on `feat/mcp-server`, PR #38** — stdio MCP wrapping SendWyrd as 13 verbs (status / init / unlock / lock / forget / compose / view / burn / reply / attest / history / inbox / recover); 20 mcp tests + 158 core + 105 web all green; e2e smoke against prod passed |

## Active Branches In Flight

| Branch | Worktree | Purpose | Status |
|--------|----------|---------|--------|
| `feat/mcp-server` | `sendwyrd-mcp-followup` | MCP server + post-agora topology vision banking + H3 horizon | PR #38 open, this branch |
| `rate-limit-api` | parallel session | KV-backed per-IP rate limiting (closes ADR-013 operational gap) | in progress |
| `security-headers` | parallel session | response-header hardening | in progress |

Note: many recent UI/UX additions (sigil lockup, quote affordance, attestation banner, in-app attest-authorship affordance, /about Nav tab, landing compaction) have already merged via the squash-PR pattern — `git log --oneline` is the source of truth for what's on `main`.

## Active Blockers

None. Production live at `https://sendwyrd.com`, verified end-to-end, observed via Sentry + custom dashboard.

**Operational provisioning** (unchanged):
- Cloudflare API token: `~/.config/cloudflare/sendwyrd_api_token` (mode 600)
- Sentry user auth token: `~/.config/sentry/auth_token` (mode 600)
- Wrangler authed under the operator's CF account (account ID stored in `~/.config/cloudflare/sendwyrd_api_token` / `CLOUDFLARE_ACCOUNT_ID`)
- Neon CLI authed under the operator's project
- Neon project + R2 bucket + Worker names live in `infra/PRIVATE.md` (gitignored)

## Rolling Backlog (next-up, ranked by leverage)

1. **MCP registry listings** — Anthropic MCP catalog, Smithery, open-MCP. Widens discovery for agent operators now that `@sendwyrd/mcp` is on npm.
2. **Soft-launch** — pick 5-10 humans, send sendwyrd.com URLs, watch `/ops/{secret}`. Bottleneck is no longer code.
3. **Neon HTTP-fetch mode** — cuts cold-Postgres connection latency on cold-worker starts (currently ~600-1200ms cold).
4. **Edge-cache `/api/v1/wyrds/{handle}` ~10s TTL** — cuts repeat-read latency. Risk: burns within TTL serve stale 200; needs cache-purge on `DELETE`.
5. **Per-IP rate limiting via KV** — closes ADR-013 operational gap. **In flight on `rate-limit-api`.**
6. **Security headers** — hardening pass. **In flight on `security-headers`.**
7. **Deferred**: native iOS / Android (ADR-014 post-v1); Söhne typography swap; federation; Python SDK / OpenAPI; defensive domain registrations (declined this cycle).

## Recent Decisions Timeline

| Date | Decision | Source |
|------|----------|--------|
| 2026-04-24 | ADR-003 to ADR-008 banked; VISION.md authored | Founding session |
| 2026-04-24 | ADR-009 through ADR-013 banked (inbox / notifications / body / size / abuse) | Open-questions resume |
| 2026-04-25 | Working agreement: CTO-delegated to agent; CEO reserved for scope/branding/trust | Open-questions resume 2 |
| 2026-04-25 | ADR-014 through ADR-020 banked (renderer / use-case / brand / HD path / TTL / indicator / stack) | Open-questions resume 2 |
| 2026-04-26 | Tier-1 closed: burn UI, HD recovery, spec v1.0.1-draft sync | Overnight review + ship |
| 2026-04-26 | **ADR-021 banked**: single canonical fragment URL form; supersedes ADR-004; OG previews refused on social platforms by design (CEO call) | Overnight review + ship |
| 2026-04-26 | Tier-2 closed: CI auto-deploy, Sentry+redaction+sourcemaps, 245 tests | Overnight review + ship |
| 2026-04-26 | `/ops/{secret}` dashboard + secrets-entry page shipped | Overnight review + ship |
| 2026-04-26 | `/about` manifesto + `/build` agent docs published; repo stays private | Overnight review + ship |
| 2026-04-26 | Authorship attestation primitive shipped (sign + verify + body-shape parser + verification banner). **ADR-pending** — primitive ships and is documented at `/about`; formal ADR write-up not yet filed. | UX/perf/attestation session |
| 2026-04-26 | Unfurl proxy `/api/v1/unfurl` + LinkEmbed component (no URL logging, 1h CF cache) | UX/perf/attestation session |
| 2026-04-26 | Performance pass: SSR + Suspense streaming on `/w/[handle]` | UX/perf/attestation session |
| 2026-04-26 | H2 paid-tier horizon banked (audio + attachments + 3000 cap) | UX/perf/attestation session |
| 2026-04-26 | **Post-agora topology section banked in VISION.md** — five principles' consequence: routing as personal infrastructure (CEO call) | MCP server session |
| 2026-04-26 | **H3 horizon banked**: agent-routing surfaces atop the post-agora topology | MCP server session |
| 2026-04-26 | **MCP server shipped** (`packages/mcp/`, PR #38) — first concrete realization of the post-agora topology; stdio default, 13 verbs, ADR-003-aligned (no remote MCP in v1) | MCP server session |
| 2026-04-26 | **ADR-022 banked**: K_read derived from seed via HKDF (was per-wyrd CSPRNG). Mnemonic recovery now reconstructs full share URLs. Forward secrecy via TTL+burn deletion, not key non-derivability. | Wrap-up session |
| 2026-04-26 | **ADR-023 banked**: payment-token posture — detect locally, hand off to wallets, never settle. Body parser surfaces Lightning + Bitcoin tokens; renderer shows labelled chips with on-demand local QR. `tip_offer` envelope field and `zap_attestation` wyrd type explicitly rejected. | Wrap-up session |
| 2026-04-26 | **ADR-024 banked**: no relay-side recipient model. Locks down "the relay knows authors, never recipients." Disambiguates inbox/outbox terminology vs ADR-009. Future inbox view is browser-local viewing log only. | Wrap-up session |
| 2026-04-26 | **ADR-012 enforcement amended**: composer is send-disable + red counter, not input hard-block (lets users paste long Lightning invoices that the parser excludes from the cap). | Wrap-up session |
| 2026-04-27 | **`@sendwyrd/core@0.1.0` published to npm** — unblock via granular access token with bypass-2FA flag (account 2FA stays disabled). Build page tightened to drop "in flight" soft-claims. | npm unblock session |
| 2026-04-26 | `/inbox` route renamed to `/wyrds` (label "my wyrds") — page lists author-side wyrds, not received messages. ADR-024 frames the structural reason. | Wrap-up session |
| 2026-04-26 | **Open-source decision**: stay private through launch; spec stays private with implementation; revisit after PMF validates usage. Source-available trajectory (BSL/FSL) deferred. | Wrap-up session |
| 2026-04-26 | **Inbox-as-second-view shipped** (ADR-024 follow-on): `wyrdInbox.ts` localStorage lib + auto-record on view-page decrypt + Segmented `outbox \| inbox` toggle on `/wyrds` + Settings opt-out toggle + clear-inbox button. Browser-local, never relay-queried, not seed-recoverable. 10 unit tests. | Follow-on session |
| 2026-04-26 | **BIP-21 chip preview** (ADR-023 follow-on): bitcoin: URI parser surfaces `?amount=&label=&message=` query params; chip label reads "0.001 BTC to bc1qar0s…5mdq" instead of bare "BTC address" when amount is present. | Follow-on session |
| 2026-04-26 | **CSP flipped to enforce mode**: `Content-Security-Policy-Report-Only` → `Content-Security-Policy` in next.config.ts. Real-traffic Sentry telemetry was clean over the post-launch observe window. | Follow-on session |
| 2026-04-26 | **PWA install affordance moved to top of wyrd-view page**: was buried mid-article (after Sent date); now appears above the article when state.kind === "ready". Compose-page placement (already top) and landing (no widget) unchanged. | Follow-on session |
| 2026-04-26 | **Inbox liveness re-fetch shipped**: `/wyrds` inbox view re-fetches each entry from relay on mount, classifies live/burned/expired/unreachable, renders status badge with strikethrough + dimmed-opacity for gone entries. Per ADR-024 the result lives in component state, never persisted. 5 new integration tests on the outbox\|inbox toggle. | Follow-on session |
| 2026-04-27 | **NIP-C6 drafted + PR submitted** (`nostr-protocol/nips#2327`); **withdrawn 2026-04-28** after fiatjaf review pushback ("URL self-identifies, no need for tags") and the realization that standard OpenGraph metadata on `/w/{handle}` is the universal substrate that gives capability URLs first-class rendering on every platform — Nostr included — without any per-event tag schema. Spec preserved at `what/docs/spec/nip_capability_url_v1.md` with a withdrawal banner; reusable process skill `how/skills/skill_nip_submission.md` retained for future NIPs (not C6-specific). | NIP submission + withdrawal sessions |
| 2026-04-27 | **composeWyrd cap check moved to `countCountableCodepoints`**: matches the live UI counter so a body that's *only* a Lightning invoice or URL composes successfully (raw count > cap, countable count ≤ cap). Empty-body check still uses raw codepoints. New test `excludes Lightning invoices from the codepoint cap`. | NIP submission session |
| 2026-04-26 | **`@sendwyrd/mcp` published to npm** — registry returns 200; install path is now `npx -y @sendwyrd/mcp` (was workspace-only). | Publish-prep session |
| 2026-04-26 | **`@sendwyrd/core` publish-prep complete** — package metadata (license, repository, homepage, keywords, publishConfig, files), conditional `dist/` exports, README, LICENSE landed. Pending `pnpm publish --access public` from `packages/core`. `/build` page updated: roadmap bullet removed, "What ships today" + JS/TS paragraph rewritten to point at npm. | This session |
| 2026-04-28 | **Formal verification artifacts banked (ADR-025)**: Tier 1 ProVerif model + report (run, all 4 queries pass), Tier 2 hand-written game-based reductions for 5 theorems + composition bound, Theorem 1 mechanized in CryptoVerif (auto-closes), Tier 3 property-based regression suite (400/400 checks pass). Lives at `what/docs/formal/`. | Formal-verification session |

## Recent Upgrades

| Date | Upgrade | Source |
|------|---------|--------|
| 2026-04-24 | Forked from aDNA template; MOP project identity established | Initial commit |
| 2026-04-25 | Phases B–G shipped; v1 deployed live; UX iteration cycle (lock-only indicator, segmented controls, account-less default, mnemonic v2, inbox auto-load) | Open-questions resume 2 |
| 2026-04-26 | Tier-1 (burn UI / HD recovery / spec sync) + Tier-2 (CI / Sentry / 245 tests) shipped | Overnight review + ship |
| 2026-04-26 | Single-form architecture pivot (ADR-021); legacy public-form redirect | Overnight review + ship |
| 2026-04-26 | `/ops/{secret}` dashboard + secrets-entry page; Cloudflare GraphQL edge analytics; release-number on dashboard | Overnight review + ship |
| 2026-04-26 | `/about` manifesto + `/build` agent docs; landing copy compaction; YC drop; Twitter attribution; about-Nav-tab | Overnight review + ship + post-ship cycle |
| 2026-04-26 | SW landing-page hydration trap hotfix (network-first + cache version bump) | UX/perf session |
| 2026-04-26 | Passphrase persists until tab close; BIP-39 boxed mnemonic input; mnemonic-dropdown bg fix | UX/perf session |
| 2026-04-26 | Sigil + wordmark lockup on Nav and onboarding | UX/perf session |
| 2026-04-26 | Authorship attestation primitive: `packages/core/src/attestation.ts` + `AttestationBanner.tsx` + `/about` documentation; in-app `/inbox` affordance follow-up landed | UX/perf session + post-ship squash-PR |
| 2026-04-26 | Unfurl proxy + LinkEmbed; image-extension content-type fallback | UX/perf session |
| 2026-04-26 | SSR + Suspense streaming on `/w/[handle]` — warm TTFB drops to ~100-150ms | UX/perf session |
| 2026-04-26 | Quote affordance + bare-domain URL detection on compose/render | UX/perf session |
| 2026-04-26 | H2 paid-tier horizon documented in `future_horizons.md` | UX/perf session |
| 2026-04-26 | **`packages/mcp/` shipped — stdio MCP server, 13 verbs, 20 tests + e2e smoke green** | MCP server session |
| 2026-04-26 | **VISION.md gains post-agora topology section; future_horizons.md gains H3** | MCP server session |
| 2026-04-26 | **K_read seed-derived via HKDF (ADR-022)** — `deriveReadKey` in `@sendwyrd/core/hd`; recovery sweep reconstructs full share URLs | Wrap-up session |
| 2026-04-26 | **Payment-token detection + local QR (ADR-023)** — body parser surfaces Lightning (BOLT11/12, LNURL, addresses on 10-provider allowlist, `lightning:` URI) and Bitcoin (bech32/m, legacy, `bitcoin:` URI) tokens; `WyrdBody` renders labelled chips + on-demand inline QR via `qrcode-svg` | Wrap-up session |
| 2026-04-26 | **`/inbox` → `/wyrds` (label "my wyrds")** — directory rename + nav/links/tests + ADR-024 documenting the structural reason | Wrap-up session |
| 2026-04-26 | Compose UX: input flows past 300-cap; counter goes red; Send disables. Pasting long invoices no longer fights the input. | Wrap-up session |
| 2026-04-26 | Time-of-day on wyrd timestamps (`/wyrds` page + `/w/[handle]` view). | Wrap-up session |
| 2026-04-26 | About page: "Why not Nostr" → "Comparison to Nostr" (neutral reframe); new "Bitcoin & Lightning" section explaining detection + local QR posture; Cryptography section updated for HKDF derivation. | Wrap-up session |
| 2026-04-26 | ReplyForm disclosure: "What is a DM?" → "How wyrd replies work" with `›`→`▾` chevron affordance. | Wrap-up session |

## Partial-Resume Detection

Session history at `how/sessions/history/2026-04/` contains all completed sessions through 2026-04-26 (founding, open-questions, open-questions-resume-2, overnight-review-ship, ux-perf-attestation, mcp-server, ci-hardening + NIP-C6 about-page reference). No active session. MANIFEST.md does not carry `role: template`; `last_edited_by: agent_operator` (not `agent_init`). Onboarding does **not** need to run.

## Next Session Prompt

SendWyrd v1 is **live, hardened, observed, and now agent-callable.** Read order:

1. `CLAUDE.md` (auto-loaded — default Berthier identity uncustomized).
2. `MANIFEST.md` — project identity.
3. This `STATE.md` — you are here.
4. `who/governance/VISION.md` — five principles + post-agora topology section (the latter is recent and load-bearing for any agent-routing work).
5. `who/governance/future_horizons.md` — H1 PKM, H2 paid tier, H3 agent-routing surfaces (deliberate non-v1 ledger; read once for context).
6. Memory pointers (auto-loaded via `MEMORY.md`):
   - `project_sendwyrd_v1_live.md` — current shipped state, infra pointers, e2e smoke scripts
   - `feedback_anti_scope_creep_relay_layer.md` — relay primitive, never a chat app
   - `feedback_zero_friction_default.md` — account-less default; security opt-in
   - `feedback_decision_delegation.md` — CTO/CEO call boundaries
   - `feedback_pragmatic_privacy_posture.md`
   - `feedback_ops_capability_url.md` — `/ops/{secret}` capability-URL gating, not auth flows
   - `user_profile.md`
7. Most recent session log: `how/sessions/active/session_operator_20260426_mcp_server.md` (or its `history/` location after close).
8. ADRs 003–024 only on demand. Banked is banked; do NOT re-debate. ADRs 022/023/024 (this wrap-up) are load-bearing for any future payment, recipient-model, or recovery-flow work.

**Highest-leverage next moves** (ranked):

1. **`npm publish @sendwyrd/mcp`** — needs user `npm login` against `@sendwyrd` org (CEO action). Once published, register listings on Anthropic MCP catalog + Smithery.
2. **Soft-launch** — code is no longer the bottleneck. Pick 5-10 humans, send URLs, watch `/ops/{secret}`.
3. **Neon HTTP-fetch mode** — cold-worker latency.
4. **Edge-cache repeat-reads** — warm-worker latency for popular wyrds.
5. **Coordinate with parallel sessions** on `rate-limit-api` and `security-headers`; review + merge when those branches surface PRs.

**Operational notes**:
- Token stash paths: `~/.config/cloudflare/sendwyrd_api_token`, `~/.config/sentry/auth_token` (chmod 600 each). Never echo.
- Wrangler / Neon CLI authed; CI auto-deploys on push to `main`.
- Repo stays private through launch; `/build` directs builders to `@deltaclimbs` on Twitter for spec/code requests.
- Deploy is now CI-driven; manual deploy commands still work (`cd packages/api && wrangler deploy`; `cd packages/web && pnpm exec opennextjs-cloudflare build && pnpm exec opennextjs-cloudflare deploy`) but are off the hot path.
- **Pre-commit prettier hook live** (husky v9 + lint-staged, added 2026-04-26 commit `16086f7`). Format drift can no longer accumulate — staged `*.{ts,tsx,md,json,yaml,yml}` are auto-formatted on commit. CI `format:check` should stay green. If a fresh clone, `pnpm install` bootstraps the hooks via the `prepare` script.
- **OG card on `/w/{handle}`** (2026-04-28) — content-free `Encrypted Wyrd · Tap to decrypt` card with sigil + wordmark, served identically for every handle. Resolves the bare-URL-on-Nostr operational pain. ADR-021 Revisited section documents the posture relaxation; no content-leak regression (server cannot decrypt; fragment never reaches host).

User remains in **CTO-delegated mode**: own technical and aesthetic calls; only escalate scope / branding / trust-posture forks. Match the voice — cypherpunk-Nostr-adjacent, Nietzschean, terse declarative, no corporate-neutralization.
