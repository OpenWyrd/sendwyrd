---
type: backlog
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
status: active
tags: [backlog, open-questions, v1, mop]
---

# Open Questions — MOP v1 Architecture

Questions surfaced during the founding architecture session (2026-04-24) that did not get resolved before context-window pressure. Each is a candidate for the next architecture-resolution session.

## Architectural

### B1: Reply receiving UX (mechanics confirmation pending)

**Last position**: Origin holds a private URL like `mop.app/origin/{K_origin_priv_encoded}` per object. Visiting it fetches reply blobs from `/m/{id}/replies` (gated by signature from K_origin_priv), decrypts each blob client-side, displays. Each authored object has its own such URL. Aggregate views (device-local list of all the user's authored objects + reply counts) are a convenience layer on the client, not part of the protocol.

**Status**: Question was asked but not answered before session paused. Likely yes/confirm with possible refinements.

### B2: Reply notification model

**Three forks**:
- **(a) Pull-only.** No notifications. User checks K_origin URL when they remember. On-philosophy (interaction-minimalism + brittleness).
- **(b) Web push subscription per object.** Service worker registers, server pushes on new reply. Cross-platform but introduces persistent endpoint registration that may leak K_origin_pub to push relay services (Apple, Google).
- **(c) Email notifications.** Author optionally provides email at compose time, server pings. Simplest UX; introduces an external identifier (email) which dents anonymity-by-default.

**Lean**: (a) for v1, on principle. Pending user decision.

### B3: Body format

- **(a)** Pure plain text (utf-8). URLs auto-detected and rendered. No formatting.
- **(b)** Light markdown (CommonMark or curated subset).

**Lean**: (a). Aligns with austerity ethos. Pending decision.

### B4: Object body size cap

**Open**: pick a number. "Tweet-sized" needs to mean something concrete. Candidates: 280 / 500 / 1000 / 2000 / 4000 chars.

**Considerations**: Intro/ask use case wants more than 280. Whitepaper-pointer use case is short. Cross-post-as-canonical wants tweet-scale. Provisional working number: **500–1000 chars**, hard-capped.

### B5: Anti-abuse / PoW / rate limits

**Status**: Architecture pack §11 listed Cloudflare + per-IP rate-limits + optional hashcash PoW + hard size caps. Given no-accounts-by-default (ADR-003), per-IP rate-limits alone are weak (residential proxies trivially bypass).

**Working principle**: PoW per object creation and per reply is likely the *primary* abuse control, not the secondary. Per-IP rate-limits secondary. Pending design.

### B6: HD path conventions

**Open**: BIP-44-style coin type (e.g., `m/44'/{coin}'/0'/0/n`) or a custom MOP-specific path? Implementation detail; should be settled before any client code is written.

### B7: Image/media inclusion

**Implicit assumption**: media (images, audio, video) is included via external URL only, rendered inline by the body renderer (per ADR-007). MOP itself never hosts media. Should be confirmed explicitly.

### B8: Tombstone vs. vanish on TTL expiry

When an object's 90-day TTL fires (or burn is requested via K_origin), does the host:
- (a) Return `410 Gone` with metadata only (timestamp, "burned by author" or "TTL expired")?
- (b) Return `404 Not Found` (object never existed from the host's perspective)?

(a) helps broken-link UX; (b) maximizes ephemerality. Pending decision.

### B9: Public-form privacy banner on rendered page

When a recipient views a public-form Hypermessage (host-readable), should the rendered page include a visible "this is the public form — host can see body content" indicator? Helps recipients understand what they're holding.

## Strategic

### S1: v1 launch scope

Four candidate use cases (see VISION.md):
1. Cross-post canonical URL
2. Intro/ask routing
3. Whisper-network dissemination
4. Tweet-replacement

The architecture supports all four. Marketing/launch can only front one or two.

**Open**: Which use case(s) does v1 lead with? Affects: composer defaults (e.g., reply-enabled default for intro mode), example content, demo scenarios, growth strategy.

### S2: Domain & branding

`mop.app` is a placeholder used in ADRs. Real domain decision pending.

Naming: "MOP" is the protocol-side codename. "Hypermessage" is the consumer name. Confirm both stick or pick alternatives.

### S3: Stack confirmation

Architecture pack §5 proposed: Next.js + React + TypeScript + Tailwind frontend; Fastify or NestJS backend; Postgres + S3 storage; Cloudflare CDN; Web Crypto API client-side (with `noble-secp256k1` for the curve, per ADR-005).

Probably fine; pending explicit user confirmation when implementation phase starts.

### S4: Renderer ownership

The renderer (which decrypts client-side, parses body, fetches and inlines references and OG previews, enforces recursion caps and cycle detection) is the security-critical surface (per ADR-007). Open questions:
- Do we ship a single canonical renderer (web app at `mop.app`) and require everyone to use it?
- Do we publish a renderer spec and let third parties build their own (Nostr-style)?
- What about an iOS/Android share-extension renderer for native UX?

**Lean**: v1 = single canonical web renderer. Mobile and third-party renderers are post-v1 questions.

## Process

### P1: Personality customization

Default agent personality is **Berthier** (chief-of-staff archetype, inherited from aDNA template). User has not yet opted to customize. Acceptable as default; revisit if it grates.

### P2: Inspiration archive maintenance

Two inspiration docs filed at `what/context/inspiration/`. If the user shares more, file under same convention with `inspiration_*` prefix and update the AGENTS.md index.
