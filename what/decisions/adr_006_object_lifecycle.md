---
type: decision
adr_id: adr_006
adr_number: 6
title: "Object lifecycle: per-object K_origin, immutable post-publish, default 90-day burn"
status: accepted
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, lifecycle, persistence, ephemerality]
---

# ADR-006: Object Lifecycle — Per-Object Origin, Immutability, Default Burn

## Status

Accepted (v1 architecture decision).

## Context

Three lifecycle questions came up together during architecture resolution and are coupled enough to address as one ADR:

1. Does each object get its own `K_origin` keypair, or do all of an author's objects share a master?
2. Once published, can an object be edited, or only deleted?
3. What is the default persistence — permanent until deleted, or auto-burn after a TTL?

The unifying axis is **how durable the user's stuff is, and on what time horizon**. VISION P4 (brittleness as feature) provides the guiding intuition: defaults should resist durable identity and durable archive, while optional opt-ins can make the system more durable for users who deliberately want that.

## Decision

### Per-object K_origin (not master)

Every Hypermessage gets a fresh `K_origin` keypair, derived as a hardened HD child of the user's master seed (see ADR-005 for the cryptographic mechanism).

- Host stores `K_origin_pub` per object. With hardened derivation, these pubkeys appear as independent random points to the host — **no cross-object correlation** is possible without the master seed.
- Author's device maintains a local list of `(object_id, derivation_index)` pairs to track which K_origin belongs to which object.

### Immutable post-publish

Once a Hypermessage is published, its body cannot be edited. The K_origin authorizes:

- ✅ **Delete / burn** — server removes the ciphertext from storage on receipt of a signed delete request from K_origin_priv
- ❌ **Edit body** — not supported in v1

A user who wants to "fix a typo" must publish a new Hypermessage and let the old one expire (or burn it).

### Default 90-day burn, toggle to permanent

Composer surfaces a slider toggle (same pattern as the public/private addressing toggle in ADR-004):

- **Default**: object expires 90 days after publication
- **Toggle**: object persists until deleted via K_origin

Both modes can be deleted earlier via K_origin-signed delete request. The TTL is a forcing function for ephemerality; the toggle gives the user agency for genuinely canonical objects.

## Consequences

### Positive

- **Cross-correlation defended.** A host breach reveals nothing about which objects share an author.
- **Blast radius bounded.** A leaked K_origin compromises one object, not an entire author's history.
- **Reply-spam defended.** Spammers can't precision-target a specific author; each reply endpoint is per-object.
- **Stylometric/timing attacks weakened.** Attackers cannot trivially batch all of an author's content for analysis.
- **Ephemerality manifested in product.** Most objects auto-expire; durable persistence becomes a deliberate, visible user choice — directly serves VISION P4.
- **Immutability protects forwarders.** Recipients who forward a link can trust the link's meaning won't shape-shift after they've passed it on. Aligns with the "thoughtful forwarding" use cases (intro/ask routing, whisper-network).

### Negative

- **More keys to manage** in the per-object model. Mitigated: with HD (ADR-005) all keys derive from one seed, so backup is still one unit. The list of `(object_id, index)` pairs is just local-storage state.
- **No edit recourse.** Typo fixes require republishing. The user accepts this as Nietzschean — content that fits a moment, then dissolves; if it had a typo, let it die.
- **TTL counters on the host.** Server must track expiration per object and run a sweeper. Standard infra, low cost.
- **90-day default may surprise users** who expected perpetual storage. UX must surface the TTL clearly at compose time and on the rendered page (e.g., "expires in 87 days" footer).

### Neutral

- 90 days is a heuristic — could be 30, 60, 180. Pending UX validation. Stated as an architectural default subject to product tuning.
- The "delete via signed request" mechanism is a server endpoint that verifies a signature against the object's `K_origin_pub`. Standard primitive.

## Alternatives considered

- **Master K_origin reused across objects.** Rejected — see ADR-005 for full reasoning. Slightly simpler key management; severe privacy regression.
- **Editable bodies with K_origin authorization.** Rejected — opens deception vector (sender forwards link with one body, author edits to a different body, recipient reads new body without knowing). Conflicts with thoughtful-forwarding ethos.
- **Permanent by default, opt-in expiration.** Rejected — opposite forcing function; weights the system toward archive rather than action. Would dent VISION P4.
- **Versioned editable objects (`/m/{id}@v{n}`).** Considered for the canonical-URL/reusable use case; rejected as v1 over-engineering. Possible future extension if usage validates the need.

## Open follow-ons

- Final TTL number — 90 days is the working default, awaiting UX validation.
- Whether expired objects leave behind a "tombstone" record (`410 Gone` with metadata only) or vanish entirely (`404 Not Found`). Tombstone helps with broken-link UX; vanish maximizes ephemerality. Pending.
