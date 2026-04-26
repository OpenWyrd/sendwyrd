---
type: decision
adr_id: adr_021
adr_number: 21
title: "Single-form addressing (fragment-only); supersedes two-form addressing"
status: accepted
created: 2026-04-26
updated: 2026-04-26
last_edited_by: agent_operator
supersedes: adr_004
superseded_by:
tags: [adr, decision, mop, addressing, privacy, vision, anti-scope-creep]
---

# ADR-021: Single-Form Addressing (Fragment-Only)

## Status

Accepted.

## Context

ADR-004 specified two URL forms for the same underlying ciphertext:

- **Private fragment form** (default): `K_read` in the URL fragment; host is body-blind.
- **Public path form** (opt-in): `K_read` in the URL path; host can decrypt and serve OG / SSR previews so social platforms (Twitter, iMessage, Slack) can unfurl link cards.

The public form existed to support VISION Use Case 1 — *cross-post canonical URL on social media* — where a SendWyrd URL pasted into Twitter or iMessage would unfurl as a tweet-card with the wyrd body inline.

After v1 shipped and the surface stabilized, two convergent observations:

1. **The public form is itself a feed-surface concession.** Letting Twitter / Meta / Slack render the wyrd into their preview UI means the wyrd's content lands in algorithmic feeds and crawler caches. The recipient experiences the wyrd as a passive scroll-by impression, not as an act of visiting a URL. This is in tension with VISION P1 (*hyperlinks for conversation, never a feed surface*) and P5 (*contact, not conversation*).

2. **Compose-time UX overhead.** Every author had to choose Sealed vs. Open at compose time, weighing cross-post reach against host-blindness. For a relay primitive that's supposed to be one-button send, this is a forked path the author shouldn't have to navigate.

Removing the public form simplifies the protocol, eliminates a compose-time decision, refuses the algorithmic-preview surface, and reinforces VISION P1, P4 (*brittleness as feature*), and P5.

## Decision

### One canonical form

A wyrd is reachable via exactly one URL form:

```
https://sendwyrd.com/w/{handle}#{K_read_b64u}
```

`K_read` lives in the URL fragment. Browsers do not transmit fragments to the host. The host is body-blind on every request. The renderer decrypts client-side after page load. There is no second form.

### Compose-time

The composer no longer surfaces a Sealed/Open toggle. Every wyrd is sealed by default; there is no other option. Removing the toggle is itself the message — the absence of choice is the cypherpunk-correct posture.

### Indicator

The Sealed/Open privacy-posture indicator (ADR-019) becomes **monomorphic Sealed**. The closed-lock glyph persists on every wyrd view as an affirmative reassurance signal. The "Open" glyph and `--mark-open` color token are removed. ADR-019 is amended to reflect this.

### Legacy URL handling

URLs of the path-form `/w/{handle}/k/{K_read}` shared in the wild prior to this change continue to resolve via a transitional client-side redirect:

```
GET /w/{handle}/k/{K_read_b64u}
→ HTML shell that immediately runs:
   window.location.replace(`/w/${handle}#${K_read_b64u}`)
```

The host briefly observes K_read in the redirect request path. Since the legacy URL form ALWAYS exposed K_read on the path, this is no worse than the original contract. After redirect, K_read lives in the fragment and is never sent to the server again. Existing in-the-wild URLs continue to work.

The URL parser (`parseWyrdUrl`) retains recognition of the legacy path form so that wyrd bodies referencing old `/w/.../k/...` URLs in transitive embeds continue to resolve. Composers MUST NOT emit the path form.

### What goes away

- OG / SEO metadata generation tied to the public-form SSR view.
- The host-side decrypt code path.
- The compose-time form toggle.
- The Open glyph spec (ADR-019).
- The `--mark-open` color token.
- Public-form e2e smoke scripts (`e2e-public.ts`, `e2e-https-embed.ts`, `e2e-transitive.ts` — the last two relied on SSR rendering for assertions that no longer hold).

## Consequences

### Positive

- **Honors VISION P1 more strictly.** Refusing the algorithmic-preview surface keeps SendWyrd out of feed-rendering UIs entirely. Recipients have to actually visit the URL.
- **Simpler protocol.** One URL form, one render path, one mental model. ~150 LOC of host-side decrypt code retired; one fewer compose-time decision.
- **Compose UX is one-shot.** No privacy posture forked path. The composer is type → send.
- **Eliminates a class of accidental leaks.** A user who meant to share sealed but selected open had a permanent K_read leak on the host's logs. That foot-gun is gone.
- **Smaller spec / docs surface.** ADR-019 simplified. Spec §11 collapses to a 5-line legacy redirect note.

### Negative

- **VISION Use Case 1 changes character.** Cross-posting a sendwyrd URL on Twitter / iMessage / Slack no longer unfurls as a tweet-card preview — the recipient sees a bare URL. Whether they visit is now a choice they make, not a passive scroll-by impression. This is intentional but is a real shift in product feel for that use case. VISION must be updated to reflect this.
- **Slightly worse for off-channel virality.** A naked URL in a tweet has lower click-through than a unfurled card with body inline. SendWyrd accepts this cost. The bet is that recipients who actually visit are higher-signal than recipients who scroll-by.
- **In-the-wild legacy URLs require a redirect shim.** Maintained until the longest pre-change wyrd's TTL expires (max 1 year for non-permanent, indefinite for `ttl=0` permanent wyrds). The shim is small and side-effect-free; cost is bounded.
- **Loss of search-engine indexability.** Public-form URLs were search-indexable; fragment-form URLs are not. This was already weakly true — only public-form URLs leaked content to crawlers — so the change collapses the indexable-or-not distinction in favor of "never indexable." Aligns with VISION P4 (no durable archive).

### Neutral

- **The two-key model (K_read / K_origin) from ADR-004 is unchanged.** Reply decryption, burn signing, and HD-derived authorship all continue exactly as specified. Only the addressing-form portion of ADR-004 is superseded.
- **Federation-era multi-host trust is unchanged.** A federated host could re-introduce a public form for its own users; v1's canonical host commits to the single form.

## Alternatives considered

- **Keep the public form, hide the toggle, default-bias to sealed.** Rejected. Half-measure; the public form's existence still requires a render path on the host and a compose-time configuration knob hidden in advanced settings. The cost of the second code path persists.
- **Remove the public form, no legacy redirect.** Rejected. Existing URLs in iMessage threads and email archives would 404; user-hostile for a transitional change.
- **Add a third "preview-only" form** with a teaser hash but full body still client-decrypted. Rejected as over-engineering and as re-creating the algorithmic-feed surface in a smaller form.
- **Keep the public form but make it federation-only.** Rejected — pushes complexity into a feature we haven't built and don't need today.

## Open follow-ons

- **Audit body parser** for any other places that special-case the public form. Currently only the route layer has special-case logic; the parser is form-agnostic.
- **Backfill native-client (post-v1) spec** to reflect single-form addressing in iOS / Android renderer specs when those clients are designed.
- **Monitor user feedback** post-deploy for cases where the loss of OG previews is operationally painful. If real users hit this, revisit whether a federation-mode opt-in could re-introduce a host-readable form WITHOUT bringing it back to the canonical host.
