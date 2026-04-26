import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const config: NextConfig = {
  reactStrictMode: true,
  // No analytics, no image optimization domain allowlist (renderer fetches OG client-side per ADR-011).
  poweredByHeader: false,
  // Privacy hardening at the framework level — see renderer_contract_v1.md §2.2.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  // Transpile workspace package.
  transpilePackages: ["@sendwyrd/core"],
};

export default config;
