import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SendWyrd",
  description: "Hyperlinks for conversation.",
  // SVG favicon = the wyrd sigil. Color adapts to browser tab chrome:
  //   default = #0a0a0a (dark, visible on light chrome)
  //   prefers-color-scheme: dark = #ededed (light, visible on dark chrome)
  // Single SVG so the mark stays single-source.
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
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
