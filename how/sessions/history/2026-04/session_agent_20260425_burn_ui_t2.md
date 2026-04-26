---
type: session
created: 2026-04-25
updated: 2026-04-25
status: completed
last_edited_by: agent_overnight
session_id: session_agent_20260425_burn_ui_t2
tier: 1
tags: [session, sendwyrd, burn, ui, web, t2]
---

# Session — Burn affordance UI (Tier-1 #1)

## Intent

Land the UI for `DELETE /api/v1/wyrds/{handle}` (already wired in the API since
Phase G). Add author-only burn buttons in two places: single-wyrd fragment-form
view and per-row in inbox.

## Context loaded

- `STATE.md` — Tier-1 punch list row 1
- `what/docs/spec/spec_mop_v1.md` §12 (DELETE), §13 (Tombstone)
- `what/docs/spec/visual_direction_v1.md` §6, §10.4–10.7
- `packages/web/src/app/w/[handle]/page.tsx` (fragment view)
- `packages/web/src/app/w/[handle]/k/[k_read]/page.tsx` (public form, SSR)
- `packages/web/src/app/inbox/page.tsx`
- `packages/web/src/app/settings/page.tsx` (danger-zone styling reference)
- `packages/web/src/lib/api.ts`
- `packages/web/src/lib/wyrdHistory.ts`
- `packages/web/src/lib/seedClient.ts`
- `packages/core/src/sign.ts` (Schnorr + delete_message)
- `packages/core/src/hd.ts` (deriveOriginKey)
- `packages/api/src/routes/wyrds.ts` lines 179–242 (server DELETE handler)

## Decisions

1. **Public-form view (`/w/[handle]/k/[k_read]`) does NOT get a burn button.**
   That route is SSR with no client-side state and no access to `wyrdHistory`
   or the seed. The author should burn via either the fragment-form view (where
   they hold the read key) or via inbox. The public URL is for unauthenticated
   readers; surfacing a burn affordance there would invite UX confusion (the
   button would be invisible without history present anyway).

2. **Post-burn navigation on fragment view: re-render in tombstone state inline.**
   Chosen over redirect-to-inbox because it shows the user the actual outcome
   their reader would see (a 410 with `reason: "burned"`), and avoids surprise
   navigation. Lets the author confirm the burn took. Alternative considered:
   redirect to `/inbox`. Reason rejected: hides the result; user has to rebuild
   mental model. Easy to flip later if user prefers.

3. **Confirm flow: two-stage in-place button, no modal.**
   Modal focus-trap engineering would be disproportionate for a single
   irreversible action. Stage 1: muted "burn" link in a hairline-ruled row
   below replies. Stage 2: terse copy + danger-bordered "burn" button + cancel.
   Esc cancels via `keydown` listener (fragment view only). Inbox already
   gates everything behind passphrase unlock so no inline passphrase prompt
   needed there; fragment view supports an inline passphrase prompt because
   a non-author viewer who happens to have a matching local-history entry but
   locked seed needs a path forward.

4. **Inbox visual treatment: per-row text-link inline with `rename`.**
   "burn" appears as a third action button alongside `add name` / `rename`.
   Underlined, mono, microcaption, `--color-ink-subtle`. Less prominent than
   `rename` (which is `--color-ink-muted`) — still discoverable but doesn't
   shout. Confirm UI expands inline below the row (hairline-bordered box with
   copy + danger button + cancel). On success, row is mutated locally to a
   "burned" partition: opacity 0.7, strike-through nickname/handle, status
   pill changes to `burned`, reply UI hidden. No refetch.

5. **HistoryEntry tombstone fields.** Added optional `gone_at?: number` and
   `gone_reason?: "burned" | "expired"`. Helper `markHistoryEntryGone(handle,
   reason, gone_at)` is idempotent — re-marking does not overwrite an earlier
   `gone_at`. This is purely a UX hint; the host remains source of truth.

6. **Author detection requires both handle match AND K_origin_pub match.**
   The fragment view checks the local history entry's `k_origin_pub_b64u`
   against the live envelope-fetch's `data.k_origin_pub` before showing the
   burn affordance. Defense against the (unlikely) case of stale local
   history that disagrees with what the host stores — wouldn't sign-verify
   anyway, but keeps the affordance from rendering on a stale entry.

7. **API helper signature.** `burnWyrd({ handle, k_origin_priv })` — a thin
   wrapper that signs `delete_message` per spec §12.2 and posts. Returns
   tagged union: `burned | already_gone | not_found | signature_invalid |
   error`. `signature_invalid` matches the spec's 422 with body
   `{ error: "signature_invalid" }` (server returns 422, not 401, for sig
   failures — discovered while reading `wyrds.ts:229`).

8. **Burn does not erase the local history entry.** The entry is retained
   with tombstone metadata so the user can still see they burned that wyrd
   (when, what nickname). Inbox's `gone` filter surfaces them. Future work
   could add an explicit "remove from history" affordance, but for now the
   author's audit trail is preserved on-device.

## Files touched

Modified:
- `packages/web/src/lib/api.ts` — added `burnWyrd()` + `BurnResult` type
- `packages/web/src/lib/wyrdHistory.ts` — added `gone_at`, `gone_reason` fields
  to `HistoryEntry`; added `markHistoryEntryGone()` helper
- `packages/web/src/app/w/[handle]/page.tsx` — added `BurnAffordance`
  component; author-only render gated on `k_origin_pub` match; transitions
  to `gone` state on success
- `packages/web/src/app/inbox/page.tsx` — per-row burn trigger + inline
  confirm panel; updated filter + status pill + auto-load to honor local
  tombstone state

No new files. No new dependencies.

## Verification

- `pnpm install` — lockfile up to date, 0 new packages
- `pnpm typecheck` — 4/4 tasks successful (cached: 3, miss: 1 = web)
- `pnpm --filter @sendwyrd/web build` — successful, 8 routes compiled
- `pnpm --filter @sendwyrd/web lint` — interactive prompt (lint not configured
  in CI), skipped per task spec (typecheck + build is the verification floor)
- No production API calls made. No deploys.

## Constraints honored

- Did not modify `what/docs/spec/spec_mop_v1.md` (parallel agent owns it).
- Did not modify `packages/api/src/routes/authors.ts` (parallel agent owns it).
- Did not deploy, did not push, did not touch `~/.config/cloudflare/`.
- Did not call production API.
- No new top-level dependencies.

## SITREP

### Completed

- Burn API helper (`burnWyrd`) added to web client
- Tombstone state added to `HistoryEntry`; idempotent marker helper
- Fragment-form view (`/w/[handle]`) — author-only burn affordance with
  two-stage confirm + inline passphrase prompt for protected-mode locked
  seeds + post-burn tombstone re-render
- Inbox per-row burn affordance with inline confirm; locally retired rows
  on success (opacity, strike-through, status pill, hidden reply UI)
- Typecheck + web build green

### In progress

None.

### Next up

Tier-1 row 2: HD recovery sweep — replace 501 stub at
`packages/api/src/routes/authors.ts` with `GET
/api/v1/authors/{k_origin_pub_b64u}/handles` per spec §15, plus a `/recover`
route on web that takes a BIP-39 mnemonic and rebuilds `wyrdHistory` via
presence-check sweep across `m/300'/n'` for `n=0..gap+20`. Owned by the
parallel agent in another worktree per the task brief.

Tier-1 row 3: Spec doc sync — `spec_mop_v1.md` drift on §6/§9/§15
(client-generated handles), §9.2 (`ttl=0` permanent), §14.4 (reply caps).
Owned by parallel agent.

### Blockers

None.

### Files touched

Modified:
- `packages/web/src/lib/api.ts`
- `packages/web/src/lib/wyrdHistory.ts`
- `packages/web/src/app/w/[handle]/page.tsx`
- `packages/web/src/app/inbox/page.tsx`

Created:
- `how/sessions/active/session_agent_20260425_burn_ui_t2.md` (this file;
  will move to history/2026-04/ on close)

## Next Session Prompt

SendWyrd Tier-1 row 1 (burn UI) is shipped on the worktree branch
`worktree-agent-ac54b7b870d84bb2d` — typecheck + build pass, no deploys, no
push. The fragment-form view at `/w/[handle]` now renders an author-only
burn affordance (two-stage in-place confirm; matches `K_origin_pub` against
local history; transitions to inline tombstone state on success). The
`/inbox` page now has per-row burn with inline confirm; rows retire locally
on success. Public-form view (`/w/[handle]/k/[k_read]`) was deliberately
left without a burn button — see decision 1 in this session file.
Branch waits for the user to review (preview locally with `pnpm dev` and
test against staging or a local API), merge, and deploy. Tier-1 row 2 (HD
recovery sweep) and row 3 (spec doc sync) are owned by parallel agents in
other worktrees and may already be merged by review time.
