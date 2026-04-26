/**
 * HD recovery sweep — given a BIP-39 mnemonic, derive K_origin keys along
 * `m/300'/n'` (per ADR-017) and ask the host which handles exist for each
 * derived pub via the §15 presence-check endpoint.
 *
 * Sweep terminates when `gap` consecutive empty derivations is hit
 * (BIP-44 gap-limit convention; default 20). The highest occupied index
 * + 1 becomes the recovered counter.
 *
 * Lightly parallelized in batches of CONCURRENCY (5) — well below the
 * spec §16 rate-limit of 10 presence-check requests / IP / minute averaged
 * over time, but fast in practice given burst tolerance and the fact that
 * an empty sweep terminates after 20 calls anyway.
 */

import {
  b64uEncode,
  deriveOriginKey,
  isValidMnemonic,
  mnemonicToSeed,
  presenceCheckMessage,
  schnorrSign,
  type PresenceCheckResponse,
} from "@sendwyrd/core";
import type { HistoryEntry } from "./wyrdHistory";

export const GAP_LIMIT = 20;
export const CONCURRENCY = 5;

export type SweepProgress =
  | { kind: "starting" }
  | { kind: "deriving"; n: number; gap: number; foundHandles: number }
  | { kind: "done"; foundHandles: number; nextN: number };

export interface SweepResult {
  /** All recovered entries, ready to merge into wyrdHistory. */
  entries: HistoryEntry[];
  /** The recovered next-free-index counter (highest occupied + 1, or 0). */
  nextN: number;
  /** Total handles found across all derivations. */
  foundHandles: number;
}

export type SweepError =
  | { kind: "invalid_mnemonic" }
  | { kind: "network"; detail: string }
  | { kind: "signature_mismatch"; n: number };

/**
 * Run a presence-check at index `n`. Returns the array of handles, or
 * throws on transport failure / signature failure (the latter is a bug
 * since we just signed it ourselves with the matching key).
 */
async function presenceCheckAt(
  seed: Uint8Array,
  n: number,
): Promise<{
  handles: PresenceCheckResponse["handles"];
  k_origin_pub_b64u: string;
}> {
  const k = deriveOriginKey(seed, n);
  const ts = Date.now();
  const messageHash = presenceCheckMessage({
    k_origin_pub: k.k_origin_pub,
    presence_timestamp_ms: ts,
  });
  const signature = schnorrSign(messageHash, k.k_origin_priv);
  const auth = `${b64uEncode(signature)}:${ts}`;
  const k_origin_pub_b64u = b64uEncode(k.k_origin_pub);

  const res = await fetch(
    `/api/v1/authors/${k_origin_pub_b64u}/handles`,
    {
      headers: {
        "MOP-Protocol-Version": "1",
        "X-Mop-Auth": auth,
      },
    },
  );

  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    if (body && (body as { error?: string }).error === "signature_invalid") {
      throw new Error("signature_mismatch");
    }
  }
  if (!res.ok) {
    throw new Error(`presence_check_failed_${res.status}`);
  }
  const data = (await res.json()) as PresenceCheckResponse;
  return { handles: data.handles, k_origin_pub_b64u };
}

/**
 * Sweep the host for all wyrds derived from this mnemonic.
 *
 * @param mnemonic 12- or 24-word BIP-39 phrase.
 * @param passphrase Optional BIP-39 passphrase (NOT the storage passphrase).
 * @param onProgress Called with progress updates during the sweep.
 */
export async function sweepFromMnemonic(args: {
  mnemonic: string;
  passphrase?: string;
  onProgress?: (p: SweepProgress) => void;
}): Promise<SweepResult> {
  const { mnemonic, passphrase = "", onProgress } = args;

  if (!isValidMnemonic(mnemonic)) {
    throw Object.assign(new Error("invalid_mnemonic"), {
      sweepError: { kind: "invalid_mnemonic" } satisfies SweepError,
    });
  }

  const seed = mnemonicToSeed(mnemonic, passphrase);
  onProgress?.({ kind: "starting" });

  const entries: HistoryEntry[] = [];
  let n = 0;
  let gap = 0;
  let highestOccupied = -1;

  // Sweep in batches of CONCURRENCY. Within a batch, we can't terminate
  // early on gap because results come back together — we accept up to
  // CONCURRENCY-1 wasted calls past the true terminator, which is a tiny
  // overshoot (a few KB of wasted bandwidth at most).
  while (gap < GAP_LIMIT) {
    const batchStart = n;
    const batchSize = Math.min(CONCURRENCY, GAP_LIMIT - gap);
    const indices = Array.from({ length: batchSize }, (_, i) => batchStart + i);

    const results = await Promise.all(
      indices.map(async (idx) => {
        try {
          return { idx, ok: true as const, ...(await presenceCheckAt(seed, idx)) };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "signature_mismatch") {
            throw Object.assign(new Error("signature_mismatch"), {
              sweepError: { kind: "signature_mismatch", n: idx } satisfies SweepError,
            });
          }
          return { idx, ok: false as const, error: msg };
        }
      }),
    );

    // Process results in order so gap accounting matches a sequential sweep.
    let stop = false;
    for (const r of results) {
      if (!r.ok) {
        throw Object.assign(new Error(r.error), {
          sweepError: { kind: "network", detail: r.error } satisfies SweepError,
        });
      }
      if (r.handles.length > 0) {
        for (const h of r.handles) {
          entries.push({
            handle: h.handle,
            n: r.idx,
            k_origin_pub_b64u: r.k_origin_pub_b64u,
            // k_read_b64u intentionally omitted — not seed-derivable.
            published_at: h.published_at,
            expires_at: h.expires_at,
            replies_enabled: h.replies_enabled,
            recovered: true,
          });
        }
        gap = 0;
        highestOccupied = Math.max(highestOccupied, r.idx);
      } else {
        gap += 1;
        if (gap >= GAP_LIMIT) {
          stop = true;
        }
      }
      onProgress?.({
        kind: "deriving",
        n: r.idx + 1,
        gap,
        foundHandles: entries.length,
      });
    }
    n = batchStart + batchSize;
    if (stop) break;
  }

  const nextN = highestOccupied + 1;
  onProgress?.({
    kind: "done",
    foundHandles: entries.length,
    nextN,
  });

  return { entries, nextN, foundHandles: entries.length };
}
