/**
 * Browser-side seed management.
 *
 * Persistence: encrypted seed record (passphrase-protected, AES-256-GCM,
 * PBKDF2-SHA256) stored in localStorage under STORAGE_KEY. Plaintext seed
 * never touches disk.
 *
 * Session cache: once the user enters their passphrase, the decrypted seed
 * lives in a module-level variable for the rest of the tab's lifetime
 * (cleared on visibilitychange→hidden after IDLE_MS, per renderer-contract
 * §17.1).
 */

"use client";

import {
  decryptSeedRecord,
  encryptSeedRecord,
  type SeedAndCounter,
} from "@sendwyrd/core";

const STORAGE_KEY = "sendwyrd:seed:v1";
const IDLE_MS = 30 * 60 * 1000;

let cached: SeedAndCounter | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function armIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    cached = null;
  }, IDLE_MS);
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      cached = null;
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    }
  });
}

/** Whether an encrypted seed record is present in localStorage. */
export function hasSeed(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(STORAGE_KEY);
}

/** Whether the seed is currently unlocked in memory. */
export function isUnlocked(): boolean {
  return cached !== null;
}

/** Persist a fresh seed under a passphrase. Overwrites any existing record. */
export async function storeSeed(args: {
  seed: Uint8Array;
  counter: number;
  passphrase: string;
}): Promise<void> {
  const record = await encryptSeedRecord(args);
  localStorage.setItem(STORAGE_KEY, record);
  cached = { seed: args.seed, counter: args.counter };
  armIdleTimer();
}

/** Load and decrypt the seed using the user's passphrase. */
export async function unlockSeed(passphrase: string): Promise<SeedAndCounter> {
  const record = localStorage.getItem(STORAGE_KEY);
  if (!record) throw new Error("no_seed_stored");
  const data = await decryptSeedRecord(record, passphrase);
  cached = data;
  armIdleTimer();
  return data;
}

/** Get the unlocked seed (or null if locked / not stored). */
export function getSeed(): SeedAndCounter | null {
  if (cached) armIdleTimer();
  return cached;
}

/**
 * Increment the counter after a publish, persist, return the consumed `n`.
 * Caller MUST persist before publish per spec §5.2 — this function persists
 * synchronously but does NOT publish. Caller publishes after.
 */
export async function consumeNextIndex(passphrase: string): Promise<number> {
  if (!cached) throw new Error("seed_locked");
  const n = cached.counter;
  const next: SeedAndCounter = { seed: cached.seed, counter: n + 1 };
  await storeSeed({ ...next, passphrase });
  cached = next;
  return n;
}

/** Wipe the local seed record. Use with care. */
export function forgetSeed(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  cached = null;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}
