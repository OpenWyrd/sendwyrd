---
type: decision
adr_id: adr_010
adr_number: 10
title: "Notifications: zero protocol primitive; entirely a client/app concern"
status: accepted
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
supersedes:
superseded_by:
tags: [adr, decision, mop, notifications, layering, host-blindness]
---

# ADR-010: Notifications Are Not a Protocol Concern

## Status

Accepted (v1 architecture decision).

## Context

ADR-008 banked replies as encrypted blobs at a per-object endpoint. ADR-009 banked inbox aggregation as a client-side construct over HD-derived per-object keys. Neither answered: how does the author *know* a new reply has arrived?

The architecture pack (§3.4, §11) had floated three patterns: pull-only, web push subscriptions per object, and email opt-in. Each has different costs for host-blindness and anonymity:

- **Web push** requires the protocol to expose a per-object subscription registration, which threads through Apple/Google push relays. The relays observe metadata bindings even when blob payloads are encrypted.
- **Email opt-in** plants a durable external identifier on the host per object. Anonymity-by-default (ADR-003) directly dented.
- **Pull-only** preserves host-blindness completely but has poor UX for use cases that need timely response (intro/ask routing).

The intro/ask use case (VISION case 2) makes timely response part of the wedge; "two weeks late" evaporates the introduction. So real users will want notifications. The question is not *whether* notifications happen but *where in the stack they live*.

## Decision

### The MOP protocol exposes no notification primitive

The MOP host has no push-subscription endpoint, no email field on objects, no webhook registration, no `/notify` of any kind. It serves blobs over signed reads. It never initiates contact with anyone.

Concretely:

- The published-object schema has no `notify_email`, `notify_webhook`, or push-token field.
- There is no server-side subscription table.
- The reply endpoint (`/m/{id}/replies`) is exclusively read-on-poll, not push-on-event.
- The host learns nothing about whether the author is online, on what device, or via what app.

### Notifications are a client/app concern, layered above the protocol

Any notification UX is implemented entirely in the client or app that sits on top of MOP, downstream of the protocol surface. Concretely:

- **Reference web app**: pull-only by default. The inbox view (per ADR-009) refreshes when the user opens it. The web app may surface a "last checked / N new since" indicator, but no background notifications.
- **Mobile app (planned)**: may implement OS-level push (APNs / FCM) via the app's own backend infrastructure. The app's backend holds the user's master inbox URL (per the user's choice) and polls the MOP host on the user's behalf, then forwards to the platform push relay. **From MOP's perspective, this is just another polling client.** The app's backend is a third party that the user trusts; it is not part of the protocol.
- **Third-party clients** can implement notifications however they like. Some may be polling-only, some may relay through their own backends, some may bridge to Nostr.

### Host-blindness is preserved at the protocol layer

Even if a particular client (e.g., the planned mobile app's backend) chooses to operate a relay-style notification service, the MOP host itself never knows. It sees only signed reads against per-object reply endpoints, identical to any other client. The host does not gain a notification-subscription table, a push-token registry, or any persistent author-side identity.

This is the right layer to push the privacy/UX trade onto: the *user* picks which client to use, and that client's privacy posture is the user's choice. MOP itself does not foreclose any UX, but it also does not author any UX surface that requires the host to know about subscriptions.

## Consequences

### Positive

- **Protocol stays minimal.** No subscription endpoints, no notification schemas, no relay accounts. Smaller attack surface, smaller spec.
- **Host-blindness preserved.** No push-token registry, no email field — the host never accumulates the kind of metadata that would build an authorship identity over time.
- **Layering is honest.** Notification UX is a product/client concern, not a protocol concern. Different clients (web, mobile, third-party) can pick different trade-offs without forcing the protocol to support all of them.
- **No protocol-level dependency on Apple/Google push infrastructure.** A future restriction or pricing change at APNs/FCM affects clients, not the protocol or its host.
- **Coheres with ADR-003 (no accounts) and VISION P5 (contact not conversation).** The protocol does not even have a place to store an email or push token, so the privacy/anonymity envelope is structurally tighter, not just policy-tighter.

### Negative

- **Reference web app has poor UX for intro/ask without active polling.** Users on web-only will miss replies until they remember to open the inbox view. The wedge for the intro/ask use case (VISION case 2) effectively requires the mobile app to be available before that use case is fully viable.
- **iOS background polling is constrained.** Real-time-ish notifications on iOS effectively require a server-side relay that pushes to APNs, which means the mobile app's backend holds the master inbox URL. This is *workable* but is an app-side responsibility — the user's privacy posture toward the app vendor matters.
- **Third-party clients can implement notification UX in privacy-leaky ways.** A client could ship a feature where the user's email is bound to objects via the client's own backend. From MOP's perspective this is invisible, but from the user's perspective it leaks. Mitigation is community norms and renderer/client guidance, not protocol.

### Neutral

- The MOP host *could* later add a public-form-only opt-in webhook for the rendered HTML response (since public-form objects are already host-readable), but this is out of scope for v1 and would not affect the encrypted reply path.
- The web push API technically allows protocol-anonymous subscriptions, but the platform-relay (APNs/FCM/etc.) still sees the relationship between subscriber and topic. Considered, but the layering decision above subsumes this — it's not the protocol's problem.

## Alternatives considered

- **Web push subscription endpoint at the protocol layer.** Author's browser registers a service worker with the host; host pushes on new reply event. **Rejected** — adds protocol surface, threads through Apple/Google relay infrastructure that observes metadata bindings, hard to support cross-platform especially on native iOS without an app, and reproduces the kind of subscription state we are deliberately keeping off the host.
- **Email opt-in on the published object.** Author optionally provides an email at compose time, host pings on new reply. **Rejected** — email is a durable external identifier persistently bound on the host per object. Even if optional, it normalizes the pattern of binding human identity to objects in protocol metadata, which is exactly what ADR-003 refused.
- **Default pull + per-object opt-in toggle at the protocol layer for push or email.** Hybrid that keeps the default clean. **Rejected** — opt-in still requires the protocol to define the schemas, the endpoints, and the relay logic. The whole point of the layering decision is that those concerns can live *above* the protocol where the user can pick a client matching their preferred trade. Punting opt-in to the client layer is strictly cleaner.

## Open follow-ons

- Mobile app architecture, including how the app's backend holds the master inbox URL, what privacy posture it commits to, and whether end-users can self-host an instance. Out of scope for v1 protocol; tracked as a separate product question.
- Whether the reference web app should ship a "browser tab open + service-worker" client-side polling mode that fires local-notification on tab focus (no relay, but limited to active sessions). UX detail; renderer-side.
- Guidance / norms for third-party clients that build notification features — e.g., a recommended privacy-disclosure block. Community concern, not protocol.
