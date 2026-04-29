# SendWyrd

**Hyperlinks for conversational objects.** Social message objects you can pass anywhere, across any app or website by sharing a link. Encrypted, ephemeral, capability-URL-addressed. The conversation that emerges around them is up to the people passing them along.

Protocol codename: **MOP** (Message Object Protocol). Consumer brand: **SendWyrd** (`sendwyrd.com`). Unit noun: a **wyrd** (lowercase).

---

## Why

1. **Every social media platform has lock-in, and every messaging app limits social shareability.** What if instead you had messages which you share with people you think are relevant, and they can pass them forward? _Depth over breadth._

2. **6 degrees of separation rule-of-thumb.** If you embed a request — _"I am such-and-such person, and I want to find people who might be interested in such-and-such project"_ — and your friends pass that to a person who is more likely than them to know someone like that, and it iterates, can the global social graph become faster to traverse?

3. **If you broker introductions for people, can you have a single object** — a digital envelope of sorts — that you hand off to the most relevant person, rather than having to orchestrate the connection chain?

4. **Within the tradeoffs of security and reach,** can a useful balance be found with capability links where you rely on human judgement as to whether you trust the graph of people downstream?

5. **Can the inherent absence of public blasting** of messages be a way to foster relationships focused on intent and action rather than bloviating theatrically about opinions, as if being "right" via group consensus has any material relevance?

6. **The entire internet has been contorted by dopamine** and philosophies of constraints built up over millennia, which weakens the individual — and yet the most powerful force will be found in the most capable human network. Rather than receding from the web, can AI revealing what is inhuman allow us to discover the power of human networks collaborating and accumulating resources to their advantage?

---

## How it works

A wyrd is a 300-codepoint, end-to-end-encrypted text block that becomes a shareable URL — a portable, composable, forward-worthy conversational artifact that travels through existing messaging rails (iMessage, Signal, WhatsApp, Slack, email) rather than through a native feed or discovery layer.

```
https://sendwyrd.com/w/{object_handle}#{K_read}
```

The object handle (a per-wyrd random identifier — not a user handle) is in the path; the read key is in the URL fragment. Browsers don't transmit fragments to servers — so the host stays body-blind. Anyone holding the URL can read the wyrd; whoever you share it with can forward it to whoever they think is relevant.

- **No accounts.** Capability over identity.
- **No feed.** No timeline, no algorithm, no public broadcast.
- **No archive.** Default 90-day TTL; you can pick shorter or none.
- **Mosaic Quality as feature.** The architecture refuses durable identity and durable archive on purpose. Each wyrd is a tile in a mosaic — independently meaningful; lost tiles leave gaps but don't break what remains.

The protocol carries text only. Identity, signing, trust, and provenance are either inlined by the user into the body (a name, a Nostr signature) or inherited from the share channel ("a friend sent me this"). Trust rides the rail.

Architectural decisions are recorded as ADRs in [`what/decisions/`](what/decisions/). The wire spec lives at [`what/docs/spec/spec_mop_v1.md`](what/docs/spec/spec_mop_v1.md).

---

## Architecture: no identity primitives

The architecture refuses identity. The protocol carries text and capability keys; nothing else. No accounts, no usernames, no logins, no PKI.

Each wyrd has its own random `K_origin` keypair, derived at `m/300'/n'` for an incrementing `n`. Two wyrds composed by the same person produce different `K_origin_pub` values. **The host cannot tell whether two wyrds came from the same author.** Counting distinct `K_origin_pub` values equals counting wyrds, not people.

Possession of the URL is access. Forwarding is the default and the point. There is no friend graph, no follower list, no broadcast surface, no "who" primitive of any kind.

## Cryptography

- **Body envelope**: AES-256-GCM via the Web Crypto API. `K_read` is 32 bytes of CSPRNG, generated per-wyrd at compose time.
- **Author keys**: secp256k1; signatures via BIP-340 Schnorr (publish, burn). One keypair per wyrd.
- **Replies**: ECIES — anyone with the URL encrypts a reply to `K_origin_pub`; only the author can decrypt. One-shot.
- **Seed**: BIP-39 mnemonic (12 or 24 words). HD path: `m/300'/n'` (BIP-43 flat purpose, hardened indices).
- **Distribution**: `K_read` lives in the URL fragment. Browsers do not transmit fragments to servers (RFC 3986). The host is body-blind on every request.
- **AAD binding**: every envelope binds version, handle, expiry, and reply-mode into the AES-GCM authenticated data. Tampering any field fails decryption.

## Mosaic Quality as contract

SendWyrd is a **mosaic mesh network**. Mesh: each wyrd hops across whatever platforms people already use — iMessage to Twitter DM to Slack to email — routed by human judgement, not algorithms. Mosaic: each wyrd is a tile, independently meaningful; lost tiles leave gaps but don't break the wyrds that remain. SendWyrd doesn't own a network and refuses an archive that would hold the whole picture; the assembly lives in the social graph itself.

`K_read` is per-wyrd random, not derived from your seed. If you lose the URL, the body becomes unreadable — even if you still hold your mnemonic.

Mnemonic recovery rebuilds your wyrd-handle list and your author keys (you can decrypt replies, burn old wyrds, prove authorship) but cannot reconstruct `K_read` for sealed wyrds whose URLs you've lost. The protocol refuses durable archive on purpose.

Default TTL is 90 days. Local storage may evict. Mnemonic backup is the only recovery path the protocol offers — and even that recovers identity, not content.

## Why not Nostr

Nostr is identity-first. Each user has a stable `npub`/`nsec` keypair. Events are signed by that stable key, posted to relays, aggregated by clients into feeds. Most events are public broadcasts.

SendWyrd makes the opposite call. No stable per-user key — per-wyrd random `K_origin`. No public broadcast — the URL is the only path. The host stays blind. The protocol refuses durable archive.

The two solve different problems. Nostr optimizes for _censorship-resistant public broadcasting_ — important. SendWyrd optimizes for _host-blind ephemeral handoff through trust networks_ — a different problem in the same neighborhood. They compose: a wyrd body can embed an `npub` as plain text if you want attribution. SendWyrd doesn't model identity; it inherits whatever the body declares.

The deepest difference is the archive. Nostr accumulates a signed event log per identity. SendWyrd refuses the archive on purpose.

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

| Document                                 | What it is                                        |
| ---------------------------------------- | ------------------------------------------------- |
| `MANIFEST.md`                            | Project identity overview                         |
| `STATE.md`                               | Current operational state                         |
| `who/governance/VISION.md`               | Five immutable design principles + scope walls    |
| `what/decisions/`                        | All architectural decision records (ADRs 003–021) |
| `what/docs/spec/spec_mop_v1.md`          | Wire-protocol specification                       |
| `what/docs/spec/renderer_contract_v1.md` | Cross-implementation renderer behavioral contract |
| `what/docs/spec/visual_direction_v1.md`  | Color, type, motion, IA, screen flows             |

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

`sendwyrd` is **mixed-license**, mirroring the [OpenWyrd MOP](https://github.com/openwyrd/mop) project posture:

- **Server (`packages/api`, root, default)** — [`AGPL-3.0-or-later`](LICENSE). Running a modified server against users obligates you to publish your modifications. The hosted-service capture loophole closes here.
- **Reference web client (`packages/web`)** — [`Apache-2.0`](packages/web/LICENSE). The trust boundary is the server, not the client; deployers must be free to fork and redistribute the UI.
- **Client libraries (`packages/core`, `packages/mcp`)** — [`Apache-2.0`](packages/mcp/LICENSE). Permissive at the client edge to maximize protocol adoption.

Governance — including permanent commitments, plugin boundary, premium / commercial posture, and trademark policy — lives in [`openwyrd/mop` `governance/CHARTER.md`](https://github.com/openwyrd/mop/blob/main/governance/CHARTER.md) and [`governance/TRADEMARK.md`](https://github.com/openwyrd/mop/blob/main/governance/TRADEMARK.md). `sendwyrd` operates under that charter as the canonical reference implementation.
