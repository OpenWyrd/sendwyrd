---
type: session
created: 2026-04-26
updated: 2026-04-26
last_edited_by: agent_spec_patch
status: completed
tier: 1
session_id: agent_20260426_spec_patch
intent: Patch spec_mop_v1.md for 6 drift points surfaced post-Tier-1
tags: [session, spec, patch, mop, drift]
---

# Session — Spec patch (6 drift points → v1.0.3-draft)

## Intent

Reconcile `what/docs/spec/spec_mop_v1.md` with shipped reality. Six drift points were surfaced by previous agents but never autonomously fixed. Pure markdown editing — no code changes.

## Verified shipped reality (read before editing)

- `packages/api/src/routes/wyrds.ts` — confirmed `published_at: body.publish_timestamp_ms` (client-asserted, validated within ±60s); `signature_invalid` returns **422**.
- `packages/api/src/routes/authors.ts` — confirmed empty list returns **200 OK with `{ handles: [] }`**; live entries map to `gone_at: null, gone_reason: null`; tombstones within retention populated; past-retention filtered out; `X-Mop-Auth: <sig_b64u>:<unix_ms>` colon-delimited.
- `packages/api/src/routes/replies.ts` — confirmed identical `X-Mop-Auth` parsing pattern as authors route; `signature_invalid` returns **422**; `signature_required` (missing header) returns **401**.

## Edits made

All edits in `what/docs/spec/spec_mop_v1.md`:

1. **Frontmatter** — `spec_version: "1.0.3-draft"`, `last_edited_by: agent_spec_patch`, `updated: 2026-04-26`.
2. **§6 wyrd-structure table** — `published_at` row updated: "Client-asserted within ±60s replay window; server validates and stores as-is. Never `server_now` directly." `expires_at` row clarified to reference the `253_370_764_800_000` permanent sentinel (it was vague before).
3. **§5.5 (new)** — `K_read` non-derivability note. Frames brittleness as feature per VISION P4. Explicit asymmetry: operational keys recoverable, read keys not.
4. **§14.2.1 (new)** — Canonical `X-Mop-Auth` format defined once. Spec is now: `<sig_b64u>:<unix_ms>`, single ASCII colon, no whitespace, decimal unix-ms, ±60s replay, 422 on invalid signature.
5. **§15.2** — Replaced the inline `X-Mop-Auth` definition with a cross-reference to §14.2.1.
6. **§15.3** — Added per-entry shape subsection (live entries always carry `gone_at: null, gone_reason: null`; tombstones populate; past-retention omitted) and explicit empty-result subsection (`200 OK` with `handles: []`, never 404).
7. **§17 error inventory** — Disambiguated `signature_required` (401, header absent) vs `signature_invalid` (422, verification failed). Listed every endpoint that returns `signature_invalid`.
8. **§21 changelog** — Added v1.0.3-draft entry summarizing all six fixes with section pointers.

## CTO calls made

- **Drift 4 (`gone_at` for live entries)** — chose `null` (explicit) over key-omission. Matches what `authors.ts` already returns (`gone_at: r.gone_at ? r.gone_at.getTime() : null`). Documented as "MUST be present and explicitly null" so client implementers cannot infer liveness from key absence.
- **Empty-list status code (Drift 2)** — confirmed `200 OK with handles: []`, not 204 No Content. Matches shipped behavior; semantically correct (proof-of-possession passed, the answer is "zero", which is a value not an absence).
- **§14.2.1 placement** — placed canonical `X-Mop-Auth` definition inside §14.2 (reply-fetch) rather than as a new top-level section, then cross-referenced from §15.2. This keeps the natural reading order (§14 introduces `X-Mop-Auth`, §15 reuses it) without introducing a peer section between Replies and Presence-check.
- **§5.5 placement (Drift 5)** — placed K_read brittleness note in §5 (HD derivation) rather than §7 (envelope), since the contract is "what HD recovery does and doesn't do" — that belongs adjacent to §5.3 sweep, not to envelope construction.

## Files touched

- Modified: `what/docs/spec/spec_mop_v1.md`
- Created: `how/sessions/active/session_agent_20260426_spec_patch.md` (this file)

## SITREP

**Completed**:
- All 6 drift points patched.
- Internal-contradiction scan clean (verified §6 table, §9.3 step 7, §10.3 response, §15.3 — all consistent on `published_at` semantics).
- Changelog v1.0.3-draft entry written.
- Frontmatter bumped.

**In progress**: None.

**Next up**:
- Orchestrator pushes branch `a-spec-patch` to remote and merges.
- Future session: cross-reference any client docs (`renderer_contract_v1.md`, app-side compose flow) for the same drift if they restate spec contracts.

**Blockers**: None.

## Next Session Prompt

The MOP spec is now v1.0.3-draft and reconciled with shipped API behavior. Next-up technical work: (1) audit `what/docs/spec/renderer_contract_v1.md` for the same drift surface (does it correctly describe `published_at` provenance, `X-Mop-Auth`, presence-check empty results?). (2) Consider whether the v1.0.3-draft content should be promoted from `draft` to released (`status: published` and a non-draft `spec_version: "1.0.3"`) given that all known drift is now reconciled. The orchestrator is responsible for pushing branch `a-spec-patch` and merging; do not push from a fresh agent without their direction.
