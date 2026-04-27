/**
 * Disk persistence for the MCP server: seed (open or passphrase-protected),
 * wyrd history, runtime in-memory cache.
 *
 * Open-mode file shape:
 *   { v: 1, counter: number, seed_b64u: string, mnemonic: string }
 * matches the web app's `sendwyrd:open_seed:v1` payload.
 *
 * Protected-mode file is the base64url-encoded record from
 * `@sendwyrd/core/seedStore`, identical to web's `sendwyrd:seed:v1` value.
 */

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import {
  decryptSeedRecord,
  encryptSeedRecord,
  generateSeed,
  isValidMnemonic,
  mnemonicToSeed,
  type SeedAndCounter,
  b64uDecode,
  b64uEncode,
} from "@sendwyrd/core";
import type { McpConfig } from "./config.js";

export type SeedMode = "open" | "protected" | "absent";

export interface HistoryEntry {
  handle: string;
  n: number;
  k_origin_pub_b64u: string;
  /** Absent on entries reconstructed via HD recovery sweep. */
  k_read_b64u?: string;
  published_at: number;
  expires_at: number;
  replies_enabled: boolean;
  nickname?: string;
  gone_at?: number;
  gone_reason?: "burned" | "expired";
  recovered?: boolean;
  /** True when this wyrd's body is an authorship attestation we composed. */
  is_attestation?: boolean;
}

interface OpenSeedFile {
  v: 1;
  counter: number;
  seed_b64u: string;
  mnemonic: string;
}

/** Process-lifetime cache for protected-mode seed + passphrase. */
let cachedSeed: SeedAndCounter | null = null;
let cachedPassphrase: string | null = null;

export function getSeedMode(cfg: McpConfig): SeedMode {
  if (existsSync(cfg.protectedSeedFile)) return "protected";
  if (existsSync(cfg.openSeedFile)) return "open";
  return "absent";
}

export function isUnlocked(cfg: McpConfig): boolean {
  if (getSeedMode(cfg) === "open") return true;
  return cachedSeed !== null;
}

/**
 * Read the seed regardless of mode. For protected-mode seeds, requires either
 * a previously cached passphrase, the explicit `passphrase` arg, or
 * `cfg.passphrase` (env-resolved). Throws if locked and no passphrase.
 */
export async function loadSeed(
  cfg: McpConfig,
  passphrase?: string,
): Promise<SeedAndCounter> {
  const mode = getSeedMode(cfg);
  if (mode === "absent") {
    throw new Error(
      "no seed installed — call sendwyrd_init first (generates a fresh mnemonic)",
    );
  }
  if (mode === "open") {
    return readOpenSeed(cfg);
  }
  // protected
  if (cachedSeed) return cachedSeed;
  const pass = passphrase ?? cfg.passphrase;
  if (!pass) {
    throw new Error(
      "seed is passphrase-protected and not unlocked — set SENDWYRD_PASSPHRASE / SENDWYRD_PASSPHRASE_CMD or call sendwyrd_unlock",
    );
  }
  const record = readFileSync(cfg.protectedSeedFile, "utf8").trim();
  const sc = await decryptSeedRecord(record, pass);
  cachedSeed = sc;
  cachedPassphrase = pass;
  return sc;
}

/**
 * Persist a counter advance after a successful (or failed) compose. Per spec
 * §5.2 the index is consumed regardless, so the caller MUST call this with
 * `n + 1` before any error path returns.
 */
export async function bumpCounter(
  cfg: McpConfig,
  newCounter: number,
): Promise<void> {
  const mode = getSeedMode(cfg);
  if (mode === "open") {
    const sc = readOpenSeed(cfg);
    writeOpenSeed(cfg, { ...sc, counter: newCounter });
    return;
  }
  if (mode === "protected") {
    const sc = await loadSeed(cfg);
    if (!cachedPassphrase) {
      throw new Error("counter bump requires unlocked passphrase");
    }
    const record = await encryptSeedRecord({
      seed: sc.seed,
      counter: newCounter,
      mnemonic: sc.mnemonic,
      passphrase: cachedPassphrase,
    });
    writeFileSync(cfg.protectedSeedFile, record + "\n", { mode: 0o600 });
    cachedSeed = { ...sc, counter: newCounter };
    return;
  }
  throw new Error("no seed to bump");
}

export function lock(): void {
  cachedSeed = null;
  cachedPassphrase = null;
}

/**
 * Install a freshly generated mnemonic. If `passphrase` is provided, write the
 * protected-mode encrypted record; otherwise write the open-mode JSON.
 */
export async function installFreshSeed(
  cfg: McpConfig,
  args: { words: 12 | 24; passphrase?: string },
): Promise<{ mnemonic: string }> {
  ensureConfigDir(cfg);
  if (getSeedMode(cfg) !== "absent") {
    throw new Error(
      "a seed already exists at this config dir — refusing to overwrite",
    );
  }
  const { mnemonic, seed } = generateSeed(args.words);
  await writeNewSeed(cfg, { seed, mnemonic, counter: 0 }, args.passphrase);
  return { mnemonic };
}

/**
 * Import an existing mnemonic. `counter` defaults to 0; HD recovery sweep can
 * raise it post-import.
 */
export async function installImportedSeed(
  cfg: McpConfig,
  args: { mnemonic: string; counter?: number; passphrase?: string },
): Promise<void> {
  ensureConfigDir(cfg);
  if (getSeedMode(cfg) !== "absent") {
    throw new Error(
      "a seed already exists — call sendwyrd_forget first if you intend to replace it",
    );
  }
  if (!isValidMnemonic(args.mnemonic)) {
    throw new Error("mnemonic failed BIP-39 checksum");
  }
  const seed = mnemonicToSeed(args.mnemonic, "");
  await writeNewSeed(
    cfg,
    { seed, mnemonic: args.mnemonic, counter: args.counter ?? 0 },
    args.passphrase,
  );
}

/** Wipe all on-disk state. Caller is expected to confirm intent upstream. */
export function forgetSeed(cfg: McpConfig): void {
  for (const p of [
    cfg.openSeedFile,
    cfg.protectedSeedFile,
    cfg.historyFile,
    cfg.configFile,
  ]) {
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        // ignore — best-effort wipe
      }
    }
  }
  lock();
}

// -- history -----------------------------------------------------------------

export function listHistory(cfg: McpConfig): HistoryEntry[] {
  if (!existsSync(cfg.historyFile)) return [];
  try {
    const raw = readFileSync(cfg.historyFile, "utf8");
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function findHistory(
  cfg: McpConfig,
  handle: string,
): HistoryEntry | undefined {
  return listHistory(cfg).find((e) => e.handle === handle);
}

export function upsertHistory(cfg: McpConfig, entry: HistoryEntry): void {
  ensureConfigDir(cfg);
  const list = listHistory(cfg);
  const idx = list.findIndex((e) => e.handle === entry.handle);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.unshift(entry);
  list.sort((a, b) => b.published_at - a.published_at);
  writeFileSync(cfg.historyFile, JSON.stringify(list, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function markGone(
  cfg: McpConfig,
  handle: string,
  reason: "burned" | "expired",
  gone_at = Date.now(),
): void {
  const list = listHistory(cfg);
  const idx = list.findIndex((e) => e.handle === handle);
  if (idx < 0) return;
  list[idx] = { ...list[idx]!, gone_at, gone_reason: reason };
  writeFileSync(cfg.historyFile, JSON.stringify(list, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function mergeHistory(
  cfg: McpConfig,
  entries: HistoryEntry[],
): { added: number } {
  ensureConfigDir(cfg);
  const list = listHistory(cfg);
  const byHandle = new Map(list.map((e) => [e.handle, e]));
  let added = 0;
  for (const e of entries) {
    const prev = byHandle.get(e.handle);
    if (!prev) {
      byHandle.set(e.handle, e);
      added++;
    } else {
      // Preserve k_read_b64u and nickname if present; recovery has neither.
      byHandle.set(e.handle, {
        ...e,
        k_read_b64u: prev.k_read_b64u ?? e.k_read_b64u,
        nickname: prev.nickname ?? e.nickname,
      });
    }
  }
  const merged = [...byHandle.values()].sort(
    (a, b) => b.published_at - a.published_at,
  );
  writeFileSync(cfg.historyFile, JSON.stringify(merged, null, 2) + "\n", {
    mode: 0o600,
  });
  return { added };
}

// -- internals ---------------------------------------------------------------

function ensureConfigDir(cfg: McpConfig): void {
  if (!existsSync(cfg.configDir)) {
    mkdirSync(cfg.configDir, { recursive: true, mode: 0o700 });
  }
}

function readOpenSeed(cfg: McpConfig): SeedAndCounter {
  const raw = readFileSync(cfg.openSeedFile, "utf8");
  const j = JSON.parse(raw) as OpenSeedFile;
  if (j.v !== 1) throw new Error(`open seed file version unsupported: ${j.v}`);
  return {
    seed: b64uDecode(j.seed_b64u),
    counter: j.counter,
    mnemonic: j.mnemonic,
  };
}

function writeOpenSeed(cfg: McpConfig, sc: SeedAndCounter): void {
  ensureConfigDir(cfg);
  if (!sc.mnemonic) throw new Error("open seed file requires mnemonic");
  const j: OpenSeedFile = {
    v: 1,
    counter: sc.counter,
    seed_b64u: b64uEncode(sc.seed),
    mnemonic: sc.mnemonic,
  };
  writeFileSync(cfg.openSeedFile, JSON.stringify(j, null, 2) + "\n", {
    mode: 0o600,
  });
}

async function writeNewSeed(
  cfg: McpConfig,
  sc: SeedAndCounter,
  passphrase: string | undefined,
): Promise<void> {
  ensureConfigDir(cfg);
  if (passphrase) {
    const record = await encryptSeedRecord({
      seed: sc.seed,
      counter: sc.counter,
      mnemonic: sc.mnemonic,
      passphrase,
    });
    writeFileSync(cfg.protectedSeedFile, record + "\n", { mode: 0o600 });
    cachedSeed = sc;
    cachedPassphrase = passphrase;
  } else {
    writeOpenSeed(cfg, sc);
  }
}
