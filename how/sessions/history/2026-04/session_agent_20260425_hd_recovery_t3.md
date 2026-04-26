---
type: session
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_overnight
tags: [session, sendwyrd, build, recovery, hd, presence_check, t3]
session_id: session_agent_20260425_hd_recovery_t3
user: overnight_agent
started: 2026-04-25T22:00:00Z
completed: 2026-04-25
status: completed
prior_session: session_operator_20260425_mop_open_questions_resume_2
intent: "Tier-1 punch list item #2 — HD recovery sweep. Implement GET /api/v1/authors/{k_origin_pub_b64u}/handles per spec §15 + client-side mnemonic-import / sweep flow that derives K_origin keypairs along m/300'/n', proves possession via Schnorr-signed presence-check, and reconstructs wyrdHistory locally."
---

## Outcome

Tier-1 #2 closed. Presence-check endpoint live behind real Schnorr verification and replay-window guard; mnemonic-import sweep wired into Settings with progress UI; recovered wyrds merged into local history with a flag noting they lack body-decryption keys (K_read isn't seed-derivable).

`pnpm typecheck` and `pnpm --filter @sendwyrd/{api,web} build` both pass.

## Files touched

**Created**

- `packages/web/src/lib/recovery.ts` — sweep helper (`sweepFromMnemonic`) with batched concurrency, gap-limit termination, signed presence-check transport.

**Modified**

- `packages/api/src/routes/authors.ts` — replaced 501 stub with full handler: pubkey shape-check (SEC1 prefix + length), `X-Mop-Auth` parse, `±60s` replay-window check, Schnorr verification, DB lookup keyed on `k_origin_pub`, tombstone-retention filter, JSON response shape per spec §15.3. Empty result is 200 with empty array.
- `packages/web/src/lib/wyrdHistory.ts` — `k_read_b64u` becomes optional; new `recovered?: boolean` flag; new `mergeHistoryEntries(entries)` helper that dedupes by handle and sorts newest-first.
- `packages/web/src/lib/seedClient.ts` — new `installRecoveredSeed({seed, mnemonic, counter, storagePassphrase?})`. Open mode by default (zero-friction); protected mode if storage passphrase ≥ 8 chars provided.
- `packages/web/src/app/settings/page.tsx` — new "Recover from mnemonic" section between Backup-mnemonic and About. Inline form with mnemonic textarea, optional storage-passphrase, progress feedback ("Sweeping index N (gap K/20) — F found"), success summary with `View inbox →` link, error states for invalid mnemonic / network / signature mismatch.
- `packages/web/src/app/inbox/page.tsx` — surgical: when `entry.k_read_b64u` is absent (recovered entry) render handle as plain text instead of as a fragment-URL link, and append " · recovered (no read key)" to the metadata line. No structural changes; merges should be clean.

## Design decisions (CTO calls)

1. **Auth transport: header `X-Mop-Auth: <sig_b64u>:<unix_ms>`.** Spec §15.2 prescribes this exact form, identical to the replies-fetch endpoint pattern. No query-param footgun. Cleaner cache semantics (auth doesn't leak into URLs / referers).
2. **Empty result: 200 with `handles: []`.** Proof-of-possession passed; "you have zero" is a meaningful answer. Aligned with spec §15.3 (no 404 mentioned). 404 would also conflate "wrong key" with "no wyrds."
3. **Tombstone inclusion: include with `gone_at` / `gone_reason` populated within retention window; omit past 30-day retention.** Spec §15.3 explicitly says "Tombstoned and burned wyrds within the retention window are included." Implemented as a filter inside the route as defense-in-depth in case GC is lazy.
4. **UI placement: Settings inline, not a dedicated route.** Per task guidance — more discoverable, less marketing-page-feeling, sits naturally next to Backup-mnemonic which is the conceptual partner.
5. **Gap limit: 20 (BIP-44 convention, per spec §5.3).** Sweep terminates after 20 consecutive empty derivations.
6. **Concurrency: batches of 5.** Bounded by spec §16 rate limit (10 presence-check req/IP/min). Within a batch we may overshoot the true terminator by ≤ 4 calls — accepted (a few KB wasted bandwidth on an otherwise-rare flow).
7. **Recovered-entry render: handle-as-text with " · recovered (no read key)" tag.** K_read is per-wyrd random and not seed-derivable, so reconstructing share URLs is mathematically impossible from the mnemonic alone. The author can still burn / fetch replies (K_origin operations). The UI is honest about this.
8. **Counter restoration: `nextN = highestOccupied + 1`.** Spec §5.3 step 7. Avoids index reuse on the recovering device.
9. **Storage mode default: open.** Matches the documented zero-friction posture (memory `feedback_zero_friction_default.md`). Protected only if user supplies a storage passphrase ≥ 8 chars.

## Cross-agent overlap

- `packages/web/src/app/inbox/page.tsx` — touched per the task's explicit "if strictly necessary, surgical" allowance. Two changes: (a) guard `buildFragmentUrl` call with `entry.k_read_b64u` truthy check, branch to plain-`<span>` when absent; (b) one extra metadata token `" · recovered (no read key)"`. No structural / state / handler changes — the burn-UI agent's diff should merge cleanly.
- `packages/web/src/lib/wyrdHistory.ts` — `HistoryEntry` interface widened (k_read_b64u optional, new optional `recovered`). Strictly additive; existing callsites keep type-safety since they always supply k_read_b64u.

## Spec follow-up (for the spec-sync agent / a future session)

§15 is well-defined, but the implementation surfaced two minor gaps the spec-sync agent should reconcile:

1. **§15.3 response: status code on empty list isn't explicit.** Implemented as 200 + `handles: []` (justification above). Spec text leans this way ("returns the list of wyrd handles") but doesn't say so outright. Recommend an explicit sentence: "If no wyrds match, the response is `200 OK` with `handles: []` (empty array)."
2. **§15.2 auth header value separator.** Spec text shows `<base64url 64-byte Schnorr sig>:<unix-ms-timestamp>` — colon-delimited, matching `X-Mop-Auth` for `GET /:handle/replies`. Implemented as such. This is consistent across endpoints; recommend cross-referencing §14.2 explicitly so the format is canonical for any future Schnorr-auth'd endpoint.
3. **§15: no statement about `gone_at: null` semantics for live wyrds.** Implemented as `gone_at: null, gone_reason: null` for live entries. Recommend an explicit sentence in §15.3 noting these are null on live entries.

These are documentation / clarification edits — not behavior changes. None contradict spec.

## Other follow-ups

- **Body recovery is not a v1 capability.** A truly comprehensive recovery would also need each wyrd's K_read, which would require either (a) deriving K_read from seed+n (breaks the host-blind invariant for any wyrd that ever leaves the originating device), or (b) storing K_reads in an authenticated, encrypted server-side blob keyed by K_origin_pub (new endpoint + key-management complexity). Both are out of scope and arguably anti-VISION — "brittleness as feature" (ADR-006/VISION). The current behavior — recover handles + control, lose body decryption — matches the protocol's stated posture. Worth a brief note in the spec or a future ADR.
- **Inbox "recovered from mnemonic" empty state** is not currently distinguished from the no-history empty state. Low value to add now; revisit if first user feedback flags it.

## Verification

- `pnpm typecheck` — pass (4 of 4).
- `pnpm --filter @sendwyrd/api build` — pass (wrangler defers actual build to deploy time, no local errors).
- `pnpm --filter @sendwyrd/web build` — pass; static + dynamic routes generate cleanly; no new warnings.
- No deploy / no push performed (constraint).

## Blockers

None.

## Next Session Prompt

Tier-1 punch-list item #3 remaining: spec doc sync. `what/docs/spec/spec_mop_v1.md` lags shipped reality on (a) client-generated handles superseding §9.3, (b) `ttl=0` permanent semantics, (c) reply codepoint cap of 300. Additionally, this session surfaced three §15 clarifications (status code on empty list, X-Mop-Auth canonical separator cross-ref, gone_at null on live entries) and one architectural note about body-decryption-key non-recoverability. A fresh agent should read `STATE.md` Tier-1 row 3, the existing spec, and the "Spec follow-up" section of the most recent two sessions, then draft a spec patch (single PR) covering all drift points. No new ADRs needed — these are documentation-only.
