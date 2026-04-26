---
type: session
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_michael
tags: [session, mop, architecture, open-questions]
session_id: session_michael_20260425_mop_open_questions_resume_2
user: michael
started: 2026-04-25T00:00:00Z
status: active
prior_session: session_michael_20260424_mop_open_questions_resume
intent: "Resume rapid-fire architecture resolution from the open-question backlog. Pick up at B6 (HD path convention) and continue B8 → B9 → S1 → S2 → S3 → S4. One question at a time. Bank each as an ADR."
files_modified:
  - STATE.md
  - MANIFEST.md
  - who/governance/VISION.md
  - how/backlog/backlog_open_questions_v1.md
files_created:
  - what/decisions/adr_014_canonical_renderer_first_party_clients.md
  - what/decisions/adr_015_v1_use_case_agnostic.md
  - what/decisions/adr_016_brand_sendwyrd.md
  - what/decisions/adr_017_hd_path_convention.md
  - what/decisions/adr_018_ttl_expiry_tombstone.md
  - what/decisions/adr_019_privacy_posture_indicator.md
  - what/decisions/adr_020_v1_stack.md
memory_added:
  - feedback_decision_delegation.md
completed:
---

## Activity Log

- Session started — resuming from B6 paused state in prior session.
- User shifted working agreement: CTO calls (technical + aesthetic) delegated to agent; CEO calls (scope, branding, trust posture) reserved for user. Banked as memory feedback_decision_delegation.md.
- Banked ADR-014 (canonical renderer + first-party clients only across web/iOS/Android) and ADR-015 (v1 use-case agnostic), closing S4 and S1.
- User chose **SendWyrd** as consumer brand with `sendwyrd.com` and `sendwyrd.app` reserved. Banked as ADR-016, closing S2. Protocol codename MOP retained for technical use; unit noun is *wyrd* (lowercase).
- Plowed remaining technical ADRs in CTO mode: ADR-017 (HD path `m/300'/n'`), ADR-018 (TTL → 410 Gone tombstone), ADR-019 (symmetric privacy-posture indicator), ADR-020 (Next.js + Hono on Cloudflare + Neon + R2 + noble/scure + AES-GCM + Schnorr).
- Swept placeholder names from MANIFEST.md and VISION.md (Hypermessage → wyrd; mop.app → sendwyrd.com; descriptive references updated). Historical ADR text retained for fidelity.
- Updated backlog with all 13 resolutions; updated STATE.md with new ADRs, timeline, and forward-facing Next Session Prompt for Phase B (wire spec).

## SITREP

**Completed**:
- 7 ADRs banked (014–020); architecture phase closed
- Working agreement reframed (CTO/CEO mode) and saved to memory
- All 13 backlog questions (B1–B9, S1–S4) now resolved
- MANIFEST + VISION + STATE + backlog all swept and updated
- 10 in-conversation tasks created tracking remaining v1 prep phases (B–F)

**In progress**: None — clean stopping point.

**Next up**: Phase B — write consolidated v1 MOP wire spec under `what/docs/` capturing every ADR decision in implementation-grade detail. Then Phase C (renderer contract), D (visual/UX direction with research), E (scaffolding), F (landing copy).

**Blockers**: None.

**Files touched**: See `files_modified` + `files_created` in frontmatter.

## Next Session Prompt

Architecture phase is closed (ADRs 003–020 banked). Project is now in **v1 build-readiness prep**. Next session begins **Phase B: wire spec**.

Read in this order:
1. `CLAUDE.md` (auto-loaded; default Berthier identity uncustomized)
2. `MANIFEST.md` — SendWyrd consumer brand / MOP protocol codename / *wyrd* unit noun
3. `who/governance/VISION.md` — five immutable principles
4. `what/decisions/adr_003*.md` through `adr_020*.md` in number order — all banked architectural commitments
5. `STATE.md` — Phase B–F roadmap and timeline
6. This session log (most recent SITREP)
7. Memory: `feedback_decision_delegation.md` (CTO/CEO mode), `feedback_pragmatic_privacy_posture.md`, `feedback_rapid_fire_questioning.md`, `user_profile.md`, `project_mop_founding.md`

**Phase B work**: write the consolidated v1 MOP protocol spec at `what/docs/spec_mop_v1.md` (or similar). Capture every ADR-level decision in implementation-grade detail:
- URL canonical forms (private fragment + public path) per ADR-004
- Endpoint inventory with HTTP methods, request/response payloads, error codes per ADRs 006/008/013/018
- Encryption envelope layout (AES-256-GCM per ADR-020 with K_read derivation, AAD, IV/nonce handling)
- HD derivation reference per ADR-017 (`m/300'/n'`, sweep on recovery, master inbox URL encoding)
- Reply-blob format per ADR-008 + ECIES detail per ADR-020
- Rate-limit numbers per ADR-013 (operational tuning baseline)
- Tombstone metadata schema per ADR-018

After Phase B completes, Phase C is the renderer behavioral contract per ADR-014 (cross-implementation spec for web/iOS/Android).

User is in CTO-delegated mode: do not interrogate on technical/aesthetic forks. Bank technical decisions silently as ADRs (or as wire-spec content) and surface CEO-level questions only when scope, branding, or trust posture is genuinely in play. Match user's voice register: cypherpunk-Nostr-adjacent, Nietzschean, anti-feed; terse declarative docs.
