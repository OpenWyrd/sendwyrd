/**
 * Passphrase-protected seed encryption per renderer-contract §17.1.
 *
 * Storage envelope:
 *   ver(1) || salt(16) || iv(12) || iters_be(4) || counter_be(4) || ciphertext || tag(16)
 *
 * `ciphertext` covers the 64-byte BIP-39 seed (PBKDF2-derived). The
 * `counter` field stores `next_n` — the HD index counter — alongside the
 * seed so they survive together. AAD is "sendwyrd:v1:seedstore".
 *
 * AES key is derived from the user's passphrase via PBKDF2-SHA256 with
 * `iterations` rounds (default 600,000 — OWASP 2024 floor for SHA-256).
 */

import { generateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import type { Base64Url } from "./types.js";
import { b64uDecode, b64uEncode } from "./encoding.js";

export const SEED_STORE_VERSION_V1 = 0x01;
export const SEED_STORE_VERSION_V2 = 0x02;
export const SEED_STORE_VERSION = SEED_STORE_VERSION_V2;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;
export const SEED_BYTES = 64; // BIP-39 PBKDF2 output
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;
const SEEDSTORE_AAD = new TextEncoder().encode("sendwyrd:v1:seedstore");

export interface SeedAndCounter {
  /** 64-byte BIP-39 seed (post-PBKDF2). */
  seed: Uint8Array;
  /** Next free HD index `n` to use on next compose. */
  counter: number;
  /** BIP-39 mnemonic (for backup display); persisted alongside the seed. */
  mnemonic?: string;
}

/**
 * Generate a fresh BIP-39 mnemonic (12 words by default).
 * Returns mnemonic string + derived seed.
 */
export function generateSeed(words: 12 | 24 = 12): {
  mnemonic: string;
  seed: Uint8Array;
} {
  // generateMnemonic wants entropy bits: 12w = 128 bits, 24w = 256 bits.
  const entropyBits = words === 12 ? 128 : 256;
  const mnemonic = generateMnemonic(wordlist, entropyBits);
  const seed = mnemonicToSeedSync(mnemonic);
  return { mnemonic, seed };
}

/**
 * Encrypt a seed + counter under a passphrase. Returns a base64url-encoded
 * record suitable for localStorage / IndexedDB persistence.
 */
export async function encryptSeedRecord(
  args: SeedAndCounter & {
    passphrase: string;
    iterations?: number;
  },
): Promise<Base64Url> {
  if (args.seed.length !== SEED_BYTES) {
    throw new Error(`seed must be ${SEED_BYTES} bytes`);
  }
  if (!Number.isInteger(args.counter) || args.counter < 0) {
    throw new Error("counter must be a non-negative integer");
  }
  const iterations = args.iterations ?? DEFAULT_PBKDF2_ITERATIONS;

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const aesKey = await deriveAesKeyFromPassphrase(
    args.passphrase,
    salt,
    iterations,
  );

  // V2 plaintext: JSON {counter, mnemonic, seed_b64u}
  const payload = JSON.stringify({
    counter: args.counter,
    mnemonic: args.mnemonic ?? null,
    seed_b64u: b64uEncode(args.seed),
  });
  const plaintext = new TextEncoder().encode(payload);

  const ciphertextWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: bufferSource(iv),
        additionalData: bufferSource(SEEDSTORE_AAD),
      },
      aesKey,
      bufferSource(plaintext),
    ),
  );

  // Layout: ver(1) || salt(16) || iv(12) || iters_be(4) || ciphertext || tag(16)
  const record = new Uint8Array(
    1 + SALT_BYTES + IV_BYTES + 4 + ciphertextWithTag.length,
  );
  let o = 0;
  record[o++] = SEED_STORE_VERSION;
  record.set(salt, o);
  o += SALT_BYTES;
  record.set(iv, o);
  o += IV_BYTES;
  new DataView(record.buffer, o, 4).setUint32(0, iterations, false);
  o += 4;
  record.set(ciphertextWithTag, o);
  return b64uEncode(record);
}

/**
 * Decrypt a base64url-encoded seed record. Throws on tag mismatch (wrong passphrase).
 */
export async function decryptSeedRecord(
  recordB64u: Base64Url,
  passphrase: string,
): Promise<SeedAndCounter> {
  const record = b64uDecode(recordB64u);
  if (record.length < 1 + SALT_BYTES + IV_BYTES + 4) {
    throw new Error("seed record too short");
  }
  const ver = record[0];
  if (ver !== SEED_STORE_VERSION_V1 && ver !== SEED_STORE_VERSION_V2) {
    throw new Error(`seed record version unsupported: 0x${ver?.toString(16)}`);
  }
  let o = 1;
  const salt = record.slice(o, o + SALT_BYTES);
  o += SALT_BYTES;
  const iv = record.slice(o, o + IV_BYTES);
  o += IV_BYTES;
  const iterations = new DataView(
    record.buffer,
    record.byteOffset + o,
    4,
  ).getUint32(0, false);
  o += 4;
  const ciphertextWithTag = record.slice(o);

  const aesKey = await deriveAesKeyFromPassphrase(passphrase, salt, iterations);
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bufferSource(iv),
        additionalData: bufferSource(SEEDSTORE_AAD),
      },
      aesKey,
      bufferSource(ciphertextWithTag),
    ),
  );
  if (ver === SEED_STORE_VERSION_V2) {
    const j = JSON.parse(new TextDecoder().decode(plaintext)) as {
      counter: number;
      mnemonic: string | null;
      seed_b64u: string;
    };
    return {
      seed: b64uDecode(j.seed_b64u),
      counter: j.counter,
      mnemonic: j.mnemonic ?? undefined,
    };
  }
  // V1 legacy binary payload
  if (plaintext.length !== 4 + SEED_BYTES) {
    throw new Error("decrypted seed payload has wrong length");
  }
  const counter = new DataView(
    plaintext.buffer,
    plaintext.byteOffset,
    4,
  ).getUint32(0, false);
  const seed = plaintext.slice(4);
  return { seed, counter };
}

async function deriveAesKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const passBytes = new TextEncoder().encode(passphrase);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    bufferSource(passBytes),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: bufferSource(salt),
      iterations,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bufferSource(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  if (arr.buffer instanceof ArrayBuffer) return arr as Uint8Array<ArrayBuffer>;
  const copy = new Uint8Array(arr.byteLength);
  copy.set(arr);
  return copy;
}
