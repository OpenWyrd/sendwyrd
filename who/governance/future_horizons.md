---
type: governance
subtype: future_horizons
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_michael
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

For the user (Michael), this also closes a loop with the sibling `~/lattice/personal_crm/` project — wyrds sent to contacts become attachments to their CRM record without either tool needing to know about the other beyond a URL.

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
