---
type: governance
subtype: vision
created: 2026-04-24
updated: 2026-04-26
last_edited_by: agent_operator
status: active
tags: [governance, vision, mop, sendwyrd, post-agora]
---

# VISION — Hyperlinks for Conversation

## North Star

**SendWyrd (protocol codename: MOP) exists to give human conversation a hyperlink.**

A wyrd is a 300-codepoint, end-to-end-encrypted text block that becomes a shareable URL — a portable, composable, forward-worthy conversational artifact that travels through existing messaging rails (iMessage, Signal, WhatsApp, X, Slack, email) rather than through a native feed or discovery layer.

Not a new social network. Not a messenger replacement. Not a decentralized messaging protocol. Hyperlinks. For conversation.

This is the design filter. When in doubt, ask: *does this make SendWyrd more like "hyperlinks for conversation," or less?*

---

## The Five Design Principles

These principles are immutable within the v1 phase. Every implementation decision must align to at least one. Revision requires explicit phase-gate review.

### 1. Hyperlinks for Conversation (North Star)

**Statement**: SendWyrd is a layer for portable conversational artifacts that ride on existing rails. It is never a feed, never a discovery engine, never a social graph, never a messenger.

**Alignment test**: Does this feature replace or compete with an existing messaging app, or does it produce *artifacts* that flow through existing apps?

**Example**: Building a wyrd UI for live back-and-forth chat would *replace messaging apps* — fails the test. Producing a beautifully-rendered URL that someone can paste into iMessage *enhances messaging apps* — passes.

### 2. Protocol Carries Text Only

**Statement**: MOP carries text and a few minimal capability primitives. Identity, signing, trust, attribution, and provenance are never modeled by the protocol itself. They are either **inlined by the user into the body** (endogenous — e.g., a Nostr signature, a name in the text) or **inherited from the share channel** (exogenous — e.g., the trust signal of "a friend sent me this").

**Alignment test**: Does this feature add a protocol-level concept of *who, when, or why* beyond the body text and capability keys?

**Example**: Proposing an `author` field in the schema fails the test. Proposing that the user paste their npub into the body if they want attribution passes.

### 3. Capability over Identity

**Statement**: Possession of the URL implies access. There are no accounts, no usernames, no logins, no PKI hierarchy within SendWyrd. Author-side capability is held as a private URL the user keeps locally; recipient-side capability is the share URL itself.

**Alignment test**: Does this feature require the protocol to know *who* a user is across multiple objects?

**Example**: A "user dashboard showing all your authored objects" implemented server-side fails the test (requires cross-object identity). A device-local list of K_origin URLs the user has held passes.

### 4. Mosaic Quality

**Statement**: The architecture refuses durable identity and durable archive *on purpose*. K_origin lives device-local and dies with the device unless the user deliberately backs up their seed phrase. Default wyrd TTL is 90 days. The system architecturally penalizes its own use as a permanent archive. SendWyrd is a *mosaic mesh network*: each wyrd is a tile, independently meaningful, hopping across whatever platforms people already use; lost tiles leave gaps but don't break the wyrds that remain. The assembly lives in the social graph itself — there is no canonical archive to lose.

**Renamed from "Brittleness as Feature" (2026-04-26)**. The principle is unchanged. The new framing emphasizes the architecture's positive shape (composed of independent tiles spanning a mesh) rather than its negative property (fragility). ADRs 003, 005, 006, 008, 014 reference the prior name; they remain frozen as historical record.

**Alignment test**: Does this feature make SendWyrd function as a personal archive, identity record, or pundit ledger?

**Example**: Default-on cloud backup of all authored objects fails the test. Optional BIP-39 seed export for the disciplined user passes — robustness becomes a deliberate opt-in, never an architecture-supplied default.

**Why**: Hot-take preaching, identity-building threads, and self-curation incentives all depend on durability. Removing durability nudges users toward action-oriented content (intros, asks, ephemeral relays, ideas worth sharing once and dissolving). The user's framing: *Nietzschean — content that fits a moment, then is gone.*

### 5. Contact, Not Conversation

**Statement**: SendWyrd's reply primitive exists only because the origin has no other way to reach the nth recipient through an opaque chain. It is a forensically necessary back-channel, not a feature to grow. Replies are one-shot encrypted blobs, off by default, opt-in only when the author needs the back-channel. Once contact is established, the conversation moves to existing rails.

**Alignment test**: Does this feature turn SendWyrd into a place where conversations *happen* rather than where they *start*?

**Example**: Threading, reply-to-reply, notification UX optimized for engagement — all fail. A single decrypt-and-display reply page accessed via the K_origin URL passes.

---

## Trust Substrate

The relational layer that makes SendWyrd work — the percolation of wyrds through trust networks — lives **outside** the protocol. It lives in the existing rails (iMessage threads, Signal groups, real-world relationships) that carry the URL. The protocol stays narrow. Trust rides the rail.

This is the resolution of the *object-first vs. relational-first* tension: SendWyrd is **object-first as practical implementation, relational-first as distribution substrate.** The protocol primitive is the wyrd; the substrate it rides on is human relationships.

---

## The Post-Agora Topology

The five principles above systematically refuse every component of an algorithmic public square — no identity, no platform, no feed, no notifications, no conversation. What's left is a substrate of identity-less, ephemeral, capability-keyed capsules with no native discovery layer.

The natural follow-up — *"then how does anything reach anyone?"* — has a specific answer that isn't "another platform." **Routing becomes personal infrastructure, not platform infrastructure.** Per-user agents do the connective work that an algorithmic agora used to. The agora isn't replaced by another agora; it dissolves into a swarm of per-user routers, each working on behalf of one human, each opaque to the rest.

This is not a sixth principle. It is the *consequence* of the five. Each principle structurally *enables* this topology:

| Principle | What it enables for agent-routing |
|-----------|-----------------------------------|
| Hyperlinks for conversation | A wyrd-URL is venue-agnostic — the same capsule rides agent-to-agent contexts (a shared file, a DM, an inbox) the same as any other channel. |
| Protocol carries text only | The agent network is implicit, not modeled. SendWyrd does not try to be an agent mesh; it is the capsule format the agents exchange. |
| Capability over identity | Wyrds stay identity-less on the wire. Routing-context (who-sent-what-to-whom, who'd care, what to forward) lives at the agent layer, never on the protocol. |
| Brittleness as feature | Wyrds die in 90 days. Routing is forced to be present-tense — nothing accumulates into a permanent ranked archive that re-creates the agora the protocol just refused. |
| Contact, not conversation | Agents *transcribe* and *forward*; they never autonomously converse. Send-acts stay human-intentional. |

### What this implies architecturally

- **Agents cannot crawl SendWyrd.** There is no list-all, no feed, no discovery endpoint. The agent-routing layer operates only on streams the human has already opted into: wyrd URLs the human has received, wyrd URLs the human's contacts have sent, wyrd URLs surfaced via PKM / CRM integration (see `future_horizons.md` H1). The agent's job is **triage + forward + surface**, not search.
- **Verbs only, never subscriptions.** Whatever surface SendWyrd exposes to agents (MCP, future SDKs) must be verb-shaped — compose, view, burn, reply, attest. No `_watch`, no `_subscribe`, no auto-reply, no inbox-poller. Subscription tools would push SendWyrd toward conversation-hosting and violate Principle 5.
- **The agent acts *as* the human, with the human's keys.** Not a separate identity. An agent operating with the user's mnemonic *is* the user, cryptographically. There is no agent-class principal. The capability-over-identity rule is preserved.

### Strategic significance

This is the answer to *"why a primitive that refuses every feature?"* — because the feature refusal is what *creates* the routing-substrate-shaped vacancy that personal agents step into. A protocol that supplied its own discovery would compete with the agent layer; SendWyrd cooperates with it by abstaining.

The MCP server (`packages/mcp/`) is the first concrete realization: any Claude Code / Claude Desktop / Cursor user's agent becomes a SendWyrd routing node by default. Without that binding, the substrate exists and no agent can pick up the capsules. With it, the capsule format and the routing layer click together. See `future_horizons.md` H3 for follow-on agent-routing surfaces (none of which are protocol changes).

---

## What SendWyrd Is Not (Scope Walls)

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

If a feature requires breaking any scope wall, it does not belong in SendWyrd. Spin it out as a separate project that *uses* the MOP protocol as a primitive.

---

## Use Cases (Illustrative, Not Prioritized)

Per ADR-015, SendWyrd is deliberately unopinionated about which of these to optimize for. All are coherent with the principles above. None is the headline pitch — the product is the primitive.

| # | Use case | Wedge |
|---|----------|-------|
| 1 | **Cross-post canonical URL** | Publish once on SendWyrd, share the URL across Twitter / iMessage / Slack as the canonical artifact for a thought. The URL is the artifact; the rails are distribution. **Note (per ADR-021):** the URL deliberately does NOT unfurl into a link-card preview on social platforms. Recipients see a bare URL and must visit to read. The protocol refuses the algorithmic-preview surface to keep SendWyrd out of feed-rendering UIs — readers who click are higher-signal than readers who scroll-by. |
| 2 | **Intro / ask routing** | "X is looking for someone who can help with Y." Recipients forward via trust networks; terminal recipient reaches origin via the reply primitive without anyone in the chain having to coordinate. Strips real overhead from a thing humans do constantly but inefficiently. |
| 3 | **Whisper-network dissemination** | Off-algo circulation of edgy/early ideas — often pointer-cards to externally-hosted long-form (whitepapers, GDocs, etc.). The fact of dissemination, plus who-shared-with-whom, is itself meaningful. |
| 4 | **Tweet-replacement** | Author posts the canonical wyrd URL on Twitter (or wherever) instead of native posts. Recursive references enable thread-via-quoting. Self-archive incentive deliberately weakened by Mosaic Quality rule (P4). |

---

## Risks (Tracked, Not Resolved)

From the architecture pack §23, retained for orientation:

- **Product**: insufficient differentiation vs. paste-into-iMessage; too much creation friction; "weird pastebin with no wedge."
- **Technical**: capability leakage; preview-crawler interaction (resolved by host-blind single-form addressing — see ADR-003, ADR-021; supersedes the two-form approach in ADR-004); abuse flooding (PoW/rate-limit design pending).
- **Strategic**: drift toward feature creep; pressure to add identity, threading, or feed primitives.

The principles above exist to harden against the strategic risk specifically.

---

## Revision Protocol

- Principles 1–5 are immutable within the v1 phase.
- Scope walls are immutable until the user explicitly elevates a phase gate.
- Use case priority is **closed** as deliberately unopinionated per ADR-015. The four use cases are illustrative, not ranked.
- Revisions to this document require recording rationale inline.
