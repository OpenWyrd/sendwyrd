/**
 * Web App Manifest. Next.js 15 generates /manifest.webmanifest from this.
 *
 * theme_color and background_color are pinned to the dark theme tokens
 * (canonical per visual_direction_v1.md §2.3). The OS uses these for splash
 * screens and standalone-mode chrome before the page renders. A single value
 * has to be picked even when the app supports both themes; we pick dark.
 *
 * categories are honest. NOT "social" — SendWyrd is a relay primitive, not
 * a chat app (see ADR-014 + project memory feedback_anti_scope_creep).
 *
 * share_target lets other apps share *into* SendWyrd (incoming only). We do
 * NOT request access to the user's contact list or outgoing share-sheet
 * identity. The target routes to /compose?prefill=<text> so the user can
 * land in the composer with the shared content prefilled.
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SendWyrd",
    short_name: "SendWyrd",
    description: "Hyperlinks for conversation. Encrypted, ephemeral, no account.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Pinned to dark theme — visual_direction_v1.md §2.3 (canonical).
    theme_color: "#0a0a0a",
    background_color: "#0a0a0a",
    categories: ["utilities", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Web Share Target — receive shared text/URL into compose.
    // GET method, so the shared payload arrives as query params and the
    // compose route reads them client-side. No POST handler required.
    share_target: {
      action: "/compose",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
