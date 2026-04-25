---
type: session
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_michael
tags: [session, mop, architecture, open-questions]
session_id: session_michael_20260424_mop_open_questions_resume
user: michael
started: 2026-04-24T00:00:00Z
status: active
intent: "Resume rapid-fire architecture resolution from open question backlog (B1 → B9 → S1 → S4). One question at a time per user preference. Bank as ADRs / VISION updates as decisions land. Do not re-debate ADR 003–008."
prior_session: session_michael_20260424_mop_founding_architecture
files_modified:
  - STATE.md
  - how/backlog/backlog_open_questions_v1.md
files_created:
  - how/sessions/active/session_michael_20260424_mop_open_questions_resume.md (this file)
  - what/decisions/adr_009_inbox_client_side_hd_aggregation.md
  - what/decisions/adr_010_notifications_app_layer_only.md
  - what/decisions/adr_011_body_plain_text_aggressive_render.md
  - what/decisions/adr_012_body_size_cap_300.md
---

# Session — MOP Open Questions Resume

## Intent

Continue from where the founding session paused. The user is mid-flight on B1 (reply receiving mechanics). Walk B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9, then S1 → S4. Bank each resolution as an ADR (or VISION/MANIFEST patch where appropriate). Do not re-litigate ADRs 003–008.

## Operational Rules

- One question at a time, named options. Match user's terse cypherpunk register.
- After each answer, write or update the relevant artifact, then advance to the next question.
- Flag if any answer would breach a VISION principle or banked ADR — escalate, don't silently accommodate.

## Resolved

- [x] B1 — Reply receiving mechanics → **ADR-009** (client-side HD aggregation, host stays per-object blind)
- [x] B2 — Reply notification model → **ADR-010** (zero protocol primitive; client/app concern)
- [x] B3 — Body format → **ADR-011** (plain text + aggressive renderer auto-embed; pragmatic on recipient-side privacy)
- [x] B7 — Image/media inclusion → ADR-011 collateral (URL-only, renderer auto-inlines)
- [x] B4 — Object body size cap → **ADR-012** (300 codepoints, Spartan reference)

## In Progress

- [ ] B5 — Anti-abuse / PoW / rate-limits design

## Up Next
- [ ] B6 — HD path conventions (BIP-44 vs custom)
- [ ] B8 — Tombstone vs. vanish on TTL expiry
- [ ] B9 — Public-form privacy banner
- [ ] S1 — v1 launch scope (which use cases lead)
- [ ] S2 — Domain & branding
- [ ] S3 — Stack confirmation
- [ ] S4 — Renderer ownership
