# SendWyrd

Hyperlinks for conversation. Encrypted, ephemeral, capability-URL-addressed.

Protocol codename: **MOP** (Message Object Protocol). Consumer brand: **SendWyrd** (`sendwyrd.com`). Unit noun: a **wyrd** (lowercase).

This repo carries both the project's knowledge architecture (aDNA in `what/`, `how/`, `who/`) and its v1 implementation code (`packages/`, `infra/`). The aDNA layer governs the project; the code layer ships the product.

## Status

v1 architecture phase is **closed** (ADRs 003–020 banked). Currently in build-readiness: Phase E (scaffolding) → F (landing copy) → G (implementation). See `STATE.md` for current position.

## Repository layout

```
sendwyrd/
├── what/                       # Specs, ADRs, context (aDNA)
├── how/                        # Sessions, missions, backlog (aDNA)
├── who/                        # Vision, governance (aDNA)
├── packages/
│   ├── core/                   # Shared TS core (crypto, HD, URL parsing, wire types)
│   ├── api/                    # Hono on Cloudflare Workers
│   └── web/                    # Next.js canonical web client
├── infra/
│   └── drizzle/                # Postgres schema + migrations
└── apps/                       # (post-v1) iOS / Android shells
```

## Key documents

| Document | What it is |
|----------|-----------|
| `MANIFEST.md` | Project identity overview |
| `STATE.md` | Current operational state |
| `who/governance/VISION.md` | Five immutable design principles + scope walls |
| `what/decisions/` | All architectural decision records (ADRs 003–020) |
| `what/docs/spec/spec_mop_v1.md` | Wire-protocol specification |
| `what/docs/spec/renderer_contract_v1.md` | Cross-implementation renderer behavioral contract |
| `what/docs/spec/visual_direction_v1.md` | Color, type, motion, IA, screen flows |

## Stack (per ADR-020)

- **Frontend**: Next.js + React + TypeScript + Tailwind v4
- **Backend**: Hono on Cloudflare Workers
- **Database**: Neon Postgres + Drizzle ORM
- **Object storage**: Cloudflare R2 (encrypted ciphertext blobs)
- **Edge**: Cloudflare (CDN + rate-limits + bot mitigation)
- **Crypto**: Web Crypto API (AES-256-GCM) + `@noble/curves` (secp256k1 + Schnorr) + `@scure/bip32` + `@scure/bip39`

## Development

Prerequisites: Node ≥20.18, pnpm ≥9.

```bash
pnpm install
cp .env.example .env.local      # fill in DATABASE_URL
pnpm dev                         # runs all packages in parallel
```

Per-package commands:

```bash
pnpm --filter @sendwyrd/web dev
pnpm --filter @sendwyrd/api dev
pnpm --filter @sendwyrd/core typecheck
```

Database (after `pnpm install` and `.env.local` filled):

```bash
pnpm --filter @sendwyrd/api db:generate    # produce migration from schema.ts
pnpm --filter @sendwyrd/api db:migrate     # apply migrations
```

## Deploy

API (Cloudflare Workers):

```bash
cd packages/api
wrangler secret put DATABASE_URL       # one-time, set Worker secret
wrangler deploy
```

Web (Cloudflare Pages):

```bash
cd packages/web
pnpm build
wrangler pages deploy .next --project-name sendwyrd-web
```

## License

Unreleased. License TBD before public source release.
