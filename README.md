# SendWyrd

**Hyperlinks for conversation.** Social message objects you can pass anywhere, across any app or website by sharing a link. Encrypted, ephemeral, capability-URL-addressed.

Protocol codename: **MOP** (Message Object Protocol). Consumer brand: **SendWyrd** (`sendwyrd.com`). Unit noun: a **wyrd** (lowercase).

---

## Why

1. **Every social media platform has lock-in, and every messaging app limits social shareability.** What if instead you had messages which you share with people you think are relevant, and they can pass them forward. *Depth over breadth.*

2. **6 degrees of separation rule-of-thumb.** If you embed a request — *"I am such-and-such person, and I want to find people who might be interested in such-and-such project"* — and your friends pass that to a person who is more likely than them to know someone like that, and it iterates, can the global social graph become faster to traverse?

3. **If you broker introductions for people, can you have a single object** — a digital envelope of sorts — that you hand off to the most relevant person, rather than having to orchestrate the connection chain?

4. **Within the tradeoffs of security and reach,** can a useful balance be found with capability links where you rely on human judgement as to whether you trust the graph of people downstream?

5. **Can the inherent absence of public blasting** of messages be a way to foster relationships focused on intent and action rather than bloviating theatrically about opinions, as if being "right" via group consensus has any material relevance?

6. **The entire internet has been contorted by dopamine** and philosophies of constraints built up over millennia, which weakens the individual — and yet the most powerful force will be found in the most capable human network. Rather than receding from the web, can AI revealing what is inhuman allow us to discover the power of human networks collaborating and accumulating resources to their advantage?

---

## How it works

A wyrd is a 300-codepoint, end-to-end-encrypted text block that becomes a shareable URL — a portable, composable, forward-worthy conversational artifact that travels through existing messaging rails (iMessage, Signal, WhatsApp, Slack, email) rather than through a native feed or discovery layer.

```
https://sendwyrd.com/w/{handle}#{K_read}
```

The handle is in the path; the read key is in the URL fragment. Browsers don't transmit fragments to servers — so the host stays body-blind. Anyone holding the URL can read the wyrd; whoever you share it with can forward it to whoever they think is relevant.

- **No accounts.** Capability over identity.
- **No feed.** No timeline, no algorithm, no public broadcast.
- **No archive.** Default 90-day TTL; you can pick shorter or none.
- **Brittleness as feature.** The architecture refuses durable identity and durable archive on purpose.

The protocol carries text only. Identity, signing, trust, and provenance are either inlined by the user into the body (a name, a Nostr signature) or inherited from the share channel ("a friend sent me this"). Trust rides the rail.

Architectural decisions are recorded as ADRs in [`what/decisions/`](what/decisions/). The wire spec lives at [`what/docs/spec/spec_mop_v1.md`](what/docs/spec/spec_mop_v1.md).

---

## Repository layout

This repo carries both the project's knowledge architecture (aDNA in `what/`, `how/`, `who/`) and its v1 implementation code (`packages/`).

```
sendwyrd/
├── what/                       # Specs, ADRs, context library (aDNA)
├── how/                        # Sessions, missions, backlog (aDNA)
├── who/                        # Vision, governance (aDNA)
├── packages/
│   ├── core/                   # Shared TS — crypto, HD, URL parsing, wire types (1.6k LOC)
│   ├── api/                    # Hono on Cloudflare Workers (650 LOC)
│   └── web/                    # Next.js canonical web client + PWA (3.5k LOC)
└── .github/workflows/          # Auto-deploy on push to main
```

## Key documents

| Document | What it is |
|---|---|
| `MANIFEST.md` | Project identity overview |
| `STATE.md` | Current operational state |
| `who/governance/VISION.md` | Five immutable design principles + scope walls |
| `what/decisions/` | All architectural decision records (ADRs 003–021) |
| `what/docs/spec/spec_mop_v1.md` | Wire-protocol specification |
| `what/docs/spec/renderer_contract_v1.md` | Cross-implementation renderer behavioral contract |
| `what/docs/spec/visual_direction_v1.md` | Color, type, motion, IA, screen flows |

## Stack

- **Frontend**: Next.js 15 + React + TypeScript, deployed via OpenNext to Cloudflare Workers; installable PWA
- **Backend**: Hono on Cloudflare Workers
- **Database**: Neon Postgres + Drizzle ORM
- **Crypto**: Web Crypto API (AES-256-GCM) + `@noble/curves` (secp256k1 + BIP-340 Schnorr) + `@scure/bip32` + `@scure/bip39`
- **Observability**: Sentry, with renderer-contract §16 redaction (URL fragments stripped, request bodies redacted, b64u patterns scrubbed)
- **CI/CD**: GitHub Actions auto-deploys api + web on push to `main`; smoke test against production gates the deploy

## Development

Prerequisites: Node ≥20, pnpm ≥9.

```bash
pnpm install
pnpm dev                                   # runs all packages in parallel
```

Per-package:

```bash
pnpm --filter @sendwyrd/web dev
pnpm --filter @sendwyrd/api dev
pnpm --filter @sendwyrd/core test          # 142 unit tests, ~96% coverage on the crypto module
pnpm --filter @sendwyrd/web test           # 103 component + integration tests
```

End-to-end smoke (against production):

```bash
pnpm --filter @sendwyrd/core exec tsx scripts/e2e-smoke.ts        # publish/fetch/decrypt
pnpm --filter @sendwyrd/core exec tsx scripts/e2e-replies.ts      # ECIES reply roundtrip
pnpm --filter @sendwyrd/core exec tsx scripts/e2e-permanent.ts    # ttl=0 sentinel
```

## Deploy

Production deploys are automatic on push to `main` (see `.github/workflows/deploy.yml`). Manual deploy:

```bash
cd packages/api && wrangler deploy
cd packages/web && pnpm exec opennextjs-cloudflare build && pnpm exec opennextjs-cloudflare deploy
```

## License

Unreleased. License TBD before public source release.
