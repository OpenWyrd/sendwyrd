---
type: decision
adr_id: adr_009
adr_number: 9
title: "Inbox aggregation: client-side via HD derivation, host stays per-object blind"
status: accepted
created: 2026-04-24
updated: 2026-04-26
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, replies, inbox, hd-derivation, host-blindness]
---

# ADR-009: Inbox Aggregation Is Client-Side, via HD Derivation

## Status

Accepted (v1 architecture decision).

> **Nomenclature note (added 2026-04-26 per ADR-024):** The word "inbox" throughout this ADR refers to the **author-side aggregation** of self-authored wyrds (handles you published + replies addressed to those handles). The shipped UI exposes this as the `/wyrds` page with the label "my wyrds" — what users naturally call an *outbox*. ADR-024 reserves "inbox" for a different, optional surface: a browser-local viewing log of capability URLs the user has opened. The protocol-level construct described here is unaffected; only the user-facing label changed.

## Context

ADR-008 banked replies as one-shot encrypted blobs delivered to a per-object reply endpoint, gated on the origin side by a signature from `K_origin_priv`. It left **how the author retrieves replies across many authored objects** as a provisional sketch ("each authored object has its own K_origin URL; aggregate views are device-local convenience").

ADR-005 banked Bitcoin-stack cryptography: secp256k1 + BIP-32 hardened HD + BIP-39. ADR-006 banked per-object `K_origin` keypairs. The user wants the BIP-39 seed to be the recovery primitive — losing the device should not lose the inbox if the seed survives.

The question on the table was how to operationalize that recovery story without manufacturing a server-side authorship cluster (which would be an account in capability clothing and breach VISION P3).

## Decision

### The master inbox URL is a client-side construct, not a server endpoint

Inbox aggregation happens entirely in the author's client. The author holds, **device-local**, a single bearer artifact (call it the *master inbox URL*) that encodes either the BIP-39 seed itself or a top-level HD branch deterministically derived from it. The MOP host knows nothing about this artifact; it is never sent over the wire to the host as a master capability.

### Per-object keys are HD-derived from the seed

Every authored object's `K_origin` keypair is derived at a deterministic HD path from the seed (specific path convention pending — see B6). The author's client tracks a device-local index mapping `(hd_path_index → object_id)` for every object the author has published.

### Reply retrieval is N independent per-object fetches

To pull replies, the client:

1. Reads the device-local index of `(hd_path_index, object_id)` pairs.
2. For each entry, derives `K_origin_priv` from the seed at that path.
3. Independently signs and fetches `/m/{object_id}/replies` (per ADR-008 mechanics).
4. Decrypts each returned blob client-side and displays.

From the host's perspective, this is N unrelated per-object reads, indistinguishable from N different authors each pulling their one object's replies. **The host never receives a master pubkey, never groups objects under an authorship cluster, and has no `/inbox` endpoint to expose.**

### Recovery via seed + sweep

If the author loses both the device and the local `(hd_path_index → object_id)` index but retains the BIP-39 seed phrase:

- Per-object **decryption** is recoverable trivially — derive any K_origin_priv from the seed at the right path.
- Per-object **identification** (knowing which object_ids to poll) is *not* recoverable from the seed alone. The object_id is assigned by the host at publish time (per ADR-006).
- Recovery requires a **sweep**: client iterates the next M unused HD path indices, derives K_origin_pub at each, and queries the host for objects whose K_origin_pub matches. Hits get added back to the local index.

This sweep does not break host-blindness — the host indexes objects by K_origin_pub regardless (it has to in order to authorize delete and reply-fetch); the sweep just queries that index by-pubkey one path at a time. It does mean the host can correlate "this client just queried these N pubkeys in succession" if it wants to. That is acceptable: post-recovery correlation is bounded to the recovery moment, not durable across the lifetime of objects.

### Master inbox URL is a high-stakes bearer artifact, but loss is aligned with brittleness

Possessing the master inbox URL gives:

- Read access to every authored object's reply queue.
- `K_origin_priv` for every authored object, hence delete authority over all of them.

Losing the master inbox URL = losing the entire inbox + losing delete authority. This is **aligned with VISION P4** (brittleness as feature), not in tension with it. MOP architecturally refuses to be a hardened identity vault. Users who want hardened recovery use the BIP-39 seed phrase (ADR-005) — losing the convenient URL but retaining the seed is fully recoverable.

Storage UX (passphrase-at-rest encryption, refusal to copy to clipboard, etc.) is left to the renderer/client design; the protocol does not enforce it.

## Consequences

### Positive

- **Host stays per-object blind on authorship.** No server-side concept of "an author" beyond a per-object pubkey. ADR-003 (no accounts) survives intact.
- **Seed-based recovery for the inbox.** The BIP-39 mnemonic deterministically regenerates every authored object's keys; recovery is mechanical, not custodial.
- **Mechanically reuses ADR-008's reply endpoint.** No new server endpoint required; no schema additions; the entire inbox concept is client-side ergonomics over the existing per-object reply path.
- **Coheres with the brittleness principle.** Convenient access is opt-in (master inbox URL); the seed is the durable fallback; nothing the protocol provides resists casual loss.

### Negative

- **Client carries state.** A device-local `(hd_path_index → object_id)` index is required for normal operation. Losing it falls back to the sweep-recovery path. This is a non-zero implementation cost.
- **Sweep recovery is O(M) host queries.** If the user has authored a wide-spaced range of HD indices, a sweep can be expensive and is observable to the host as "this client queried N pubkeys." Acceptable but worth noting.
- **Master inbox URL is the single highest-value bearer artifact in the system.** Compromise = full inbox compromise + delete authority across all authored objects. Mitigation is UX-shaped (P4 says don't bother to harden; user discipline is the control).
- **No cross-device live sync of authored-object index.** Two devices used by the same author each track their own index; reconciliation happens via sweep or via the user importing the seed manually. Acceptable trade-off — an automatic sync server would re-introduce the authorship cluster we just refused.

### Neutral

- HD path convention is still open (B6). Decision space: BIP-44-style coin-typed path or MOP-specific. Resolution does not affect this ADR.
- The "master inbox URL" form (URL-encoded seed vs. URL-encoded HD top branch vs. URL-encoded master pubkey-pair) is a renderer/client implementation detail. Protocol does not need to know.
- Compatible with the public-form / private-form addressing of ADR-004. K_read is per-object and orthogonal to inbox aggregation; the master URL aggregates K_origin only.

## Alternatives considered

- **Server-side aggregation under a master pubkey** (option 3a in the rapid-fire). The host indexes objects under a master `K_master_pub` and exposes an `/inbox/{K_master_pub}` endpoint that returns replies for every clustered object, gated by signature from `K_master_priv`. **Rejected** — even with end-to-end-encrypted blobs, the host learns the authorship cluster (which N objects belong to one human). That metadata is a durable cross-object identity at the host, which is the very thing ADR-003 refused. Encryption-of-blobs is not the only privacy axis.
- **Per-object only, no aggregation primitive.** Each authored object has its K_origin URL; the client is responsible for tracking that URL alongside whatever is durable (e.g., a paper notebook). **Rejected** — recovery story is poor; losing the device loses access to every authored object's replies even if the seed survives. Defeats the recovery rationale that motivated the question.
- **Replies pickup via Nostr/external relay.** Replies are published as Nostr events tagged to K_origin_pub; author's Nostr client picks them up. **Rejected for v1** — adds a non-MOP runtime dependency to the reply path, fragments where reply state lives, complicates the abuse story. Worth revisiting post-v1 if Nostr alignment becomes a concrete win.
- **Master URL derived from a non-seed key** (independent K_inbox keypair). Same UX, but recovery requires backing up two distinct artifacts. **Rejected** — the BIP-39 seed should be the single root of recovery for the entire user.

## Open follow-ons

- HD path convention for per-object K_origin derivation (B6).
- Storage UX for the master inbox URL: passphrase-at-rest, refusal-to-copy, mobile sync — all renderer-side concerns, but spec-level guidance helps third-party renderers (S4) align.
- Sweep-recovery details: default sweep range, gap-limit heuristic, server rate-limiting of pubkey-existence queries to prevent enumeration attacks against unknown authors.
- Whether to allow opt-in cross-device authored-object-index sync via end-to-end-encrypted-to-the-seed blobs hosted somewhere (a future ADR; out of scope for v1).
