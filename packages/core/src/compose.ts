/**
 * End-to-end client compose pipeline.
 *
 * NOTE: This implementation supersedes spec_mop_v1.md §7/§9 in one detail —
 * the client GENERATES the handle (12 random bytes) rather than letting the
 * server issue it. Reason: the AAD per §7.2 binds the ciphertext to the
 * handle, but a server-issued handle creates a chicken-and-egg problem (the
 * client can't encrypt without knowing the handle, and the server can't issue
 * the handle without seeing the encrypted payload). Client-generated handles
 * with server-side collision rejection at 96-bit entropy is operationally
 * indistinguishable from server-generated. Spec doc will be amended.
 *
 * publish_message hash also includes the handle (was: not included).
 */

import {
  HANDLE_BYTES,
  BODY_CODEPOINT_CAP,
  PERMANENT_EXPIRES_AT_MS,
  type Base64Url,
} from "./types.js";
import { b64uEncode, b64uDecode } from "./encoding.js";
import { encryptEnvelope } from "./envelope.js";
import { deriveOriginKey, deriveReadKey, type OriginKeyPair } from "./hd.js";
import { publishMessage, schnorrSign } from "./sign.js";

export interface ComposeArgs {
  /** UTF-8 plaintext body, codepoint count enforced by this function. */
  plaintext: string;
  /** 64-byte BIP-39 seed. */
  seed: Uint8Array;
  /** HD index `n` to consume. */
  n: number;
  /** TTL in seconds. Server clamps to [1, 31_536_000]. */
  ttl_seconds: number;
  /** Whether replies are accepted. */
  replies_enabled: boolean;
  /** Override clock for testing; defaults to Date.now(). */
  now_ms?: number;
}

export interface ComposeResult {
  handle: Base64Url;
  k_read: Uint8Array;
  k_read_b64u: Base64Url;
  k_origin: OriginKeyPair;
  publish_payload: PublishPayload;
  publish_timestamp_ms: number;
  expires_at_ms: number;
}

export interface PublishPayload {
  handle: Base64Url;
  envelope: Base64Url;
  k_origin_pub: Base64Url;
  ttl_seconds: number;
  replies_enabled: boolean;
  publish_signature: Base64Url;
  publish_timestamp_ms: number;
}

/**
 * Compose, encrypt, sign, and produce the publish payload for a wyrd.
 *
 * Counts codepoints (not bytes), enforces ≤ BODY_CODEPOINT_CAP. The caller
 * persists `next_n = n + 1` regardless of publish success/failure (per spec
 * §5.2 — index is consumed even on failure).
 */
export async function composeWyrd(args: ComposeArgs): Promise<ComposeResult> {
  const codepointCount = countCodepoints(args.plaintext);
  if (codepointCount > BODY_CODEPOINT_CAP) {
    throw new Error(
      `body exceeds ${BODY_CODEPOINT_CAP} codepoints (${codepointCount})`,
    );
  }
  if (codepointCount === 0) {
    throw new Error("body is empty");
  }
  if (args.ttl_seconds < 0 || args.ttl_seconds > 31_536_000) {
    throw new Error("ttl_seconds out of range");
  }

  const k_origin = deriveOriginKey(args.seed, args.n);

  const handleBytes = crypto.getRandomValues(new Uint8Array(HANDLE_BYTES));
  const handle = b64uEncode(handleBytes);

  const k_read = deriveReadKey(args.seed, args.n);
  const k_read_b64u = b64uEncode(k_read);

  const publish_timestamp_ms = args.now_ms ?? Date.now();
  // ttl_seconds === 0 is the sentinel for "permanent" — both client and
  // server use PERMANENT_EXPIRES_AT_MS for the AAD-bound expiry.
  const expires_at_ms =
    args.ttl_seconds === 0
      ? PERMANENT_EXPIRES_AT_MS
      : publish_timestamp_ms + args.ttl_seconds * 1000;

  const envelope = await encryptEnvelope({
    plaintext: args.plaintext,
    k_read,
    handle: handleBytes,
    expires_at_ms,
    replies_enabled: args.replies_enabled,
  });

  // Updated publish_message: SHA-256 of "mop:v1:publish" || handle || envelope
  // || ttl_seconds_be || replies_enabled || ts_be.
  const messageHash = publishMessage({
    handle: handleBytes,
    envelope,
    ttl_seconds: args.ttl_seconds,
    replies_enabled: args.replies_enabled,
    publish_timestamp_ms,
  });

  if (!k_origin.k_origin_priv) {
    throw new Error("HD derivation produced no private key");
  }
  const signature = schnorrSign(messageHash, k_origin.k_origin_priv);

  const publish_payload: PublishPayload = {
    handle,
    envelope: b64uEncode(envelope),
    k_origin_pub: b64uEncode(k_origin.k_origin_pub),
    ttl_seconds: args.ttl_seconds,
    replies_enabled: args.replies_enabled,
    publish_signature: b64uEncode(signature),
    publish_timestamp_ms,
  };

  return {
    handle,
    k_read,
    k_read_b64u,
    k_origin,
    publish_payload,
    publish_timestamp_ms,
    expires_at_ms,
  };
}

/**
 * Count Unicode codepoints in a string (matches the server-side counting per
 * spec §8.2). Uses for...of which iterates by codepoint.
 */
export function countCodepoints(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/** For decrypting fragment-form fetch responses. */
export { decryptEnvelope, decryptFromBase64Url } from "./envelope.js";
export { b64uDecode };
