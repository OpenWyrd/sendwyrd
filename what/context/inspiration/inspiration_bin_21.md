---
type: context
subtype: inspiration
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_michael
status: active
tags: [inspiration, adjacent_context, encrypted_pastebin, convergent_evolution]
source_repo: https://github.com/t21dev/bin-21
source_live: https://bin.t21.dev
---

# Inspiration — bin-21 (t21dev)

Adjacent reference. Per `AGENTS.md` in this directory: inspiration archive is **adjacent context, NOT canonical design constraints**. Do not treat any item below as a SendWyrd requirement.

## What it is

bin-21 is a privacy-first encrypted pastebin shipped by t21dev in 2025–2026. Live at `https://bin.t21.dev`; source MIT-licensed at `https://github.com/t21dev/bin-21`.

## Architectural snapshot

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 |
| Backend | Next.js Server Actions (no separate API tier) |
| Database | PostgreSQL 16 via Drizzle ORM |
| Object storage | Cloudflare R2 (encrypted blobs) |
| Deploy target | Railway (Docker-compatible) |
| Syntax highlighting | Shiki (150+ languages) |
| Rate limiting | Redis with in-memory fallback |
| Crypto | AES-256-GCM + PBKDF2 (100,000 iterations) |
| Bot defense | Honeypot fields + time-based detection + JS challenges |

## Security model

- **Password-derived key**, not capability-URL: the user sets a password at compose time; key derives via PBKDF2; password never leaves the browser; server stores ciphertext only.
- True E2E (server-blind to plaintext).
- Encrypted blobs in R2; metadata in Postgres.
- Anonymous, no auth, no cookies beyond theme preference.

## Lifecycle features

- TTL presets: never / 10min / 1hr / 1day / 1week / 1month.
- **Burn after reading** — paste self-destructs after first view.
- IP-hashed (salted) rate limiting; raw IPs never stored.

## Operational rate limits

- 10 creates / minute
- 60 views / minute
- 5 failed password attempts / 5 minutes

## Stack validation for SendWyrd

The stack convergence with **ADR-020** is striking and reassuring:
- Next.js + TypeScript + Tailwind ✅
- PostgreSQL + Drizzle ORM ✅ (validates the Drizzle amendment to ADR-020 added 2026-04-25)
- Cloudflare R2 for ciphertext blobs ✅

Two intentional divergences:
- **Compute layer**: bin-21 uses Next.js Server Actions on Railway; SendWyrd uses Hono on Cloudflare Workers (per ADR-020). Ours is more edge-native and less framework-coupled — but bin-21's choice is a perfectly valid alternative path that we deliberately did not take.
- **Crypto / addressing**: bin-21 is password-encrypted; SendWyrd is bearer-capability-URL-encrypted (per ADR-003). Different products despite similar stacks.

## Architectural divergence (intentional, by ADR)

| Dimension | bin-21 | SendWyrd | Governing ADR |
|-----------|--------|----------|---------------|
| Encryption gate | Password (PBKDF2) | Capability URL (`K_read` in fragment or path) | ADR-003, ADR-004 |
| Addressing forms | Single (path-based ID) | Two-form (private fragment / public path) | ADR-004 |
| Author tracking | Anonymous, no notion of "your pastes" | HD-derived inbox aggregation, client-side | ADR-009 |
| Replies | None | One-shot encrypted blob, opt-in | ADR-008 |
| Body cap | Unlimited | 300 Unicode codepoints | ADR-012 |
| Body format | Code with syntax highlighting | Plain text + auto-embedded URLs | ADR-007, ADR-011 |
| Client surface | Web only | Web + iOS + Android first-party | ADR-014 |
| Use case framing | Pastebin (code, secrets) | Conversational primitive (intros, whisper, cross-post) | ADR-015 |

bin-21 is a **pastebin**. SendWyrd is a **conversational primitive**. The shared infrastructure choices reflect that "modern minimal-trust web app" is a real architectural genre with consensus answers. The product-level differences reflect that bin-21 and SendWyrd are answering different questions.

## What's worth borrowing (operational, not architectural)

### 1. Burn-after-reading as a future lifecycle option

bin-21's burn-on-first-read is a real feature for one-time-secret use cases (password sharing, MFA seed handoff, etc.). SendWyrd's lifecycle today is TTL + author-signed manual burn (ADR-006 + ADR-018). A third option — burn after first view — is worth considering as a future ADR.

**Why not v1**: burn-after-read fundamentally conflicts with SendWyrd's forward-chain use cases per VISION (the URL must work for the nth recipient who got it via Mike → Sara → Alex, not only for the first reader). For a pastebin, "first reader" is well-defined; for a relay primitive, it isn't.

**Possible v2 framing**: a per-wyrd "single-recipient mode" toggle that the author selects when they specifically want one-shot semantics, with composer copy explicitly explaining the consequence. Tracked in `how/backlog/`.

### 2. Bot defense layer

Honeypot + time-based + JS challenges, layered on top of edge rate limits, is a credible operational stack against scripted spam. ADR-013 banked the v1 host posture as edge + rate-limits + size caps + crypto gates; bin-21's bot stack is a refinement of that, all at host-policy layer (not protocol). Worth folding into the canonical SendWyrd host runbook (Phase E or operational layer, not an ADR).

### 3. Rate-limit number cross-check

bin-21's numbers (10 creates/min, 60 views/min, 5 failed-pw/5min) are in the same order of magnitude as ADR-013's baseline (5 publishes/min, 50 anonymous reads/sec). The shapes differ (per-second vs per-minute scoping) but the philosophy converges. Reassuring; no revision needed.

## Aesthetic note

The live site at `bin.t21.dev` is bot-protected (returned 403 to my fetch attempt — fitting). Aesthetic comparison deferred until I can view it via a real browser; if user provides screenshots or describes the look, that goes here.

## What this is NOT

- Not a design constraint on SendWyrd.
- Not a competitive threat (different product category).
- Not a backwards-compat target.

It is a **stack-validation reference** and an **architectural mirror** for examining what choices we've made deliberately versus accidentally. The mirror is reassuring: ADR-020 is congruent with current 2025–2026 best practice for this product genre.

## Where this is filed

`what/context/inspiration/inspiration_bin_21.md`. Joins `inspiration_weak_ties_game.md` and `inspiration_tweetjoin.md` in the inspiration archive.
