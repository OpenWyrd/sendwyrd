/**
 * Reply blob ECIES per spec_mop_v1.md §14.3.
 *
 * Layout: ver(1) || e_pub(33) || ciphertext || tag(16)
 *
 * Encrypt:
 *   1. Replier generates ephemeral secp256k1 keypair (e_priv, e_pub)
 *   2. shared = ECDH(e_priv, K_origin_pub) → 32-byte X coordinate
 *   3. aes_key = HKDF-SHA256(shared, "", "mop:v1:reply:aes_key:" || handle || e_pub, 32)
 *   4. iv      = HKDF-SHA256(shared, "", "mop:v1:reply:iv:"      || handle || e_pub, 12)
 *   5. AAD = version(1) || handle(12) || e_pub(33)
 *   6. ciphertext, tag = AES-256-GCM-Encrypt(plaintext, aes_key, iv, AAD)
 *   7. blob = version(1) || e_pub(33) || ciphertext || tag
 *
 * Decrypt (by author with K_origin_priv): mirror with shared = ECDH(K_origin_priv, e_pub).
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { HANDLE_BYTES, K_ORIGIN_PUB_BYTES, REPLY_CODEPOINT_CAP } from "./types.js";

export const REPLY_VERSION = 0x01;
const E_PUB_BYTES = 33; // SEC1 compressed
const TAG_BYTES = 16;
const IV_BYTES = 12;
const AES_KEY_BYTES = 32;

const enc = new TextEncoder();

export interface EncryptReplyArgs {
  /** UTF-8 plaintext, ≤ REPLY_CODEPOINT_CAP codepoints (caller MUST enforce). */
  plaintext: string;
  /** 12-byte handle bytes of the wyrd being replied to. */
  handle: Uint8Array;
  /** 33-byte SEC1-compressed K_origin_pub of the wyrd's author. */
  k_origin_pub: Uint8Array;
}

export interface DecryptReplyArgs {
  /** Full reply blob bytes. */
  blob: Uint8Array;
  /** 12-byte handle bytes. */
  handle: Uint8Array;
  /** 32-byte K_origin_priv of the wyrd's author. */
  k_origin_priv: Uint8Array;
}

export async function encryptReply(args: EncryptReplyArgs): Promise<Uint8Array> {
  if (args.handle.length !== HANDLE_BYTES) {
    throw new Error(`handle must be ${HANDLE_BYTES} bytes`);
  }
  if (args.k_origin_pub.length !== K_ORIGIN_PUB_BYTES) {
    throw new Error(`k_origin_pub must be ${K_ORIGIN_PUB_BYTES} bytes`);
  }

  // 1. Generate ephemeral keypair.
  const e_priv = secp256k1.utils.randomPrivateKey();
  const e_pub = secp256k1.getPublicKey(e_priv, true); // 33 bytes compressed

  // 2. ECDH → 32-byte X coordinate.
  const shared = ecdhX(e_priv, args.k_origin_pub);

  // 3. & 4. Derive AES key + IV.
  const { aesKey, iv } = await deriveAesAndIv(shared, args.handle, e_pub);

  // 5. AAD.
  const aad = buildAad(args.handle, e_pub);

  // 6. Encrypt.
  const key = await crypto.subtle.importKey(
    "raw",
    bs(aesKey),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertextWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: bs(iv), additionalData: bs(aad), tagLength: TAG_BYTES * 8 },
      key,
      bs(enc.encode(args.plaintext)),
    ),
  );

  // 7. Assemble blob.
  const blob = new Uint8Array(1 + E_PUB_BYTES + ciphertextWithTag.length);
  blob[0] = REPLY_VERSION;
  blob.set(e_pub, 1);
  blob.set(ciphertextWithTag, 1 + E_PUB_BYTES);
  return blob;
}

export async function decryptReply(args: DecryptReplyArgs): Promise<string> {
  if (args.blob.length < 1 + E_PUB_BYTES + TAG_BYTES) {
    throw new Error("reply blob too short");
  }
  if (args.blob[0] !== REPLY_VERSION) {
    throw new Error(`reply version unsupported: 0x${args.blob[0]?.toString(16)}`);
  }
  const e_pub = args.blob.slice(1, 1 + E_PUB_BYTES);
  const ciphertextWithTag = args.blob.slice(1 + E_PUB_BYTES);

  const shared = ecdhX(args.k_origin_priv, e_pub);
  const { aesKey, iv } = await deriveAesAndIv(shared, args.handle, e_pub);
  const aad = buildAad(args.handle, e_pub);

  const key = await crypto.subtle.importKey(
    "raw",
    bs(aesKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bs(iv), additionalData: bs(aad), tagLength: TAG_BYTES * 8 },
      key,
      bs(ciphertextWithTag),
    ),
  );
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(plaintext);
}

export { REPLY_CODEPOINT_CAP };

function ecdhX(privKey: Uint8Array, pubKey: Uint8Array): Uint8Array {
  // noble returns 33-byte compressed shared point; X coordinate is bytes 1..33.
  const shared = secp256k1.getSharedSecret(privKey, pubKey, true);
  return shared.slice(1);
}

async function deriveAesAndIv(
  shared: Uint8Array,
  handle: Uint8Array,
  e_pub: Uint8Array,
): Promise<{ aesKey: Uint8Array; iv: Uint8Array }> {
  const aesInfo = concat(enc.encode("mop:v1:reply:aes_key:"), handle, e_pub);
  const ivInfo = concat(enc.encode("mop:v1:reply:iv:"), handle, e_pub);
  const aesKey = hkdf(sha256, shared, new Uint8Array(0), aesInfo, AES_KEY_BYTES);
  const iv = hkdf(sha256, shared, new Uint8Array(0), ivInfo, IV_BYTES);
  return { aesKey, iv };
}

function buildAad(handle: Uint8Array, e_pub: Uint8Array): Uint8Array {
  const aad = new Uint8Array(1 + HANDLE_BYTES + E_PUB_BYTES);
  aad[0] = REPLY_VERSION;
  aad.set(handle, 1);
  aad.set(e_pub, 1 + HANDLE_BYTES);
  return aad;
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

function bs(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  if (arr.buffer instanceof ArrayBuffer) return arr as Uint8Array<ArrayBuffer>;
  const copy = new Uint8Array(arr.byteLength);
  copy.set(arr);
  return copy;
}
