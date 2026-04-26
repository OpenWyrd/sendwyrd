---
type: session
created: 2026-04-26
updated: 2026-04-26
status: completed
last_edited_by: agent_michael
tags: [session, ship, ux, perf, attestation, unfurl, mnemonic, passphrase, ssr, streaming]
---

# Session — Post-ship UX polish, perf, attestation primitive, unfurl proxy

## Goal

Pick up after the morning's Tier-1 + Tier-2 ship + ops dashboard close. User opened with "where we at?", then immediately surfaced a P0 production breakage ("Application error" loading sendwyrd.com) and chained UX/perf/protocol asks rapidly. Stay in CTO-delegated mode: own technical and aesthetic calls, ship through CI auto-deploy, escalate only on scope/branding/trust-posture forks.

## What shipped (11 deploys, PRs #25–#35)

### P0 production hotfix
- **PR #25** — service-worker landing-page hydration trap. v1 SW served `/` stale-while-revalidate; cached HTML referenced chunk hashes that no longer existed after deploys, breaking React hydration on returning visitors. Switched `/` to network-first with cache fallback; bumped `SHELL_CACHE`/`RUNTIME_CACHE` v1→v2 so the activate handler evicts poisoned caches. Sentry showed 0 issues because the SentryInit bundle was in the same dead chunk graph.

### UX fixes (PR #26 bundle)
- **Passphrase persists until tab close.** `seedClient.ts` now caches both seed and passphrase in module memory. `consumeNextIndex` re-encrypts the counter without re-prompting. Dropped the visibility-hidden eviction + 30-min idle timer (cypherpunk-on-content, pragmatic-on-session). New `lockSeed()` for explicit "lock now" actions. Compose stops popping `window.prompt` on every send. Onboarding copy reflects the new lifetime.
- **BIP-39 boxed mnemonic input.** 12/24-box grid with per-word autocomplete from `BIP39_ENGLISH_WORDLIST` (re-exported from `@sendwyrd/core`). Per-box validity underline; multi-word paste distributes across boxes. Replaces the textarea in /settings recovery.
- **/about Nostr passage rewritten.** Two attestation patterns: body-carried signed Nostr event (in-band) OR trusted identity signing the share-act (out-of-band). SendWyrd composes with whatever attestation layer participants bring.
- **README content migrated to website (private repo permanent).** Repo stays private at launch — dead GitHub-repo links removed from /about Stack and /build. /build "wire spec" + "reference TS impl" entries point to `@deltaclimbs` on Twitter for access requests. New "How it works" section on /about.

### Visual polish
- **PR #27** — Wyrd sigil + wordmark lockup on `Nav` (24px) and onboarding (40px). Decorative `aria-hidden`; accessible name unchanged.
- **PR #32** — Mnemonic dropdown was transparent (used non-existent `--color-bg` token). Switched to `--color-ground` + a subtle drop shadow.

### New protocol primitive
- **PR #28 + #30** — Static authorship attestations. A wyrd whose entire body matches the strict three-line shape `sendwyrd-attestation/v1` / `target=…` / `sig=…` renders as a verification banner instead of plain text. Mechanism: re-derive the target's `K_origin_priv` from the seed at index `n`, sign `sha256("mop:v1:authorship_attestation" || target_handle)`, embed in body. Static — message binds only to `target_handle` (replay across attestation wyrds is intentional and harmless). Verifier accepts both 33-byte SEC1 and 32-byte X-only `K_origin_pub`; fails closed. Documented on /about as "Authorship attestations" outside the main flow. **PR #30 hotfix**: PR #28's regex source mangled in Next.js SWC compilation (multi-line `\\n` escapes); refactored to `body.split("\n")` + per-line regexes. **No inbox UI yet** — composing an attestation is a follow-up; the verification banner ships standalone.

### New site infrastructure
- **PR #29 + #31** — Unfurl proxy + LinkEmbed. New `/api/v1/unfurl?url=<encoded>` endpoint on the api worker (HEAD-then-GET, og:* + twitter:* + `<title>`/`<meta name=description>` regex extraction, 256 KiB cap, 5s timeout, 1h CF cache, no URL logging). Web `LinkEmbed` component fetches the proxy and renders image+title+desc+hostname cards. `WyrdBody` link-segments use LinkEmbed. `ImageEmbed` falls back to LinkEmbed on `<img>` onError so extension-classified URLs that refuse to serve as images (CDN hotlink-block, MIME mismatch) still surface usefully. Image content-type URLs (gstatic etc.) detected via HEAD content-type and returned as `{image: <self>}` so they render as image cards.

### Performance
- **PR #33 + #34** — Wyrd-view load latency. PR #33 SSR-fetched the envelope server-side, but blocked TTFB on the api → Postgres roundtrip (no net wall-clock win). PR #34 wrapped the resolver in `<Suspense>` so the shell streams immediately; the resolved component (with envelope embedded) streams once the api fetch returns. Browser loads JS chunks in parallel during the fetch — no client-side round trip. Warm-worker TTFB drops to ~100-150ms (was 480-740ms); cold-worker starts still ~600-1200ms.

### Compose / view ergonomics
- **PR #35** — Quote affordance + bare-domain URL detection.
  - **Quote**: small "quote" button on /w/[handle] next to "share" → navigates to `/compose?url=<current-url>`; existing Web Share Target prefill seeds the body. Recipient renders the quoted wyrd as an embed card via existing transitive resolution.
  - **Bare URLs**: `example.com`, `www.example.co.uk/path` etc. now detected without explicit `https://`. Lowercase-only constraint avoids `Mr.Smith` false positives; negative lookbehind on `@` rules out email local-hosts. `BodySegment` carries both `url` (as-typed) and `href` (always scheme-prefixed); renderers display what was typed but navigate/fetch via working URLs.

### Future horizons banked
- **H2** in `who/governance/future_horizons.md` — paid-tier client capabilities atop v1 protocol: audio-first compose, encrypted attachments, 3000-codepoint cap. Trigger: paying-customer-shaped demand for one of these specifically. Probably audio-first comes first if any of them does.

## Test counts at session close

- core: **158** tests (was 142 at session start; +9 attestation, +9 bare-domain, balanced by other adjustments)
- web: **105** tests (was 103; +2 passphrase-cache cases, balanced by mnemonic textarea→box test rewrites)
- All green locally and in CI.

## SITREP

### Completed
- 11 production deploys, all smoke-passing.
- 9 in-flight tasks from this session-cluster all closed (Task #1–#9 in TaskList).

### In progress
None — all tasks completed and merged.

### Next up (in priority order, from the rolling backlog)
1. **MCP server for SendWyrd** — exposes compose/share/burn/reply as native MCP tools. Highest agent leverage. ~½ day.
2. **Inbox "prove authorship" affordance** — surfaces the attestation primitive that shipped this session as a reachable UI action. Without it, attestations are constructible only by hand.
3. **Per-IP rate limiting in api worker via KV** — closes the operational gap from ADR-013. ~1 day.
4. **`@sendwyrd/core` npm publish** — needs user `npm login` against `@sendwyrd` org.
5. **Soft-launch** — pick 5-10 humans, send sendwyrd.com URLs, watch the ops dashboard.
6. **Edge-cache `/api/v1/wyrds/{handle}` ~10s TTL** — cuts repeat-read Postgres latency. Risk: burns within TTL serve stale 200.
7. **Neon HTTP-fetch mode** — cuts cold Postgres connection latency.
8. **Python SDK / OpenAPI / Söhne typography swap** — deferred.

### Blockers
None.

### Files touched (this session)

**Created**:
- `packages/core/src/attestation.ts` (sign + verify + body parser)
- `packages/core/test/attestation.test.ts` (7 tests)
- `packages/web/src/components/MnemonicInput.tsx` (boxed BIP-39 input)
- `packages/web/src/components/AttestationBanner.tsx` (verification banner)
- `packages/web/src/components/LinkEmbed.tsx` (OG card render)
- `packages/api/src/routes/unfurl.ts` (OG metadata proxy)
- `packages/web/src/app/w/[handle]/FragmentClient.tsx` (split off from page.tsx)
- `how/sessions/history/2026-04/session_michael_20260426_session2_ux_perf_attestation.md` (this file)

**Modified**:
- `packages/web/public/sw.js` (cache strategy v2)
- `packages/web/src/lib/seedClient.ts` (passphrase cache lifetime)
- `packages/web/src/app/compose/page.tsx` (drop window.prompt re-prompt)
- `packages/web/src/app/onboarding/page.tsx` (sigil + copy)
- `packages/web/src/app/settings/page.tsx` (mnemonic-input swap)
- `packages/web/src/app/about/page.tsx` (Nostr rewrite, How-it-works, Authorship-attestations, privacy note)
- `packages/web/src/app/build/page.tsx` (drop GitHub repo links)
- `packages/web/src/app/w/[handle]/page.tsx` (server component + Suspense)
- `packages/web/src/components/Nav.tsx` (sigil lockup)
- `packages/web/src/components/WyrdBody.tsx` (attestation switch + bare URLs + LinkEmbed)
- `packages/web/src/lib/resolveBody.ts` (key by href)
- `packages/api/src/index.ts` (unfurl route mount)
- `packages/api/src/routes/unfurl.ts` (image content-type detection)
- `packages/core/src/index.ts` (attestation export)
- `packages/core/src/sign.ts` (authorshipAttestationMessage)
- `packages/core/src/hd.ts` (BIP39_ENGLISH_WORDLIST export)
- `packages/core/src/body.ts` (bare-URL regex + href field + urlToHref helper)
- `packages/core/src/types.ts` (no change but referenced)
- `packages/core/test/body.test.ts` (+9 bare-domain tests)
- `packages/web/src/__tests__/integration/view-w-handle.integration.test.tsx` (FragmentClient direct render)
- `packages/web/src/__tests__/integration/settings.integration.test.tsx` (multi-textbox query for mnemonic boxes)
- `packages/web/src/__tests__/lib/seedClient.test.ts` (lockSeed, cached passphrase)
- `who/governance/future_horizons.md` (H2 paid-tier vision)

## Next Session Prompt

SendWyrd v1 is live and continues to ship. Read order:

1. `CLAUDE.md` (auto-loaded — Berthier identity).
2. `MANIFEST.md` — project identity.
3. `STATE.md` — note: STATE.md is stale (still references the original 2026-04-25 Tier-1 punch list, all of which is shipped). Do not act on its "Next Session Prompt" verbatim; the rolling backlog is in the memory pointer below and at the bottom of `who/governance/future_horizons.md`.
4. Memory pointers (auto-loaded via `MEMORY.md`):
   - `project_sendwyrd_v1_live.md` — current shipped state, infra pointers, follow-up priorities (updated this session).
   - `feedback_anti_scope_creep_relay_layer.md` — relay primitive, never a chat app.
   - `feedback_zero_friction_default.md` — account-less default; security opt-in.
   - `feedback_decision_delegation.md` — CTO/CEO call boundaries.
   - `feedback_pragmatic_privacy_posture.md` — pragmatic on recipient-side rendering.
   - `feedback_rapid_fire_questioning.md` — one question, named options, fast.
5. `who/governance/future_horizons.md` — H1 PKM/CRM, H2 paid-tier (audio + attachments + 3000 cap).
6. This session log: `how/sessions/history/2026-04/session_michael_20260426_session2_ux_perf_attestation.md`.

**Highest-leverage next moves**:
1. **MCP server for SendWyrd** — agent-native compose/share/burn/reply tools. ~½ day. Lets Claude Code talk to SendWyrd directly.
2. **Inbox "prove authorship" UI** — makes the attestation primitive reachable. Mid-day. Per-history-entry button → composes a new wyrd with the attestation body → publishes → shows share URL.
3. **Per-IP rate limiting in api worker (KV)** — operational hardening. ~1 day.
4. **Soft-launch** — bottleneck is no longer code; it's traffic. Pick 5-10 humans, send sendwyrd.com URLs, watch `/ops/{secret}`.

**Operational notes** (unchanged):
- Token stash: `~/.config/cloudflare/sendwyrd_api_token` (chmod 600).
- Sentry token: `~/.config/sentry/auth_token` (chmod 600).
- Wrangler authed; Neon CLI authed; CI auto-deploys on push to main.
- Repo stays private through launch and beyond. `/build` page directs builders to `@deltaclimbs` for spec/code requests.

User remains in **CTO-delegated mode**: own technical and aesthetic calls; only escalate scope/branding/trust-posture forks. Match the cypherpunk-Nostr-adjacent, Nietzschean, terse register.
