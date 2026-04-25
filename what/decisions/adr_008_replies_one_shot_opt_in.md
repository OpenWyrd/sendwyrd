---
type: decision
adr_id: adr_008
adr_number: 8
title: "Replies: one-shot encrypted blobs, off by default, opt-in"
status: accepted
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_michael
supersedes:
superseded_by:
tags: [adr, decision, mop, replies, interaction-minimalism]
---

# ADR-008: Replies as One-Shot Encrypted Blobs, Off by Default

## Status

Accepted (v1 architecture decision).

## Context

The original architecture pack (§3.4, §8) treated private replies as an optional Phase 3 feature — encrypted to the origin's reply public key, stored as ciphertext blobs on the server, decrypted client-side by the origin.

The user committed to a stronger philosophical stance during architecture resolution: **the reply primitive exists only because there is no other way for the nth recipient of a chain-shared Hypermessage to reach back to the origin.** It is forensically necessary, not feature-welcome. MOP should never become a place where conversation *happens* — only where contact *starts*.

This drives two decisions:

1. Replies are a minimum-viable back-channel, not a conversation primitive. No threading, no reply-to-reply, no native quote-reply.
2. Replies are off by default. Authors opt in only when their use case (intro/ask routing, etc.) genuinely needs the back-channel.

## Decision

### Reply mechanics

When an author opts in (compose-time toggle), the published Hypermessage carries `reply_enabled: true` and `K_origin_pub` is exposed for reply encryption.

A recipient of the share URL who wants to reply:

1. Composes a reply text client-side.
2. Encrypts it with `K_origin_pub` (fetched from the object).
3. POSTs the ciphertext blob to `/m/{id}/replies`.
4. Done — server stores the blob; recipient has no further connection to the conversation.

The server never sees plaintext. Replies are independent encrypted blobs keyed to one parent.

### One-shot, no threading

A reply blob has no reply capability of its own. There is no native way to reply to a reply. To follow up:

- The origin can create a *new* Hypermessage and (out of band) hand the URL to the responder.
- Or the conversation moves to whatever messaging rail the responder included contact info on (email, Signal, etc.).

This is intentional: MOP starts the contact; existing rails carry the resulting conversation.

### Off by default, opt-in via composer toggle

The composer surfaces a "Allow replies" toggle. Default off. Author flips it on for objects where they need the back-channel — typically the intro/ask routing use case.

For all other use cases (canonical cross-post, whisper-network whitepaper pointer, tweet-replacement), replies stay off and the object is a pure one-way artifact.

### Reply receiving (provisional)

The author retrieves replies for a given object by visiting that object's K_origin private URL. The page fetches reply ciphertexts from the server (gated by a signature from K_origin_priv), decrypts each blob client-side, and displays them.

Each authored object has its own such URL. There is no aggregate "all my replies across all objects" inbox at the protocol level — a device-local feed of authored objects + reply counts is a client-side convenience layer (see backlog).

Reply notifications (push, email, polling) are a separate question — provisionally pull-only / no notifications in v1, see backlog.

## Consequences

### Positive

- **Interaction-minimalism (VISION P5) operationalized.** The protocol literally cannot host a conversation; follow-ups must move elsewhere.
- **Defensive against feature creep.** No threading primitive means future agents/maintainers can't trivially evolve MOP into a chat host.
- **Anonymity preserved for repliers.** Reply senders never expose identity to the protocol — they just POST a ciphertext. Identity, if any, is whatever they include in their reply body.
- **Server is forensically simple.** Each object's reply table is a list of opaque blobs with timestamps. No relational graph of conversation state.
- **Reply-off default reduces surface area** for the publishing-canonical and whisper-network cases — they're pure one-way artifacts unless the author needs otherwise.

### Negative

- **No native back-and-forth UX.** Origin and responder must coordinate out of band for follow-up. Friction for what could be conversational use cases — but that's the point (VISION P5). If users need real conversation, they should be in a real messenger.
- **Reply spam vector.** Anyone with the share URL can POST a reply; per-object pubkey is a target. Mitigation must come from PoW + per-IP rate-limits + edge protection (pending design — see backlog).
- **Reply-key portability cost.** Origin needs K_origin_priv to decrypt replies, and K_origin lives device-local. Cross-device reply access requires the seed-export path (ADR-005). Single-device for default users — accepted per VISION P4 (brittleness).
- **Origin must remember to check.** No notifications by default → "intro request" objects might languish if origin doesn't poll. UX must make checking habitual without violating brittleness/interaction-minimalism principles.

### Neutral

- The reply schema is minimal: `{reply_to: object_id, ciphertext: <blob>, created_at: <ts>}`. No metadata beyond that.
- Public-form objects (ADR-004) and reply enablement are orthogonal — author can publish public-form *with* replies enabled. Reply ciphertext stays end-to-end-encrypted to K_origin even when the host can read body content. Confirmed.

## Alternatives considered

- **Replies as full Hypermessages with their own K_read + K_origin** (recursive composition; threading emerges naturally). Rejected — would conflate MOP with a conversation host (violates VISION P5), and adds significant complexity for a use case (multi-turn threading) MOP explicitly does not want.
- **Replies on by default.** Rejected — wider surface area for spam, and inconsistent with the principle that reply capability should be a deliberate authorial choice tied to a specific use case.
- **No reply primitive at all** (force all back-channel out of band). Rejected — the intro/ask routing use case has *no other* mechanism for the nth recipient to reach the origin, since the chain is opaque to origin (origin doesn't know who got the URL via what path). Without replies, the most concrete wedge use case fails.

## Open follow-ons

- Reply notification model (pull / push / email) — backlog.
- Aggregate inbox UX (device-local convenience layer over per-object K_origin URLs) — backlog.
- Anti-abuse / spam mitigation on reply endpoint (PoW, rate limits) — backlog.
- Whether reply blobs respect parent's TTL (expire when parent burns) or have their own TTL — provisionally tied to parent.
