---
type: decision
adr_id: adr_015
adr_number: 15
title: "v1 is unopinionated about which use case leads"
status: accepted
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_michael
supersedes:
superseded_by:
tags: [adr, decision, mop, scope, use-case, primitive, v1]
---

# ADR-015: v1 Is Unopinionated About Which Use Case Leads

## Status

Accepted (v1 scope decision; closes backlog item S1).

## Context

VISION.md identifies four candidate use cases for MOP:

1. Cross-post canonical URL on social media
2. Intro / ask routing
3. Whisper-network dissemination
4. Tweet-replacement / canonical authored thoughts

Backlog item S1 framed launch scope as: *"which use case does v1 lead with?"* — under the assumption that marketing, composer defaults, demo content, and growth angle would all need to be biased toward one chosen use case.

User closed S1 by declaring the question malformed: **"the use case should not impact what you do; it's inherently unopinionated."** This ADR documents that closure as a binding scope constraint.

## Decision

### v1 is a primitive, not a vertical product

1. **The four use cases are equal.** Architecture, composer, renderer, defaults, copy, aesthetic, and growth narrative MUST NOT be biased toward one of the four over the others. Where a fork pits "use case X would prefer A vs. use case Y would prefer B," the resolution is to find the use-case-neutral answer or escalate, never to pick.

2. **No "modes," no "templates," no use-case onboarding flows.** The composer is one composer. The renderer is one renderer. There is no "intro mode" or "cross-post mode." Users discover the use cases by using the primitive.

3. **Marketing surface presents the primitive itself.** Landing page, demo content, narrative, taglines describe what a Hypermessage *is* (a one-shot, encrypted, capability-gated message at a URL), not what it's *for*. The use cases are illustrative examples, not headline pitches.

4. **Future verticals are not precluded.** A post-v1 client could specialize for a vertical (a dating-app reply layer, a research-circle whisper network, etc.) atop the same protocol. This ADR constrains v1 product surface only; it does not constrain what others build on top later.

## Consequences

### Positive

- **Locks decision-making against use-case creep.** Future Berthier-side reasoning cannot drift toward optimizing for one use case at another's expense.
- **Product surface stays minimal.** No mode picker, no template gallery, no first-run wizard. One primitive, one composer.
- **Coheres with VISION P5 (contact, not conversation; interaction-minimalism).** Layering opinions on top of the primitive contradicts the same instinct that produced the 300-codepoint cap and the no-notification-primitive stance.
- **Forces the architecture to be honest about being a primitive.** If a feature only makes sense for one of the four use cases, it doesn't ship in v1.

### Negative

- **Marketing is harder.** "What is this for?" without a clean answer is a real growth risk. The landing page must explain a primitive, which is intrinsically harder than explaining a vertical product.
- **A first-time visitor may bounce.** Without a use-case-led pitch, the value is abstract until a user composes their first Hypermessage. The renderer demo (a real-feeling Hypermessage rendering live) carries proportionally more weight as a result.
- **Some launch metrics will look weak** by SaaS-vertical-product standards. Activation funnels designed for "user signs up to do X" do not apply when the product has no specific X.

### Neutral

- **Berthier-side heuristic.** When I encounter design forks where one resolution helps use case X and another helps use case Y, I do NOT pick a winner — I find the use-case-neutral answer or escalate to the user as a CEO call. This is a working rule, not just an architectural commitment.
- **The four use cases remain documented in VISION.md** as illustrative examples. They are not deprecated; they are just no longer in priority order.

## Alternatives considered

- **Pick a leading use case for v1.** My pre-question recommendation was whisper-network (uniquely architecture-aligned among the four). Rejected by user: tilts design toward one shape over another, betraying the primitive-ness.
- **Hedge: lead with two of the four.** Rejected by extension of the user's reasoning — two opinions is still opinionated.
- **Defer the question until launch readiness.** Rejected — without explicit closure, design decisions during build will quietly drift toward one use case. Banking the agnostic stance now prevents that drift.

## Open follow-ons

- **Landing-page narrative.** Designing copy that explains a primitive without a use-case lead. Aesthetic-direction work (delegated CTO call per `feedback_decision_delegation`).
- **Demo content.** A sample Hypermessage that reads naturally for any of the four use cases — the demo cannot itself betray a use-case bias.
- **Launch metrics.** What success looks like for a primitive-not-product launch. Tracked separately from this ADR.
