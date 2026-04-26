---
type: session
created: 2026-04-26
updated: 2026-04-26
status: completed
last_edited_by: agent_michael
tags: [session, ci, deploy, github-actions, tier-2, task-b]
---

# Session — CI auto-deploy via GitHub Actions (Task B)

## Goal

Wire GitHub Actions so a push to `main` auto-deploys both workers (api + web)
to Cloudflare. Removes the manual `wrangler deploy` ritual currently performed
after every PR merge. Closes Tier-2 item: "CI auto-deploy on push to main".

## Scope

Single deliverable: `.github/workflows/deploy.yml`. No source changes, no
wrangler.toml changes, no new dependencies.

## Reconnaissance

| Source | Finding |
|--------|---------|
| Root `package.json` | `packageManager: pnpm@9.15.0`, `engines.node: >=20.18.0` |
| Existing `.github/workflows/ci.yml` | Uses `pnpm/action-setup@v4` v9.15.0, `actions/setup-node@v4` Node 20, `pnpm install --frozen-lockfile` → `format:check` → `typecheck` → `build`. Mirror these for consistency. |
| `packages/api/package.json` | `deploy` script = `wrangler deploy` |
| `packages/web/package.json` | `build:cloudflare` = `opennextjs-cloudflare build`; `deploy` = `opennextjs-cloudflare deploy`. **Both required** — OpenNext build is separate from `next build` that `pnpm build` (turbo) runs. |
| `packages/api/wrangler.toml` | Routes `sendwyrd.com/api/*`, R2 binding `BLOBS`, `account_id` baked in. No CI changes needed. |
| `packages/core/scripts/e2e-smoke.ts` | Run via `pnpm --filter @sendwyrd/core exec tsx scripts/e2e-smoke.ts`. `tsx` is in `@sendwyrd/core` devDeps. |
| `STATE.md` deploy commands | `cd packages/api && wrangler deploy`; `cd packages/web && pnpm exec opennextjs-cloudflare build && pnpm exec opennextjs-cloudflare deploy` — confirms the build-then-deploy order for web. |

## CTO calls made

1. **Concurrency**: `group: deploy-prod`, `cancel-in-progress: false`. In-flight
   deploys finish before the next runs. Mid-deploy cancellation against
   Cloudflare can leave api and web on different versions.
2. **Smoke fail behaviour**: fail loudly. `pnpm --filter @sendwyrd/core exec
   tsx scripts/e2e-smoke.ts` exits non-zero on failure → workflow run marked
   broken in GitHub. Better to know.
3. **Manual trigger**: `workflow_dispatch` enabled. User can re-run from the
   GitHub Actions UI without pushing an empty commit.
4. **Reserved-name pitfall**: `pnpm --filter <pkg> deploy` invokes the
   built-in `pnpm deploy` (a file-copy command), **not** the npm `deploy`
   script. Workflow uses `pnpm --filter <pkg> exec <bin>` to bypass this.
   Documented inline in the workflow comments so future editors don't trip.
5. **Web build step**: explicit `opennextjs-cloudflare build` before deploy
   — `pnpm build` only runs `next build` via turbo, which is insufficient
   for the Workers deploy. Mirrors what STATE.md documents the user runs.
6. **Versions**: pnpm 9.15.0, Node 20 — match the existing `ci.yml` rather
   than upgrading to Node 22. Keeping CI and deploy on the same matrix
   reduces surprise.

## Workflow contents

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy api + web to Cloudflare
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build
      - name: Deploy api worker
        run: pnpm --filter @sendwyrd/api exec wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - name: Build web for Cloudflare
        run: pnpm --filter @sendwyrd/web exec opennextjs-cloudflare build
      - name: Deploy web worker
        run: pnpm --filter @sendwyrd/web exec opennextjs-cloudflare deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - name: Smoke test (e2e against production)
        run: pnpm --filter @sendwyrd/core exec tsx scripts/e2e-smoke.ts
```

(Live file has additional inline comments documenting the reserved-name pitfall and the rationale for the separate web build step.)

## Verification performed

- `pnpm install --frozen-lockfile` → done in 4.6s, lockfile honest.
- `pnpm typecheck` → 4 successful, 4 cached, FULL TURBO. Baseline green.
- YAML syntax → `python3 -c "import yaml; yaml.safe_load(...)"` parsed
  cleanly; jobs `['deploy']`, 10 steps.
- Did **not** trigger the workflow. Per task constraints, the user/orchestrator
  pushes after verifying.

## SITREP

**Completed**
- Created `.github/workflows/deploy.yml` with full deploy chain.
- Verified install + typecheck baseline green.
- Validated YAML syntax.

**In progress**
- None.

**Next up**
- Orchestrator pushes the worktree branch (`b-ci-deploy`) and opens a PR.
- After merge to `main`, the next push to `main` will trigger the first
  auto-deploy. Watch the run; if smoke fails, deploy is marked broken.

**Blockers**
- None.

**Files touched**
- Created `.github/workflows/deploy.yml`
- Created `how/sessions/active/session_agent_20260426_ci_deploy.md` (this file)

## Next Session Prompt

Task B is complete in worktree branch `b-ci-deploy`. The workflow file
`.github/workflows/deploy.yml` deploys api then web to Cloudflare on push
to `main` (and on manual `workflow_dispatch`), then runs the e2e smoke
test against production. Concurrency group `deploy-prod` with
`cancel-in-progress: false`. Secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` are already set on the repo. After merge, the
first push to main triggers the first auto-deploy — watch the Actions tab.
If the smoke step fails, investigate the production deploy state before
the next change (the deploys themselves may have succeeded; the smoke is
a separate signal).
