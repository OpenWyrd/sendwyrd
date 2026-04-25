---
type: decision
adr_id: adr_012
adr_number: 12
title: "Object body size cap: 300 Unicode codepoints"
status: accepted
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_michael
supersedes:
superseded_by:
tags: [adr, decision, mop, body, size-cap, schema]
---

# ADR-012: Object Body Size Cap Is 300 Unicode Codepoints

## Status

Accepted (v1 architecture decision).

## Context

ADR-007 and ADR-011 settled the body schema (plain text + embedded URLs, renderer auto-embeds non-MOP URLs). They left the **size cap** open. The brand register calls the artifact "tweet-sized," which needs to mean a concrete number.

Considered candidates: 280 / 500 / 1000 / 2000 / 4000 codepoints. The user picked **300**, explicitly invoking the Spartan-300 reference — a cultural anchor consonant with the project's classical-warrior/austerity register and slightly above Twitter's 280 to mark a deliberate distance from "just a Twitter clone."

## Decision

### Cap: 300 Unicode codepoints

A Hypermessage body is **at most 300 Unicode codepoints** of UTF-8 plain text.

- Counted in **codepoints**, not bytes and not grapheme clusters.
  - Bytes are wrong because CJK and other multi-byte scripts would be unfairly penalized.
  - Grapheme clusters are wrong because they require a Unicode normalization library on every server boundary; codepoints are simpler and "good enough" in practice.
- Length is measured **post-decoding**, on the cleartext body. The encrypted ciphertext envelope on the wire is longer (AES-GCM auth tag, IV, etc.) and is governed by a separate envelope-size cap (renderer/protocol implementation detail, set generously to accommodate the 300-codepoint plaintext plus crypto overhead).

### Enforcement

- **Server (publish endpoint)**: rejects oversize bodies with a 4xx response. This is the authoritative cap. For private-form objects, the server cannot inspect plaintext to enforce — it enforces a ciphertext-length cap that bounds plaintext-length within reasonable margin (a few hundred bytes for crypto overhead).
- **Composer / client**: enforces the 300-codepoint cap at compose time as a UX affordance. Live counter, soft warning at ~280, hard block at 300.
- **Renderer**: no enforcement; it trusts the published object. Renderer applies its own bounds for embedded recursive content (per ADR-007 depth/cycle limits and ADR-011 per-URL fetch bounds), which are independent of the body cap.

### Rationale (cultural)

300 is not a benchmark optimum — it is a deliberate cultural anchor. The Spartan reference reinforces the project's austerity ethos and the "one sharp thought, action-oriented, then gone" framing of VISION P4 (brittleness). It also marks distance from Twitter's 280 — same order of magnitude, but explicitly different and chosen for different reasons. This is a brand decision encoded in protocol; it is intentional that it is non-tunable.

## Consequences

### Positive

- **Concrete schema constraint.** Server-side validation, client-side affordance, and protocol spec all converge on one number.
- **On-brand austerity.** 300 reads as deliberate and severe; the Spartan reference is sticky and culturally legible to the target audience.
- **Forces thinking-before-publishing.** A 300-codepoint cap rewards distillation over rambling. Coheres with VISION P4 (brittleness) and the user's Nietzschean register: write the sharp thing, hit publish, move on.
- **Bounds renderer load.** A bounded body cap puts a ceiling on how much text the renderer must escape, scan for URLs, and render. Recursion expansion via embedded MOP capability URLs is bounded separately by ADR-007's depth/cycle limits.

### Negative

- **Some intro/ask requests will not fit.** The use case can require setup ("X is the founder of Y, currently exploring Z, looking for someone with experience in W") that runs longer than 300. Authors will compensate by writing the ask as a short pointer + a transitively-referenced longer Hypermessage, or via an embedded URL to a longer external doc. Acceptable trade — composing a longer object that references a shorter "ask card" is a coherent pattern under ADR-007.
- **Whitepaper-summary content has to be tight.** Effectively impossible to summarize a paper in 300 codepoints; user must rely on the URL preview card (per ADR-011) to do most of the work. Acceptable — that's the wedge of "pointer cards to externally-hosted long-form."
- **Twitter migration friction.** Tweets that hit 280 don't transcribe one-to-one into Hypermessages with 300 — close, but not identical. Tools that import tweets need to handle the 280→300 boundary case (rare but not zero).

### Neutral

- The cap can be revised in a future ADR if it proves wrong in practice, but doing so is a protocol break (server-side validation changes; older clients might publish bodies that newer servers reject, etc.). Treat 300 as **load-bearing** until explicit phase-gate revision.
- The cap is intentionally **not configurable per object or per author**. A two-tier protocol (regular + extended) would defeat the brand register and introduce schema variance for thin gain.

## Alternatives considered

- **280 (Twitter-classic).** Same order of magnitude, but copies Twitter's number explicitly. **Rejected** — better to mark distance with a number chosen for our reasons, not theirs.
- **500 (Mastodon-default).** Comfortable paragraph; fits intro/ask without distillation. **Rejected** — too generous; weakens the austerity register and the "one thought" framing.
- **1000+.** Essay-leaning; defeats the "card" framing. **Rejected** for v1.
- **Variable cap by use case** (intro/ask gets 500, whitepaper-pointer gets 300, etc.). **Rejected** — adds schema variance, complicates the composer, and the use cases aren't statically discriminable from the body alone.
- **No cap, soft-cap only.** **Rejected** — without a server-enforced cap, abuse vectors (multi-MB bodies as DoS) become trivial.

## Open follow-ons

- **Ciphertext envelope cap.** Server enforces a max ciphertext length that bounds plaintext to ≤ 300 codepoints + crypto overhead. Exact number is implementation detail; should be documented in the protocol spec when written.
- **Codepoint-counting normalization.** Whether to count after NFC normalization or as-typed. Server should normalize-then-count to avoid trivial bypasses (e.g., decomposed sequences). Implementation detail.
- **Composer UX for over-cap content.** Soft warning at some threshold (e.g., 280) → hard block at 300. UX detail; renderer/composer-side.
- **Twitter-import tooling** for users wanting to mirror tweets as Hypermessages. Out of v1 protocol scope; useful for the cross-post-canonical use case at launch (S1).
