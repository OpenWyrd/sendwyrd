---
type: spec
subtype: formal_verification
created: 2026-04-28
updated: 2026-04-28
last_edited_by: agent_operator
status: draft
tags: [formal-verification, tier3, property-tests, mop]
---

# Tier 3 — Property-based tests

Integration regression tests against the public API of `@openwyrd/mop`,
serving as evidence for the spec-implementation correspondence the
formal verification effort proves at the abstract layer.

## Properties

| ID | Property | What it verifies |
|---|---|---|
| P1 | Envelope round-trip | `encrypt(plaintext) → decrypt → plaintext` |
| P2 | AAD tamper integrity | Mutating `handle`, `expires_at`, or `replies_enabled` fails decrypt |
| P3 | Wrong-key rejection | Decrypt with a different K_read fails |
| P4 | HD K_read determinism | Same `(seed, n)` → same K_read |
| P5 | HD K_read distinctness | Distinct `n` → distinct K_read |
| P6 | HD seed isolation | Distinct seeds → distinct K_read |
| P7 | K_origin / K_read domain separation | The HKDF info string keeps the two derivations disjoint |
| P8 | Reply blob round-trip | `encryptReply → decryptReply → plaintext` |
| P9 | Reply handle-binding | A blob produced for handle₁ fails decryption under handle₂ (AAD binds handle) |

## Run

From the repo root, with the workspace dependencies installed:

```bash
cd packages/core
pnpm exec tsx ../../what/docs/formal/tests/property_tests.ts
```

Each property runs 10 to 50 iterations with fresh random inputs.

## Status

Last run: 2026-04-28 — **400 / 400** checks passed (`property_tests.results.txt`).

## Why these tests live here, not in `packages/core/test/`

The `@sendwyrd/core` package is now a deprecated re-export shim
(see `packages/core/package.json`); authoritative tests for the crypto
implementation live in the `@openwyrd/mop` source repo (`mop-js`),
which is published to npm and is not checked out in this repo.

These tests are not a replacement for that suite. They are part of the
**verification effort** in `what/docs/formal/`: their job is to detect
drift between this repo's spec (`spec_mop_v1.md`), the symbolic model
(`mop_v1.pv`), the computational proofs, and the implementation that
ships on npm.
