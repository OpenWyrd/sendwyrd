/**
 * BIP-340 Schnorr signing per spec_mop_v1.md §9.2 / §12.2 / §14.2 / §15.2.
 *
 * publish_message := SHA-256("mop:v1:publish" || envelope || ttl_be(8) || replies_enabled(1) || ts_be(8))
 * delete_message  := SHA-256("mop:v1:delete"  || handle(12) || ts_be(8))
 * fetch_replies   := SHA-256("mop:v1:fetch_replies" || handle(12) || ts_be(8))
 * presence_check  := SHA-256("mop:v1:presence_check" || k_origin_pub(33) || ts_be(8))
 */

import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2";

const enc = new TextEncoder();

function be8(n: number | bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(n), false);
  return new Uint8Array(buf);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

export function publishMessage(args: {
  /** 12-byte client-generated handle. */
  handle: Uint8Array;
  envelope: Uint8Array;
  ttl_seconds: number;
  replies_enabled: boolean;
  publish_timestamp_ms: number;
}): Uint8Array {
  const m = concat(
    enc.encode("mop:v1:publish"),
    args.handle,
    args.envelope,
    be8(args.ttl_seconds),
    new Uint8Array([args.replies_enabled ? 1 : 0]),
    be8(args.publish_timestamp_ms),
  );
  return sha256(m);
}

export function deleteMessage(args: {
  handle: Uint8Array;
  delete_timestamp_ms: number;
}): Uint8Array {
  const m = concat(
    enc.encode("mop:v1:delete"),
    args.handle,
    be8(args.delete_timestamp_ms),
  );
  return sha256(m);
}

export function fetchRepliesMessage(args: {
  handle: Uint8Array;
  fetch_timestamp_ms: number;
}): Uint8Array {
  const m = concat(
    enc.encode("mop:v1:fetch_replies"),
    args.handle,
    be8(args.fetch_timestamp_ms),
  );
  return sha256(m);
}

export function presenceCheckMessage(args: {
  k_origin_pub: Uint8Array;
  presence_timestamp_ms: number;
}): Uint8Array {
  const m = concat(
    enc.encode("mop:v1:presence_check"),
    args.k_origin_pub,
    be8(args.presence_timestamp_ms),
  );
  return sha256(m);
}

/**
 * Sign a 32-byte message hash with BIP-340 Schnorr.
 * Returns 64-byte signature.
 */
export function schnorrSign(messageHash: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return schnorr.sign(messageHash, privateKey);
}

/**
 * Verify a 64-byte BIP-340 Schnorr signature against a 32-byte X-only pubkey.
 */
export function schnorrVerify(
  signature: Uint8Array,
  messageHash: Uint8Array,
  xOnlyPubkey: Uint8Array,
): boolean {
  return schnorr.verify(signature, messageHash, xOnlyPubkey);
}
