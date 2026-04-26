---
type: session
session_id: session_agent_20260426_sentry
agent: agent_claude_opus_4_7
created: 2026-04-26
updated: 2026-04-26
status: completed
intent: Wire Sentry error reporting into web + api workers with renderer-contract §16 redaction
tier: 2
branch: c-sentry
tags: [observability, sentry, privacy, renderer_contract, mop]
---

# Session — Sentry on web + api with renderer-contract §16 redaction

## Intent

Wire Sentry error reporting into both workers (api + web) with aggressive
beforeSend redaction. SendWyrd is host-blind by architecture; a third-party
error reporter is the single largest exfiltration risk. Default-deny on
anything that could be sensitive: K_read, the HD seed, plaintext bodies,
encrypted envelopes, capability URLs in any form.

## Architecture decisions (CTO calls)

### 1. SDK choice: lighter integration over Next-tooling

- **API**: `@sentry/cloudflare` 10.50.0 — worker-native SDK; `Sentry.withSentry`
  wraps the Hono app cleanly (single export-default change).
- **Web**: `@sentry/browser` 10.50.0 + `@sentry/core` 10.50.0 (types only) —
  direct browser-side init from a client component mounted in the root
  layout. No webpack plugin, no `withSentryConfig` wrapper, no
  `instrumentation.ts`, no `sentry.{client,server,edge}.config.ts`.

**Rationale for skipping `@sentry/nextjs`**: documented incompatibility
with OpenNext-on-Workers (opennextjs-cloudflare#756, July 2025). The
Next-Sentry tooling assumes a Next.js Node server runtime; OpenNext compiles
the app to a Worker. The lighter integration ships error reporting +
redaction without fighting the build, per the prompt's instruction to
"prefer the simplest integration that ships, not the most Next-ish."

Server-side errors on the Web Worker (OpenNext runtime) are not currently
captured by a separate SDK init — they will surface in Cloudflare's
built-in Worker observability (already enabled in `wrangler.jsonc`). If
this becomes a gap, future work can add `@sentry/cloudflare` to the web
worker too via OpenNext's wrapper hook.

### 2. DSN provisioning: env-var, no-op when unset

Both packages read DSN from env vars and initialize as no-ops when unset.
No throw, no warn, no console noise. The user provisions Sentry org +
project + DSN at their leisure; the integration code is dormant until then.

- Web: `process.env.NEXT_PUBLIC_SENTRY_DSN` (Next inlines at build time).
  Falsy → early return; Sentry SDK is loaded but `Sentry.init` never called.
- API: `env.SENTRY_DSN` from the Worker runtime. Falsy → `dsn: undefined`
  passed to `Sentry.withSentry`, which the SDK treats as no-op per its
  documented contract.

### 3. Redaction: load-bearing `beforeSend` + belt-and-suspenders SDK config

`redactBeforeSend` (in both `packages/web/src/lib/sentryRedact.ts` and
`packages/api/src/sentryRedact.ts` — near-duplicates) implements all 8
scrubber categories from the prompt + §16.1:

1. URL fragments stripped (any `#...` → empty).
2. Sensitive headers redacted: `Authorization`, `X-Mop-Auth`, `*-Sig`,
   `*-Signature`, `Cookie`, `Set-Cookie`.
3. `event.request.data` replaced with `"[redacted]"`.
4. Query strings nuked (entire `?...` chopped from any URL).
5. Storage breadcrumbs (`category === "storage"`) dropped at both
   `beforeBreadcrumb` (source) and `beforeSend` (defense in depth).
6. Console breadcrumbs (`category === "console"`) dropped at both points.
7. `/k/<43-char-b64u>` path segments replaced with `/k/[redacted]`.
8. 43-char base64url substrings in exception values, top-level message,
   `extra`, `tags`, transaction names, breadcrumb messages, and stack-frame
   filenames replaced with `[redacted-43char]`.

Plus per §16.1: stack frame `vars` (captured local-variable values) are
stripped wholesale — frames stay (file/function/line), values go.

The redactor wraps the entire scrub in try/catch and **fails closed**: any
thrown error during redaction returns `null`, dropping the event entirely
rather than risk shipping a half-redacted one.

SDK-level config also sets `sendDefaultPii: false` and `tracesSampleRate: 0`
on both sides. No performance traces in v1 — that's a separate privacy
review.

## Files touched

### Created

- `packages/web/src/lib/sentryRedact.ts` — web redaction module (~210 lines).
- `packages/web/src/components/SentryInit.tsx` — client-component init.
- `packages/api/src/sentryRedact.ts` — api redaction module (parallel copy).

### Modified

- `packages/web/package.json` — added `@sentry/browser`, `@sentry/core`.
- `packages/web/src/app/layout.tsx` — mount `<SentryInit />` in `<body>`.
- `packages/api/package.json` — added `@sentry/cloudflare`, `@sentry/core`.
- `packages/api/src/env.ts` — added optional `SENTRY_DSN?: string`.
- `packages/api/src/index.ts` — wrap default export with `Sentry.withSentry`;
  call `Sentry.captureException(err)` from the Hono error handler (no-op
  when DSN unset).
- `pnpm-lock.yaml` — refreshed by `pnpm install`.

## Verification

| Check | Result |
|-------|--------|
| `pnpm install` | clean, +420 packages |
| `pnpm typecheck` (turbo: core + api + web) | pass |
| `pnpm --filter @sendwyrd/web build` | pass (Next.js 15.5.15) |
| `pnpm --filter @sendwyrd/web exec opennextjs-cloudflare build` | pass (worker.js generated) |
| `pnpm --filter @sendwyrd/api build` | trivial pass (wrangler builds at deploy) |
| `wrangler deploy --dry-run --outdir /tmp/wrangler-dryrun` (api) | pass, 995 KiB upload |
| Empty DSN no-op (manual review) | confirmed — both paths short-circuit cleanly |

Did NOT send any test events (per prompt). No Sentry test page added.

## Env-var setup the user needs to action

When the user provisions a Sentry org + project + DSN, configure as follows.

### Web (`sendwyrd-web` worker)

`NEXT_PUBLIC_SENTRY_DSN` is exposed to the browser bundle by design (it's
public Sentry-side). Set it in `packages/web/wrangler.jsonc` `[vars]`:

```jsonc
"vars": {
  "NEXT_PUBLIC_SENTRY_DSN": "https://<key>@<org>.ingest.sentry.io/<project>"
}
```

Then redeploy the web worker. Note: because Next inlines `NEXT_PUBLIC_*`
env vars at build time, this also needs to be present at `pnpm build`
time for it to land in the client bundle. Easiest path: set it in CI as
a build-env var, or commit it to `wrangler.jsonc` (it's public anyway).

### API (`sendwyrd-api` worker)

`SENTRY_DSN` is server-side. Set as a secret:

```bash
wrangler secret put SENTRY_DSN
# paste DSN at prompt
```

Verify with `wrangler secret list`. No `wrangler.toml` change needed —
the env var surfaces automatically via the Worker's `env` binding.

### Both

After provisioning, hit a known-error endpoint (e.g. force a 500 on the
api) and confirm it appears in the Sentry dashboard with the right project
and *with redaction applied* — verify:

- Event URL has no fragment, no query string.
- No Authorization / X-Mop-Auth headers.
- Request body shows `[redacted]`.
- No 43-char base64url substrings in exception messages.

## Compatibility caveats with OpenNext / Workers runtime

1. **`@sentry/nextjs` skipped**: opennextjs-cloudflare#756 documents a
   build-time crash. Closed in July 2025 with no public resolution. Even
   if fixed, the Next-Sentry plugin chain adds substantial complexity for
   a Worker target. Direct `@sentry/browser` is the pragmatic path.
2. **Web server-side errors not captured by Sentry**: they currently fall
   to Cloudflare Worker observability (built-in, already enabled). Future
   work can layer `@sentry/cloudflare` on the OpenNext-generated worker
   via the OpenNext wrapper hook if needed. Listed in `next up` below.
3. **`AsyncLocalStorage` requirement**: `@sentry/cloudflare` needs the
   `nodejs_compat` flag. API's `wrangler.toml` already has it; verified.

## Constraint compliance

- No workspace-root deps added (Sentry deps live in `packages/web` and
  `packages/api` only).
- `bootstrap.sh` not modified (Sentry is npm-managed, not system-level).
- No test events sent.
- No Sentry test page added.
- `wrangler.toml` / `wrangler.jsonc` unchanged (DSN provisioning is the
  user's action; integration code is wired but dormant).
- No push to remote yet (commit-only; user requests push separately).

## Completed

- Web client-side Sentry init via `@sentry/browser`, mounted from root layout.
- API server-side Sentry via `@sentry/cloudflare` `withSentry` wrapper.
- Shared `redactBeforeSend` scrub logic implementing all 8 §16 rules + §16.1
  local-vars rule + fail-closed safety.
- Hono error handler forwards exceptions to `Sentry.captureException` (no-op
  when DSN unset).
- Typecheck + builds + wrangler dry-run all pass.

## Next up

- User provisions Sentry org/project/DSN; sets env vars per "Env-var setup"
  above; redeploys both workers; verifies redaction in dashboard with a
  forced-error event.
- Optional follow-up: layer `@sentry/cloudflare` on the OpenNext-generated
  web worker for server-side error capture (currently Cloudflare-built-in
  only on the web side).
- Optional follow-up: extract `sentryRedact.ts` to `packages/core` to
  collapse the web/api duplication. Defer until the divergence costs more
  than the duplication.

## Blockers

None.

## Next Session Prompt

The Sentry integration is wired and dormant on branch `c-sentry`. Both
web (`@sentry/browser` via `SentryInit` client component in
`packages/web/src/app/layout.tsx`) and api (`@sentry/cloudflare`
`withSentry` wrapper in `packages/api/src/index.ts`) initialize as
no-ops when their DSN env vars are unset. The redaction module
(`sentryRedact.ts`, near-duplicate copies in web `lib/` and api `src/`)
implements all 8 renderer-contract §16 scrub categories plus §16.1
stack-frame local-vars stripping; it fails closed (returns null on any
internal error). Typecheck, Next build, OpenNext build, and wrangler
dry-run all pass. To activate Sentry: provision an org/project, set
`NEXT_PUBLIC_SENTRY_DSN` in `packages/web/wrangler.jsonc` `[vars]` and
in build-time env, set `SENTRY_DSN` via `wrangler secret put SENTRY_DSN`
on `sendwyrd-api`, redeploy both workers, force a 500 error, and
confirm the dashboard receives an event with redaction applied (no
fragment, no query string, no auth headers, no `[redacted-43char]`-
shaped substrings remaining as raw b64u). Optional next steps: layer
`@sentry/cloudflare` on the OpenNext web worker for server-side capture,
and extract the duplicated `sentryRedact.ts` into `packages/core`.
