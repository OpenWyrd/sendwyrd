/**
 * Thin HTTP client over the SendWyrd api worker. All bytes-on-wire are
 * base64url; signing happens here for endpoints that require it.
 *
 * Mirrors the publish/fetch/burn/replies/presence-check shapes from
 * `packages/api/src/routes/`.
 */

import {
  b64uDecode,
  b64uEncode,
  deleteMessage,
  fetchRepliesMessage,
  presenceCheckMessage,
  schnorrSign,
  type Base64Url,
} from "@sendwyrd/core";

export interface PublishPayload {
  handle: Base64Url;
  envelope: Base64Url;
  k_origin_pub: Base64Url;
  ttl_seconds: number;
  replies_enabled: boolean;
  publish_signature: Base64Url;
  publish_timestamp_ms: number;
}

export interface PublishResponse {
  handle: Base64Url;
  published_at: number;
  expires_at: number;
}

export interface FetchEnvelopeResponse {
  handle: Base64Url;
  envelope: Base64Url;
  k_origin_pub: Base64Url;
  published_at: number;
  expires_at: number;
  replies_enabled: boolean;
}

export interface TombstoneResponse {
  status: "gone";
  reason: "expired" | "burned" | "key_mismatch";
  gone_at: string;
}

export type FetchResult =
  | { kind: "live"; data: FetchEnvelopeResponse }
  | { kind: "gone"; data: TombstoneResponse }
  | { kind: "not_found" }
  | { kind: "error"; status: number; body: unknown };

export type BurnResult =
  | {
      kind: "burned";
      data: { handle: Base64Url; gone_at: number; gone_reason: "burned" };
    }
  | { kind: "already_gone"; data: TombstoneResponse }
  | { kind: "not_found" }
  | { kind: "error"; status: number; body: unknown };

export interface PresenceHandle {
  handle: Base64Url;
  published_at: number;
  expires_at: number;
  gone_at: number | null;
  gone_reason: "expired" | "burned" | "key_mismatch" | null;
  replies_enabled: boolean;
}

export interface PresenceResponse {
  k_origin_pub: Base64Url;
  handles: PresenceHandle[];
}

export interface ReplyEntry {
  reply_blob: Base64Url;
  received_at: number;
}

const HEADERS_BASE = { "MOP-Protocol-Version": "1" };

export async function publish(
  origin: string,
  payload: PublishPayload,
): Promise<PublishResponse> {
  const res = await fetch(`${origin}/api/v1/wyrds`, {
    method: "POST",
    headers: { ...HEADERS_BASE, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status !== 201) {
    const body = await safeBody(res);
    throw new Error(`publish failed: HTTP ${res.status} — ${stringify(body)}`);
  }
  return (await res.json()) as PublishResponse;
}

export async function fetchWyrd(
  origin: string,
  handle: Base64Url,
): Promise<FetchResult> {
  const res = await fetch(`${origin}/api/v1/wyrds/${handle}`, {
    method: "GET",
    headers: HEADERS_BASE,
  });
  if (res.status === 200) {
    return { kind: "live", data: (await res.json()) as FetchEnvelopeResponse };
  }
  if (res.status === 410) {
    return { kind: "gone", data: (await res.json()) as TombstoneResponse };
  }
  if (res.status === 404) return { kind: "not_found" };
  return { kind: "error", status: res.status, body: await safeBody(res) };
}

export async function burn(
  origin: string,
  args: { handle: Base64Url; k_origin_priv: Uint8Array },
): Promise<BurnResult> {
  const handleBytes = b64uDecode(args.handle);
  const delete_timestamp_ms = Date.now();
  const messageHash = deleteMessage({
    handle: handleBytes,
    delete_timestamp_ms,
  });
  const sig = schnorrSign(messageHash, args.k_origin_priv);
  const body = {
    delete_signature: b64uEncode(sig),
    delete_timestamp_ms,
  };
  const res = await fetch(`${origin}/api/v1/wyrds/${args.handle}`, {
    method: "DELETE",
    headers: { ...HEADERS_BASE, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 200) {
    const data = (await res.json()) as {
      handle: Base64Url;
      gone_at: number;
      gone_reason: "burned";
    };
    return { kind: "burned", data };
  }
  if (res.status === 410) {
    return {
      kind: "already_gone",
      data: (await res.json()) as TombstoneResponse,
    };
  }
  if (res.status === 404) return { kind: "not_found" };
  return { kind: "error", status: res.status, body: await safeBody(res) };
}

export async function fetchReplies(
  origin: string,
  args: { handle: Base64Url; k_origin_priv: Uint8Array },
): Promise<ReplyEntry[]> {
  const handleBytes = b64uDecode(args.handle);
  const fetch_timestamp_ms = Date.now();
  const messageHash = fetchRepliesMessage({
    handle: handleBytes,
    fetch_timestamp_ms,
  });
  const sig = schnorrSign(messageHash, args.k_origin_priv);
  const auth = `${b64uEncode(sig)}:${fetch_timestamp_ms}`;
  const res = await fetch(`${origin}/api/v1/wyrds/${args.handle}/replies`, {
    method: "GET",
    headers: { ...HEADERS_BASE, "X-Mop-Auth": auth },
  });
  if (res.status === 200) {
    const body = (await res.json()) as {
      handle: string;
      replies: ReplyEntry[];
    };
    return body.replies;
  }
  if (res.status === 404) return [];
  if (res.status === 410) return [];
  const body = await safeBody(res);
  throw new Error(`fetch_replies failed: HTTP ${res.status} — ${stringify(body)}`);
}

export async function submitReply(
  origin: string,
  args: { handle: Base64Url; reply_blob: Base64Url },
): Promise<{ received_at: number }> {
  const submit_timestamp_ms = Date.now();
  const res = await fetch(`${origin}/api/v1/wyrds/${args.handle}/replies`, {
    method: "POST",
    headers: { ...HEADERS_BASE, "Content-Type": "application/json" },
    body: JSON.stringify({
      reply_blob: args.reply_blob,
      submit_timestamp_ms,
    }),
  });
  if (res.status === 202) {
    return (await res.json()) as { received_at: number };
  }
  const body = await safeBody(res);
  throw new Error(
    `submit_reply failed: HTTP ${res.status} — ${stringify(body)}`,
  );
}

export async function presenceCheck(
  origin: string,
  args: {
    k_origin_pub: Uint8Array;
    k_origin_priv: Uint8Array;
  },
): Promise<PresenceResponse> {
  const presence_timestamp_ms = Date.now();
  const messageHash = presenceCheckMessage({
    k_origin_pub: args.k_origin_pub,
    presence_timestamp_ms,
  });
  const sig = schnorrSign(messageHash, args.k_origin_priv);
  const auth = `${b64uEncode(sig)}:${presence_timestamp_ms}`;
  const k_origin_pub_b64u = b64uEncode(args.k_origin_pub);
  const res = await fetch(
    `${origin}/api/v1/authors/${k_origin_pub_b64u}/handles`,
    {
      method: "GET",
      headers: { ...HEADERS_BASE, "X-Mop-Auth": auth },
    },
  );
  if (res.status !== 200) {
    const body = await safeBody(res);
    throw new Error(
      `presence_check failed: HTTP ${res.status} — ${stringify(body)}`,
    );
  }
  return (await res.json()) as PresenceResponse;
}

async function safeBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
}

function stringify(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
