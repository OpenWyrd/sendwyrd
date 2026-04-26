import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SentryInit } from "@/components/SentryInit";
import { MobileComposeBar } from "@/components/MobileComposeBar";

export const metadata: Metadata = {
  title: "SendWyrd",
  description: "Hyperlinks for conversational objects.",
  applicationName: "SendWyrd",
  // Theme color is exposed two ways: through the manifest (single value
  // pinned to dark, used by the OS for splash/standalone chrome) and via
  // <meta name="theme-color"> with light/dark media queries below for the
  // browser tab chrome. The two are complementary, not conflicting.
  appleWebApp: {
    capable: true,
    title: "SendWyrd",
    statusBarStyle: "black-translucent",
  },
  // Belt-and-suspenders: emit the legacy `apple-mobile-web-app-capable`
  // alongside Next.js's modern `mobile-web-app-capable`. Older iOS Safari
  // versions only honor the prefixed form.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  // SVG favicon = the wyrd sigil. Color adapts to browser tab chrome:
  //   default = #0a0a0a (dark, visible on light chrome)
  //   prefers-color-scheme: dark = #ededed (light, visible on dark chrome)
  // Single SVG so the mark stays single-source. Apple touch icon is a
  // separate PNG raster (iOS does not honor SVG icons for the home screen).
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>svg{color:#0a0a0a}@media (prefers-color-scheme:dark){svg{color:#ededed}}</style><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 5 5 L 16 18 L 11 27"/><path d="M 27 5 L 16 18 L 21 27"/><path d="M 16 5 L 16 18"/></g><circle cx="16" cy="18" r="1.5" fill="currentColor"/></svg>`,
          ),
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  // viewport-fit=cover so notched iPhones use the full safe area; pages
  // that need to respect the notch read env(safe-area-inset-*) in their
  // own padding. SendWyrd's pages already pad generously so this is mostly
  // free.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f4ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <MobileComposeBar />
        <ServiceWorkerRegister />
        <SentryInit />
      </body>
    </html>
  );
}
