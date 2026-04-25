---
type: state
created: 2026-04-24
updated: 2026-04-24
status: active
last_edited_by: agent_michael
last_session: session_michael_20260424_mop_open_questions_resume
tags: [state, governance, mop]
---

# Operational State — MOP

## Current Phase

**Architecture resolution, ~75% complete.** MOP was forked from the aDNA template on 2026-04-24. The founding session banked ADRs 003–008. The follow-on open-questions-resume session (also 2026-04-24) banked ADRs 009–013, resolving B1–B5 + B7. Six backlog items remain (B6, B8, B9, S1–S4) for the next session.

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
| B6 | HD path convention (BIP-44 vs custom) | Locked-in shape needed before client code |
| B8 | Tombstone vs. vanish on TTL expiry | Broken-link UX vs. ephemerality |
| B9 | Public-form privacy banner on rendered page | Recipient comprehension |
| S1 | v1 launch scope (which use cases lead) | Marketing & demo content depend on this |
| S2 | Domain & branding | `mop.app` is a placeholder |

## Active Blockers

None. Open-questions-resume session paused for sleep, not for any unresolved blocker. Mid-question on B6 (HD path convention).

## Recent Decisions Timeline

| Date | Decision | Source |
|------|----------|--------|
| 2026-04-24 | ADR-003 to ADR-008 banked; VISION.md authored; MANIFEST.md rewritten from template | Founding session |
| 2026-04-24 | ADR-009 banked: inbox aggregation client-side via HD derivation (B1 resolved) | Open-questions resume session |
| 2026-04-24 | ADR-010 banked: zero notification primitive at protocol layer; client/app concern (B2 resolved) | Open-questions resume session |
| 2026-04-24 | ADR-011 banked: body is plain text; renderer aggressively auto-embeds non-MOP URLs (B3 resolved; B7 settled collateral) | Open-questions resume session |
| 2026-04-24 | ADR-012 banked: body size cap is 300 codepoints — Spartan reference (B4 resolved) | Open-questions resume session |
| 2026-04-24 | ADR-013 banked: v1 abuse posture is edge + rate-limits + size caps; no PoW (B5 resolved) | Open-questions resume session |

## Recent Upgrades

| Date | Upgrade | Source |
|------|---------|--------|
| 2026-04-24 | Forked from aDNA template; MOP project identity established | Initial commit |

## Partial-Resume Detection

Session history at `how/sessions/history/2026-04/` contains two completed sessions (founding + open-questions resume). MANIFEST.md does not carry `role: template`; `last_edited_by: agent_michael` (not `agent_init`). Onboarding does **not** need to run. Next session picks up directly from this STATE.md and the `Next Session Prompt` in the most recent session log (`session_michael_20260424_mop_open_questions_resume.md`).

## Next Session Prompt

A self-contained paragraph for the next agent. Read in this order:

1. `CLAUDE.md` (auto-loaded — note that the **Identity & Personality** section still says "Berthier"; the user has not yet customized this and it remains the default)
2. `MANIFEST.md` — MOP project identity and structure
3. `who/governance/VISION.md` — five design principles + scope walls; immutable within v1 phase
4. `what/decisions/adr_003*.md` through `adr_013*.md` — **all 11 banked architectural commitments**, in number order
5. This STATE.md
6. `how/backlog/backlog_open_questions_v1.md` — open question queue (B6, B8, B9, S1–S4 still open)
7. `how/sessions/history/2026-04/session_michael_20260424_mop_open_questions_resume.md` — most recent session log; its Next Session Prompt is the canonical resume instructions for the rapid-fire (more detailed than this paragraph)

**Then resume rapid-fire architecture questions** with the user, one question at a time. B1 → ADR-009; B2 → ADR-010; B3 + B7 → ADR-011; B4 → ADR-012; B5 → ADR-013. Next on deck is **B6** (HD path convention — re-open with the BIP-43 / BIP-44 / custom fork; lean is BIP-43 purpose code `300'` flat). Then B8 → B9 → S1 → S2 → S3 → S4.

**Apply the pragmatic privacy posture heuristic** (memory: `~/.claude/projects/-home-michael-lattice-MOP/memory/feedback_pragmatic_privacy_posture.md`) when forks pit recipient-side privacy or maximalist defense against UX. The user has repeatedly chosen UX in v1.

The user is **DeltaClimbs / Michael** (mrchapiro@gmail.com), working in `~/lattice/MOP/` on a Fedora workspace. Cypherpunk-Nostr-adjacent, Nietzschean, anti-feed/anti-algorithm; terse declarative ADRs; rule-light protocols. Match the register; do not corporate-neutralize.

The architecture pack and inspiration docs the user shared in the founding session are NOT in the repo — they were verbatim conversation context. The pack's substance is captured in MANIFEST + VISION + ADRs; the inspiration is at `what/context/inspiration/`. Do not re-ingest the pack from scratch; treat the ADRs as canonical.

**Crucially**: do NOT re-debate banked decisions (ADRs 003–013) unless the user explicitly reopens them. Banked is banked.
