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
