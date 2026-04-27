---
type: state
created: 2026-04-24
updated: 2026-04-25
status: active
last_edited_by: agent_michael
last_session: session_michael_20260425_mop_open_questions_resume_2
tags: [state, governance, mop]
---

# Operational State — SendWyrd

## Current Phase

**v1 is LIVE.** Deployed at `https://sendwyrd.com`. End-to-end publish / share / view / reply works on production. Architecture phase closed (ADRs 003–020). Build phases B–G complete with many fast-follow UX iterations from real-use feedback.

Repo: `https://github.com/DeltaClimbs/sendwyrd` (`main` clean, all pushed).

Now in **post-MVP Tier-1 punch list** — three operational gaps to close before pre-launch hardening (Tier-2: Sentry, OG cards, CI auto-deploy).

## What's Banked

### VISION-tier principles (`who/governance/VISION.md`)

1. **Hyperlinks for conversation** (north star)
2. **Protocol carries text only** (naked text; identity/signing/trust never modeled by protocol)
3. **Capability over identity** (bearer-capability URLs, no accounts, no PKI)
4. **Brittleness as feature** (architecture refuses durable identity and durable archive)
5. **Contact, not conversation** (interaction-minimalism; reply primitive is forensically necessary, not feature-welcome)

### Architectural decisions (`what/decisions/`)

| ADR | Title |
|-----|-------|
| 003 | Capability-based privacy posture: encryption mandatory, host-blind, no accounts |
| 004 | Two-key model (K_read symmetric / K_origin asymmetric) with two-form addressing (private fragment / public path) |
| 005 | Bitcoin cryptography stack: secp256k1 + BIP-32 hardened HD + BIP-39 |
| 006 | Object lifecycle: per-object K_origin, immutable post-publish, default 90-day burn |
| 007 | Body schema: text-with-embedded-URLs, transitive capability references |
| 008 | Replies: one-shot encrypted blobs, off by default, opt-in |
| 009 | Inbox aggregation: client-side via HD derivation, host stays per-object blind |
| 010 | Notifications: zero protocol primitive; entirely a client/app concern |
| 011 | Body is plain text; renderer aggressively auto-embeds non-MOP URLs (UX over recipient-side privacy) |
| 012 | Object body size cap: 300 Unicode codepoints (Spartan reference) |
| 013 | v1 abuse posture: edge + per-IP rate-limits + size caps; no PoW |
| 014 | Single canonical renderer; first-party clients only across web + iOS + Android in v1 |
| 015 | v1 is unopinionated about which use case leads (closes S1) |
| 016 | Brand is SendWyrd; canonical domain is sendwyrd.com; protocol codename remains MOP; unit noun is wyrd (closes S2) |
| 017 | HD path convention: BIP-43 flat purpose `300'`, hardened indices `m/300'/n'` (closes B6) |
| 018 | TTL expiry response: 410 Gone with structured tombstone metadata, 30-day retention (closes B8) |
| 019 | Renderer displays a symmetric privacy-posture indicator (Sealed / Open) on every wyrd view (closes B9) |
| 020 | v1 stack: Next.js + Hono on Cloudflare + Neon + R2; Web Crypto + noble + scure; AES-GCM + Schnorr (closes S3) |

### Use cases identified (`who/governance/VISION.md`)

1. Cross-post canonical URL on social media
2. Intro / ask routing ("X looking for someone who can help with Y")
3. Whisper-network dissemination (whitepapers, off-algo)
4. Tweet-replacement / canonical authored thoughts

### Inspiration archive (`what/context/inspiration/`)

- `inspiration_weak_ties_game.md` — voice-relay percolation experiment
- `inspiration_tweetjoin.md` — relational-first protocol; explicit conjecture about object-vs-relational architectures
- `AGENTS.md` — usage rules: adjacent context only, NOT canonical design constraints

## What's Shipped

All Phases B–G plus a long fast-follow UX iteration cycle from live testing.

| Phase | Status |
|-------|--------|
| B Wire spec | ✅ `what/docs/spec/spec_mop_v1.md` (with three known drift points; see Tier-1) |
| C Renderer contract | ✅ `what/docs/spec/renderer_contract_v1.md` |
| D Visual direction | ✅ `what/docs/spec/visual_direction_v1.md` |
| E Scaffolding + deploy | ✅ Monorepo + live at `sendwyrd.com` |
| F Landing copy + sigil | ✅ Plus theme-aware favicon |
| G Implementation | ✅ Full publish / fetch / burn handlers, ECIES replies, fragment + public views, inbox with auto-load + nicknames, account-less default, mnemonic persistence |

## Tier-1 Punch List (next session)

| # | Item | Status |
|---|------|--------|
| 1 | **Burn affordance UI** — `DELETE /api/v1/wyrds/{handle}` exists; need view-page + inbox burn buttons | Pending |
| 2 | **HD recovery sweep** — implement `GET /api/v1/authors/{k_origin_pub}/handles` + client-side mnemonic-import flow | Pending |
| 3 | **Spec doc sync** — `spec_mop_v1.md` is behind shipped reality (client-generated handles, ttl=0 permanent, reply cap=300) | Pending |

## Active Blockers

None. Product live at `https://sendwyrd.com`, verified end-to-end. Token stash at `~/.config/cloudflare/sendwyrd_api_token` (mode 600, owner-only, never committed). Neon CLI authed under `Michael Projects (org-crimson-bar-31850116)`. Wrangler authed under the operator's account (account ID `5aa935489ed472330341d50ca095b641`).

**Tier-2 (post-Tier-1)**: Sentry with redaction; OG card auto-embed for non-sendwyrd HTTPS URLs; CI auto-deploy on push to `main`; test suite beyond e2e smoke scripts.

**Tier-3 (deferred)**: Native iOS / Android (ADR-014 post-v1); Söhne typography swap; federation; defensive domain registrations.

**Future horizons** (aspirational, see `who/governance/future_horizons.md`): PKM (Roam / Obsidian / Logseq / Tana) and personal-CRM integration via OG metadata enrichment, webhook-on-publish, browser extensions, and an iCal/RSS feed of the user's wyrd history. Layered above the wire spec; no core protocol changes. Not v1. Trigger to revisit: when there are real users and at least one is manually pasting wyrds into a PKM.

## Recent Decisions Timeline

| Date | Decision | Source |
|------|----------|--------|
| 2026-04-24 | ADR-003 to ADR-008 banked; VISION.md authored; MANIFEST.md rewritten from template | Founding session |
| 2026-04-24 | ADR-009 banked: inbox aggregation client-side via HD derivation (B1 resolved) | Open-questions resume session |
| 2026-04-24 | ADR-010 banked: zero notification primitive at protocol layer; client/app concern (B2 resolved) | Open-questions resume session |
| 2026-04-24 | ADR-011 banked: body is plain text; renderer aggressively auto-embeds non-MOP URLs (B3 resolved; B7 settled collateral) | Open-questions resume session |
| 2026-04-24 | ADR-012 banked: body size cap is 300 codepoints — Spartan reference (B4 resolved) | Open-questions resume session |
| 2026-04-24 | ADR-013 banked: v1 abuse posture is edge + rate-limits + size caps; no PoW (B5 resolved) | Open-questions resume session |
| 2026-04-25 | Working agreement reframed: CTO calls delegated to agent (technical + aesthetic); CEO calls reserved for user (scope + branding + trust posture) | Open-questions resume 2 |
| 2026-04-25 | ADR-014 banked: single canonical renderer; first-party clients only across web + iOS + Android (S4 resolved) | Open-questions resume 2 |
| 2026-04-25 | ADR-015 banked: v1 is unopinionated about which use case leads (S1 resolved) | Open-questions resume 2 |
| 2026-04-25 | ADR-016 banked: Brand is SendWyrd at sendwyrd.com; protocol codename remains MOP; unit noun is *wyrd* (S2 resolved) | Open-questions resume 2 |
| 2026-04-25 | ADR-017 banked: HD path is `m/300'/n'` — BIP-43 flat purpose, hardened indices (B6 resolved) | Open-questions resume 2 |
| 2026-04-25 | ADR-018 banked: TTL expiry returns 410 Gone with tombstone metadata; 30-day retention (B8 resolved) | Open-questions resume 2 |
| 2026-04-25 | ADR-019 banked: renderer displays symmetric Sealed/Open privacy-posture indicator (B9 resolved) | Open-questions resume 2 |
| 2026-04-25 | ADR-020 banked: v1 stack is Next.js + Hono on Cloudflare + Neon + R2; Web Crypto + noble/scure; AES-GCM + Schnorr (S3 resolved) | Open-questions resume 2 |

## Recent Upgrades

| Date | Upgrade | Source |
|------|---------|--------|
| 2026-04-24 | Forked from aDNA template; MOP project identity established | Initial commit |
| 2026-04-25 | Brand banked as SendWyrd; domains registered; ADR-016 amendment for repo + dir rename `MOP` → `sendwyrd` | Open-questions resume 2 |
| 2026-04-25 | Phases B/C/D specs banked; bin-21 archived as inspiration reference | Open-questions resume 2 |
| 2026-04-25 | Phase E shipped — monorepo scaffolding + live deploy on Cloudflare Workers (api + web) | Open-questions resume 2 |
| 2026-04-25 | Phase F shipped — landing + wyrd sigil + privacy glyphs | Open-questions resume 2 |
| 2026-04-25 | Phase G shipped — full implementation incl. ECIES replies; e2e verified live | Open-questions resume 2 |
| 2026-04-25 | UX iteration cycle: lock-only privacy indicator, modernized Segmented form controls, top nav, account-less default flow, mnemonic persistence (format v2), inbox auto-load replies + nicknames, burn-on-public-form bug fix, reply 300-cap (anti-scope-creep), TTL never option, public-sharing copy, swung-open lock glyph | Open-questions resume 2 |
| 2026-04-25 | Phase E (scaffolding) — monorepo + Drizzle migration applied to live Neon DB; pnpm typecheck 4/4 green; next build green | Open-questions resume 2 |
| 2026-04-25 | Provisioned: Neon project `holy-poetry-85164505`, R2 bucket `sendwyrd-blobs`, Cloudflare Workers `sendwyrd-api` and `sendwyrd-web`, custom AAAA record on apex | Open-questions resume 2 |
| 2026-04-25 | Phase E deploy verified live: `GET https://sendwyrd.com/api/v1/health` → 200 with `mop-protocol-version: 1`; `GET https://sendwyrd.com/` → 200 Next.js HTML | Open-questions resume 2 |
| 2026-04-25 | Phase F (landing copy, wyrd sigil, privacy indicator glyphs) shipped live at https://sendwyrd.com/ | Open-questions resume 2 |
| 2026-04-25 | Phase G MVP shipped: real publish/fetch/burn handlers, client compose pipeline, fragment-form decrypt-on-view, public-form SSR with OG metadata, onboarding (3-step), compose UI, settings (theme + forget). E2E roundtrip verified on production. | Open-questions resume 2 |

## Partial-Resume Detection

Session history at `how/sessions/history/2026-04/` contains the completed founding + first open-questions sessions. The current open-questions-resume-2 session (2026-04-25) is in `how/sessions/active/` until close. MANIFEST.md does not carry `role: template`; `last_edited_by: agent_michael` (not `agent_init`). Onboarding does **not** need to run. Next session picks up directly from this STATE.md and the `Next Session Prompt` in the most recent session log.

## Next Session Prompt

SendWyrd v1 is **live and shipping**. Read order:

1. `CLAUDE.md` (auto-loaded — default Berthier identity uncustomized).
2. `MANIFEST.md` — project identity.
3. This `STATE.md` — Tier-1 punch list (you are here).
4. `who/governance/future_horizons.md` — aspirational non-v1 ideas (e.g. H1 PKM / CRM integration). Read once for context; do not act unless explicitly asked.
5. Memory pointers (auto-loaded via `MEMORY.md`):
   - `project_sendwyrd_v1_live.md` — current shipped state, infra pointers, e2e smoke scripts
   - `feedback_anti_scope_creep_relay_layer.md` — guard against XKCD-927; SendWyrd is a relay primitive, never a chat app
   - `feedback_zero_friction_default.md` — account-less default; security opt-in
   - `feedback_decision_delegation.md` — CTO/CEO call boundaries
   - `feedback_pragmatic_privacy_posture.md`
   - `user_profile.md`
5. `how/sessions/history/2026-04/session_michael_20260425_mop_open_questions_resume_2.md` — full record of how we got here
6. ADRs 003–020 only on demand. Banked is banked; do NOT re-debate.

**Tier-1 work, in priority order**:

1. **Burn affordance UI**. The API supports `DELETE /api/v1/wyrds/{handle}` (Schnorr-signed by `K_origin_priv`). No UI yet. Add a small "burn" button on `/w/{handle}` view (visible to author when their `K_origin_pub` matches a wyrd in their local history) and a per-row burn in `/inbox`. Confirm dialog. After burn, route to `/inbox` or render tombstone state inline.

2. **HD recovery sweep**. Currently if a user clears localStorage they cannot recover even with their mnemonic. Implement:
   - API: replace 501 stub at `packages/api/src/routes/authors.ts` with real `GET /api/v1/authors/{k_origin_pub_b64u}/handles` per spec §15. Schnorr-signed query (presence-check signature). Returns list of handles + metadata for that K_origin_pub.
   - Web: a `/recover` route or a settings action that takes a BIP-39 mnemonic input, derives `K_origin_pub` across `m/300'/n'` for `n=0..gap+20`, queries the presence-check endpoint, reconstructs `wyrdHistory`. Per spec §5.3 sweep convention.

3. **Spec doc sync**. `what/docs/spec/spec_mop_v1.md` drift:
   - §6, §9, §15: handle is **client-generated** (12 random bytes b64u), not server-generated. Server rejects collisions. `publish_message` SHA-256 includes the handle. Currently the spec says server-generated.
   - §9.2: `ttl_seconds = 0` is **accepted** as permanent (sentinel `expires_at = 253_370_764_800_000` = year 9999). Currently the spec says rejected.
   - §14.4: `REPLY_CODEPOINT_CAP = 300` (was 1000) and `REPLY_BLOB_BYTE_CEILING = 2500` (was 5000).

**Operational notes**:
- Token stash: `~/.config/cloudflare/sendwyrd_api_token` (chmod 600). Use as `$(cat ...)` in commands; never echo.
- Wrangler authed; Neon CLI authed; everything provisioned.
- Deploy commands: `cd packages/api && wrangler deploy`; `cd packages/web && pnpm exec opennextjs-cloudflare build && pnpm exec opennextjs-cloudflare deploy`.
- Smoke tests: `pnpm exec tsx packages/core/scripts/<name>.ts` from repo root or core dir.

User is in **CTO-delegated mode**. Don't interrogate on technical or aesthetic forks. Match the voice: cypherpunk-Nostr-adjacent, Nietzschean, terse declarative, no corporate-neutralization.
