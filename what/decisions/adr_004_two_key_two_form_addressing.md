---
type: decision
adr_id: adr_004
adr_number: 4
title: "Two-key model with two-form addressing (private fragment vs. public path)"
status: superseded
created: 2026-04-24
updated: 2026-04-26
last_edited_by: agent_operator
supersedes:
superseded_by: adr_021
tags: [adr, decision, mop, crypto, addressing, capability]
---

# ADR-004: Two-Key Model with Two-Form Addressing

> **Superseded in part by ADR-021 (2026-04-26).** The two-key model (K_read / K_origin) remains in effect. The two-form addressing (private fragment vs. public path) is **superseded** — v1 ships a single canonical form (fragment only). The public path-form was removed; cross-post link previews no longer unfurl on social platforms by design. See ADR-021 for rationale and ADR-019 (also amended) for indicator implications.

## Status

Superseded in part by ADR-021. Original status: accepted (2026-04-24).

## Context

ADR-003 establishes that encryption is mandatory and the host is blind by default. That creates a real tension: the host cannot render rich OG-preview cards for crawlers (iMessage / Slack / X), because crawler fetches don't carry URL fragments. The cross-post use case ("publish on MOP, share the URL on Twitter to drive clicks") suffers — every cross-posted Hypermessage unfurls as a generic ciphertext card.

The user chose to resolve this by accepting a **deliberate opt-in leak** of the key to the host when the user wants rich previews — but only when the user explicitly opts in, and with the user fully aware of the trade-off. The default must remain host-blind.

Separately, the protocol needs to distinguish two distinct capabilities per object:
- **Read** capability — can decrypt body content
- **Origin** capability — can decrypt replies, can authorize delete/burn

Conflating them would mean any recipient could delete the object or read replies meant for the author. Splitting them keeps capability boundaries clean.

## Decision

### Two-key model (per object)

| Key | Type | Held by | Powers |
|-----|------|---------|--------|
| **K_read** | Symmetric (AES-256-GCM) | Anyone with the share URL | Decrypts the body ciphertext |
| **K_origin** | Asymmetric private key (secp256k1) | Author only, in a private URL stored device-local | Decrypts replies encrypted to `K_origin_pub`; signs delete/burn requests; future: any author-side admin action |

`K_origin_pub` is stored alongside the object on the server so reply-senders can encrypt to it without needing anything beyond the share URL.

### Two-form addressing (per object)

The same ciphertext blob is addressable two ways. The user toggles per-share at compose time.

| Form | URL pattern | Host visibility | Use case |
|------|-------------|-----------------|----------|
| **Private** (default) | `mop.app/m/{id}#{K_read}` | Host stays blind — fragment never reaches server | Whisper-network, intro/ask routing, sensitive use |
| **Public** | `mop.app/m/{id}/{K_read}` (or `?k={K_read}`) | Host can decrypt server-side and render rich OG cards | Cross-post to Twitter / public broadcast |

Once a public-form URL is published, that URL is permanently archive-eligible and the host has seen the key. No take-backs. The user accepts this trade-off explicitly when toggling.

### Compose UX commitment

The composer surfaces a **1-click slider toggle** between Private (default) and Public. Same UX pattern as the persistence toggle (see ADR-006). This makes the privacy choice visible and deliberate on every share.

## Consequences

### Positive

- Whisper-network and intro/ask use cases keep their host-blind property by default.
- Cross-post use case gets rich unfurls when the user wants them, without forcing every Hypermessage to leak.
- Author retains exclusive control over deletion and reply access via K_origin, even though anyone with the share URL can read.
- K_origin's pubkey lives with the object so reply senders need no out-of-band coordination.
- The two URL forms point at the *same* underlying ciphertext — no storage duplication.

### Negative

- Two URL forms per object adds composer-UX complexity; user must understand the trade-off (mitigated by 1-click slider with clear labels).
- Public form is irreversible — if user accidentally shares public when they meant private, the key is permanently in the host's logs. UX must make accidental selection hard.
- Server-side OG rendering for public form requires a render path that does symmetric decryption; new code surface for the host.
- Public form's permanence interacts with ADR-006 burn-by-default: once a key has leaked to the host and crawlers have cached the unfurl, deleting from the host doesn't reclaim privacy. Documented; not architecturally fixable.

### Neutral

- The choice between path-form (`/m/id/K`) and query-form (`/m/id?k=K`) is a syntactic detail — both work; preference is path-form for cleaner URLs. Implementation can pick either.
- Reply-form addressing (how a reply-sender knows where to POST) is a separate question — pending design, see backlog.

## Open follow-ons

- Should public-form share also display a visible "this is the public form" banner on the rendered page, so a recipient who only ever sees public-form URLs knows what they're holding?
- Is there a useful "preview-only" key (a third key) that allows host to render a *teaser* but not full body, for users who want minimal-leak unfurls? Probably overkill; flagged for backlog.
