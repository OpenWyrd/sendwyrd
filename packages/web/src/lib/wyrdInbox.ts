/**
 * Recipient-side viewing log of opened wyrds, kept entirely browser-local.
 * Per ADR-024: the relay has no concept of recipient identity, so any
 * "inbox" is necessarily a viewing log of capability URLs the user has
 * opened in this browser. Never queried from the relay. Never recoverable
 * from the BIP-39 seed (there is nothing relay-side to reconstruct from).
 *
 * Stored in localStorage under STORAGE_KEY as a JSON array.
 *
 * Persisted fields are exactly what the user already has by virtue of
 * opening the URL: the handle and the read key. No author key, no HD
 * index — the user is not the author. Liveness is re-fetched at view
 * time; we don't cache decrypted plaintext.
 */

"use client";

const STORAGE_KEY = "sendwyrd:inbox:v1";
const SETTINGS_KEY = "sendwyrd:inbox:autorecord:v1";

export interface InboxEntry {
  handle: string;
  /** 43-char base64url read key from the URL fragment. */
  k_read_b64u: string;
  /** First time this URL was opened in this browser. */
  first_seen_at: number;
  /** Most recent open. Updated on subsequent decrypts of the same handle. */
  last_viewed_at: number;
  /** Optional client-side nickname; never transmitted. */
  nickname?: string;
}

export function listInbox(): InboxEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as InboxEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Record a viewed wyrd. Idempotent on `handle`: subsequent calls for the
 * same handle bump `last_viewed_at` and preserve `first_seen_at` + nickname.
 *
 * Pass authoredHandles (the set of handles the user has authored, from
 * wyrdHistory) to skip self-authored wyrds — those belong in outbox, not
 * inbox.
 */
export function recordInboxView(args: {
  handle: string;
  k_read_b64u: string;
  authoredHandles: Set<string>;
  now?: number;
}): void {
  if (typeof window === "undefined") return;
  if (!isAutoRecordEnabled()) return;
  if (args.authoredHandles.has(args.handle)) return;
  const now = args.now ?? Date.now();
  const all = listInbox();
  const idx = all.findIndex((e) => e.handle === args.handle);
  if (idx !== -1) {
    all[idx] = {
      ...all[idx]!,
      k_read_b64u: args.k_read_b64u,
      last_viewed_at: now,
    };
  } else {
    all.unshift({
      handle: args.handle,
      k_read_b64u: args.k_read_b64u,
      first_seen_at: now,
      last_viewed_at: now,
    });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function removeInboxEntry(handle: string): void {
  if (typeof window === "undefined") return;
  const all = listInbox().filter((e) => e.handle !== handle);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function clearInbox(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function renameInboxEntry(handle: string, nickname: string): void {
  if (typeof window === "undefined") return;
  const all = listInbox();
  const idx = all.findIndex((e) => e.handle === handle);
  if (idx === -1) return;
  const trimmed = nickname.trim();
  all[idx] = { ...all[idx]!, nickname: trimmed || undefined };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Whether the auto-record-on-view behavior is enabled. Default: true.
 * Users can opt out via /settings.
 */
export function isAutoRecordEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw === null) return true; // default on
  return raw === "true";
}

export function setAutoRecordEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, enabled ? "true" : "false");
}
