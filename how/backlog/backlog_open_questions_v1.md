---
type: backlog
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_michael
status: active
tags: [backlog, open-questions, v1, mop]
resolved:
  - B1 → adr_009 (2026-04-24)
  - B2 → adr_010 (2026-04-24)
  - B3 → adr_011 (2026-04-24)
  - B7 → adr_011 (2026-04-24, collateral)
  - B4 → adr_012 (2026-04-24)
  - B5 → adr_013 (2026-04-24)
  - S1 → adr_015 (2026-04-25)
  - S4 → adr_014 (2026-04-25)
  - S2 → adr_016 (2026-04-25)
  - B6 → adr_017 (2026-04-25)
  - B8 → adr_018 (2026-04-25)
  - B9 → adr_019 (2026-04-25)
  - S3 → adr_020 (2026-04-25)
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

### B5: Anti-abuse / PoW / rate limits — RESOLVED

**Resolution (2026-04-24)**: Banked as **ADR-013**. v1 host posture is **edge-CDN (Cloudflare) + per-IP rate-limits + per-object reply rate-limits + size caps + cryptographic gates on origin operations. No PoW.** Pragmatic-v1 floor; ships fast; residential-proxy bypass is undefended and accepted as "fix on detection." PoW deferred to a later phase, not refused. Documented as v1 host-operator policy at `mop.app`, not as protocol-spec — protocol stays minimal.

### B6: HD path conventions — RESOLVED

**Resolution (2026-04-25)**: Banked as **ADR-017**. Path is **`m/300'/n'`** — BIP-43 flat purpose code `300'` (Spartan-300 anchor matching ADR-012), hardened index `n'`. Two levels, both hardened. No coin/account/change layers (coin-wallet semantics don't apply). Client persists a next-free-index counter device-local; on recovery (BIP-39 import), client sweeps indices with a configurable gap limit (default 20). Forward-compatible to a future multi-account migration if needed.

### B7: Image/media inclusion — RESOLVED (collateral with ADR-011)

**Resolution (2026-04-24)**: Banked as part of **ADR-011**. Media inclusion is via external URL only, auto-inlined by the renderer at page open via standard `<img>`/`<video>`/`<audio>` elements. MOP itself never hosts media. URL extension or content-type drives renderer classification.

### B8: Tombstone vs. vanish on TTL expiry — RESOLVED

**Resolution (2026-04-25)**: Banked as **ADR-018**. Host returns **`410 Gone`** with structured tombstone metadata: `{ status: "gone", reason: "expired" | "burned", gone_at: ISO8601 }`. No body, no ciphertext, no `K_origin_pub`. Tombstone retention is bounded — host serves `410` for 30 days post gone-at, then transitions to `404`. Aligns with pragmatic privacy posture: UX wins over marginal metadata leak; bounded retention keeps the leak time-limited.

### B9: Privacy posture indicator on rendered page — RESOLVED

**Resolution (2026-04-25)**: Banked as **ADR-019**. Renderer displays a small, **symmetric** privacy-posture indicator on every wyrd view: *Sealed* (private fragment form) vs. *Open* (public path form). Both forms get an indicator, not just public — symmetry gives affirmative reassurance on Sealed and pedagogical contrast across forms. Position: top of rendered area, below wordmark, glanceable. Visual treatment is small, hairline, neutral palette — informational, not alarmist.

## Strategic

### S1: v1 launch scope — RESOLVED

**Resolution (2026-04-25)**: Banked as **ADR-015**. v1 is unopinionated about which use case leads. The product is a primitive, not a vertical app. The four use cases are equal; design decisions must not be biased toward any one of them. No modes, no templates, no use-case onboarding flows. Marketing surface presents the primitive itself, not a use-case-led pitch. The question "which use case leads?" was closed by the user as malformed: *"the use case should not impact what you do; it's inherently unopinionated."*

### S2: Domain & branding — RESOLVED

**Resolution (2026-04-25)**: Banked as **ADR-016**. Consumer brand is **SendWyrd** at **sendwyrd.com**. Protocol codename **MOP** (Message Object Protocol) is retained for spec/internal use. Unit noun is a **wyrd** (lowercase) — *"send a wyrd"*. CamelCase branding (SendWyrd, never sendwyrd) is mandatory in copy. `sendwyrd.app` reserved for future PWA / mobile shell. Defensive registrations tracked as a separate operational task.

### S3: Stack confirmation — RESOLVED

**Resolution (2026-04-25)**: Banked as **ADR-020**. v1 stack: **Next.js + React + TypeScript + Tailwind + Radix UI** for the canonical web client; **Hono on Cloudflare Workers** for the API; **Neon Postgres** + **Cloudflare R2** for storage; **Cloudflare** for edge/CDN/rate-limits/bot-mgmt (consistent with ADR-013). Crypto: **Web Crypto API** for AES-256-GCM; **`@noble/secp256k1`** for ECC ops; **`@scure/bip32`** + **`@scure/bip39`** for HD and mnemonic; **secp256k1 Schnorr (BIP-340)** for signatures; ECIES variant (ephemeral secp256k1 + ECDH + HKDF-SHA256 + AES-256-GCM) for reply encryption. Monorepo via pnpm workspaces + Turborepo, with extractable `core` package for future native consumption.

### S4: Renderer ownership — RESOLVED

**Resolution (2026-04-25)**: Banked as **ADR-014**. v1 ships a single canonical renderer with three first-party implementations: web, iOS, Android. No third-party clients in v1. All three surfaces share a documented internal behavioral contract so rendering is identical across platforms. Native ship dates not promised by the ADR — commitment is "first-party only when shipped." Reading the protocol and building unsupported clients is permitted but unendorsed. Federation of clients deferred post-v1.

## Process

### P1: Personality customization

Default agent personality is **Berthier** (chief-of-staff archetype, inherited from aDNA template). User has not yet opted to customize. Acceptable as default; revisit if it grates.

### P2: Inspiration archive maintenance

Three inspiration docs filed at `what/context/inspiration/` (Weak Ties Game, TweetJoin, bin-21). If the user shares more, file under same convention with `inspiration_*` prefix and update the AGENTS.md index.

## Future Considerations (post-v1)

Captured here for tracking; not in scope for v1 implementation.

### F1: Burn-after-reading lifecycle option

bin-21 (see `what/context/inspiration/inspiration_bin_21.md`) ships a burn-on-first-read option in addition to TTL. Real value for one-time-secret use cases (password share, MFA seed handoff). **Conflicts with v1 forward-chain use cases** — the URL must work for the nth recipient via Mike → Sara → Alex, not only the first reader. Possible v2 framing: a per-wyrd "single-recipient mode" toggle with composer copy explicitly explaining the consequence. Out of v1 scope; revisit when v2 priorities form.

### F2: Operational bot-protection layer

ADR-013 banked the v1 abuse posture (edge + rate-limits + size caps + crypto gates). bin-21's three-layer bot defense (honeypot fields + time-based detection + JS challenges) is a credible operational refinement at the host-policy layer (not protocol). Worth folding into the canonical SendWyrd host runbook during Phase E or operational deployment, not an ADR.
