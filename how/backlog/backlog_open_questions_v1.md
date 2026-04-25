---
type: backlog
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
status: active
tags: [backlog, open-questions, v1, mop]
resolved:
  - B1 → adr_009 (2026-04-24)
  - B2 → adr_010 (2026-04-24)
  - B3 → adr_011 (2026-04-24)
  - B7 → adr_011 (2026-04-24, collateral)
  - B4 → adr_012 (2026-04-24)
---

# Open Questions — MOP v1 Architecture

Questions surfaced during the founding architecture session (2026-04-24) that did not get resolved before context-window pressure. Each is a candidate for the next architecture-resolution session.

## Architectural

### B1: Reply receiving UX (mechanics confirmation pending) — RESOLVED

**Resolution (2026-04-24)**: Banked as **ADR-009**. Inbox aggregation is client-side via HD derivation. The author holds a device-local "master inbox URL" encoding the seed (or an HD top branch); the client uses BIP-32 derivation to regenerate every per-object `K_origin_priv` and independently fetches each per-object reply endpoint. Host stays per-object blind — no master pubkey, no `/inbox` endpoint, no authorship cluster. Recovery via BIP-39 seed + sweep across HD indices. Loss of the master URL is aligned with VISION P4 (brittleness as feature), not in tension with it.

Server-side aggregation under a master pubkey (option 3a) was rejected: even with encrypted blobs, the host would learn the authorship cluster, which is the metadata-account form ADR-003 refused.

### B2: Reply notification model — RESOLVED

**Resolution (2026-04-24)**: Banked as **ADR-010**. The MOP protocol exposes **no notification primitive** — no push subscription endpoint, no email field, no webhook registration. Notifications are entirely a client/app concern layered above the protocol. The reference web app is pull-only; the planned mobile app may implement OS-level push (APNs/FCM) via the app's own backend acting as a polling client of the MOP host. Host-blindness preserved by construction.

### B3: Body format — RESOLVED

**Resolution (2026-04-24)**: Banked as **ADR-011**. Body is plain text UTF-8 + embedded URLs; no markdown grammar of any kind. Renderer aggressively auto-embeds non-MOP URLs on page open: known media extensions inline as `<img>`/`<video>`/`<audio>`; everything else fetches OG metadata client-side and renders a preview card. Recipient-side privacy is **explicitly not hardened** in v1 — tracking-pixel attacks are accepted as an in-scope-but-undefended risk. Cypherpunk on content/authorship; pragmatic on rendering. Hardening deferred to later phase.

### B4: Object body size cap — RESOLVED

**Resolution (2026-04-24)**: Banked as **ADR-012**. Cap is **300 Unicode codepoints** of UTF-8 plain text. Spartan-300 cultural anchor; austerity register; deliberate distance from Twitter's 280. Server-enforced at publish, composer-enforced at compose-time, codepoint-counted (not bytes, not grapheme clusters). Non-tunable; non-per-object.

### B5: Anti-abuse / PoW / rate limits

**Status**: Architecture pack §11 listed Cloudflare + per-IP rate-limits + optional hashcash PoW + hard size caps. Given no-accounts-by-default (ADR-003), per-IP rate-limits alone are weak (residential proxies trivially bypass).

**Working principle**: PoW per object creation and per reply is likely the *primary* abuse control, not the secondary. Per-IP rate-limits secondary. Pending design.

### B6: HD path conventions

**Open**: BIP-44-style coin type (e.g., `m/44'/{coin}'/0'/0/n`) or a custom MOP-specific path? Implementation detail; should be settled before any client code is written.

### B7: Image/media inclusion — RESOLVED (collateral with ADR-011)

**Resolution (2026-04-24)**: Banked as part of **ADR-011**. Media inclusion is via external URL only, auto-inlined by the renderer at page open via standard `<img>`/`<video>`/`<audio>` elements. MOP itself never hosts media. URL extension or content-type drives renderer classification.

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
