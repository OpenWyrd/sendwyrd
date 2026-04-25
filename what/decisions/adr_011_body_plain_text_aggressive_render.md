---
type: decision
adr_id: adr_011
adr_number: 11
title: "Body is plain text; renderer aggressively auto-embeds non-MOP URLs"
status: accepted
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, body-schema, renderer, ux, privacy-posture]
---

# ADR-011: Body Is Plain Text; Renderer Aggressively Auto-Embeds Non-MOP URLs

## Status

Accepted (v1 architecture decision).

## Context

ADR-007 banked the body schema as text with embedded URLs and transitive capability references for nested MOP URLs. Two refinements were left open:

1. **B3** — does the body support inline formatting on top of plain text + URLs? Plain text vs. light markdown vs. a curated subset.
2. **(implicit in B3)** — what does the renderer do with *non-MOP* URLs in the body? Auto-fetch and inline media / OG cards, or render bare links?

These have to be answered together because they together define what a user types into the composer and what the recipient sees. The privacy/UX fork is real: aggressive auto-render gives a Twitter-card-quality experience but exposes recipient IP to every third-party URL host on page open (the classic email-tracking-pixel attack).

The user resolved this by drawing a line between *protocol-level privacy* (cypherpunk-tight: host-blind body, no accounts, no authorship cluster) and *recipient-side rendering privacy* (pragmatic in v1, may harden later). The choice was made explicitly: *"good UI/UX, this isn't meant to be cypherpunk fully, at least now, maybe later."*

## Decision

### Body schema is plain text + embedded URLs. No markdown.

The body is UTF-8 plain text. Newlines are preserved. The renderer:

- HTML-escapes the entire body on render.
- Detects URLs via regex (HTTP/HTTPS schemes, plus the MOP capability URL form).
- Replaces detected URLs with anchor or embed elements per the rules below.
- Does **not** interpret any markdown grammar — no `**bold**`, no `_italic_`, no `[text](url)`, no headers, no lists, no blockquotes, no code fences.

The decision against markdown is austerity-driven. Plain text makes the composer simple ("type the thing"), eliminates the link-masking phishing vector by construction (`[trustme.com](evil.com)` is impossible because the syntax is not interpreted), and minimizes renderer attack surface.

### URL handling tiers

Three categories of URLs found in the body, each rendered differently:

#### Tier A — MOP capability URLs

URLs matching the MOP capability URL form (per ADR-004 / ADR-007) trigger the recursive embed behavior already banked in ADR-007: the renderer fetches the referenced object, decrypts it client-side using the embedded `K_read`, and inlines the rendered child as a quote-block within the parent. Recursion bounded by depth and cycle detection (renderer-enforced).

This tier was already settled. Restated here for completeness.

#### Tier B — Non-MOP URLs ending in known media file extensions

URLs ending in `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.mp4`, `.webm`, `.mov`, `.m4a`, `.mp3` (and similar — exact list maintained in renderer config) are auto-inlined as the appropriate media element on page open. The renderer issues an `<img>` / `<video>` / `<audio>` request from the recipient's browser at render time, no click required.

#### Tier C — All other non-MOP URLs

For everything else (generic HTTP/HTTPS URLs), the renderer fetches Open Graph metadata client-side on page open and inlines a preview card (title, description, hero image, source domain). Auto-loaded, no click required.

For specific platforms with first-class embed support (YouTube, Vimeo, Twitter/X, etc.), the renderer may use platform-specific oEmbed or iframe embeds in place of the generic OG card. This is a renderer implementation detail, not protocol.

### Recipient-side privacy: explicitly not hardened in v1

Auto-fetching for Tier B and Tier C means every non-MOP URL host learns:

- The recipient's IP address.
- The fact that someone holding this Hypermessage opened it.
- (For tracking-instrumented URLs) any cookies / fingerprint signals they care to read.

This is the same privacy posture as opening a normal webpage or HTML email with images enabled. **It is accepted for v1.** MOP's privacy commitments in v1 are tight at the protocol layer (host-blind body content, no authorship cluster, no accounts) but pragmatic at the renderer layer (recipient IP exposure to third-party URL hosts is in-scope but not in-defense).

A trivial consequence: an adversary who controls a 1×1 image URL can include it in a Hypermessage to fingerprint anyone who opens it. This is the classic email tracking-pixel attack. **Mitigation is deferred to a later phase**, not part of v1.

### Composer guidance (out-of-band)

Composer UX should communicate to authors that any URL they include is fetched by recipients on open. This is renderer/UX guidance, not protocol enforcement.

## Consequences

### Positive

- **Hypermessage feels like a Twitter-card-quality artifact.** Inline images, video, and OG previews on page open. Strong wedge for cross-post-canonical and whisper-network use cases (especially whitepaper-pointer content that benefits from hero-image previews).
- **Composer is dead simple.** Type text, paste URLs, hit publish. No "did I close my italic" anxiety.
- **Renderer for body is straightforward.** HTML escape + URL regex + media-extension sniff + OG fetch. No CommonMark parser, no AST, no sanitizer for arbitrary inline HTML.
- **Link-masking phishing eliminated by construction.** Without markdown, `[trustme.com](evil.com)` cannot be expressed in the body. Recipients always see the literal URL text.
- **Coheres with austerity ethos.** Body schema matches the project register: minimal, declarative, no syntactic decoration.

### Negative

- **Recipient-side tracking is structurally easy.** Tracking-pixel attacks are trivial; deanonymization-on-open is real. Pragmatic compromise; revisitable later.
- **No formatting affordance for emphasis or structure.** Authors who want a bullet list of "looking for: X / Y / Z" have to write it as plain prose with line breaks. Some loss of structure-cueing for intro/ask use cases.
- **Renderer behavior on Tier C is inconsistent across deployments.** The OG-card visual can vary widely between renderers (third-party clients, mobile app, web reference). Acceptable since renderer ownership is a separate question (S4).
- **Auto-embed of arbitrary images means renderer must defend against image-bomb / decompression attacks.** Standard browser image rendering already does most of this, but worth flagging for hardening.

### Neutral

- The body's wire format does not change between Tier B and Tier C URLs — they're all just URLs in plain text. The classification is a renderer-time decision based on extension or content-type, not a body-schema discriminator.
- For *private-form* objects (ADR-004), the host cannot see body URLs (body is encrypted). Renderer fetches happen entirely from the recipient's browser, leaking only to the third-party URL host — the MOP host learns nothing additional about body content.
- For *public-form* objects, the host can read the body, hence knows the URLs. Renderer fetches still happen client-side; the MOP host could in principle pre-fetch and cache OG data server-side for public-form objects to improve latency, but that's a renderer-side optimization out of scope for v1 protocol.

## Alternatives considered

- **Light markdown body (B3 fork b).** Bold, italic, lists, link masking. **Rejected** — phishing surface (link masking), composer complexity, renderer attack surface, austerity ethos.
- **Curated inline accents (B3 fork c).** `*bold*` and `_italic_`, no link masking. **Rejected** — adds composer-side cognitive overhead for thin gain; user picked plain text outright.
- **Tiered render policy (render fork ii).** Media auto-inline, generic URLs click-to-load. **Rejected** for v1 — friction on the canonical-card use case is too high for the wedge phase. Revisitable.
- **Click-to-load everything (render fork iii).** All URLs click-to-load. **Rejected** for v1 — cypherpunk-pure but kills the social-card UX that the cross-post and whisper-network use cases lean on.

## Open follow-ons

- **Recipient-side privacy hardening** (future phase). Candidates: per-URL click-to-load opt-in, renderer-level fetch proxy (with care — proxies must not see private-form body URLs), trusted-host allowlist for auto-render. Tracked as a non-v1 ADR.
- **Specific platform embed support** (renderer detail). Which platforms get first-class oEmbed-style embeds vs. generic OG cards. Not a protocol concern; lives in renderer spec / S4.
- **Image / video size limits during auto-fetch.** Renderer should bound how much it pulls per URL to defend against memory pressure / decompression attacks. Renderer-side hardening, not protocol.
- **Content-type sniffing rules** for URLs without media extensions but with image/video content-types. Renderer detail.
- **Composer-side URL handling.** Whether composer should warn authors about including known tracking domains, etc. UX detail.
