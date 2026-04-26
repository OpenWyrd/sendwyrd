/**
 * Wire types — match `what/docs/spec/spec_mop_v1.md`.
 * All binary values are base64url-encoded (no padding) on the wire.
 */

export const PROTOCOL_VERSION = 1 as const;
export const ENVELOPE_VERSION = 0x01 as const;
export const HANDLE_BYTES = 12;
export const HANDLE_CHARS = 16; // base64url(12 bytes) without padding
export const K_READ_BYTES = 32;
export const K_READ_CHARS = 43; // base64url(32 bytes) without padding
export const K_ORIGIN_PUB_BYTES = 33; // SEC1 compressed
export const ENVELOPE_IV_BYTES = 12;
export const ENVELOPE_TAG_BYTES = 16;
export const BODY_CODEPOINT_CAP = 300;
export const ENVELOPE_BYTE_CEILING = 1500;
export const REPLY_CODEPOINT_CAP = 1000;
export const REPLY_BLOB_BYTE_CEILING = 5000;
export const TTL_SECONDS_MIN = 1;
export const TTL_SECONDS_MAX = 31_536_000; // 1 year
export const TTL_SECONDS_DEFAULT = 7_776_000; // 90 days
export const REPLAY_WINDOW_MS = 60_000;
export const TOMBSTONE_RETENTION_DAYS = 30;

export type Base64Url = string;

/** Per `spec_mop_v1.md` §6 — wyrd at rest. */
export interface WyrdRecord {
  handle: Base64Url;
  k_origin_pub: Base64Url;
  envelope: Base64Url;
  published_at: number; // unix epoch ms
  expires_at: number; // unix epoch ms (0 disallowed in v1)
  replies_enabled: boolean;
  gone_at: number | null;
  gone_reason: GoneReason | null;
}

export type GoneReason = "expired" | "burned" | "key_mismatch";

/** Per spec §9 — POST /api/v1/wyrds */
export interface PublishRequest {
  envelope: Base64Url;
  k_origin_pub: Base64Url;
  ttl_seconds: number;
  replies_enabled: boolean;
  publish_signature: Base64Url;
  publish_timestamp_ms: number;
}

export interface PublishResponse {
  handle: Base64Url;
  published_at: number;
  expires_at: number;
}

/** Per spec §10 — GET /api/v1/wyrds/{handle} (fragment form). */
export interface FetchEnvelopeResponse {
  handle: Base64Url;
  envelope: Base64Url;
  k_origin_pub: Base64Url;
  published_at: number;
  expires_at: number;
  replies_enabled: boolean;
}

/** Per spec §11 — public-form fetch (host already decrypted). */
export interface FetchPlaintextResponse {
  handle: Base64Url;
  body: string;
  k_origin_pub: Base64Url;
  published_at: number;
  expires_at: number;
  replies_enabled: boolean;
}

/** Per spec §13 — 410 Gone tombstone. */
export interface TombstoneResponse {
  status: "gone";
  reason: GoneReason;
  gone_at: string; // ISO-8601
}

/** Per spec §12 — DELETE /api/v1/wyrds/{handle} */
export interface DeleteRequest {
  delete_signature: Base64Url;
  delete_timestamp_ms: number;
}

export interface DeleteResponse {
  handle: Base64Url;
  gone_at: number;
  gone_reason: "burned";
}

/** Per spec §14 — replies. */
export interface SubmitReplyRequest {
  reply_blob: Base64Url;
  submit_timestamp_ms: number;
}

export interface SubmitReplyResponse {
  received_at: number;
}

export interface FetchRepliesResponse {
  handle: Base64Url;
  replies: Array<{
    reply_blob: Base64Url;
    received_at: number;
  }>;
}

/** Per spec §15 — HD recovery presence-check. */
export interface PresenceCheckResponse {
  k_origin_pub: Base64Url;
  handles: Array<{
    handle: Base64Url;
    published_at: number;
    expires_at: number;
    gone_at: number | null;
    gone_reason: GoneReason | null;
    replies_enabled: boolean;
  }>;
}

/** Per spec §17 — error response shape (besides tombstone). */
export interface ApiError {
  error: string;
  retry_after_seconds?: number;
}
