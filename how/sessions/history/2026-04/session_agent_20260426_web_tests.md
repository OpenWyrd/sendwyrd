---
type: session
created: 2026-04-26
updated: 2026-04-26
status: completed
last_edited_by: agent_e_web_tests
session_id: session_agent_20260426_web_tests
tier: 1
tags: [session, sendwyrd, web, vitest, jsdom, tests, integration]
---

# Session — Web component test suite (vitest + jsdom)

## Intent

Stand up the first real test environment for `packages/web`. Add vitest +
jsdom + Testing Library, then write component, lib, and integration tests
with mocked APIs. Goal: a real safety net for the renderer + flows.

## Context loaded

- `packages/web/package.json` — bare scripts before this session.
- `packages/web/src/components/{PrivacyIndicator,Nav,WyrdBody,ReplyForm}.tsx`
- `packages/web/src/lib/{wyrdHistory,seedClient,installPrompt,persistentStorage,api,resolveBody,recovery}.ts`
- `packages/web/src/app/{compose,inbox,settings}/page.tsx` and `app/w/[handle]/page.tsx`
- `packages/core/src/{compose,body,types,seedStore}.ts` — for fixture generation + parser semantics
- Burn-UI session log (`session_agent_20260425_burn_ui_t2.md`) — for affordance behaviour

## Decisions

1. **`@vitejs/plugin-react`, jsdom, Testing Library — NOT browser-mode.**
   The task spec explicitly forbids `@vitest/browser`. jsdom keeps the suite
   fast (full run < 3s). Real WebCrypto is available in Node 22's globalThis,
   so the seedStore round-trip can be tested end-to-end without crypto mocks.

2. **Test layout: `src/__tests__/{components,lib,integration}/`.**
   Picked the colocated `__tests__` directory over `test/` so vitest picks
   them up via the standard `**/*.test.{ts,tsx}` glob with no extra config
   surface. Three subdirectories make navigation obvious.

3. **Hand-rolled mocks, not MSW.**
   The total surface is ~5 endpoints and most tests don't touch fetch at
   all (lib tests, component tests). MSW would be more setup than value.
   - `vi.mock("@/lib/api")` for `publishWyrd` / `fetchWyrd` / `burnWyrd`
   - `vi.stubGlobal("fetch", ...)` for the recovery sweep + replies endpoint
   - `vi.mock("next/navigation")` everywhere — STABLE singletons for the
     router (see Bugs surfaced #1)
   - `vi.mock("@/lib/persistentStorage")` to drive the tri-state copy in
     settings (the real `navigator.storage` shim is exercised in its own
     unit tests)

4. **Real crypto in fixtures, not mocks.**
   `view-w-handle.integration.test.tsx` calls real `composeWyrd()` to
   produce a valid envelope, then drives `fetchWyrd` to return that
   envelope. The decrypt path is therefore end-to-end real. This caught
   one fixture bug (AAD binding requires the EXACT `expires_at_ms` and
   `publish_timestamp_ms` returned by compose — see iteration log).

## Test stack added

`packages/web/package.json` devDeps:
- `vitest@^2.1.8` (resolves 2.1.9), `jsdom@^25.0.1`
- `@vitejs/plugin-react@^4.3.4`
- `@testing-library/react@^16.1.0`
- `@testing-library/jest-dom@^6.6.3`
- `@testing-library/user-event@^14.5.2`

`packages/web/package.json` scripts:
```
"test": "vitest run",
"test:watch": "vitest"
```

`turbo.json` — already had `test` registered with `dependsOn: ["^build"]`,
no change needed.

`packages/web/vitest.config.ts` — created. jsdom env, `@/` alias to `src/`,
React plugin, single setup file.

`packages/web/src/__tests__/setup.ts` — created. Wires jest-dom matchers,
runs `cleanup()` + `localStorage.clear()` after each test, shims `matchMedia`
and `IntersectionObserver` for jsdom.

## Test inventory (103 passing, 0 skipped, 0 xfailed)

| File | Count | Notes |
|---|---|---|
| `components/PrivacyIndicator.test.tsx` | 7 | SVG, aria, color token, sizing |
| `components/Nav.test.tsx` | 4 | wordmark, links, active-route highlight |
| `components/WyrdBody.test.tsx` | 13 | text, link, image/video/audio embeds, sendwyrd:// (ready/gone/missing/error/loading), 100-codepoint truncation |
| `lib/wyrdHistory.test.ts` | 14 | add/list/clear/merge dedup, mark-gone idempotence, recovered without `k_read_b64u` |
| `lib/seedClient.test.ts` | 16 | open + protected round-trip, wrong-passphrase rejection, atomic counter, wipe-all |
| `lib/installPrompt.test.ts` | 9 | iOS detection (3 UAs), `beforeinstallprompt` capture, suppression after `appinstalled`, useInstallState shape + re-render |
| `lib/persistentStorage.test.ts` | 13 | request/get state tri-state, estimate parsing, formatBytes |
| `integration/compose.integration.test.tsx` | 8 | auto-seed, counter, send/share-URL flow, error surface, Web Share Target prefill |
| `integration/inbox.integration.test.tsx` | 6 | empty state, redirect-to-onboarding, live/burned styling, recovered metadata-only line, filter pills |
| `integration/settings.integration.test.tsx` | 6 | invalid mnemonic, valid mnemonic + sweep, persistent-storage tri-state copy |
| `integration/view-w-handle.integration.test.tsx` | 7 | real compose+decrypt, gone tombstone, network error, BurnAffordance show/hide on K_origin match, full burn flow, missing-key fragment |

## Verification

- `pnpm install` — clean.
- `pnpm --filter @sendwyrd/web test` — 103/103 pass, ~3s total.
- `pnpm typecheck` — clean (all 3 packages).
- `pnpm --filter @sendwyrd/web build` — clean (next build, all 9 routes).

## Bugs surfaced (none committed separately yet)

None. The two iteration loops were test-side issues, not source bugs:

1. **Mocked `useRouter` returning a fresh object on every render → infinite
   re-render.** Inbox's mount effect lists `router` in its deps. With
   `vi.mock("next/navigation", () => ({ useRouter: () => ({ ... }) }))` the
   factory is fine but the FUNCTION inside returns a new object reference
   on each call. Effect re-runs → setState → re-render → new useRouter()
   reference → effect re-runs → … → OOM. Fix: stable singleton router.
   This is purely a test-concern — in production, Next's real `useRouter()`
   returns a referentially-stable router across renders. **No source bug.**

2. **AAD binding requires `expires_at_ms` exactly.** The view-page
   integration tests initially used `Date.now() + ttl_ms` for expires_at
   while compose internally uses `publish_timestamp_ms + ttl_seconds * 1000`.
   Fix: read `result.expires_at_ms` and `result.publish_timestamp_ms` from
   compose's return value. Documented inline. **No source bug — this is
   the AAD binding doing exactly what it should.**

## Files Touched

Created:
- `packages/web/vitest.config.ts`
- `packages/web/src/__tests__/setup.ts`
- `packages/web/src/__tests__/components/PrivacyIndicator.test.tsx`
- `packages/web/src/__tests__/components/Nav.test.tsx`
- `packages/web/src/__tests__/components/WyrdBody.test.tsx`
- `packages/web/src/__tests__/lib/wyrdHistory.test.ts`
- `packages/web/src/__tests__/lib/seedClient.test.ts`
- `packages/web/src/__tests__/lib/installPrompt.test.ts`
- `packages/web/src/__tests__/lib/persistentStorage.test.ts`
- `packages/web/src/__tests__/integration/compose.integration.test.tsx`
- `packages/web/src/__tests__/integration/inbox.integration.test.tsx`
- `packages/web/src/__tests__/integration/settings.integration.test.tsx`
- `packages/web/src/__tests__/integration/view-w-handle.integration.test.tsx`
- `how/sessions/active/session_agent_20260426_web_tests.md` (this file)

Modified:
- `packages/web/package.json` — added test scripts + 8 devDeps
- `pnpm-lock.yaml` — auto-updated by `pnpm install`

Untouched (per task constraints):
- `packages/core/**`
- `packages/api/**`
- `.github/**`
- `what/docs/spec/**`

## SITREP

- **Completed**: vitest + jsdom + Testing Library wired; 103 tests across
  components / lib / integration; typecheck + build still green; full suite
  runs in ~3s.
- **In progress**: none.
- **Next up**:
  - Wire CI to run `pnpm --filter @sendwyrd/web test` on PRs (CI agent owns this).
  - Bring core test coverage up (D agent in flight).
  - Consider raising the "snapshot rendering" question — none included here
    on purpose; plain assertion-based tests are more durable to UI churn.
- **Blockers**: none.
- **Flakes seen**: none. Settings recovery sweep test takes ~600ms (PBKDF2
  + multiple fake presence-checks); allotted 12s timeout to be safe.

## Next Session Prompt

The web test suite landed on branch `e-web-tests` — vitest + jsdom + Testing
Library. 103 tests across `packages/web/src/__tests__/{components,lib,integration}`.
All pass. To extend: add new component tests by mirroring
`PrivacyIndicator.test.tsx`; add new lib tests by mirroring
`wyrdHistory.test.ts`; add new integration flows by mirroring
`compose.integration.test.tsx` and using stable-singleton mocks for
`next/navigation` and `vi.mock("@/lib/api")` for fetch surfaces. The setup
file (`src/__tests__/setup.ts`) auto-clears localStorage and DOM between
tests; if you add new module-level singletons (like `seedClient`'s
`cached` variable), reset them in a `beforeEach` for that file.
Mocking strategy is hand-rolled; no MSW. Real WebCrypto runs in jsdom for
seedStore + compose round-trips. Run with `pnpm --filter @sendwyrd/web test`.
