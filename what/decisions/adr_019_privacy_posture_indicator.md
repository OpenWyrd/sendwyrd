---
type: decision
adr_id: adr_019
adr_number: 19
title: "Renderer displays a symmetric privacy-posture indicator on every wyrd view"
status: accepted
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_michael
supersedes:
superseded_by:
tags: [adr, decision, mop, renderer, privacy, ux, transparency]
---

# ADR-019: Renderer Displays a Symmetric Privacy-Posture Indicator on Every Wyrd View

## Status

Accepted (closes backlog item B9).

## Context

Per ADR-004, MOP supports two URL addressing forms for the same underlying wyrd:

- **Private fragment form** (default): `K_read` lives in the URL fragment (`#…`), which browsers do not transmit to the host. The host serves opaque ciphertext and is body-blind. The renderer decrypts client-side after page load.
- **Public path form** (opt-in): `K_read` lives in the URL path. The host can decrypt and render server-side, enabling SEO previews, OG metadata, and search-engine indexing — at the cost of host-readability of the body.

A recipient receiving a wyrd link does not, by inspection, know which form they hold. Sophisticated users can read fragment-vs-path; most cannot. Backlog item B9 captured the open question: should the renderer display a visible indicator of privacy posture?

The user's `feedback_pragmatic_privacy_posture` heuristic and prior precedent (UX over recipient-side maximalism in ADR-011) support a yes — but the *shape* of the indicator (warn-only-on-public vs. symmetric-on-both) was open.

## Decision

### Symmetric indicator on every wyrd view

The canonical renderer (per ADR-014) displays a small, persistent privacy-posture indicator on every rendered wyrd page. The indicator is **symmetric**: both addressing forms show their indicator, not just the public form.

### Two states

- **Sealed** (private fragment form): *"Sealed — readable only to you and anyone you forward this URL to."* Lock-glyph or thread-knot visual mark. Quiet visual treatment (subdued color, hairline border).
- **Open** (public path form): *"Open — host-readable, web-indexable."* Open-eye glyph or untied-thread visual mark. Same visual register as Sealed (matching scale, position, weight) — the contrast is informational, not alarmist.

### Position and visual treatment

- Position: **top of rendered content area, below the wordmark, above the body.** Glanceable without dominating.
- Treatment: small text, hairline iconography, neutral palette. Not red-banner-warning, not green-checkmark-reassurance. Informational, like a metadata caption.
- Hover/tap reveals a one-sentence explanation of what the form means and why.
- Persistent on the page; does not auto-dismiss.

### Why symmetric

- **Affirmative reassurance**, not just warning. The Sealed indicator tells private-form holders that the protocol is doing what it should — most users have no way to verify this otherwise. Banking the security visibly is part of the brand-trust posture.
- **Pedagogy through contrast**. A user encountering both Sealed and Open wyrds over time builds intuition for the difference by repeated exposure. Asymmetric (warn-only-on-public) misses that learning loop and makes Open feel like an error state instead of a deliberate choice.
- **Authorial honesty**. The author chose the form when they composed; surfacing that choice to the recipient honors authorial intent rather than hiding it.

### What the indicator does NOT show

- No identity claim. The indicator says *what form this is*, not *who composed it*. Per VISION P3, identity is not the protocol's concern.
- No host-trust badge. The indicator does not assert "this host is trustworthy"; it asserts "this URL form has these privacy properties." Federation-era multi-host trust is a separate concern.
- No content classification. The indicator is privacy-form-only, not content-warning, not nsfw-flag, not anything else.

## Consequences

### Positive

- **Recipient comprehension is improved structurally**, not just by documentation. Users learn the two forms by encountering them.
- **Brand trust signal**. The Sealed indicator is a visible affordance that this protocol takes encryption seriously — a real differentiator in a market where E2E claims are often unverifiable.
- **Honors VISION P5 (contact, not conversation)**. The indicator does not invite engagement; it informs and steps back.
- **Cheap to implement**. Two strings, two icons, conditional render based on URL form.

### Negative

- **Visual clutter risk**. Adds a UI element to every wyrd page. Mitigation: aggressive minimalism in visual treatment; small enough not to compete with the body text.
- **The "Open" indicator may make some authors avoid the public form** even when public-form is the right choice (for SEO, viral cross-post). Mitigation: composer copy should make the tradeoff clear at compose time — "Public wyrds are host-readable but indexable for cross-post reach." The Open indicator at view time then reflects an informed authorial choice, not a foot-gun.
- **Translates poorly to non-canonical clients** (post-v1 third-party renderers, if/when permitted). Mitigation: per ADR-014, v1 is canonical-only across web/iOS/Android, so all v1 surfaces show the indicator. Post-v1 client spec should make the indicator a SHOULD or MUST.

### Neutral

- The exact glyph, copy, and microinteraction design is Phase D (visual/UX direction) work. This ADR fixes the *behavior*, not the visual.
- Hover/tap explanation copy is Phase F (content) work.

## Alternatives considered

- **Warn-only-on-public** — rejected. Treats public-form as an error state and misses the affirmative reassurance value of the Sealed indicator. Pedagogy is weaker without the contrast.
- **No indicator** — rejected. Real recipient comprehension cost; users who do not understand the form they hold cannot make informed sharing decisions.
- **Indicator only on first view** (auto-dismissing banner) — rejected. The privacy posture is a property of the URL, not a one-time notice; persistent visibility is correct.
- **Identity badge bundled with privacy indicator** — rejected. Conflates two orthogonal concerns; identity is out of scope for the protocol per VISION P3.
- **Red-banner warning on public form** — rejected. Alarmist tone misframes a deliberate authorial choice as a security incident.

## Open follow-ons

- **Glyph and visual treatment design** — Phase D.
- **Hover/tap explanation copy** — Phase F.
- **Composer-side affordance** — at compose time, the form-toggle should reflect the same vocabulary (Sealed / Open) and surface the same tradeoff explanation. Tracked as Phase F design work, not part of this ADR.
- **Post-v1 third-party renderer spec** — if/when published, indicator behavior must be SHOULD or MUST.
