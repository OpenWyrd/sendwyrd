---
type: decision
adr_id: adr_020
adr_number: 20
title: "v1 stack: Next.js + Hono on Cloudflare + Neon Postgres + R2; Web Crypto + noble + scure; AES-GCM + Schnorr"
status: accepted
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, stack, frontend, backend, crypto, infrastructure]
---

# ADR-020: v1 Stack — Next.js + Hono on Cloudflare + Neon Postgres + R2; Web Crypto + noble + scure; AES-GCM + Schnorr

## Status

Accepted (closes backlog item S3).

## Context

The architecture pack §5 proposed a working stack: Next.js + React + TypeScript + Tailwind frontend; Fastify or NestJS backend; Postgres + S3 storage; Cloudflare CDN; Web Crypto API client-side with `noble-secp256k1`. This ADR confirms, refines, and locks the stack for v1, integrating choices forced by ADR-013 (Cloudflare edge), ADR-014 (canonical renderer + first-party native clients), and ADR-017 (HD path).

The stack must satisfy:
1. **ADR-014**: identical behavior across web, iOS, Android. → A shared TypeScript core extractable as a package.
2. **ADR-013**: Cloudflare-edge protection in front of every host operation. → Backend must integrate with Cloudflare's edge stack natively or behind it.
3. **ADR-005**: secp256k1 + BIP-32 hardened HD + BIP-39. → Audited, browser-friendly libraries for those primitives.
4. **ADR-008 / ADR-009**: client-side decryption for both bodies and inbox aggregation. → Frontend crypto must be efficient on mobile browsers.
5. **Aesthetic delegation**: visual quality at Linear/Vercel grade. → Mature design-friendly framework with strong design-system tooling.

## Decision

### Frontend (canonical web client)

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js (App Router)** | Mature React metaframework; file-based routing; first-class Cloudflare Pages support; widely-known by senior contractors if scaling team |
| UI library | **React** | Largest design-system ecosystem; strongest Linear/Vercel-grade reference precedent |
| Language | **TypeScript** (strict mode) | Type safety across shared core boundary; non-negotiable for crypto-handling code |
| Styling | **Tailwind CSS** | Fast iteration on minimal aesthetic; design-system-friendly via `tailwind-variants` or shadcn/ui patterns |
| Component primitives | **Radix UI** (headless) | Accessibility built-in; pairs with Tailwind for visual customization |
| State | Local (React state + URL state); no global store needed at v1 surface size |
| Hosting | **Cloudflare Pages** | Edge-native, free tier generous, integrates with Workers backend |

### Backend (API surface)

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Cloudflare Workers** | Edge-native; the ADR-013 abuse posture lives at this layer; no separate backend host needed |
| Framework | **Hono** | Modern, Workers-native, minimal-overhead HTTP framework; tiny bundle; clean middleware ergonomics |
| Database | **Neon Postgres** | Serverless Postgres; branching for preview environments; Postgres dialect for portability; works cleanly from Workers via HTTP driver |
| ORM | **Drizzle** (`drizzle-orm` + `drizzle-kit`) | TypeScript-native, type-safe, zero-runtime overhead, SQL-flavored API, audit-friendly. Already in use in sibling project `sync_dating_app`; consistency win. |
| Blob storage | **Cloudflare R2** | S3-compatible API; free egress within Cloudflare; ciphertext blobs (encrypted bodies, encrypted reply blobs) live here |
| CDN / edge / rate-limits / bot mitigation | **Cloudflare** (already required by ADR-013) | One vendor, one config surface |

### Cryptography stack

| Primitive | Choice | Why |
|-----------|--------|-----|
| AEAD (body & reply blob encryption) | **AES-256-GCM** | Web Crypto API native; FIPS-blessed; widely supported across all platforms; no polyfill audit burden |
| ECC curve | **secp256k1** | Per ADR-005 |
| HD derivation | **`@scure/bip32`** (paulmillr) | Audited, zero-dependency, browser-friendly |
| Mnemonic | **`@scure/bip39`** (paulmillr) | Audited, zero-dependency, browser-friendly |
| ECC operations (sigs, ECDH) | **`@noble/secp256k1`** (paulmillr) | Audited, zero-dependency, browser-friendly; supports both ECDSA and BIP-340 Schnorr |
| Signature scheme | **secp256k1 Schnorr (BIP-340)** | Modern, compact (64 bytes vs ~70 ECDSA), Nostr-aligned, supports key aggregation if useful post-v1 |
| Reply encryption to `K_origin_pub` | **ECIES variant**: ephemeral secp256k1 keypair + ECDH + HKDF-SHA256 + AES-256-GCM | Standard, audit-friendly construction; uses primitives already in the stack |
| Hash | **SHA-256** | Web Crypto native; standard |
| Key derivation | **HKDF-SHA256** | Web Crypto native; standard for deriving AES keys from ECDH outputs and from `K_read` material |

### Repo structure (deferred but sketched here)

```
sendwyrd/
├── packages/
│   ├── core/         # TypeScript core: parser, decryptor, capability handler, HD derivation
│   ├── web/          # Next.js canonical web client (consumes core)
│   ├── api/          # Hono on Cloudflare Workers (consumes core for crypto verifications only)
│   └── shared-types/ # Wire types shared between web and api
├── apps/
│   ├── ios/          # (post-v1) Native iOS shell consuming core via WASM or re-impl
│   └── android/      # (post-v1) Native Android shell consuming core via WASM or re-impl
└── infra/            # Wrangler / Pages config, Neon migrations, R2 bucket setup
```

Monorepo via **pnpm workspaces** + **Turborepo** for build orchestration.

### Native shell strategy (defer)

iOS and Android first-party clients (per ADR-014) will be built post-v1. Two viable paths:
1. **WASM-compile the TypeScript core**, wrap with native shells (Swift / Kotlin) handling platform UI and OS keychain integration.
2. **Re-implement the core in Swift / Kotlin** against a published renderer-contract spec.

Path selection deferred. Path (1) reduces behavioral-drift risk; path (2) is more idiomatic per platform. Decision when the renderer contract (Phase C) is written and we know how much logic needs to be shared.

## Consequences

### Positive

- **One-vendor edge**. Cloudflare ecosystem (Pages + Workers + R2) collapses three operational concerns into one config surface and one billing line. ADR-013's edge posture becomes a property of the architecture, not a separate add-on.
- **Audited crypto libs**. paulmillr's `@noble/secp256k1` and `@scure/*` family are the standard cypherpunk stack — used by Nostr, MetaMask, Ledger ecosystems. Audit-friendly, zero-dep, no supply-chain footguns.
- **Web Crypto for AEAD** keeps the bundle small and avoids polyfill audit burden.
- **Schnorr signatures over ECDSA** is the modern default; aligns with Nostr (post-NIP-01) and Bitcoin Taproot direction.
- **Postgres dialect via Neon** preserves portability; if Cloudflare lock-in becomes painful, the data layer migrates cleanly.
- **TypeScript core extractable** for native consumption (per ADR-014), so first-party native clients can share the cryptographic and parser code paths.
- **Next.js + Tailwind + Radix** is the modern minimalism stack used by Vercel, Linear-style products, Cal.com, and a long list of design-grade products. Hits the aesthetic ceiling the user asked for.

### Negative

- **Cloudflare lock-in is real**. Workers, R2, and Pages each have proprietary surfaces. Mitigation: Hono is portable to Node/Deno/Bun, Postgres is portable, R2 is S3-compat. Exit ramp exists but is non-trivial.
- **Workers cold-start and per-request limits** can bite on long-running operations. Mitigation: every MOP host operation is short-lived (publish, fetch, reply POST, signed delete, signed reply-fetch); no long jobs. Workers fits the workload.
- **Web Crypto API does not support secp256k1 directly**, requiring `@noble/secp256k1` for ECC ops. Acceptable; `@noble` is the de facto standard.
- **Shared TypeScript core for web AND native** means careful core-package design (no DOM dependencies, no Node-specific APIs). Discipline cost.
- **Next.js is heavier than strictly necessary** for a privacy-first app where SSR is largely irrelevant (bodies decrypt client-side from URL fragment the server never sees). Mitigation: use Next as a SPA-with-routing rather than an SSR-everything framework; the cost is bundle-size only, not architectural.

### Neutral

- **Schnorr key format and signature encoding** follows BIP-340 (32-byte X-only pubkey, 64-byte signature). Standard.
- **Reply-blob ECIES specifics** (HKDF info string, AES-GCM nonce derivation) are wire-spec details for Phase B.
- **Frontend test framework, e2e framework, monitoring, logging** are out of scope for this ADR; standard picks (Vitest, Playwright, Sentry or equivalent) at implementation time.

## Alternatives considered

- **Backend on Fastify/NestJS deployed to a traditional VPS or container host** — rejected. Adds a separate operational layer when Cloudflare Workers + Hono cover the same surface natively, with ADR-013's edge posture built in by default.
- **D1 (Cloudflare's SQLite)** instead of Neon Postgres — rejected for v1. D1 is workable for simple data, but the wyrd metadata model (per-object indexing, TTL-based queries, reply aggregation) benefits from Postgres dialect maturity. D1 revisitable if Postgres proves overkill.
- **Supabase** instead of Neon Postgres — rejected. Supabase bundles auth, realtime, and storage that conflict with our no-account / no-realtime / no-server-storage-of-plaintext stances. Neon is a thinner Postgres-only choice.
- **ChaCha20-Poly1305** instead of AES-256-GCM — rejected for v1. Not available in Web Crypto natively; requires polyfill audit. ChaCha is faster on mobile-without-AES-NI but every modern mobile chip has AES acceleration; no real performance argument for v1. Revisitable if a polyfill becomes attractive.
- **ECDSA** instead of Schnorr signatures — rejected. Schnorr is smaller, modern, supports aggregation, and `@noble` supports both — picking ECDSA is choosing the older standard for no benefit.
- **Vite + plain React** for frontend — viable alternative; rejected for v1 because Next.js's file-based routing and metadata APIs are ergonomic enough to be worth the bundle cost, and Cloudflare Pages has first-class Next support.
- **SvelteKit / SolidStart** — rejected for ecosystem-size reasons; React's design-system ecosystem is materially deeper for a v1 ship targeting Linear/Vercel-grade aesthetic.

## Open follow-ons

- **Wire-spec details** (envelope layout, KDF info strings, error code inventory) — Phase B (resolved by `what/docs/spec/spec_mop_v1.md`).
- **Renderer contract** (cross-implementation behavioral spec) — Phase C.
- **Native shell approach** (WASM core vs. re-implementation) — decided when renderer contract is written.
- **Test/monitoring/logging stack picks** — implementation phase.
- **Database schema** — implementation phase, informed by the wire spec.
- **Specific Cloudflare Workers compatibility flags / runtime tier** — implementation phase.
