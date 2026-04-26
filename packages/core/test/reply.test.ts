import { describe, expect, it } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { decryptReply, encryptReply, REPLY_VERSION } from "../src/reply.js";
import { HANDLE_BYTES, K_ORIGIN_PUB_BYTES } from "../src/types.js";

const enc = new TextEncoder();

function makeHandle(seed = 0): Uint8Array {
  const h = new Uint8Array(HANDLE_BYTES);
  for (let i = 0; i < HANDLE_BYTES; i++) h[i] = (seed + i * 7) & 0xff;
  return h;
}

function deterministicAuthorPriv(seed = 1): Uint8Array {
  const priv = new Uint8Array(32);
  for (let i = 0; i < 32; i++) priv[i] = (seed + i * 17 + 1) & 0xff;
  return priv;
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

describe("reply — ECIES round-trip", () => {
  it("author can decrypt their own reply blob", async () => {
    const k_origin_priv = deterministicAuthorPriv(1);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    const handle = makeHandle(1);
    const plaintext = "hi there, anonymous reply";

    const blob = await encryptReply({
      plaintext,
      handle,
      k_origin_pub,
    });
    expect(blob[0]).toBe(REPLY_VERSION);
    expect(blob.length).toBeGreaterThan(1 + 33 + 16);

    const out = await decryptReply({
      blob,
      handle,
      k_origin_priv,
    });
    expect(out).toBe(plaintext);
  });

  it("blob layout is ver(1) || e_pub(33) || ciphertext || tag", async () => {
    const k_origin_priv = deterministicAuthorPriv(2);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    const handle = makeHandle(2);

    const blob = await encryptReply({
      plaintext: "abc",
      handle,
      k_origin_pub,
    });
    expect(blob[0]).toBe(REPLY_VERSION);
    // e_pub is at bytes 1..34, must start with 0x02 or 0x03 (SEC1 compressed)
    expect(blob[1] === 0x02 || blob[1] === 0x03).toBe(true);
    // 3-byte plaintext + 16-byte tag = 19 bytes after e_pub
    expect(blob.length).toBe(1 + 33 + 3 + 16);
  });

  it("two encryptions of the same plaintext produce different blobs (random ephemeral)", async () => {
    const k_origin_priv = deterministicAuthorPriv(3);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    const handle = makeHandle(3);

    const a = await encryptReply({
      plaintext: "same input",
      handle,
      k_origin_pub,
    });
    const b = await encryptReply({
      plaintext: "same input",
      handle,
      k_origin_pub,
    });
    expect(a).not.toEqual(b);
    // e_pub differs
    expect(a.slice(1, 34)).not.toEqual(b.slice(1, 34));
  });
});

describe("reply — HKDF info string format", () => {
  it("matches the spec: 'mop:v1:reply:aes_key:' || handle || e_pub", async () => {
    // Strategy: encrypt a reply, extract e_pub from the blob, then
    // independently re-derive aes_key + iv using the documented info strings,
    // re-decrypt the ciphertext via Web Crypto, and confirm the plaintext.
    const k_origin_priv = deterministicAuthorPriv(4);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    const handle = makeHandle(4);
    const plaintext = "hkdf-info-string-check";

    const blob = await encryptReply({
      plaintext,
      handle,
      k_origin_pub,
    });
    const e_pub = blob.slice(1, 34);
    const ciphertextWithTag = blob.slice(34);

    // Independently compute shared.X via author priv + ephemeral pub.
    const sharedFull = secp256k1.getSharedSecret(k_origin_priv, e_pub, true);
    const shared = sharedFull.slice(1); // 32-byte X coordinate

    // Re-derive AES key + IV using the spec info strings.
    const aesInfo = concat(enc.encode("mop:v1:reply:aes_key:"), handle, e_pub);
    const ivInfo = concat(enc.encode("mop:v1:reply:iv:"), handle, e_pub);
    const aesKey = hkdf(sha256, shared, new Uint8Array(0), aesInfo, 32);
    const iv = hkdf(sha256, shared, new Uint8Array(0), ivInfo, 12);

    // Decrypt independently. Coerce Uint8Array to ArrayBuffer-backed view at the Web Crypto boundary
    // (TS 5.7+ requires this; matches the source's bufferSource helper).
    const aad = concat(new Uint8Array([REPLY_VERSION]), handle, e_pub);
    const toAB = (u: Uint8Array): ArrayBuffer => {
      const ab = new ArrayBuffer(u.byteLength);
      new Uint8Array(ab).set(u);
      return ab;
    };
    const key = await crypto.subtle.importKey(
      "raw",
      toAB(aesKey),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const decrypted = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: toAB(iv),
          additionalData: toAB(aad),
          tagLength: 128,
        },
        key,
        toAB(ciphertextWithTag),
      ),
    );
    expect(new TextDecoder().decode(decrypted)).toBe(plaintext);
  });
});

describe("reply — AAD binding (spec §14.4)", () => {
  it("decryption fails when handle is wrong (AAD mismatch)", async () => {
    const k_origin_priv = deterministicAuthorPriv(10);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    const handle = makeHandle(10);

    const blob = await encryptReply({
      plaintext: "bound to handle",
      handle,
      k_origin_pub,
    });
    const wrongHandle = makeHandle(99);
    await expect(
      decryptReply({ blob, handle: wrongHandle, k_origin_priv }),
    ).rejects.toBeDefined();
  });
});

describe("reply — tamper detection", () => {
  it("decryption fails on tampered ciphertext", async () => {
    const k_origin_priv = deterministicAuthorPriv(20);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    const handle = makeHandle(20);

    const blob = await encryptReply({
      plaintext: "tamper me",
      handle,
      k_origin_pub,
    });
    const tampered = new Uint8Array(blob);
    // Flip a byte after e_pub (in ciphertext region)
    tampered[1 + 33 + 1] = tampered[1 + 33 + 1]! ^ 0x01;
    await expect(
      decryptReply({ blob: tampered, handle, k_origin_priv }),
    ).rejects.toBeDefined();
  });

  it("decryption fails on tampered tag", async () => {
    const k_origin_priv = deterministicAuthorPriv(21);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    const handle = makeHandle(21);

    const blob = await encryptReply({
      plaintext: "tag tamper",
      handle,
      k_origin_pub,
    });
    const tampered = new Uint8Array(blob);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0x40;
    await expect(
      decryptReply({ blob: tampered, handle, k_origin_priv }),
    ).rejects.toBeDefined();
  });

  it("decryption fails on tampered e_pub (yields wrong shared secret)", async () => {
    const k_origin_priv = deterministicAuthorPriv(22);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    const handle = makeHandle(22);

    const blob = await encryptReply({
      plaintext: "e_pub tamper",
      handle,
      k_origin_pub,
    });
    const tampered = new Uint8Array(blob);
    // Flip a byte inside e_pub. Note: this MIGHT yield an invalid point —
    // either way, decryption must fail (either via validation throw or AAD mismatch).
    tampered[5] = tampered[5]! ^ 0x10;
    await expect(
      decryptReply({ blob: tampered, handle, k_origin_priv }),
    ).rejects.toBeDefined();
  });
});

describe("reply — wrong author key", () => {
  it("decryption fails when wrong author priv key is used", async () => {
    const k_origin_priv = deterministicAuthorPriv(30);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    const handle = makeHandle(30);

    const blob = await encryptReply({
      plaintext: "wrong key test",
      handle,
      k_origin_pub,
    });
    const otherPriv = deterministicAuthorPriv(31);
    await expect(
      decryptReply({ blob, handle, k_origin_priv: otherPriv }),
    ).rejects.toBeDefined();
  });
});

describe("reply — input validation", () => {
  it("encryptReply rejects wrong-length handle", async () => {
    const k_origin_priv = deterministicAuthorPriv(40);
    const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true);
    await expect(
      encryptReply({
        plaintext: "x",
        handle: new Uint8Array(11),
        k_origin_pub,
      }),
    ).rejects.toThrow(/handle/);
  });

  it("encryptReply rejects wrong-length k_origin_pub", async () => {
    await expect(
      encryptReply({
        plaintext: "x",
        handle: makeHandle(),
        k_origin_pub: new Uint8Array(32),
      }),
    ).rejects.toThrow(/k_origin_pub/);
  });

  it("decryptReply rejects too-short blob", async () => {
    await expect(
      decryptReply({
        blob: new Uint8Array(5),
        handle: makeHandle(),
        k_origin_priv: deterministicAuthorPriv(42),
      }),
    ).rejects.toThrow(/too short/);
  });

  it("decryptReply rejects unsupported version byte", async () => {
    const blob = new Uint8Array(1 + 33 + 16);
    blob[0] = 0x99;
    await expect(
      decryptReply({
        blob,
        handle: makeHandle(),
        k_origin_priv: deterministicAuthorPriv(43),
      }),
    ).rejects.toThrow(/version unsupported/);
  });

  it("K_ORIGIN_PUB_BYTES is 33 (SEC1 compressed)", () => {
    expect(K_ORIGIN_PUB_BYTES).toBe(33);
  });
});
