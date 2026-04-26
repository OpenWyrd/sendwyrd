/**
 * Resolve transitive sendwyrd:// references in a body.
 *
 * For each sendwyrd:// URL: fetch the referenced wyrd, decrypt with the
 * embedded K_read, return a typed result. Caller passes the result map to
 * <WyrdBody>, which renders inline preview cards.
 *
 * Per renderer-contract §8: depth cap = 2 (this implementation handles
 * depth 1 — the originally-displayed wyrd is depth 0; references inside it
 * are depth 1; deeper references are not auto-resolved in v1). Reference
 * budget = 20 fetches per render pass.
 */

import {
  decryptFromBase64Url,
  b64uDecode,
  parseSendwyrdUrl,
  parseBody,
} from "@sendwyrd/core";

interface SendwyrdSeg {
  kind: "url";
  url: string;
  type: "sendwyrd";
  hostname: string;
}

const REFERENCE_BUDGET = 20;
const API_BASE = "https://sendwyrd.com/api/v1";

export type ResolvedRef =
  | {
      kind: "ready";
      handle: string;
      body: string;
      published_at: number;
      expires_at: number;
    }
  | { kind: "gone"; handle: string; reason: string; gone_at: string }
  | { kind: "missing"; handle: string }
  | { kind: "error"; handle: string };

export type ResolutionMap = Record<string, ResolvedRef>;

/**
 * Walk a body's segments and resolve every sendwyrd:// reference.
 * Returns a map keyed by the canonical URL string (the segment's url).
 */
export async function resolveTransitives(body: string): Promise<ResolutionMap> {
  const segments = parseBody(body);
  const sendwyrdSegs = segments.filter(
    (s): s is SendwyrdSeg => s.kind === "url" && s.type === "sendwyrd",
  );

  const toResolve = sendwyrdSegs.slice(0, REFERENCE_BUDGET);
  const map: ResolutionMap = {};
  await Promise.all(
    toResolve.map(async (seg) => {
      map[seg.url] = await resolveOne(seg.url);
    }),
  );
  return map;
}

async function resolveOne(url: string): Promise<ResolvedRef> {
  const parsed = parseSendwyrdUrl(url);
  if (!parsed) return { kind: "error", handle: "" };
  const { handle, k_read } = parsed;
  try {
    const res = await fetch(`${API_BASE}/wyrds/${handle}`, {
      headers: { "MOP-Protocol-Version": "1" },
      cache: "no-store",
    });
    if (res.status === 404) return { kind: "missing", handle };
    if (res.status === 410) {
      const t = await res.json();
      return {
        kind: "gone",
        handle,
        reason: t.reason ?? "expired",
        gone_at: t.gone_at,
      };
    }
    if (!res.ok) return { kind: "error", handle };
    const data = await res.json();
    const handleBytes = b64uDecode(data.handle);
    const k_read_bytes = b64uDecode(k_read);
    const body = await decryptFromBase64Url(data.envelope, {
      k_read: k_read_bytes,
      handle: handleBytes,
      expires_at_ms: data.expires_at,
      replies_enabled: data.replies_enabled,
    });
    return {
      kind: "ready",
      handle,
      body,
      published_at: data.published_at,
      expires_at: data.expires_at,
    };
  } catch {
    return { kind: "error", handle };
  }
}
