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
