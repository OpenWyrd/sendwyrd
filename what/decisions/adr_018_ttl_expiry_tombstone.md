---
type: decision
adr_id: adr_018
adr_number: 18
title: "TTL expiry response: 410 Gone with structured tombstone metadata"
status: accepted
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, ttl, lifecycle, tombstone, http]
---

# ADR-018: TTL Expiry Response — 410 Gone with Structured Tombstone Metadata

## Status

Accepted (closes backlog item B8).

## Context

Per ADR-006, every wyrd has a TTL (default 90 days) and may also be deleted earlier via a `K_origin`-signed delete request. When a wyrd reaches end-of-life — by either path — the host must answer subsequent fetch requests for that URL. Two stances:

- **(a) Tombstone**: respond `410 Gone` with structured metadata indicating *that* the resource existed and is now gone, and *why* (TTL expiry vs. author burn) and *when*.
- **(b) Vanish**: respond `404 Not Found`, indistinguishable from "this URL never existed."

Tradeoff:
- Tombstone helps recipient comprehension (the holder can tell *expired* from *malformed/wrong-URL*) but leaks that *something* once existed at this URL.
- Vanish maximizes ephemerality and aligns hardest with VISION P4 (brittleness as feature) but produces a worse recipient experience (every dead link is ambiguous).

The metadata leak from tombstone is small. The host already knew the resource existed when it served reads during its lifetime; the post-deletion `410` only reveals "this URL once mapped to a live resource" — information the host had already recorded internally and could leak via timing or other side channels regardless.

The `feedback_pragmatic_privacy_posture` heuristic (do not reflexively pick the maximalist privacy answer when UX cost is real and metadata leak is small) cleanly resolves this fork.

## Decision

### Response shape

When fetching a wyrd that has expired (TTL fired) or been burned (K_origin-signed delete), the host responds:

```
HTTP/1.1 410 Gone
Content-Type: application/json

{
  "status": "gone",
  "reason": "expired" | "burned",
  "gone_at": "2026-07-23T14:21:00Z"
}
```

- **`reason`**:
  - `"expired"` — natural TTL expiry.
  - `"burned"` — explicit `K_origin`-signed delete by the author.
- **`gone_at`** — ISO-8601 UTC timestamp of the moment the wyrd became gone (TTL fire time, or burn-request acceptance time).
- No body, no ciphertext, no `K_origin_pub`, no fingerprint of the original content. Only the three fields above.

### What this response does NOT contain

- No author identifier, fingerprint, or `K_origin_pub`.
- No reference to which other wyrds were transitively reachable from this one.
- No reply data (replies are deleted alongside the wyrd per ADR-008 and never resurface).
- No "delete reason" beyond the binary expired/burned flag.

### Renderer behavior

The canonical renderer (per ADR-014) interprets the 410 response and presents a tasteful end-of-life page:

- **For `expired`**: *"This wyrd's time is up. It expired on {date}."* Quiet, non-error-coded.
- **For `burned`**: *"This wyrd was withdrawn by its author on {date}."* Same register.

No retry button, no "request access," no offer to notify the author. The wyrd is gone; the renderer reports it cleanly and moves on. This matches the brittleness-as-feature ethos: end-of-life is a normal state, not an error.

### Tombstone retention

Tombstone metadata is itself ephemeral. The host retains the `410` response for a bounded period (default: **30 days** post gone-at), after which the host begins responding with `404 Not Found` to fetch requests on that URL. Rationale:

- Tombstone helps recent recipients understand a fresh dead link.
- A year-old tombstone helps no one and is just persistent metadata.
- 30 days post gone-at gives recipient comprehension a generous window and then the metadata itself dissolves.

This retention window is host-operator policy (consistent with the ADR-013 layering: protocol-spec stays minimal, host policy carries operational details), but the canonical SendWyrd host (`sendwyrd.com`) ships with the 30-day default.

## Consequences

### Positive

- **Recipient comprehension wins**. A holder of a dead link can distinguish "this expired naturally" from "this was withdrawn" from "this URL is malformed." All three are different mental models; supporting the distinction is good UX.
- **Aligns with pragmatic privacy posture**. Does not reflexively pick maximalist ephemerality at UX cost.
- **Bounded metadata exposure**. The tombstone itself dissolves after 30 days, so the leak is time-limited rather than indefinite.
- **Simple to implement**. The host already tracks gone-at timestamps; serving a 410 with three fields is trivial.

### Negative

- **Slight tension with VISION P4 (brittleness as feature)**. A 30-day post-gone tombstone is a partial archive of "this once existed." Acknowledged; the bounded retention window keeps the tension small.
- **Confirms object existence to a third party who guesses URLs**. An attacker who guesses or brute-forces wyrd URLs and gets a `410` learns *something existed there*, where a `404` would tell them nothing. Mitigation: per ADR-004, wyrd URLs include cryptographically random capability material (K_read fragment for the private form, or a high-entropy public path); guess-attacks are computationally infeasible. This concern is theoretical, not operational.
- **Cypherpunk-aligned audiences may push for `404`** as the maximalist stance. Documented as deliberate v1 trade.

### Neutral

- The 30-day tombstone retention is a tunable host-operator policy, not a wire-protocol constant. Other host operators (post-federation) may choose differently.
- The renderer's end-of-life page copy is design-phase work (Phase D); this ADR fixes the protocol behavior, not the visual treatment.

## Alternatives considered

- **(b) Vanish (`404 Not Found`)** — rejected. UX cost outweighs the marginal ephemerality gain. The information that a 410 leaks is small (existence, not content) and time-bounded by retention.
- **(c) `200 OK` with empty body and a "gone" header** — rejected as misuse of HTTP semantics; clients are entitled to treat 200 as "live resource."
- **(d) Tombstone with author signature** — rejected as overkill. The host's word is sufficient; clients do not need cryptographic proof of gone-ness.
- **(e) Tombstone with original content hash** — rejected. Confirms identity of the wyrd to anyone who already knew the content; small privacy regression for no UX gain.

## Open follow-ons

- **Renderer copy and visual treatment** for the two end-of-life states — Phase D.
- **Tombstone retention window tuning** — operational; 30-day default is starting point.
- **Federation-era tombstone semantics** — when multiple hosts exist, do they share tombstone state? Out of v1 scope.
