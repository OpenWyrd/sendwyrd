---
type: decision
adr_id: adr_003
adr_number: 3
title: "Capability-based privacy posture: encryption mandatory, host-blind, no accounts"
status: accepted
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_michael
supersedes:
superseded_by:
tags: [adr, decision, mop, privacy, crypto, identity]
---

# ADR-003: Capability-Based Privacy Posture

## Status

Accepted (v1 architecture decision).

## Context

The Hypermessage architecture pack (v1) treated client-side encryption as **optional / Phase 2** (§7, §20) and described a separate "encrypted mode" alongside an unencrypted default. During architecture-resolution discussion the user committed to a stronger posture:

1. Every Hypermessage must be cryptographically hidden from the host server.
2. There must be no anti-crawl apparatus (robots.txt, noindex headers); URLs are openly crawlable. Encryption itself is the privacy gate, so crawler indexing of ciphertext yields nothing useful.
3. There must be no accounts, no PKI hierarchy, no identity primitive at the protocol level. Identity, if a user wants it, is either inlined in the body (e.g., a Nostr signature) or carried by the share channel ("Mike sent me this").

This rewrites the staging plan in pack §20 (Phase 1 was unencrypted-basic) and the "encryption is optional" framing in §7.

## Decision

**Three coupled commitments**, treated as a single architectural posture:

1. **Encryption is mandatory in v1.** Every Hypermessage body is encrypted client-side before transmission to the server. The server only ever stores ciphertext. There is no unencrypted mode.

2. **Host is cryptographically blind by default.** The default URL form keeps the symmetric content key in the URL **fragment** (`#K`), which never traverses HTTP requests per RFC 3986. The host therefore cannot decrypt body content. (See ADR-004 for the public-form addressing that allows the user to deliberately leak the key to the host for cross-post unfurl rendering.)

3. **No accounts, no protocol-level identity.** Author capability is a private URL the user holds locally. Recipient capability is the share URL itself. Possession of the URL implies access. The protocol never models who a user is across multiple objects.

## Consequences

### Positive

- Search engines and archive crawlers cannot meaningfully index Hypermessage content — they fetch ciphertext, period. No anti-crawl machinery needed.
- Host-operator compromise / breach exposes only ciphertext + reply public keys, not bodies.
- Privacy is a property of *key distribution* rather than *URL secrecy*: a bare URL shared publicly leaks nothing; a `URL#K` shared privately stays private; cross-posting is an explicit user choice (see ADR-004).
- No account system means no signup friction, no password recovery, no auth surface to attack.
- Cleanly composes with external identity systems (Nostr, PGP) via endogenous extensibility — the user can inline whatever identity they want.

### Negative

- Third-party messaging-app unfurl crawlers (iMessage / Slack / X) cannot see fragment keys, so default unfurls cannot show body content. Resolved by ADR-004's two-form addressing, which lets the user opt into a public form when rich previews matter (cross-post use case).
- All rendering is client-side. Server cannot generate static HTML with body content for SEO, social previews, or accessibility tooling.
- Recursive transclusion of references must happen client-side (the parent's renderer fetches and decrypts each referenced object using keys embedded in the parent body — see ADR-007).
- No password / account recovery story. Author loses K_origin → loses delete authority and reply access for that object. Aligns with ADR-006 brittleness posture but is a real cost.

### Neutral

- WebCrypto API doesn't natively support secp256k1 (used per ADR-005). Client crypto needs a JS library (`noble-secp256k1`, ~30–50KB). Acceptable.
- This decision rewrites architecture pack §7 ("optional encryption") and §20 ("Phase 1 = unencrypted").

## Open follow-ons

- Anti-abuse: with no accounts, abuse mitigation moves entirely to PoW + per-IP rate-limits + edge protection (Cloudflare). PoW is likely the primary control, not the secondary. Pending design.
- Storage encryption-at-rest (server-side) is *additional* hardening on top of client-side encryption — defense in depth, since K is only ever in URL fragments and never reaches the server. To be confirmed.
