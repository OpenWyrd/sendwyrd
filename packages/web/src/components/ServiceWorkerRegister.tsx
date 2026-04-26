"use client";

/**
 * Registers the service worker on mount. Client-only, no UI.
 *
 * SW lives at /sw.js (root scope). Registration is silent on success; on
 * failure we log to console and continue — PWA features degrade gracefully.
 */

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Avoid registering during local dev when not wanted; production only
    // would also work, but the SW is harmless in dev so we register always.
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
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);
  return null;
}
