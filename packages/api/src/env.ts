/**
 * Worker bindings + secrets.
 * Bindings: per wrangler.toml.
 * Secrets: set via `wrangler secret put`.
 */

import type { R2Bucket } from "@cloudflare/workers-types";

export interface Env {
  // Bindings (from wrangler.toml).
  BLOBS: R2Bucket;
  PROTOCOL_VERSION: string;
  WEB_ORIGIN: string;

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
