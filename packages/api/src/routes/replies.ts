/**
 * Reply routes per spec_mop_v1.md §14.
 *
 *   POST /api/v1/wyrds/:handle/replies   — anonymous submit
 *   GET  /api/v1/wyrds/:handle/replies   — author-only fetch (Schnorr-signed)
 */

import { Hono } from "hono";
import { eq, asc, max } from "drizzle-orm";
import {
  HANDLE_CHARS,
  REPLAY_WINDOW_MS,
  REPLY_BLOB_BYTE_CEILING,
  TOMBSTONE_RETENTION_DAYS,
  b64uDecode,
  b64uEncode,
  fetchRepliesMessage,
  schnorrVerify,
} from "@sendwyrd/core";
import type { Env } from "../env.js";
import { makeDb, schema } from "../db.js";
import { rateLimit, clientIp } from "../rateLimit.js";

const HANDLE_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${HANDLE_CHARS}}$`);

export const repliesRoutes = new Hono<{ Bindings: Env }>()
  /* POST /:handle/replies — anonymous submit */
  .post("/:handle/replies", async (c) => {
    const handle = c.req.param("handle");
    if (!HANDLE_PATTERN.test(handle)) return c.json({ error: "not_found" }, 404);

    // Two independent budgets: per-IP (curbs an attacker spamming many
    // wyrds from one source) and per-handle (curbs a reply-flood against
    // one wyrd from rotated IPs). ADR-013 §Per-object reply-blob rate-limit.
    const rlIp = await rateLimit(c, "RL_REPLY_IP", clientIp(c));
    if (rlIp) return rlIp;
    const rlHandle = await rateLimit(c, "RL_REPLY_HANDLE", handle);
    if (rlHandle) return rlHandle;

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "malformed_request" }, 400);
    }
    if (typeof body.reply_blob !== "string" || typeof body.submit_timestamp_ms !== "number") {
      return c.json({ error: "malformed_request" }, 400);
    }

    let blob: Uint8Array;
    try {
      blob = b64uDecode(body.reply_blob);
    } catch {
      return c.json({ error: "invalid_base64url" }, 400);
    }
    if (blob.length > REPLY_BLOB_BYTE_CEILING) {
      return c.json({ error: "payload_too_large" }, 413);
    }

    const db = makeDb(c.env.DATABASE_URL);
    const wyrdRows = await db
      .select()
      .from(schema.wyrds)
      .where(eq(schema.wyrds.handle, handle))
      .limit(1);
    const wyrd = wyrdRows[0];
    if (!wyrd) return c.json({ error: "not_found" }, 404);

    if (wyrd.gone_at) {
      return c.json(
        {
          status: "gone",
          reason: wyrd.gone_reason ?? "burned",
          gone_at: wyrd.gone_at.toISOString(),
        },
        410,
      );
    }
    if (wyrd.expires_at.getTime() <= Date.now()) {
      // Lazy expire on access.
      return c.json({ status: "gone", reason: "expired", gone_at: new Date().toISOString() }, 410);
    }
    if (!wyrd.replies_enabled) {
      return c.json({ error: "replies_disabled" }, 403);
    }

    // Compute next received_seq for this handle.
    const nextSeqRows = await db
      .select({ maxSeq: max(schema.replies.received_seq) })
      .from(schema.replies)
      .where(eq(schema.replies.handle, handle));
    const nextSeq = (nextSeqRows[0]?.maxSeq ?? 0) + 1;

    const receivedAt = new Date();
    await db.insert(schema.replies).values({
      handle,
      received_at: receivedAt,
      received_seq: nextSeq,
      reply_blob: blob,
    });

    return c.json({ received_at: receivedAt.getTime() }, 202);
  })

  /* GET /:handle/replies — author-only, signed */
  .get("/:handle/replies", async (c) => {
    const rl = await rateLimit(c, "RL_READ", clientIp(c));
    if (rl) return rl;

    const handle = c.req.param("handle");
    if (!HANDLE_PATTERN.test(handle)) return c.json({ error: "not_found" }, 404);

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

    const db = makeDb(c.env.DATABASE_URL);
    const wyrdRows = await db
      .select()
      .from(schema.wyrds)
      .where(eq(schema.wyrds.handle, handle))
      .limit(1);
    const wyrd = wyrdRows[0];
    if (!wyrd) return c.json({ error: "not_found" }, 404);

    if (wyrd.gone_at) {
      const retentionMs = TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - wyrd.gone_at.getTime() > retentionMs) {
        return c.json({ error: "not_found" }, 404);
      }
      return c.json(
        {
          status: "gone",
          reason: wyrd.gone_reason ?? "burned",
          gone_at: wyrd.gone_at.toISOString(),
        },
        410,
      );
    }

    const handleBytes = b64uDecode(handle);
    const messageHash = fetchRepliesMessage({
      handle: handleBytes,
      fetch_timestamp_ms: ts,
    });
    const xOnly = wyrd.k_origin_pub.slice(1);
    const ok = schnorrVerify(signature, messageHash, xOnly);
    if (!ok) return c.json({ error: "signature_invalid" }, 422);

    const replyRows = await db
      .select()
      .from(schema.replies)
      .where(eq(schema.replies.handle, handle))
      .orderBy(asc(schema.replies.received_seq));

    return c.json({
      handle,
      replies: replyRows.map((r) => ({
        reply_blob: b64uEncode(r.reply_blob),
        received_at: r.received_at.getTime(),
      })),
    });
  });
