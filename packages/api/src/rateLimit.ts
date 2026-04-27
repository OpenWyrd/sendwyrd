/**
 * Per-IP / per-object rate limits (ADR-013 abuse posture).
 *
 * Backed by the Cloudflare Workers Rate Limiting binding — a sliding-window
 * counter that lives in the runtime, not KV. Per-colo (regional, not global):
 * an attacker concentrated at one PoP gets capped at the configured limit;
 * one rotating residential proxies across colos gets ~N× limit. That's the
 * v1 floor — combined with the size caps and the cryptographic gates on
 * destructive ops, it closes the loud-attacker case without PoW.
 *
 * The helper fails open when a binding is missing (local dev, vitest) and
 * fails open when the binding throws — we never want a flaky limiter to
 * bring down the API.
 */

import type { Context } from "hono";
import type { Env } from "./env.js";

type BucketName =
  | "RL_WRITE"
  | "RL_REPLY_IP"
  | "RL_REPLY_HANDLE"
  | "RL_READ"
  | "RL_UNFURL";

/**
 * Cloudflare sets CF-Connecting-IP on every inbound request and strips
 * any pre-existing copy, so it's the unspoofable client IP at the edge.
 * Fall back to a constant string rather than null so the bucket key stays
 * stable — an attacker can't dodge by emptying a "no-IP" bucket.
 */
export function clientIp(c: Context<{ Bindings: Env }>): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

export async function rateLimit(
  c: Context<{ Bindings: Env }>,
  bucket: BucketName,
  key: string,
): Promise<Response | null> {
  const limiter = c.env[bucket];
  if (!limiter) return null;
  try {
    const { success } = await limiter.limit({ key });
    if (success) return null;
  } catch {
    return null;
  }
  return c.json({ error: "rate_limited" }, 429, { "Retry-After": "60" });
}
