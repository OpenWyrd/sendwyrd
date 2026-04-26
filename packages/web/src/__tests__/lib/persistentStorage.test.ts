/**
 * persistentStorage — wraps navigator.storage.persist/persisted/estimate.
 *
 * jsdom doesn't ship the StorageManager API. We patch navigator.storage
 * before each test, exercising both supported and unsupported branches.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatBytes,
  getPersistenceState,
  getStorageEstimate,
  requestPersistence,
} from "@/lib/persistentStorage";

interface FakeStorage {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

function patchStorage(fake: FakeStorage | undefined) {
  Object.defineProperty(navigator, "storage", {
    value: fake,
    configurable: true,
  });
}

const originalStorageDescriptor = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(navigator),
  "storage",
);

afterEach(() => {
  if (originalStorageDescriptor) {
    Object.defineProperty(
      Object.getPrototypeOf(navigator),
      "storage",
      originalStorageDescriptor,
    );
  }
  // @ts-expect-error - clean up the per-instance shadow we set above
  delete navigator.storage;
});

beforeEach(() => {
  localStorage.clear();
});

describe("requestPersistence", () => {
  it("calls navigator.storage.persist() and returns the granted boolean", async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    const persisted = vi.fn(() => Promise.resolve(false));
    patchStorage({ persist, persisted });

    const state = await requestPersistence();
    expect(state.supported).toBe(true);
    expect(state.granted).toBe(true);
    expect(state.asked).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
    expect(localStorage.getItem("sendwyrd:persist-asked")).toBe("1");
  });

  it("short-circuits if already persisted (idempotent)", async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    const persisted = vi.fn(() => Promise.resolve(true));
    patchStorage({ persist, persisted });

    const state = await requestPersistence();
    expect(state.granted).toBe(true);
    // Should not have re-called persist when already granted.
    expect(persist).not.toHaveBeenCalled();
  });

  it("returns supported=false when StorageManager is unavailable", async () => {
    patchStorage(undefined);
    const state = await requestPersistence();
    expect(state.supported).toBe(false);
    expect(state.granted).toBeNull();
    expect(state.asked).toBe(false);
  });

  it("treats an exception from persist() as granted=false (non-throwing)", async () => {
    patchStorage({
      persist: () => Promise.reject(new Error("denied")),
      persisted: () => Promise.resolve(false),
    });
    const state = await requestPersistence();
    expect(state.supported).toBe(true);
    expect(state.granted).toBe(false);
    expect(state.asked).toBe(true);
  });
});

describe("getPersistenceState", () => {
  it("reports granted=true when storage.persisted() resolves true", async () => {
    patchStorage({
      persist: () => Promise.resolve(true),
      persisted: () => Promise.resolve(true),
    });
    const state = await getPersistenceState();
    expect(state.supported).toBe(true);
    expect(state.granted).toBe(true);
  });

  it("reports granted=false + asked=false when never asked", async () => {
    patchStorage({
      persist: () => Promise.resolve(false),
      persisted: () => Promise.resolve(false),
    });
    const state = await getPersistenceState();
    expect(state.supported).toBe(true);
    expect(state.granted).toBe(false);
    expect(state.asked).toBe(false);
  });

  it("reports asked=true after the flag is set in localStorage", async () => {
    patchStorage({
      persist: () => Promise.resolve(false),
      persisted: () => Promise.resolve(false),
    });
    localStorage.setItem("sendwyrd:persist-asked", "1");
    const state = await getPersistenceState();
    expect(state.asked).toBe(true);
  });

  it("reports supported=false when the API is missing entirely", async () => {
    patchStorage(undefined);
    const state = await getPersistenceState();
    expect(state.supported).toBe(false);
    expect(state.granted).toBeNull();
  });
});

describe("getStorageEstimate", () => {
  it("returns a parseable estimate object when available", async () => {
    patchStorage({
      estimate: () =>
        Promise.resolve({ usage: 1_000_000, quota: 10_000_000 }),
    });
    const e = await getStorageEstimate();
    expect(e).not.toBeNull();
    expect(e!.usage).toBe(1_000_000);
    expect(e!.quota).toBe(10_000_000);
    expect(e!.percent).toBeCloseTo(10, 1);
  });

  it("returns null when navigator.storage.estimate is unsupported", async () => {
    patchStorage(undefined);
    expect(await getStorageEstimate()).toBeNull();
  });

  it("handles missing usage/quota gracefully (zero defaults)", async () => {
    patchStorage({ estimate: () => Promise.resolve({}) });
    const e = await getStorageEstimate();
    expect(e).not.toBeNull();
    expect(e!.usage).toBe(0);
    expect(e!.quota).toBe(0);
    expect(e!.percent).toBe(0);
  });

  it("returns null when estimate() throws", async () => {
    patchStorage({
      estimate: () => Promise.reject(new Error("boom")),
    });
    expect(await getStorageEstimate()).toBeNull();
  });
});

describe("formatBytes", () => {
  it("formats bytes / KB / MB / GB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.00 GB");
  });
});
