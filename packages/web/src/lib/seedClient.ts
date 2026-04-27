/**
 * Browser-side seed management.
 *
 * Two storage records on disk:
 *   - `sendwyrd:open_seed:v1`     — plain seed (JSON)
 *   - `sendwyrd:seed:v1`          — passphrase-encrypted seed (PBKDF2-AES-256-GCM)
 *
 * Three resulting modes (which records exist):
 *
 *   - **open**: only the plain record. No passphrase set.
 *
 *   - **protected, relaxed gate** (default when a passphrase is set):
 *     BOTH records present. Plain record is the runtime source of truth so
 *     the app never prompts during normal use; the encrypted record is a
 *     passphrase-protected backup snapshot for migration / recovery from a
 *     full cache wipe. The encrypted snapshot is refreshed at toggle time
 *     and at recovery/regen events; it is *not* re-encrypted on every
 *     counter increment (counter drift in the snapshot is harmless because
 *     HD recovery re-syncs counter via the presence-check sweep). Premise:
 *     "I wanted to encrypt my seed, not gate my flow."
 *
 *   - **protected, strict gate**: only the encrypted record. Every browser
 *     session must enter the passphrase before compose/burn/etc work. The
 *     decrypted seed and passphrase live in module-level memory until
 *     lockSeed() / forgetSeed() / tab close. Strict is opt-in for users who
 *     want session-level protection.
 *
 * Promotion (open → protected) defaults to relaxed gate. Demotion
 * (protected → open) goes through dedicated helpers.
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

interface OpenSeedJson {
  v: 1;
  counter: number;
  mnemonic: string | null;
  seed_b64u: string;
}

let cached: SeedAndCounter | null = null;
let cachedPassphrase: string | null = null;

export type SeedMode = "open" | "protected" | null;
export type PassphraseGate = "strict" | "relaxed";

export function getSeedMode(): SeedMode {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(STORAGE_KEY_PROTECTED)) return "protected";
  if (localStorage.getItem(STORAGE_KEY_OPEN)) return "open";
  return null;
}

/**
 * Only meaningful when getSeedMode() === "protected". Returns null when no
 * passphrase is set. "relaxed" iff the plain seed coexists with the encrypted
 * blob; "strict" iff only the encrypted blob exists.
 */
export function getPassphraseGate(): PassphraseGate | null {
  if (typeof window === "undefined") return null;
  const hasProtected = !!localStorage.getItem(STORAGE_KEY_PROTECTED);
  if (!hasProtected) return null;
  const hasPlain = !!localStorage.getItem(STORAGE_KEY_OPEN);
  return hasPlain ? "relaxed" : "strict";
}

export function hasSeed(): boolean {
  return getSeedMode() !== null;
}

/**
 * "Unlocked" means the runtime can read the seed without prompting.
 * - open mode: always
 * - protected + relaxed: always (plain seed sits beside the encrypted blob)
 * - protected + strict: only after explicit unlockSeed()
 */
export function isUnlocked(): boolean {
  if (getSeedMode() === "open") return true;
  if (getPassphraseGate() === "relaxed") return true;
  return cached !== null;
}

/**
 * Get the seed if available. Plain record (open or relaxed) is preferred so
 * the runtime always sees the latest counter. In strict mode after unlock,
 * the in-memory cache is the only source.
 */
export function getSeed(): SeedAndCounter | null {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY_OPEN);
    if (raw) {
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
  }
  return cached;
}

/** Internal: write the plain record without touching the encrypted blob. */
function writePlainSeedRaw(args: SeedAndCounter): void {
  const json: OpenSeedJson = {
    v: 1,
    counter: args.counter,
    mnemonic: args.mnemonic ?? null,
    seed_b64u: b64uEncode(args.seed),
  };
  localStorage.setItem(STORAGE_KEY_OPEN, JSON.stringify(json));
  cached = args;
}

/** Internal: write the encrypted blob without touching the plain record. */
async function writeEncryptedSeedRaw(
  args: SeedAndCounter & { passphrase: string },
): Promise<void> {
  const record = await encryptSeedRecord(args);
  localStorage.setItem(STORAGE_KEY_PROTECTED, record);
  cached = { seed: args.seed, counter: args.counter, mnemonic: args.mnemonic };
  cachedPassphrase = args.passphrase;
}

/** Store a seed in open mode: plain record only, drop any encrypted blob. */
export function storeOpenSeed(args: SeedAndCounter): void {
  writePlainSeedRaw(args);
  localStorage.removeItem(STORAGE_KEY_PROTECTED);
  cachedPassphrase = null;
}

/**
 * Store a seed in strict-protected mode: encrypted blob only, plain record
 * dropped. Use protectWithPassphrase() for the typical promotion path.
 */
export async function storeProtectedSeed(
  args: SeedAndCounter & { passphrase: string },
): Promise<void> {
  await writeEncryptedSeedRaw(args);
  localStorage.removeItem(STORAGE_KEY_OPEN);
}

/** Compatibility alias used elsewhere — defaults to strict-protected. */
export const storeSeed = storeProtectedSeed;

/** Decrypt the protected seed using the user's passphrase. */
export async function unlockSeed(passphrase: string): Promise<SeedAndCounter> {
  const record = localStorage.getItem(STORAGE_KEY_PROTECTED);
  if (!record) throw new Error("no_protected_seed");
  const data = await decryptSeedRecord(record, passphrase);
  cached = data;
  cachedPassphrase = passphrase;
  return data;
}

/**
 * Drop the in-memory seed + passphrase without touching storage. Mostly a
 * strict-mode concern; in relaxed mode the plain record on disk means the
 * runtime can still read the seed regardless of cache state.
 */
export function lockSeed(): void {
  cached = null;
  cachedPassphrase = null;
}

/**
 * Increment the counter, persist, return the consumed `n`.
 *
 *   - open / relaxed: writes the plain record. In relaxed mode the encrypted
 *     blob is left untouched (snapshot-from-toggle-time).
 *   - strict: re-encrypts the blob using the cached passphrase (or an
 *     explicit override, mainly for tests).
 */
export async function consumeNextIndex(passphrase?: string): Promise<number> {
  const cur = getSeed();
  if (!cur) throw new Error("no_seed");
  const n = cur.counter;
  const next: SeedAndCounter = {
    seed: cur.seed,
    counter: n + 1,
    mnemonic: cur.mnemonic,
  };
  const gate = getPassphraseGate();
  if (gate === "strict") {
    const pp = passphrase ?? cachedPassphrase;
    if (!pp) throw new Error("passphrase_required");
    await writeEncryptedSeedRaw({ ...next, passphrase: pp });
  } else {
    writePlainSeedRaw(next);
  }
  return n;
}

/**
 * Promote open → protected by encrypting under a passphrase. Defaults to
 * `gate: "relaxed"` — the encrypted blob is a backup snapshot, the plain
 * record stays on disk so the user is never prompted during normal app use.
 * Pass `gate: "strict"` to opt into per-session unlock prompts instead.
 */
export async function protectWithPassphrase(
  passphrase: string,
  gate: PassphraseGate = "relaxed",
): Promise<void> {
  if (passphrase.length < 8) throw new Error("passphrase_too_short");
  const cur = getSeed();
  if (!cur) throw new Error("no_seed");
  if (gate === "strict") {
    await storeProtectedSeed({ ...cur, passphrase });
  } else {
    await writeEncryptedSeedRaw({ ...cur, passphrase });
    writePlainSeedRaw(cur);
  }
}

/** Demote protected → open. Caller must have unlocked first via unlockSeed
 *  (strict) or hold the cached/plain seed (relaxed). */
export function unprotectSeed(): void {
  const cur = getSeed();
  if (!cur) throw new Error("seed_locked");
  storeOpenSeed(cur);
}

/**
 * Toggle the passphrase gate between strict and relaxed. Both directions
 * require the passphrase: the unlock verifies it, and we always re-encrypt
 * the live counter so the blob is current when the gate changes.
 */
export async function setPassphraseGate(
  target: PassphraseGate,
  passphrase: string,
): Promise<void> {
  if (getSeedMode() !== "protected") throw new Error("no_passphrase_set");
  const seed = await unlockSeed(passphrase);
  await writeEncryptedSeedRaw({ ...seed, passphrase });
  if (target === "relaxed") {
    writePlainSeedRaw(seed);
  } else {
    localStorage.removeItem(STORAGE_KEY_OPEN);
  }
}

/** Wipe both seed records. Use with care. */
export function forgetSeed(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_PROTECTED);
  localStorage.removeItem(STORAGE_KEY_OPEN);
  cached = null;
  cachedPassphrase = null;
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
 * provided, stores in protected mode (relaxed by default). Otherwise open.
 *
 * NOTE: `storagePassphrase` is the at-rest passphrase, distinct from the
 * BIP-39 mnemonic passphrase used during seed derivation.
 */
export async function installRecoveredSeed(args: {
  seed: Uint8Array;
  mnemonic: string;
  counter: number;
  storagePassphrase?: string;
  storageGate?: PassphraseGate;
}): Promise<void> {
  const record: SeedAndCounter = {
    seed: args.seed,
    counter: args.counter,
    mnemonic: args.mnemonic,
  };
  if (args.storagePassphrase && args.storagePassphrase.length >= 8) {
    const gate = args.storageGate ?? "relaxed";
    if (gate === "strict") {
      await storeProtectedSeed({
        ...record,
        passphrase: args.storagePassphrase,
      });
    } else {
      await writeEncryptedSeedRaw({
        ...record,
        passphrase: args.storagePassphrase,
      });
      writePlainSeedRaw(record);
    }
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
    const gate = getPassphraseGate();
    const next: SeedAndCounter = {
      seed: args.newSeed,
      counter: 0,
      mnemonic: args.newMnemonic,
    };
    await writeEncryptedSeedRaw({
      ...next,
      passphrase: args.passphraseIfProtected,
    });
    if (gate === "relaxed") {
      writePlainSeedRaw(next);
    } else {
      localStorage.removeItem(STORAGE_KEY_OPEN);
    }
  } else {
    storeOpenSeed({
      seed: args.newSeed,
      counter: 0,
      mnemonic: args.newMnemonic,
    });
  }
}
