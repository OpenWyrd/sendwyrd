---
type: decision
adr_id: adr_007
adr_number: 7
title: "Body schema: text-with-embedded-URLs, transitive capability references"
status: accepted
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, schema, references, rendering]
---

# ADR-007: Body Schema with Transitive Capability References

## Status

Accepted (v1 architecture decision).

## Context

The Hypermessage architecture pack (§4) proposed a schema with two distinct array fields:

```json
{
  "body": "text",
  "references": ["object_url_1", "object_url_2"],
  "preview_links": ["https://..."]
}
```

This separated "first-class references to other Hypermessages" from "arbitrary external URLs that should get OG previews." The user objected on two grounds:

1. The protocol should carry text only (VISION P2 — protocol stays naked). Adding structured arrays for different *kinds* of links models too much.
2. There is no architectural value in referencing the *mere existence* of an object without also granting access to it. A reference without a key is a name without a referent.

The corollary: when one Hypermessage references another, the reference should embed the full capability URL (with `#K_B`), so anyone who decrypts the parent can also unlock the referenced child. This is a **transitive capability grant** — sharing A automatically shares access to B.

## Decision

### Schema collapse

The Hypermessage schema has **no** structured array of references or preview links. The schema is austere:

```json
{
  "id": "object_id",
  "ciphertext": "<encrypted body>",
  "k_origin_pub": "<author's public key>",
  "reply_enabled": false,
  "expires_at": "2026-07-23T00:00:00Z",
  "created_at": "2026-04-24T00:00:00Z"
}
```

Body content is plaintext (after client-side decryption) containing whatever URLs the author chose to write. The renderer parses the body, detects URLs, and renders them inline:

- **MOP URLs** (with K_read in fragment or path) → recursive transclude: fetch, decrypt, render the referenced Hypermessage as an inline preview
- **External URLs** → fetch OG metadata, render an OG-style card

There is no protocol distinction between "this is a Hypermessage reference" and "this is just a link." The body text is the link substrate.

### Transitive capability via embedded keys

When an author references another Hypermessage in their body, they include the full capability URL with K_read embedded:

```
See also https://mop.app/m/B#K_B for the underlying paper.
```

Anyone who can decrypt the parent body automatically obtains K_B by reading it. This propagates capability transitively: share A, you share B (because B's key is inside A).

Authors who want to *cite without granting access* can mention the bare URL (without the key fragment) — but the resulting reference is unreadable to recipients of A who don't already hold K_B independently. This is supported as a degenerate case, not a first-class feature.

### Recursive rendering (client-side, capped)

When the recipient decrypts and renders A:

1. Renderer scans body for URLs.
2. For each MOP URL with a key, recursively fetches and decrypts the referenced object, rendering it as an inline preview card.
3. Recursion is hard-capped at **3 levels** by default to prevent expansion bombs.
4. Cycle detection: if A→B→A, the second visit renders as a "loop indicator" stub.

External URLs get OG previews via the renderer's OG-fetcher (server-side fetch with appropriate caching).

## Consequences

### Positive

- **Schema austerity.** Matches VISION P2 — the protocol carries text and a few capability primitives, nothing more.
- **No conflation.** The pack's earlier `references` vs. `preview_links` distinction disappears; the body itself is the substrate.
- **Recursive rendering "just works"** when references include their keys. No out-of-band coordination needed for the recipient's renderer.
- **Authors retain agency** — including or omitting the key in a reference is the access-control mechanism. No protocol-level "this reference is restricted" flag needed.
- **Endogenous extensibility.** Future structured patterns (e.g., `@mention` of a Nostr key, hashtags) can be layered as body conventions parsed by the renderer, without protocol changes.

### Negative

- **Capability escape.** Sharing a Hypermessage that references another grants access to both. Authors must understand that referencing-with-key = re-sharing-the-referenced. UX may need to surface this when a referenced object's K is detected in the body at compose time.
- **Renderer is the security boundary.** A buggy renderer (e.g., one that follows referenced URLs in unsafe ways, or that leaks fragment keys to logging) becomes a vector. Renderer must be carefully audited.
- **Recursion depth and cycle detection** must be implemented correctly to prevent client-side DoS via deeply-nested or circular references.
- **External-URL OG fetching** happens server-side (the renderer host fetches the external URL to get OG metadata). This is a known crawler-style operation — host sees which external URLs are referenced. Acceptable; doesn't compromise the host-blind property of MOP body content.

### Neutral

- Body format (plain text vs. light markdown) is a separate question — pending design, see backlog. Either way the URL-detection-and-render rule applies.
- Image embedding follows the same rule: the body contains an image URL, the renderer fetches and inlines the image. No image-upload primitive within MOP.

## Alternatives considered

- **Bare-ID references** (no key, just object ID). Rejected — referenced objects would show as locked stubs with no path to unlock, breaking recursive transclusion. The user explicitly rejected this: "There is no point to reference the mere existence of an object."
- **Author's choice per-reference** (transitive grant or bare-ID, picked at compose time). Rejected as v1 complexity; degenerate "bare URL without key" already supports the no-grant case if an author wants it.
- **Structured `references` array in schema.** Rejected — adds protocol ceremony for what body text already expresses.

## Open follow-ons

- Body format question (plain text only, vs. light markdown subset) — backlog.
- Renderer scope: who builds it, what library handles URL detection / OG fetching / recursion control — implementation detail, not in this ADR.
- UX for compose-time warnings when an embedded reference key would propagate access — backlog.
