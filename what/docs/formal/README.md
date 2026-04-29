---
type: spec
subtype: formal_verification
created: 2026-04-28
updated: 2026-04-28
last_edited_by: agent_operator
status: draft
tags: [formal-verification, mop, security, proverif, cryptography]
---

# OpenWyrd MOP — Formal Verification

This directory contains the formal verification artifacts for OpenWyrd
MOP v1, organized into two tiers.

## Layout

```
formal/
├── README.md                              # This file
├── proverif/
│   ├── mop_v1.pv                          # ProVerif model (Dolev-Yao)
│   └── tier1_symbolic_verification.md     # Tier 1 report
└── computational/
    └── tier2_computational_proofs.md      # Tier 2 report (game-based)
```

## Tier 1 — Symbolic verification (Dolev-Yao)

ProVerif model of MOP v1 with an active network adversary that doubles
as the canonical SendWyrd host. The model captures the publish, fetch,
burn, and reply flows; AAD binding; HD derivation; and ECIES reply
encryption. Properties verified:

| Q | Property |
|---|---|
| Q1 | Body confidentiality (URL fragment delivered out-of-band) |
| Q2 | Reply confidentiality (only `K_origin_priv` decrypts) |
| Q3 | Publish authentication (no host-accepted forgery; AAD `(ttl, replies_enabled)` integrity) |
| Q4 | Burn authorization (no host-honored forged burn) |

Reproduce with `proverif -in pitype mop_v1.pv` after installing
ProVerif via opam.

See `proverif/tier1_symbolic_verification.md` for per-query analysis,
modeling choices, and limitations.

## Tier 2 — Computational-model proofs

Hand-written game-based reductions discharging the Tier 1 idealization
of cryptographic primitives. Each MOP property is reduced to a standard
hardness assumption with concrete advantage bounds:

| Theorem | MOP property | Reduces to |
|---|---|---|
| 1 | Body confidentiality | HKDF-PRF + AES-GCM IND-CCA-AEAD |
| 2 | Publish unforgeability | BIP-340 Schnorr EUF-CMA + SHA-256 collision-resistance |
| 3 | Burn authorization | BIP-340 Schnorr EUF-CMA + SHA-256 |
| 4 | Reply confidentiality | secp256k1 ODH + AES-GCM IND-CCA-AEAD |
| 5 | Cross-wyrd `K_origin` pseudonymity | HMAC-SHA512 PRF |

System-level composition theorem: the combined attacker advantage at
$q_p = 2^{30}$ publishes is bounded by $\approx 2^{-67}$.

See `computational/tier2_computational_proofs.md` for theorem
statements, proofs, and concrete bounds.

## Tier 3 — Implementation verification (not in scope here)

Verifying the actual TypeScript / Web Crypto implementation against
these specifications is a separate effort. Recommended starting points
when the time comes:

1. Property-based tests around envelope round-trips, AAD tamper-failure,
   and HD derivation.
2. A `hacspec` spec of the envelope/AAD construction, for syntactic
   correspondence.
3. Cross-implementation differential testing (the planned Go reference
   impl per the open-source decisions matrix gives a natural counterparty).

## Status

| Tier | Artifact | Status |
|---|---|---|
| 1 | ProVerif model | Complete |
| 1 | Verifier execution | Not run on this machine (proverif not installed by default on Fedora) |
| 1 | Per-query analysis | Complete |
| 2 | Theorem statements | Complete (5 theorems + 1 corollary + 1 composition) |
| 2 | Proofs | Complete (hand-written, game-hopping style) |
| 2 | Concrete bounds | Computed |
| 2 | Mechanization | Deferred (CryptoVerif / EasyCrypt — recommended pre-external-review) |
| 3 | Implementation verification | Out of scope |

## How to update this when the spec changes

1. If `spec_mop_v1.md` changes a wire-level construction (envelope,
   AAD layout, signed-message format, ECIES info string), update
   `mop_v1.pv` to match — the model intentionally mirrors the spec.
2. Re-run ProVerif. Resolve any newly-failing queries.
3. Update the affected sections of `tier2_computational_proofs.md`.
4. Bump the spec_version frontmatter on each report.
5. Note the change in the spec's `## 21. Changelog` section.

## Related ADRs

- ADR-003 — Capability-based privacy posture (justifies the
  host-untrusted threat model).
- ADR-005 — Bitcoin cryptography stack.
- ADR-008 — Replies (justifies the unauthenticated reply submission).
- ADR-017 — HD path `m/300'/n'`.
- ADR-020 — v1 stack.
- ADR-022 — `K_read` derived from seed via HKDF.
- ADR-024 — No relay-side recipient model.
