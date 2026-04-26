/**
 * Body envelope encrypt/decrypt per spec_mop_v1.md §7.
 *
 * Layout: ver(1) || iv(12) || ciphertext || tag(16)
 * AAD:    ver(1) || handle(12) || expires_at_be(8) || replies_enabled(1)
 *
 * Uses Web Crypto API (browser, Workers, Node 20+ via globalThis.crypto.subtle).
 */

import {
  ENVELOPE_VERSION,
  ENVELOPE_IV_BYTES,
  ENVELOPE_TAG_BYTES,
  HANDLE_BYTES,
  K_READ_BYTES,
  type Base64Url,
} from "./types.js";
import { b64uDecode, b64uEncode } from "./encoding.js";

export interface EncryptParams {
  /** UTF-8 plaintext body, ≤ 300 codepoints (caller MUST enforce). */
  plaintext: string;
  /** 32-byte symmetric key from CSPRNG. */
  k_read: Uint8Array;
  /** 12-byte handle. */
  handle: Uint8Array;
  /** unix epoch ms, 8-byte unsigned big-endian. */
  expires_at_ms: number;
  /** affects AAD; tampered field fails decrypt. */
  replies_enabled: boolean;
}

export interface DecryptParams {
  /** Full envelope bytes (1 + 12 + ciphertext + 16). */
  envelope: Uint8Array;
  /** 32-byte symmetric key. */
  k_read: Uint8Array;
  /** 12-byte handle. */
  handle: Uint8Array;
  /** From server response — must match what was used at encrypt time. */
  expires_at_ms: number;
  replies_enabled: boolean;
}

/**
 * Encrypt a UTF-8 plaintext body and produce the envelope bytes.
 */
export async function encryptEnvelope(params: EncryptParams): Promise<Uint8Array> {
  if (params.k_read.length !== K_READ_BYTES) {
    throw new Error(`k_read must be ${K_READ_BYTES} bytes`);
  }
  if (params.handle.length !== HANDLE_BYTES) {
    throw new Error(`handle must be ${HANDLE_BYTES} bytes`);
  }

  const iv = crypto.getRandomValues(new Uint8Array(ENVELOPE_IV_BYTES));
  const aad = buildAad(params.handle, params.expires_at_ms, params.replies_enabled);
  const plaintextBytes = new TextEncoder().encode(params.plaintext);

  const key = await crypto.subtle.importKey(
    "raw",
    bufferSource(params.k_read),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const ciphertextWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: bufferSource(iv),
        additionalData: bufferSource(aad),
        tagLength: ENVELOPE_TAG_BYTES * 8,
      },
      key,
      bufferSource(plaintextBytes),
    ),
  );

  // Layout: ver(1) || iv(12) || ciphertext || tag(16) — Web Crypto returns ciphertext with tag appended.
  const envelope = new Uint8Array(1 + ENVELOPE_IV_BYTES + ciphertextWithTag.length);
  envelope[0] = ENVELOPE_VERSION;
  envelope.set(iv, 1);
  envelope.set(ciphertextWithTag, 1 + ENVELOPE_IV_BYTES);
  return envelope;
}

/**
 * Decrypt an envelope; returns UTF-8 plaintext or throws on tag mismatch.
 */
export async function decryptEnvelope(params: DecryptParams): Promise<string> {
  const env = params.envelope;
  if (env.length < 1 + ENVELOPE_IV_BYTES + ENVELOPE_TAG_BYTES) {
    throw new Error("envelope too short");
  }
  if (env[0] !== ENVELOPE_VERSION) {
    throw new Error(`envelope version unsupported: 0x${env[0]?.toString(16)}`);
  }
  if (params.k_read.length !== K_READ_BYTES) {
    throw new Error(`k_read must be ${K_READ_BYTES} bytes`);
  }
  if (params.handle.length !== HANDLE_BYTES) {
    throw new Error(`handle must be ${HANDLE_BYTES} bytes`);
  }

  const iv = env.slice(1, 1 + ENVELOPE_IV_BYTES);
  const ciphertextWithTag = env.slice(1 + ENVELOPE_IV_BYTES);
  const aad = buildAad(params.handle, params.expires_at_ms, params.replies_enabled);

  const key = await crypto.subtle.importKey(
    "raw",
    bufferSource(params.k_read),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const plaintextBytes = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bufferSource(iv),
        additionalData: bufferSource(aad),
        tagLength: ENVELOPE_TAG_BYTES * 8,
      },
      key,
      bufferSource(ciphertextWithTag),
    ),
  );
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
    plaintextBytes,
  );
}

/**
 * Build the AAD: ver(1) || handle(12) || expires_at_be(8) || replies_enabled(1).
 */
function buildAad(
  handle: Uint8Array,
  expires_at_ms: number,
  replies_enabled: boolean,
): Uint8Array {
  const aad = new Uint8Array(1 + HANDLE_BYTES + 8 + 1);
  aad[0] = ENVELOPE_VERSION;
  aad.set(handle, 1);
  // Big-endian uint64 expires_at_ms.
  const view = new DataView(aad.buffer, aad.byteOffset + 1 + HANDLE_BYTES, 8);
  // JS numbers are 64-bit float; safe up to 2^53. expires_at_ms is far below that.
  view.setBigUint64(0, BigInt(expires_at_ms), false);
  aad[1 + HANDLE_BYTES + 8] = replies_enabled ? 1 : 0;
  return aad;
}

/**
 * Convenience: encrypt + base64url-encode for transport.
 */
export async function encryptToBase64Url(params: EncryptParams): Promise<Base64Url> {
  const envelope = await encryptEnvelope(params);
  return b64uEncode(envelope);
}

/**
 * Convenience: base64url-decode + decrypt.
 */
export async function decryptFromBase64Url(
  envelopeB64u: Base64Url,
  params: Omit<DecryptParams, "envelope">,
): Promise<string> {
  const envelope = b64uDecode(envelopeB64u);
  return decryptEnvelope({ ...params, envelope });
}

/**
 * Generate a 32-byte K_read from CSPRNG.
 */
export function generateKRead(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(K_READ_BYTES));
}

/**
 * TS 5.7+ tightened `Uint8Array<ArrayBufferLike>` so it no longer satisfies
 * Web Crypto's `BufferSource` constraint. This helper coerces to an
 * ArrayBuffer-backed view at the Web Crypto boundary. The runtime cost is
 * zero when the input is already ArrayBuffer-backed (which is the case for
 * everything we hand to it — `crypto.getRandomValues`, `new Uint8Array(N)`,
 * `b64uDecode`, `TextEncoder.encode` all return ArrayBuffer-backed views).
 */
function bufferSource(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  if (arr.buffer instanceof ArrayBuffer) {
    return arr as Uint8Array<ArrayBuffer>;
  }
  // SharedArrayBuffer-backed input: copy into a fresh ArrayBuffer.
  const copy = new Uint8Array(arr.byteLength);
  copy.set(arr);
  return copy;
}
