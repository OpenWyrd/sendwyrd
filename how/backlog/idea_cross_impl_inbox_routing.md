---
idea_id: idea_cross_impl_inbox_routing
title: "Cross-implementation MOP inbox/outbox routing"
category: technical
status: proposed
priority: low
effort: mission
proposed_by: agent_berthier
proposed_date: 2026-04-28
updated: 2026-04-28
plan_id:
---

# Cross-implementation MOP inbox/outbox routing

## Problem / Opportunity

The inbox (`packages/web/src/lib/wyrdInbox.ts`) and outbox (via `wyrdHistory`) are **per-origin localStorage**. When Alice on SendWyrd opens a wyrd link from Bob's hypothetical second-impl relay (`bobimp.example/w/...`), the entry lands in bobimp's localStorage at bobimp's origin — *not* in Alice's SendWyrd inbox at sendwyrd.com. Same in reverse.

So MOP wire interop (envelope, AAD, URL form) is portable between impls, but the *inbox UX* fragments per relay domain. As soon as a second MOP impl exists, users have N inboxes — one per relay they ever interact with.

This is hypothetical until a second MOP impl ships. Deferred 2026-04-28; bank the research so we don't have to redo it.

## Proposed Solution

The web platform's same-origin model **does not allow** Origin A's PWA to claim Origin B's HTTPS URLs. So "phone auto-routes any HTTPS MOP URL into your installed MOP PWA" is not achievable. The HTTPS link must remain primary (zero-friction first-tap for non-installers, anti-scope-creep relay-primitive posture).

Layered routing for users with a MOP PWA installed is achievable via a coordinated 4-part change:

1. **MOP spec extension**
   - Define `web+wyrd:` URL form alongside `https:` (custom scheme registrable via `protocol_handlers`)
   - Mandate CORS-permissive `GET /w/{handle}` ciphertext endpoint on every MOP relay so any client can pull from any relay
   - Mandate the "Open in your MOP app" affordance in every web renderer

2. **PWA manifest** (`packages/web/src/app/manifest.ts`)
   - Add `protocol_handlers: [{ protocol: "web+wyrd", url: "/import?u=%s" }]`

3. **Web Share Target extension**
   - Existing `share_target` routes to `/compose`. Add a second route `/import` that ingests a foreign-origin wyrd URL: cross-origin GET ciphertext → decrypt with URL fragment read key → record in local inbox

4. **Renderer UI**
   - Every MOP relay's `/w/{handle}` page renders an "Open in your MOP app" button
   - Button prefers `web+wyrd:` deep link (Android path); falls back to `navigator.share()` (iOS path)

Net result: HTTPS link stays universal. Users with a MOP PWA installed get cross-impl unified inbox via custom scheme on Android, share-sheet on iOS.

## Known Challenges

| Challenge | Detail |
|---|---|
| **iOS gap** | iOS Safari does NOT support `protocol_handlers` manifest field or `registerProtocolHandler()` for PWAs (as of 2026-04). iOS users would only get the share-sheet path (two taps), not custom-scheme deep link. Android Chrome/Firefox support both. |
| **Custom-scheme link mangling** | SMS/email/messaging clients sometimes mangle or strip non-`https:` URLs. The `web+wyrd:` form must NEVER be the primary URL Bob sends — only a button on the rendered page. |
| **No PWA-installed detection** | No web platform API to detect from another origin "does this user have a MOP PWA installed." The "Open in MOP app" button just fires the scheme; OS handles "no handler" gracefully on Android, less so on iOS. |
| **Trust model** | Once SendWyrd accepts a foreign-origin wyrd URL via `/import`, it's fetching ciphertext from a relay it didn't choose. Crypto stays safe (read key in fragment, AAD-bound) but spec must define whether any MOP relay is acceptable to fetch from or whether some allowlist applies. |
| **Discovery** | Users with no MOP PWA installed get current behavior (HTTPS link opens at relay's web view). No graceful upgrade prompt without the relay's renderer cooperating. |
| **Coordination cost** | This requires every MOP impl to ship the spec'd UI affordance. Not just a SendWyrd-side change. Doesn't pay off until the ecosystem has 2+ impls. |

## Why Deferred

- Hypothetical until a second MOP impl exists (`wyrd-go` / impl-2 is post-Phase-4 per `project_openwyrd_outstanding`)
- Coordination cost is high; benefit is zero with N=1 impl
- Can be revisited when impl-2 lands or when a third party signals intent to build a MOP relay

## Discussion

- 2026-04-28 (agent_berthier): Initial research session triggered by user question "how does interop actually work cross-impl." Found web platform constraint: HTTPS URLs are origin-bound by design (anti-phishing). Identified custom-scheme + Share Target + spec-mandated UI as the achievable recipe. User chose to defer pending second impl.

## Decision

Pending — re-evaluate when a second MOP implementation is in flight or shipped.

## Re-entry Checklist

When this comes off the shelf:

1. Verify iOS Safari `protocol_handlers` / `registerProtocolHandler` support has changed (this is the binding constraint)
2. Confirm `wyrd-go` (or whatever impl-2 ends up being) is shipping or shipped
3. Draft an OpenWyrd MOP NIP defining `web+wyrd:` scheme, CORS requirement, and renderer UI affordance
4. Coordinate with impl-2 maintainer on spec wording before any SendWyrd-side code change
5. SendWyrd-side changes are isolated to: `packages/web/src/app/manifest.ts` (protocol_handlers), new `/import` route, "Open in your MOP app" button on `/w/[handle]/FragmentClient.tsx`
