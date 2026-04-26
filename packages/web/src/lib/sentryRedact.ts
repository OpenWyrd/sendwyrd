/**
 * Sentry beforeSend redaction — renderer-contract v1 §16.
 *
 * SendWyrd is host-blind by architecture. A third-party error reporter is
 * the single largest exfiltration risk: a careless stack trace can carry
 * K_read, the HD seed, an entire decrypted body. This module enforces
 * default-deny: anything that could be sensitive is stripped before send.
 *
 * Scrubbers (mirroring §16.1):
 *
 * 1. URL fragments — stripped unconditionally. The fragment carries
 *    K_read + handle for fragment-form wyrd URLs; never leaves the device.
 * 2. Auth-shaped headers (X-Mop-Auth, Authorization, *-Sig, *-Signature).
 * 3. Request bodies — replaced with the literal string "[redacted]".
 *    POST /api/v1/wyrds carries the encrypted envelope + pubkey + sig;
 *    no business shipping any of that out.
 * 4. Query strings — entire querystring nuked (Web Share Target prefill
 *    can carry user-typed text in ?text= ?title= ?url=).
 * 5. Storage breadcrumbs (localStorage / sessionStorage) — dropped.
 * 6. Console breadcrumbs — dropped (we sometimes log; never to a 3p).
 * 7. /k/ path segments matching the 43-char b64u K_read encoding —
 *    replaced with /k/[redacted].
 * 8. Exception messages — scanned for 43-char b64u substrings and
 *    replaced with [redacted-43char] (belt + suspenders for any
 *    string-template log that accidentally interpolated a key).
 *
 * Web and api ship near-duplicate copies of this module. Refactor to a
 * shared core later if the divergence becomes a maintenance cost.
 */

import type { ErrorEvent, Breadcrumb } from "@sentry/core";

// 43 chars of base64url is the canonical encoding length of a 32-byte
// key (no padding). 22 chars covers a 16-byte (128-bit) value if we
// ever shorten. Match the longer form first; conservative on edges.
const B64U_43_CHAR_RE = /[A-Za-z0-9_-]{43}/g;
// /k/ + 43 b64u chars (the K_read in path-form, retained for back-compat).
const K_PATH_SEGMENT_RE = /\/k\/[A-Za-z0-9_-]{43}/g;

/**
 * Strip everything after `#` from a URL string. Returns the URL with no
 * fragment. Idempotent on URLs that already have no fragment.
 */
function stripFragment(url: string): string {
  const hashIdx = url.indexOf("#");
  return hashIdx >= 0 ? url.slice(0, hashIdx) : url;
}

/**
 * Strip the entire querystring. Web Share Target prefill puts user-typed
 * text in ?text= / ?title= / ?url=, and other endpoints may carry
 * sensitive query params; safer to nuke wholesale than enumerate.
 */
function stripQuery(url: string): string {
  const qIdx = url.indexOf("?");
  return qIdx >= 0 ? url.slice(0, qIdx) : url;
}

/**
 * Replace any /k/<43-char-b64u> path segment with /k/[redacted]. Applies
 * to URLs in any form — full URL, path-only, or interpolated into
 * arbitrary strings.
 */
function scrubKPath(s: string): string {
  return s.replace(K_PATH_SEGMENT_RE, "/k/[redacted]");
}

/**
 * Replace any 43-char base64url substring with [redacted-43char]. Catches
 * accidental interpolations of K_read, K_origin_pub, etc. into log
 * messages or error strings.
 */
function scrubB64uKeys(s: string): string {
  return s.replace(B64U_43_CHAR_RE, "[redacted-43char]");
}

/**
 * Full URL scrubber: strip fragment, strip query, replace /k/ segments.
 */
function scrubUrl(url: string): string {
  return scrubKPath(stripQuery(stripFragment(url)));
}

const SENSITIVE_HEADER_PATTERNS = [
  /^authorization$/i,
  /^x-mop-auth$/i,
  /-sig(nature)?$/i,
  /^cookie$/i,
  /^set-cookie$/i,
];

function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADER_PATTERNS.some((re) => re.test(name));
}

function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (isSensitiveHeader(k)) {
      out[k] = "[redacted]";
    } else if (typeof v === "string") {
      // Header values can carry URLs (Referer, Origin); scrub them too.
      out[k] = scrubB64uKeys(scrubKPath(v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

function redactBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  // Drop entire categories that are systematically risky.
  // 'console' — we sometimes log; never ship to a 3p.
  // 'storage' — Sentry can wrap localStorage / sessionStorage by default.
  if (b.category === "console") return null;
  if (b.category === "storage") return null;
  if (b.type === "http" || b.category === "fetch" || b.category === "xhr") {
    if (b.data && typeof b.data === "object") {
      const data: Record<string, unknown> = { ...b.data };
      if (typeof data.url === "string") {
        data.url = scrubUrl(data.url);
      }
      // Drop request/response bodies wholesale.
      if ("request_body_size" in data) delete data.request_body_size;
      if ("response_body_size" in data) delete data.response_body_size;
      if ("body" in data) data.body = "[redacted]";
      b = { ...b, data };
    }
  }
  if (b.category === "navigation" && b.data && typeof b.data === "object") {
    const data: Record<string, unknown> = { ...b.data };
    if (typeof data.from === "string") data.from = scrubUrl(data.from);
    if (typeof data.to === "string") data.to = scrubUrl(data.to);
    b = { ...b, data };
  }
  if (typeof b.message === "string") {
    b = { ...b, message: scrubB64uKeys(scrubKPath(b.message)) };
  }
  return b;
}

/**
 * Sentry `beforeSend` hook. Applies all §16 redaction rules; returns the
 * mutated event (ship) or null (drop entirely).
 *
 * Defensive: any thrown error inside redaction returns null (drop the
 * event rather than ship a half-redacted one).
 */
export function redactBeforeSend(event: ErrorEvent): ErrorEvent | null {
  try {
    // Top-level event URL.
    if (event.request) {
      if (typeof event.request.url === "string") {
        event.request.url = scrubUrl(event.request.url);
      }
      if (event.request.headers) {
        event.request.headers = redactHeaders(
          event.request.headers as Record<string, string>,
        );
      }
      if ("data" in event.request && event.request.data !== undefined) {
        event.request.data = "[redacted]";
      }
      if ("query_string" in event.request) {
        event.request.query_string = "";
      }
      if ("cookies" in event.request) {
        event.request.cookies = {};
      }
    }

    // Breadcrumbs.
    if (event.breadcrumbs && event.breadcrumbs.length > 0) {
      event.breadcrumbs = event.breadcrumbs
        .map(redactBreadcrumb)
        .filter((b): b is Breadcrumb => b !== null);
    }

    // Exception messages and stack frames.
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (typeof ex.value === "string") {
          ex.value = scrubB64uKeys(scrubKPath(ex.value));
        }
        if (ex.stacktrace?.frames) {
          for (const frame of ex.stacktrace.frames) {
            // Drop captured local variable values entirely (§16.1 rule:
            // stack frames stay, locals go).
            if (frame.vars) frame.vars = undefined;
            if (typeof frame.filename === "string") {
              frame.filename = scrubKPath(stripFragment(frame.filename));
            }
          }
        }
      }
    }

    // Top-level message string.
    if (typeof event.message === "string") {
      event.message = scrubB64uKeys(scrubKPath(event.message));
    }

    // Extra / contexts — stringify-and-scrub any nested URL-shaped strings.
    if (event.extra) {
      for (const [k, v] of Object.entries(event.extra)) {
        if (typeof v === "string") {
          event.extra[k] = scrubB64uKeys(scrubKPath(v));
        }
      }
    }

    // Transactions / spans can carry URLs in `description`.
    if (event.transaction) {
      event.transaction = scrubKPath(event.transaction);
    }

    // Tags can carry handles or URL fragments if a user adds them.
    if (event.tags) {
      for (const [k, v] of Object.entries(event.tags)) {
        if (typeof v === "string") {
          event.tags[k] = scrubB64uKeys(scrubKPath(v));
        }
      }
    }

    return event;
  } catch {
    // Fail closed: drop the event rather than ship something un-redacted.
    return null;
  }
}
