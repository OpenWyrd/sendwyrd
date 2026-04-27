---
type: decision
adr_id: adr_024
adr_number: 24
title: "No relay-side recipient model — user-side aggregation is author-only or browser-local"
status: accepted
created: 2026-04-26
updated: 2026-04-26
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, recipient, addressing, inbox, outbox, naming]
---

# ADR-024: No Relay-Side Recipient Model — User-Side Aggregation Is Author-Only or Browser-Local

## Status

Accepted.

## Context

ADR-003 (capability privacy posture), ADR-004 / ADR-021 (single-form addressing), and ADR-009 (client-side HD aggregation) collectively encode a key structural property of SendWyrd: **the relay knows authors but does not know recipients**. A wyrd is published by its author (the relay sees `K_origin_pub` and a publish signature) and addressed by a capability URL containing `handle` plus the read key in the fragment. The relay never sees the read key, never sees a recipient's identity, and has no concept of "wyrds for user X" — capability URLs are bearer tokens delivered out-of-band through whatever channel the author chose.

This is intentional and load-bearing: it is what makes the host body-blind on every request and prevents recipient-side metadata from accumulating server-side.

A nomenclature collision developed in shipped UI:

- **ADR-009 uses the word "inbox"** to refer to the *author-side aggregation* — the construct that lets an author see the wyrds they have published (and read replies addressed to those wyrds). That aggregation is computed entirely client-side via HD-derived `K_origin_pub` lookups against the relay; the relay does not aggregate.
- **The shipped client originally exposed this as `/inbox`** with the label "inbox." That was a misnomer: the page lists wyrds the user has *authored*, not wyrds *sent to* the user. The protocol-level "inbox" of ADR-009 is functionally an outbox of self-authored content.
- **Renamed to `/wyrds` with label "my wyrds"** in the v1.0 polish pass. The route is now honest about what it shows.

This ADR locks down the structural property and the nomenclature so future work doesn't drift into proposing a "real inbox" that would require breaking the relay-blind addressing model.

## Decision

### Structural property (load-bearing)

**The relay has no recipient model.** This is not negotiable in v1 and any future ADR proposing to relax it must explicitly reckon with the consequences for ADRs 003, 004, 009, 021.

Concretely:

1. The publish payload (§9 of the spec) carries no recipient field, no recipient-pubkey, no per-recipient envelope — only the encrypted body and the author's signature.
2. The fetch endpoint (§13) is keyed by `handle`. Possession of the handle (combined with the URL fragment that carries `K_read`) is the entire access-control mechanism. The relay does not authenticate fetchers and does not log them.
3. The presence-check endpoint (§15) is keyed by `K_origin_pub` — strictly an *author-side* lookup. There is no recipient-side analog and no way to construct one without protocol-level recipient identity.
4. There is no protocol-level concept of "send a wyrd to user X." A wyrd is published; a URL is produced; the URL is delivered through whatever out-of-band channel the author chooses (iMessage, Signal, email, paper, voice, telepathy).

### What "inbox" and "outbox" mean in SendWyrd

The shipped client converges on this vocabulary going forward:

- **Outbox** (the `/wyrds` page's default view) — the **author-side aggregation** described by ADR-009. Lists wyrds the user has authored. Source of truth: local `wyrdHistory` (browser localStorage) merged with mnemonic-recovery results from presence-check on each derived `K_origin_pub`. Fully recoverable from the BIP-39 seed (post-ADR-022, content + metadata; pre-ADR-022 wyrds, metadata only). Author-only operations (burn, attest authorship, fetch encrypted replies) live here.
- **Inbox** — if shipped as a second view under `/wyrds`, this means a **browser-local viewing log** of capability URLs the user has opened in this browser. Source of truth: a separate `wyrdInbox` localStorage key, populated when a `/w/{handle}` route decrypts successfully. Stores `handle` and `k_read` (so the user can re-view) plus a `first_seen_at` timestamp. **Not** queried from the relay. **Not** recoverable from the seed (the relay has no recipient-side data to reconstruct from). Lost on browser data clear or device switch — that is the cost of relay-blind addressing.

The "inbox" so defined is a viewing history scoped to a single browser, not a server-side mailbox. The protocol contract that "the relay never knows you received this" is preserved exactly because the inbox never tells the relay anything.

### What this rules out

The following would all break the structural property and are out of scope for v1 and any subsequent ADR that does not first supersede this one:

1. **Server-side inbox aggregation.** A "wyrds for recipient X" lookup would require either (a) protocol-level recipient identity at publish time (kills author-blind delivery), or (b) recipient subscription / poll endpoints (creates recipient-side metadata accumulation server-side).
2. **Push notifications "you have a new wyrd."** Would require the relay to know who to notify. Same break as above. ADR-010 already settled notifications as app-layer-only; this ADR reinforces that decision and extends it: even authoring activity does not generate recipient-targeted pushes.
3. **Read receipts of any form.** A "this wyrd has been read N times" surface would require fetch-time logging tied to anything richer than coarse rate-limit counters. The current relay-side fetch path is deliberately stateless w.r.t. fetcher identity.
4. **"Mention" / addressing primitives.** No `@user`-style addressing in bodies, no recipient-pubkey envelopes, no protocol-level concept of "this wyrd is for these N people." If the author wants to direct a wyrd to a specific person, they share the URL with that person — the same way you "send" any other capability URL.
5. **Server-mediated recipient handles.** No "claim a username on the canonical relay so people can send wyrds to your handle." Capability URLs do all addressing; there are no usernames, account names, or recipient identifiers at the protocol layer.

### Cross-references

- ADR-003 (capability privacy posture) — establishes that capability URLs are the addressing primitive. This ADR is its consequence.
- ADR-009 (inbox client-side HD aggregation) — uses "inbox" to mean what we now call the **outbox** (author-side aggregation). Read ADR-009's "inbox" as a synonym for "user-facing aggregation of self-authored wyrds."
- ADR-010 (notifications app-layer-only) — already prohibited server-side notification surfaces. This ADR extends the principle: no recipient surfaces of any kind, push or pull.
- ADR-021 (single-form addressing) — final addressing model; no parallel recipient-keyed form.
- ADR-022 (K_read seed-derived) — outbox-side recovery now includes content keys; this ADR clarifies that no analogous inbox-side recovery exists or could exist without breaking the relay-blind property.

## Consequences

### Positive

- **Body-blind, recipient-blind relay.** The relay sees ciphertext, signatures, and rate-limit-relevant counters. It does not see who reads what. This is the cypherpunk floor SendWyrd promises.
- **Capability URLs do all the work.** Possession of the URL is access; no separate authentication path. Forwardability is automatic — anyone with the URL can pass it on, no permission system to subvert.
- **Recipient-side state is genuinely private.** A user's reading history exists only on devices they control. Browser-clear erases it. Mnemonic recovery does not restore it. There is no other copy.
- **Future-proofing against scope creep.** A future contributor proposing "let's add a real inbox so users get notifications" hits this ADR and has to either (a) accept the inbox-as-browser-log model or (b) write a superseding ADR that explicitly negotiates the trade. The hard choice is forced, not snuck in.

### Negative

- **No cross-device read history.** A user who reads a wyrd on phone and then opens the same browser on laptop has separate inboxes. There is no "sync your reading history across devices" feature, and there cannot be one without either client-side sync (out of scope, would require its own crypto / sync protocol) or relay-side recipient state (forbidden by this ADR).
- **No "inbox recovery."** Lose the browser, lose the inbox. The seed gives back outbox content (post-ADR-022) but cannot give back inbox state — there's nothing on the relay tied to the user-as-recipient. Users learn this once, then live with it. Default TTL plus the local-only nature means the loss is bounded; users can always ask the original sender to re-share the URL.
- **No "DM me" surface across wyrds.** A reader cannot reach out to an author through SendWyrd at the author level — only at the per-wyrd reply level (ADR-008, encrypted-to-`K_origin_pub`, one-shot). This is a feature, not a bug, but it does mean SendWyrd is structurally bad at "build relationships with strangers via the platform" — the platform refuses to be the platform for that.

### Neutral

- The "outbox" / "inbox" terminology is a UI convention, not a wire-format change. Protocol shape is unchanged from ADR-009 / ADR-021.
- ADR-009 remains correct as written. The word "inbox" in ADR-009 should be read as "user-facing aggregation of self-authored wyrds" — i.e., the construct now exposed as the `/wyrds` outbox view.

## Alternatives considered

- **Add server-side recipient identity.** Rejected. Breaks ADR-003 and ADR-009 simultaneously. The whole point of capability-URL addressing is that the relay doesn't know who you're talking to.
- **Allow "claim a username" handles on the relay.** Rejected. Same break — handles tied to recipient identity become user-routable mailboxes the relay has to know about.
- **Treat "inbox" as a strict alias of the outbox view (no second view at all).** Rejected as too austere. Users who open many forwarded wyrds genuinely benefit from a local viewing log — and the architecture supports it cleanly because the log is just localStorage. No reason not to ship it; reason to be careful about claiming it.
- **Sync the local inbox via the seed.** Rejected. Would require either client-side sync infrastructure (out of scope, deserves its own ADR if ever pursued) or the relay learning about reading events (forbidden). Punt to "recipient asks for the URL again" if the local copy is gone.
- **Push notifications for incoming wyrds.** Rejected by ADR-010 already; this ADR re-affirms.

## Open follow-ons

- **Inbox-as-second-view implementation.** Schema for `wyrdInbox` localStorage entries, auto-record on view-page decrypt, settings toggle for users who want to opt out of recording, UX for the empty state. Implementation detail; no protocol change.
- **Decrypted-body cache policy.** Whether the inbox row caches the decrypted plaintext (faster re-view, larger localStorage footprint, weirder when the wyrd is later burned/expired) or always re-fetches and re-decrypts on inbox click (slower re-view, fresh tombstone state, smaller footprint). Default: don't cache plaintext — re-fetch on click.
- **Inbox export.** If users want to back up their reading history, they can do so manually via browser-export of localStorage. No first-class export feature is planned.
- **Spec amendment.** Add a brief note to §13 (fetch endpoint) and §15 (presence-check) explicitly stating that the protocol has no recipient-keyed surface. Likely v1.0.7-draft changelog material.
