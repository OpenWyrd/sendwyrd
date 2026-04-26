/**
 * Client-side Sentry initialization. Mounted once from the root layout.
 *
 * Why @sentry/browser direct (not @sentry/nextjs)?
 *
 * @sentry/nextjs ships a webpack plugin and a server-side runtime
 * integration that assumes the Next Node.js server. SendWyrd builds with
 * OpenNext-on-Workers, which has documented incompatibility with
 * @sentry/nextjs (opennextjs-cloudflare#756). The lighter integration
 * gives us error reporting with the renderer-contract §16 redaction we
 * need, without fighting the build.
 *
 * Server-side errors on the Worker runtime are caught by the api worker's
 * @sentry/cloudflare wrapper. Client-side errors flow through here.
 *
 * NEXT_PUBLIC_SENTRY_DSN is exposed to the browser bundle by Next at
 * build time. When unset/empty, Sentry.init() is a no-op — no events
 * sent, no SDK overhead beyond the client bundle.
 */

"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/browser";
import { redactBeforeSend } from "@/lib/sentryRedact";

let initialized = false;

export function SentryInit() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;

    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "";
    // No-op when unset. Per renderer-contract §16: telemetry is
    // opt-in, default-deny. The user provisions a Sentry DSN at their
    // leisure; until then the SDK does nothing.
    if (!dsn) return;

    Sentry.init({
      dsn,
      // No traces in v1. Pure error reporting; performance/profiling
      // requires a separate privacy review.
      tracesSampleRate: 0,
      // Default-deny PII at the SDK layer too. Belt + suspenders;
      // redactBeforeSend is the load-bearing scrub.
      sendDefaultPii: false,
      // Default integrations include Breadcrumbs, GlobalHandlers,
      // HttpContext. We disable BrowserApiErrors capture for storage
      // events (we use localStorage extensively for non-secret history;
      // accidental capture risk is low but not zero) and rely on
      // beforeSend / beforeBreadcrumb to drop anything risky.
      beforeSend: redactBeforeSend,
      beforeBreadcrumb: (breadcrumb) => {
        if (breadcrumb.category === "console") return null;
        // Sentry's default-on `Breadcrumbs` integration captures
        // localStorage / sessionStorage events under category 'storage'.
        // SendWyrd writes the (encrypted) seed and per-handle history
        // to localStorage; never ship those keys/values to a 3p.
        if (breadcrumb.category === "storage") return null;
        return breadcrumb;
      },
    });
  }, []);

  return null;
}
