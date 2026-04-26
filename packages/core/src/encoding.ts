/**
 * Base64url encoding (RFC 4648 §5) without padding.
 * Used for all binary-on-wire values in the MOP protocol.
 */

import type { Base64Url } from "./types.js";

const STD_TO_URL: Record<string, string> = { "+": "-", "/": "_", "=": "" };
const URL_TO_STD: Record<string, string> = { "-": "+", _: "/" };

export function b64uEncode(bytes: Uint8Array): Base64Url {
  // btoa works on binary strings; convert via Latin-1 trick.
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  const std = btoa(bin);
  return std.replace(/[+/=]/g, (m) => STD_TO_URL[m]!);
}

export function b64uDecode(s: Base64Url): Uint8Array {
  const std = s.replace(/[-_]/g, (m) => URL_TO_STD[m]!);
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
