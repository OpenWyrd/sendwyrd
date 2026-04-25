---
type: governance
subtype: vision
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
status: active
tags: [governance, vision, mop]
---

# VISION — Hyperlinks for Conversation

## North Star

**MOP exists to give human conversation a hyperlink.**

A Hypermessage is a tweet-sized, end-to-end-encrypted text block that becomes a shareable URL — a portable, composable, forward-worthy conversational artifact that travels through existing messaging rails (iMessage, Signal, WhatsApp, X, Slack, email) rather than through a native feed or discovery layer.

Not a new social network. Not a messenger replacement. Not a decentralized messaging protocol. Hyperlinks. For conversation.

This is the design filter. When in doubt, ask: *does this make MOP more like "hyperlinks for conversation," or less?*

---

## The Five Design Principles

These principles are immutable within the v1 phase. Every implementation decision must align to at least one. Revision requires explicit phase-gate review.

### 1. Hyperlinks for Conversation (North Star)

**Statement**: MOP is a layer for portable conversational artifacts that ride on existing rails. It is never a feed, never a discovery engine, never a social graph, never a messenger.

**Alignment test**: Does this feature replace or compete with an existing messaging app, or does it produce *artifacts* that flow through existing apps?

**Example**: Building a Hypermessage UI for live back-and-forth chat would *replace messaging apps* — fails the test. Producing a beautifully-rendered URL that someone can paste into iMessage *enhances messaging apps* — passes.

### 2. Protocol Carries Text Only

**Statement**: The protocol carries text and a few minimal capability primitives. Identity, signing, trust, attribution, and provenance are never modeled by the protocol itself. They are either **inlined by the user into the body** (endogenous — e.g., a Nostr signature, a name in the text) or **inherited from the share channel** (exogenous — e.g., the trust signal of "a friend sent me this").

**Alignment test**: Does this feature add a protocol-level concept of *who, when, or why* beyond the body text and capability keys?

**Example**: Proposing an `author` field in the schema fails the test. Proposing that the user paste their npub into the body if they want attribution passes.

### 3. Capability over Identity

**Statement**: Possession of the URL implies access. There are no accounts, no usernames, no logins, no PKI hierarchy within MOP. Author-side capability is held as a private URL the user keeps locally; recipient-side capability is the share URL itself.

**Alignment test**: Does this feature require the protocol to know *who* a user is across multiple objects?

**Example**: A "user dashboard showing all your authored objects" implemented server-side fails the test (requires cross-object identity). A device-local list of K_origin URLs the user has held passes.

### 4. Brittleness as Feature

**Statement**: The architecture refuses durable identity and durable archive *on purpose*. K_origin lives device-local and dies with the device unless the user deliberately backs up their seed phrase. Default object TTL is 90 days. The system architecturally penalizes its own use as a permanent archive.

**Alignment test**: Does this feature make MOP function as a personal archive, identity record, or pundit ledger?

**Example**: Default-on cloud backup of all authored objects fails the test. Optional BIP-39 seed export for the disciplined user passes — robustness becomes a deliberate opt-in, never an architecture-supplied default.

**Why**: Hot-take preaching, identity-building threads, and self-curation incentives all depend on durability. Removing durability nudges users toward action-oriented content (intros, asks, ephemeral relays, ideas worth sharing once and dissolving). The user's framing: *Nietzschean — content that fits a moment, then is gone.*

### 5. Contact, Not Conversation

**Statement**: MOP's reply primitive exists only because the origin has no other way to reach the nth recipient through an opaque chain. It is a forensically necessary back-channel, not a feature to grow. Replies are one-shot encrypted blobs, off by default, opt-in only when the author needs the back-channel. Once contact is established, the conversation moves to existing rails.

**Alignment test**: Does this feature turn MOP into a place where conversations *happen* rather than where they *start*?

**Example**: Threading, reply-to-reply, notification UX optimized for engagement — all fail. A single decrypt-and-display reply page accessed via the K_origin URL passes.

---

## Trust Substrate

The relational layer that makes MOP work — the percolation of objects through trust networks — lives **outside** the protocol. It lives in the existing rails (iMessage threads, Signal groups, real-world relationships) that carry the URL. The protocol stays narrow. Trust rides the rail.

This is the resolution of the *object-first vs. relational-first* tension: MOP is **object-first as practical implementation, relational-first as distribution substrate.** The protocol primitive is the object; the substrate it rides on is human relationships.

---

## What MOP Is Not (Scope Walls)

**Do not build, in v1 or v2:**

- Internal feed, timeline, or "for you" view
- Followers, friends, mutuals, or any social-graph primitive
- Likes, reactions, public engagement metrics
- Discovery, recommendation, search across objects
- Public comments
- Full Nostr-style relay network
- Blockchain, NFT, or token primitives
- Identity protocol or PKI
- Native real-time messaging
- Group chat
- Algorithmic distribution of any kind
- Ad-supported monetization

If a feature requires breaking any scope wall, it does not belong in MOP. Spin it out as a separate project that *uses* MOP as a primitive.

---

## Use Cases (v1 Candidates)

MOP is deliberately unopinionated about which of these to optimize for. All are coherent with the principles above.

| # | Use case | Wedge |
|---|----------|-------|
| 1 | **Cross-post canonical URL** | Publish once on MOP, share the URL across Twitter / iMessage / Slack as the canonical artifact for a thought. The URL is the artifact; the rails are distribution. |
| 2 | **Intro / ask routing** | "X is looking for someone who can help with Y." Recipients forward via trust networks; terminal recipient reaches origin via the reply primitive without anyone in the chain having to coordinate. Strips real overhead from a thing humans do constantly but inefficiently. |
| 3 | **Whisper-network dissemination** | Off-algo circulation of edgy/early ideas — often pointer-cards to externally-hosted long-form (whitepapers, GDocs, etc.). The fact of dissemination, plus who-shared-with-whom, is itself meaningful. |
| 4 | **Tweet-replacement** | Author posts the canonical Hypermessage URL on Twitter (or wherever) instead of native posts. Recursive references enable thread-via-quoting. Self-archive incentive deliberately weakened by brittleness rule (P4). |

---

## Risks (Tracked, Not Resolved)

From the architecture pack §23, retained for orientation:

- **Product**: insufficient differentiation vs. paste-into-iMessage; too much creation friction; "weird pastebin with no wedge."
- **Technical**: capability leakage; preview-crawler interaction (resolved by host-blind + two-form addressing — see ADR-003, ADR-004); abuse flooding (PoW/rate-limit design pending).
- **Strategic**: drift toward feature creep; pressure to add identity, threading, or feed primitives.

The principles above exist to harden against the strategic risk specifically.

---

## Revision Protocol

- Principles 1–5 are immutable within the v1 phase.
- Scope walls are immutable until the user explicitly elevates a phase gate.
- Use case priority is fluid — to be settled at v1 launch-scope decision (open question, see backlog).
- Revisions to this document require recording rationale inline.
