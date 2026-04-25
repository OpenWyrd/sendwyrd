---
type: session
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
tags: [session, mop, architecture, open-questions]
session_id: session_operator_20260424_mop_open_questions_resume
user: michael
started: 2026-04-24T00:00:00Z
completed: 2026-04-24
status: completed
prior_session: session_operator_20260424_mop_founding_architecture
intent: "Resume rapid-fire architecture resolution from open-question backlog. One question at a time per user preference. Bank each as an ADR. Paused mid-rapid-fire at B6 for sleep — five ADRs banked, six backlog items resolved."
files_modified:
  - STATE.md
  - how/backlog/backlog_open_questions_v1.md
files_created:
  - what/decisions/adr_009_inbox_client_side_hd_aggregation.md
  - what/decisions/adr_010_notifications_app_layer_only.md
  - what/decisions/adr_011_body_plain_text_aggressive_render.md
  - what/decisions/adr_012_body_size_cap_300.md
  - what/decisions/adr_013_abuse_posture_v1.md
  - how/sessions/history/2026-04/session_operator_20260424_mop_open_questions_resume.md (this file, originally in active/)
memory_added:
  - feedback_pragmatic_privacy_posture.md (in ~/.claude/projects/.../memory/)
commits:
  - 25db65c (Bank founding session: VISION, ADRs 003-008, open-question backlog) — committed at session start
  - 1375f20 (ADRs 009-012: inbox aggregation, notifications, body schema, size cap)
  - <next> (ADR-013 + session close)
---

# Session — MOP Open Questions Resume

## Intent

Continue from the founding session pause. Walk the open-question backlog (B1 → B9 → S1 → S4) one question at a time per the user's rapid-fire preference. Bank each resolution as an ADR. Do not re-litigate ADRs 003–008.

## Operational rules followed

- One question at a time, named options. Cypherpunk-Nostr-adjacent register; no corporate-neutralization.
- After each answer: write or update artifact, propagate to STATE / backlog / session-tracker, then advance.
- Flagged refinement forks where the answer had a hidden privacy/UX trade (e.g., B1's option 3a vs. 3b; B3's render-policy fork).

## SITREP

### Completed

- **B1 → ADR-009**: Inbox aggregation is client-side via HD derivation. Master inbox URL is a device-local construct that encodes the seed (or HD top branch); client uses BIP-32 derivation to regenerate per-object `K_origin_priv` and independently fetches each per-object reply endpoint. Host stays per-object blind — no master pubkey, no `/inbox` endpoint, no authorship cluster on host. Recovery via BIP-39 seed + sweep across HD indices. Loss-of-master-URL is *aligned* with VISION P4 (brittleness), not in tension.
- **B2 → ADR-010**: Zero notification primitive at the protocol layer. Notifications are entirely a client/app concern, layered above the protocol. Reference web app is pull-only; planned mobile app may implement OS-level push (APNs/FCM) via the app's own backend acting as a polling client. MOP host learns nothing about subscriptions.
- **B3 → ADR-011**: Body is plain text + embedded URLs (no markdown grammar). Renderer aggressively auto-embeds non-MOP URLs on page open: known media extensions inline as `<img>`/`<video>`/`<audio>`; everything else fetches OG metadata client-side and renders a preview card. Recipient-side privacy is **explicitly not hardened** in v1 — tracking-pixel attacks are accepted as in-scope-but-undefended. Cypherpunk on content/authorship; pragmatic on rendering.
- **B7 → ADR-011 (collateral)**: Image/media inclusion is via external URL only, renderer auto-inlines. MOP itself never hosts media.
- **B4 → ADR-012**: Body size cap is **300 Unicode codepoints**. Spartan reference; deliberate distance from Twitter's 280; austerity register. Server-enforced at publish; composer-enforced at compose-time; codepoint-counted (not bytes, not grapheme clusters).
- **B5 → ADR-013**: v1 abuse posture is edge-CDN (Cloudflare-class) + per-IP rate-limits + per-object reply rate-limits + size caps + cryptographic gates on origin operations. **No PoW.** Pragmatic-v1 floor; ships fast; residential-proxy bypass is undefended and accepted as "fix on detection." PoW deferred (not refused). Documented as v1 host-operator policy at `mop.app`, not as protocol-spec — protocol stays minimal.

### In progress

- **B6 — HD path convention.** Question was framed (BIP-44-style with chosen coin index vs. BIP-43 purpose code with MOP subtree vs. pure-custom; sub-question of flat vs. with-account). Lean is BIP-43 with purpose code `300'` (Spartan reference matching ADR-012). User paused before answering — sleep time. Pick up here.

### Next up (in priority order)

- **B6** — HD path convention (resume mid-question).
- **B8** — Tombstone vs. vanish on TTL expiry.
- **B9** — Public-form privacy banner on rendered page.
- **S1** — v1 launch scope (which use cases lead).
- **S2** — Domain & branding.
- **S3** — Stack confirmation.
- **S4** — Renderer ownership.

### Blockers

None. Session paused for sleep, not for any unresolved blocker.

### Files touched

**Created:**
- `what/decisions/adr_009_inbox_client_side_hd_aggregation.md`
- `what/decisions/adr_010_notifications_app_layer_only.md`
- `what/decisions/adr_011_body_plain_text_aggressive_render.md`
- `what/decisions/adr_012_body_size_cap_300.md`
- `what/decisions/adr_013_abuse_posture_v1.md`
- `how/sessions/history/2026-04/session_operator_20260424_mop_open_questions_resume.md` (this file)

**Modified:**
- `STATE.md` — added ADRs 009–013 to banked list; removed B1–B5, B7 from open-questions; added timeline entries; updated Next Session Prompt.
- `how/backlog/backlog_open_questions_v1.md` — marked B1, B2, B3, B4, B5, B7 resolved with ADR pointers; added `resolved:` index in frontmatter.

**Memory (persistent across conversations, `~/.claude/projects/-home-operator-lattice-MOP/memory/`):**
- Added `feedback_pragmatic_privacy_posture.md` — new feedback memory documenting the cypherpunk-on-content / pragmatic-on-rendering distinction, derived from B3 + B5 resolutions. Indexed in `MEMORY.md`.

**Commits on `main`:**
- `25db65c` — Bank founding session (committed at session start, covering prior session's uncommitted work).
- `1375f20` — ADRs 009-012 batch.
- `<next>` — ADR-013 + session close (this commit).

## Decisions worth flagging beyond the ADR record

- **"Pragmatic privacy posture" is a new meta-heuristic.** Banked via memory file, not an ADR. It tells future agents *how to weigh* privacy vs. UX trades — not what specific trade to pick. Reference it when B/S-questions present similar forks.
- **Layering ethos consolidated.** ADR-010 + ADR-013 both push concerns *up* off the protocol (notifications → app layer; abuse → host-operator layer). Combined effect: the MOP wire protocol stays radically narrow. Future ADRs should default to asking "is this a protocol concern, a host concern, or a client concern?" and resist adding to the protocol unless the question is truly cross-host.

## Next Session Prompt

A self-contained paragraph for the next agent. Read in order:

1. `CLAUDE.md` (auto-loaded; **personality is still default Berthier — not yet customized**).
2. `MANIFEST.md` — MOP project identity.
3. `who/governance/VISION.md` — five immutable design principles + scope walls.
4. `what/decisions/adr_003*.md` through `adr_013*.md` — all 11 banked architectural commitments, in number order. Canonical; **do not re-debate** unless the user explicitly reopens.
5. `STATE.md`.
6. `how/backlog/backlog_open_questions_v1.md` — open question queue (B6, B8, B9, S1–S4 still open as of session close).

**Then resume rapid-fire architecture questions** with the user, one question at a time (named options; cypherpunk-Nostr-adjacent register; do not corporate-neutralize). The user paused before answering **B6 — HD path convention**. Re-open B6 with this fork:

- (a) BIP-44 with chosen coin index — `m/44'/{COIN_MOP}'/account'/0/object_index`. Wallet-familiar; SLIP-0044 collision risk.
- (b) BIP-43 purpose code with MOP subtree — suggested code `300'` (Spartan, matches ADR-012). Cleanly says "this isn't a coin." *Lean.*
- (c) Pure custom (ignore BIP-43/44). Mechanically fine; orphaned from HD ecosystem.

If (b): include an `account'` level (`m/300'/account'/n'`) for future multi-persona, or flat (`m/300'/n'`)? Brittleness register suggests flat.

After B6, walk B8 → B9 → S1 → S2 → S3 → S4.

**Apply the pragmatic privacy posture heuristic** (`~/.claude/projects/-home-operator-lattice-MOP/memory/feedback_pragmatic_privacy_posture.md`) when forks pit recipient-side privacy or maximalist defense against UX/wedge-viability — the user repeatedly chose UX in v1.

The user is **the operator (X: @deltaclimbs)** (***), working in `~/lattice/MOP/` on a Fedora workspace. Cypherpunk-Nostr-adjacent, Nietzschean, anti-feed/anti-algorithm; terse declarative ADRs; rule-light protocols. Match the register.
