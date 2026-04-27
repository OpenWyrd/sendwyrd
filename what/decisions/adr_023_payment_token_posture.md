---
type: decision
adr_id: adr_023
adr_number: 23
title: "Payment-token posture: detect locally, hand off to wallets, never settle"
status: accepted
created: 2026-04-26
updated: 2026-04-26
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, body, lightning, bitcoin, payments, posture, scope]
---

# ADR-023: Payment-Token Posture — Detect Locally, Hand Off to Wallets, Never Settle

## Status

Accepted.

## Context

A wyrd is a 300-codepoint, end-to-end-encrypted text capability with a fragment-borne read key. The body is plain UTF-8 text. Renderers already detect URLs and surface them as embeds (ADR-011) and exclude them from the codepoint cap (ADR-012, §8.2 of the spec).

Once Lightning and Bitcoin enter the picture, the renderer faces a choice: **how much of "payment" should SendWyrd model?** The space ranges from "ignore it; treat invoices as text" through "auto-render and route through an in-app wallet integration" all the way to "mint receipts, custody funds, run payment infrastructure."

Two protocol-shaped proposals were considered and rejected in this design pass:

- **`tip_offer` envelope field.** Author embeds a BOLT12 offer (or LNURL) into the encrypted envelope at compose time, AAD-bound, decrypted by the recipient renderer who surfaces a "tip" button. Couples each wyrd to a payment endpoint chosen at compose; entangles the protocol schema with payment semantics.
- **`kind: zap_attestation` wyrd type.** Protocol-level wyrd kind whose body is `{paid_to, amount_msat, preimage, original_handle}`, signed by a fresh `K_origin`. Verifiable proof-of-payment as a forwardable artifact. Adds a wyrd kind dedicated to a payment construct.

Both proposals would make SendWyrd less of a relay primitive and more of a payments-aware messaging app — XKCD-927 territory. Neither is necessary to give recipients a useful payment-handoff experience, because the body parser already runs client-side on decrypted text and OS-level URI handlers already exist for `bitcoin:` and `lightning:` schemes.

## Decision

SendWyrd's posture toward Lightning, Bitcoin, and any future payment rail is **detect-and-hand-off, never mint or settle**. Concretely:

### What SendWyrd does

1. **Detects payment tokens** in the decrypted body via the §8.1 token grammar. New segment kinds, parallel to `url`:
    - `lightning` — already shipped: BOLT11 invoices (`(lnbc|lntb|lnbcrt|lnsb)\d*[munp]?1[ac-hj-np-z02-9]{50,}`), BOLT12 offers/invoices/invoice-requests (`(lno|lni|lnr)1[ac-hj-np-z02-9]{50,}`), bare LNURL (`lnurl1[ac-hj-np-z02-9]{50,}`), and the `lightning:` URI catch-all. Lightning addresses (`user@domain.tld`) are detected only when (a) the domain matches a small allowlist of well-known providers (defined in `body.ts` next to other constants, easy to extend), or (b) the user opts in by prefixing with `lightning:`. Bare email-format strings on off-list domains stay text — no false positives on normal correspondence.
    - `bitcoin` — bech32/m native segwit and taproot (`bc1`/`tb1`/`bcrt1`), bare legacy P2PKH/P2SH (`1...`/`3...`, Base58Check, 25–34 chars), and the `bitcoin:` URI scheme (BIP-21).
2. **Excludes detected tokens from the 300-codepoint prose cap** (ADR-012, §8.2). Same rationale as the URL exclusion: long opaque payloads should not crowd the prose budget.
3. **Renders detected tokens as labelled inline chips** with an OS-handler link (`bitcoin:<addr>` / `lightning:<payload>`) and a copy affordance.
4. **Renders QR codes locally on demand**, recipient-side. The QR is encoded from the canonical URI form and rendered as inline SVG via a client-side library (no host roundtrip, no analytics, no external requests). The host serves ciphertext; the recipient's browser decrypts, parses, and paints. This property is automatic from the architecture, not a feature added on top.

### What SendWyrd does not do

1. **No envelope schema for payments.** No `tip_offer` field, no `tip_address`, no protocol-level coupling between a wyrd and a payment endpoint.
2. **No wyrd type dedicated to payment.** No `kind: zap_attestation`, no `kind: invoice`, no special authoring flow that mints a payment-bearing wyrd.
3. **No invoice minting.** SendWyrd never generates a BOLT11/BOLT12 invoice on behalf of a user. Authors paste their own invoices/offers/addresses into the body.
4. **No LNURL resolution.** Renderers do not hit `/.well-known/lnurlp/...` endpoints. Payment-token detection is purely string-pattern; resolution is left to the user's wallet when they scan/click.
5. **No custody, no settlement, no payment routing.** SendWyrd never holds keys, balances, channels, channel state, or any funds-bearing data. The protocol is text-relay; wallets are payments.
6. **No first-party wallet integration.** No "Connect Alby" button, no NWC connection management, no preferred-provider lock-in. The user's wallet handles the URI handoff at the OS level (browser → wallet via `bitcoin:` / `lightning:` scheme); SendWyrd does not bridge.
7. **No per-author Lightning identity binding.** Lightning addresses pasted into a wyrd are recognized for the wyrd they appear in, full stop. SendWyrd does not aggregate them across an author's wyrds, does not surface a "tip this author" button at the author level, does not link author identity to a payment endpoint. (This is also forced by the per-wyrd `K_origin` unlinkability property — there is no stable author identity to bind a payment endpoint to without breaking ADR-009 / ADR-017.)

### The principle

**SendWyrd carries text. Wallets carry value. The host stays out of the payment loop.**

Payment is exogenous — composable with the protocol, never modeled by it. The same way the protocol treats authorship (per-wyrd Schnorr keys, no protocol-level identity service), it treats payment: as a string in the body whose semantic expansion happens at the recipient's edge, in the recipient's wallet, with the recipient's keys. SendWyrd's only role is detection-and-handoff.

## Consequences

### Positive

- **The protocol stays a relay primitive.** No payment-shaped fields creep into the wire schema. v1.x clients and any future implementation continue to be valid by carrying the same text envelope, regardless of whether their renderer recognizes payment tokens.
- **Wallet ecosystem leverage.** Every Bitcoin and Lightning wallet on every platform handles `bitcoin:` and `lightning:` URI schemes. SendWyrd benefits from that work without owning any of it.
- **Author-blind property preserved.** The relay never sees Lightning addresses, BOLT11 invoices, or BTC addresses — they're in encrypted bodies. Recipient renderers see them; renderers run in the recipient's browser; the renderer never reports back to the relay.
- **No custody surface, no compliance surface.** SendWyrd is not a money-services business by any reasonable reading. Nothing about the protocol or the canonical client touches funds, ever.
- **Forward-compatible.** A future wyrd-renderer could absolutely add NWC support, a preferred-wallet picker, or a deeper integration in a downstream client — without changing the protocol or the canonical relay. The decision here is about what the protocol and first-party client do, not what any client *could* do.

### Negative

- **No protocol-level proof-of-tip.** The `kind: zap_attestation` proposal would have given recipients a verifiable artifact ("X paid Y sats for this wyrd"). Without it, tipping is invisible at the protocol layer — there's no on-protocol leaderboard, no aggregate "this wyrd has been tipped 12 times" surface. This is a feature, not a bug, per the anti-engagement-metric posture: the protocol is not in the business of social signal.
- **Lightning addresses on off-allowlist domains require user opt-in.** A user with an LN address at `me@my-self-hosted-node.example` won't get auto-rendered until they prefix with `lightning:` or the allowlist grows. The audit cost is documenting which providers are recognized; the alternative (universal email-shaped detection) is worse because it false-positives on every email in every wyrd.
- **Composer cannot offer "send tip to author."** Because there is no author identity persisted across wyrds and no envelope-level tip endpoint, the composer never asks "do you want to receive tips on this wyrd?" Authors who want tips paste their own offer/address into the body. That's the contract.

### Neutral

- The `body.ts` parser surfaces `kind: "lightning"` and `kind: "bitcoin"` segments; whether a given client renders a chip, a QR, or just escapes the text is a renderer-level decision. The canonical web client renders chip + on-demand QR; alternative clients may render differently.
- The Lightning-address allowlist is a soft surface — adding/removing providers is a documentation + small code change, not a protocol change. Keep the list short and well-known to avoid endorsement perception.
- BIP-21 query parameters (`?amount=`, `?label=`, `?message=`) on `bitcoin:` URIs are preserved through the chip → QR pipeline without interpretation. Wallets parse them.

## Alternatives considered

- **Embed `tip_offer` in the envelope (Design A from the Lightning exploration).** Rejected. Couples each wyrd to a payment endpoint at compose time, encrypts the endpoint into the envelope, and grows the wire schema. The same outcome — recipient sees a tip-able artifact — is achieved by detecting an offer pasted into the body. No schema change needed.
- **Add a `kind: zap_attestation` wyrd type (Design C).** Rejected. Adds a wyrd kind dedicated to a payment construct, biases the protocol toward modeling payment events. The same proof-of-payment is achievable out of band via Lightning's preimage → payment_hash verification chain; nothing in SendWyrd needs to model it.
- **Per-wyrd ephemeral invoice via NWC (Design B).** Rejected by the Lightning exploration agent. Requires the author's browser to be online when a renderer wants to tip — incompatible with asynchronous wyrd reading.
- **Detect every email-format string as a Lightning address.** Rejected. False-positive rate is too high; treating every email in every wyrd as a payment endpoint is wrong for the dominant case (real correspondence). Allowlist + `lightning:` opt-in is the safer middle.
- **Skip Lightning-address detection entirely; require BOLT11 / BOLT12 / LNURL paste.** Rejected as too austere. Lightning addresses are how most users actually receive payment in 2026; users will paste them and expect the renderer to recognize them. The allowlist serves the dominant case without inviting email collisions.
- **Build a first-party wallet (Connect-Alby, NWC integration, embedded LN-LSP).** Rejected. SendWyrd is a relay primitive; "connect your wallet" is the first step toward becoming a payments app, with the compliance and custody implications that follow. A downstream client could ship this; the canonical client must not.

## Open follow-ons

- ~~**Lightning-address allowlist content.**~~ **Resolved** — shipped with 10 providers (getalby.com, walletofsatoshi.com, strike.me, coinos.io, mutinywallet.com, blink.sv, phoenix.acinq.co, sats.mobi, bitnob.com, primal.net), exported as `LN_ADDRESS_DOMAINS` from `@sendwyrd/core`. Easy to extend.
- ~~**QR library choice.**~~ **Resolved** — `qrcode-svg` (~5kB, pure-JS SVG output). Renders 192×192 inline below the chip on demand.
- **`bitcoin:` URI parameter rendering.** Open. Currently the chip just labels "bitcoin"; BIP-21 amount/label query params pass through to the wallet untouched but aren't surfaced in the chip preview. Lean: show the parsed amount if present (e.g., "0.001 BTC to bc1q…") so the user knows what they'd be paying before scanning. Renderer detail; not protocol.
- **Future renderer extensions** (NWC, BOLT12 fetching, etc.) are out of v1 scope and explicitly NOT canonical-client commitments. If a downstream client ships them, that's their decision.
