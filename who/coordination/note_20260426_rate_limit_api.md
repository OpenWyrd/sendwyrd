---
created: 2026-04-26
author: agent_operator
urgency: info
expires: 2026-05-03
---

# Rate-limit work in flight on `rate-limit-api` branch

Closing the ADR-013 abuse-posture gap (per-IP + per-object rate limits). Working in worktree at `~/lattice/sendwyrd-rate-limit` on branch `rate-limit-api`.

**Files this branch will touch** — stay clear if you're a concurrent session:

- `packages/api/wrangler.toml` (adds 5 ratelimit bindings)
- `packages/api/src/env.ts` (types for the new bindings)
- `packages/api/src/rateLimit.ts` (new helper)
- `packages/api/src/routes/wyrds.ts` / `replies.ts` / `authors.ts` / `unfurl.ts` (apply helper)
- `packages/api/test/rateLimit.test.ts` + `packages/api/vitest.config.ts` (new)
- `packages/api/package.json` + `pnpm-lock.yaml` (vitest devDep)

**Not touched**: `packages/core/*`, `packages/web/*`, root configs, `.github/workflows/*`, the spec, `who/`/`what/`/`how/` (other than this note).

If you're the MCP session: nothing of mine should collide with yours. Both branches will rebase cleanly onto main.
