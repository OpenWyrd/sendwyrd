/**
 * seedClient — browser-side seed management.
 *
 * Verifies open-mode round-trip, passphrase promotion, wrong-passphrase
 * rejection, atomic counter increment, and full wipe.
 *
 * Uses real WebCrypto (Node 22 / jsdom both expose globalThis.crypto.subtle).
 * No fake crypto here — the round-trip is the test.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeNextIndex,
  forgetSeed,
  getMnemonic,
  getSeed,
  getSeedMode,
  hasSeed,
  isUnlocked,
  protectWithPassphrase,
  storeOpenSeed,
  storeProtectedSeed,
  unlockSeed,
} from "@/lib/seedClient";

// Reset both localStorage and the module-level memory cache between tests.
// (global setup.ts clears localStorage but seedClient also has an in-memory
// `cached` SeedAndCounter; forgetSeed() clears both.)
beforeEach(() => {
  forgetSeed();
});

const SEED_BYTES = 64;

function makeSeed(fill = 0xab): Uint8Array {
  const s = new Uint8Array(SEED_BYTES);
  s.fill(fill);
  return s;
}

describe("seedClient — open mode", () => {
  it("storeOpenSeed + getSeed round-trip", () => {
    const seed = makeSeed(0x11);
    storeOpenSeed({ seed, counter: 3, mnemonic: "abandon ability about" });
    const got = getSeed();
    expect(got).not.toBeNull();
    expect(got?.counter).toBe(3);
    expect(got?.mnemonic).toBe("abandon ability about");
    expect(Array.from(got!.seed)).toEqual(Array.from(seed));
  });

  it("getSeedMode reports 'open'", () => {
    storeOpenSeed({ seed: makeSeed(), counter: 0, mnemonic: undefined });
    expect(getSeedMode()).toBe("open");
    expect(hasSeed()).toBe(true);
    expect(isUnlocked()).toBe(true);
  });

  it("getSeedMode reports null when no seed exists", () => {
    expect(getSeedMode()).toBeNull();
    expect(hasSeed()).toBe(false);
    expect(getSeed()).toBeNull();
  });

  it("getMnemonic returns the persisted mnemonic", () => {
    storeOpenSeed({ seed: makeSeed(), counter: 0, mnemonic: "twelve words here" });
    expect(getMnemonic()).toBe("twelve words here");
  });
});

describe("seedClient — protected mode", () => {
  it("storeProtectedSeed encrypts the seed; unlockSeed recovers it", async () => {
    const seed = makeSeed(0x22);
    await storeProtectedSeed({
      seed,
      counter: 7,
      mnemonic: "secret words go here",
      passphrase: "correct horse battery staple",
    });
    expect(getSeedMode()).toBe("protected");

    // The cached unlocked seed is available immediately after store.
    const cachedSeed = getSeed();
    expect(cachedSeed?.counter).toBe(7);

    // Stored ciphertext is NOT the plaintext seed.
    const raw = localStorage.getItem("sendwyrd:seed:v1");
    expect(raw).not.toBeNull();
    expect(raw).not.toContain(Buffer.from(seed).toString("base64"));

    // Unlocking with the correct passphrase yields the same seed bytes.
    const unlocked = await unlockSeed("correct horse battery staple");
    expect(unlocked.counter).toBe(7);
    expect(Array.from(unlocked.seed)).toEqual(Array.from(seed));
    expect(unlocked.mnemonic).toBe("secret words go here");
  });

  it("unlockSeed throws on wrong passphrase", async () => {
    await storeProtectedSeed({
      seed: makeSeed(0x33),
      counter: 0,
      passphrase: "right-pp",
    });
    await expect(unlockSeed("wrong-pp")).rejects.toThrow();
  });

  it("unlockSeed throws when no protected seed exists", async () => {
    await expect(unlockSeed("anything")).rejects.toThrow(/no_protected_seed/);
  });
});

describe("seedClient — protectWithPassphrase (open → protected)", () => {
  it("encrypts an existing open-mode seed under a passphrase", async () => {
    const seed = makeSeed(0x44);
    storeOpenSeed({ seed, counter: 5, mnemonic: "m1 m2 m3" });
    await protectWithPassphrase("a-good-pp");

    expect(getSeedMode()).toBe("protected");
    expect(localStorage.getItem("sendwyrd:open_seed:v1")).toBeNull();

    // Round-trip through unlock.
    const recovered = await unlockSeed("a-good-pp");
    expect(recovered.counter).toBe(5);
    expect(recovered.mnemonic).toBe("m1 m2 m3");
  });

  it("rejects passphrases shorter than 8 chars", async () => {
    storeOpenSeed({ seed: makeSeed(), counter: 0 });
    await expect(protectWithPassphrase("tiny")).rejects.toThrow(/passphrase_too_short/);
  });

  it("throws when no seed exists", async () => {
    await expect(protectWithPassphrase("a-good-pp")).rejects.toThrow(/no_seed/);
  });
});

describe("seedClient — consumeNextIndex", () => {
  it("returns current counter and increments persisted value (open mode)", async () => {
    storeOpenSeed({ seed: makeSeed(), counter: 4 });
    const consumed = await consumeNextIndex();
    expect(consumed).toBe(4);
    expect(getSeed()?.counter).toBe(5);
  });

  it("increments atomically across rapid sequential calls", async () => {
    storeOpenSeed({ seed: makeSeed(), counter: 0 });
    const a = await consumeNextIndex();
    const b = await consumeNextIndex();
    const c = await consumeNextIndex();
    expect([a, b, c]).toEqual([0, 1, 2]);
    expect(getSeed()?.counter).toBe(3);
  });

  it("requires passphrase in protected mode", async () => {
    await storeProtectedSeed({
      seed: makeSeed(),
      counter: 1,
      passphrase: "good-passphrase",
    });
    await expect(consumeNextIndex()).rejects.toThrow(/passphrase_required/);
  });

  it("consumes index in protected mode with correct passphrase", async () => {
    await storeProtectedSeed({
      seed: makeSeed(),
      counter: 9,
      passphrase: "good-passphrase",
    });
    const n = await consumeNextIndex("good-passphrase");
    expect(n).toBe(9);
    const recovered = await unlockSeed("good-passphrase");
    expect(recovered.counter).toBe(10);
  });

  it("throws when no seed exists", async () => {
    await expect(consumeNextIndex()).rejects.toThrow(/no_seed/);
  });
});

describe("seedClient — forgetSeed (wipeAll)", () => {
  it("clears both open and protected records", async () => {
    storeOpenSeed({ seed: makeSeed(), counter: 0 });
    forgetSeed();
    expect(getSeedMode()).toBeNull();
    expect(hasSeed()).toBe(false);

    await storeProtectedSeed({
      seed: makeSeed(),
      counter: 0,
      passphrase: "good-passphrase",
    });
    forgetSeed();
    expect(getSeedMode()).toBeNull();
    expect(localStorage.getItem("sendwyrd:seed:v1")).toBeNull();
    expect(localStorage.getItem("sendwyrd:open_seed:v1")).toBeNull();
  });
});
