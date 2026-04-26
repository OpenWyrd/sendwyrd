/**
 * wyrdHistory — author-side localStorage record of published wyrds.
 *
 * Verifies storage shape, ordering, idempotent tombstoning, dedupe-by-handle
 * merge semantics, and the optionality of `k_read_b64u` on recovered entries.
 */

import { describe, expect, it } from "vitest";
import {
  addHistoryEntry,
  clearHistory,
  listHistory,
  markHistoryEntryGone,
  mergeHistoryEntries,
  type HistoryEntry,
} from "@/lib/wyrdHistory";

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    handle: "AAAAAAAAAAAAAAAA",
    n: 0,
    k_origin_pub_b64u: "k_origin_pub_b64u_value",
    k_read_b64u: "k_read_b64u_value_43_chars_padding_to_make",
    published_at: 1_700_000_000_000,
    expires_at: 1_710_000_000_000,
    replies_enabled: true,
    ...overrides,
  };
}

describe("wyrdHistory.addHistoryEntry", () => {
  it("persists an entry to localStorage", () => {
    const e = makeEntry();
    addHistoryEntry(e);
    const raw = localStorage.getItem("sendwyrd:history:v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].handle).toBe(e.handle);
  });

  it("prepends new entries (newest first)", () => {
    addHistoryEntry(makeEntry({ handle: "first00000000000", published_at: 1 }));
    addHistoryEntry(makeEntry({ handle: "second0000000000", published_at: 2 }));
    const list = listHistory();
    expect(list[0]?.handle).toBe("second0000000000");
    expect(list[1]?.handle).toBe("first00000000000");
  });
});

describe("wyrdHistory.listHistory", () => {
  it("returns [] when storage is empty", () => {
    expect(listHistory()).toEqual([]);
  });

  it("returns [] on malformed JSON gracefully", () => {
    localStorage.setItem("sendwyrd:history:v1", "{not json");
    expect(listHistory()).toEqual([]);
  });

  it("returns [] when stored value is not an array", () => {
    localStorage.setItem("sendwyrd:history:v1", JSON.stringify({ foo: "bar" }));
    expect(listHistory()).toEqual([]);
  });
});

describe("wyrdHistory.clearHistory", () => {
  it("removes the localStorage key", () => {
    addHistoryEntry(makeEntry());
    expect(listHistory()).toHaveLength(1);
    clearHistory();
    expect(localStorage.getItem("sendwyrd:history:v1")).toBeNull();
    expect(listHistory()).toEqual([]);
  });
});

describe("wyrdHistory.markHistoryEntryGone", () => {
  it("sets gone_at + gone_reason on an existing entry", () => {
    const e = makeEntry({ handle: "burn00000000burn" });
    addHistoryEntry(e);
    markHistoryEntryGone("burn00000000burn", "burned", 1_720_000_000_000);
    const found = listHistory().find((x) => x.handle === "burn00000000burn");
    expect(found?.gone_at).toBe(1_720_000_000_000);
    expect(found?.gone_reason).toBe("burned");
  });

  it("is idempotent — re-marking does not overwrite the original gone_at", () => {
    const e = makeEntry({ handle: "idem000000000000" });
    addHistoryEntry(e);
    markHistoryEntryGone("idem000000000000", "burned", 1);
    markHistoryEntryGone("idem000000000000", "expired", 2);
    const found = listHistory().find((x) => x.handle === "idem000000000000");
    expect(found?.gone_at).toBe(1); // first call wins
    expect(found?.gone_reason).toBe("burned");
  });

  it("is a no-op when handle is unknown", () => {
    addHistoryEntry(makeEntry({ handle: "real000000000000" }));
    markHistoryEntryGone("ghost00000000000", "burned");
    const found = listHistory().find((x) => x.handle === "real000000000000");
    expect(found?.gone_at).toBeUndefined();
  });
});

describe("wyrdHistory.mergeHistoryEntries", () => {
  it("dedupes by handle, keeping the existing entry", () => {
    addHistoryEntry(
      makeEntry({ handle: "dup00000000dup00", k_read_b64u: "original_read_key" }),
    );
    const added = mergeHistoryEntries([
      makeEntry({ handle: "dup00000000dup00", k_read_b64u: undefined }),
      makeEntry({ handle: "fresh00000000000", published_at: 999 }),
    ]);
    expect(added).toBe(1); // only the fresh handle is new
    const all = listHistory();
    const dup = all.find((e) => e.handle === "dup00000000dup00");
    // existing entry preserved, including k_read_b64u
    expect(dup?.k_read_b64u).toBe("original_read_key");
    expect(all.find((e) => e.handle === "fresh00000000000")).toBeDefined();
  });

  it("preserves recovered=true on merged entries", () => {
    const recovered = makeEntry({
      handle: "rec00recoveredAA",
      k_read_b64u: undefined,
      recovered: true,
    });
    mergeHistoryEntries([recovered]);
    const all = listHistory();
    const found = all.find((e) => e.handle === "rec00recoveredAA");
    expect(found?.recovered).toBe(true);
    expect(found?.k_read_b64u).toBeUndefined();
  });

  it("allows recovered entries to lack k_read_b64u", () => {
    const recovered = makeEntry({
      handle: "noread0000000000",
      k_read_b64u: undefined,
      recovered: true,
    });
    expect(() => mergeHistoryEntries([recovered])).not.toThrow();
    expect(listHistory()).toHaveLength(1);
  });

  it("sorts merged result by published_at descending", () => {
    mergeHistoryEntries([
      makeEntry({ handle: "old00000000oldAA", published_at: 100 }),
      makeEntry({ handle: "new00000000newAA", published_at: 200 }),
      makeEntry({ handle: "mid00000000midAA", published_at: 150 }),
    ]);
    const all = listHistory();
    expect(all.map((e) => e.handle)).toEqual([
      "new00000000newAA",
      "mid00000000midAA",
      "old00000000oldAA",
    ]);
  });

  it("returns 0 when all entries already exist", () => {
    addHistoryEntry(makeEntry({ handle: "exist00000000000" }));
    const added = mergeHistoryEntries([makeEntry({ handle: "exist00000000000" })]);
    expect(added).toBe(0);
  });
});
