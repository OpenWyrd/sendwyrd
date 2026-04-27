/**
 * wyrdInbox — browser-local viewing log of opened wyrds (per ADR-024).
 * Tests the schema, idempotent recordInboxView, opt-in/opt-out switch,
 * and the author-skip behavior that prevents self-authored wyrds from
 * appearing in the inbox.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearInbox,
  isAutoRecordEnabled,
  listInbox,
  recordInboxView,
  removeInboxEntry,
  renameInboxEntry,
  setAutoRecordEnabled,
} from "@/lib/wyrdInbox";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("wyrdInbox — basics", () => {
  it("listInbox returns [] when empty", () => {
    expect(listInbox()).toEqual([]);
  });

  it("recordInboxView creates an entry on first view", () => {
    recordInboxView({
      handle: "h0000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(),
      now: 1_000_000,
    });
    const all = listInbox();
    expect(all).toHaveLength(1);
    expect(all[0]?.handle).toBe("h0000000000000000");
    expect(all[0]?.first_seen_at).toBe(1_000_000);
    expect(all[0]?.last_viewed_at).toBe(1_000_000);
  });

  it("recordInboxView is idempotent on handle — bumps last_viewed_at, preserves first_seen_at", () => {
    recordInboxView({
      handle: "h0000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(),
      now: 1_000_000,
    });
    recordInboxView({
      handle: "h0000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(),
      now: 2_000_000,
    });
    const all = listInbox();
    expect(all).toHaveLength(1);
    expect(all[0]?.first_seen_at).toBe(1_000_000);
    expect(all[0]?.last_viewed_at).toBe(2_000_000);
  });

  it("recordInboxView skips self-authored wyrds (handle in authoredHandles)", () => {
    recordInboxView({
      handle: "h0000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(["h0000000000000000"]),
    });
    expect(listInbox()).toEqual([]);
  });

  it("removeInboxEntry deletes by handle", () => {
    recordInboxView({
      handle: "a000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(),
    });
    recordInboxView({
      handle: "b000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(),
    });
    removeInboxEntry("a000000000000000");
    const all = listInbox();
    expect(all).toHaveLength(1);
    expect(all[0]?.handle).toBe("b000000000000000");
  });

  it("clearInbox wipes everything", () => {
    recordInboxView({
      handle: "h0000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(),
    });
    clearInbox();
    expect(listInbox()).toEqual([]);
  });

  it("renameInboxEntry sets and clears nicknames", () => {
    recordInboxView({
      handle: "h0000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(),
    });
    renameInboxEntry("h0000000000000000", "from alice");
    expect(listInbox()[0]?.nickname).toBe("from alice");
    renameInboxEntry("h0000000000000000", "");
    expect(listInbox()[0]?.nickname).toBeUndefined();
  });
});

describe("wyrdInbox — auto-record opt-out", () => {
  it("default: auto-record is enabled", () => {
    expect(isAutoRecordEnabled()).toBe(true);
  });

  it("setAutoRecordEnabled(false) disables auto-record", () => {
    setAutoRecordEnabled(false);
    expect(isAutoRecordEnabled()).toBe(false);
    recordInboxView({
      handle: "h0000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(),
    });
    expect(listInbox()).toEqual([]);
  });

  it("re-enabling lets new views land", () => {
    setAutoRecordEnabled(false);
    setAutoRecordEnabled(true);
    recordInboxView({
      handle: "h0000000000000000",
      k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
      authoredHandles: new Set(),
    });
    expect(listInbox()).toHaveLength(1);
  });
});
