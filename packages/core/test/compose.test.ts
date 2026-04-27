import { describe, expect, it } from "vitest";
import {
  composeWyrd,
  countCodepoints,
  decryptFromBase64Url,
} from "../src/compose.js";
import { deriveReadKey, mnemonicToSeed } from "../src/hd.js";
import { b64uDecode } from "../src/encoding.js";
import { schnorrVerify, publishMessage } from "../src/sign.js";
import {
  BODY_CODEPOINT_CAP,
  HANDLE_CHARS,
  K_READ_BYTES,
  PERMANENT_EXPIRES_AT_MS,
} from "../src/types.js";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("compose — countCodepoints", () => {
  it("returns 0 for empty string", () => {
    expect(countCodepoints("")).toBe(0);
  });
  it("counts ASCII", () => {
    expect(countCodepoints("hello")).toBe(5);
  });
  it("counts a single emoji as 1 codepoint", () => {
    expect(countCodepoints("\u{1F44B}")).toBe(1);
  });
});

describe("compose — composeWyrd happy path", () => {
  const seed = mnemonicToSeed(TEST_MNEMONIC);

  it("produces a self-consistent publish payload that decrypts correctly", async () => {
    const result = await composeWyrd({
      plaintext: "hello world",
      seed,
      n: 0,
      ttl_seconds: 7_776_000,
      replies_enabled: false,
      now_ms: 1_745_625_600_000,
    });

    // Handle is 16 chars base64url
    expect(result.handle).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.handle.length).toBe(HANDLE_CHARS);

    // K_read is 32 bytes
    expect(result.k_read.length).toBe(K_READ_BYTES);
    expect(result.k_read_b64u.length).toBe(43);

    // Expiry is computed from publish_timestamp_ms + ttl
    expect(result.expires_at_ms).toBe(1_745_625_600_000 + 7_776_000 * 1000);

    // Round-trip: decrypt the envelope using the recipient's expected inputs.
    const plaintext = await decryptFromBase64Url(
      result.publish_payload.envelope,
      {
        k_read: result.k_read,
        handle: b64uDecode(result.handle),
        expires_at_ms: result.expires_at_ms,
        replies_enabled: false,
      },
    );
    expect(plaintext).toBe("hello world");
  });

  it("publish signature verifies against the signed message hash", async () => {
    const result = await composeWyrd({
      plaintext: "verify-me",
      seed,
      n: 1,
      ttl_seconds: 60,
      replies_enabled: true,
      now_ms: 1_745_625_600_000,
    });
    const handleBytes = b64uDecode(result.handle);
    const envelope = b64uDecode(result.publish_payload.envelope);

    const m = publishMessage({
      handle: handleBytes,
      envelope,
      ttl_seconds: 60,
      replies_enabled: true,
      publish_timestamp_ms: 1_745_625_600_000,
    });
    const sig = b64uDecode(result.publish_payload.publish_signature);
    const xpub = result.k_origin.k_origin_xpub;
    expect(schnorrVerify(sig, m, xpub)).toBe(true);
  });

  it("k_read matches deriveReadKey(seed, n) — recovery-friendly derivation", async () => {
    const result = await composeWyrd({
      plaintext: "derived-k-read",
      seed,
      n: 4,
      ttl_seconds: 60,
      replies_enabled: false,
      now_ms: 1_745_625_600_000,
    });
    expect(result.k_read).toEqual(deriveReadKey(seed, 4));
  });

  it("ttl_seconds=0 uses PERMANENT_EXPIRES_AT_MS sentinel", async () => {
    const result = await composeWyrd({
      plaintext: "permanent",
      seed,
      n: 2,
      ttl_seconds: 0,
      replies_enabled: false,
      now_ms: 1_745_625_600_000,
    });
    expect(result.expires_at_ms).toBe(PERMANENT_EXPIRES_AT_MS);
  });
});

describe("compose — input validation", () => {
  const seed = mnemonicToSeed(TEST_MNEMONIC);

  it("rejects empty body", async () => {
    await expect(
      composeWyrd({
        plaintext: "",
        seed,
        n: 0,
        ttl_seconds: 60,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/empty/);
  });

  it("rejects body over the codepoint cap", async () => {
    await expect(
      composeWyrd({
        plaintext: "a".repeat(BODY_CODEPOINT_CAP + 1),
        seed,
        n: 0,
        ttl_seconds: 60,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/codepoints/);
  });

  it("excludes Lightning invoices from the codepoint cap (matches UI counter)", async () => {
    // Synthetic BOLT11-shape invoice padded over the prose cap. The body
    // parser only requires the prefix + 50+ bech32 chars, so we extend it
    // here to exercise the "raw count > cap, countable count ≤ cap" path.
    const invoice = "lnbc1500n1" + "ac".repeat(200);
    const plaintext = `tip me: ${invoice}`;
    expect(plaintext.length).toBeGreaterThan(BODY_CODEPOINT_CAP);
    // Prose + invoice — raw codepoint count exceeds the cap, but the prose
    // alone fits, so this must not throw.
    await expect(
      composeWyrd({
        plaintext,
        seed,
        n: 0,
        ttl_seconds: 60,
        replies_enabled: false,
      }),
    ).resolves.toBeTruthy();
  });

  it("rejects negative ttl", async () => {
    await expect(
      composeWyrd({
        plaintext: "x",
        seed,
        n: 0,
        ttl_seconds: -1,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/ttl_seconds/);
  });

  it("rejects ttl over 1 year", async () => {
    await expect(
      composeWyrd({
        plaintext: "x",
        seed,
        n: 0,
        ttl_seconds: 31_536_001,
        replies_enabled: false,
      }),
    ).rejects.toThrow(/ttl_seconds/);
  });
});
