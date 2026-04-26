---
type: session
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_spec_sync
status: completed
tags: [session, spec, t1]
session_id: session_agent_20260425_spec_sync_t1
user: agent_spec_sync
started: 2026-04-25T00:00:00Z
completed: 2026-04-25
intent: "T1 — sync spec_mop_v1.md to shipped reality on three drift points: client-generated handle, ttl_seconds=0 as permanent sentinel, reply caps 300/2500."
---

## Goal

Bring `what/docs/spec/spec_mop_v1.md` into alignment with deployed sendwyrd.com behavior on three named drift points. Shipped code is canonical; spec follows.

## Files Touched

- `what/docs/spec/spec_mop_v1.md` — modified (frontmatter bumped to `agent_spec_sync` / `1.0.1-draft`; nine substantive edits; appended `## 21. Changelog`).
- `how/sessions/active/session_agent_20260425_spec_sync_t1.md` — created (this file; will be moved to `history/2026-04/` at close).

Read-only references (verification only, no edits):
- `packages/core/src/sign.ts` — confirmed `publish_message` byte layout.
- `packages/core/src/compose.ts` — confirmed client-side handle generation, ttl=0 → `PERMANENT_EXPIRES_AT_MS`.
- `packages/api/src/routes/wyrds.ts` — confirmed server validates `body.handle`, accepts `ttl_seconds = 0`, returns 409 `handle_collision_retry` on PK collision.
- `packages/core/src/types.ts` — confirmed constants: `REPLY_CODEPOINT_CAP=300`, `REPLY_BLOB_BYTE_CEILING=2500`, `TTL_SECONDS_MIN=0`, `PERMANENT_EXPIRES_AT_MS=253_370_764_800_000`, `HANDLE_BYTES=12`.

## Decisions

1. **`publish_message` byte order matches shipped code exactly:**
   ```
   SHA-256("mop:v1:publish" || handle(12) || envelope || ttl_seconds_be(8) || replies_enabled(1) || publish_timestamp_ms_be(8))
   ```
   Handle is the second concatenated field, immediately after the magic string, before envelope. Verified against `packages/core/src/sign.ts:40-47`.

2. **Collision response is `409 Conflict` with `error: "handle_collision_retry"`** — verified against `wyrds.ts:113`. Spec §9.5 and §17 updated to include this row.

3. **`ttl_seconds = 0` accepted as permanent-storage sentinel** — spec §9.2 narrative rewritten to describe the sentinel semantics with the year-9999 unix-ms value (`253_370_764_800_000`). ADR-006 discouragement language preserved (composer SHOULD warn the user; default remains 90 days). §17 `ttl_out_of_range` row corrected to range `[0, 31_536_000]`.

4. **Reply caps reduced to 300 / 2500** — §14.4 narrative rewritten. Replaced the prior "≥3× wyrd body, replies need more room" framing with the anti-scope-creep rationale: replies are forensic, not conversational; matching wyrd-body terseness keeps the protocol from drifting toward chat. Prior asymmetry (1000/5000) deliberately removed.

5. **Cross-ref fixes (incidental):** §9.5 originally pointed to "§15 for error codes" and "§14 for rate-limit" — the actual section numbers are §17 (error inventory) and §16 (rate limits). Fixed during the same edit since I was rewriting that block; documented in the changelog entry.

6. **Did not touch line 190's `expires_at` table description** — already says "or `0` for permanent — discouraged"; consistent with the rewritten §9.2.

7. **Did not touch §15 (presence-check)** — re-read; no server-issued-handle language present.

8. **Bumped `spec_version` to `1.0.1-draft`** — three-point sync is more than a typo fix; warrants a patch bump within the v1 draft series.

9. **Appended `## 21. Changelog`** — none existed; created two-entry list (1.0.0 → 1.0.1) per the user's instruction to add a "single short entry."

## Edits applied (line-range trace, post-edit numbering)

| Section | Pre-edit lines | Change |
|---|---|---|
| Frontmatter | 5, 8 | `last_edited_by: agent_spec_sync`; `spec_version: "1.0.1-draft"` |
| §2 Glossary "handle" | 50 | Server-issued → client-generated; uniqueness validated server-side |
| §6 Wyrd structure table | 186 | Source: client-generated; server validates uniqueness, 409 on collision |
| §9.2 request body | added `handle` field; field list now leads with `handle` |
| §9.2 ttl_seconds field | 307 | Range `[0, 31_536_000]`; `0` is permanent-storage sentinel; ADR-006 still discourages |
| §9.2 publish_message | 312–324 | `handle(12)` added as 2nd field; "handle is NOT signed" sentence inverted to "handle IS signed because client-generated" |
| §9.3 server behavior | 326–334 | Step list reordered: validate handle format, validate ttl range, reconstruct & verify (with handle), insert with PK uniqueness, 409 on collision |
| §9.5 failure responses | 350–356 | Added 409 row; corrected §17 / §16 cross-refs; tightened 422 list to include ttl_out_of_range |
| §14.4 reply size limits | 681 | 300 codepoint cap + 2500 byte ceiling; anti-scope-creep rationale replaces "≥3× body" framing |
| §17 error inventory | 783–790 | Added 409 `handle_collision_retry` row; ttl_out_of_range range corrected to `[0, 31_536_000]` with sentinel note |
| §21 Changelog | appended at EOF | New section; two entries (1.0.0, 1.0.1) |

## SITREP

### Completed
- All three named drift points reconciled to shipped code.
- Two-pass internal-consistency scan; no contradictions introduced.
- Frontmatter updated; spec_version bumped; Changelog section created.

### In progress
None.

### Next up
- User review of the diff before any spec re-publication.
- Consider whether `published_at` semantics warrants a follow-up edit (see Code-side anomalies / Spec-side observations below).
- T2 / future tasks not in this session's scope.

### Blockers
None. Nothing tagged `#needs-human`.

### Code-side anomalies / Spec-side observations (informational; no action taken)

These were noticed during the verification read of shipped code. None block T1; flagging for the user.

1. **`published_at` semantics drift (4th, unnamed point).** Spec §6 line 189 (table) says `published_at` is "Server; assigned at publish." Shipped server (`wyrds.ts:121`) returns `published_at: body.publish_timestamp_ms` — i.e., the client-asserted timestamp, not server_now. The DB row is also persisted with `new Date(body.publish_timestamp_ms)`. The replay-window guard (±60s) makes this approximately equal to server_now in honest cases, but a malicious-but-in-window client can shift `published_at` by up to ±60s. The spec narrative "Server; assigned at publish" should arguably read "client-asserted within ±60s replay window." I did NOT edit this — outside the three named drift points the user enumerated. Recommend a small follow-up edit, or reaffirmation that this is fine.

2. **§17 error inventory has no row for `body_too_large` separation between wyrd envelope and reply blob.** Both currently fold into 413 `payload_too_large`. Cosmetic; not a drift point.

3. **No code-level bug discovered.** Shipped publish_message layout is internally consistent across `compose.ts` (client) and `wyrds.ts` (server). Schnorr verification will succeed for honest clients.

## Next Session Prompt

Spec doc `what/docs/spec/spec_mop_v1.md` was synced to shipped reality on 2026-04-25 by `agent_spec_sync` in worktree branch `worktree-agent-a2d751ba3a903788f`. Three drift points were reconciled: (a) handle is client-generated and is the second concatenated field in `publish_message` (handle(12) immediately after the magic string `"mop:v1:publish"`); (b) `ttl_seconds = 0` is accepted as the permanent-storage sentinel (server stores `expires_at = 253_370_764_800_000`, year 9999); (c) reply caps reduced to `REPLY_CODEPOINT_CAP = 300` and `REPLY_BLOB_BYTE_CEILING = 2500` to match wyrd-body terseness (anti-scope-creep). Spec_version bumped to `1.0.1-draft`; `## 21. Changelog` section appended. One unaddressed observation: `published_at` is actually the client-asserted timestamp clamped to the ±60s replay window, not `server_now` — spec §6 table line 189 still says "Server; assigned at publish" which is a minor 4th drift point the user did not enumerate. If the user authorizes, that line should be tightened to "client-asserted within replay window." Otherwise the spec is in sync. Commit is on the worktree feature branch, not pushed. No deploys, no remote pushes.
