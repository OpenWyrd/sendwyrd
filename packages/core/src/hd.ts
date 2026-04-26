/**
 * HD key derivation per spec_mop_v1.md §5 and ADR-017.
 *
 * Path: m / 300' / n'  (BIP-43 flat purpose; both levels hardened.)
 * Curve: secp256k1.
 */

import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { secp256k1 } from "@noble/curves/secp256k1";

export const PURPOSE = 300;
export const HARDENED_OFFSET = 0x80000000;

export interface OriginKeyPair {
  /** 32-byte private key. */
  k_origin_priv: Uint8Array;
  /** 33-byte SEC1 compressed public key. */
  k_origin_pub: Uint8Array;
  /** 32-byte BIP-340 X-only public key (used for Schnorr signing). */
  k_origin_xpub: Uint8Array;
  /** Hardened index `n` used in derivation. */
  n: number;
}

/**
 * Validate a BIP-39 mnemonic.
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim(), wordlist);
}

/**
 * Convert BIP-39 mnemonic to 64-byte seed (PBKDF2 per BIP-39).
 */
export function mnemonicToSeed(mnemonic: string, passphrase = ""): Uint8Array {
  return mnemonicToSeedSync(mnemonic.trim(), passphrase);
}

/**
 * Derive the per-wyrd K_origin keypair at m/300'/n'.
 * Both levels are hardened.
 */
export function deriveOriginKey(seed: Uint8Array, n: number): OriginKeyPair {
  if (!Number.isInteger(n) || n < 0 || n > 0x7fffffff) {
    throw new Error("n must be an unsigned 31-bit integer");
  }
  const root = HDKey.fromMasterSeed(seed);
  const purposeNode = root.deriveChild(PURPOSE + HARDENED_OFFSET);
  const indexNode = purposeNode.deriveChild(n + HARDENED_OFFSET);
  const k_origin_priv = indexNode.privateKey;
  if (!k_origin_priv) {
    throw new Error("HD derivation produced no private key");
  }
  const k_origin_pub = secp256k1.getPublicKey(k_origin_priv, true); // SEC1 compressed (33 bytes)
  // BIP-340 X-only: the 32-byte X coordinate of the (even-Y) public point.
  // SEC1 compressed prefixes 0x02 / 0x03 (even/odd Y); X is bytes 1..33.
  const k_origin_xpub = k_origin_pub.slice(1);
  return { k_origin_priv, k_origin_pub, k_origin_xpub, n };
}
