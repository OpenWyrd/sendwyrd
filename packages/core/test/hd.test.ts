import { describe, expect, it } from "vitest";
import { HDKey } from "@scure/bip32";
import {
  HARDENED_OFFSET,
  PURPOSE,
  deriveOriginKey,
  isValidMnemonic,
  mnemonicToSeed,
} from "../src/hd.js";

// BIP-39 known-vector mnemonic (12 words, all "abandon ... about" classic test vector).
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("hd — mnemonic validation", () => {
  it("isValidMnemonic accepts the standard BIP-39 test vector", () => {
    expect(isValidMnemonic(TEST_MNEMONIC)).toBe(true);
  });

  it("isValidMnemonic accepts mnemonic with surrounding whitespace", () => {
    expect(isValidMnemonic(`  ${TEST_MNEMONIC}\n`)).toBe(true);
  });

  it("isValidMnemonic rejects garbage", () => {
    expect(isValidMnemonic("not a real mnemonic")).toBe(false);
    expect(isValidMnemonic("")).toBe(false);
  });

  it("isValidMnemonic rejects mnemonic with wrong checksum", () => {
    // Same words but rearranged: invalid checksum
    const bad =
      "about abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
    expect(isValidMnemonic(bad)).toBe(false);
  });
});

describe("hd — mnemonicToSeed", () => {
  it("produces a 64-byte seed", () => {
    const seed = mnemonicToSeed(TEST_MNEMONIC);
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(64);
  });

  it("matches the BIP-39 known seed for the all-abandon-about vector", () => {
    // Per BIP-39 official test vector for the all-abandon-about mnemonic with empty passphrase.
    const seed = mnemonicToSeed(TEST_MNEMONIC, "");
    const expectedHex =
      "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc1" +
      "9a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4";
    const actualHex = Array.from(seed)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(actualHex).toBe(expectedHex);
  });
});

describe("hd — deriveOriginKey", () => {
  const seed = mnemonicToSeed(TEST_MNEMONIC);

  it("derives a stable keypair at m/300'/0'", () => {
    const k0a = deriveOriginKey(seed, 0);
    const k0b = deriveOriginKey(seed, 0);
    expect(k0a.k_origin_priv).toEqual(k0b.k_origin_priv);
    expect(k0a.k_origin_pub).toEqual(k0b.k_origin_pub);
    expect(k0a.k_origin_xpub).toEqual(k0b.k_origin_xpub);
    expect(k0a.n).toBe(0);
  });

  it("matches a manual BIP-32 derivation at m/300'/0'", () => {
    const root = HDKey.fromMasterSeed(seed);
    const expectedPriv = root
      .deriveChild(PURPOSE + HARDENED_OFFSET)
      .deriveChild(0 + HARDENED_OFFSET).privateKey!;
    expect(expectedPriv).toBeDefined();

    const k0 = deriveOriginKey(seed, 0);
    expect(k0.k_origin_priv).toEqual(expectedPriv);
  });

  it("different n values yield different keys", () => {
    const k0 = deriveOriginKey(seed, 0);
    const k1 = deriveOriginKey(seed, 1);
    const k2 = deriveOriginKey(seed, 2);
    expect(k0.k_origin_priv).not.toEqual(k1.k_origin_priv);
    expect(k1.k_origin_priv).not.toEqual(k2.k_origin_priv);
    expect(k0.k_origin_priv).not.toEqual(k2.k_origin_priv);
  });

  it("uses HARDENED derivation (n=0' ≠ unhardened-0)", () => {
    const seedRoot = HDKey.fromMasterSeed(seed);
    const purposeNode = seedRoot.deriveChild(PURPOSE + HARDENED_OFFSET);
    const unhardened0 = purposeNode.deriveChild(0).privateKey!;
    expect(unhardened0).toBeDefined();

    const k0 = deriveOriginKey(seed, 0);
    expect(k0.k_origin_priv).not.toEqual(unhardened0);
  });

  it("k_origin_pub is 33-byte SEC1-compressed (0x02 or 0x03 prefix)", () => {
    for (const n of [0, 1, 7, 100, 0xfffffff]) {
      const k = deriveOriginKey(seed, n);
      expect(k.k_origin_pub.length).toBe(33);
      const prefix = k.k_origin_pub[0]!;
      expect(prefix === 0x02 || prefix === 0x03).toBe(true);
    }
  });

  it("k_origin_xpub is the 32-byte X coordinate (== pub.slice(1))", () => {
    const k = deriveOriginKey(seed, 0);
    expect(k.k_origin_xpub.length).toBe(32);
    expect(k.k_origin_xpub).toEqual(k.k_origin_pub.slice(1));
  });

  it("k_origin_priv is 32 bytes", () => {
    const k = deriveOriginKey(seed, 5);
    expect(k.k_origin_priv.length).toBe(32);
  });

  it("rejects negative n", () => {
    expect(() => deriveOriginKey(seed, -1)).toThrow(/unsigned 31-bit/);
  });

  it("rejects non-integer n", () => {
    expect(() => deriveOriginKey(seed, 1.5)).toThrow(/unsigned 31-bit/);
  });

  it("rejects n > 0x7fffffff", () => {
    expect(() => deriveOriginKey(seed, 0x80000000)).toThrow(/unsigned 31-bit/);
  });

  it("accepts n = 0x7fffffff (max unsigned 31-bit)", () => {
    const k = deriveOriginKey(seed, 0x7fffffff);
    expect(k.k_origin_priv.length).toBe(32);
  });

  it("PURPOSE constant is 300 and HARDENED_OFFSET is 0x80000000", () => {
    expect(PURPOSE).toBe(300);
    expect(HARDENED_OFFSET).toBe(0x80000000);
  });
});
