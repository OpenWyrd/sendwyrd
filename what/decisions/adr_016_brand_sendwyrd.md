---
type: decision
adr_id: adr_016
adr_number: 16
title: "Brand is SendWyrd; canonical domain is sendwyrd.com; protocol codename remains MOP; unit noun is wyrd"
status: accepted
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, brand, naming, domain, sendwyrd]
---

# ADR-016: Brand Is SendWyrd; Canonical Domain Is sendwyrd.com; Protocol Codename Remains MOP; Unit Noun Is wyrd

## Status

Accepted (closes backlog item S2).

## Context

Backlog item S2 captured two open questions:
1. Real domain (the architecture pack used `mop.app` as a placeholder)
2. Real consumer brand name (`Hypermessage` was the working consumer name; `MOP` was the protocol codename)

User selected **SendWyrd** with `sendwyrd.com` available on `.com`. Etymology: *wyrd* is Old English for **fate / that which becomes** — the same root as modern *weird* — and is associated with the Norns / Wyrd Sisters who weave destiny. Surface read for any English speaker is "send word"; depth read for a literate audience is "send a thread of fate cast forward that takes its own course." That dual-read maps directly to the architecture: per ADR-006, a wyrd is one-shot, immutable post-publish, burns at TTL — you cannot retract it. Brand and protocol say the same thing.

`.com` availability for two-word names is materially scarce; treating it as locked-in and building around it is correct.

## Decision

### Brand and product name

- **Consumer brand and product name**: **SendWyrd**.
- **CamelCase rendering** is mandatory in copy: always `SendWyrd`, never `sendwyrd`, `Send Wyrd`, or `SENDWYRD`. CamelCase teaches the spelling and the pronunciation cue (two syllables, second-syllable emphasis on the *Wyrd* root).
- **Pronunciation**: "send-WURD" (rhymes with *send word*).

### Domain

- **Canonical domain**: **sendwyrd.com**. All consumer-facing URLs, brand assets, and the canonical web client live here.
- **Reserved for app shell**: **sendwyrd.app**. Either redirects to `.com` or eventually hosts the PWA / mobile app landing surface.
- **Defensive registrations** (typosquat / variant protection — `sendweird.com`, `.io`, `.so`, `.cc`, etc.) tracked as a separate operational task; not in scope for this ADR.

**Status (2026-04-25)**: `sendwyrd.com` and `sendwyrd.app` are **registered** by the project owner. Defensive registrations remain pending.

### Amendment (2026-04-25): repository and working-directory renamed

The original ADR retained the `MOP/` directory name "for operational continuity." On further reflection, the user chose consistency over continuity:

- **GitHub repository renamed**: `github.com/DeltaClimbs/MOP` → `github.com/openwyrd/sendwyrd`. GitHub serves automatic redirects from the old path; old clones can be updated with `git remote set-url origin https://github.com/openwyrd/sendwyrd.git`.
- **Working directory renamed**: `~/lattice/MOP/` → `~/lattice/sendwyrd/`.
- **Parent lattice files updated**: `~/lattice/.gitignore` and `~/lattice/bootstrap.sh` REPOS array updated.
- **Local agent memory directory** was copied across the path change to preserve user-profile, feedback, and project memory. Old path retained until next session start verifies the new path works.

**Protocol codename MOP is retained** in spec-facing language (this ADR, `spec_mop_v1.md`, the `MOP-Protocol-Version: 1` header). Only the operational identifier (repo, dir) was renamed.

### Protocol codename retained

- **MOP — Message Object Protocol** is the protocol-layer codename and remains unchanged in:
  - All ADR titles, frontmatter, and protocol-spec language
  - Internal/spec-facing documentation
- This is the same layering pattern as Signal Protocol vs. Signal app, ActivityPub vs. Mastodon, Matrix vs. Element. The protocol has a technical name; the product has a brand name. The two layers do not need to share a name and shouldn't.

### Unit noun

- **A wyrd** (lowercase) is the noun for one published unit. *"Did you get my wyrd?"* / *"His wyrd is at this URL."* / *"I'll send you a wyrd."*
- **Verb**: *"send a wyrd"*. Transitive verbing of the brand (*"wyrd me"*) is permitted in casual contexts but not encouraged in formal copy.
- **Plural**: *wyrds* (regular pluralization).
- This replaces the prior placeholder term *Hypermessage* in user-facing language. *Hypermessage* may persist in some historical docs but is no longer the canonical term for the unit.

### Aesthetic implications (delegated CTO call, recorded here for continuity)

The Old English / Anglo-Saxon / Norse etymology gives access to subtle thread/weave/rune motifs (the Norns weave fate; runes were carved warnings and dispatches). These are useful design hooks **only if used sparingly** — Linear-grade minimalism plus *one* signature flourish (e.g., a hairline rune-mark in the wordmark, a thread-weave glyph for the "sealed" indicator). Heavy fantasy-LARP styling is rejected; the aesthetic register is austere modern with a quiet etymological wink.

## Consequences

### Positive

- **Surface readability is high**: a first-time hearer parses "send word" instantly. Zero friction at the action layer.
- **Depth resonance is on-brand**: the etymological layer aligns with VISION P4 (brittleness as feature) — *wyrd* is *that which is fated and cannot be retracted*, which is what an immutable, TTL-burning, one-shot wyrd literally is.
- **The "weird" association flips to feature** in this user's voice register: cypherpunk-Nostr-adjacent, anti-feed, anti-corporate. Owning *weird* is on-brand for an anti-algorithm protocol.
- **Action-oriented brand**. *SendWyrd* is an imperative; the brand teaches the call to action at the namespace level. Compare noun-oriented alternatives like *Mote* or *Slip* that require the user to learn the verb form separately.
- **Available `.com` is a material asset**. Two-word `.com`s with available domains are scarce.
- **Clean layering**: protocol-codename (MOP) is decoupled from brand (SendWyrd), so future brand pivots, sub-brands, or third-party clients can refer to the protocol cleanly.

### Negative

- **Spelling friction**. *Send weird* is an audible homophone for *Send Wyrd* in many accents; users hearing the brand verbally will not necessarily know to spell W-Y-R-D. Mitigations: consistent CamelCase branding teaches the spelling visually; defensive `sendweird.com` redirect (separate task); search engine autocomplete eventually catches up; deliberate marketing of the spelling. Spotify, Lyft, Tumblr all carried this cost successfully.
- **Cultural reach skew**. Wyrd resonates strongly with English-speakers familiar with Macbeth, Norse mythology, fantasy literature, or general etymological literacy. Less resonant in non-English markets, where only the surface "send something foreign-sounding" reads. Accepted v1 cost; non-English markets are not a v1 priority.
- **Some audiences will read "weird" as juvenile or fringe**. Counter-read: the user's voice register actively wants *weird-as-opposition-to-corporate*. This is not a bug in the user's positioning. Accepted.

### Neutral

- The renderer brand mark, wordmark, and visual identity system are deferred to Phase D (visual/UX direction research and proposal). This ADR fixes the name and domain; it does not fix the visual treatment.
- Future federation or ecosystem branding (e.g., third-party clients post-v1, federation peer brands) is out of scope for this ADR.

## Alternatives considered

- **Mote** — small particle, soft/friendly, my pre-question recommendation. Rejected by user in favor of action-oriented brand. *Mote* required the user to learn the noun and verb separately; *SendWyrd* teaches the verb at the brand level.
- **Slip** — passed-note register. Rejected as too soft for the user's Nietzschean register.
- **Salvo** — Spartan-coded, percussive. Rejected as too martial / too aggressive for a consumer brand.
- **Sigil** — capability-token register. Rejected as too obscure for "user-friendly."
- **Hypermessage** (continuing as the consumer name) — rejected as descriptive-not-evocative; reads like a category, not a brand.
- **MOP as both protocol and brand** — rejected by layering principle (technical and consumer names should be decoupled; "MOP" reads as a cleaner-product or a custodian, undermining the consumer brand surface).

## Open follow-ons

- **Defensive domain registrations** — `sendweird.com`, `sendwyrd.io`, `sendwyrd.so`, etc. Tracked separately as an operational task.
- **Wordmark, logo, brand mark, and visual identity** — Phase D work, delegated CTO call.
- **Tagline / headline copy** — Phase F work; must respect ADR-015 (no use-case lead in marketing surface).
- **Sweep of placeholder references** — `Hypermessage` and `mop.app` references in MANIFEST.md, VISION.md, backlog, and any user-facing docs are updated as part of banking this ADR. Historical ADRs (003–015) retain their original wording for historical fidelity; their references are understood as predating this ADR.
