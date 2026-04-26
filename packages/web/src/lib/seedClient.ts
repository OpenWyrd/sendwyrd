/**
 * Browser-side seed management. Two modes:
 *
 * - **open** (default): seed stored as JSON in localStorage. Always
 *   available, no unlock step. Trade-off: any JS on the same origin can
 *   read it (XSS, browser extensions, devtools). Per-user choice.
 *
 * - **protected**: seed stored encrypted (PBKDF2-AES-256-GCM). Requires
 *   passphrase per session. Memory-cached after unlock; cleared on tab
 *   visibility-hidden + 30 min idle.
 *
 * One-of-the-two storage keys is populated at any time. Promotion (open
 * → protected) and demotion (protected → open) flow through dedicated
 * helpers.
 */

"use client";

import {
  decryptSeedRecord,
  encryptSeedRecord,
  b64uDecode,
  b64uEncode,
  type SeedAndCounter,
} from "@sendwyrd/core";

const STORAGE_KEY_PROTECTED = "sendwyrd:seed:v1";
const STORAGE_KEY_OPEN = "sendwyrd:open_seed:v1";
const IDLE_MS = 30 * 60 * 1000;

interface OpenSeedJson {
  v: 1;
  counter: number;
  mnemonic: string | null;
  seed_b64u: string;
}

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
      // Only clear cache for protected mode — open mode re-reads localStorage.
      if (getSeedMode() === "protected") {
        cached = null;
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
      }
    }
  });
}

export type SeedMode = "open" | "protected" | null;

export function getSeedMode(): SeedMode {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(STORAGE_KEY_PROTECTED)) return "protected";
  if (localStorage.getItem(STORAGE_KEY_OPEN)) return "open";
  return null;
}

export function hasSeed(): boolean {
  return getSeedMode() !== null;
}

/** Open mode is always unlocked. Protected requires explicit unlock. */
export function isUnlocked(): boolean {
  if (getSeedMode() === "open") return true;
  return cached !== null;
}

/** Get the seed if available (open mode always; protected only if unlocked). */
export function getSeed(): SeedAndCounter | null {
  const mode = getSeedMode();
  if (mode === "open") {
    const raw = localStorage.getItem(STORAGE_KEY_OPEN);
    if (!raw) return null;
    try {
      const j = JSON.parse(raw) as OpenSeedJson;
      return {
        seed: b64uDecode(j.seed_b64u),
        counter: j.counter,
        mnemonic: j.mnemonic ?? undefined,
      };
    } catch {
      return null;
    }
  }
  if (cached) armIdleTimer();
  return cached;
}

/** Store a seed in open (unencrypted) mode. */
export function storeOpenSeed(args: SeedAndCounter): void {
  const json: OpenSeedJson = {
    v: 1,
    counter: args.counter,
    mnemonic: args.mnemonic ?? null,
    seed_b64u: b64uEncode(args.seed),
  };
  localStorage.setItem(STORAGE_KEY_OPEN, JSON.stringify(json));
  localStorage.removeItem(STORAGE_KEY_PROTECTED);
  cached = args;
}

/** Store a seed in protected (passphrase-encrypted) mode. */
export async function storeProtectedSeed(args: SeedAndCounter & { passphrase: string }): Promise<void> {
  const record = await encryptSeedRecord(args);
  localStorage.setItem(STORAGE_KEY_PROTECTED, record);
  localStorage.removeItem(STORAGE_KEY_OPEN);
  cached = { seed: args.seed, counter: args.counter, mnemonic: args.mnemonic };
  armIdleTimer();
}

/** Compatibility alias used elsewhere — defaults to protected. */
export const storeSeed = storeProtectedSeed;

/** Decrypt the protected seed using the user's passphrase. */
export async function unlockSeed(passphrase: string): Promise<SeedAndCounter> {
  const record = localStorage.getItem(STORAGE_KEY_PROTECTED);
  if (!record) throw new Error("no_protected_seed");
  const data = await decryptSeedRecord(record, passphrase);
  cached = data;
  armIdleTimer();
  return data;
}

/**
 * Increment the counter, persist, return the consumed `n`.
 * Open mode: no passphrase needed.
 * Protected mode: passphrase required.
 */
export async function consumeNextIndex(passphrase?: string): Promise<number> {
  const mode = getSeedMode();
  const cur = getSeed();
  if (!cur) throw new Error("no_seed");
  const n = cur.counter;
  const next: SeedAndCounter = {
    seed: cur.seed,
    counter: n + 1,
    mnemonic: cur.mnemonic,
  };
  if (mode === "open") {
    storeOpenSeed(next);
  } else {
    if (!passphrase) throw new Error("passphrase_required");
    await storeProtectedSeed({ ...next, passphrase });
  }
  return n;
}

/** Promote open → protected by encrypting under a passphrase. */
export async function protectWithPassphrase(passphrase: string): Promise<void> {
  if (passphrase.length < 8) throw new Error("passphrase_too_short");
  const cur = getSeed();
  if (!cur) throw new Error("no_seed");
  await storeProtectedSeed({ ...cur, passphrase });
}

/** Demote protected → open. Caller must have unlocked first via unlockSeed. */
export function unprotectSeed(): void {
  if (!cached) throw new Error("seed_locked");
  storeOpenSeed(cached);
}

/** Wipe both seed records. Use with care. */
export function forgetSeed(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_PROTECTED);
  localStorage.removeItem(STORAGE_KEY_OPEN);
  cached = null;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/** Get the mnemonic for backup display. May be null if seed pre-dates mnemonic storage. */
export function getMnemonic(): string | null {
  const seed = getSeed();
  return seed?.mnemonic ?? null;
}

/** Get the raw seed bytes as base64url for non-standard backup. */
export function getSeedBackupString(): string | null {
  const seed = getSeed();
  if (!seed) return null;
  return b64uEncode(seed.seed);
}

/**
 * Replace the current seed with a recovered one (from mnemonic-import sweep).
 * Sets counter to the recovered next-free-index. If `storagePassphrase` is
 * provided, stores in protected mode; otherwise open mode (zero-friction default).
 *
 * NOTE: `storagePassphrase` is the at-rest passphrase, distinct from the
 * BIP-39 mnemonic passphrase used during seed derivation.
 */
export async function installRecoveredSeed(args: {
  seed: Uint8Array;
  mnemonic: string;
  counter: number;
  storagePassphrase?: string;
}): Promise<void> {
  const record: SeedAndCounter = {
    seed: args.seed,
    counter: args.counter,
    mnemonic: args.mnemonic,
  };
  if (args.storagePassphrase && args.storagePassphrase.length >= 8) {
    await storeProtectedSeed({ ...record, passphrase: args.storagePassphrase });
  } else {
    storeOpenSeed(record);
  }
}

/** Replace the current seed with a fresh one (new mnemonic). Resets counter to 0. */
export async function regenerateSeed(args: {
  newSeed: Uint8Array;
  newMnemonic: string;
  passphraseIfProtected?: string;
}): Promise<void> {
  const mode = getSeedMode();
  if (mode === "protected") {
    if (!args.passphraseIfProtected) throw new Error("passphrase_required");
    await storeProtectedSeed({
      seed: args.newSeed,
      counter: 0,
      mnemonic: args.newMnemonic,
      passphrase: args.passphraseIfProtected,
    });
  } else {
    storeOpenSeed({ seed: args.newSeed, counter: 0, mnemonic: args.newMnemonic });
  }
}
