"use client";

/**
 * `beforeinstallprompt` capture (Chrome / Android / desktop Chromium).
 *
 * Browsers that support PWA installation fire `beforeinstallprompt` once
 * on first eligible page load. We stash the event globally so the user
 * can later trigger it from a deliberate UI affordance (in /settings).
 *
 * iOS Safari does NOT fire this event — there is no programmatic install
 * prompt on iOS. Users must use Share → Add to Home Screen. We surface
 * iOS instructions only when the user explicitly asks (link in settings).
 *
 * On `appinstalled`, we mark the flag and clear the deferred prompt; the
 * settings UI suppresses the affordance from then on.
 */

import { useEffect, useState } from "react";

const INSTALLED_KEY = "sendwyrd:installed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    try {
      localStorage.setItem(INSTALLED_KEY, "1");
    } catch {}
    deferredPrompt = null;
    notify();
  });
}

export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  // Display-mode standalone covers both iOS (window.navigator.standalone)
  // and Chromium (matchMedia('(display-mode: standalone)')).
  try {
    if (localStorage.getItem(INSTALLED_KEY) === "1") return true;
  } catch {}
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  }
  // iOS Safari quirk.
  // @ts-expect-error - non-standard but ubiquitous on iOS.
  if (window.navigator.standalone === true) return true;
  return false;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIPhoneOrIPad = /iPhone|iPad|iPod/i.test(ua);
  // iPadOS 13+ reports as Mac with touch support.
  const isIPadOS =
    /Macintosh/i.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return isIPhoneOrIPad || isIPadOS;
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function triggerInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferredPrompt) return "unavailable";
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // Per spec: prompt() consumes the event; reset.
    deferredPrompt = null;
    notify();
    return outcome;
  } catch {
    return "unavailable";
  }
}

/**
 * React hook: re-renders when install state changes.
 */
export function useInstallState() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return {
    canPrompt: canPromptInstall(),
    installed: isInstalled(),
    ios: isIOS(),
  };
}
