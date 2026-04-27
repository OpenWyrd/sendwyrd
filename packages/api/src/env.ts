/**
 * Worker bindings + secrets.
 * Bindings: per wrangler.toml.
 * Secrets: set via `wrangler secret put`.
 */

import type { R2Bucket } from "@cloudflare/workers-types";

/**
 * Cloudflare Workers Rate Limiting binding. Sliding window per-colo;
 * `success: false` means the caller exceeded the configured limit for the
 * given key in the most recent period.
 */
export interface RateLimit {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  // Bindings (from wrangler.toml).
  BLOBS: R2Bucket;
  PROTOCOL_VERSION: string;
  WEB_ORIGIN: string;

  /**
   * Per-IP / per-object rate-limit bindings (ADR-013). Configured as
   * `[[unsafe.bindings]] type = "ratelimit"` in wrangler.toml. Optional in
   * the type so unit tests and local dev (no binding) compile; the
   * rateLimit helper fails open when a binding is absent.
   */
  RL_WRITE?: RateLimit;
  RL_REPLY_IP?: RateLimit;
  RL_REPLY_HANDLE?: RateLimit;
  RL_READ?: RateLimit;
  RL_UNFURL?: RateLimit;
  RL_ADMIN?: RateLimit;

  // Secrets (from `wrangler secret put`).
  DATABASE_URL: string;
  /**
   * Sentry DSN — optional. When unset/empty, Sentry initializes in no-op
   * mode (no events sent). Set via `wrangler secret put SENTRY_DSN`.
   */
  SENTRY_DSN?: string;
  /**
   * Sentry release identifier — optional. Plumbed by CI as a non-secret
   * `--var SENTRY_RELEASE:${GITHUB_SHA}` on `wrangler deploy`, so uploaded
   * source maps and exception reports share a release tag. When unset,
   * Sentry generates a release name automatically (fine for local dev).
   */
  SENTRY_RELEASE?: string;
  /**
   * Capability secret for the /ops dashboard. Bearer auth on
   * `/api/v1/admin/*` endpoints. Set via `wrangler secret put`. When
   * unset, admin endpoints return 503.
   */
  OPS_DASH_SECRET?: string;
}
