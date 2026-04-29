---
type: coordination
created: 2026-04-29
updated: 2026-04-29
status: active
last_edited_by: agent_berthier
tags: [privacy, scrub, multi-session]
---

# Coord — Personal info elimination from public repo

**Operator directive:** total elimination of operator-name patterns, `***`, `***` from the now-public sendwyrd repo. Two sessions working in parallel — this note exists to prevent collision.

**Replacement rule (operator-set, 2026-04-29):** the *only* sanctioned operator reference anywhere in the repo is the X handle `@deltaclimbs` linking to `https://x.com/deltaclimbs`. No legal name, no email, no other identity surfaces. In contexts where a Twitter link is awkward (config files, schemas, ADRs that need a generic noun), use `the operator` — never re-introduce a name.

## This session's intended scope (claim before edit)

Berthier session, 2026-04-29 ~04:32Z. **STANDING DOWN — operator instruction (2026-04-29):** wait for the other session to finish, then run a verification pass for anything they missed. No edits from this session until then.

**Tier 1 — In-tree scrub (HIGH priority, reversible):**
- [ ] `STATE.md` — strip CF account ID, Neon org "the Neon org", Neon project ID
- [ ] `infra/README.md` — same
- [ ] `packages/api/wrangler.toml` — replace CF account ID with env var
- [ ] `packages/web/wrangler.jsonc` — same
- [ ] `what/decisions/adr_013_abuse_posture_v1.md` — operator-name normalization
- [ ] `what/docs/spec/spec_mop_v1.md` — same
- [ ] `how/sessions/history/2026-04/session_operator_20260424_mop_founding_architecture.md` — strip "the operator (X: @deltaclimbs)" and rename file
- [ ] `how/sessions/history/2026-04/...open_questions_resume.md` — same
- [ ] `README.md`, ADR 003, VISION.md, web /about page, inspiration_bin_21 — replace narrative operator-nickname examples with non-personal example names (per "totally eliminate operator-name" directive — nickname is short for operator-name)

**Tier 2 — Prevention (deferred until Tier 1 lands):**
- [ ] Repo-level `git config user.email` to GitHub no-reply
- [ ] Pre-commit hook blocking the literal strings + CF account ID
- [ ] Move operator detail to gitignored `infra/PRIVATE.md`

**Tier 3 — Git history rewrite (gated on operator approval, must not run concurrently with other session):**
- [ ] `git filter-repo --mailmap` for email rewrite
- [ ] `git filter-repo --replace-text` for literal strings + CF account ID
- [ ] Force-push to `main`

## Other session

Operator stated another session is working on this in parallel. Scope unknown to this session. **Will not edit any file until scope division is clarified.**

## Conflict-prevention rules for both sessions

1. Update this file's checkbox list when claiming a file (`[x] file — claimed by agent_<name>`).
2. Never run `git filter-repo` or any history-altering operation concurrently — the second runner's clone will be inconsistent with the first's force-push.
3. Sessions must read this coord file before each batch of edits.
