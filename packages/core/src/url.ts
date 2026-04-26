/**
 * URL parsing per spec_mop_v1.md §4.3.
 *
 * Two canonical forms:
 *   private fragment: https://sendwyrd.com/w/{handle}#{K_read_b64u}
 *   public path:      https://sendwyrd.com/w/{handle}/k/{K_read_b64u}
 *
 * Handle: 16 chars base64url (12 bytes).
 * K_read: 43 chars base64url (32 bytes).
 */

import { HANDLE_CHARS, K_READ_CHARS, type Base64Url } from "./types.js";

const HANDLE_PATTERN = new RegExp(`^/w/([A-Za-z0-9_-]{${HANDLE_CHARS}})$`);
const PATH_FORM_PATTERN = new RegExp(
  `^/w/([A-Za-z0-9_-]{${HANDLE_CHARS}})/k/([A-Za-z0-9_-]{${K_READ_CHARS}})$`,
);

export type WyrdUrlForm =
  | { form: "fragment"; handle: Base64Url; k_read: Base64Url }
  | { form: "public"; handle: Base64Url; k_read: Base64Url }
  | { form: "invalid"; reason: string };

/**
 * Parse a URL string into a wyrd URL classification. Returns `invalid` if the
 * URL doesn't match either canonical form.
 */
export function parseWyrdUrl(input: string): WyrdUrlForm {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { form: "invalid", reason: "not_a_url" };
  }

  const pathFormMatch = url.pathname.match(PATH_FORM_PATTERN);
  if (pathFormMatch) {
    return {
      form: "public",
      handle: pathFormMatch[1]!,
      k_read: pathFormMatch[2]!,
    };
  }

  const fragmentFormMatch = url.pathname.match(HANDLE_PATTERN);
  if (fragmentFormMatch) {
    const fragment = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    if (!fragment || fragment.length !== K_READ_CHARS) {
      return { form: "invalid", reason: "missing_or_malformed_fragment" };
    }
    if (!/^[A-Za-z0-9_-]+$/.test(fragment)) {
      return { form: "invalid", reason: "fragment_not_base64url" };
    }
    return {
      form: "fragment",
      handle: fragmentFormMatch[1]!,
      k_read: fragment,
    };
  }

  return { form: "invalid", reason: "path_does_not_match_wyrd_url" };
}

/**
 * Construct a fragment-form URL from a handle and K_read.
 */
export function buildFragmentUrl(
  origin: string,
  handle: Base64Url,
  k_read: Base64Url,
): string {
  return `${origin}/w/${handle}#${k_read}`;
}

/**
 * Construct a public-path-form URL from a handle and K_read.
 */
export function buildPublicUrl(
  origin: string,
  handle: Base64Url,
  k_read: Base64Url,
): string {
  return `${origin}/w/${handle}/k/${k_read}`;
}
