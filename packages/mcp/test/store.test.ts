import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bumpCounter,
  getSeedMode,
  installFreshSeed,
  installImportedSeed,
  isUnlocked,
  listHistory,
  loadSeed,
  lock,
  markGone,
  mergeHistory,
  upsertHistory,
} from "../src/store.js";
import type { McpConfig } from "../src/config.js";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

function makeCfg(): McpConfig {
  const dir = mkdtempSync(join(tmpdir(), "sendwyrd-mcp-test-"));
  return {
    origin: "https://sendwyrd.test",
    configDir: dir,
    configFile: join(dir, "config.json"),
    openSeedFile: join(dir, "seed.open.json"),
    protectedSeedFile: join(dir, "seed.enc"),
    historyFile: join(dir, "history.json"),
    passphrase: null,
  };
}

describe("store: open mode", () => {
  let cfg: McpConfig;
  beforeEach(() => {
    cfg = makeCfg();
    lock();
  });
  afterEach(() => {
    rmSync(cfg.configDir, { recursive: true, force: true });
  });

  it("starts absent", () => {
    expect(getSeedMode(cfg)).toBe("absent");
    expect(isUnlocked(cfg)).toBe(false);
  });

  it("install fresh produces a 12-word mnemonic and open mode is unlocked", async () => {
    const { mnemonic } = await installFreshSeed(cfg, { words: 12 });
    expect(mnemonic.split(/\s+/)).toHaveLength(12);
    expect(getSeedMode(cfg)).toBe("open");
    expect(isUnlocked(cfg)).toBe(true);
    expect(existsSync(cfg.openSeedFile)).toBe(true);
  });

  it("import sets counter 0 by default; bump persists", async () => {
    await installImportedSeed(cfg, { mnemonic: TEST_MNEMONIC });
    const sc1 = await loadSeed(cfg);
    expect(sc1.counter).toBe(0);
    expect(sc1.mnemonic).toBe(TEST_MNEMONIC);
    await bumpCounter(cfg, 5);
    const sc2 = await loadSeed(cfg);
    expect(sc2.counter).toBe(5);
  });

  it("rejects double-install", async () => {
    await installImportedSeed(cfg, { mnemonic: TEST_MNEMONIC });
    await expect(
      installImportedSeed(cfg, { mnemonic: TEST_MNEMONIC }),
    ).rejects.toThrow(/seed already exists/);
  });

  it("rejects invalid mnemonic", async () => {
    await expect(
      installImportedSeed(cfg, { mnemonic: "not a valid mnemonic" }),
    ).rejects.toThrow(/BIP-39 checksum/);
  });
});

describe("store: protected mode", () => {
  let cfg: McpConfig;
  beforeEach(() => {
    cfg = makeCfg();
    lock();
  });
  afterEach(() => {
    rmSync(cfg.configDir, { recursive: true, force: true });
  });

  it("install with passphrase encrypts; loadSeed requires passphrase", async () => {
    await installImportedSeed(cfg, {
      mnemonic: TEST_MNEMONIC,
      passphrase: "correct horse",
    });
    expect(getSeedMode(cfg)).toBe("protected");
    expect(isUnlocked(cfg)).toBe(true); // cached after install
    lock();
    expect(isUnlocked(cfg)).toBe(false);
    await expect(loadSeed(cfg)).rejects.toThrow(/passphrase-protected/);
    const sc = await loadSeed(cfg, "correct horse");
    expect(sc.mnemonic).toBe(TEST_MNEMONIC);
    expect(isUnlocked(cfg)).toBe(true);
  });

  it("wrong passphrase fails", async () => {
    await installImportedSeed(cfg, {
      mnemonic: TEST_MNEMONIC,
      passphrase: "right",
    });
    lock();
    await expect(loadSeed(cfg, "wrong")).rejects.toThrow();
  });

  it("bumpCounter re-encrypts in place", async () => {
    await installImportedSeed(cfg, {
      mnemonic: TEST_MNEMONIC,
      passphrase: "p",
    });
    await bumpCounter(cfg, 7);
    lock();
    const sc = await loadSeed(cfg, "p");
    expect(sc.counter).toBe(7);
  });
});

describe("store: history", () => {
  let cfg: McpConfig;
  beforeEach(() => {
    cfg = makeCfg();
  });
  afterEach(() => {
    rmSync(cfg.configDir, { recursive: true, force: true });
  });

  it("starts empty", () => {
    expect(listHistory(cfg)).toEqual([]);
  });

  it("upsert adds; second upsert merges", () => {
    upsertHistory(cfg, {
      handle: "AAAAAAAAAAAAAAAA",
      n: 0,
      k_origin_pub_b64u: "x",
      k_read_b64u: "k",
      published_at: 100,
      expires_at: 200,
      replies_enabled: false,
    });
    upsertHistory(cfg, {
      handle: "AAAAAAAAAAAAAAAA",
      n: 0,
      k_origin_pub_b64u: "x",
      k_read_b64u: "k",
      published_at: 100,
      expires_at: 200,
      replies_enabled: true,
      nickname: "first",
    });
    const list = listHistory(cfg);
    expect(list).toHaveLength(1);
    expect(list[0]!.replies_enabled).toBe(true);
    expect(list[0]!.nickname).toBe("first");
  });

  it("markGone tags burned", () => {
    upsertHistory(cfg, {
      handle: "BBBBBBBBBBBBBBBB",
      n: 1,
      k_origin_pub_b64u: "x",
      k_read_b64u: "k",
      published_at: 100,
      expires_at: 200,
      replies_enabled: false,
    });
    markGone(cfg, "BBBBBBBBBBBBBBBB", "burned", 999);
    const e = listHistory(cfg)[0]!;
    expect(e.gone_at).toBe(999);
    expect(e.gone_reason).toBe("burned");
  });

  it("mergeHistory preserves k_read_b64u when reconstructed entry lacks it", () => {
    upsertHistory(cfg, {
      handle: "CCCCCCCCCCCCCCCC",
      n: 2,
      k_origin_pub_b64u: "x",
      k_read_b64u: "k",
      published_at: 100,
      expires_at: 200,
      replies_enabled: false,
    });
    const { added } = mergeHistory(cfg, [
      {
        handle: "CCCCCCCCCCCCCCCC",
        n: 2,
        k_origin_pub_b64u: "x",
        published_at: 100,
        expires_at: 200,
        replies_enabled: false,
        recovered: true,
      },
    ]);
    expect(added).toBe(0);
    const e = listHistory(cfg)[0]!;
    expect(e.k_read_b64u).toBe("k");
    expect(e.recovered).toBe(true);
  });

  it("history file is mode 0600", async () => {
    upsertHistory(cfg, {
      handle: "DDDDDDDDDDDDDDDD",
      n: 0,
      k_origin_pub_b64u: "x",
      published_at: 1,
      expires_at: 2,
      replies_enabled: false,
    });
    const json = JSON.parse(readFileSync(cfg.historyFile, "utf8"));
    expect(Array.isArray(json)).toBe(true);
  });
});
