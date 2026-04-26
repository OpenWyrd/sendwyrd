import { describe, expect, it } from "vitest";
import { schnorr, secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2";
import {
  deleteMessage,
  fetchRepliesMessage,
  presenceCheckMessage,
  publishMessage,
  schnorrSign,
  schnorrVerify,
} from "../src/sign.js";

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

function makeHandle(seed = 0): Uint8Array {
  const h = new Uint8Array(12);
  for (let i = 0; i < 12; i++) h[i] = (seed + i * 7) & 0xff;
  return h;
}

function deterministicPriv(seed = 1): Uint8Array {
  // Build a 32-byte private key deterministically; reject if not in [1, n-1] (extremely unlikely with this construction).
  const priv = new Uint8Array(32);
  for (let i = 0; i < 32; i++) priv[i] = (seed + i * 17 + 1) & 0xff;
  return priv;
}

describe("sign — message-byte layout matches spec", () => {
  it("publishMessage = SHA-256('mop:v1:publish' || handle || envelope || ttl_be(8) || replies_enabled(1) || ts_be(8))", () => {
    const handle = makeHandle(1);
    const envelope = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
    const ttl_seconds = 90 * 86_400;
    const replies_enabled = false;
    const publish_timestamp_ms = 1_745_625_600_000;

    const expected = sha256(
      concat(
        enc.encode("mop:v1:publish"),
        handle,
        envelope,
        be8(ttl_seconds),
        new Uint8Array([replies_enabled ? 1 : 0]),
        be8(publish_timestamp_ms),
      ),
    );
    const actual = publishMessage({
      handle,
      envelope,
      ttl_seconds,
      replies_enabled,
      publish_timestamp_ms,
    });
    expect(actual.length).toBe(32);
    expect(actual).toEqual(expected);
  });

  it("publishMessage replies_enabled=true sets that byte to 1", () => {
    const handle = makeHandle(2);
    const envelope = new Uint8Array([0xaa]);
    const a = publishMessage({
      handle,
      envelope,
      ttl_seconds: 1,
      replies_enabled: false,
      publish_timestamp_ms: 1,
    });
    const b = publishMessage({
      handle,
      envelope,
      ttl_seconds: 1,
      replies_enabled: true,
      publish_timestamp_ms: 1,
    });
    expect(a).not.toEqual(b);
  });

  it("deleteMessage = SHA-256('mop:v1:delete' || handle || ts_be(8))", () => {
    const handle = makeHandle(3);
    const delete_timestamp_ms = 1_700_000_000_000;
    const expected = sha256(
      concat(enc.encode("mop:v1:delete"), handle, be8(delete_timestamp_ms)),
    );
    const actual = deleteMessage({ handle, delete_timestamp_ms });
    expect(actual).toEqual(expected);
    expect(actual.length).toBe(32);
  });

  it("fetchRepliesMessage = SHA-256('mop:v1:fetch_replies' || handle || ts_be(8))", () => {
    const handle = makeHandle(4);
    const fetch_timestamp_ms = 1_700_000_000_000;
    const expected = sha256(
      concat(enc.encode("mop:v1:fetch_replies"), handle, be8(fetch_timestamp_ms)),
    );
    const actual = fetchRepliesMessage({ handle, fetch_timestamp_ms });
    expect(actual).toEqual(expected);
  });

  it("presenceCheckMessage = SHA-256('mop:v1:presence_check' || k_origin_pub(33) || ts_be(8))", () => {
    const k_origin_pub = new Uint8Array(33);
    k_origin_pub[0] = 0x02; // SEC1 even-Y prefix
    for (let i = 1; i < 33; i++) k_origin_pub[i] = i;
    const presence_timestamp_ms = 1_700_000_000_000;
    const expected = sha256(
      concat(
        enc.encode("mop:v1:presence_check"),
        k_origin_pub,
        be8(presence_timestamp_ms),
      ),
    );
    const actual = presenceCheckMessage({ k_origin_pub, presence_timestamp_ms });
    expect(actual).toEqual(expected);
  });
});

describe("sign — Schnorr round-trip", () => {
  it("sign + verify with known keypair succeeds", () => {
    const priv = deterministicPriv(7);
    const xpub = schnorr.getPublicKey(priv); // 32-byte X-only

    const messageHash = sha256(enc.encode("test message"));
    const sig = schnorrSign(messageHash, priv);
    expect(sig.length).toBe(64);
    expect(schnorrVerify(sig, messageHash, xpub)).toBe(true);
  });

  it("verify rejects signature from a different key", () => {
    const priv1 = deterministicPriv(8);
    const priv2 = deterministicPriv(9);
    const xpub2 = schnorr.getPublicKey(priv2);

    const messageHash = sha256(enc.encode("attacker swapped"));
    const sig = schnorrSign(messageHash, priv1);
    expect(schnorrVerify(sig, messageHash, xpub2)).toBe(false);
  });

  it("verify rejects signature when the message was tampered", () => {
    const priv = deterministicPriv(10);
    const xpub = schnorr.getPublicKey(priv);

    const goodHash = sha256(enc.encode("the original"));
    const sig = schnorrSign(goodHash, priv);
    const tamperedHash = sha256(enc.encode("the original — tampered"));
    expect(schnorrVerify(sig, tamperedHash, xpub)).toBe(false);
  });

  it("verifies a publishMessage signature end-to-end", () => {
    const priv = deterministicPriv(11);
    const xpub = schnorr.getPublicKey(priv);

    const handle = makeHandle(11);
    const envelope = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const ts = 1_700_000_000_000;

    const m = publishMessage({
      handle,
      envelope,
      ttl_seconds: 60,
      replies_enabled: true,
      publish_timestamp_ms: ts,
    });
    const sig = schnorrSign(m, priv);
    expect(schnorrVerify(sig, m, xpub)).toBe(true);

    // Verify rejects when timestamp is tampered (a different ts hashes differently)
    const m2 = publishMessage({
      handle,
      envelope,
      ttl_seconds: 60,
      replies_enabled: true,
      publish_timestamp_ms: ts + 1,
    });
    expect(schnorrVerify(sig, m2, xpub)).toBe(false);
  });

  it("publishMessage signature breaks if envelope is tampered", () => {
    const priv = deterministicPriv(12);
    const xpub = schnorr.getPublicKey(priv);

    const handle = makeHandle(12);
    const envelopeOrig = new Uint8Array([0x01, 0x02, 0x03]);
    const envelopeTamp = new Uint8Array([0x01, 0x02, 0x04]);
    const ts = 1_700_000_000_000;

    const m_orig = publishMessage({
      handle,
      envelope: envelopeOrig,
      ttl_seconds: 60,
      replies_enabled: false,
      publish_timestamp_ms: ts,
    });
    const sig = schnorrSign(m_orig, priv);

    const m_tamp = publishMessage({
      handle,
      envelope: envelopeTamp,
      ttl_seconds: 60,
      replies_enabled: false,
      publish_timestamp_ms: ts,
    });
    expect(schnorrVerify(sig, m_tamp, xpub)).toBe(false);
  });

  it("ECDSA-on-secp256k1 keypair is consistent with Schnorr X-only", () => {
    // Sanity: X-only pubkey is the X coordinate of the SEC1-compressed pubkey.
    const priv = deterministicPriv(13);
    const compressed = secp256k1.getPublicKey(priv, true); // 33 bytes
    const xpub = schnorr.getPublicKey(priv); // 32 bytes
    expect(compressed.length).toBe(33);
    expect(xpub.length).toBe(32);
    expect(xpub).toEqual(compressed.slice(1));
  });
});
