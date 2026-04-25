---
type: manifest
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_michael
tags: [manifest, governance, mop]
---

# MOP — Project Manifest

## Project Identity

**MOP — Message Object Protocol** (consumer name: **Hypermessage**).

A lightweight system for relayable conversational objects. Each object is a tweet-sized, end-to-end-encrypted text block that becomes a shareable URL. Objects can reference other objects recursively and optionally accept private replies. Sharing happens through existing messaging rails (iMessage, Signal, WhatsApp, X DMs, Slack, email) — there is no internal feed, no discovery algorithm, no public graph.

**North star**: *Hyperlinks for conversation.* Not a social network, not a messenger replacement — a layer for portable, composable, forward-worthy conversational artifacts.

## Architecture

This project uses the **aDNA (Agentic DNA)** knowledge architecture for its operational/governance layer. The product itself — the Hypermessage protocol — lives inside this vault as design artifacts (decisions, context, vision) until implementation begins.

```
MOP/
├── what/        # WHAT — Architectural decisions, context, design docs
├── how/         # HOW — Plans, sessions, templates, pipelines
├── who/         # WHO — Governance, vision, operating principles
```

| Layer | Question | Contains |
|-------|----------|----------|
| **what/** | WHAT does this project know? | ADRs for protocol design, MOP context library, inspiration archive |
| **how/** | HOW does this project work? | Sessions, missions, campaigns, backlog, templates |
| **who/** | WHO is involved? | VISION.md (design principles + scope walls), governance |

## Design Principles (VISION-tier)

These are the immutable rules that every implementation decision must align to. Full statement in `who/governance/VISION.md`.

1. **Hyperlinks for conversation** — north star.
2. **Protocol carries text only** — identity, signing, trust never modeled by the protocol; either inlined by the user (endogenous) or carried by the share channel (exogenous).
3. **Capability over identity** — bearer-capability URLs, no accounts, no PKI within the protocol.
4. **Brittleness as feature** — the architecture refuses durable identity and durable archive on purpose; nudges toward action-oriented content over hot-take preaching.
5. **Contact, not conversation** — MOP initiates contact across opaque chains; it never grows into a conversation host.

## Use Cases (v1 candidates)

The protocol is deliberately unopinionated, but four use cases are explicitly in scope:

| Use case | Description |
|----------|-------------|
| **Cross-post canonical URL** | Publish once on MOP, share the URL across Twitter / iMessage / Slack as the canonical artifact |
| **Intro / ask routing** | "X looking for someone who can help with Y" — recipients forward via trust networks; terminal recipient reaches origin via the reply primitive |
| **Whisper-network dissemination** | Off-algo distribution of edgy/early ideas (often pointer-cards to externally-hosted long-form) |
| **Tweet-replacement / authored thoughts** | Use the canonical URL form as a personal record of one's own posts; recursive references enable thread-via-quoting |

## Banked Architectural Decisions

See `what/decisions/` for full ADRs. Summary:

- **ADR-003** Capability-based privacy posture (encryption mandatory v1, host cryptographically blind, no accounts)
- **ADR-004** Two-key model + two-form addressing (`K_read` symmetric distributed; `K_origin` asymmetric author-held; private fragment URL vs. public path URL, user-toggled)
- **ADR-005** Bitcoin cryptography stack (secp256k1, BIP-32 hardened HD, BIP-39 mnemonic) — composes cleanly with Nostr, optional cross-device recovery via seed
- **ADR-006** Object lifecycle (immutable post-publish, default 90-day burn with permanent toggle, K_origin authorizes delete)
- **ADR-007** Body-text-with-embedded-URLs schema (no separate `references` array; transitive capability grant via embedded `#K`)
- **ADR-008** Replies are one-shot encrypted blobs, off by default, opt-in via author toggle

## Open Questions (see `how/backlog/`)

- Reply receiving UX (notifications? polling? aggregate inbox?)
- Object body format (plain text vs. light markdown)
- Object size cap (number)
- Anti-abuse / PoW / rate-limit design
- v1 launch scope (which use cases ship first vs. follow-on)
- Domain & branding decisions
- Image/media inclusion model (URL-only assumed; needs confirmation)
- HD path conventions (BIP-44-style coin type or custom)

## Inspiration Archive (Adjacent Context, Not Canonical)

The user's design temperament is informed by two adjacent designs preserved in `what/context/inspiration/`:
- **Weak Ties Graph Traversal Game** — voice-relay percolation experiment; informs MOP's belief in trust-network distribution.
- **TweetJoin** — relational-first design philosophy; explicit conjecture *"relational-first architectures overpower object-first architectures."*

These are **not** product specifications. MOP is *object-first as practical implementation, relational-first as distribution substrate* — the resolution the user articulated explicitly.

## Entry Points

| Audience | Start Here | Then |
|----------|-----------|------|
| **Agents** | `CLAUDE.md` (auto-loaded) | `STATE.md` → `who/governance/VISION.md` → `what/decisions/` |
| **Humans** | `who/governance/VISION.md` | `MANIFEST.md` (this file) → `what/decisions/` for ADRs |
