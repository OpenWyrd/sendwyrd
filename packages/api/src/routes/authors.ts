/**
 * Author presence-check route per spec_mop_v1.md §15.
 *
 *   GET /api/v1/authors/:k_origin_pub_b64u/handles
 *
 * Used by clients during HD sweep on recovery to locate published wyrds.
 *
 * Auth (per spec §15.2): Schnorr-signed via `X-Mop-Auth: <sig_b64u>:<unix_ms>`.
 * Signed message:
 *   SHA-256("mop:v1:presence_check" || k_origin_pub(33) || ts_be(8))
 *
 * Response (200): { k_origin_pub, handles: [{ handle, published_at, expires_at,
 * gone_at, gone_reason, replies_enabled }, ...] }.
 *
 * Tombstoned wyrds within the 30-day retention window are included (with
 * gone_at / gone_reason populated) so the recovering author sees what they
 * had. Wyrds past retention are omitted (the row is gone from the DB or
 * filtered here — we filter here as a defense in case the GC is lazy).
 *
 * Empty result is 200 with `handles: []` — proof-of-possession was valid;
 * "you have zero" is a valid answer.
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import {
  K_ORIGIN_PUB_BYTES,
  REPLAY_WINDOW_MS,
  TOMBSTONE_RETENTION_DAYS,
  b64uDecode,
  b64uEncode,
  presenceCheckMessage,
  schnorrVerify,
} from "@sendwyrd/core";
import type { Env } from "../env.js";
import { makeDb, schema } from "../db.js";
import { rateLimit, clientIp } from "../rateLimit.js";

export const authorsRoutes = new Hono<{ Bindings: Env }>().get(
  "/:k_origin_pub/handles",
  async (c) => {
    const rl = await rateLimit(c, "RL_READ", clientIp(c));
    if (rl) return rl;

    const k_origin_pub_b64u = c.req.param("k_origin_pub");

    // Decode + shape-check the pubkey from the path.
    let k_origin_pub: Uint8Array;
    try {
      k_origin_pub = b64uDecode(k_origin_pub_b64u);
    } catch {
      return c.json({ error: "invalid_base64url" }, 400);
    }
    if (k_origin_pub.length !== K_ORIGIN_PUB_BYTES) {
      return c.json({ error: "pubkey_invalid" }, 422);
    }
    // SEC1 compressed prefix must be 0x02 or 0x03.
    if (k_origin_pub[0] !== 0x02 && k_origin_pub[0] !== 0x03) {
      return c.json({ error: "pubkey_invalid" }, 422);
    }

    // Auth: X-Mop-Auth: <sig_b64u>:<unix_ms>
    const auth = c.req.header("X-Mop-Auth");
    if (!auth) return c.json({ error: "signature_required" }, 401);
    const [sigB64u, tsStr] = auth.split(":");
    if (!sigB64u || !tsStr) return c.json({ error: "malformed_request" }, 400);
    const ts = Number(tsStr);
    if (!Number.isFinite(ts)) return c.json({ error: "malformed_request" }, 400);
    if (Math.abs(ts - Date.now()) > REPLAY_WINDOW_MS) {
      return c.json({ error: "timestamp_outside_window" }, 422);
    }

    let signature: Uint8Array;
    try {
      signature = b64uDecode(sigB64u);
    } catch {
      return c.json({ error: "invalid_base64url" }, 400);
    }

    const messageHash = presenceCheckMessage({
      k_origin_pub,
      presence_timestamp_ms: ts,
    });
    const xOnly = k_origin_pub.slice(1);
    const ok = schnorrVerify(signature, messageHash, xOnly);
    if (!ok) return c.json({ error: "signature_invalid" }, 422);

    // Lookup: all wyrds for this pubkey.
    const db = makeDb(c.env.DATABASE_URL);
    const rows = await db
      .select({
        handle: schema.wyrds.handle,
        published_at: schema.wyrds.published_at,
        expires_at: schema.wyrds.expires_at,
        gone_at: schema.wyrds.gone_at,
        gone_reason: schema.wyrds.gone_reason,
        replies_enabled: schema.wyrds.replies_enabled,
      })
      .from(schema.wyrds)
      .where(eq(schema.wyrds.k_origin_pub, k_origin_pub));

    const now = Date.now();
    const retentionMs = TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const handles = rows
      .filter((r) => {
        // Filter out tombstones past retention (defense-in-depth; GC may be lazy).
        if (r.gone_at && now - r.gone_at.getTime() > retentionMs) return false;
        return true;
      })
      .map((r) => ({
        handle: r.handle,
        published_at: r.published_at.getTime(),
        expires_at: r.expires_at.getTime(),
        gone_at: r.gone_at ? r.gone_at.getTime() : null,
        gone_reason: r.gone_reason,
        replies_enabled: r.replies_enabled,
      }));

    return c.json({
      k_origin_pub: b64uEncode(k_origin_pub),
      handles,
    });
  },
);
