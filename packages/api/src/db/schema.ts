/**
 * Postgres schema for SendWyrd v1 host (Neon).
 * Implements the storage contract behind spec_mop_v1.md.
 *
 * Tables:
 *   wyrds       — main per-wyrd record + ciphertext envelope (or pointer to R2)
 *   replies     — encrypted reply blobs by wyrd handle
 *
 * Rate-limit state (per ADR-013 / spec §16) lives in Cloudflare KV or Durable
 * Objects, not in Postgres. Schema additions for that are deferred.
 */

import {
  pgTable,
  text,
  bigint,
  boolean,
  timestamp,
  customType,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Postgres `bytea` column with a `Uint8Array` JS type.
 * Drizzle's built-in helper varies between versions; this customType is
 * version-stable.
 */
const bytea = customType<{ data: Uint8Array; default: false }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Uint8Array): Buffer {
    return Buffer.from(value);
  },
  fromDriver(value: unknown): Uint8Array {
    if (value instanceof Uint8Array) return value;
    if (Buffer.isBuffer(value)) return new Uint8Array(value);
    if (typeof value === "string" && value.startsWith("\\x")) {
      // Postgres hex-encoded bytea string fallback.
      const hex = value.slice(2);
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return out;
    }
    throw new Error(`bytea fromDriver: unexpected type ${typeof value}`);
  },
});

/**
 * wyrds — one row per published wyrd.
 *
 * The envelope is stored inline as bytea for v1 simplicity. If sizes become
 * operationally painful we migrate envelopes to R2 (per spec §19).
 *
 * `handle` is the 16-char base64url string (server-issued, 12 random bytes).
 */
export const wyrds = pgTable(
  "wyrds",
  {
    handle: text("handle").primaryKey(),
    k_origin_pub: bytea("k_origin_pub").notNull(), // 33 bytes SEC1 compressed
    envelope: bytea("envelope").notNull(), // 1 + 12 + ciphertext + 16; ≤1500 bytes
    published_at: timestamp("published_at", { withTimezone: true }).notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    replies_enabled: boolean("replies_enabled").notNull().default(false),
    gone_at: timestamp("gone_at", { withTimezone: true }),
    gone_reason: text("gone_reason", { enum: ["expired", "burned"] }),
  },
  (t) => [
    index("wyrds_expires_at_idx").on(t.expires_at),
    index("wyrds_k_origin_pub_idx").on(t.k_origin_pub),
    index("wyrds_gone_at_idx").on(t.gone_at),
  ],
);

/**
 * replies — one row per submitted reply blob.
 *
 * Replies are encrypted to the wyrd's K_origin_pub via ECIES (spec §14.3).
 * Server stores the blob; only the author can decrypt with K_origin_priv.
 *
 * On wyrd burn: all replies for that handle are deleted (spec §13.4).
 */
export const replies = pgTable(
  "replies",
  {
    handle: text("handle")
      .notNull()
      .references(() => wyrds.handle, { onDelete: "cascade" }),
    received_at: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    received_seq: bigint("received_seq", { mode: "number" }).notNull(),
    reply_blob: bytea("reply_blob").notNull(), // ≤5000 bytes
  },
  (t) => [
    primaryKey({ columns: [t.handle, t.received_seq] }),
    index("replies_received_at_idx").on(t.received_at),
  ],
);
