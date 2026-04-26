/**
 * Author-side record of published wyrds, kept locally so the inbox can
 * fetch replies for each one without re-deriving from a recovery sweep.
 *
 * Stored in localStorage under STORAGE_KEY as a JSON array.
 *
 * Persisted fields are non-secret: handle, n (HD index), k_origin_pub,
 * published_at, expires_at, replies_enabled, k_read (the read key, which
 * the author needs to view their own wyrds; not a secret beyond the share
 * URL itself).
 */

"use client";

const STORAGE_KEY = "sendwyrd:history:v1";

export interface HistoryEntry {
  handle: string;
  n: number;
  k_origin_pub_b64u: string;
  k_read_b64u: string;
  published_at: number;
  expires_at: number;
  replies_enabled: boolean;
  /** Optional client-side nickname; never transmitted to the host. */
  nickname?: string;
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
