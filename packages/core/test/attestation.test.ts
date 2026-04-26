import { describe, expect, it } from "vitest";
import {
  composeAttestationBody,
  isAttestationBody,
  parseAttestationBody,
  signAuthorshipAttestation,
  verifyAuthorshipAttestation,
} from "../src/attestation.js";
import { deriveOriginKey } from "../src/hd.js";
import { b64uEncode } from "../src/encoding.js";

const SEED = new Uint8Array(64).fill(0xab);
const TARGET_HANDLE = "AAAAAAAAAAAAAAAA"; // 16 b64u chars
const FOREIGN_HANDLE = "BBBBBBBBBBBBBBBB";

describe("authorship attestation", () => {
  it("composeAttestationBody / parseAttestationBody round-trips", () => {
    const sig_b64u = "X".repeat(86);
    const body = composeAttestationBody({
      target_handle: TARGET_HANDLE,
      sig_b64u,
    });
    expect(isAttestationBody(body)).toBe(true);
    const parts = parseAttestationBody(body);
    expect(parts).toEqual({ target_handle: TARGET_HANDLE, sig_b64u });
  });

  it("rejects non-attestation bodies", () => {
    expect(parseAttestationBody("hello world")).toBeNull();
    expect(parseAttestationBody("")).toBeNull();
    // Wrong header
    expect(
      parseAttestationBody(
        `sendwyrd-attestation/v2\ntarget=${TARGET_HANDLE}\nsig=${"X".repeat(86)}`,
      ),
    ).toBeNull();
    // Trailing garbage
    expect(
      parseAttestationBody(
        `sendwyrd-attestation/v1\ntarget=${TARGET_HANDLE}\nsig=${"X".repeat(86)}\nextra`,
      ),
    ).toBeNull();
    // Bad sig length
    expect(
      parseAttestationBody(
        `sendwyrd-attestation/v1\ntarget=${TARGET_HANDLE}\nsig=${"X".repeat(85)}`,
      ),
    ).toBeNull();
  });

  it("signed attestation verifies against the target's K_origin_xpub", () => {
    const n = 7;
    const k = deriveOriginKey(SEED, n);
    const sig_b64u = signAuthorshipAttestation({
      seed: SEED,
      n,
      target_handle_b64u: TARGET_HANDLE,
    });
    const ok = verifyAuthorshipAttestation({
      target_handle_b64u: TARGET_HANDLE,
      target_k_origin_pub_b64u: b64uEncode(k.k_origin_xpub),
      sig_b64u,
    });
    expect(ok).toBe(true);
  });

  it("rejects a signature against a different target handle", () => {
    const n = 3;
    const k = deriveOriginKey(SEED, n);
    const sig_b64u = signAuthorshipAttestation({
      seed: SEED,
      n,
      target_handle_b64u: TARGET_HANDLE,
    });
    const ok = verifyAuthorshipAttestation({
      target_handle_b64u: FOREIGN_HANDLE,
      target_k_origin_pub_b64u: b64uEncode(k.k_origin_xpub),
      sig_b64u,
    });
    expect(ok).toBe(false);
  });

  it("rejects a signature against a different K_origin_xpub", () => {
    const n = 5;
    const sig_b64u = signAuthorshipAttestation({
      seed: SEED,
      n,
      target_handle_b64u: TARGET_HANDLE,
    });
    // Use a foreign seed-derived key.
    const foreignSeed = new Uint8Array(64).fill(0xcd);
    const foreignK = deriveOriginKey(foreignSeed, n);
    const ok = verifyAuthorshipAttestation({
      target_handle_b64u: TARGET_HANDLE,
      target_k_origin_pub_b64u: b64uEncode(foreignK.k_origin_xpub),
      sig_b64u,
    });
    expect(ok).toBe(false);
  });

  it("verifies against the 33-byte SEC1 compressed K_origin_pub form", () => {
    const n = 11;
    const k = deriveOriginKey(SEED, n);
    const sig_b64u = signAuthorshipAttestation({
      seed: SEED,
      n,
      target_handle_b64u: TARGET_HANDLE,
    });
    const ok = verifyAuthorshipAttestation({
      target_handle_b64u: TARGET_HANDLE,
      target_k_origin_pub_b64u: b64uEncode(k.k_origin_pub),
      sig_b64u,
    });
    expect(ok).toBe(true);
  });

  it("malformed signatures fail closed", () => {
    const k = deriveOriginKey(SEED, 0);
    const ok = verifyAuthorshipAttestation({
      target_handle_b64u: TARGET_HANDLE,
      target_k_origin_pub_b64u: b64uEncode(k.k_origin_xpub),
      sig_b64u: "@@@invalid@@@",
    });
    expect(ok).toBe(false);
  });
});
