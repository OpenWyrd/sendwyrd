import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SendWyrd",
  description: "Hyperlinks for conversation.",
  // No favicon yet — wyrd-sigil glyph (visual_direction_v1.md §7) is Phase F.
  icons: { icon: "/favicon.ico" },
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
