/**
 * Author-side record of published wyrds, kept locally so the My Wyrds page
 * can fetch replies for each one without re-deriving from a recovery sweep.
 *
 * Stored in localStorage under STORAGE_KEY as a JSON array.
 *
 * Persisted fields are non-secret: handle, n (HD index), k_origin_pub,
 * published_at, expires_at, replies_enabled, k_read (the read key, which
 * the author needs to view their own wyrds; not a secret beyond the share
 * URL itself).
 *
 * `k_read_b64u` is optional only for legacy entries left over from the v1
 * scheme where K_read was per-wyrd random. New wyrds derive K_read from the
 * seed (HKDF) so recovery reconstructs everything; entries authored under
 * the old random-K_read scheme are still re-decryptable via their stored
 * key but cannot be reconstructed by a mnemonic-only sweep. `recovered: true`
 * still flags entries reconstructed via the sweep.
 */

"use client";

const STORAGE_KEY = "sendwyrd:history:v1";

export interface HistoryEntry {
  handle: string;
  n: number;
  k_origin_pub_b64u: string;
  /** Per-wyrd 32-byte read key, base64url. Absent only on legacy entries
   * (random-K_read scheme) reconstructed via mnemonic sweep. */
  k_read_b64u?: string;
  published_at: number;
  expires_at: number;
  replies_enabled: boolean;
  /** Optional client-side nickname; never transmitted to the host. */
  nickname?: string;
  /**
   * Local tombstone marker. Set when the author has burned the wyrd from
   * this device, or when a fetch surfaced a 410 tombstone for it. The host
   * is the source of truth; this is just a UX hint so the page doesn't
   * surface burned rows as still-live.
   */
  gone_at?: number;
  gone_reason?: "burned" | "expired";
  /** True if this entry was reconstructed via HD recovery sweep. */
  recovered?: boolean;
}

export function listHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  const all = listHistory();
  all.unshift(entry); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Merge new entries into history, deduping by handle.
 * Existing entries take precedence (we never overwrite a local entry that
 * has k_read_b64u with a recovered one that lacks it). Returns the count
 * of newly added entries.
 */
export function mergeHistoryEntries(entries: HistoryEntry[]): number {
  if (typeof window === "undefined") return 0;
  const existing = listHistory();
  const byHandle = new Map<string, HistoryEntry>();
  for (const e of existing) byHandle.set(e.handle, e);
  let added = 0;
  for (const e of entries) {
    if (byHandle.has(e.handle)) continue;
    byHandle.set(e.handle, e);
    added++;
  }
  // Sort newest-first by published_at.
  const merged = Array.from(byHandle.values()).sort(
    (a, b) => b.published_at - a.published_at,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return added;
}

/** Rename (or clear by passing empty string) a wyrd's local nickname. */
export function renameHistoryEntry(handle: string, nickname: string): void {
  if (typeof window === "undefined") return;
  const all = listHistory();
  const idx = all.findIndex((e) => e.handle === handle);
  if (idx === -1) return;
  const trimmed = nickname.trim();
  all[idx] = { ...all[idx]!, nickname: trimmed || undefined };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Mark a history entry as burned (or otherwise gone). Idempotent — re-marking
 * does not overwrite an earlier `gone_at`. Used after a successful local burn,
 * or when a 410 surfaces during fetch.
 */
export function markHistoryEntryGone(
  handle: string,
  reason: "burned" | "expired",
  gone_at: number = Date.now(),
): void {
  if (typeof window === "undefined") return;
  const all = listHistory();
  const idx = all.findIndex((e) => e.handle === handle);
  if (idx === -1) return;
  if (all[idx]!.gone_at) return; // already marked
  all[idx] = { ...all[idx]!, gone_at, gone_reason: reason };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
