"use client";

/**
 * Persistent storage helpers — request the browser to keep our localStorage /
 * IndexedDB from being evicted under storage pressure, and surface a passive
 * estimate so a curious user can see how much they're using.
 *
 * Honesty contract (cypherpunk register, no marketing fluff):
 *   - Browsers may grant persistence silently, or only after meeting heuristics
 *     (Chrome: PWA installed + notifications + bookmark activity; Firefox:
 *     prompt; Safari: never returns true). We do NOT pretend persistence
 *     equals durability. The mnemonic is the recovery path.
 *   - We call persist() exactly once — on first explicit save (compose
 *     completes, or onboarding "Set passphrase"). Subsequent calls are noops
 *     because storage.persist() is idempotent.
 *
 * Public API:
 *   requestPersistence() → { granted, supported } (resolves; never throws)
 *   getPersistenceState() → snapshot for the UI advisory
 *   getStorageEstimate() → { usage, quota, percent } | null
 */

const FLAG_KEY = "sendwyrd:persist-asked";

interface PersistenceState {
  supported: boolean;
  granted: boolean | null; // null = supported but not yet asked
  asked: boolean;
}

export async function requestPersistence(): Promise<PersistenceState> {
  if (typeof navigator === "undefined" || !navigator.storage || !("persist" in navigator.storage)) {
    return { supported: false, granted: null, asked: false };
  }
  try {
    const already = await navigator.storage.persisted();
    if (already) {
      try { localStorage.setItem(FLAG_KEY, "1"); } catch {}
      return { supported: true, granted: true, asked: true };
    }
    const granted = await navigator.storage.persist();
    try { localStorage.setItem(FLAG_KEY, "1"); } catch {}
    return { supported: true, granted, asked: true };
  } catch {
    return { supported: true, granted: false, asked: true };
  }
}

export async function getPersistenceState(): Promise<PersistenceState> {
  if (typeof navigator === "undefined" || !navigator.storage || !("persisted" in navigator.storage)) {
    return { supported: false, granted: null, asked: false };
  }
  let asked = false;
  try { asked = localStorage.getItem(FLAG_KEY) === "1"; } catch {}
  try {
    const granted = await navigator.storage.persisted();
    return { supported: true, granted, asked };
  } catch {
    return { supported: true, granted: null, asked };
  }
}

export interface StorageEstimate {
  usage: number;
  quota: number;
  percent: number;
}

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (typeof navigator === "undefined" || !navigator.storage || !("estimate" in navigator.storage)) {
    return null;
  }
  try {
    const e = await navigator.storage.estimate();
    const usage = e.usage ?? 0;
    const quota = e.quota ?? 0;
    const percent = quota > 0 ? (usage / quota) * 100 : 0;
    return { usage, quota, percent };
  } catch {
    return null;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
