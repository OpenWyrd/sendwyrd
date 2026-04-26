/**
 * Sentry beforeSend redaction — renderer-contract v1 §16.
 *
 * Worker-side parallel of packages/web/src/lib/sentryRedact.ts. The two
 * are intentionally near-duplicates for v1 — refactor to a shared core
 * later if the divergence becomes a maintenance cost.
 *
 * The api never decrypts wyrd bodies (host-blind by architecture), but
 * inbound POSTs carry the encrypted envelope, K_origin_pub, and
 * signatures. None of that should reach a third-party error reporter.
 */

import type { ErrorEvent, Breadcrumb } from "@sentry/core";

const B64U_43_CHAR_RE = /[A-Za-z0-9_-]{43}/g;
const K_PATH_SEGMENT_RE = /\/k\/[A-Za-z0-9_-]{43}/g;

function stripFragment(url: string): string {
  const hashIdx = url.indexOf("#");
  return hashIdx >= 0 ? url.slice(0, hashIdx) : url;
}

function stripQuery(url: string): string {
  const qIdx = url.indexOf("?");
  return qIdx >= 0 ? url.slice(0, qIdx) : url;
}

function scrubKPath(s: string): string {
  return s.replace(K_PATH_SEGMENT_RE, "/k/[redacted]");
}

function scrubB64uKeys(s: string): string {
  return s.replace(B64U_43_CHAR_RE, "[redacted-43char]");
}

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
      out[k] = scrubB64uKeys(scrubKPath(v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

function redactBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (b.category === "console") return null;
  if (b.category === "storage") return null;
  if (b.type === "http" || b.category === "fetch" || b.category === "xhr") {
    if (b.data && typeof b.data === "object") {
      const data: Record<string, unknown> = { ...b.data };
      if (typeof data.url === "string") {
        data.url = scrubUrl(data.url);
      }
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

export function redactBeforeSend(event: ErrorEvent): ErrorEvent | null {
  try {
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

    if (event.breadcrumbs && event.breadcrumbs.length > 0) {
      event.breadcrumbs = event.breadcrumbs
        .map(redactBreadcrumb)
        .filter((b): b is Breadcrumb => b !== null);
    }

    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (typeof ex.value === "string") {
          ex.value = scrubB64uKeys(scrubKPath(ex.value));
        }
        if (ex.stacktrace?.frames) {
          for (const frame of ex.stacktrace.frames) {
            if (frame.vars) frame.vars = undefined;
            if (typeof frame.filename === "string") {
              frame.filename = scrubKPath(stripFragment(frame.filename));
            }
          }
        }
      }
    }

    if (typeof event.message === "string") {
      event.message = scrubB64uKeys(scrubKPath(event.message));
    }

    if (event.extra) {
      for (const [k, v] of Object.entries(event.extra)) {
        if (typeof v === "string") {
          event.extra[k] = scrubB64uKeys(scrubKPath(v));
        }
      }
    }

    if (event.transaction) {
      event.transaction = scrubKPath(event.transaction);
    }

    if (event.tags) {
      for (const [k, v] of Object.entries(event.tags)) {
        if (typeof v === "string") {
          event.tags[k] = scrubB64uKeys(scrubKPath(v));
        }
      }
    }

    return event;
  } catch {
    return null;
  }
}
