---
type: decision
adr_id: adr_022
adr_number: 22
title: "K_read derived from seed via HKDF (was: per-wyrd CSPRNG)"
status: accepted
created: 2026-04-26
updated: 2026-04-26
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, hd, hkdf, crypto, k_read, recovery]
---

# ADR-022: K_read Derived from Seed via HKDF

## Status

Accepted.

## Context

ADR-017 established the HD path `m/300'/n'` for per-wyrd `K_origin` keypairs. The body-encryption key `K_read` was a separate concern. The v1 implementation generated `K_read` per-wyrd from CSPRNG (32 bytes of `crypto.getRandomValues`) and placed it in the URL fragment.

That choice gave a particular forward-secrecy property: lose every copy of the URL and the body becomes unreadable, **including by the author**. A mnemonic-only recovery sweep could reconstruct authorship metadata (handles, dates, `K_origin_priv` for burn/attest/replies) but could not reconstruct `K_read`, so recovered entries surfaced in `/wyrds` without share URLs and with a `recovered (no read key)` annotation.

Two real costs with that posture:

1. **Recovery feels broken.** Users (correctly) expect "my seed restores everything I sent." Discovering that the seed restores only the index and not the content of one's own past wyrds is surprising and erodes trust in the recovery primitive.
2. **The forward-secrecy benefit is largely theoretical.** SendWyrd already enforces deletion-based forward secrecy via TTL (default 90 days, max 1 year) and manual burn. Once the relay drops the ciphertext, no key — derived or random — can decrypt it. The only wyrds whose ciphertext outlives a seed compromise are permanent attestations, whose bodies are non-secret by design (target handle + signature).

So the random-`K_read` design was paying a real UX cost for a forward-secrecy gain that the relay's own retention model already provides.

## Decision

`K_read` is derived from the BIP-39 seed via HKDF-SHA256:

```
K_read[n] = HKDF-SHA256(
    IKM   = seed (64 bytes, BIP-39 PBKDF2 output),
    salt  = empty,
    info  = "sendwyrd:k_read" || n_be_4bytes,
    L     = 32 bytes
)
```

Properties:

- **Domain-separated from `K_origin`** via the `"sendwyrd:k_read"` info prefix. The two derivations cannot collide regardless of secp256k1's BIP-32 internals.
- **Same `n` as `K_origin`** — the wyrd at HD index `n` uses both `deriveOriginKey(seed, n)` and `deriveReadKey(seed, n)`. Index management (next-free counter, sweep semantics) is unchanged from ADR-017.
- **URL format unchanged.** `K_read` still rides in the URL fragment. Recipients still receive the key bytes via the URL; they do not need the seed.
- **Recovery sweep reconstructs share URLs.** When the sweep finds an occupied index `n`, it derives `K_read[n]` alongside `K_origin[n]` and assembles full fragment URLs. The `recovered (no read key)` UI state is now reserved for legacy entries authored under the v1 random-`K_read` scheme.

## Consequences

### Positive

- **Mnemonic recovery is now content-complete for forward wyrds.** A user wiping their device and importing their seed gets full share URLs back, not just metadata.
- **Fewer cognitive layers.** The seed is the singular root of every per-wyrd secret (`K_origin`, `K_read`). One backup, one recovery.
- **No protocol-level migration.** The relay never sees `K_read` and has no way to distinguish derived from random; the change is fully client-side. Older wyrds still decrypt via their stored `K_read` in local history.

### Negative

- **Seed compromise is now a content-read event for any wyrd ciphertext the relay still holds.** With random `K_read`, a leaked seed gave the attacker authorship power but not body access; with derived `K_read`, the attacker can read every live wyrd at any index.
  - Mitigation: forward secrecy is enforced by the relay's TTL + burn behavior. Default TTL is 90 days; manual burn drops ciphertext immediately. Permanent wyrds (`ttl_seconds = 0`) are reserved for attestations whose bodies are non-secret.
  - This is the deliberate trust-posture flip: SendWyrd already trusts deletion to give forward secrecy. Using it for content protection too is consistent.
- **Legacy entries.** Wyrds composed under the v1 random scheme remain recoverable only via their already-stored `k_read_b64u` in `wyrdHistory`. A mnemonic-only sweep on a device that never held the legacy local store will return such entries flagged `recovered: true` with no share URL — same UX as before, scoped only to the legacy class. New wyrds are fully recoverable.

### Neutral

- The `K_read` URL fragment continues to function as a bearer-token capability for recipients. The change affects only how the *author* derives the key; recipient semantics are unchanged.
- Domain separation via HKDF info string is the standard pattern for "two keys from one seed"; no novel cryptography.

## Alternatives considered

- **Keep random `K_read` (status quo).** Rejected. The forward-secrecy property it provided is already provided by relay-side deletion (TTL + burn). The recovery UX cost is real and recurring; the security benefit is mostly theoretical.
- **Derive via a second BIP-32 hardened path (`m/300'/n'/1'` or `m/301'/n'`).** Rejected. BIP-32 is a keypair-derivation scheme; `K_read` is a symmetric key. Using BIP-32 to produce a 32-byte symmetric secret works mechanically but is the wrong abstraction. HKDF is the standard symmetric KDF, with explicit domain-separation via the info parameter.
- **Derive `K_read` from `K_origin_priv` (`HKDF(K_origin_priv[n], "read")`).** Rejected. Couples the two key tracks unnecessarily — any future operation that exposes `K_origin_priv` (we don't have one, but the abstraction shouldn't preclude one) would also expose `K_read`. Deriving both directly from the seed under separate domain strings keeps them independent.
- **Add a `k_read_scheme: "derived" | "random"` flag to publish + presence-check responses.** Rejected for v1. Adds a field to two API surfaces to support a transitional class of wyrds that will TTL out within a year. Not worth the protocol churn.

## Open follow-ons

- ~~**Spec amendment.** `spec_mop_v1.md` §7 currently describes `K_read` as "per-wyrd CSPRNG"; that section should be updated to reference this ADR and document the HKDF derivation.~~ **Resolved** — §5.5 and §7.3 amended; v1.0.5-draft changelog entry added.
- **Lightning integration possibilities.** Resolved by ADR-023 (no native Lightning embed; payment is exogenous). The "everything from one seed" pattern is not extended to other secrets in v1.
