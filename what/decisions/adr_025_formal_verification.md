---
type: decision
adr_id: adr_025
adr_number: 25
title: "Formal verification effort — symbolic (ProVerif) + computational (CryptoVerif/hand-written) + property-based regression"
status: accepted
created: 2026-04-28
updated: 2026-04-28
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, security, formal-verification, proverif, cryptoverif, tier1, tier2, tier3]
---

# ADR-025: Formal Verification Effort

## Status

Accepted.

## Context

OpenWyrd MOP v1's security claims are scattered across the wire spec (`spec_mop_v1.md`), the renderer contract (`renderer_contract_v1.md`), and a series of ADRs (003, 005, 008, 017, 020, 022, 024). The claims include:

- The host is body-blind (ADR-003) — i.e., the canonical relay cannot decrypt bodies regardless of how it behaves on the wire.
- Reply blobs are confidential to the wyrd's author (ADR-008) — anyone with the URL can produce a blob, but only `K_origin_priv` can decrypt.
- Publish and burn are authenticated under `K_origin_priv` via BIP-340 Schnorr (ADR-005, ADR-017, §9, §12).
- AAD binding to `(handle, expires_at, replies_enabled)` makes the host unable to tamper with metadata without breaking AES-GCM tag verification (§7.2).
- HD derivation `m/300'/n'` plus the per-wyrd `K_read` HKDF derivation (ADR-022) gives recovery of authorship + readability from the BIP-39 seed without granting cross-wyrd linkability to a network observer.
- The protocol carries no recipient model (ADR-024).

Each claim is plausible, and the implementation has unit + integration tests, but the protocol-level reasoning has lived in informal prose and individual ADRs. There is no single artifact a third-party reviewer (or a future contributor proposing a wire change) can consult to verify that "the spec actually delivers on its security promises" — and there is no guarantee that the reductions to standard cryptographic assumptions are sound.

A formal verification pass closes that gap. It is also a near-prerequisite for:

- Any external security review that would otherwise have to redo the analysis from scratch.
- NIP-C6 (the user-authored Nostr NIP that builds on capability-URL primitives) progressing toward formal Nostr-protocol status, which expects rigorous security analysis.
- A v2 ADR proposing wire changes — without a baseline formal artifact, the burden of "show this doesn't break security" falls on prose review.

Three layers of verification are technically meaningful, with diminishing tractability:

| Tier | Method | What it proves | Effort |
|---|---|---|---|
| 1 | Symbolic (Dolev-Yao) — ProVerif | Logic-level protocol soundness, treating primitives as ideal black boxes | 1–2 days |
| 2 | Computational — CryptoVerif or hand-written game hops | Reduces each property to standard hardness assumptions with concrete advantage bounds | 2–5 days hand-written; 5–15 days mechanized |
| 3 | Implementation — hacspec / F* / property tests | Catches bugs in the actual code, not the abstract protocol | Ongoing |

Tier 3 in its strongest form (verified F* extraction) is far out of scope for v1. The achievable Tier 3 contribution is a property-based regression suite that catches drift between the spec, the symbolic model, and the published library.

## Decision

We commit to all three tiers as durable artifacts in this repo, at the following levels:

### Tier 1 — symbolic (canonical, non-negotiable)

**Tool:** ProVerif 2.05 (typed pi-calculus front-end).

**Artifact location:** `what/docs/formal/proverif/`.

**Properties verified:** body confidentiality, reply confidentiality, publish authentication (with AAD-binding integrity), burn authorization. Each query is scoped to honest `K_origin_pub` values where authentication is meaningful (the protocol is open-publish, so raw "no forgery" without the honest scoping is provably false — and that is correct, not a defect).

**Cadence:** the model MUST be updated alongside any spec change that touches wire-level construction (envelope, AAD layout, signed-message format, ECIES info string, presence-check). The Tier 1 report (`tier1_symbolic_verification.md`) MUST be re-run after each such update; if any query begins returning `is false`, the spec change is gated on resolving the issue.

### Tier 2 — computational (canonical, hand-written; mechanized incrementally)

**Tools:** CryptoVerif 2.12 for mechanized proofs; hand-written reductions in the game-hopping style for theorems pending mechanization.

**Artifact location:** `what/docs/formal/computational/`.

**Theorems:**

| # | Property | Reduces to |
|---|---|---|
| 1 | Body confidentiality | HKDF-PRF + AES-GCM IND-CCA-AEAD |
| 2 | Publish unforgeability | BIP-340 Schnorr EUF-CMA + SHA-256 collision |
| 3 | Burn authorization | BIP-340 Schnorr EUF-CMA |
| 4 | Reply confidentiality | secp256k1 ODH + AES-GCM IND-CCA-AEAD |
| 5 | Cross-wyrd K_origin pseudonymity | HMAC-SHA512 PRF |
| 6 (corollary) | AAD integrity | Composition of 2 + AES-GCM INT-CTXT |
| 7 (composition) | System | Sum of the above |

Theorem 1 is mechanized in CryptoVerif (`mop_body_confidentiality.ocv`) and runs to "All queries proved" automatically. Theorems 2–6 are hand-written; mechanizing them is on the roadmap (see §Roadmap) and is recommended pre-external-review.

**Cadence:** any spec change that affects key derivation, envelope construction, or signature scope MUST be reflected in the Tier 2 report, and the affected theorems re-stated. Mechanized theorems MUST be re-run.

### Tier 3 — property-based regression (canonical, runnable, light-weight)

**Tool:** plain TypeScript using the published `@openwyrd/mop` API and Web Crypto.

**Artifact location:** `what/docs/formal/tests/`.

**What it covers:** envelope round-trip, AAD tamper integrity, wrong-key rejection, HD `K_read` determinism / distinctness / seed isolation, K_origin/K_read domain separation, reply round-trip, reply handle-binding. 9 properties, ~400 random checks per run.

**What it does NOT cover:** unit-level correctness of `@openwyrd/mop` internals — those live in the `mop-js` repo's test suite. Tier 3 here is a *spec-implementation correspondence* harness, not a unit-test suite.

**Cadence:** runs on demand from the formal directory; should be run before publishing a new `@openwyrd/mop` version to catch any drift from the spec.

## Threat-model boundary

The Tier 1 model captures a **Dolev-Yao adversary that controls the public network and doubles as the canonical SendWyrd host**. The adversary can read every wire message, inject any message, schedule sessions adversarially, and corrupt the host's storage. The adversary cannot read the safe out-of-band rail (modelling iMessage / Signal / personal trust), cannot read the user's BIP-39 seed, and cannot break the underlying primitives.

What the verification does **not** address (and is documented as such in the reports):

- Side-channel leakage (timing, traffic-analysis, browser fingerprinting).
- Browser-side fragment leakage via referrer or clipboard.
- The user's seed being copied into an untrusted process.
- Implementation bugs in the JavaScript/Web Crypto stack itself.
- Post-quantum attackers (Schnorr/ECDH break under Shor; AES/HMAC weaken under Grover).

These are real threats; they are out of scope for the v1 formal effort and should not be claimed as covered.

## Consequences

Positive:

- Spec changes go through a formal-verification gate, not just review.
- External security reviewers can audit a single artifact rather than reconstructing the analysis.
- The artifact is reusable for NIP-C6 and any downstream protocol that builds on capability-URL primitives.
- The Tier 3 harness catches mop-js regressions early.

Negative:

- Spec velocity is reduced: every wire-level change now incurs a model + theorem + (possibly) machine-check update.
- The hand-written Tier 2 proofs have not been peer-reviewed; they are correct to the best of the author's ability but a reviewer might find a bug. The CryptoVerif mechanization of Theorem 1 partially mitigates this; mechanizing 2–6 closes the remaining gap.

Neutral:

- The verification effort lives in `what/docs/formal/` and is discoverable from `MANIFEST.md`, `STATE.md`, and `what/docs/spec/spec_mop_v1.md` cross-references.

## Roadmap

In priority order, the formal-verification follow-ups recommended after this ADR:

1. Mechanize Theorem 2 (publish unforgeability) in CryptoVerif using BIP-340 + ROM.
2. Mechanize Theorem 4 (reply confidentiality) using ODH + AEAD.
3. Mechanize Theorem 5 (cross-wyrd pseudonymity) using HMAC-SHA512 PRF.
4. Add a CI workflow that re-runs ProVerif and the property-based tests on each PR that touches `spec_mop_v1.md`, `packages/api/`, or `packages/web/src/lib/wyrd*`.
5. After all five theorems are mechanized: external security review.

## References

- Tier 1 model: `what/docs/formal/proverif/mop_v1.pv`
- Tier 1 report: `what/docs/formal/proverif/tier1_symbolic_verification.md`
- Tier 2 report: `what/docs/formal/computational/tier2_computational_proofs.md`
- Tier 2 mechanization (Theorem 1): `what/docs/formal/computational/mop_body_confidentiality.ocv`
- Tier 3 tests: `what/docs/formal/tests/property_tests.ts`
- Spec: `what/docs/spec/spec_mop_v1.md` v1.0.7-draft.
- Related ADRs: 003, 005, 008, 017, 020, 022, 024.
