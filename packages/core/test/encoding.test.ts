import { describe, expect, it } from "vitest";
import { b64uDecode, b64uEncode } from "../src/encoding.js";

describe("encoding — b64url", () => {
  it("round-trips empty array", () => {
    const empty = new Uint8Array(0);
    const enc = b64uEncode(empty);
    expect(enc).toBe("");
    expect(b64uDecode(enc)).toEqual(empty);
  });

  it("round-trips a single byte", () => {
    const bytes = new Uint8Array([0xab]);
    const enc = b64uEncode(bytes);
    const dec = b64uDecode(enc);
    expect(dec).toEqual(bytes);
  });

  it("round-trips arbitrary byte arrays of various sizes", () => {
    for (const size of [1, 2, 3, 4, 8, 16, 32, 64, 100, 255, 1024]) {
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) & 0xff;
      const enc = b64uEncode(bytes);
      const dec = b64uDecode(enc);
      expect(dec).toEqual(bytes);
    }
  });

  it("produces NO padding (base64url, RFC 4648 §5)", () => {
    // 1 byte → standard base64 emits 2 chars + 2 padding; b64u must drop padding
    expect(b64uEncode(new Uint8Array([0x00]))).toBe("AA");
    // 2 bytes → 3 chars + 1 padding; b64u must drop
    expect(b64uEncode(new Uint8Array([0x00, 0x00]))).toBe("AAA");
    // 3 bytes → 4 chars no padding
    expect(b64uEncode(new Uint8Array([0x00, 0x00, 0x00]))).toBe("AAAA");
    // No '=' should appear in any output
    for (const size of [1, 2, 3, 4, 5, 10, 33]) {
      const out = b64uEncode(new Uint8Array(size));
      expect(out).not.toContain("=");
    }
  });

  it("uses URL-safe alphabet (- and _ instead of + and /)", () => {
    // Find a byte sequence that produces both - and _ in URL-safe form
    // 0xfb 0xff 0xbf produces standard "+/+/" pattern
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
    const enc = b64uEncode(bytes);
    // Should contain only A-Za-z0-9_- characters
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    // Round-trip
    expect(b64uDecode(enc)).toEqual(bytes);
  });

  it("decodes input with - and _ correctly", () => {
    // Hand-construct a known case: bytes [0xfb, 0xef, 0xbe] → standard "++++" → b64u "----"
    const bytes = new Uint8Array([0xfb, 0xef, 0xbe]);
    const std = btoa(String.fromCharCode(...bytes));
    expect(std).toBe("++++");
    const b64u = b64uEncode(bytes);
    expect(b64u).toBe("----");
    expect(b64uDecode("----")).toEqual(bytes);
  });

  it("round-trips non-ASCII byte values (full 0x00-0xff)", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    const enc = b64uEncode(bytes);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(b64uDecode(enc)).toEqual(bytes);
  });
});
