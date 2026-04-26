---
type: manifest
created: 2026-04-24
updated: 2026-04-25
last_edited_by: agent_operator
tags: [manifest, governance, mop, sendwyrd]
---

# MOP — Project Manifest

## Project Identity

- **Consumer brand**: **SendWyrd** (at `sendwyrd.com`)
- **Protocol codename**: **MOP — Message Object Protocol**
- **Unit noun**: a **wyrd** (lowercase) — *"send a wyrd"*, *"my wyrd is at this URL"*

A lightweight system for relayable conversational artifacts. Each wyrd is a 300-codepoint, end-to-end-encrypted text block that becomes a shareable URL. Wyrds can reference other wyrds recursively and optionally accept private replies. Sharing happens through existing messaging rails (iMessage, Signal, WhatsApp, X DMs, Slack, email) — there is no internal feed, no discovery algorithm, no public graph.

**North star**: *Hyperlinks for conversation.* Not a social network, not a messenger replacement — a layer for portable, composable, forward-worthy conversational artifacts.

The brand-vs-protocol layering follows the standard pattern (Signal app vs. Signal Protocol; Mastodon vs. ActivityPub): consumer-facing surfaces use **SendWyrd**, technical/spec-facing language uses **MOP**. See ADR-016 for the binding decision.

## Architecture

This project uses the **aDNA (Agentic DNA)** knowledge architecture for its operational/governance layer. The product itself — the SendWyrd consumer surface and MOP protocol underneath — lives inside this vault as design artifacts (decisions, context, vision) until implementation begins.

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

## Use Cases (illustrative, not prioritized)

Per ADR-015, v1 is unopinionated about which use case leads — the product is a primitive, the four use cases below are equal and illustrative, none is the headline pitch.

| Use case | Description |
|----------|-------------|
| **Cross-post canonical URL** | Publish once on SendWyrd, share the URL across Twitter / iMessage / Slack as the canonical artifact |
| **Intro / ask routing** | "X looking for someone who can help with Y" — recipients forward via trust networks; terminal recipient reaches origin via the reply primitive |
| **Whisper-network dissemination** | Off-algo distribution of edgy/early ideas (often pointer-cards to externally-hosted long-form) |
| **Tweet-replacement / authored thoughts** | Use the canonical URL form as a personal record of one's own posts; recursive references enable thread-via-quoting |

## Banked Architectural Decisions

See `what/decisions/` for full ADRs. Summary:

| ADR | Title |
|-----|-------|
| 003 | Capability-based privacy posture (encryption mandatory v1, host cryptographically blind, no accounts) |
| 004 | Two-key model + two-form addressing (`K_read` symmetric / `K_origin` asymmetric; private fragment vs. public path URL) |
| 005 | Bitcoin cryptography stack (secp256k1 + BIP-32 hardened HD + BIP-39) |
| 006 | Object lifecycle (immutable post-publish, default 90-day burn, K_origin-signed delete) |
| 007 | Body-text-with-embedded-URLs schema (transitive capability grant via embedded `#K`) |
| 008 | Replies: one-shot encrypted blobs, off by default, opt-in |
| 009 | Inbox aggregation: client-side via HD derivation, host stays per-object blind |
| 010 | Notifications: zero protocol primitive; entirely a client/app concern |
| 011 | Body is plain text + aggressively auto-embedded URLs (recipient-side privacy not hardened in v1) |
| 012 | Body size cap: 300 Unicode codepoints (Spartan reference) |
| 013 | v1 abuse posture: edge + per-IP rate-limits + size caps; no PoW |
| 014 | Single canonical renderer; first-party clients only across web + iOS + Android in v1 |
| 015 | v1 is unopinionated about which use case leads (closes S1) |
| 016 | Brand is SendWyrd; canonical domain is sendwyrd.com; protocol codename remains MOP; unit noun is wyrd (closes S2) |
| 017 | HD path convention: BIP-43 flat purpose `300'`, hardened indices `m/300'/n'` (closes B6) |
| 018 | TTL expiry response: 410 Gone with structured tombstone metadata, 30-day retention (closes B8) |
| 019 | Renderer displays a symmetric privacy-posture indicator on every wyrd view (closes B9) |
| 020 | v1 stack: Next.js + Hono on Cloudflare + Neon Postgres + R2; Web Crypto + noble + scure; AES-GCM + Schnorr (closes S3) |

## Open Questions

Architecture phase is closed. See `how/backlog/backlog_open_questions_v1.md` for status. Remaining work moves to spec/build phases (wire spec, renderer contract, visual direction, scaffolding, content) — tracked in the active session and the upcoming v1-build readiness mission.

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
