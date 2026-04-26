/**
 * Typed API client for SendWyrd. Same-origin (`/api/v1/*`).
 */

import type {
  PublishRequest,
  PublishResponse,
  FetchEnvelopeResponse,
  TombstoneResponse,
} from "@sendwyrd/core";

const BASE = "/api/v1";
const PROTOCOL_HEADER = { "MOP-Protocol-Version": "1" };

export type ApiError = { error: string } & Record<string, unknown>;

export type FetchResult =
  | { kind: "live"; data: FetchEnvelopeResponse }
  | { kind: "gone"; data: TombstoneResponse }
  | { kind: "not_found" }
  | { kind: "error"; status: number; body: ApiError };

export async function publishWyrd(
  payload: PublishRequest,
): Promise<PublishResponse | ApiError> {
  const res = await fetch(`${BASE}/wyrds`, {
    method: "POST",
    headers: { ...PROTOCOL_HEADER, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) return (await res.json()) as PublishResponse;
  return (await res.json().catch(() => ({ error: "unknown" }))) as ApiError;
}

export async function fetchWyrd(handle: string): Promise<FetchResult> {
  const res = await fetch(`${BASE}/wyrds/${handle}`, { headers: PROTOCOL_HEADER });
  if (res.ok) return { kind: "live", data: (await res.json()) as FetchEnvelopeResponse };
  if (res.status === 410) {
    return { kind: "gone", data: (await res.json()) as TombstoneResponse };
  }
  if (res.status === 404) return { kind: "not_found" };
  const body = (await res.json().catch(() => ({ error: "unknown" }))) as ApiError;
  return { kind: "error", status: res.status, body };
}
