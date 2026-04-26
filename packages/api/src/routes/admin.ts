/**
 * Admin / ops routes.
 *
 * Capability-gated by OPS_DASH_SECRET (bearer auth). Returns aggregate
 * stats only — no per-user, per-wyrd, or per-IP data. Volume metrics
 * suitable for the /ops dashboard.
 *
 * VISION compatibility:
 *   - No identity primitives. K_origin_pub is per-wyrd random, so distinct
 *     K_origin counts equal wyrd counts (intentionally; the protocol has
 *     no stable per-user identifier).
 *   - "Active authors" / "unique users" cannot be computed from the
 *     database without violating P3 (capability over identity). For an
 *     IP-based estimate, see the Cloudflare Analytics API integration
 *     (deferred — needs a scoped read-only token).
 */

import { Hono } from "hono";
import { count, gt, eq, isNull } from "drizzle-orm";
import type { Env } from "../env.js";
import { makeDb, schema } from "../db.js";

export const adminRoutes = new Hono<{ Bindings: Env }>().get(
  "/stats",
  async (c) => {
    const expected = c.env.OPS_DASH_SECRET ?? "";
    if (!expected) {
      return c.json({ error: "ops_disabled" }, 503);
    }
    const auth = c.req.header("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token || token.length !== expected.length || token !== expected) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const db = makeDb(c.env.DATABASE_URL);
    const now = Date.now();
    const day = new Date(now - 24 * 60 * 60 * 1000);
    const week = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      wyrdsTotal,
      wyrds24h,
      wyrds7d,
      wyrdsActive,
      wyrdsBurned,
      wyrdsExpired,
      repliesTotal,
      replies24h,
      replies7d,
    ] = await Promise.all([
      db.select({ n: count() }).from(schema.wyrds),
      db
        .select({ n: count() })
        .from(schema.wyrds)
        .where(gt(schema.wyrds.published_at, day)),
      db
        .select({ n: count() })
        .from(schema.wyrds)
        .where(gt(schema.wyrds.published_at, week)),
      db
        .select({ n: count() })
        .from(schema.wyrds)
        .where(isNull(schema.wyrds.gone_at)),
      db
        .select({ n: count() })
        .from(schema.wyrds)
        .where(eq(schema.wyrds.gone_reason, "burned")),
      db
        .select({ n: count() })
        .from(schema.wyrds)
        .where(eq(schema.wyrds.gone_reason, "expired")),
      db.select({ n: count() }).from(schema.replies),
      db
        .select({ n: count() })
        .from(schema.replies)
        .where(gt(schema.replies.received_at, day)),
      db
        .select({ n: count() })
        .from(schema.replies)
        .where(gt(schema.replies.received_at, week)),
    ]);

    return c.json({
      generated_at: new Date(now).toISOString(),
      wyrds: {
        total: wyrdsTotal[0]?.n ?? 0,
        last_24h: wyrds24h[0]?.n ?? 0,
        last_7d: wyrds7d[0]?.n ?? 0,
        active: wyrdsActive[0]?.n ?? 0,
        burned: wyrdsBurned[0]?.n ?? 0,
        expired: wyrdsExpired[0]?.n ?? 0,
      },
      replies: {
        total: repliesTotal[0]?.n ?? 0,
        last_24h: replies24h[0]?.n ?? 0,
        last_7d: replies7d[0]?.n ?? 0,
      },
    });
  },
);
