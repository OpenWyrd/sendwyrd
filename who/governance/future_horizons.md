---
type: governance
subtype: future_horizons
created: 2026-04-25
updated: 2026-04-26
last_edited_by: agent_operator
status: active
tags: [governance, future, aspirations, sendwyrd]
---

# Future Horizons

Canonical home for deliberate non-v1 ideas — things considered and **deliberately not shipped yet**, recorded so they don't get lost. Each entry captures the idea, why it's interesting, what it would require, and what would trigger a revisit.

This file is **not a roadmap**. It is a memory-ledger of generative possibilities. Inclusion here does not commit the project to ever building any of it.

This file is also distinct from `how/backlog/`:
- `how/backlog/` holds *open questions* and *deferred-but-likely* items (F1 burn-after-read, F2 bot-defense layer).
- `future_horizons.md` holds *aspirational integrations* and *external-product directions* — things that point toward how wyrds connect to the rest of a user's tool ecosystem rather than what wyrds are internally.

---

## H1 — PKM and personal-CRM integration

### Idea

Wyrds, by design, are stable capability-URLs to discrete pieces of authored content. That's the same shape as a node in a personal knowledge management (PKM) tool — **Roam Research, Obsidian, Logseq, Tana** — or a record in a **personal CRM** (Notion CRMs, Folk, Clay, Affinity, etc.).

The aspiration: let users bring wyrds into their existing knowledge graph and contact systems as first-class entities.

Concrete use cases:
- **Roam / Obsidian / Logseq**: paste a wyrd URL into a daily note; the PKM resolves it (OG metadata or a dedicated plugin) and shows the wyrd as a backlinked node. Daily review surfaces the wyrds you sent and received.
- **Personal CRM**: a wyrd sent to a contact attaches to their record as a context item. Viewing the contact surfaces the wyrds that have touched the relationship.
- **Inbox sync**: a webhook fires on publish to a user-configured sink (Notion API, Roam API, custom endpoint), making each new wyrd discoverable in the user's primary tool.

### Why it's interesting

The product surface is intentionally narrow per `feedback_anti_scope_creep_relay_layer.md`. SendWyrd does not grow into a knowledge graph. Integrations let users **ride wyrds into** their existing tools — exits, not features. This is the right shape: SendWyrd authors the artifact; PKMs and CRMs index and contextualize it.

For the user (the operator), this also closes a loop with the sibling `~/lattice/personal_crm/` project — wyrds sent to contacts become attachments to their CRM record without either tool needing to know about the other beyond a URL.

### Strategic significance: this validates the message-object architecture choice

Beyond being a nice-to-have, integratability with networked-thinking tools is **one of the strongest arguments for the message-object form itself** — and a reason this primitive deserves to exist alongside (not instead of) chat apps.

A wyrd is a *persistent, reference-able artifact at a stable URL*. Chat messages are *ephemeral, sequence-bound, and trapped inside their host app*. The two are different shapes of communication, and only the first one composes with knowledge graphs:

- **Roam-style PKM treats backlinking as the primary epistemic operation.** A wyrd has a URL; it's a node by construction. A Slack message is text inside a thread inside a channel inside a workspace — to backlink it you screenshot or paste-quote, losing identity.
- **Power brokering is graph operations on people.** *"X is looking for someone who can help with Y; pass it on."* That's VISION use-case 2 (intro / ask routing) and use-case 3 (whisper-network dissemination). Both are graph traversals where the artifact (the wyrd) is the edge label and the URL is the persistent identity. You cannot do this on chat — chat lives inside an app, doesn't survive forwarding, doesn't cite cleanly into a PKM where the relationship-thinking actually happens.
- **Finding opportunities is graph search through trust networks.** A user maintains a Roam-graph of who they know, what those people care about, and what they're looking for. Wyrds become the *forwardable signals* that flow through that graph. Each forward is an edge; each wyrd is a node; the user's Roam is the substrate.

This is the substrate-vs-content distinction we've been articulating since the founding session: **MOP is object-first as practical implementation, relational-first as distribution substrate** (per VISION). The PKM-integration aspiration is the same point made concrete — the user's existing knowledge graph IS the relational substrate. Wyrds become first-class nodes inside it. The integration isn't a feature on top of the protocol; it's the natural consequence of having chosen the message-object form in the first place.

Conversely: if we ever drift toward chat semantics (threads, real-time, server-held conversation state), we lose this property. **Maintaining the message-object form isn't just minimalism — it's preserving the integration surface that makes the product strategically distinctive.** This locks the anti-scope-creep instinct (per `feedback_anti_scope_creep_relay_layer.md`) to a concrete strategic gain: the more SendWyrd stays narrow as a relay layer, the better it integrates with everything else.

### What it would architecturally require

All integrations layer **above** the existing wire spec — none require core protocol changes:

- **OG card enrichment** — public-form wyrds already serve OG metadata; PKM tools already crawl OG. Just needs the public-form URL to render with title, description, and ideally a `meta[name=sendwyrd]` extension microformat.
- **Webhook-on-publish** — opt-in client setting that fires the wyrd's metadata + URL to a user-configured endpoint. Pure client, no host involvement.
- **Browser extensions** — small extensions that inject wyrd previews into compatible PKM apps when a sendwyrd URL is detected in the page.
- **iCal / RSS feed** of the user's wyrd history — once HD recovery is built (Tier-1 #2), generating an RSS-of-my-wyrds is a small addition. PKM tools subscribe.
- **Schema.org / microformat metadata** — standardized embed so PKM crawlers understand the entity type. Lifts the integration cost on the third-party side.

### Why it's not v1

- v1 is a relay primitive. Validate that people use SendWyrd *at all* before optimizing for advanced integration.
- Integrations are 2nd-order — they require the underlying primitive to have value first.
- Each integration is its own product (extension, webhook client, RSS generator) and splits focus.

### Trigger for revisit

When SendWyrd has actual users sending real wyrds, AND we observe at least one user manually pasting wyrd URLs into a PKM tool — that's the signal integration would be picked up rather than ignored. Until then, defer.

A second possible trigger: the personal_crm project (or any sibling) reaches a point where it would benefit from wyrd ingestion. At that moment the integration shape becomes concrete and the work has a clear home.

---

## H2 — Paid tier: audio-first composition, encrypted attachments, expanded body

### Idea

A paid tier of the SendWyrd client (not the protocol) that lifts three v1 constraints which currently exist for protocol-discipline and free-tier-economics reasons:

- **Audio-first interface.** Compose a wyrd by speaking; play it back as audio on the receiving side. Transcript still rides the wire as text (or alongside it as an attachment). The same capability-URL semantics apply — the audio is a forwardable, ephemeral, end-to-end-encrypted artifact, just delivered through a different I/O modality.
- **Encrypted attachments.** Attach files (images, PDFs, audio clips) to a wyrd. The body still references them by URL, but the attachment payload is end-to-end encrypted under a key derived alongside `K_read` and stored on a separate blob endpoint. The host stays blind to attachment contents.
- **3000-codepoint body cap (vs 300 in v1).** A paid wyrd permits longer prose. The 300-codepoint cap is deliberate for the relay layer (it forces the form to be a *forwardable signal*, not a document); a 3000-cap unlocks long-form authored thoughts without losing the URL-as-capability primitive.

### Why it's interesting

- **Audio-first** is the natural ergonomic for the kind of intent-and-action communication SendWyrd already favors. Voice is fast for the sender and intimate for the recipient; turning a 30-second voice memo into a forwardable URL is a clean shape that no chat app replicates well.
- **Encrypted attachments** broadens the substrate from "300 codepoints of prose" to "any short authored artifact." The integrity properties stay intact (host-blind, capability-keyed, ephemeral by TTL), but the artifact can be richer.
- **3000-cap** acknowledges that some wyrds *are* the long-form thought, not just the pointer to one. Keeping the relay layer free at 300 preserves the protocol-discipline argument; offering the larger cap as a paid feature is the monetization shape that doesn't compromise the wire spec for non-paying users.

The strategic point: these are **client capabilities atop the existing protocol primitives**, not protocol amendments. The wire spec stays at v1 (or a minor bump for the longer cap as a per-wyrd field). The free-tier client enforces 300 + text-only. The paid-tier client unlocks the larger cap, audio compose/playback, and the attachment-bundle workflow.

### What it would architecturally require

- **Audio**: client-side recording + Opus encoding + AES-256-GCM encryption + upload to a blob endpoint (R2 already exists, currently unused). Receiving side downloads, decrypts, plays. Transcript can be in the body or in a sidecar attachment.
- **Attachments**: a `blobs` endpoint (CRUD-like, signed by the same `K_origin`), a body schema extension that lists attachment handles + per-attachment keys (or a deterministic key derivation from `K_read`), and renderer support for the attachment types.
- **3000-cap**: per-wyrd `body_cap_class: "v1" | "long"` field (or a tier marker on the publish_payload). Server stores the larger envelope in Postgres bytea like any other; no infra change.
- **Billing**: separate from the protocol. Subscriptions managed in a third-party billing system (Stripe), tied to a client-side license token that unlocks the paid features. The host doesn't gate publishing — billing enforcement is client-side honor + UI gating.

### Why it's not v1

- v1's whole point is the relay primitive. Adding modality, attachment, and length expansion before validating that the primitive has users is premature.
- Each of these triples implementation surface area: audio recording UX, attachment blob lifecycle, billing integration. Spreading focus before product-market fit is the failure mode.
- The 300-cap is a protocol-discipline argument as much as a free-tier argument — relaxing it requires deliberate spec work, not a config change.

### Trigger for revisit

When SendWyrd has paying-customer-shaped demand (people asking to pay for *something*), AND at least one of these three constraints is the specific friction. Probably audio comes first if it comes at all — voice is a natural extension of "intent and action" framing. Attachments and the 3000-cap are second-order, dependent on the audio-first shape working.

The other trigger: a sibling tool in `~/lattice/` (e.g. an audio-journaling project) needs to compose wyrds programmatically. At that point the audio path becomes a usable building block before it's a paid feature.
