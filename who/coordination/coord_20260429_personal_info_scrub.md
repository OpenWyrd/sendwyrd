---
type: coordination
created: 2026-04-29
updated: 2026-04-29
status: closed
last_edited_by: agent_berthier
tags: [privacy, scrub, closed]
---

# Coord — Operator personal info scrub (closed)

**Status: closed 2026-04-29.** All personal references removed from current tree and git history per operator directive. Canonical operator identity in this repo is the X handle `@deltaclimbs` linking to `https://x.com/deltaclimbs`; in contexts where a Twitter link is awkward (config files, schemas, ADR generic prose), `the operator`.

## Prevention controls (deferred follow-ups)

- [ ] Repo-level `git config user.email` to GitHub no-reply form
- [ ] Pre-commit hook blocking the literal pattern set
- [ ] `infra/PRIVATE.md` confirmed gitignored

## Verification commands

```
git log --all --pretty='%ae' | sort -u
git log --all --pretty='%s%n%b' | grep -iE 'operator-name-pattern'
git grep -i 'operator-name-pattern'
```
