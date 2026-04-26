# Infrastructure

Provisioning state and deploy notes for SendWyrd v1.

## Provisioned (2026-04-25)

| Resource | Identifier | Notes |
|----------|------------|-------|
| Neon project | `holy-poetry-85164505` (`sendwyrd`) in `aws-us-east-1` | Connection URL stored in local `.env.local` and Worker secret. |
| R2 bucket | `sendwyrd-blobs` | Bound to API Worker as `BLOBS` (see `packages/api/wrangler.toml`). |
| Cloudflare account | `5aa935489ed472330341d50ca095b641` | Owns `sendwyrd.com`, `sendwyrd.app` (purchased 2026-04-25). |

## Pending

- Cloudflare Pages project (`sendwyrd-web`) — created on first `wrangler pages deploy`.
- Worker route — `sendwyrd.com/api/*` mapped to `sendwyrd-api` worker; configured in dashboard or `wrangler.toml` after first deploy.
- DNS records on `sendwyrd.com` — Pages project will auto-create the A/CNAME for the apex; API route mapping handled by Workers.

## Drizzle migrations

Schema lives at `packages/api/src/db/schema.ts` (colocated with the package that consumes it). Migrations land in `packages/api/drizzle/`. Drizzle config is at `packages/api/drizzle.config.ts`.

Generate a migration after schema changes:

```bash
pnpm --filter @sendwyrd/api db:generate
```

Apply against the Neon database:

```bash
pnpm --filter @sendwyrd/api db:migrate
```

## Secrets

| Secret | Where | How to set |
|--------|-------|-----------|
| `DATABASE_URL` | Worker | `cd packages/api && wrangler secret put DATABASE_URL` |
| `DATABASE_URL` | Local dev (web/api) | `.env.local` (root) and `packages/api/.dev.vars` |

Secrets are NEVER in committed files. The `.gitignore` excludes `.env*` and `.dev.vars`.
