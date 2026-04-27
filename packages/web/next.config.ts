import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

// Content-Security-Policy. Closes the Phase E open item from
// spec_mop_v1.md §19.5. Originally shipped in Report-Only mode for
// observation; Sentry telemetry ran clean over real traffic, so we flipped
// to enforce mode on 2026-04-26.
//
// Why each directive looks the way it does:
//   default-src 'self'         — closed default
//   script-src 'self' 'unsafe-inline'
//                              — Next App Router injects inline hydration
//                                <script> tags. Nonce-based CSP requires
//                                middleware threading and is a Phase E++
//                                follow-up; for v1 we tolerate inline.
//   style-src 'self' 'unsafe-inline'
//                              — Tailwind layer + Next inline <style>;
//                                same nonce caveat as scripts.
//   img-src 'self' https: data:
//                              — LinkEmbed / ImageEmbed pull arbitrary
//                                HTTPS image URLs from /api/v1/unfurl,
//                                plus inline data: placeholders.
//   media-src 'self' https:    — WyrdBody auto-embeds <video>/<audio>
//                                from arbitrary HTTPS URLs (ADR-011).
//   connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io
//                              — Sentry beacon endpoints; everything else
//                                hits same-origin (/api/* on sendwyrd.com).
//   frame-ancestors 'none'     — paired with X-Frame-Options DENY.
//   object-src 'none'          — no plugin embeds, ever.
//   base-uri 'self'            — block <base> injection attacks.
//   form-action 'self'         — POSTs only to our origin.
//   manifest-src 'self'        — PWA manifest.
//   worker-src 'self'          — service worker at /sw.js.
//   font-src 'self'            — system stack only; no remote fonts.
//
// CSP matters more here than for most apps: the URL fragment carries
// `K_read` and is the load-bearing secret. An XSS on sendwyrd.com would
// let an attacker exfil decryption keys for any wyrd the victim viewed.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "media-src 'self' https:",
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join("; ");

// Permissions-Policy: deny every powerful API SendWyrd doesn't use.
// Defense in depth in case a third-party script (none today, but future
// integrations or a compromised dependency) ever tries to wake one up.
const permissionsPolicy = [
  "accelerometer=()",
  "ambient-light-sensor=()",
  "autoplay=()",
  "battery=()",
  "browsing-topics=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "interest-cohort=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "sync-xhr=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

const config: NextConfig = {
  reactStrictMode: true,
  // No analytics, no image optimization domain allowlist (renderer fetches OG client-side per ADR-011).
  poweredByHeader: false,
  // Emit `.map` files in production so Sentry can resolve minified stack
  // traces. Next 15's flag is boolean only (no `'hidden'` mode); the CI
  // workflow uploads maps to Sentry then DELETES them from the build
  // output before `opennextjs-cloudflare build` copies assets to the
  // worker bundle. Source maps must never reach clients (giving the
  // world an unminified codebase). See `.github/workflows/deploy.yml`.
  productionBrowserSourceMaps: true,
  // Privacy hardening at the framework level — see renderer_contract_v1.md §2.2.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // 2-year HSTS with subdomain pinning, ready for the preload list.
          // sendwyrd.com is HTTPS-only on Cloudflare; no HTTP fallback to break.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: permissionsPolicy },
          // Enforce mode (was Report-Only through the post-launch observe
          // window; flipped 2026-04-26 after real-traffic telemetry came
          // back clean). Any rule violation now blocks the offending
          // resource and fires a `securitypolicyviolation` event.
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  // Transpile workspace package.
  transpilePackages: ["@sendwyrd/core"],
  // Webpack: map `.js` import suffixes to `.ts` source so the workspace
  // package's NodeNext-style imports resolve. (Next 15 still uses webpack
  // by default; add for Turbopack too in case it gets enabled.)
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default config;
