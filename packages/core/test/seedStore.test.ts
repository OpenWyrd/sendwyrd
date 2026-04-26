import { describe, expect, it } from "vitest";
import {
  decryptSeedRecord,
  DEFAULT_PBKDF2_ITERATIONS,
  encryptSeedRecord,
  generateSeed,
  SEED_BYTES,
  SEED_STORE_VERSION,
} from "../src/seedStore.js";
import { isValidMnemonic } from "../src/hd.js";
import { b64uDecode } from "../src/encoding.js";

const FAST_ITERATIONS = 1000; // PBKDF2 is intentionally slow; speed up tests.

describe("seedStore — generateSeed", () => {
  it("generates a 12-word valid BIP-39 mnemonic by default", () => {
    const { mnemonic, seed } = generateSeed();
    expect(mnemonic.split(/\s+/).length).toBe(12);
    expect(isValidMnemonic(mnemonic)).toBe(true);
    expect(seed.length).toBe(SEED_BYTES);
  });

  it("generates a 24-word mnemonic when requested", () => {
    const { mnemonic, seed } = generateSeed(24);
    expect(mnemonic.split(/\s+/).length).toBe(24);
    expect(isValidMnemonic(mnemonic)).toBe(true);
    expect(seed.length).toBe(SEED_BYTES);
  });

  it("emits different mnemonics on successive calls", () => {
    const a = generateSeed().mnemonic;
    const b = generateSeed().mnemonic;
    expect(a).not.toBe(b);
  });
});

describe("seedStore — encrypt / decrypt round-trip", () => {
  it("round-trips seed + counter under a known passphrase", async () => {
    const { mnemonic, seed } = generateSeed();
    const counter = 42;

    const recordB64u = await encryptSeedRecord({
      seed,
      counter,
      mnemonic,
      passphrase: "correct horse battery staple",
      iterations: FAST_ITERATIONS,
    });
    expect(recordB64u).toMatch(/^[A-Za-z0-9_-]+$/);

    const out = await decryptSeedRecord(
      recordB64u,
      "correct horse battery staple",
    );
    expect(out.seed).toEqual(seed);
    expect(out.counter).toBe(counter);
    expect(out.mnemonic).toBe(mnemonic);
  });

  it("decryption fails with wrong passphrase", async () => {
    const { seed } = generateSeed();
    const recordB64u = await encryptSeedRecord({
      seed,
      counter: 0,
      passphrase: "right",
      iterations: FAST_ITERATIONS,
    });
    await expect(decryptSeedRecord(recordB64u, "wrong")).rejects.toBeDefined();
  });

  it("rejects records that are too short", async () => {
    const stub = "AAAA"; // way too short
    await expect(decryptSeedRecord(stub, "x")).rejects.toThrow(/too short/);
  });

  it("rejects unsupported version byte", async () => {
    // Construct a valid-length record header but with bogus version.
    const buf = new Uint8Array(1 + 16 + 12 + 4 + 16);
    buf[0] = 0x99;
    // base64url-encode without padding
    const std = btoa(String.fromCharCode(...buf));
    const b64u = std.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    await expect(decryptSeedRecord(b64u, "x")).rejects.toThrow(
      /version unsupported/,
    );
  });

  it("rejects seed of wrong length on encrypt", async () => {
    await expect(
      encryptSeedRecord({
        seed: new Uint8Array(32),
        counter: 0,
        passphrase: "x",
        iterations: FAST_ITERATIONS,
      }),
    ).rejects.toThrow(/seed/);
  });

  it("rejects negative counter on encrypt", async () => {
    const { seed } = generateSeed();
    await expect(
      encryptSeedRecord({
        seed,
        counter: -1,
        passphrase: "x",
        iterations: FAST_ITERATIONS,
      }),
    ).rejects.toThrow(/counter/);
  });

  it("rejects non-integer counter on encrypt", async () => {
    const { seed } = generateSeed();
    await expect(
      encryptSeedRecord({
        seed,
        counter: 1.5,
        passphrase: "x",
        iterations: FAST_ITERATIONS,
      }),
    ).rejects.toThrow(/counter/);
  });
});

describe("seedStore — record layout (V2)", () => {
  it("first byte is the version, then 16 bytes salt, 12 bytes iv, 4 bytes iterations", async () => {
    const { seed } = generateSeed();
    const iterations = FAST_ITERATIONS;
    const recordB64u = await encryptSeedRecord({
      seed,
      counter: 0,
      passphrase: "p",
      iterations,
    });
    const record = b64uDecode(recordB64u);
    expect(record[0]).toBe(SEED_STORE_VERSION);
    // Iterations big-endian uint32 at offset 1+16+12 = 29.
    const view = new DataView(record.buffer, record.byteOffset + 29, 4);
    expect(view.getUint32(0, false)).toBe(iterations);
  });
});

describe("seedStore — constants", () => {
  it("DEFAULT_PBKDF2_ITERATIONS is at the OWASP 2024 floor (≥600,000)", () => {
    expect(DEFAULT_PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });
});
