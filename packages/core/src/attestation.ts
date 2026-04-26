/**
 * Authorship attestation — a special body convention that lets an author
 * cryptographically prove they authored a previous wyrd, even though the
 * protocol assigns each wyrd a fresh random K_origin keypair.
 *
 * Mechanism: the author re-derives the target wyrd's K_origin_priv from
 * their seed at the original index `n`, and signs a canonical message
 * binding to the target's handle. Anyone can fetch the target's
 * K_origin_pub from the host (it's exposed in the publish record) and
 * verify the BIP-340 Schnorr signature.
 *
 * The attestation is *static* (per design): the signed message binds
 * only to the target handle, not to the attesting wyrd's own handle.
 * That means the same signature can be embedded in any number of
 * attestation wyrds — and that is fine, because the signature only ever
 * proves "the holder of K_origin_priv for the target signed this," which
 * is exactly what authorship-of-target asserts.
 *
 * Body format (the entire wyrd body, three lines):
 *
 *     sendwyrd-attestation/v1
 *     target=<16-char-handle-b64u>
 *     sig=<86-char-sig-b64u>
 *
 * Renderers detect the prefix and surface a verification banner instead
 * of a plain-text body. Anything other than this exact shape parses as a
 * normal body.
 */

import { b64uDecode, b64uEncode } from "./encoding.js";
import { deriveOriginKey } from "./hd.js";
import {
  authorshipAttestationMessage,
  schnorrSign,
  schnorrVerify,
} from "./sign.js";
import { HANDLE_CHARS } from "./types.js";

const ATTESTATION_HEADER = "sendwyrd-attestation/v1";
const SIG_CHARS = 86; // base64url(64-byte schnorr sig) without padding

const ATTESTATION_BODY_REGEX = new RegExp(
  `^${ATTESTATION_HEADER}\\n` +
    `target=([A-Za-z0-9_-]{${HANDLE_CHARS}})\\n` +
    `sig=([A-Za-z0-9_-]{${SIG_CHARS}})$`,
);

export interface AttestationParts {
  target_handle: string;
  sig_b64u: string;
}

/**
 * Format an authorship-attestation body (the entire wyrd content).
 * Both inputs are base64url-encoded strings as they appear elsewhere in
 * the API.
 */
export function composeAttestationBody(parts: AttestationParts): string {
  return [
    ATTESTATION_HEADER,
    `target=${parts.target_handle}`,
    `sig=${parts.sig_b64u}`,
  ].join("\n");
}

/**
 * Parse a body as an authorship attestation. Returns the parts on a
 * shape match, or null otherwise. The match is strict — the body must
 * be the entire attestation with no leading/trailing content.
 */
export function parseAttestationBody(body: string): AttestationParts | null {
  const m = body.match(ATTESTATION_BODY_REGEX);
  if (!m) return null;
  return { target_handle: m[1]!, sig_b64u: m[2]! };
}

/**
 * Cheap shape check used by renderers to decide whether to fetch the
 * target's K_origin_pub for verification, without constructing the full
 * parts. Equivalent to `parseAttestationBody(body) !== null`.
 */
export function isAttestationBody(body: string): boolean {
  return ATTESTATION_BODY_REGEX.test(body);
}

/**
 * Re-derive the target wyrd's K_origin_priv from the author's seed at
 * the original index `n`, sign the canonical attestation message, return
 * the base64url-encoded 64-byte signature.
 *
 * The caller is responsible for knowing `n` — typically from their local
 * wyrdHistory entry for the target wyrd.
 */
export function signAuthorshipAttestation(args: {
  seed: Uint8Array;
  n: number;
  target_handle_b64u: string;
}): string {
  const k = deriveOriginKey(args.seed, args.n);
  const target_handle = b64uDecode(args.target_handle_b64u);
  const message = authorshipAttestationMessage({ target_handle });
  const sig = schnorrSign(message, k.k_origin_priv);
  return b64uEncode(sig);
}

/**
 * Verify a Schnorr authorship-attestation signature against the target
 * wyrd's K_origin pubkey. Accepts either form the protocol uses:
 *
 *   - 33-byte SEC1 compressed (`k_origin_pub` from FetchEnvelopeResponse)
 *   - 32-byte X-only (`k_origin_xpub` if a caller already has it)
 *
 * 33-byte input is normalized to X-only by dropping the parity byte;
 * any other length fails closed.
 *
 * Fails closed: any decoding or verification error returns false.
 */
export function verifyAuthorshipAttestation(args: {
  target_handle_b64u: string;
  /** 33-byte SEC1 compressed OR 32-byte X-only pubkey, base64url. */
  target_k_origin_pub_b64u: string;
  sig_b64u: string;
}): boolean {
  try {
    const target_handle = b64uDecode(args.target_handle_b64u);
    const pub = b64uDecode(args.target_k_origin_pub_b64u);
    let xpub: Uint8Array;
    if (pub.length === 32) {
      xpub = pub;
    } else if (pub.length === 33) {
      xpub = pub.slice(1);
    } else {
      return false;
    }
    const sig = b64uDecode(args.sig_b64u);
    const message = authorshipAttestationMessage({ target_handle });
    return schnorrVerify(sig, message, xpub);
  } catch {
    return false;
  }
}
