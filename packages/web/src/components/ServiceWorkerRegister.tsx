"use client";

/**
 * Registers the service worker on mount. Client-only, no UI.
 *
 * SW lives at /sw.js (root scope). Registration is silent on success; on
 * failure we log to console and continue — PWA features degrade gracefully.
 *
 * Update handling: when a new SW takes control of an already-controlled
 * page (post-deploy), the running document is still wired to the old chunk
 * graph. We reload once to pick up the fresh HTML + chunks coherently. The
 * `hadController` guard skips reload on the very first install (no prior
 * controller → nothing to throw away).
 */

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Snapshot whether this page was already controlled at load time. If so,
    // a `controllerchange` later means a real upgrade — reload. If not, the
    // current activation is the first install and we stay put.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    const reloadOnce = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    const onControllerChange = () => {
      if (hadController) reloadOnce();
    };
    const onMessage = (e: MessageEvent) => {
      if (
        hadController &&
        e.data &&
        typeof e.data === "object" &&
        (e.data as { type?: string }).type === "sw-activated"
      ) {
        reloadOnce();
      }
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    navigator.serviceWorker.addEventListener("message", onMessage);

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Non-fatal. Log for the curious; don't surface to the user.
          // eslint-disable-next-line no-console
          console.warn("[sw] register failed:", err);
        });
    };
    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }

    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);
  return null;
}
