---
type: decision
adr_id: adr_014
adr_number: 14
title: "Single canonical renderer; first-party clients only across web + iOS + Android in v1"
status: accepted
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, renderer, clients, trust-posture, v1]
---

# ADR-014: Single Canonical Renderer; First-Party Clients Only Across Web + iOS + Android in v1

## Status

Accepted (v1 trust-posture decision).

## Context

The renderer is the security-critical surface of MOP (per ADR-007 and ADR-011): client-side decryption, body parsing, capability traversal, OG fetch, recursion-cap enforcement, cycle detection. Whatever runs the renderer holds the user's `K_origin` keys and the plaintext of every object they read.

The trust posture for clients in v1 forks two ways:

- **(a) Single canonical renderer, first-party clients only.** Apple-style. One implementation owner. Maximum attack-surface control, brand coherence, predictable rendering. Tighter ecosystem.
- **(b) Open renderer spec, anyone can build a client.** Nostr-style. Maximum reach, brittleness-aligned with VISION P4, but every third-party client is a new attack surface and a new behavioral variant.

User selected (a) for v1, with three first-party implementations (web, iOS, Android). This ADR records that posture and its implications.

## Decision

### v1 client surface is first-party only

1. **Single canonical renderer.** The MOP project ships *the* renderer; third-party renderers are not supported in v1. "Not supported" means: no compatibility promise, no advertisement on the canonical host, no API stability guarantee for client builders.

2. **Three first-party surfaces.** The canonical renderer ships in three implementations:
   - **Web** — the canonical domain (S2 pending) hosting a browser app.
   - **iOS** — native app via Apple App Store.
   - **Android** — native app via Google Play.

   All three are operated by the project entity. They share a documented internal behavioral contract so that rendering, capability handling, and cryptographic operations are identical across surfaces.

3. **Implementation strategy is deferred.** Whether the three surfaces share a TypeScript-or-Rust core (compiled to WASM for native shells) or are three independent ports of the same spec is an implementation-phase question. The commitment is *behavioral identity*, not *code identity*.

4. **Native ship dates are not promised by this ADR.** The commitment is "first-party only when shipped." Web is the v1 launch surface; iOS and Android follow per a roadmap separate from this decision. A user encountering MOP via the web app at launch and via a native app six months later sees the same renderer behavior either way.

5. **Reading the protocol is permitted; building unsupported clients is permitted.** Nothing prevents a third party from reading the open protocol and building a non-canonical client. The project simply does not endorse, support, or maintain compatibility with such clients in v1. This preserves cypherpunk-spirit openness without paying the v1 cost of supporting it.

### What this ADR does not commit to

- **No federation of clients in v1.** All three first-party clients trust a single canonical host (S2 pending, currently `mop.app` placeholder).
- **No published renderer spec for third parties in v1.** May follow post-v1 if ecosystem demand emerges; not rejected, just deferred.
- **No browser-extension renderer, no share-sheet renderer.** Out of scope until iOS/Android native shells settle.

## Consequences

### Positive

- **Security audit is tractable.** One renderer (three implementations of one contract) is auditable; an open ecosystem of renderers is not.
- **Brand and behavioral coherence.** A Hypermessage rendered on web looks and acts identical to one rendered on iOS. No "depends on which client you opened it in."
- **Renderer bugs are fixed once and propagate predictably** across the three first-party surfaces.
- **No client-negotiation protocol needed.** Clients and host share a single behavioral contract; no version-skew handshake, no capability negotiation.
- **Clean answer to "is this a phishing client?" in v1.** Anything that isn't one of the three first-party shells is not a MOP client.

### Negative

- **Native apps are real engineering scope.** App store accounts, review cycles, signing infrastructure, platform-specific crypto considerations (iOS Secure Enclave, Android Keystore for `K_origin` storage), push notification infrastructure if/when notifications layer on (ADR-010 keeps notifications client-concern).
- **Tension with VISION P4 (brittleness as feature).** Canonical clients are a centralization vector; a single project entity can fail in ways that take all three surfaces down. Partial mitigation: the protocol stays open and replicable, so a successor project could resurrect canonical clients elsewhere; only the v1 *client surface* is canonical, not the protocol itself.
- **Cypherpunk-aligned audiences may object** to "single canonical client" as Apple-coded centralization. Real critique; accepted as v1 posture; revisitable post-v1.
- **Third-party innovation is gated.** A community member who wants to build a CLI client, a terminal renderer, or an experimental UX cannot get a v1 endorsement.

### Neutral

- **The internal renderer-contract spec** that holds the three implementations to identical behavior is not yet written. Tracked as implementation-phase work.
- **Forward-only revisability.** A future ADR can publish a renderer spec and welcome third-party clients without breaking v1 first-party clients. The reverse direction (closing an open ecosystem) would be a breaking trust change, but is not the expected direction of revision.

## Alternatives considered

- **Option (b) — Open renderer spec, third-party clients welcome from day one.** Rejected for v1: security-audit and brand-coherence costs at launch outweigh ecosystem-reach gains while user base is small. Revisitable post-v1.
- **Web-only canonical, native open.** Rejected as incoherent — the renderer is either canonical or it isn't; surfaces are not the right axis to fork on.
- **Web canonical at launch, native later as third-party.** Rejected by user instruction — all three surfaces are first-party.

## Open follow-ons

- **Internal renderer-contract spec** — the behavioral contract that holds web/iOS/Android to identity. Implementation-phase artifact.
- **Native crypto library selection per platform** — secp256k1 + BIP-32 + BIP-39 implementations on iOS and Android, with Secure Enclave / Keystore integration for `K_origin` storage where viable.
- **App store submission strategy** — Apple's review of E2E-encrypted ephemeral-message apps has historical friction; flagged.
- **Post-v1 third-party renderer spec** — when (if) to publish it; what conformance test suite looks like.
- **Push-notification infrastructure** for native shells (ADR-010 leaves this as client-app concern; native apps make it concrete).
