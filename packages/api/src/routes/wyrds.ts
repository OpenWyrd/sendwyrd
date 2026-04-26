/**
 * Wyrd routes per spec_mop_v1.md §9–§13 (with §9.3 amendment: handle is
 * client-generated; see packages/core/src/compose.ts header for rationale).
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import {
  HANDLE_CHARS,
  K_ORIGIN_PUB_BYTES,
  ENVELOPE_BYTE_CEILING,
  TTL_SECONDS_MIN,
  TTL_SECONDS_MAX,
  REPLAY_WINDOW_MS,
  TOMBSTONE_RETENTION_DAYS,
  PERMANENT_EXPIRES_AT_MS,
  b64uDecode,
  b64uEncode,
  publishMessage,
  deleteMessage,
  schnorrVerify,
} from "@sendwyrd/core";
import type { Env } from "../env.js";
import { makeDb, schema } from "../db.js";
import { rateLimit, clientIp } from "../rateLimit.js";

const HANDLE_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${HANDLE_CHARS}}$`);

export const wyrdsRoutes = new Hono<{ Bindings: Env }>()
  /* POST /api/v1/wyrds — publish */
  .post("/", async (c) => {
    const rl = await rateLimit(c, "RL_WRITE", clientIp(c));
    if (rl) return rl;

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "malformed_request" }, 400);
    }

    const fields = ["handle", "envelope", "k_origin_pub", "ttl_seconds",
      "replies_enabled", "publish_signature", "publish_timestamp_ms"];
    for (const f of fields) {
      if (!(f in body)) return c.json({ error: "malformed_request", missing: f }, 400);
    }

    if (typeof body.handle !== "string" || !HANDLE_PATTERN.test(body.handle)) {
      return c.json({ error: "malformed_request", field: "handle" }, 400);
    }

    let envelope: Uint8Array, k_origin_pub: Uint8Array,
      handleBytes: Uint8Array, signature: Uint8Array;
    try {
      handleBytes = b64uDecode(body.handle);
      envelope = b64uDecode(body.envelope);
      k_origin_pub = b64uDecode(body.k_origin_pub);
      signature = b64uDecode(body.publish_signature);
    } catch {
      return c.json({ error: "invalid_base64url" }, 400);
    }

    if (envelope.length > ENVELOPE_BYTE_CEILING) {
      return c.json({ error: "payload_too_large" }, 413);
    }
    if (k_origin_pub.length !== K_ORIGIN_PUB_BYTES) {
      return c.json({ error: "pubkey_invalid" }, 422);
    }
    if (typeof body.ttl_seconds !== "number" ||
        body.ttl_seconds < TTL_SECONDS_MIN ||
        body.ttl_seconds > TTL_SECONDS_MAX) {
      return c.json({ error: "ttl_out_of_range" }, 422);
    }
    if (typeof body.replies_enabled !== "boolean") {
      return c.json({ error: "malformed_request", field: "replies_enabled" }, 400);
    }
    if (typeof body.publish_timestamp_ms !== "number") {
      return c.json({ error: "malformed_request", field: "publish_timestamp_ms" }, 400);
    }

    const now = Date.now();
    if (Math.abs(body.publish_timestamp_ms - now) > REPLAY_WINDOW_MS) {
      return c.json({ error: "timestamp_outside_window" }, 422);
    }

    // Verify Schnorr signature.
    const messageHash = publishMessage({
      handle: handleBytes,
      envelope,
      ttl_seconds: body.ttl_seconds,
      replies_enabled: body.replies_enabled,
      publish_timestamp_ms: body.publish_timestamp_ms,
    });
    const xOnly = k_origin_pub.slice(1); // SEC1 compressed -> X-only
    const ok = schnorrVerify(signature, messageHash, xOnly);
    if (!ok) return c.json({ error: "signature_invalid" }, 422);

    const expires_at =
      body.ttl_seconds === 0
        ? new Date(PERMANENT_EXPIRES_AT_MS)
        : new Date(body.publish_timestamp_ms + body.ttl_seconds * 1000);
    const published_at = new Date(body.publish_timestamp_ms);

    const db = makeDb(c.env.DATABASE_URL);
    try {
      await db.insert(schema.wyrds).values({
        handle: body.handle,
        k_origin_pub: k_origin_pub,
        envelope: envelope,
        published_at,
        expires_at,
        replies_enabled: body.replies_enabled,
      });
    } catch (e: any) {
      // Unique-violation on handle PK = collision (negligible at 96-bit entropy).
      if (e?.message?.includes("duplicate") || e?.code === "23505") {
        return c.json({ error: "handle_collision_retry" }, 409);
      }
      throw e;
    }

    return c.json(
      {
        handle: body.handle,
        published_at: body.publish_timestamp_ms,
        expires_at: expires_at.getTime(),
      },
      201,
    );
  })

  // (silence unused-import lint for TTL_SECONDS_MIN / TTL_SECONDS_MAX which are
  // referenced in validation logic but TS can't see the read in this file)

  /* GET /api/v1/wyrds/:handle — fetch envelope (fragment-form access) */
  .get("/:handle", async (c) => {
    const rlGet = await rateLimit(c, "RL_READ", clientIp(c));
    if (rlGet) return rlGet;

    const handle = c.req.param("handle");
    if (!HANDLE_PATTERN.test(handle)) {
      return c.json({ error: "not_found" }, 404);
    }
    const db = makeDb(c.env.DATABASE_URL);
    const rows = await db.select().from(schema.wyrds)
      .where(eq(schema.wyrds.handle, handle)).limit(1);
    const row = rows[0];
    if (!row) return c.json({ error: "not_found" }, 404);

    // Tombstone window: serve 410 for 30 days post gone_at, 404 thereafter.
    if (row.gone_at) {
      const retentionMs = TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - row.gone_at.getTime() > retentionMs) {
        return c.json({ error: "not_found" }, 404);
      }
      return c.json({
        status: "gone",
        reason: row.gone_reason ?? "expired",
        gone_at: row.gone_at.toISOString(),
      }, 410);
    }

    // Lazy TTL expiry — flip to gone if expired.
    if (row.expires_at.getTime() <= Date.now()) {
      const goneAt = new Date();
      await db.update(schema.wyrds)
        .set({ gone_at: goneAt, gone_reason: "expired" })
        .where(eq(schema.wyrds.handle, handle));
      return c.json({
        status: "gone",
        reason: "expired",
        gone_at: goneAt.toISOString(),
      }, 410);
    }

    return c.json({
      handle: row.handle,
      envelope: b64uEncode(row.envelope),
      k_origin_pub: b64uEncode(row.k_origin_pub),
      published_at: row.published_at.getTime(),
      expires_at: row.expires_at.getTime(),
      replies_enabled: row.replies_enabled,
    });
  })

  /* DELETE /api/v1/wyrds/:handle — burn (K_origin-signed) */
  .delete("/:handle", async (c) => {
    const rl = await rateLimit(c, "RL_WRITE", clientIp(c));
    if (rl) return rl;

    const handle = c.req.param("handle");
    if (!HANDLE_PATTERN.test(handle)) {
      return c.json({ error: "not_found" }, 404);
    }

    let body: any;
    try { body = await c.req.json(); } catch {
      return c.json({ error: "malformed_request" }, 400);
    }
    if (typeof body.delete_signature !== "string" ||
        typeof body.delete_timestamp_ms !== "number") {
      return c.json({ error: "malformed_request" }, 400);
    }

    const now = Date.now();
    if (Math.abs(body.delete_timestamp_ms - now) > REPLAY_WINDOW_MS) {
      return c.json({ error: "timestamp_outside_window" }, 422);
    }

    const db = makeDb(c.env.DATABASE_URL);
    const rows = await db.select().from(schema.wyrds)
      .where(eq(schema.wyrds.handle, handle)).limit(1);
    const row = rows[0];
    if (!row) return c.json({ error: "not_found" }, 404);

    if (row.gone_at) {
      // Already gone — idempotent 410.
      return c.json({
        status: "gone",
        reason: row.gone_reason ?? "burned",
        gone_at: row.gone_at.toISOString(),
      }, 410);
    }

    // Verify signature.
    let signature: Uint8Array, handleBytes: Uint8Array;
    try {
      signature = b64uDecode(body.delete_signature);
      handleBytes = b64uDecode(handle);
    } catch {
      return c.json({ error: "invalid_base64url" }, 400);
    }
    const messageHash = deleteMessage({
      handle: handleBytes,
      delete_timestamp_ms: body.delete_timestamp_ms,
    });
    const xOnly = row.k_origin_pub.slice(1);
    const ok = schnorrVerify(signature, messageHash, xOnly);
    if (!ok) return c.json({ error: "signature_invalid" }, 422);

    const goneAt = new Date();
    // Burn: clear envelope ciphertext + cascade-delete replies via schema FK.
    await db.update(schema.wyrds)
      .set({ gone_at: goneAt, gone_reason: "burned", envelope: new Uint8Array(0) })
      .where(eq(schema.wyrds.handle, handle));

    return c.json({
      handle,
      gone_at: goneAt.getTime(),
      gone_reason: "burned",
    });
  });
