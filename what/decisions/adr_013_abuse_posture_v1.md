---
type: decision
adr_id: adr_013
adr_number: 13
title: "v1 abuse posture: edge + per-IP rate-limits + size caps; no PoW"
status: accepted
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_michael
supersedes:
superseded_by:
tags: [adr, decision, mop, abuse, rate-limits, host-policy, v1-pragmatic]
---

# ADR-013: v1 Abuse Posture Is Edge + Rate-Limits + Size Caps; No PoW

## Status

Accepted (v1 architecture decision).

## Context

ADR-003 banked no-accounts as a structural commitment. That removes the conventional spam mitigation (account creation friction, identity-tied abuse history) and leaves three families of defense:

1. **Edge / network-level**: CDN protection (DDoS, bot, geoblock), per-IP rate-limits.
2. **Schema-level**: hard size caps on bodies (ADR-012), ciphertext envelope caps, hard upper bounds on reply-blob size.
3. **Cryptographic-level**: PoW required for publish and/or reply, à la Hashcash / Nostr.

Per-IP rate-limits alone are weak (residential proxies, mobile carrier NAT, IPv6 rotation all bypass), so the conventional cypherpunk answer is to layer light PoW as the primary control. The user explicitly rejected that for v1, choosing the pragmatic floor: ship with edge + rate-limits + size caps, defer PoW to a later phase.

This is consistent with the *pragmatic privacy posture* heuristic banked from B3: do not reflexively pick the maximalist defense in v1. The trade is "ship and onboard" over "harden first."

## Decision

### v1 abuse stack (host-side policy at the canonical host)

The canonical MOP host (mop.app for v1) implements the following abuse posture:

1. **Edge-CDN protection.** Cloudflare-class (or equivalent) front-end providing DDoS mitigation, bot heuristics, and operator-configurable geoblock / IP reputation filtering.
2. **Per-IP rate-limits at the edge.** Tunable thresholds for: object publishes per IP per minute, reply-blob POSTs per IP per minute, signed reads per IP per minute, anonymous reads per IP per second. Specific numbers are operational tuning, not protocol-spec.
3. **Per-object reply-blob rate-limit.** Independent of per-IP limits, each object accepts at most N reply blobs per time window. Bounds reply-flood attacks against a single object regardless of attacker IP.
4. **Server-enforced body size cap (ADR-012).** 300-codepoint plaintext cap; ciphertext envelope cap set generously over plaintext + crypto overhead.
5. **Server-enforced reply-blob size cap.** Independent cap on POSTed reply ciphertext (separate constant, larger than body cap to accommodate longer reply text — exact number is implementation tuning).
6. **Cryptographic gate on origin operations.** Per ADR-006 (delete) and ADR-008 (reply-fetch), origin operations require a signature from `K_origin_priv`. This is structural defense against unauthorized destructive actions, not abuse mitigation per se, but it blocks an entire class of attack (anyone-can-delete) for free.

### What is *not* in v1

- **No PoW (Hashcash-style, Nostr-style, equihash, etc.) on publish or reply.** Deferred.
- **No CAPTCHA** at publish or reply time. CAPTCHAs require user-side state (cookies, fingerprints) that drift toward account-shape; rejected.
- **No email or phone verification.** Direct breach of ADR-003.
- **No web-of-trust / reputation system.** Out of v1.
- **No author allowlists / blocklists at the protocol layer.** A given host operator may add their own blocklist (e.g., "this IP keeps publishing CSAM"), but this is host-operator policy, not a MOP primitive.

### This is host policy, not protocol spec

Per the layering ethos in ADR-010 (notifications) and consistent with the "protocol stays minimal" register, **the MOP wire protocol itself does not specify abuse controls**. The protocol specifies how clients publish, fetch, reply, and delete. Edge protection and rate-limits are operational decisions at each host.

In v1 there is one canonical host (`mop.app`), so host policy and "what users experience" collapse. When federation arrives (post-v1), each host operator chooses their own posture — some may add PoW, some may not. Clients negotiate or fail gracefully.

This ADR therefore documents the **v1 mop.app host-operator posture**, not a wire-protocol requirement.

## Consequences

### Positive

- **Ships fast.** No PoW client to implement, no difficulty-tuning service, no negotiation protocol for adaptive difficulty. Honest users see zero friction at compose time.
- **Honest-user UX is clean.** Composer publishes instantly; reply POST is instant. No "we're computing a proof of work" delay on mobile.
- **Coheres with pragmatic-v1 heuristic.** Banks the abuse design at the cheapest level that lets v1 launch and onboard early users. Hardening is a known follow-on, not a denial.
- **Layering stays clean.** Protocol spec does not have to define a PoW format, difficulty scheme, or abuse-signal mechanism. Hosts operate their own policy below the protocol.
- **Cryptographic gates already do meaningful work.** Per-object signatures on delete + reply-fetch (ADR-006, ADR-008) eliminate trivial destructive-action attacks regardless of rate-limit bypass.

### Negative

- **Residential-proxy spam is undefended.** An attacker rotating through residential IPs can publish arbitrary objects at modest cost. Mitigation in v1 is "detect and respond operationally" (block IP ranges, tighten edge rules, escalate to PoW if it gets bad). This is a real risk; flagged.
- **Reply-flood attacks on individual objects need careful per-object limits.** Setting the per-object reply rate too high invites flood-bury of legitimate replies; setting it too low limits legitimate use cases (a viral intro/ask object that gets 50 replies in an hour). Numbers are operational tuning.
- **First-incident-response cost is non-zero.** When the inevitable spam wave hits, the operator (Michael) has to react in production rather than having defended-by-design. Acknowledged trade.
- **Cypherpunk-aligned audiences may notice the absence of PoW.** "What stops spam?" is a fair question that v1 answers with "Cloudflare and good intentions." Some users will object; that's accepted.

### Neutral

- The decision can be revised in a forward-only direction by a future ADR — adding PoW post-v1 is a non-breaking client change (clients gain a compute step, server gains a verification step). Removing PoW after adding it would be a breaking semantic change but is unlikely to be the direction of revision.
- Operational tuning numbers (rate-limit thresholds, per-object reply caps) live in host config / runbooks, not in the protocol spec or any ADR. Tracked separately.

## Alternatives considered

- **Option (b) — Light always-on PoW for publish + reply.** Cypherpunk-Nostr-aligned; tunable; small honest-user cost. **Rejected for v1** — adds a compute step on every publish (mobile UX cost), requires a difficulty-negotiation scheme, requires every client (including future third-party clients) to implement the same PoW algorithm. Deferred to post-v1; revisitable if spam becomes operationally painful.
- **Option (c) — Adaptive PoW (zero default, escalates under load).** Smarter; harder to ship. **Rejected for v1** — significant implementation cost (load metrics, difficulty signaling, client-side adaptation) for a defense whose absence may not actually bite.
- **Option (d) — Punt entirely to host-operator policy with no v1 commitment.** **Rejected** — leaves the v1 host operator (Michael / mop.app) without a documented posture and leaves potential users without a clear answer to "what stops spam." Documenting (a) as the v1 posture is honest about the trade.

## Open follow-ons

- **Specific rate-limit numbers.** Operational tuning, not in this ADR. Will be set during launch readiness work.
- **Per-object reply rate-limit numbers.** Same — operational tuning.
- **Incident-response playbook.** What happens when spam wave hits — IP-range blocks, tightening edge rules, emergency PoW deployment. Out of v1 ADR scope; tracked operationally.
- **PoW revisit trigger.** A clear signal that should escalate v1's "no PoW" to "ship PoW" — e.g., sustained spam load above operator capacity, or a federation event. Tracked as a future-phase question.
- **Federation-era abuse posture.** When multiple MOP hosts exist, how they share abuse signals (or don't). Out of v1.
