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

**Tier 3 — Git history rewrite (DONE 2026-04-29 by Session B per operator directive):**
- [x] `git filter-repo --mailmap` — `***REDACTED***` → `DeltaClimbs@users.noreply.github.com` across all 184 commits
- [x] `git filter-repo --replace-text` — `***REDACTED***`, `***REDACTED***`, CF account ID, Neon org/project IDs, "the operator", "home-operator-lattice" → all redacted to `***` or genericized in every blob
- [x] `git filter-repo --replace-message` — same string set + word-boundary operator-name pattern, operator-nickname pattern in commit messages
- [x] Force-push to `main` — origin verified pre-flip at `9f9117b`, post-flip at `aead664`. Old SHAs now dangling on GitHub; GC window 14–90 days before they're truly unreachable.

Pre-flip in-tree scrub also done in same session (Tier 1 absorbed into Session B's scope when Session A stood down): 8 `session_operator_*.md` files renamed to `session_operator_*.md`; `agent_operator` → `agent_operator` in 60+ frontmatter fields; CF account ID stripped from wrangler files (now reads `CLOUDFLARE_ACCOUNT_ID` env var; CI already sets this from secrets); Neon IDs and "the Neon org" stripped from STATE/infra docs; narrative "a friend sent me this" → "a friend sent me this" in README/ADR-003/VISION/about-page; "Alice → Bob → Carol" → "Alice → Bob → Carol" chains.

**Verification commands the operator can run:**
```
git log --all --pretty='%ae' | sort -u           # only DeltaClimbs no-reply
git log --all --pretty='%s%n%b' | grep -iE 'operator-name-patterns'   # empty
git grep -iE '***|***|***|org-***|***'       # empty
```

## Other session

Operator stated another session is working on this in parallel. Scope unknown to this session. **Will not edit any file until scope division is clarified.**

## Conflict-prevention rules for both sessions

1. Update this file's checkbox list when claiming a file (`[x] file — claimed by agent_<name>`).
2. Never run `git filter-repo` or any history-altering operation concurrently — the second runner's clone will be inconsistent with the first's force-push.
3. Sessions must read this coord file before each batch of edits.
