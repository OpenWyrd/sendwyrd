---
type: decision
adr_id: adr_017
adr_number: 17
title: "HD path convention: BIP-43 flat purpose 300', hardened indices"
status: accepted
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, hd, bip32, bip39, bip43, crypto, k_origin]
---

# ADR-017: HD Path Convention — BIP-43 Flat Purpose `300'`, Hardened Indices

## Status

Accepted (closes backlog item B6).

## Context

ADR-005 banked the Bitcoin cryptography stack: secp256k1 + BIP-32 hardened HD + BIP-39 mnemonic. ADR-006 banked per-object `K_origin` keypairs (each wyrd has its own origin keypair, derived from a master seed). ADR-009 banked client-side inbox aggregation: the client holds the seed, derives every per-object `K_origin_priv` locally, and fetches each per-object reply endpoint independently — host stays per-object blind.

The HD path shape was left open as B6. The fork:

- **(a) BIP-44 full**: `m/44'/<coin>'/<account>'/<change>/<index>` — five levels with coin/account/change semantics. Requires a SLIP-44 coin type; none registered for MOP. Coin/change semantics do not apply to a non-coin protocol.
- **(b) BIP-43 flat with custom purpose**: `m/<purpose>'/<index>'` — purpose-coded prefix prevents collision with BIP-44 wallets on the same seed; no coin/account/change baggage.
- **(c) Raw HD with no purpose code**: `m/<index>'` — collides with any other app deriving from `m/0'`, `m/1'` on the same seed.

Per ADR-009, the host never derives child pubkeys from a master pubkey — the client does all derivation locally. This means we do **not** need non-hardened derivation anywhere in the path; the pubkey-tree property is irrelevant. Hardening throughout maximizes security at zero cost to our model.

## Decision

### Path shape

```
m / 300' / n'
```

Two hardened levels:
1. **Purpose `300'`** — BIP-43 purpose code. The number 300 is the Spartan-300 cultural anchor, matching ADR-012's body cap. No SLIP-44 coin type is needed because MOP is not a coin. The purpose code is prefix-collision-safe with any BIP-44 wallet sharing the same seed (BIP-44 paths begin with `44'`, not `300'`).
2. **Index `n'`** — hardened, monotonically increasing per-wyrd index on a given seed. Each new published wyrd consumes the next free index.

### Why hardened throughout

- **Security**: hardened derivation prevents a leaked child private key from compromising sibling keys. With non-hardened derivation, a leaked `K_origin_priv_n` plus the parent extended pubkey would let an attacker derive every other `K_origin_priv` on the seed. Hardened derivation eliminates this attack class.
- **No use case for non-hardened**: per ADR-009, only the client (which holds the full seed) ever derives child keys. Sharing a master pubkey to a third party for derivation would be a metadata leak (the host or any holder could enumerate all wyrds on this seed by deriving children). We never want that.

### Why no account level

- Spartan ethos: Spartan paths. Two levels suffice for v1.
- A single human user with a single seed maps to a single publishing identity in v1. Multi-account / multi-identity / multi-device-with-different-keys is not a v1 concern.
- If multi-account becomes needed post-v1, a future ADR can introduce an account level via `m/300'/<account>'/n'` migration. Indexes `n'` published under the v1 path become equivalent to `m/300'/0'/n'` under the migrated path.

### Index management

- The client persists a **next-free-index counter** (`next_n`) device-local alongside the encrypted seed.
- On publish, the client uses `n = next_n`, increments `next_n`, and persists.
- On recovery (BIP-39 import on a fresh device), the client performs a **sweep**: derive `K_origin_pub` for `n = 0, 1, 2, …`, query the canonical host for object existence at each derived address, stop after a configurable gap (e.g., 20 consecutive empty indices, mirroring the BIP-44 gap-limit convention).
- Sweep is one-shot at recovery; counter resumes from highest-found-index + 1.

### Master inbox URL encoding

The "master inbox URL" referenced in ADR-009 encodes only what the client needs to derive the publishing branch. With this path, that is the seed itself (encoded as a BIP-39 mnemonic, or a base58check'd seed bytes blob, or an `xprv` rooted at `m/300'`). The exact encoding format is implementation-spec work, not ADR-level. The host never sees this URL — it is held device-local and optionally backed up via BIP-39 mnemonic export.

## Consequences

### Positive

- **Collision-safe with BIP-44 wallets** sharing the same seed. A user can use the same BIP-39 seed for SendWyrd and a Bitcoin/Ethereum/Nostr wallet without path collision.
- **Maximum private-key isolation** via end-to-end hardening. A compromise of one wyrd's `K_origin_priv` does not leak siblings.
- **Spartan path matches Spartan architecture**. Two levels, both hardened, no ceremony.
- **Recovery is mechanical**: BIP-39 import + index sweep. No metadata blob needed beyond the seed.
- **Forward-compatible**: future multi-account expansion is a non-breaking migration to a three-level path.

### Negative

- **Custom purpose code `300'` is not registered with the BIP-43 unallocated-space registry.** This is theoretically a future-collision risk if another protocol chooses `300'` for a different purpose. Mitigation: the BIP-43 unallocated registry is not authoritative; collisions in practice are rare; if a high-profile collision emerges we can ADR a migration.
- **Sweep on recovery has a gap-limit cost.** A user who skips many indices (improbable on this design — index increment is monotonic on publish) could lose objects past the gap limit. Mitigation: gap limit is configurable; canonical recovery flow uses a generous default.
- **Index counter is device-local state** that must survive seed backup/restore. If the user restores their seed but loses the counter, sweep recovers but the counter resets cleanly. Acceptable.

### Neutral

- The path shape is a wire-format-adjacent choice but is not visible on the wire — only in the client's seed-and-counter state and in the per-object `K_origin_pub` that the host stores. The host does not know the path; it only sees one `K_origin_pub` per object.
- The master inbox URL encoding format is deferred to wire-spec work (Phase B).

## Alternatives considered

- **(a) BIP-44 full** — rejected. Coin type / account / change semantics are coin-wallet concepts that have no analog in MOP. Adopting them as ceremonial structure would add three levels of path with no useful meaning.
- **(c) Raw HD `m/n'`** — rejected. Collides with any other app deriving from low indices on the same seed. Real-world risk if a user reuses their SendWyrd seed for a Bitcoin wallet (or vice versa).
- **(d) Three-level future-proofed `m/300'/0'/n'`** — rejected as premature ceremony. The account level can be added later if needed; we do not need it now.
- **Non-hardened indices (`m/300'/n` without prime)** — rejected. Enables a class of attack (leaked key + parent xpub = sibling key recovery) for zero benefit in our model.

## Open follow-ons

- **Master inbox URL encoding format** — implementation-spec work in Phase B (wire spec).
- **Gap-limit default for sweep** — operational tuning; canonical default to be set in implementation. BIP-44 convention is 20.
- **Multi-account migration path** — deferred until a v2 ADR establishes the need.
- **Cross-device counter sync** — out of scope for v1; a user with multiple devices on the same seed must coordinate their counters or accept index collisions on simultaneous publish (host will reject duplicate `K_origin_pub` at publish time, surfacing the conflict).
