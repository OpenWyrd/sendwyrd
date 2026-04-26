/**
 * Typed API client for SendWyrd. Same-origin (`/api/v1/*`).
 */

import {
  b64uDecode,
  b64uEncode,
  deleteMessage,
  schnorrSign,
  type DeleteResponse,
  type FetchEnvelopeResponse,
  type PublishRequest,
  type PublishResponse,
  type TombstoneResponse,
} from "@sendwyrd/core";

const BASE = "/api/v1";
const PROTOCOL_HEADER = { "MOP-Protocol-Version": "1" };

export type ApiError = { error: string } & Record<string, unknown>;

export type FetchResult =
  | { kind: "live"; data: FetchEnvelopeResponse }
  | { kind: "gone"; data: TombstoneResponse }
  | { kind: "not_found" }
  | { kind: "error"; status: number; body: ApiError };

/**
 * Result of a burn (DELETE) attempt.
 *
 * - `burned`: server accepted and tombstoned the wyrd.
 * - `already_gone`: server returned 410 — the wyrd is already burned/expired.
 *   Operationally idempotent; surface a calm message.
 * - `not_found`: 404 — the handle is unknown to the host.
 * - `signature_invalid`: 422 with `error: "signature_invalid"`. K_origin_priv
 *   didn't sign the right message (real error — bug or wrong key).
 * - `error`: anything else (network, 5xx, malformed).
 */
export type BurnResult =
  | { kind: "burned"; data: DeleteResponse }
  | { kind: "already_gone"; data: TombstoneResponse }
  | { kind: "not_found" }
  | { kind: "signature_invalid" }
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
  const res = await fetch(`${BASE}/wyrds/${handle}`, {
    headers: PROTOCOL_HEADER,
  });
  if (res.ok)
    return { kind: "live", data: (await res.json()) as FetchEnvelopeResponse };
  if (res.status === 410) {
    return { kind: "gone", data: (await res.json()) as TombstoneResponse };
  }
  if (res.status === 404) return { kind: "not_found" };
  const body = (await res
    .json()
    .catch(() => ({ error: "unknown" }))) as ApiError;
  return { kind: "error", status: res.status, body };
}

/**
 * Burn a wyrd via Schnorr-signed DELETE per spec §12.
 *
 * Signs `delete_message` with `k_origin_priv` and submits.
 * Caller must have already derived k_origin_priv from the seed at the wyrd's
 * HD index n. This function never touches storage; collisions and history
 * mutation are the caller's concern.
 */
export async function burnWyrd(args: {
  handle: string;
  k_origin_priv: Uint8Array;
}): Promise<BurnResult> {
  const handleBytes = b64uDecode(args.handle);
  const ts = Date.now();
  const messageHash = deleteMessage({
    handle: handleBytes,
    delete_timestamp_ms: ts,
  });
  const signature = schnorrSign(messageHash, args.k_origin_priv);

  const res = await fetch(`${BASE}/wyrds/${args.handle}`, {
    method: "DELETE",
    headers: { ...PROTOCOL_HEADER, "Content-Type": "application/json" },
    body: JSON.stringify({
      delete_signature: b64uEncode(signature),
      delete_timestamp_ms: ts,
    }),
  });

  if (res.ok) {
    return { kind: "burned", data: (await res.json()) as DeleteResponse };
  }
  if (res.status === 410) {
    return {
      kind: "already_gone",
      data: (await res.json()) as TombstoneResponse,
    };
  }
  if (res.status === 404) return { kind: "not_found" };
  const body = (await res
    .json()
    .catch(() => ({ error: "unknown" }))) as ApiError;
  if (res.status === 422 && body.error === "signature_invalid") {
    return { kind: "signature_invalid" };
  }
  return { kind: "error", status: res.status, body };
}
