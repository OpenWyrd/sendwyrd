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
}
