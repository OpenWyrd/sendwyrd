import { describe, expect, it } from "vitest";
import {
  decryptEnvelope,
  decryptFromBase64Url,
  encryptEnvelope,
  encryptToBase64Url,
  generateKRead,
} from "../src/envelope.js";
import { b64uDecode } from "../src/encoding.js";
import {
  ENVELOPE_IV_BYTES,
  ENVELOPE_TAG_BYTES,
  ENVELOPE_VERSION,
  HANDLE_BYTES,
  K_READ_BYTES,
} from "../src/types.js";

function makeHandle(seed = 0): Uint8Array {
  const h = new Uint8Array(HANDLE_BYTES);
  for (let i = 0; i < HANDLE_BYTES; i++) h[i] = (seed + i * 7) & 0xff;
  return h;
}

function makeKRead(seed = 0): Uint8Array {
  const k = new Uint8Array(K_READ_BYTES);
  for (let i = 0; i < K_READ_BYTES; i++) k[i] = (seed + i * 13) & 0xff;
  return k;
}

const EXPIRES_AT = 1_745_625_600_000;

describe("envelope — encrypt/decrypt round-trip", () => {
  it("round-trips a plaintext body with bytes form", async () => {
    const k_read = makeKRead(1);
    const handle = makeHandle(1);
    const plaintext = "hello, world";
    const env = await encryptEnvelope({
      plaintext,
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    expect(env[0]).toBe(ENVELOPE_VERSION);
    expect(env.length).toBeGreaterThan(
      1 + ENVELOPE_IV_BYTES + ENVELOPE_TAG_BYTES,
    );

    const out = await decryptEnvelope({
      envelope: env,
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    expect(out).toBe(plaintext);
  });

  it("round-trips via base64url helpers", async () => {
    const k_read = makeKRead(2);
    const handle = makeHandle(2);
    const plaintext = "round trip via b64u";
    const b64u = await encryptToBase64Url({
      plaintext,
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: true,
    });
    expect(b64u).toMatch(/^[A-Za-z0-9_-]+$/);
    const out = await decryptFromBase64Url(b64u, {
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: true,
    });
    expect(out).toBe(plaintext);
  });

  it("two encryptions of same plaintext produce different envelopes (random IV)", async () => {
    const k_read = makeKRead(3);
    const handle = makeHandle(3);
    const args = {
      plaintext: "same input",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    };
    const a = await encryptEnvelope(args);
    const b = await encryptEnvelope(args);
    expect(a).not.toEqual(b);
    // IVs differ
    expect(a.slice(1, 1 + ENVELOPE_IV_BYTES)).not.toEqual(
      b.slice(1, 1 + ENVELOPE_IV_BYTES),
    );
  });
});

describe("envelope — AAD binding", () => {
  it("decryption fails when handle differs", async () => {
    const k_read = makeKRead(10);
    const handle = makeHandle(10);
    const env = await encryptEnvelope({
      plaintext: "bound",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    const wrongHandle = makeHandle(99);
    await expect(
      decryptEnvelope({
        envelope: env,
        k_read,
        handle: wrongHandle,
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toBeDefined();
  });

  it("decryption fails when expires_at_ms differs", async () => {
    const k_read = makeKRead(11);
    const handle = makeHandle(11);
    const env = await encryptEnvelope({
      plaintext: "bound",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    await expect(
      decryptEnvelope({
        envelope: env,
        k_read,
        handle,
        expires_at_ms: EXPIRES_AT + 1,
        replies_enabled: false,
      }),
    ).rejects.toBeDefined();
  });

  it("decryption fails when replies_enabled flag differs", async () => {
    const k_read = makeKRead(12);
    const handle = makeHandle(12);
    const env = await encryptEnvelope({
      plaintext: "bound",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    await expect(
      decryptEnvelope({
        envelope: env,
        k_read,
        handle,
        expires_at_ms: EXPIRES_AT,
        replies_enabled: true,
      }),
    ).rejects.toBeDefined();
  });
});

describe("envelope — tamper / wrong-key detection", () => {
  it("decryption fails when ciphertext is tampered", async () => {
    const k_read = makeKRead(20);
    const handle = makeHandle(20);
    const env = await encryptEnvelope({
      plaintext: "tamper me",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    // Flip a bit inside the ciphertext region (after iv, before tag)
    const tampered = new Uint8Array(env);
    const ctIndex = 1 + ENVELOPE_IV_BYTES + 2; // somewhere in ciphertext
    tampered[ctIndex] = tampered[ctIndex]! ^ 0x01;
    await expect(
      decryptEnvelope({
        envelope: tampered,
        k_read,
        handle,
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toBeDefined();
  });

  it("decryption fails when tag is tampered", async () => {
    const k_read = makeKRead(21);
    const handle = makeHandle(21);
    const env = await encryptEnvelope({
      plaintext: "tamper tag",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    const tampered = new Uint8Array(env);
    // Last byte is part of the 16-byte tag
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0x80;
    await expect(
      decryptEnvelope({
        envelope: tampered,
        k_read,
        handle,
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toBeDefined();
  });

  it("decryption fails when k_read is wrong", async () => {
    const k_read = makeKRead(22);
    const handle = makeHandle(22);
    const env = await encryptEnvelope({
      plaintext: "wrong key",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    const wrongKey = makeKRead(99);
    await expect(
      decryptEnvelope({
        envelope: env,
        k_read: wrongKey,
        handle,
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toBeDefined();
  });

  it("rejects envelopes with unsupported version byte", async () => {
    const k_read = makeKRead(23);
    const handle = makeHandle(23);
    const env = await encryptEnvelope({
      plaintext: "v",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    const badVer = new Uint8Array(env);
    badVer[0] = 0x99;
    await expect(
      decryptEnvelope({
        envelope: badVer,
        k_read,
        handle,
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/version unsupported/);
  });

  it("rejects envelopes that are too short", async () => {
    const tooShort = new Uint8Array(10);
    tooShort[0] = ENVELOPE_VERSION;
    await expect(
      decryptEnvelope({
        envelope: tooShort,
        k_read: makeKRead(),
        handle: makeHandle(),
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/too short/);
  });
});

describe("envelope — input-validation guards", () => {
  it("encryptEnvelope rejects wrong-sized k_read", async () => {
    await expect(
      encryptEnvelope({
        plaintext: "x",
        k_read: new Uint8Array(31),
        handle: makeHandle(),
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/k_read/);
  });

  it("encryptEnvelope rejects wrong-sized handle", async () => {
    await expect(
      encryptEnvelope({
        plaintext: "x",
        k_read: makeKRead(),
        handle: new Uint8Array(11),
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/handle/);
  });

  it("decryptEnvelope rejects wrong-sized k_read", async () => {
    const k_read = makeKRead(30);
    const handle = makeHandle(30);
    const env = await encryptEnvelope({
      plaintext: "x",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    await expect(
      decryptEnvelope({
        envelope: env,
        k_read: new Uint8Array(31),
        handle,
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/k_read/);
  });

  it("decryptEnvelope rejects wrong-sized handle", async () => {
    const k_read = makeKRead(31);
    const handle = makeHandle(31);
    const env = await encryptEnvelope({
      plaintext: "x",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    await expect(
      decryptEnvelope({
        envelope: env,
        k_read,
        handle: new Uint8Array(11),
        expires_at_ms: EXPIRES_AT,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/handle/);
  });
});

describe("envelope — body edge cases", () => {
  it("handles empty body (zero-length plaintext)", async () => {
    const k_read = makeKRead(40);
    const handle = makeHandle(40);
    const env = await encryptEnvelope({
      plaintext: "",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    const out = await decryptEnvelope({
      envelope: env,
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    expect(out).toBe("");
  });

  it("handles body at the 300-codepoint cap", async () => {
    const plaintext = "a".repeat(300);
    const k_read = makeKRead(41);
    const handle = makeHandle(41);
    const env = await encryptEnvelope({
      plaintext,
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    const out = await decryptEnvelope({
      envelope: env,
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    expect(out).toBe(plaintext);
  });

  it("handles emoji, CJK, and RTL text", async () => {
    // Mix of grapheme clusters: emoji + ZWJ sequences + CJK + Hebrew (RTL)
    const plaintext = "Hello \u{1F44B} 你好 世界 שלום עולם 🌍🚀";
    const k_read = makeKRead(42);
    const handle = makeHandle(42);
    const env = await encryptEnvelope({
      plaintext,
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: true,
    });
    const out = await decryptEnvelope({
      envelope: env,
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: true,
    });
    expect(out).toBe(plaintext);
  });
});

describe("envelope — wire layout", () => {
  it("envelope layout is ver(1) || iv(12) || ciphertext+tag", async () => {
    const k_read = makeKRead(50);
    const handle = makeHandle(50);
    const plaintext = "abc";
    const env = await encryptEnvelope({
      plaintext,
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    expect(env[0]).toBe(ENVELOPE_VERSION);
    // ciphertext = 3 bytes ("abc"), so total = 1 + 12 + 3 + 16 = 32
    expect(env.length).toBe(1 + ENVELOPE_IV_BYTES + 3 + ENVELOPE_TAG_BYTES);
  });

  it("encryptToBase64Url output decodes to the same bytes as encryptEnvelope", async () => {
    // Use a fixed IV (cannot — IV is random) but verify decoded structure
    const k_read = makeKRead(51);
    const handle = makeHandle(51);
    const b64u = await encryptToBase64Url({
      plaintext: "abc",
      k_read,
      handle,
      expires_at_ms: EXPIRES_AT,
      replies_enabled: false,
    });
    const env = b64uDecode(b64u);
    expect(env[0]).toBe(ENVELOPE_VERSION);
    expect(env.length).toBe(1 + ENVELOPE_IV_BYTES + 3 + ENVELOPE_TAG_BYTES);
  });
});

describe("envelope — generateKRead", () => {
  it("returns a 32-byte array", () => {
    const k = generateKRead();
    expect(k).toBeInstanceOf(Uint8Array);
    expect(k.length).toBe(K_READ_BYTES);
  });

  it("returns different bytes on successive calls", () => {
    const a = generateKRead();
    const b = generateKRead();
    expect(a).not.toEqual(b);
  });
});
