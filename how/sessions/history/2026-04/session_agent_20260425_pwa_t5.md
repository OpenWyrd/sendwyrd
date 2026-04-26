---
type: session
session_id: session_agent_20260425_pwa_t5
created: 2026-04-25
updated: 2026-04-25
status: completed
last_edited_by: agent_claude
tier: 1
intent: PWA hardening pass — manifest, service worker, install prompt, persistent storage
tags: [session, pwa, web, frontend]
---

# Session — PWA hardening (Tier-5)

## Goal

Turn the existing Next.js web client into an installable Progressive Web App. Add-to-home-screen on iOS, install prompt on Chromium. No native app, no new platforms, no push notifications (ADR-010).

## Files Touched

### Created

- `packages/web/src/app/manifest.ts` — Web App Manifest (Next 15 idiomatic). `display: standalone`, dark theme tokens, share_target for incoming text/url, categories `["utilities", "productivity"]` (NOT social — relay primitive).
- `packages/web/public/sw.js` — service worker. App-shell precache + runtime caching with strict no-cache policy on sensitive routes.
- `packages/web/public/icons/icon-source.svg`, `icon-maskable-source.svg` — vector sources for the wyrd sigil at icon scale.
- `packages/web/public/icons/icon-{192,512}.png` — standard PWA icons (purpose=any).
- `packages/web/public/icons/icon-maskable-{192,512}.png` — maskable variants with 22% safe-zone padding.
- `packages/web/public/icons/apple-touch-icon.png` — 180x180 for iOS home screen.
- `packages/web/scripts/generate-icons.mjs` — one-off Node script that drives ImageMagick to produce the PNG renders. No runtime dep added; re-run only when sigil geometry changes.
- `packages/web/src/components/ServiceWorkerRegister.tsx` — client-only mount in root layout; registers `/sw.js` on `load`.
- `packages/web/src/lib/installPrompt.ts` — captures `beforeinstallprompt`, exposes `triggerInstall()` + `useInstallState()`, handles `appinstalled` to suppress further prompts. Detects iOS by UA + maxTouchPoints.
- `packages/web/src/lib/persistentStorage.ts` — wraps `navigator.storage.persist()` / `persisted()` / `estimate()`. Idempotent + never throws.

### Modified

- `packages/web/src/app/layout.tsx` — added Viewport export with viewport-fit=cover and dual theme-color metas; appleWebApp metadata; apple-touch-icon link; legacy `apple-mobile-web-app-capable` via `other`; mounts ServiceWorkerRegister.
- `packages/web/src/app/settings/page.tsx` — three new sections: Install (shows Chromium install button OR iOS step-by-step OR fallback advice depending on capability + install state), Storage (persistence-state advisory + bytes-used readout). Mnemonic backup copy strengthened to mention storage-eviction risk.
- `packages/web/src/app/compose/page.tsx` — reads Web Share Target query params (`?text=&url=&title=`) on mount and prefills the composer (codepoint-aware truncation). Calls `requestPersistence()` after a successful publish.
- `packages/web/src/app/onboarding/page.tsx` — calls `requestPersistence()` on Set passphrase. Mnemonic-step copy strengthened to name local-storage clearance as the failure mode.

### Session tracking

- `how/sessions/active/session_agent_20260425_pwa_t5.md` (this file; will move to `history/2026-04/` on close).

## Decisions

### Manifest (Next 15 `app/manifest.ts`)

- **theme_color = background_color = #0a0a0a (dark).** Pinned to dark theme per visual_direction_v1.md §2.3 (canonical). Browser-tab `theme-color` meta has light/dark variants; the manifest gets one value (dark wins because it is the default theme).
- **categories = `["utilities", "productivity"]`.** Refused `social` — wrong frame; SendWyrd is a relay primitive, not a chat app. Aligns with feedback_anti_scope_creep_relay_layer.
- **share_target = `{ action: "/compose", method: "GET", params: { title, text, url } }`.** Incoming-only — receives shared content, never enumerates contacts. The compose page reads `window.location.search` on mount and prefills.
- **icons** — five PNGs: 192/512 standard (any), 192/512 maskable (22% safe-zone padding), 180x180 apple-touch-icon. Vector sources retained in `public/icons/` for re-render.

### Service worker (manual, no new deps)

- **`SHELL_CACHE = "sendwyrd-shell-v1"`** + **`RUNTIME_CACHE = "sendwyrd-runtime-v1"`** — versioned names so a future bump invalidates everything.
- **Precache list:** `/`, `/manifest.webmanifest`, the six icon assets. Hashed JS chunks join via stale-while-revalidate on first navigation (we can't enumerate them at SW write time).
- **`/api/*`: network-first, fall back to runtime cache only on offline failure.** Conservative — envelopes can rotate, tombstones come and go.
- **Sensitive routes (`/inbox`, `/settings`, `/compose`, `/onboarding`, `/recover`, `/w/*`): NEVER cached.** These render local state or decrypted plaintext; persisting them to disk would defeat the brittleness-as-feature posture.
- **Static assets (`/_next/static/`, `/icons/`, `/manifest.webmanifest`): stale-while-revalidate** in the runtime cache.
- **Update behavior: silent skip-waiting on install, claim clients on activate.** No "update available" modal — the cypherpunk register prefers silent honesty over modal dialogs. Next navigation gets the fresh shell.
- **Non-GETs pass through completely.** `if (req.method !== "GET") return;` early in the fetch handler.
- **Cross-origin requests pass through.** No interference with third-party fetches.
- **NO push notification handlers, no `notificationclick` handler.** ADR-010 forbids the protocol primitive; we do not bring it back at the SW layer either.

### Install prompt placement

- **Single section in `/settings` ("Install").** Three states:
  - Chromium with stashed `beforeinstallprompt` → "Install SendWyrd" button calling `triggerInstall()`.
  - iOS detected → terse instructions + collapsible 3-step guide.
  - Already installed (display-mode standalone or `appinstalled` flag set) → "Installed." line, no affordance.
  - Fallback for other browsers → one-line nudge to use the browser menu.
- **No banner on `/inbox`.** Refused — would push the app toward "social-app you check daily" framing (feedback_anti_scope_creep_relay_layer).

### Persistent storage

- **Called from compose (after first successful publish) and onboarding (after Set passphrase).** Idempotent. Never blocks. Result is stashed for the settings advisory.
- **Settings UI: tri-state advisory.** Granted → quiet line. Denied (after asking) → honest warning naming mnemonic as recovery path. Not yet asked → terse "asks on first save".
- **Storage estimate readout: single line in microcaption.** `using 12.3 KB of 1.2 GB (0.00%)` style. No chart.

### Storage-honesty copy (final wording shipped)

Onboarding mnemonic step:
> Write this down somewhere offline. SendWyrd stores the seed locally — if local storage clears or this device fails and you didn't back up the mnemonic, your sealed wyrds are gone. That's how SendWyrd works.

Settings → Backup mnemonic (intro):
> Your 12-word recovery phrase. Write it down somewhere offline. SendWyrd stores your seed locally — back up your mnemonic. If local storage clears or this device fails, your sealed wyrds vanish; the mnemonic is the only path back to your authorship.

Settings → Storage (denied):
> Browser hasn't granted persistent storage. Your seed may be evicted under storage pressure or after long inactivity. Back up your mnemonic.

### iOS meta tags

- `apple-touch-icon` (180x180 PNG)
- `apple-mobile-web-app-capable` = yes (legacy form via `other`, kept for older iOS Safari)
- `mobile-web-app-capable` = yes (modern form, emitted by Next via `appleWebApp.capable`)
- `apple-mobile-web-app-status-bar-style` = black-translucent
- `apple-mobile-web-app-title` = SendWyrd
- `viewport-fit` = cover (via Next's Viewport export)
- Dual `theme-color` with `(prefers-color-scheme: light)` (#f8f4ed) and `(prefers-color-scheme: dark)` (#0a0a0a) variants.

### What got cut for scope discipline

- **No "update available" UI.** Silent skip-waiting; SW updates take effect on next navigation. Adding a modal felt over-engineered for app-shell-only updates.
- **No background sync, no periodic sync.** Out of scope; would also flirt with "checks-for-you" framing.
- **No share-on-publish (Web Share API outbound).** Existing copy URL flow is sufficient; outbound share triggers a contact-leakage path we don't want.
- **No PWA-specific landing-page banner.** Landing stays as-is per visual_direction §10.1 (one column, breathes, ends).
- **No icon-source SVG check-in cleanup.** Kept in `public/icons/` so they ship with the site; they're tiny and keep the icon pipeline transparent.

## Verification

- `pnpm typecheck` → 4/4 green (Turbo cache hit on core/api, fresh run on web).
- `pnpm --filter @sendwyrd/web build` → green. `/manifest.webmanifest` route present in build manifest. Static prerender of all PWA-relevant routes.
- Inspected `.next/server/app/index.html`: confirmed presence of `<link rel="manifest">`, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `apple-touch-icon`, `viewport-fit=cover`, dual `theme-color`. ServiceWorkerRegister appears in the React tree.
- Inspected `.next/server/app/manifest.webmanifest.body`: full JSON — share_target present, icons array correct, dark theme/background pinned, categories honest.
- No localhost dev server spun up. Build artifacts are sufficient verification.

## Bootstrap-side follow-up

**None.** No new top-level dependency added. Icon generation uses ImageMagick (already on the dev machine) via a one-off Node script that's not part of the runtime. The script lives at `packages/web/scripts/generate-icons.mjs` and is documented for re-runs.

If a fresh Fedora bootstrap doesn't include `imagemagick`, the icons are committed alongside the source, so a fresh checkout doesn't need to regenerate them. Adding `imagemagick` to `~/lattice/bootstrap.sh` would be a nice-to-have for icon-pipeline maintenance only — not required for build/deploy.

## SITREP

### Completed

- Web App Manifest at `/manifest.webmanifest` with all required fields (start_url, display, theme/bg colors, icons including maskable, share_target, honest categories).
- Service worker with versioned cache, app-shell precache, network-first /api, no-cache for sensitive routes, no push handlers.
- SW registered from root layout via client component.
- Install affordance in /settings: Chromium prompt, iOS step-by-step, suppressed when installed.
- `navigator.storage.persist()` requested on first explicit save (compose send + onboarding passphrase).
- Storage state + quota estimate readout in /settings.
- All six iOS meta tags + viewport-fit=cover + dual theme-color.
- Onboarding + settings copy honest about storage eviction; mnemonic named as recovery path.
- Build + typecheck green.

### In progress

None.

### Next up

1. **Tier-1 punch list (still pending from STATE.md):** burn UI, HD recovery sweep, spec doc sync.
2. **Tier-2:** Sentry, OG cards, CI auto-deploy, test suite.
3. **Optional PWA polish (Tier-3-ish):** install banner on landing page if user is a returning visitor (would need careful UX to avoid the "check daily" frame); maskable-icon visual lint at multiple OS mask shapes.

### Blockers

None.

### Files touched

See section above.

## Next Session Prompt

PWA hardening pass landed on branch `t5-pwa-hardening`. The web client is now an installable PWA: manifest, service worker, install affordances, persistent-storage requests, iOS meta tags, share-target prefill into compose, and storage-honest copy in onboarding/settings. Build + typecheck green. Push status documented in commit. Next priority is the Tier-1 punch list from STATE.md (burn UI on `/w/[handle]` and `/inbox`, HD recovery sweep at `/recover` + the `GET /api/v1/authors/{k_origin_pub}/handles` endpoint, and bringing `what/docs/spec/spec_mop_v1.md` into sync with shipped reality on §6/§9/§14.4/§15). No production deploy was performed in this session — branch is pushed for durability only.
