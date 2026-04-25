---
type: decision
adr_id: adr_005
adr_number: 5
title: "Bitcoin cryptography stack: secp256k1 + BIP-32 hardened HD + BIP-39"
status: accepted
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, crypto, hd-keys, bitcoin]
---

# ADR-005: Bitcoin Cryptography Stack with Hierarchical Deterministic Keys

## Status

Accepted (v1 architecture decision).

## Context

ADR-004 establishes that each object has its own asymmetric `K_origin` keypair, held by the author. ADR-006 (forthcoming, drafted alongside) commits to per-object `K_origin` rather than a single master key — primarily for host-blind cross-correlation (a master would let the host trivially link "all these objects share an author").

This raises a cross-device portability problem: if the user creates 200 objects on their phone, each with a fresh K_origin, losing the phone loses access to all of them. The brittleness principle (VISION P4) says *some* loss is intentional; it does not say *all* recovery must be impossible.

The user proposed using Bitcoin's hierarchical deterministic (HD) key derivation: a master seed deterministically generates a tree of child keys. With **hardened derivation** (`m/n'`), even an attacker holding the extended public key cannot derive children — they appear unlinkable to the host while remaining recoverable by the seed-holder.

This gives us the privacy property of fresh-random keys *and* an optional recovery path, with a single backup unit (the seed phrase).

## Decision

### Curve: secp256k1

Used by Bitcoin, Ethereum, and Nostr. Alternative was Ed25519/Curve25519 (used by Signal, age, modern WebCrypto). secp256k1 was chosen because:

- Native composition with Nostr — users can inline-sign body content with their npub for endogenous identity (VISION P2) without curve mismatch.
- Familiar to the cypherpunk-adjacent audience MOP is most likely to land with first.
- Hardware wallet compatibility potentially available (Ledger / Trezor support secp256k1 natively).

### Key derivation: BIP-32 hardened HD

Each user has a master seed (256-bit). Per-object `K_origin` keypairs are derived as hardened children:

```
K_origin[n] = derive(master_seed, m/0'/{n}')   for object index n = 0, 1, 2, ...
```

Hardened derivation is mandatory — non-hardened would leak cross-object linkability if any extended pubkey ever leaked.

`K_read` (symmetric AES-256-GCM, per object) is **not** HD-derived. It is generated fresh per object via CSPRNG and embedded in the share URL. The URL itself is the read access; recovery isn't needed because anyone with the URL has K_read.

### Backup format: BIP-39 mnemonic

Standard 12-word or 24-word mnemonic. Default UX never surfaces the seed phrase — the device just stores the master seed locally. Power users can opt into seed-phrase export for cross-device recovery. This preserves brittleness-by-default (VISION P4) while making robustness-by-choice possible.

### What lives on the device

- Master seed (or an OS-keystore reference to it)
- A local list of `(object_id, derivation_index)` pairs — the device's "feed" of objects the user has authored
- For each authored object: a cached copy of the K_origin private URL the user can revisit

A user who exports the seed and the index list can fully recover on a new device. A user who only exports the seed needs to remember (or re-fetch) which object IDs they own, then re-derive K_origin per object.

## Consequences

### Positive

- **Host-blind cross-correlation preserved.** Hardened derivation means each `K_origin_pub` looks like an independent random point on the curve to the host — the privacy property of fresh-random keys, kept.
- **Optional cross-device recovery.** One seed phrase recovers all author-side capability. No per-object backup.
- **Composable with Nostr.** Same curve; users who want persistent endogenous identity can inline an npub signature in any body — the protocol stays naked (VISION P2).
- **Standard backup format.** BIP-39 mnemonic is well-understood by the crypto-adjacent audience; libraries and hardware-wallet support are mature.
- **Brittleness-as-feature still holds.** Default UX never surfaces the seed; the disciplined user can opt into recovery, but the default user is exposed to brittleness.

### Negative

- **WebCrypto doesn't natively support secp256k1.** Client crypto needs a JS library (`noble-secp256k1` or similar). ~30–50KB cost, acceptable.
- **secp256k1 is slower than Ed25519** for general crypto operations. Negligible at MOP's scale (one keypair per object creation, not per request).
- **Bitcoin connotations.** Some users may pattern-match "BIP-39 seed phrase" to crypto-finance. Acceptable given the cypherpunk-aligned audience but worth noting.
- **Index-list portability gap.** Recovering on a new device with only the seed, but not the index list, requires the user to remember or query for their object IDs. The seed alone doesn't reconstruct which children were used. Mitigation: device's exportable backup bundle includes the list.

### Neutral

- HD path conventions (BIP-44-style coin type? Custom path?) are an open implementation detail. Pending decision.
- Symmetric crypto (K_read) is AES-256-GCM, native in WebCrypto. No change.

## Alternatives considered

- **Single master K_origin reused across all objects.** Rejected: trivially linkable by the host (same K_origin_pub stored across every object), creates correlation, blast-radius on key leak spans every past+future object, enables reply-spam targeting. ADR-005 supersedes this would-have-been ADR.
- **Fresh-random per-object keys with no derivation relationship.** Privacy-equivalent to hardened HD but loses seed-recovery story. The user would have to back up every K_origin individually, which is strictly worse than backing up one seed. Hardened HD strictly dominates.
- **Ed25519 instead of secp256k1.** Faster, simpler, native in WebCrypto. Loses Nostr composition and hardware-wallet path. The user explicitly chose secp256k1 for the composability and aesthetic alignment.

## Open follow-ons

- Implementation choice between path-style HD (`m/0'/n'`) and a richer hierarchy (e.g., per-app coin type per BIP-44) — pending.
- Whether to support hardware-wallet K_origin holding in v1 (Ledger / Trezor) or defer — likely defer.
