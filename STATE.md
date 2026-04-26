---
type: state
created: 2026-04-24
updated: 2026-04-25
status: active
last_edited_by: agent_michael
last_session: session_michael_20260425_mop_open_questions_resume_2
tags: [state, governance, mop]
---

# Operational State — MOP

## Current Phase

**Architecture resolution complete; entering v1 build-readiness prep.** MOP was forked from the aDNA template on 2026-04-24. The founding session banked ADRs 003–008. Open-questions sessions on 2026-04-24 and 2026-04-25 closed all 13 remaining backlog items, banking ADRs 009–020. Working agreement reframed mid-session: technical/aesthetic calls delegated to agent (CTO mode); user reserves CEO calls (scope, branding, trust posture). All architecture decisions are now banked. Next phase is **one-shot build readiness**: wire spec, renderer contract, visual/UX direction, repo scaffolding, and landing copy — completed before implementation begins.

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

## What's Pending

Architecture phase is closed. All ADR-level decisions are banked (003–020). Remaining v1 prep work moves to spec/build phases:

| Phase | Deliverable | Status |
|-------|-------------|--------|
| B | Wire spec doc (`what/docs/spec/spec_mop_v1.md`) — URL forms, endpoints, envelope, HD derivation, error codes, rate-limits, reply-blob format | **Done (2026-04-25)** |
| C | Renderer behavioral contract (`what/docs/spec/renderer_contract_v1.md`) — cross-impl spec for web/iOS/Android per ADR-014 | **Done (2026-04-25)** |
| D | Visual/UX direction (`what/docs/spec/visual_direction_v1.md`) — color tokens, type, spacing, motion budget, glyph specs, IA, screen-by-screen flows | **Done (2026-04-25)** |
| E | Repo scaffolding + deploy story (monorepo skeleton, no feature code) | Pending — needs Cloudflare/Neon auth + Bash unwedge |
| F | Landing copy + demo wyrd content (per ADR-015 — primitive-not-vertical pitch) | Pending |

When B–F are complete, v1 implementation becomes a single execution pass — every decision is pre-locked, no interrupts during coding.

## Active Blockers

None. All architecture questions resolved. Next session picks up Phase B (wire spec).

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
| 2026-04-25 | Brand banked as SendWyrd; placeholder names swept from MANIFEST/VISION; backlog architecture phase closed | Open-questions resume 2 |
| 2026-04-25 | `sendwyrd.com` and `sendwyrd.app` domains registered (user) | Open-questions resume 2 |
| 2026-04-25 | Phase B (wire spec) banked at `what/docs/spec/spec_mop_v1.md`; ADR-020 amended with Drizzle ORM | Open-questions resume 2 |
| 2026-04-25 | Phase C (renderer behavioral contract) banked at `what/docs/spec/renderer_contract_v1.md` | Open-questions resume 2 |
| 2026-04-25 | GitHub repo + local dir + memory dir renamed `MOP` → `sendwyrd`; ADR-016 amendment recorded | Open-questions resume 2 |
| 2026-04-25 | bin-21 archived as inspiration reference (stack-validation: Next.js + Drizzle + R2 confirmed); backlog F1/F2 added (burn-after-read v2 consideration, bot-defense operational refinement) | Open-questions resume 2 |
| 2026-04-25 | Phase D (visual direction spec) banked at `what/docs/spec/visual_direction_v1.md` — dark-first canonical, mono-as-voice, four-item motion budget, knotted/unknotted thread privacy glyphs | Open-questions resume 2 |

## Partial-Resume Detection

Session history at `how/sessions/history/2026-04/` contains the completed founding + first open-questions sessions. The current open-questions-resume-2 session (2026-04-25) is in `how/sessions/active/` until close. MANIFEST.md does not carry `role: template`; `last_edited_by: agent_michael` (not `agent_init`). Onboarding does **not** need to run. Next session picks up directly from this STATE.md and the `Next Session Prompt` in the most recent session log.

## Next Session Prompt

A self-contained paragraph for the next agent. Read in this order:

1. `CLAUDE.md` (auto-loaded — Identity & Personality is still default *Berthier*; user has not customized)
2. `MANIFEST.md` — project identity (consumer brand SendWyrd, protocol codename MOP, unit noun *wyrd*)
3. `who/governance/VISION.md` — five immutable design principles + scope walls
4. `what/decisions/adr_003*.md` through `adr_020*.md` — **all 18 banked architectural commitments**, in number order. Architecture phase is closed.
5. This STATE.md
6. `how/sessions/history/2026-04/session_michael_20260425_mop_open_questions_resume_2.md` — most recent session log; its SITREP and Next Session Prompt drive the active phase

**Phase ahead is one-shot build readiness.** When B–F (wire spec, renderer contract, visual direction, scaffolding, content) are all complete, v1 implementation becomes a single execution pass with zero open architecture questions. Start the next session at **Phase B (wire spec)**: write the consolidated v1 MOP protocol spec under `what/docs/` capturing every ADR-level decision in implementation-grade detail (URL canonical forms, endpoint inventory with HTTP methods/payloads/error codes, encryption envelope layout, HD derivation reference, reply-blob format, rate-limit numbers).

**Working agreement (CTO/CEO mode)**: technical and aesthetic decisions are delegated to agent. User reserves CEO calls (scope, branding, trust posture). Memory: `~/.claude/projects/-home-michael-lattice-MOP/memory/feedback_decision_delegation.md`.

**Apply the pragmatic privacy posture heuristic** (memory: `feedback_pragmatic_privacy_posture.md`) for any future fork pitting recipient-side privacy against UX.

The user is **DeltaClimbs / Michael** (mrchapiro@gmail.com), working in `~/lattice/MOP/` on a Fedora workspace. Cypherpunk-Nostr-adjacent, Nietzschean, anti-feed/anti-algorithm; terse declarative docs; rule-light protocols. Match the register; do not corporate-neutralize.

**Crucially**: do NOT re-debate banked decisions (ADRs 003–020) unless the user explicitly reopens them. Banked is banked.
