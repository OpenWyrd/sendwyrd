/**
 * installPrompt — `beforeinstallprompt` capture + iOS detection.
 *
 * The module module-singleton-captures the deferred prompt on import. To
 * re-test fresh state we use vitest.resetModules + dynamic import.
 *
 * iOS detection: useInstallState should report ios=true on iPhone UA, false
 * on a desktop UA. beforeinstallprompt suppression after appinstalled is
 * verified by dispatching the events on window.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const ORIGINAL_UA = navigator.userAgent;

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

function restoreUserAgent() {
  setUserAgent(ORIGINAL_UA);
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  restoreUserAgent();
});

describe("installPrompt — iOS detection", () => {
  it("returns ios=true on iPhone user agents", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    const mod = await import("@/lib/installPrompt");
    const { result } = renderHook(() => mod.useInstallState());
    expect(result.current.ios).toBe(true);
  });

  it("returns ios=false on a desktop Chrome UA", async () => {
    setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0",
    );
    const mod = await import("@/lib/installPrompt");
    const { result } = renderHook(() => mod.useInstallState());
    expect(result.current.ios).toBe(false);
  });

  it("returns ios=true for iPadOS-as-Mac with touch points (iPadOS 13+)", async () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    );
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: 5,
      configurable: true,
    });
    const mod = await import("@/lib/installPrompt");
    const { result } = renderHook(() => mod.useInstallState());
    expect(result.current.ios).toBe(true);
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: 0,
      configurable: true,
    });
  });
});

describe("installPrompt — beforeinstallprompt capture", () => {
  it("captures beforeinstallprompt and exposes canPrompt=true", async () => {
    const mod = await import("@/lib/installPrompt");
    expect(mod.canPromptInstall()).toBe(false);

    // Synthesize a BeforeInstallPromptEvent — jsdom doesn't ship the real
    // class, but the module only depends on the dispatched object's shape.
    const fakeEvent = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };
    fakeEvent.prompt = vi.fn(() => Promise.resolve());
    Object.defineProperty(fakeEvent, "userChoice", {
      value: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(fakeEvent);

    expect(mod.canPromptInstall()).toBe(true);
  });

  it("clears canPrompt after triggerInstall consumes the event", async () => {
    const mod = await import("@/lib/installPrompt");

    const fakeEvent = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };
    const promptFn = vi.fn(() => Promise.resolve());
    fakeEvent.prompt = promptFn;
    Object.defineProperty(fakeEvent, "userChoice", {
      value: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(fakeEvent);

    const outcome = await mod.triggerInstall();
    expect(outcome).toBe("accepted");
    expect(promptFn).toHaveBeenCalledOnce();
    expect(mod.canPromptInstall()).toBe(false);
  });

  it("returns 'unavailable' when no deferred prompt exists", async () => {
    const mod = await import("@/lib/installPrompt");
    await expect(mod.triggerInstall()).resolves.toBe("unavailable");
  });
});

describe("installPrompt — appinstalled suppression", () => {
  it("clears the deferred prompt and persists installed=1 on appinstalled", async () => {
    const mod = await import("@/lib/installPrompt");

    const fakeEvent = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };
    fakeEvent.prompt = vi.fn(() => Promise.resolve());
    Object.defineProperty(fakeEvent, "userChoice", {
      value: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(fakeEvent);
    expect(mod.canPromptInstall()).toBe(true);

    window.dispatchEvent(new Event("appinstalled"));
    expect(mod.canPromptInstall()).toBe(false);
    expect(localStorage.getItem("sendwyrd:installed")).toBe("1");
    expect(mod.isInstalled()).toBe(true);
  });
});

describe("installPrompt — useInstallState shape", () => {
  it("returns { canPrompt, installed, ios } object", async () => {
    setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0",
    );
    const mod = await import("@/lib/installPrompt");
    const { result } = renderHook(() => mod.useInstallState());
    expect(result.current).toHaveProperty("canPrompt");
    expect(result.current).toHaveProperty("installed");
    expect(result.current).toHaveProperty("ios");
    expect(typeof result.current.canPrompt).toBe("boolean");
    expect(typeof result.current.installed).toBe("boolean");
    expect(typeof result.current.ios).toBe("boolean");
  });

  it("re-renders when canPrompt changes via beforeinstallprompt event", async () => {
    setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0",
    );
    const mod = await import("@/lib/installPrompt");
    const { result } = renderHook(() => mod.useInstallState());
    expect(result.current.canPrompt).toBe(false);

    await act(async () => {
      const fakeEvent = new Event("beforeinstallprompt") as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
      };
      fakeEvent.prompt = vi.fn(() => Promise.resolve());
      Object.defineProperty(fakeEvent, "userChoice", {
        value: Promise.resolve({ outcome: "accepted" as const }),
      });
      window.dispatchEvent(fakeEvent);
    });
    expect(result.current.canPrompt).toBe(true);
  });
});
