---
type: session
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_operator
tags: [session, sendwyrd, architecture, build, deploy, ux]
session_id: session_operator_20260425_mop_open_questions_resume_2
user: michael
started: 2026-04-25T00:00:00Z
completed: 2026-04-25
status: completed
prior_session: session_operator_20260424_mop_open_questions_resume
intent: "Resume rapid-fire architecture resolution from the open-question backlog (B6+) and continue through full v1 build + deploy. Single epic session covering: architecture closeout (ADRs 014–020), spec writing (Phases B/C/D), deploy infra setup (Cloudflare + Neon), Phase E scaffolding, Phase F landing, Phase G implementation, and many fast-follow UX iterations from live testing."
files_modified_summary: "Massive — 18+ commits. See git log on `main` between 4d3c5f0..70ae247 for full record."
memory_added:
  - feedback_decision_delegation.md
  - feedback_anti_scope_creep_relay_layer.md
  - feedback_zero_friction_default.md
  - project_sendwyrd_v1_live.md
---

## Outcome

**SendWyrd v1 is live and shipping at https://sendwyrd.com.** End-to-end publish/share/view/reply works against production. Pushed to GitHub (`openwyrd/sendwyrd`).

## Activity Log (high level)

1. Closed architecture phase — banked ADRs 014–020 in rapid-fire CTO mode (canonical renderer, use-case agnostic, SendWyrd brand, HD path, tombstone semantics, privacy indicator, stack confirmation including Drizzle ORM).
2. Renamed repo + working dir + memory dir from `MOP` → `sendwyrd`; ADR-016 amendment.
3. Wrote Phases B (wire spec), C (renderer behavioral contract), D (visual direction).
4. Provisioned Cloudflare + Neon (real infrastructure, live).
5. Phase E — scaffolded monorepo (`packages/core`, `api`, `web`, `infra/drizzle`); migrated DB; deployed both workers; verified end-to-end at sendwyrd.com.
6. Phase F — landing copy + wyrd sigil + Sealed/Open privacy glyphs.
7. Phase G — full implementation: real worker handlers (publish/fetch/burn), client compose pipeline, fragment-form decrypt-on-view, public-form SSR, onboarding (later optional), compose UI, settings (theme + forget seed).
8. E2E smoke harness — 6 scripts at `packages/core/scripts/` covering publish/fetch/decrypt, public-form SSR, ECIES replies, sendwyrd:// transitive, HTTPS embed, permanent (ttl=0).
9. Live UX iterations from real-use feedback:
   - URL embed bug (HTTPS share URLs not classified as transitive); fixed.
   - Mobile URL overflow; fixed via overflow-wrap.
   - URL exclusion from 300-cap; spec amendment.
   - Privacy indicator detail expansion; later collapsed to lock-only.
   - Modernized form controls (Segmented + Toggle replacing native radios/checkboxes).
   - Top nav added; wordmark routes to /compose.
   - Reply UX: prominent header + multi-send + accurate copy ("anyone with URL", not "one each").
   - Reply visibility bug on public-form view; fixed.
   - Reply default-on; toggle "on"-left.
   - Account-less default flow (open-mode seed auto-generated; passphrase opt-in via settings).
   - Mnemonic persistence (format v2 of seedStore).
   - Settings adds: passphrase add/remove, mnemonic reveal, regenerate seed, raw seed export.
   - Inbox auto-load replies + per-wyrd nicknames.
   - Lock glyph: closed/swung-open visual contrast.
   - "Open · public sharing" framing.
   - TTL presets: 1 day / 10 days / 90 days / never (ttl=0 sentinel year-9999).
   - Reply cap reduced 1000 → 300 (anti-scope-creep, xkcd-927 instinct).
   - Multi-hop relay framing on reply form copy.

## SITREP

**Completed**:
- All architecture banked (ADRs 003–020).
- All v1 prep phases (B/C/D wrote specs; E scaffolded; F landed; G implemented).
- Live infrastructure provisioned and verified.
- Repo + memory dir renamed to `sendwyrd`.
- 19 commits on `main`, all pushed to `openwyrd/sendwyrd`.
- Memory banked: 3 new feedback/project memories cover anti-scope-creep posture, zero-friction default, and current live state.

**In progress**: None — clean stopping point.

**Next up (Tier-1 punch list)**:
1. Burn affordance UI (DELETE handler exists; no UI yet).
2. HD recovery sweep (`/api/v1/authors/{k_origin_pub}/handles` is still 501-stubbed).
3. Spec doc updates (`spec_mop_v1.md` is behind shipped reality on three points).

**Blockers**: None.

## Next Session Prompt

SendWyrd v1 is **live and shipping**. Read in this order:

1. `CLAUDE.md` (auto-loaded — default Berthier identity uncustomized).
2. `MANIFEST.md` — current project identity (SendWyrd consumer brand / MOP protocol codename / *wyrd* unit noun).
3. `STATE.md` — current phase + Tier-1 punch list.
4. Memories: `project_sendwyrd_v1_live.md` (current state pointer), `feedback_anti_scope_creep_relay_layer.md` (xkcd-927 instinct — guard against feature creep toward chat app), `feedback_zero_friction_default.md` (account-less compose-on-arrival default), `feedback_decision_delegation.md` (CTO/CEO call boundaries), `feedback_pragmatic_privacy_posture.md`, `user_profile.md`.
5. ADRs 003–020 only if you need to look up specific architectural commitments — they are settled and not subject to re-debate without explicit phase-gate review.
6. This session's history (you're reading it).

**Tier-1 work for the next session**, in priority order:

1. **Burn affordance UI** — wyrd authors should be able to burn their wyrds from the view page (`/w/{handle}#K_read`) and from the inbox. The API already implements `DELETE /api/v1/wyrds/{handle}` (Schnorr-signed by `K_origin_priv`). Build the UI: a small "burn" button next to the privacy indicator on the view page, plus per-row burn in `/inbox`. Confirm dialog. After burn, route to `/inbox` or show tombstone state inline.

2. **HD recovery sweep** — currently if a user clears localStorage or moves devices, they cannot recover their wyrd history even with the BIP-39 mnemonic. Implement:
   - API: replace 501 stub at `packages/api/src/routes/authors.ts` with real `GET /api/v1/authors/{k_origin_pub_b64u}/handles` per spec §15. Schnorr-signed query (presence-check signature). Returns list of handles + metadata for that K_origin_pub.
   - Web: a `/recover` route or a settings action that takes a BIP-39 mnemonic input, derives K_origin_pubs across `m/300'/n'` for `n=0..gap+20`, queries the presence-check endpoint, reconstructs the wyrd history. Per spec §5.3 sweep convention.

3. **Spec doc updates** — bring `what/docs/spec/spec_mop_v1.md` current with what shipped:
   - §9.3 — handle is **client-generated** (12 random bytes b64u-encoded), not server-generated. Server rejects collisions; 96-bit entropy makes them negligible. `publish_message` SHA-256 includes the handle. Currently the spec says server-generated — fix this in §6, §9, §15.
   - §9.2 — `ttl_seconds = 0` is now ACCEPTED and means permanent (no expiry); server stores `expires_at = PERMANENT_EXPIRES_AT_MS = 253_370_764_800_000` (year 9999). Update the validation paragraph.
   - §14.4 — `REPLY_CODEPOINT_CAP` is **300**, not 1000. `REPLY_BLOB_BYTE_CEILING` is **2500**, not 5000.

After Tier-1, the Tier-2 list is in `project_sendwyrd_v1_live.md`: Sentry with redaction, OG card auto-embed, CI auto-deploy, formal test suite. Tier-3 (deferred): native apps, Söhne typography, federation, defensive registrations.

User is in CTO-delegated mode (per `feedback_decision_delegation`). Don't interrogate on technical or aesthetic forks. Match the voice: cypherpunk-Nostr-adjacent, Nietzschean, terse declarative docs, no corporate-neutralization.
