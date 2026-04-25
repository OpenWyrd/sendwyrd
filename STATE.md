---
type: state
created: 2026-04-24
updated: 2026-04-24
status: active
last_edited_by: agent_michael
last_session: session_michael_20260424_mop_founding_architecture
tags: [state, governance, mop]
---

# Operational State — MOP

## Current Phase

**Architecture resolution, mid-stream.** MOP was forked from the aDNA template on 2026-04-24. The founding session ingested the user's ChatGPT-derived architecture pack ("Hypermessage / Relay Objects — Architecture Context Pack v1") plus two adjacent inspiration docs (Weak Ties Game, TweetJoin), then ran a critical-pass rapid-fire on the architecture and banked 6 ADRs covering the protocol's core primitives. Several open questions remain pending; the next session resumes from those.

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

See `how/backlog/backlog_open_questions_v1.md` for the full list. Highest-priority open questions:

| ID | Question | Why it matters |
|----|----------|----------------|
| B1 | Reply receiving mechanics — confirm shape | Last question asked before pause; quick to resolve |
| B2 | Reply notification model (pull / push / email) | UX-critical; affects whether the intro/ask use case is viable |
| B3 | Body format (plain text vs. light markdown) | Renderer scope-defining |
| B4 | Object body size cap (number) | Concrete ceiling needed for schema |
| B5 | Anti-abuse / PoW / rate-limits | Without accounts, abuse mitigation moves entirely to PoW + edge |
| S1 | v1 launch scope (which use cases lead) | Marketing & demo content depend on this |
| S2 | Domain & branding | `mop.app` is a placeholder |

## Active Blockers

None. Session paused for context-window reset, not for any unresolved blocker.

## Recent Decisions Timeline

| Date | Decision | Source |
|------|----------|--------|
| 2026-04-24 | ADR-003 to ADR-008 banked; VISION.md authored; MANIFEST.md rewritten from template | Founding session |

## Recent Upgrades

| Date | Upgrade | Source |
|------|---------|--------|
| 2026-04-24 | Forked from aDNA template; MOP project identity established | Initial commit |

## Partial-Resume Detection

Session history at `how/sessions/history/2026-04/` is non-empty (founding session logged). MANIFEST.md no longer carries `role: template`; `last_edited_by: agent_michael` (not `agent_init`). Onboarding does **not** need to run. Next session can pick up directly from this STATE.md and the `Next Session Prompt` in the founding session log.

## Next Session Prompt

A self-contained paragraph for the next agent. Read in this order:

1. `CLAUDE.md` (auto-loaded — note that the **Identity & Personality** section still says "Berthier"; the user has not yet customized this and it remains the default)
2. `MANIFEST.md` — MOP project identity and structure
3. `who/governance/VISION.md` — five design principles + scope walls; these are immutable within v1 phase
4. `what/decisions/adr_003*.md` through `adr_008*.md` — all banked architectural commitments, in order
5. This STATE.md
6. `how/backlog/backlog_open_questions_v1.md` — the open question queue

**Then resume rapid-fire architecture questions** with the user, one question at a time (the user explicitly preferred this over batched questions). The user paused mid-question on B1 (reply receiving mechanics confirmation) — start there, then move through B2 → B3 → B4 → B5 in roughly that order, then strategic questions S1 → S2 → S3.

The user is **DeltaClimbs / Michael** (mrchapiro@gmail.com), working in `~/lattice/MOP/` on a Fedora workspace. Their design temperament is cypherpunk-Nostr-adjacent, Nietzschean, anti-feed/anti-algorithm, biased toward terse declarative ADRs and rule-light protocols. Match that register; do not corporate-neutralize the voice.

The architecture pack and inspiration docs the user shared in the founding session are NOT in the repo — they were verbatim conversation context. The pack's substance is captured in MANIFEST + VISION + ADRs; the inspiration is captured at `what/context/inspiration/`. Do not re-ingest the pack from scratch; treat the ADRs as canonical.

**Crucially**: when starting the next session, do NOT re-debate banked decisions unless the user explicitly reopens them. Banked is banked. The point of resuming is to resolve open questions, not to revisit settled ones.
